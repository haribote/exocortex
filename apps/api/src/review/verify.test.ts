import type { ContextFile, ReviewComment } from '@exocortex/contract'
import { describe, expect, it } from 'vitest'
import { verifyComments } from './verify.js'

function comment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    severity: 'major',
    file: 'a.ts',
    line: 1,
    quote: 'const a = 1',
    message: 'm',
    ...overrides,
  }
}

const files: ContextFile[] = [
  { path: 'a.ts', content: 'const a = 1\nconst b = 2\n' },
]

describe('verifyComments', () => {
  it('keeps a comment whose quote appears in the cited file', () => {
    const result = verifyComments([comment()], files)

    expect(result.kept).toHaveLength(1)
    expect(result.dropped).toHaveLength(0)
  })

  it('drops a comment whose quote is nowhere in the cited file', () => {
    const result = verifyComments([comment({ quote: 'const zzz = 9' })], files)

    expect(result.kept).toHaveLength(0)
    expect(result.dropped).toHaveLength(1)
  })

  it('drops a comment with an empty quote', () => {
    const result = verifyComments([comment({ quote: '   ' })], files)

    expect(result.dropped).toHaveLength(1)
  })

  it('ignores indentation and surrounding whitespace when matching', () => {
    const indented: ContextFile[] = [
      { path: 'a.ts', content: 'function f() {\n    return 1\n}\n' },
    ]
    const result = verifyComments([comment({ quote: 'return 1' })], indented)

    expect(result.kept).toHaveLength(1)
  })

  it('keeps a comment when the cited file was never sent as context', () => {
    const result = verifyComments([comment({ file: 'unknown.ts' })], files)

    expect(result.kept).toHaveLength(1)
    expect(result.dropped).toHaveLength(0)
  })

  it('does not use the cited line number to judge', () => {
    const result = verifyComments([comment({ line: 999 })], files)

    expect(result.kept).toHaveLength(1)
  })

  it('separates a mixed batch', () => {
    const result = verifyComments(
      [
        comment(),
        comment({ quote: 'not here' }),
        comment({ quote: 'const b = 2' }),
      ],
      files,
    )

    expect(result.kept).toHaveLength(2)
    expect(result.dropped).toHaveLength(1)
  })
})
