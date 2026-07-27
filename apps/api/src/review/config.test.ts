import { describe, expect, it } from 'vitest'
import {
  loadReviewConfig,
  parseReviewContextDocs,
  parseReviewDebugRaw,
  parseReviewSystemMode,
  parseReviewThink,
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

describe('parseReviewContextDocs', () => {
  // The other boolean flags add behaviour and default off. This one removes
  // context the reviewer already gets, so an unset variable has to mean on.
  it('is on when unset or empty', () => {
    expect(parseReviewContextDocs(undefined)).toBe(true)
    expect(parseReviewContextDocs('')).toBe(true)
  })

  it('accepts the documented on and off spellings', () => {
    expect(parseReviewContextDocs('1')).toBe(true)
    expect(parseReviewContextDocs('true')).toBe(true)
    expect(parseReviewContextDocs('0')).toBe(false)
    expect(parseReviewContextDocs('false')).toBe(false)
  })

  // A typo silently leaving the docs in would make an a/b run compare two
  // identical configurations and report the difference as zero.
  it('refuses anything else rather than silently staying on', () => {
    expect(() => parseReviewContextDocs('off')).toThrow(ReviewConfigError)
    expect(() => parseReviewContextDocs('no')).toThrow(ReviewConfigError)
  })

  it('names the offending variable and value in the error', () => {
    expect(() => parseReviewContextDocs('off')).toThrow(
      /REVIEW_CONTEXT_DOCS.*off/s,
    )
  })
})

describe('loadReviewConfig', () => {
  it('returns the baseline configuration for an empty environment', () => {
    expect(loadReviewConfig({})).toEqual({
      systemMode: 'none',
      think: undefined,
      debugRaw: false,
      includeDocs: true,
    })
  })

  it('returns the baseline configuration when compose passes empty strings', () => {
    expect(
      loadReviewConfig({
        REVIEW_SYSTEM_MODE: '',
        REVIEW_THINK: '',
        REVIEW_DEBUG_RAW: '',
        REVIEW_CONTEXT_DOCS: '',
      }),
    ).toEqual({
      systemMode: 'none',
      think: undefined,
      debugRaw: false,
      includeDocs: true,
    })
  })

  it('assembles a fully configured prefix run', () => {
    expect(
      loadReviewConfig({
        REVIEW_SYSTEM_MODE: 'prefix',
        REVIEW_THINK: 'high',
        REVIEW_DEBUG_RAW: '1',
        REVIEW_CONTEXT_DOCS: '0',
      }),
    ).toEqual({
      systemMode: 'prefix',
      think: 'high',
      debugRaw: true,
      includeDocs: false,
    })
  })

  // REVIEW_THINK_PREFIX was measured to change nothing, so it was removed. A
  // stale one left in an operator's .env must not keep the api from starting.
  it('ignores a variable it no longer knows about', () => {
    expect(() =>
      loadReviewConfig({ REVIEW_THINK_PREFIX: '<|think|>' }),
    ).not.toThrow()
  })
})
