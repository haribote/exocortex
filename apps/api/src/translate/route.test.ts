import { describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import type {
  OllamaChatChunk,
  OllamaChatStreamOptions,
  OllamaClient,
} from '../ollama.js'
import {
  OllamaResponseError,
  OllamaTimeoutError,
  OllamaUnreachableError,
} from '../ollama.js'

type ChatStream = OllamaClient['chatStream']

interface AppOptions {
  heartbeatMs?: number
  headersGraceMs?: number
}

function appWith(chatStream: ChatStream, options: AppOptions = {}) {
  return createApp({
    ollama: {
      chatStream,
      async chat() {
        throw new Error('chat is not used by /translate')
      },
    },
    reviewModel: 'review-model',
    translateModel: 'translategemma:12b',
    heartbeatMs: options.heartbeatMs ?? 50,
    headersGraceMs: options.headersGraceMs ?? 1000,
  })
}

const jsonHeaders = { 'Content-Type': 'application/json' }

const jaToEn = JSON.stringify({ text: 'こんにちは', from: 'ja', to: 'en' })

function delta(content: string): OllamaChatChunk {
  return { content, done: false }
}

function done(totalDurationMs: number): OllamaChatChunk {
  return { content: '', done: true, totalDurationMs }
}

function iterableOf(chunks: OllamaChatChunk[]): AsyncIterable<OllamaChatChunk> {
  return {
    async *[Symbol.asyncIterator]() {
      yield* chunks
    },
  }
}

function iterableThrowing(
  chunks: OllamaChatChunk[],
  error: Error,
): AsyncIterable<OllamaChatChunk> {
  return {
    async *[Symbol.asyncIterator]() {
      yield* chunks
      throw error
    },
  }
}

async function readNdjson(
  res: Response,
  onLine?: (line: Record<string, unknown>) => void,
): Promise<Record<string, unknown>[]> {
  const body = res.body
  if (body === null) {
    throw new Error('response has no body')
  }
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const lines: Record<string, unknown>[] = []
  const push = (raw: string) => {
    if (raw.trim() === '') {
      return
    }
    const line = JSON.parse(raw) as Record<string, unknown>
    lines.push(line)
    onLine?.(line)
  }

  for (;;) {
    const { done: finished, value } = await reader.read()
    if (finished) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    let newline = buffer.indexOf('\n')
    while (newline !== -1) {
      push(buffer.slice(0, newline))
      buffer = buffer.slice(newline + 1)
      newline = buffer.indexOf('\n')
    }
  }
  buffer += decoder.decode()
  push(buffer)
  return lines
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('POST /translate', () => {
  it('returns 400 for an unsupported language code', async () => {
    const app = appWith(async () => iterableOf([done(0)]))
    const res = await app.request('/translate', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ text: 'x', from: 'fr', to: 'en' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns a 504 JSON body when ollama times out before committing', async () => {
    const app = appWith(async () => {
      throw new OllamaTimeoutError('slow')
    })
    const res = await app.request('/translate', {
      method: 'POST',
      headers: jsonHeaders,
      body: jaToEn,
    })
    expect(res.status).toBe(504)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect((await res.json()).error).toBe('inference_timeout')
  })

  it('returns a 503 JSON body when ollama is unreachable', async () => {
    const app = appWith(async () => {
      throw new OllamaUnreachableError('down')
    })
    const res = await app.request('/translate', {
      method: 'POST',
      headers: jsonHeaders,
      body: jaToEn,
    })
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe('ollama_unreachable')
  })

  it('returns a 502 JSON body when ollama returns an error response', async () => {
    const app = appWith(async () => {
      throw new OllamaResponseError('ollama returned 404', 404)
    })
    const res = await app.request('/translate', {
      method: 'POST',
      headers: jsonHeaders,
      body: jaToEn,
    })
    expect(res.status).toBe(502)
    expect((await res.json()).error).toBe('ollama_error')
  })

  it('streams ndjson with a terminal done chunk', async () => {
    const app = appWith(async () =>
      iterableOf([delta('Hello'), delta(' world'), done(870)]),
    )
    const res = await app.request('/translate', {
      method: 'POST',
      headers: jsonHeaders,
      body: jaToEn,
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/x-ndjson')

    const lines = await readNdjson(res)
    expect(lines).toEqual([
      { delta: 'Hello' },
      { delta: ' world' },
      { done: true, meta: { model: 'translategemma:12b', durationMs: 870 } },
    ])
  })

  it('trims whitespace across the stream and never emits an empty delta', async () => {
    const app = appWith(async () =>
      iterableOf([
        delta('  '),
        delta('Hello'),
        delta(' '),
        delta('world'),
        delta('\n\n'),
        done(1),
      ]),
    )
    const res = await app.request('/translate', {
      method: 'POST',
      headers: jsonHeaders,
      body: jaToEn,
    })

    const lines = await readNdjson(res)
    const deltas = lines
      .filter((line) => 'delta' in line)
      .map((line) => line.delta)
    expect(deltas).toEqual(['Hello', ' world'])
    expect(deltas).not.toContain('')
  })

  it('emits heartbeats until the first delta and none afterwards', async () => {
    const gate = deferred<void>()
    const iterable: AsyncIterable<OllamaChatChunk> = {
      async *[Symbol.asyncIterator]() {
        await gate.promise
        yield delta('Hello')
        yield done(1)
      },
    }
    const app = appWith(async () => iterable, { heartbeatMs: 5 })

    const res = await app.request('/translate', {
      method: 'POST',
      headers: jsonHeaders,
      body: jaToEn,
    })

    let heartbeats = 0
    let sawDelta = false
    let heartbeatsAfterDelta = 0
    const lines = await readNdjson(res, (line) => {
      if (line.heartbeat === true) {
        heartbeats += 1
        if (sawDelta) {
          heartbeatsAfterDelta += 1
        }
        if (heartbeats >= 2 && !sawDelta) {
          gate.resolve()
        }
      }
      if ('delta' in line) {
        sawDelta = true
      }
    })

    expect(heartbeats).toBeGreaterThanOrEqual(2)
    expect(heartbeatsAfterDelta).toBe(0)
    expect(lines.at(-1)).toMatchObject({ done: true })
  })

  it('writes a terminal error line when generation fails after committing', async () => {
    const app = appWith(async () =>
      iterableThrowing(
        [delta('Hello'), delta(' world')],
        new OllamaTimeoutError('stalled'),
      ),
    )
    const res = await app.request('/translate', {
      method: 'POST',
      headers: jsonHeaders,
      body: jaToEn,
    })

    expect(res.status).toBe(200)
    const lines = await readNdjson(res)
    expect(lines.filter((line) => 'delta' in line)).toHaveLength(2)
    expect(lines.some((line) => line.done === true)).toBe(false)
    expect(lines.at(-1)).toEqual({
      error: 'inference_timeout',
      message: expect.any(String),
    })
  })

  it('commits and streams heartbeats when headers do not arrive within the grace window', async () => {
    const late = deferred<AsyncIterable<OllamaChatChunk>>()
    const app = appWith(() => late.promise, {
      heartbeatMs: 5,
      headersGraceMs: 10,
    })

    const res = await app.request('/translate', {
      method: 'POST',
      headers: jsonHeaders,
      body: jaToEn,
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/x-ndjson')

    const lines = await readNdjson(res, (line) => {
      if (line.heartbeat === true) {
        late.resolve(iterableOf([delta('Hello'), done(1)]))
      }
    })

    expect(lines.some((line) => line.heartbeat === true)).toBe(true)
    expect(lines).toContainEqual({ delta: 'Hello' })
    expect(lines.at(-1)).toMatchObject({ done: true })
  })

  it('degrades a late rejection to an in-band error line', async () => {
    const late = deferred<AsyncIterable<OllamaChatChunk>>()
    const app = appWith(() => late.promise, {
      heartbeatMs: 5,
      headersGraceMs: 10,
    })

    const res = await app.request('/translate', {
      method: 'POST',
      headers: jsonHeaders,
      body: jaToEn,
    })

    expect(res.status).toBe(200)
    const lines = await readNdjson(res, (line) => {
      if (line.heartbeat === true) {
        late.reject(new OllamaUnreachableError('down'))
      }
    })
    expect(lines.at(-1)).toEqual({
      error: 'ollama_unreachable',
      message: expect.any(String),
    })
  })

  it('aborts the upstream request when the client disconnects', async () => {
    let capturedSignal: AbortSignal | undefined
    const chatStream: ChatStream = async (
      _request,
      options: OllamaChatStreamOptions = {},
    ) => {
      capturedSignal = options.signal
      return {
        async *[Symbol.asyncIterator]() {
          yield delta('Hello')
          await new Promise<never>((_, reject) => {
            options.signal?.addEventListener('abort', () =>
              reject(new OllamaUnreachableError('aborted')),
            )
          })
        },
      }
    }
    const app = appWith(chatStream)

    const res = await app.request('/translate', {
      method: 'POST',
      headers: jsonHeaders,
      body: jaToEn,
    })

    const body = res.body
    if (body === null) {
      throw new Error('response has no body')
    }
    const reader = body.getReader()
    await reader.read()
    await reader.cancel()
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(capturedSignal?.aborted).toBe(true)
  })
})
