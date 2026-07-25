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

export type OllamaThink = boolean | string

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
  promptEvalTokens?: number
  outputTokens?: number
  loadDurationMs?: number
}

export interface OllamaChatChunk {
  content: string
  done: boolean
  totalDurationMs?: number
}

export interface OllamaChatStreamOptions {
  signal?: AbortSignal
}

export interface OllamaClient {
  chat(request: OllamaChatRequest): Promise<OllamaChatResult>
  chatStream(
    request: OllamaChatRequest,
    options?: OllamaChatStreamOptions,
  ): Promise<AsyncIterable<OllamaChatChunk>>
}

export interface OllamaClientOptions {
  idleTimeoutMs?: number
}

const REQUEST_TIMEOUT_MS = 300_000
const IDLE_TIMEOUT_MS = 300_000
const MAX_LINE_BYTES = 1024 * 1024

export function createOllamaClient(
  baseUrl: string,
  options: OllamaClientOptions = {},
): OllamaClient {
  const idleTimeoutMs = options.idleTimeoutMs ?? IDLE_TIMEOUT_MS

  return {
    async chat(request) {
      const body = buildBody(request, false)

      let response: Response
      try {
        response = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
      } catch (cause) {
        throw toFetchError(cause)
      }

      if (!response.ok) {
        throw new OllamaResponseError(
          `ollama returned ${response.status}`,
          response.status,
        )
      }

      const parsed: unknown = await response.json()
      return toChatResult(parsed)
    },

    async chatStream(request, streamOptions = {}) {
      const idleController = new AbortController()
      const signals = [idleController.signal]
      if (streamOptions.signal) {
        signals.push(streamOptions.signal)
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
        throw toStreamStartError(cause, idleController, streamOptions.signal)
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

      return iterateChunks(body, {
        idleController,
        externalSignal: streamOptions.signal,
        clearIdleTimer,
        armIdleTimer,
      })
    },
  }
}

interface IterateOptions {
  idleController: AbortController
  externalSignal: AbortSignal | undefined
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

      buffer += decoder.decode(result.value, { stream: true })

      let newline = buffer.indexOf('\n')
      while (newline !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, '')
        buffer = buffer.slice(newline + 1)
        const chunk = parseLine(line)
        if (chunk !== undefined) {
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
      throw new OllamaStreamError('ollama stream ended before completion')
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
  if (done && typeof record.total_duration === 'number') {
    chunk.totalDurationMs = Math.round(record.total_duration / 1_000_000)
  }
  return chunk
}

function toFetchError(cause: unknown): Error {
  if (cause instanceof Error && cause.name === 'TimeoutError') {
    return new OllamaTimeoutError('ollama request timed out', { cause })
  }
  return new OllamaUnreachableError('failed to reach ollama', { cause })
}

function toStreamStartError(
  cause: unknown,
  idleController: AbortController,
  externalSignal: AbortSignal | undefined,
): Error {
  if (idleController.signal.aborted) {
    return new OllamaTimeoutError('ollama request timed out', { cause })
  }
  if (externalSignal?.aborted) {
    return new OllamaAbortedError('ollama request aborted', { cause })
  }
  return new OllamaUnreachableError('failed to reach ollama', { cause })
}

function toReadError(cause: unknown, options: IterateOptions): Error {
  if (options.idleController.signal.aborted) {
    return new OllamaTimeoutError('ollama stream stalled', { cause })
  }
  if (options.externalSignal?.aborted) {
    return new OllamaAbortedError('ollama stream aborted', { cause })
  }
  return new OllamaUnreachableError('ollama stream failed', { cause })
}

function buildMessages(
  request: OllamaChatRequest,
): { role: string; content: string }[] {
  const user = { role: 'user', content: request.prompt }
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

function toChatResult(body: unknown): OllamaChatResult {
  const record = isRecord(body) ? body : {}
  const message = isRecord(record.message) ? record.message : {}
  const content = typeof message.content === 'string' ? message.content : ''
  const totalDuration =
    typeof record.total_duration === 'number' ? record.total_duration : 0
  const result: OllamaChatResult = {
    content,
    totalDurationMs: Math.round(totalDuration / 1_000_000),
  }
  if (typeof record.prompt_eval_count === 'number') {
    result.promptEvalTokens = record.prompt_eval_count
  }
  if (typeof record.eval_count === 'number') {
    result.outputTokens = record.eval_count
  }
  if (typeof record.load_duration === 'number') {
    result.loadDurationMs = Math.round(record.load_duration / 1_000_000)
  }
  return result
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
