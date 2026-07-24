import { translateRequestSchema } from '@exocortex/contract'
import type { Hono } from 'hono'
import { stream } from 'hono/streaming'
import {
  OllamaAbortedError,
  type OllamaChatChunk,
  type OllamaClient,
  OllamaResponseError,
  OllamaTimeoutError,
  OllamaUnreachableError,
} from '../ollama.js'
import { buildTranslatePrompt } from './prompt.js'
import { createDeltaTrimmer } from './trim.js'

type StreamingApi = Parameters<Parameters<typeof stream>[1]>[0]

export interface TranslateDeps {
  ollama: Pick<OllamaClient, 'chatStream'>
  model: string
  heartbeatMs?: number
  headersGraceMs?: number
}

const DEFAULT_HEARTBEAT_MS = 5000
const DEFAULT_HEADERS_GRACE_MS = 3000

interface ErrorMapping {
  status: 502 | 503 | 504
  error: string
  message: string
}

export function registerTranslateRoute(app: Hono, deps: TranslateDeps): void {
  const heartbeatMs = deps.heartbeatMs ?? DEFAULT_HEARTBEAT_MS
  const headersGraceMs = deps.headersGraceMs ?? DEFAULT_HEADERS_GRACE_MS

  app.post('/translate', async (c) => {
    const parsed = translateRequestSchema.safeParse(
      await c.req.json().catch(() => null),
    )
    if (!parsed.success) {
      return c.json(
        { error: 'invalid_request', message: parsed.error.message },
        400,
      )
    }

    const controller = new AbortController()
    const pending = deps.ollama.chatStream(
      { model: deps.model, prompt: buildTranslatePrompt(parsed.data) },
      { signal: controller.signal },
    )

    const settled = await raceSettle(pending, headersGraceMs)
    if (settled.kind === 'rejected') {
      const mapping = toErrorMapping(settled.error)
      return c.json(
        { error: mapping.error, message: mapping.message },
        mapping.status,
      )
    }

    c.header('Content-Type', 'application/x-ndjson')
    return stream(
      c,
      async (s) => {
        s.onAbort(() => controller.abort())
        try {
          await pump(pending, s, deps.model, heartbeatMs)
        } catch (cause) {
          if (s.aborted || cause instanceof OllamaAbortedError) {
            return
          }
          await writeErrorLine(s, cause)
        }
      },
      async (cause, s) => {
        await writeErrorLine(s, cause)
      },
    )
  })
}

async function pump(
  pending: Promise<AsyncIterable<OllamaChatChunk>>,
  s: StreamingApi,
  model: string,
  heartbeatMs: number,
): Promise<void> {
  const trimmer = createDeltaTrimmer()
  let firstDeltaEmitted = false

  const heartbeatUntil = async <T>(promise: Promise<T>): Promise<T> => {
    const settled = promise.then((value) => ({ value }))
    for (;;) {
      if (firstDeltaEmitted) {
        return (await settled).value
      }
      let timer: ReturnType<typeof setTimeout> | undefined
      const tick = new Promise<'tick'>((resolve) => {
        timer = setTimeout(() => resolve('tick'), heartbeatMs)
      })
      try {
        const winner = await Promise.race([settled, tick])
        if (winner !== 'tick') {
          return winner.value
        }
      } finally {
        if (timer !== undefined) {
          clearTimeout(timer)
        }
      }
      await s.writeln('{"heartbeat":true}')
    }
  }

  const iterable = await heartbeatUntil(pending)
  const iterator = iterable[Symbol.asyncIterator]()
  let next = iterator.next()

  for (;;) {
    if (s.aborted) {
      return
    }
    const result = await heartbeatUntil(next)
    if (result.done) {
      throw new OllamaUnreachableError('ollama stream ended before completion')
    }

    const chunk = result.value
    if (chunk.done) {
      await s.writeln(
        JSON.stringify({
          done: true,
          meta: { model, durationMs: chunk.totalDurationMs ?? 0 },
        }),
      )
      return
    }

    const text = trimmer.push(chunk.content)
    if (text !== '') {
      firstDeltaEmitted = true
      await s.writeln(JSON.stringify({ delta: text }))
    }
    next = iterator.next()
  }
}

async function writeErrorLine(s: StreamingApi, cause: unknown): Promise<void> {
  const mapping = toErrorMapping(cause)
  await s.writeln(
    JSON.stringify({ error: mapping.error, message: mapping.message }),
  )
}

function toErrorMapping(cause: unknown): ErrorMapping {
  if (cause instanceof OllamaTimeoutError) {
    return {
      status: 504,
      error: 'inference_timeout',
      message: 'ollama did not respond in time',
    }
  }
  if (cause instanceof OllamaUnreachableError) {
    return {
      status: 503,
      error: 'ollama_unreachable',
      message: 'could not reach ollama',
    }
  }
  if (cause instanceof OllamaResponseError) {
    return { status: 502, error: 'ollama_error', message: cause.message }
  }
  return { status: 502, error: 'ollama_error', message: 'ollama failed' }
}

type Settled<T> =
  | { kind: 'fulfilled'; value: T }
  | { kind: 'rejected'; error: unknown }
  | { kind: 'pending' }

function raceSettle<T>(promise: Promise<T>, ms: number): Promise<Settled<T>> {
  return new Promise((resolve) => {
    let done = false
    const timer = setTimeout(() => {
      if (!done) {
        done = true
        resolve({ kind: 'pending' })
      }
    }, ms)
    promise.then(
      (value) => {
        if (!done) {
          done = true
          clearTimeout(timer)
          resolve({ kind: 'fulfilled', value })
        }
      },
      (error) => {
        if (!done) {
          done = true
          clearTimeout(timer)
          resolve({ kind: 'rejected', error })
        }
      },
    )
  })
}
