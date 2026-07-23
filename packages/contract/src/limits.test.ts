import { describe, expect, it } from 'vitest'
import {
  estimateTokens,
  MAX_CONTEXT_TOKENS,
  MAX_INPUT_TOKENS,
  RESERVED_OUTPUT_TOKENS,
} from './limits.js'

describe('limits', () => {
  it('reserves output tokens out of the context window', () => {
    expect(MAX_CONTEXT_TOKENS).toBe(32768)
    expect(RESERVED_OUTPUT_TOKENS).toBe(4096)
    expect(MAX_INPUT_TOKENS).toBe(28672)
  })
})

describe('estimateTokens', () => {
  it('returns 0 for an empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('estimates roughly three characters per token', () => {
    expect(estimateTokens('abcdef')).toBe(2)
  })

  it('rounds up partial tokens', () => {
    expect(estimateTokens('abcd')).toBe(2)
  })
})
