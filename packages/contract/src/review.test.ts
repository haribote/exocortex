import { describe, expect, it } from 'vitest'
import {
  reviewCommentSchema,
  reviewMetaSchema,
  reviewRequestSchema,
  reviewResultJsonSchema,
  reviewResultSchema,
} from './review.js'

describe('reviewRequestSchema', () => {
  it('accepts a minimal request and fills defaults', () => {
    const parsed = reviewRequestSchema.parse({ language: 'typescript' })
    expect(parsed.rules).toEqual([])
    expect(parsed.base).toBeUndefined()
    expect(parsed.staged).toBeUndefined()
  })

  it('carries the base ref and staged flag when given', () => {
    const parsed = reviewRequestSchema.parse({
      language: 'typescript',
      base: 'main',
    })
    expect(parsed.base).toBe('main')
  })

  it('rejects base and staged given together', () => {
    expect(() =>
      reviewRequestSchema.parse({
        language: 'typescript',
        base: 'main',
        staged: true,
      }),
    ).toThrow()
  })
})

describe('reviewResultSchema', () => {
  it('rejects a severity outside the enum', () => {
    const result = {
      summary: 's',
      comments: [{ severity: 'Major', file: 'a.ts', line: 1, message: 'm' }],
    }
    expect(() => reviewResultSchema.parse(result)).toThrow()
  })

  it('accepts lowercase severities', () => {
    const result = {
      summary: 's',
      comments: [
        { severity: 'major', file: 'a.ts', line: 1, quote: 'q', message: 'm' },
      ],
    }
    expect(reviewResultSchema.parse(result).comments[0]?.severity).toBe('major')
  })
})

describe('reviewResultJsonSchema', () => {
  it('is a JSON Schema object describing summary and comments', () => {
    expect(reviewResultJsonSchema).toMatchObject({
      type: 'object',
      properties: { summary: { type: 'string' }, comments: { type: 'array' } },
    })
  })
})

describe('reviewCommentSchema', () => {
  it('requires a verbatim quote of the offending code', () => {
    const withoutQuote = {
      severity: 'major',
      file: 'a.ts',
      line: 1,
      message: 'm',
    }
    expect(() => reviewCommentSchema.parse(withoutQuote)).toThrow()
    expect(
      reviewCommentSchema.parse({ ...withoutQuote, quote: 'const a = 1' })
        .quote,
    ).toBe('const a = 1')
  })
})

describe('reviewMetaSchema', () => {
  it('reports how many comments and context files were dropped', () => {
    const meta = { model: 'm', inputTokens: 1, durationMs: 1 }
    expect(() => reviewMetaSchema.parse(meta)).toThrow()
    const parsed = reviewMetaSchema.parse({
      ...meta,
      droppedComments: 3,
      droppedContextFiles: 2,
    })
    expect(parsed.droppedComments).toBe(3)
    expect(parsed.droppedContextFiles).toBe(2)
  })
})

describe('reviewResultJsonSchema', () => {
  it('makes the model produce a quote for every comment', () => {
    const comment = reviewResultJsonSchema.properties.comments.items
    expect(comment.properties).toHaveProperty('quote')
    expect(comment.required).toContain('quote')
  })
})
