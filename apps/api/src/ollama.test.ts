import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createOllamaClient,
  OllamaAbortedError,
  type OllamaChatChunk,
  OllamaResponseError,
  OllamaStreamError,
  OllamaTimeoutError,
  OllamaUnreachableError,
} from './ollama.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch(impl: typeof fetch) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

const encoder = new TextEncoder()

function streamResponse(
  parts: (string | Uint8Array)[],
  options: { stall?: AbortSignal | null; init?: ResponseInit } = {},
) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(
          typeof part === 'string' ? encoder.encode(part) : part,
        )
      }
      if (options.stall === undefined) {
        controller.close()
        return
      }
      options.stall?.addEventListener('abort', () => {
        controller.error(new DOMException('aborted', 'AbortError'))
      })
    },
  })
  return new Response(body, options.init)
}

function chatLine(content: string) {
  return `${JSON.stringify({ message: { role: 'assistant', content }, done: false })}\n`
}

function doneLine(totalDuration: number) {
  return `${JSON.stringify({
    message: { role: 'assistant', content: '' },
    done: true,
    done_reason: 'stop',
    total_duration: totalDuration,
  })}\n`
}

async function collect(
  iterable: AsyncIterable<OllamaChatChunk>,
): Promise<OllamaChatChunk[]> {
  const chunks: OllamaChatChunk[] = []
  for await (const chunk of iterable) {
    chunks.push(chunk)
  }
  return chunks
}

describe('createOllamaClient', () => {
  it('posts a single user message to /api/chat', async () => {
    let captured: unknown
    stubFetch(async (_url, init) => {
      captured = JSON.parse(String((init as RequestInit).body))
      return new Response(
        JSON.stringify({
          message: { content: 'hi' },
          total_duration: 2_000_000,
        }),
      )
    })

    const client = createOllamaClient('http://ollama:11434')
    const result = await client.chat({
      model: 'm',
      prompt: 'hello',
      temperature: 0,
    })

    expect(captured).toMatchObject({
      model: 'm',
      stream: false,
      messages: [{ role: 'user', content: 'hello' }],
      options: { temperature: 0 },
    })
    expect(result.content).toBe('hi')
  })

  it('passes the json schema through as format', async () => {
    let captured: { format?: unknown } = {}
    stubFetch(async (_url, init) => {
      captured = JSON.parse(String((init as RequestInit).body))
      return new Response(
        JSON.stringify({ message: { content: '{}' }, total_duration: 0 }),
      )
    })

    const client = createOllamaClient('http://ollama:11434')
    await client.chat({ model: 'm', prompt: 'p', format: { type: 'object' } })

    expect(captured.format).toEqual({ type: 'object' })
  })

  it('converts total_duration from nanoseconds to milliseconds', async () => {
    stubFetch(
      async () =>
        new Response(
          JSON.stringify({
            message: { content: 'x' },
            total_duration: 1_500_000_000,
          }),
        ),
    )

    const client = createOllamaClient('http://ollama:11434')
    const result = await client.chat({ model: 'm', prompt: 'p' })

    expect(result.totalDurationMs).toBe(1500)
  })

  it('throws OllamaUnreachableError when fetch rejects', async () => {
    stubFetch(async () => {
      throw new TypeError('fetch failed')
    })

    const client = createOllamaClient('http://ollama:11434')
    await expect(
      client.chat({ model: 'm', prompt: 'p' }),
    ).rejects.toBeInstanceOf(OllamaUnreachableError)
  })

  it('throws OllamaTimeoutError when fetch rejects with a TimeoutError', async () => {
    stubFetch(async () => {
      throw new DOMException('signal timed out', 'TimeoutError')
    })

    const client = createOllamaClient('http://ollama:11434')
    await expect(
      client.chat({ model: 'm', prompt: 'p' }),
    ).rejects.toBeInstanceOf(OllamaTimeoutError)
  })

  it('throws OllamaResponseError with the status when ollama returns a non-2xx response', async () => {
    stubFetch(
      async () =>
        new Response(JSON.stringify({ error: 'model not found' }), {
          status: 500,
        }),
    )

    const client = createOllamaClient('http://ollama:11434')
    const error = await client
      .chat({ model: 'm', prompt: 'p' })
      .catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(OllamaResponseError)
    expect((error as OllamaResponseError).status).toBe(500)
  })
})

