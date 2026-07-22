import { afterEach, describe, expect, it } from 'vitest'
import { readEnv } from './env.js'

const original = { ...process.env }

afterEach(() => {
  process.env = { ...original }
})

describe('readEnv', () => {
  it('reads the endpoint and the token', () => {
    process.env.EXOCORTEX_ENDPOINT = 'http://windows:11435'
    process.env.EXOCORTEX_TOKEN = 'secret'

    expect(readEnv()).toEqual({
      endpoint: 'http://windows:11435',
      token: 'secret',
    })
  })

  it('throws when the endpoint is missing', () => {
    process.env.EXOCORTEX_ENDPOINT = undefined
    process.env.EXOCORTEX_TOKEN = 'secret'

    expect(() => readEnv()).toThrow(/EXOCORTEX_ENDPOINT/)
  })

  it('throws when the token is missing', () => {
    process.env.EXOCORTEX_ENDPOINT = 'http://windows:11435'
    process.env.EXOCORTEX_TOKEN = undefined

    expect(() => readEnv()).toThrow(/EXOCORTEX_TOKEN/)
  })

  it('treats an empty value as missing', () => {
    process.env.EXOCORTEX_ENDPOINT = ''
    process.env.EXOCORTEX_TOKEN = 'secret'

    expect(() => readEnv()).toThrow()
  })
})
