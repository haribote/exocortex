export class OllamaUnreachableError extends Error {}
export class OllamaTimeoutError extends Error {}
export class OllamaAbortedError extends Error {}
export class OllamaStreamError extends Error {}

export class OllamaResponseError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export type OllamaThink = boolean | 'low' | 'medium' | 'high' | 'max'

export interface OllamaChatRequest {
  model: string
  prompt: string
  system?: string
  format?: unknown
  temperature?: number
  think?: OllamaThink
}

export interface OllamaChatResult {
  content: string
  totalDurationMs: number
  thinking?: string
  promptEvalTokens?: number
  outputTokens?: number
  loadDurationMs?: number
  doneReason?: string
}

export interface OllamaChatChunk {
  content: string
  done: boolean
  thinking?: string
  totalDurationMs?: number
  promptEvalTokens?: number
  outputTokens?: number
  loadDurationMs?: number
  doneReason?: string
}

export interface OllamaChatStreamOptions {
  signal?: AbortSignal
}

export interface OllamaChatOptions {
  requestTimeoutMs?: number
}

export interface OllamaClient {
  chat(
    request: OllamaChatRequest,
    options?: OllamaChatOptions,
  ): Promise<OllamaChatResult>
  chatStream(
    request: OllamaChatRequest,
    options?: OllamaChatStreamOptions,
  ): Promise<AsyncIterable<OllamaChatChunk>>
}

export interface OllamaClientOptions {
  idleTimeoutMs?: number
  requestTimeoutMs?: number
}

// The ceiling on one whole call: a cold model load followed by generation that
// the 64K window lets run for tens of thousands of tokens. At the measured ~72
// tokens per second the window runs out well before this does, which is where
// the ceiling belongs.
const REQUEST_TIMEOUT_MS = 900_000
// Both paths are bounded by silence rather than by total length: a call that has
// produced nothing for this long is stuck, however long the whole call is
// allowed to take.
const IDLE_TIMEOUT_MS = 300_000
const MAX_LINE_BYTES = 1024 * 1024

export function createOllamaClient(
  baseUrl: string,
  options: OllamaClientOptions = {},
): OllamaClient {
  const idleTimeoutMs = options.idleTimeoutMs ?? IDLE_TIMEOUT_MS
  const requestTimeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS

  async function openStream(
    request: OllamaChatRequest,
    streamOptions: {
      signal?: AbortSignal
      deadlineSignal?: AbortSignal
    },
  ): Promise<AsyncIterable<OllamaChatChunk>> {
    const idleController = new AbortController()
    const signals = [idleController.signal]
    if (streamOptions.signal) {
      signals.push(streamOptions.signal)
    }
    if (streamOptions.deadlineSignal) {
      signals.push(streamOptions.deadlineSignal)
    }

    let idleTimer: ReturnType<typeof setTimeout> | undefined
    const armIdleTimer = () => {
      idleTimer = setTimeout(() => idleController.abort(), idleTimeoutMs)
    }
    const clearIdleTimer = () => {
      if (idleTimer !== undefined) {
        clearTimeout(idleTimer)
        idleTimer = undefined
      }
    }

    const iterateOptions: IterateOptions = {
      idleController,
      externalSignal: streamOptions.signal,
      deadlineSignal: streamOptions.deadlineSignal,
      clearIdleTimer,
      armIdleTimer,
    }

    armIdleTimer()
    let response: Response
    try {
      response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody(request, true)),
        signal: AbortSignal.any(signals),
      })
    } catch (cause) {
      clearIdleTimer()
      throw toStreamStartError(cause, iterateOptions)
    }

    if (!response.ok) {
      clearIdleTimer()
      const detail = await response.text().catch(() => '')
      throw new OllamaResponseError(
        detail.trim() || `ollama returned ${response.status}`,
        response.status,
      )
    }

    const body = response.body
    if (body === null) {
      clearIdleTimer()
      throw new OllamaStreamError('ollama returned an empty body')
    }

    return iterateChunks(body, iterateOptions)
  }

  return {
    // Streaming here is not about handing the answer over in pieces: it is what
    // makes ollama send the response headers before generation ends. undici caps
    // the wait for headers at 300000 and no signal passed to fetch raises that
    // ceiling, so a non-streaming call died as a fetch failure at five minutes
    // no matter what REQUEST_TIMEOUT_MS said.
    // The per-file reviewer overrides the deadline: one file has no reason to
    // need the ceiling a whole pull request does, and a shorter one is what
    // lets a runaway file be abandoned while the rest of the run continues.
    async chat(request, options = {}) {
      const chunks = await openStream(request, {
        deadlineSignal: AbortSignal.timeout(
          options.requestTimeoutMs ?? requestTimeoutMs,
        ),
      })
      return collectChatResult(chunks)
    },

    async chatStream(request, streamOptions = {}) {
      return openStream(request, { signal: streamOptions.signal })
    },
  }
}

async function collectChatResult(
  chunks: AsyncIterable<OllamaChatChunk>,
): Promise<OllamaChatResult> {
  let content = ''
  let thinking = ''
  let last: OllamaChatChunk | undefined
  for await (const chunk of chunks) {
    content += chunk.content
    thinking += chunk.thinking ?? ''
    last = chunk
  }

  const result: OllamaChatResult = {
    content,
    totalDurationMs: last?.totalDurationMs ?? 0,
  }
  if (thinking !== '') {
    result.thinking = thinking
  }
  if (last?.promptEvalTokens !== undefined) {
    result.promptEvalTokens = last.promptEvalTokens
  }
  if (last?.outputTokens !== undefined) {
    result.outputTokens = last.outputTokens
  }
  if (last?.loadDurationMs !== undefined) {
    result.loadDurationMs = last.loadDurationMs
  }
  if (last?.doneReason !== undefined) {
    result.doneReason = last.doneReason
  }
  return result
}

