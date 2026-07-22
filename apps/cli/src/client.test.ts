import type { ReviewRequest, TranslateRequest } from '@exocortex/contract'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestReview, requestTranslate } from './client.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

const baseRequest: ReviewRequest = {
  language: 'typescript',
  diff: 'd',
  rules: [],
  context: {
    files: [
      { path: 'big.ts', content: 'x' },
      { path: 'small.ts', content: 'y' },
    ],
  },
}

const okBody = {
  summary: 's',
  comments: [],
  meta: { model: 'm', inputTokens: 1, durationMs: 1 },
}

describe('requestReview', () => {
  it('sends the bearer token', async () => {
    let headers: Headers | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init: RequestInit) => {
        headers = new Headers(init.headers)
        return new Response(JSON.stringify(okBody))
      }),
    )

    await requestReview({
      endpoint: 'http://host:11435',
      token: 'secret',
      request: baseRequest,
    })
    expect(headers?.get('Authorization')).toBe('Bearer secret')
  })

  it('drops the largest context file and retries on 413', async () => {
    const sentFiles: string[][] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as ReviewRequest
        sentFiles.push(body.context.files.map((f) => f.path))

        if (sentFiles.length === 1) {
          return new Response(
            JSON.stringify({
              error: 'context_too_large',
              message: 'too big',
              contextFiles: [{ path: 'big.ts', estimatedTokens: 99 }],
            }),
            { status: 413 },
          )
        }
        return new Response(JSON.stringify(okBody))
      }),
    )

    const result = await requestReview({
      endpoint: 'http://host:11435',
      token: 't',
      request: baseRequest,
    })

    expect(sentFiles[0]).toEqual(['big.ts', 'small.ts'])
    expect(sentFiles[1]).toEqual(['small.ts'])
    expect(result.summary).toBe('s')
  })

  it('gives up after repeated 413 responses with an empty contextFiles list, without spinning forever', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: 'context_too_large',
            message: 'too big',
            contextFiles: [],
          }),
          { status: 413 },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      requestReview({
        endpoint: 'http://host:11435',
        token: 't',
        request: baseRequest,
      }),
    ).rejects.toThrow(/context/)

    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(6)
  })

  it('does not loop forever when the server keeps returning 413 and files remain to drop', async () => {
    const manyFiles = Array.from({ length: 10 }, (_, i) => ({
      path: `f${i}.ts`,
      content: 'x',
    }))
    const manyFileRequest: ReviewRequest = {
      ...baseRequest,
      context: { files: manyFiles },
    }

    const fetchMock = vi.fn(async (_url, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as ReviewRequest
      const largest = body.context.files[0]
      return new Response(
        JSON.stringify({
          error: 'context_too_large',
          message: 'too big',
          contextFiles: largest
            ? [{ path: largest.path, estimatedTokens: 99 }]
            : [],
        }),
        { status: 413 },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      requestReview({
        endpoint: 'http://host:11435',
        token: 't',
        request: manyFileRequest,
      }),
    ).rejects.toThrow(/context/)

    expect(fetchMock).toHaveBeenCalledTimes(6)
  })

  it('throws a helpful error on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: 'unauthorized', message: 'bad token' }),
            { status: 401 },
          ),
      ),
    )

    await expect(
      requestReview({
        endpoint: 'http://host:11435',
        token: 'wrong',
        request: baseRequest,
      }),
    ).rejects.toThrow(/token/i)
  })

  it('throws a helpful error on 502 that points at ollama, not the windows machine', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: 'ollama_error',
              message: 'ollama returned 500',
            }),
            { status: 502 },
          ),
      ),
    )

    await expect(
      requestReview({
        endpoint: 'http://host:11435',
        token: 't',
        request: baseRequest,
      }),
    ).rejects.toThrow(/ollama/i)
  })

  it('throws a helpful error on 503 that asks whether the windows machine is running', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: 'ollama_unreachable',
              message: 'could not reach ollama',
            }),
            { status: 503 },
          ),
      ),
    )

    await expect(
      requestReview({
        endpoint: 'http://host:11435',
        token: 't',
        request: baseRequest,
      }),
    ).rejects.toThrow(/windows/i)
  })

  it('throws a helpful error on 504 that suggests retrying', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: 'inference_timeout',
              message: 'timed out',
            }),
            { status: 504 },
          ),
      ),
    )

    await expect(
      requestReview({
        endpoint: 'http://host:11435',
        token: 't',
        request: baseRequest,
      }),
    ).rejects.toThrow(/retry/i)
  })

  it('throws an auth-specific error on 400 from a malformed Authorization header', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: 'unauthorized',
              message: 'invalid or missing bearer token',
            }),
            { status: 400 },
          ),
      ),
    )

    await expect(
      requestReview({
        endpoint: 'http://host:11435',
        token: 't',
        request: baseRequest,
      }),
    ).rejects.toThrow(/token/i)
  })

  it('throws a generic error with the server message on 400 from an invalid payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: 'invalid_request',
              message: 'diff must not be empty',
            }),
            { status: 400 },
          ),
      ),
    )

    await expect(
      requestReview({
        endpoint: 'http://host:11435',
        token: 't',
        request: baseRequest,
      }),
    ).rejects.toThrow(/diff must not be empty/)
  })

  it('throws a generic error carrying the status and message for a status the table does not cover', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: 'internal',
              message: 'unexpected failure',
            }),
            { status: 500 },
          ),
      ),
    )

    await expect(
      requestReview({
        endpoint: 'http://host:11435',
        token: 't',
        request: baseRequest,
      }),
    ).rejects.toThrow(/500/)
  })

  it('throws a distinguishable error when a 200 body does not match the review contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ summary: 's', comments: [] })),
      ),
    )

    await expect(
      requestReview({
        endpoint: 'http://host:11435',
        token: 't',
        request: baseRequest,
      }),
    ).rejects.toThrow(/contract/i)
  })

  it('throws a distinguishable error when an error body does not match the error contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: 'no error field' }), {
            status: 500,
          }),
      ),
    )

    await expect(
      requestReview({
        endpoint: 'http://host:11435',
        token: 't',
        request: baseRequest,
      }),
    ).rejects.toThrow(/contract/i)
  })

  it('gives an actionable, endpoint-naming message when fetch itself rejects', async () => {
    const dnsFailure = new Error('getaddrinfo ENOTFOUND host')
    const fetchMock = vi.fn(async () => {
      throw dnsFailure
    })
    vi.stubGlobal('fetch', fetchMock)

    const failure = requestReview({
      endpoint: 'http://host:11435',
      token: 't',
      request: baseRequest,
    })

    await expect(failure).rejects.toThrow(/http:\/\/host:11435/)
    await failure.catch((error: unknown) => {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).cause).toBe(dnsFailure)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('requestTranslate', () => {
  const translateRequest: TranslateRequest = {
    text: 'こんにちは',
    from: 'ja',
    to: 'en',
  }

  function callTranslate() {
    return requestTranslate({
      endpoint: 'http://host:11435',
      token: 'secret',
      request: translateRequest,
    })
  }

  it('posts the request to /translate with the bearer token', async () => {
    let url: string | undefined
    let headers: Headers | undefined
    let body: unknown
    vi.stubGlobal(
      'fetch',
      vi.fn(async (requested: string, init: RequestInit) => {
        url = requested
        headers = new Headers(init.headers)
        body = JSON.parse(String(init.body))
        return new Response(JSON.stringify({ text: 'Hello' }))
      }),
    )

    const response = await callTranslate()

    expect(url).toBe('http://host:11435/translate')
    expect(headers?.get('Authorization')).toBe('Bearer secret')
    expect(body).toEqual(translateRequest)
    expect(response.text).toBe('Hello')
  })

  it('rejects a response that does not match the translate contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ text: 42 }))),
    )

    await expect(callTranslate()).rejects.toThrow(/translate contract/)
  })

  it('reports an unreachable endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )

    await expect(callTranslate()).rejects.toThrow(/could not reach/)
  })

  it('reports a failed authentication on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: 'unauthorized', message: 'nope' }),
            { status: 401 },
          ),
      ),
    )

    await expect(callTranslate()).rejects.toThrow(/authentication failed/)
  })

  it('reports an ollama error on 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: 'ollama_error', message: 'boom' }),
            { status: 502 },
          ),
      ),
    )

    await expect(callTranslate()).rejects.toThrow(/ollama returned an error/)
  })

  it('reports an unreachable ollama on 503', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: 'ollama_unreachable', message: 'down' }),
            { status: 503 },
          ),
      ),
    )

    await expect(callTranslate()).rejects.toThrow(/could not reach ollama/)
  })

  it('reports a timeout on 504', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: 'inference_timeout', message: 'slow' }),
            { status: 504 },
          ),
      ),
    )

    await expect(callTranslate()).rejects.toThrow(/timed out/)
  })

  it('reports an invalid request on 400', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: 'invalid_request', message: 'bad' }),
            { status: 400 },
          ),
      ),
    )

    await expect(callTranslate()).rejects.toThrow(/400/)
  })
})
