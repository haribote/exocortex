import { describe, expect, it } from 'vitest'
import {
  normalizeQuote,
  perFileDoneSchema,
  perFileErrorSchema,
  perFileResultSchema,
  reviewCommentSchema,
  reviewHeartbeatSchema,
  reviewMetaSchema,
  reviewRequestSchema,
  reviewResultJsonSchema,
  reviewResultSchema,
  reviewStreamLineSchema,
} from './review.js'

describe('reviewRequestSchema', () => {
  it('accepts a minimal request and fills defaults', () => {
    const parsed = reviewRequestSchema.parse({ language: 'typescript' })
    expect(parsed.rules).toEqual([])
    expect(parsed.base).toBeUndefined()
    expect(parsed.staged).toBeUndefined()
    expect(parsed.mode).toBe('whole')
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

  it('accepts mode per-file', () => {
    const parsed = reviewRequestSchema.parse({
      language: 'typescript',
      mode: 'per-file',
    })
    expect(parsed.mode).toBe('per-file')
  })

  it('rejects unknown mode values', () => {
    expect(() =>
      reviewRequestSchema.parse({
        language: 'typescript',
        mode: 'file',
      }),
    ).toThrow()
  })

  it('enforces base and staged exclusivity with per-file mode', () => {
    expect(() =>
      reviewRequestSchema.parse({
        language: 'typescript',
        base: 'main',
        staged: true,
        mode: 'per-file',
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

  const required = {
    model: 'm',
    inputTokens: 1,
    durationMs: 1,
    droppedComments: 0,
    droppedContextFiles: 0,
  }

  it('accepts meta without the token and load duration counters', () => {
    const parsed = reviewMetaSchema.parse(required)
    expect(parsed.promptEvalTokens).toBeUndefined()
    expect(parsed.outputTokens).toBeUndefined()
    expect(parsed.loadDurationMs).toBeUndefined()
  })

  it('carries the token and load duration counters when reported', () => {
    const parsed = reviewMetaSchema.parse({
      ...required,
      promptEvalTokens: 1200,
      outputTokens: 340,
      loadDurationMs: 5600,
    })
    expect(parsed.promptEvalTokens).toBe(1200)
    expect(parsed.outputTokens).toBe(340)
    expect(parsed.loadDurationMs).toBe(5600)
  })
})

describe('normalizeQuote', () => {
  it('collapses runs of whitespace into a single space', () => {
    expect(normalizeQuote('const   a\t=\n1')).toBe('const a = 1')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeQuote('  return 1  ')).toBe('return 1')
  })

  it('maps a whitespace-only quote to an empty string', () => {
    expect(normalizeQuote('   \n\t ')).toBe('')
  })
})

describe('reviewResultJsonSchema', () => {
  it('makes the model produce a quote for every comment', () => {
    const comment = reviewResultJsonSchema.properties.comments.items
    expect(comment.properties).toHaveProperty('quote')
    expect(comment.required).toContain('quote')
  })
})

describe('perFileResultSchema', () => {
  it('accepts a result with file, summary, comments, and meta', () => {
    const result = {
      file: 'src/a.ts',
      summary: 'Some issues found',
      comments: [
        {
          severity: 'major',
          file: 'src/a.ts',
          line: 10,
          quote: 'const x = 1',
          message: 'unnecessary variable',
        },
      ],
      meta: {
        model: 'gemma4:12b',
        inputTokens: 100,
        durationMs: 5000,
        droppedComments: 0,
        droppedContextFiles: 0,
      },
    }
    const parsed = perFileResultSchema.parse(result)
    expect(parsed.file).toBe('src/a.ts')
    expect(parsed.summary).toBe('Some issues found')
    expect(parsed.comments).toHaveLength(1)
  })
})

describe('perFileErrorSchema', () => {
  it('accepts an error with file, error type, and message', () => {
    const error = {
      file: 'src/b.ts',
      error: 'ollama_error',
      message: 'stream ended after 1511 chunks',
    }
    const parsed = perFileErrorSchema.parse(error)
    expect(parsed.file).toBe('src/b.ts')
    expect(parsed.error).toBe('ollama_error')
    expect(parsed.message).toBe('stream ended after 1511 chunks')
  })
})

describe('reviewHeartbeatSchema', () => {
  it('accepts a heartbeat with literal true', () => {
    const heartbeat = { heartbeat: true }
    const parsed = reviewHeartbeatSchema.parse(heartbeat)
    expect(parsed.heartbeat).toBe(true)
  })

  it('rejects heartbeat false', () => {
    expect(() => reviewHeartbeatSchema.parse({ heartbeat: false })).toThrow()
  })
})

describe('perFileDoneSchema', () => {
  it('accepts done marker with counts and duration', () => {
    const done = {
      done: true,
      meta: {
        model: 'gemma4:12b',
        reviewed: 8,
        skipped: 10,
        failed: 1,
        durationMs: 512340,
      },
    }
    const parsed = perFileDoneSchema.parse(done)
    expect(parsed.done).toBe(true)
    expect(parsed.meta.reviewed).toBe(8)
    expect(parsed.meta.skipped).toBe(10)
    expect(parsed.meta.failed).toBe(1)
    expect(parsed.meta.durationMs).toBe(512340)
  })

  it('rejects negative reviewed count', () => {
    expect(() =>
      perFileDoneSchema.parse({
        done: true,
        meta: {
          model: 'gemma4:12b',
          reviewed: -1,
          skipped: 0,
          failed: 0,
          durationMs: 100,
        },
      }),
    ).toThrow()
  })

  it('rejects negative skipped count', () => {
    expect(() =>
      perFileDoneSchema.parse({
        done: true,
        meta: {
          model: 'gemma4:12b',
          reviewed: 0,
          skipped: -5,
          failed: 0,
          durationMs: 100,
        },
      }),
    ).toThrow()
  })

  it('rejects negative failed count', () => {
    expect(() =>
      perFileDoneSchema.parse({
        done: true,
        meta: {
          model: 'gemma4:12b',
          reviewed: 0,
          skipped: 0,
          failed: -3,
          durationMs: 100,
        },
      }),
    ).toThrow()
  })

  it('rejects negative durationMs', () => {
    expect(() =>
      perFileDoneSchema.parse({
        done: true,
        meta: {
          model: 'gemma4:12b',
          reviewed: 0,
          skipped: 0,
          failed: 0,
          durationMs: -1000,
        },
      }),
    ).toThrow()
  })
})

describe('reviewStreamLineSchema', () => {
  it('accepts perFileResult via union', () => {
    const result = {
      file: 'src/a.ts',
      summary: 'Issues found',
      comments: [],
      meta: {
        model: 'gemma4:12b',
        inputTokens: 100,
        durationMs: 1000,
        droppedComments: 0,
        droppedContextFiles: 0,
      },
    }
    const parsed = reviewStreamLineSchema.parse(result)
    expect(parsed).toHaveProperty('file')
    expect(parsed).toHaveProperty('summary')
  })

  it('accepts perFileError via union', () => {
    const error = {
      file: 'src/b.ts',
      error: 'ollama_error',
      message: 'stream ended',
    }
    const parsed = reviewStreamLineSchema.parse(error)
    expect(parsed).toHaveProperty('file')
    expect(parsed).toHaveProperty('error')
    expect(parsed).toHaveProperty('message')
  })

  it('accepts heartbeat via union', () => {
    const heartbeat = { heartbeat: true }
    const parsed = reviewStreamLineSchema.parse(heartbeat)
    expect(parsed).toHaveProperty('heartbeat')
  })

  it('accepts a run-level error that names no file', () => {
    const failure = { error: 'review_failed', message: 'the loop gave way' }
    expect(reviewStreamLineSchema.parse(failure)).toEqual(failure)
  })

  // The run-level error declares no file, so putting it first in the union
  // would swallow a per-file error and strip the path off it.
  it('still reads an error that names a file as the per-file one', () => {
    const failure = {
      file: 'src/b.ts',
      error: 'ollama_error',
      message: 'stream ended',
    }
    expect(reviewStreamLineSchema.parse(failure)).toHaveProperty(
      'file',
      'src/b.ts',
    )
  })

  it('accepts perFileDone via union', () => {
    const done = {
      done: true,
      meta: {
        model: 'gemma4:12b',
        reviewed: 5,
        skipped: 2,
        failed: 0,
        durationMs: 10000,
      },
    }
    const parsed = reviewStreamLineSchema.parse(done)
    expect(parsed).toHaveProperty('done')
    expect(parsed).toHaveProperty('meta')
  })

  it('rejects malformed result line missing comments', () => {
    const malformed = {
      file: 'src/a.ts',
      summary: 'Issues found',
      meta: {
        model: 'gemma4:12b',
        inputTokens: 100,
        durationMs: 1000,
        droppedComments: 0,
        droppedContextFiles: 0,
      },
    }
    expect(() => reviewStreamLineSchema.parse(malformed)).toThrow()
  })

  it('rejects malformed error line missing message', () => {
    const malformed = {
      file: 'src/b.ts',
      error: 'ollama_error',
    }
    expect(() => reviewStreamLineSchema.parse(malformed)).toThrow()
  })
})
