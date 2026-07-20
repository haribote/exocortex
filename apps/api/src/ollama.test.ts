import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOllamaClient, OllamaUnreachableError } from './ollama.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch(impl: typeof fetch) {
  vi.stubGlobal('fetch', vi.fn(impl))
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
})
