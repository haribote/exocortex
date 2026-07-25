import { describe, expect, it } from 'vitest'
import {
  estimateTokens,
  MAX_CONTEXT_TOKENS,
  MAX_INPUT_TOKENS,
  RESERVED_OUTPUT_TOKENS,
} from './limits.js'

describe('limits', () => {
  // The reserve is retuned whenever the measured thinking overhead moves, so
  // what is pinned is the relationship rather than the number: the reserve
  // comes out of the same window the input has to fit in.
  it('reserves output tokens out of the context window', () => {
    expect(MAX_CONTEXT_TOKENS).toBe(32768)
    expect(RESERVED_OUTPUT_TOKENS).toBeGreaterThan(0)
    expect(RESERVED_OUTPUT_TOKENS).toBeLessThan(MAX_CONTEXT_TOKENS)
    expect(MAX_INPUT_TOKENS).toBe(MAX_CONTEXT_TOKENS - RESERVED_OUTPUT_TOKENS)
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
