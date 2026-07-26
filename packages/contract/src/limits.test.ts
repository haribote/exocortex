import { describe, expect, it } from 'vitest'
import {
  estimateTokens,
  MAX_CONTEXT_TOKENS,
  MAX_INPUT_TOKENS,
  RESERVED_OUTPUT_TOKENS,
} from './limits.js'

describe('limits', () => {
  // What is pinned is the relationship rather than the numbers: the input cap
  // is fixed, and whatever the window has beyond it belongs to the output and
  // to the thinking that gets fed back alongside it.
  it('reserves the rest of the context window for output', () => {
    expect(MAX_CONTEXT_TOKENS).toBe(65536)
    expect(MAX_INPUT_TOKENS).toBe(20480)
    expect(RESERVED_OUTPUT_TOKENS).toBe(MAX_CONTEXT_TOKENS - MAX_INPUT_TOKENS)
  })

  // The measured worst case was 21411 thinking tokens on top of the input, and
  // the reserve has to swallow that spread plus the JSON the model still has to
  // write. A reserve that only covers p95 is what truncated reviews at 32768.
  it('leaves room for the worst measured thinking overhead', () => {
    expect(RESERVED_OUTPUT_TOKENS).toBeGreaterThan(21411)
  })
})

describe('estimateTokens', () => {
  it('returns 0 for an empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('estimates against the densest measured tokenizer', () => {
    expect(estimateTokens('a'.repeat(258))).toBe(100)
  })

  it('rounds up partial tokens', () => {
    expect(estimateTokens('abcd')).toBe(2)
  })

  // The estimate drives how much context gets packed, so erring low is what
  // overruns the window. gemma4:12b measured 2.58 chars per token.
  it('never estimates below the densest measured tokenizer', () => {
    const text = 'x'.repeat(10_000)
    expect(estimateTokens(text)).toBeGreaterThanOrEqual(text.length / 2.58)
  })
})