interface IterateOptions {
  idleController: AbortController
  externalSignal: AbortSignal | undefined
  deadlineSignal: AbortSignal | undefined
  clearIdleTimer: () => void
  armIdleTimer: () => void
}

async function* iterateChunks(
  body: ReadableStream<Uint8Array>,
  options: IterateOptions,
): AsyncGenerator<OllamaChatChunk> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let sawDone = false
  let seen = 0
  let bytes = 0

  try {
    for (;;) {
      let result: ReadableStreamReadResult<Uint8Array>
      try {
        result = await reader.read()
      } catch (cause) {
        throw toReadError(cause, options)
      } finally {
        options.clearIdleTimer()
      }

      if (result.done) {
        break
      }

      bytes += result.value.byteLength
      buffer += decoder.decode(result.value, { stream: true })

      let newline = buffer.indexOf('\n')
      while (newline !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, '')
        buffer = buffer.slice(newline + 1)
        const chunk = parseLine(line)
        if (chunk !== undefined) {
          seen += 1
          if (chunk.done) {
            sawDone = true
          }
          yield chunk
        }
        newline = buffer.indexOf('\n')
      }

      if (buffer.length > MAX_LINE_BYTES) {
        throw new OllamaStreamError(
          'ollama stream line exceeded the size limit',
        )
      }

      options.armIdleTimer()
    }

    buffer += decoder.decode()
    const tail = parseLine(buffer)
    if (tail !== undefined) {
      if (tail.done) {
        sawDone = true
      }
      yield tail
    }

    if (!sawDone) {
      // Without these counters an early end is indistinguishable from ollama
      // never having answered at all, and the two have different causes.
      throw new OllamaStreamError(
        `ollama stream ended before completion after ${seen} chunks and ${bytes} bytes, trailing ${JSON.stringify(buffer.slice(0, 200))}`,
      )
    }
  } finally {
    options.clearIdleTimer()
    await reader.cancel().catch(() => {})
  }
}

function parseLine(line: string): OllamaChatChunk | undefined {
  if (line.trim() === '') {
    return undefined
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    throw new OllamaStreamError('ollama stream returned a malformed line')
  }

  const record = isRecord(parsed) ? parsed : {}
  if (typeof record.error === 'string') {
    throw new OllamaStreamError(record.error)
  }

  const message = isRecord(record.message) ? record.message : {}
  const content = typeof message.content === 'string' ? message.content : ''
  const done = record.done === true
  const chunk: OllamaChatChunk = { content, done }
  if (typeof message.thinking === 'string') {
    chunk.thinking = message.thinking
  }
  if (typeof record.total_duration === 'number') {
    chunk.totalDurationMs = Math.round(record.total_duration / 1_000_000)
  }
  if (typeof record.prompt_eval_count === 'number') {
    chunk.promptEvalTokens = record.prompt_eval_count
  }
  if (typeof record.eval_count === 'number') {
    chunk.outputTokens = record.eval_count
  }
  if (typeof record.load_duration === 'number') {
    chunk.loadDurationMs = Math.round(record.load_duration / 1_000_000)
  }
  if (typeof record.done_reason === 'string') {
    chunk.doneReason = record.done_reason
  }
  return chunk
}

function toStreamStartError(cause: unknown, options: IterateOptions): Error {
  if (
    options.idleController.signal.aborted ||
    options.deadlineSignal?.aborted
  ) {
    return new OllamaTimeoutError('ollama request timed out', { cause })
  }
  if (options.externalSignal?.aborted) {
    return new OllamaAbortedError('ollama request aborted', { cause })
  }
  if (cause instanceof Error && cause.name === 'TimeoutError') {
    return new OllamaTimeoutError('ollama request timed out', { cause })
  }
  return new OllamaUnreachableError('failed to reach ollama', { cause })
}

function toReadError(cause: unknown, options: IterateOptions): Error {
  if (
    options.idleController.signal.aborted ||
    options.deadlineSignal?.aborted
  ) {
    return new OllamaTimeoutError('ollama stream stalled', { cause })
  }
  if (options.externalSignal?.aborted) {
    return new OllamaAbortedError('ollama stream aborted', { cause })
  }
  return new OllamaUnreachableError('ollama stream failed', { cause })
}

interface OllamaMessage {
  role: 'system' | 'user'
  content: string
}

function buildMessages(request: OllamaChatRequest): OllamaMessage[] {
  const user: OllamaMessage = { role: 'user', content: request.prompt }
  if (request.system === undefined) {
    return [user]
  }
  return [{ role: 'system', content: request.system }, user]
}

function buildBody(
  request: OllamaChatRequest,
  stream: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.model,
    stream,
    messages: buildMessages(request),
  }
  if (request.format !== undefined) {
    body.format = request.format
  }
  if (request.temperature !== undefined) {
    body.options = { temperature: request.temperature }
  }
  if (request.think !== undefined) {
    body.think = request.think
  }
  return body
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