describe('createOllamaClient chatStream', () => {
  it('asks ollama to stream', async () => {
    let captured: unknown
    stubFetch(async (_url, init) => {
      captured = JSON.parse(String((init as RequestInit).body))
      return streamResponse([chatLine('hi'), doneLine(0)])
    })

    const client = createOllamaClient('http://ollama:11434')
    await collect(await client.chatStream({ model: 'm', prompt: 'hello' }))

    expect(captured).toMatchObject({
      model: 'm',
      stream: true,
      messages: [{ role: 'user', content: 'hello' }],
    })
  })

  it('yields one chunk per ndjson line', async () => {
    stubFetch(async () =>
      streamResponse([chatLine('Hello'), chatLine(' world'), doneLine(0)]),
    )

    const client = createOllamaClient('http://ollama:11434')
    const chunks = await collect(
      await client.chatStream({ model: 'm', prompt: 'p' }),
    )

    expect(chunks.map((chunk) => chunk.content)).toEqual([
      'Hello',
      ' world',
      '',
    ])
    expect(chunks.at(-1)?.done).toBe(true)
  })

  it('reassembles a line split across two network chunks', async () => {
    const line = chatLine('Hello')
    stubFetch(async () =>
      streamResponse([line.slice(0, 12), line.slice(12), doneLine(0)]),
    )

    const client = createOllamaClient('http://ollama:11434')
    const chunks = await collect(
      await client.chatStream({ model: 'm', prompt: 'p' }),
    )

    expect(chunks[0]?.content).toBe('Hello')
  })

  it('decodes a multi-byte character split across two network chunks', async () => {
    const bytes = encoder.encode(chatLine('こんにちは'))
    const split = bytes.findIndex((byte) => (byte & 0xc0) === 0x80)
    expect(bytes[split]).toBeGreaterThan(0x7f)
    stubFetch(async () =>
      streamResponse([bytes.slice(0, split), bytes.slice(split), doneLine(0)]),
    )

    const client = createOllamaClient('http://ollama:11434')
    const chunks = await collect(
      await client.chatStream({ model: 'm', prompt: 'p' }),
    )

    expect(chunks[0]?.content).toBe('こんにちは')
  })

  it('yields a final line that has no trailing newline', async () => {
    stubFetch(async () =>
      streamResponse([chatLine('Hello'), doneLine(0).trimEnd()]),
    )

    const client = createOllamaClient('http://ollama:11434')
    const chunks = await collect(
      await client.chatStream({ model: 'm', prompt: 'p' }),
    )

    expect(chunks).toHaveLength(2)
    expect(chunks.at(-1)?.done).toBe(true)
  })

  it('converts total_duration from nanoseconds to milliseconds', async () => {
    stubFetch(async () =>
      streamResponse([chatLine('Hello'), doneLine(31_400_000_000)]),
    )

    const client = createOllamaClient('http://ollama:11434')
    const chunks = await collect(
      await client.chatStream({ model: 'm', prompt: 'p' }),
    )

    expect(chunks.at(-1)?.totalDurationMs).toBe(31_400)
  })

  it('rejects before iteration when fetch rejects', async () => {
    stubFetch(async () => {
      throw new TypeError('fetch failed')
    })

    const client = createOllamaClient('http://ollama:11434')
    await expect(
      client.chatStream({ model: 'm', prompt: 'p' }),
    ).rejects.toBeInstanceOf(OllamaUnreachableError)
  })

  it('rejects before iteration with the upstream text on a non-2xx response', async () => {
    stubFetch(
      async () =>
        new Response(JSON.stringify({ error: 'model "x" not found' }), {
          status: 404,
        }),
    )

    const client = createOllamaClient('http://ollama:11434')
    const error = await client
      .chatStream({ model: 'm', prompt: 'p' })
      .catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(OllamaResponseError)
    expect((error as OllamaResponseError).status).toBe(404)
    expect((error as OllamaResponseError).message).toContain('not found')
  })

  it('throws OllamaStreamError on an error line in the middle of the stream', async () => {
    stubFetch(async () =>
      streamResponse([
        chatLine('Hello'),
        `${JSON.stringify({ error: 'an existing connection was forcibly closed' })}\n`,
      ]),
    )

    const client = createOllamaClient('http://ollama:11434')
    const iterable = await client.chatStream({ model: 'm', prompt: 'p' })

    await expect(collect(iterable)).rejects.toBeInstanceOf(OllamaStreamError)
  })

  it('throws OllamaStreamError on a malformed line', async () => {
    stubFetch(async () => streamResponse([chatLine('Hello'), 'not json\n']))

    const client = createOllamaClient('http://ollama:11434')
    const iterable = await client.chatStream({ model: 'm', prompt: 'p' })

    await expect(collect(iterable)).rejects.toBeInstanceOf(OllamaStreamError)
  })

  it('throws OllamaStreamError when the stream ends without a done chunk', async () => {
    stubFetch(async () => streamResponse([chatLine('Hello')]))

    const client = createOllamaClient('http://ollama:11434')
    const iterable = await client.chatStream({ model: 'm', prompt: 'p' })

    await expect(collect(iterable)).rejects.toBeInstanceOf(OllamaStreamError)
  })

  it('throws OllamaStreamError when a line grows past the buffer limit', async () => {
    stubFetch(async () => streamResponse(['x'.repeat(2 * 1024 * 1024)]))

    const client = createOllamaClient('http://ollama:11434')
    const iterable = await client.chatStream({ model: 'm', prompt: 'p' })

    await expect(collect(iterable)).rejects.toBeInstanceOf(OllamaStreamError)
  })

  it('throws OllamaTimeoutError when no chunk arrives within the idle timeout', async () => {
    stubFetch(async (_url, init) =>
      streamResponse([chatLine('Hello')], {
        stall: (init as RequestInit).signal,
      }),
    )

    const client = createOllamaClient('http://ollama:11434', {
      idleTimeoutMs: 20,
    })
    const iterable = await client.chatStream({ model: 'm', prompt: 'p' })

    await expect(collect(iterable)).rejects.toBeInstanceOf(OllamaTimeoutError)
  })

  it('throws OllamaAbortedError when the caller aborts', async () => {
    stubFetch(async (_url, init) =>
      streamResponse([chatLine('Hello')], {
        stall: (init as RequestInit).signal,
      }),
    )

    const controller = new AbortController()
    const client = createOllamaClient('http://ollama:11434')
    const iterable = await client.chatStream(
      { model: 'm', prompt: 'p' },
      { signal: controller.signal },
    )

    const collected = collect(iterable)
    controller.abort()

    await expect(collected).rejects.toBeInstanceOf(OllamaAbortedError)
  })

  it('cancels the upstream body when the consumer stops early', async () => {
    let cancelled = false
    stubFetch(async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(chatLine('Hello')))
        },
        cancel() {
          cancelled = true
        },
      })
      return new Response(body)
    })

    const client = createOllamaClient('http://ollama:11434')
    const iterable = await client.chatStream({ model: 'm', prompt: 'p' })
    for await (const _chunk of iterable) {
      break
    }

    expect(cancelled).toBe(true)
  })
})
