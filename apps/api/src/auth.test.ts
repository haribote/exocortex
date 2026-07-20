import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'

const app = createApp({ apiToken: 'secret' })

const UNAUTHORIZED_BODY = {
  error: 'unauthorized',
  message: 'invalid or missing bearer token',
}

describe('GET /health', () => {
  it('does not require authentication', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})

describe('bearer auth', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await app.request('/review', { method: 'POST' })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual(UNAUTHORIZED_BODY)
  })

  it('rejects a request with the wrong token', async () => {
    const res = await app.request('/review', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong' },
    })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual(UNAUTHORIZED_BODY)
  })

  it('rejects a request with a malformed Authorization header', async () => {
    const res = await app.request('/review', {
      method: 'POST',
      headers: { Authorization: 'Bearer' },
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(UNAUTHORIZED_BODY)
  })

  it('does not return 401 when the token matches', async () => {
    const res = await app.request('/review', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    expect(res.status).not.toBe(401)
  })
})
