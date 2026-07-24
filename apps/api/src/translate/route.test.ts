import { describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import type { OllamaChatRequest, OllamaClient } from '../ollama.js'
import {
  OllamaResponseError,
  OllamaTimeoutError,
  OllamaUnreachableError,
} from '../ollama.js'

function appWith(ollama: OllamaClient) {
  return createApp({
    ollama,
    reviewModel: 'review-model',
    translateModel: 'translategemma:12b',
  })
}

const jsonHeaders = {
  'Content-Type': 'application/json',
}

describe('POST /translate', () => {
  it('returns the translated text', async () => {
    const app = appWith({
      async chat() {
        return { content: 'Hello', totalDurationMs: 10 }
      },
    })
    const res = await app.request('/translate', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ text: 'こんにちは', from: 'ja', to: 'en' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: 'Hello' })
  })

  it('uses the translate model and no structured output', async () => {
    let captured: OllamaChatRequest | undefined
    const app = appWith({
      async chat(request) {
        captured = request
        return { content: 'Hello', totalDurationMs: 0 }
      },
    })
    await app.request('/translate', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ text: 'こんにちは', from: 'ja', to: 'en' }),
    })

    expect(captured?.model).toBe('translategemma:12b')
    expect(captured?.format).toBeUndefined()
  })

  it('trims surrounding whitespace from the model output', async () => {
    const app = appWith({
      async chat() {
        return { content: '  Hello\n', totalDurationMs: 0 }
      },
    })
    const res = await app.request('/translate', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ text: 'こんにちは', from: 'ja', to: 'en' }),
    })
    expect(await res.json()).toEqual({ text: 'Hello' })
  })

  it('returns 400 for an unsupported language code', async () => {
    const app = appWith({
      async chat() {
        return { content: '', totalDurationMs: 0 }
      },
    })
    const res = await app.request('/translate', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ text: 'x', from: 'fr', to: 'en' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 504 when ollama times out', async () => {
    const app = appWith({
      async chat() {
        throw new OllamaTimeoutError('ollama request timed out')
      },
    })
    const res = await app.request('/translate', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ text: 'こんにちは', from: 'ja', to: 'en' }),
    })
    expect(res.status).toBe(504)
    const body = await res.json()
    expect(body.error).toBe('inference_timeout')
  })

  it('returns 503 when ollama is unreachable', async () => {
    const app = appWith({
      async chat() {
        throw new OllamaUnreachableError('down')
      },
    })
    const res = await app.request('/translate', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ text: 'こんにちは', from: 'ja', to: 'en' }),
    })
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe('ollama_unreachable')
  })

  it('returns 502 when ollama returns an error response', async () => {
    const app = appWith({
      async chat() {
        throw new OllamaResponseError('ollama returned 500', 500)
      },
    })
    const res = await app.request('/translate', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ text: 'こんにちは', from: 'ja', to: 'en' }),
    })
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe('ollama_error')
  })
})
