import { describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import type {
  OllamaChatRequest,
  OllamaChatResult,
  OllamaClient,
} from '../ollama.js'
import { OllamaResponseError, OllamaUnreachableError } from '../ollama.js'

function fakeOllama(
  result: OllamaChatResult,
  capture?: (r: OllamaChatRequest) => void,
): OllamaClient {
  return {
    async chat(request) {
      capture?.(request)
      return result
    },
  }
}

function appWith(ollama: OllamaClient) {
  return createApp({
    apiToken: 'secret',
    ollama,
    reviewModel: 'qwen2.5-coder:14b',
  })
}

const auth = {
  Authorization: 'Bearer secret',
  'Content-Type': 'application/json',
}

const validResult = JSON.stringify({
  summary: 'looks risky',
  comments: [
    {
      severity: 'major',
      file: 'a.ts',
      line: 3,
      message: 'unchecked index access',
    },
  ],
})

describe('POST /review', () => {
  it('returns the parsed review with meta', async () => {
    const app = appWith(
      fakeOllama({ content: validResult, totalDurationMs: 1234 }),
    )
    const res = await app.request('/review', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        language: 'typescript',
        diff: 'diff --git a/a.ts b/a.ts',
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary).toBe('looks risky')
    expect(body.comments[0].severity).toBe('major')
    expect(body.meta.model).toBe('qwen2.5-coder:14b')
    expect(body.meta.durationMs).toBe(1234)
  })

  it('passes the json schema to ollama as format', async () => {
    let captured: OllamaChatRequest | undefined
    const app = appWith(
      fakeOllama({ content: validResult, totalDurationMs: 0 }, (r) => {
        captured = r
      }),
    )
    await app.request('/review', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ language: 'typescript', diff: 'd' }),
    })

    expect(captured?.format).toMatchObject({ type: 'object' })
    expect(captured?.temperature).toBe(0)
  })

  it('returns 400 for an invalid request body', async () => {
    const app = appWith(
      fakeOllama({ content: validResult, totalDurationMs: 0 }),
    )
    const res = await app.request('/review', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ language: 'typescript' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 413 with the ranked context files when the context is too large', async () => {
    const app = appWith(
      fakeOllama({ content: validResult, totalDurationMs: 0 }),
    )
    const res = await app.request('/review', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        language: 'typescript',
        diff: 'd',
        context: { files: [{ path: 'big.ts', content: 'x'.repeat(200_000) }] },
      }),
    })

    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.error).toBe('context_too_large')
    expect(body.contextFiles[0].path).toBe('big.ts')
  })

  it('returns 503 when ollama is unreachable', async () => {
    const app = appWith({
      async chat() {
        throw new OllamaUnreachableError('down')
      },
    })
    const res = await app.request('/review', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ language: 'typescript', diff: 'd' }),
    })
    expect(res.status).toBe(503)
  })

  it('returns 502 when ollama returns an error response', async () => {
    const app = appWith({
      async chat() {
        throw new OllamaResponseError('ollama returned 500', 500)
      },
    })
    const res = await app.request('/review', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ language: 'typescript', diff: 'd' }),
    })
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe('ollama_error')
  })

  it('returns 502 when ollama returns output that violates the schema', async () => {
    const app = appWith(
      fakeOllama({ content: '{"summary": 1}', totalDurationMs: 0 }),
    )
    const res = await app.request('/review', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ language: 'typescript', diff: 'd' }),
    })
    expect(res.status).toBe(502)
  })
})
