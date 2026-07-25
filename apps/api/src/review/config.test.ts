import { describe, expect, it } from 'vitest'
import {
  loadReviewConfig,
  parseReviewDebugRaw,
  parseReviewSystemMode,
  parseReviewThink,
  parseReviewThinkPrefix,
  ReviewConfigError,
} from './config.js'

describe('parseReviewSystemMode', () => {
  it('treats unset and empty as the baseline configuration', () => {
    expect(parseReviewSystemMode(undefined)).toBe('none')
    expect(parseReviewSystemMode('')).toBe('none')
    expect(parseReviewSystemMode('   ')).toBe('none')
  })

  it('accepts the two modes regardless of case and surrounding space', () => {
    expect(parseReviewSystemMode('none')).toBe('none')
    expect(parseReviewSystemMode('prefix')).toBe('prefix')
    expect(parseReviewSystemMode('  PREFIX  ')).toBe('prefix')
  })

  // A typo used to fall through to 'none', so the run recorded baseline numbers
  // under a prefix label. Refusing to start is the only safe reading.
  it('refuses a value it does not recognise instead of falling back', () => {
    expect(() => parseReviewSystemMode('prefx')).toThrow(ReviewConfigError)
    expect(() => parseReviewSystemMode('system')).toThrow(ReviewConfigError)
  })

  it('names the offending variable and value in the error', () => {
    expect(() => parseReviewSystemMode('prefx')).toThrow(
      /REVIEW_SYSTEM_MODE.*prefx/s,
    )
  })
})

describe('parseReviewThink', () => {
  it('leaves think unset when the variable is unset or empty', () => {
    expect(parseReviewThink(undefined)).toBeUndefined()
    expect(parseReviewThink('')).toBeUndefined()
    expect(parseReviewThink('   ')).toBeUndefined()
  })

  it('reads "true" and "false" as booleans', () => {
    expect(parseReviewThink('true')).toBe(true)
    expect(parseReviewThink(' false ')).toBe(false)
  })

  // Ollama 0.32.1 docs/api.md: think "can be a boolean or a thinking level
  // ("low", "medium", "high", or "max")".
  it('accepts every thinking level ollama documents', () => {
    expect(parseReviewThink('low')).toBe('low')
    expect(parseReviewThink('medium')).toBe('medium')
    expect(parseReviewThink('high')).toBe('high')
    expect(parseReviewThink('max')).toBe('max')
  })

  it('refuses a level ollama does not define', () => {
    expect(() => parseReviewThink('higher')).toThrow(ReviewConfigError)
    expect(() => parseReviewThink('yes')).toThrow(ReviewConfigError)
    expect(() => parseReviewThink('1')).toThrow(ReviewConfigError)
  })
})

describe('parseReviewThinkPrefix', () => {
  it('treats unset and empty as no prefix', () => {
    expect(parseReviewThinkPrefix(undefined)).toBeUndefined()
    expect(parseReviewThinkPrefix('')).toBeUndefined()
  })

  // The prefix is prepended verbatim, so its trailing newline is significant.
  it('keeps surrounding whitespace, which is part of the prefix', () => {
    expect(parseReviewThinkPrefix('Reasoning: high\n')).toBe(
      'Reasoning: high\n',
    )
  })
})

describe('parseReviewDebugRaw', () => {
  it('is off when unset or empty', () => {
    expect(parseReviewDebugRaw(undefined)).toBe(false)
    expect(parseReviewDebugRaw('')).toBe(false)
  })

  it('accepts the documented on and off spellings', () => {
    expect(parseReviewDebugRaw('1')).toBe(true)
    expect(parseReviewDebugRaw('true')).toBe(true)
    expect(parseReviewDebugRaw('0')).toBe(false)
    expect(parseReviewDebugRaw('false')).toBe(false)
  })

  it('refuses anything else rather than silently staying off', () => {
    expect(() => parseReviewDebugRaw('yes')).toThrow(ReviewConfigError)
  })
})

describe('loadReviewConfig', () => {
  it('returns the baseline configuration for an empty environment', () => {
    expect(loadReviewConfig({})).toEqual({
      systemMode: 'none',
      thinkPrefix: undefined,
      think: undefined,
      debugRaw: false,
    })
  })

  it('returns the baseline configuration when compose passes empty strings', () => {
    expect(
      loadReviewConfig({
        REVIEW_SYSTEM_MODE: '',
        REVIEW_THINK_PREFIX: '',
        REVIEW_THINK: '',
        REVIEW_DEBUG_RAW: '',
      }),
    ).toEqual({
      systemMode: 'none',
      thinkPrefix: undefined,
      think: undefined,
      debugRaw: false,
    })
  })

  it('assembles a fully configured prefix run', () => {
    expect(
      loadReviewConfig({
        REVIEW_SYSTEM_MODE: 'prefix',
        REVIEW_THINK_PREFIX: 'Reasoning: high\n',
        REVIEW_THINK: 'high',
        REVIEW_DEBUG_RAW: '1',
      }),
    ).toEqual({
      systemMode: 'prefix',
      thinkPrefix: 'Reasoning: high\n',
      think: 'high',
      debugRaw: true,
    })
  })

  // A think prefix only reaches the model through the system message, so this
  // combination silently discards the prefix the operator asked for.
  it('refuses a think prefix that no system message would carry', () => {
    expect(() =>
      loadReviewConfig({ REVIEW_THINK_PREFIX: 'Reasoning: high\n' }),
    ).toThrow(ReviewConfigError)
    expect(() =>
      loadReviewConfig({
        REVIEW_SYSTEM_MODE: 'none',
        REVIEW_THINK_PREFIX: 'Reasoning: high\n',
      }),
    ).toThrow(/REVIEW_THINK_PREFIX.*REVIEW_SYSTEM_MODE/s)
  })

  it('allows a prefix once the system message exists to carry it', () => {
    expect(
      loadReviewConfig({
        REVIEW_SYSTEM_MODE: 'prefix',
        REVIEW_THINK_PREFIX: 'Reasoning: high\n',
      }).thinkPrefix,
    ).toBe('Reasoning: high\n')
  })
})
