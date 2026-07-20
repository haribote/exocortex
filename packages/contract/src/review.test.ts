import { describe, expect, it } from 'vitest'
import {
  reviewRequestSchema,
  reviewResultJsonSchema,
  reviewResultSchema,
} from './review.js'

describe('reviewRequestSchema', () => {
  it('accepts a minimal request and fills defaults', () => {
    const parsed = reviewRequestSchema.parse({
      language: 'typescript',
      diff: 'diff --git a/a.ts b/a.ts',
    })
    expect(parsed.rules).toEqual([])
    expect(parsed.context.files).toEqual([])
  })

  it('rejects an empty diff', () => {
    expect(() =>
      reviewRequestSchema.parse({ language: 'typescript', diff: '' }),
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
      comments: [{ severity: 'major', file: 'a.ts', line: 1, message: 'm' }],
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
