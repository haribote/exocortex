import { describe, expect, it } from 'vitest'
import { translateStreamChunkSchema } from './translate.js'

describe('translateStreamChunkSchema', () => {
  it('accepts a delta chunk', () => {
    expect(translateStreamChunkSchema.parse({ delta: 'Hello' })).toEqual({
      delta: 'Hello',
    })
  })

  it('accepts a heartbeat chunk', () => {
    expect(translateStreamChunkSchema.parse({ heartbeat: true })).toEqual({
      heartbeat: true,
    })
  })

  it('accepts a done chunk carrying the model and duration', () => {
    const chunk = {
      done: true,
      meta: { model: 'translategemma:12b', durationMs: 31400 },
    }
    expect(translateStreamChunkSchema.parse(chunk)).toEqual(chunk)
  })

  it('accepts an error chunk in the shape of an error response', () => {
    const chunk = { error: 'inference_timeout', message: 'too slow' }
    expect(translateStreamChunkSchema.parse(chunk)).toEqual(chunk)
  })

  it('rejects a done chunk without meta', () => {
    expect(() => translateStreamChunkSchema.parse({ done: true })).toThrow()
  })

  it('rejects a done chunk missing the model', () => {
    expect(() =>
      translateStreamChunkSchema.parse({
        done: true,
        meta: { durationMs: 1 },
      }),
    ).toThrow()
  })

  it('rejects a chunk of an unknown shape', () => {
    expect(() => translateStreamChunkSchema.parse({ text: 'Hello' })).toThrow()
  })

  it('rejects done set to false', () => {
    expect(() =>
      translateStreamChunkSchema.parse({
        done: false,
        meta: { model: 'm', durationMs: 1 },
      }),
    ).toThrow()
  })
})
