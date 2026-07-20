import type { ReviewRequest } from '@exocortex/contract'
import { describe, expect, it } from 'vitest'
import { buildReviewPrompt, checkInputSize } from './prompt.js'

function makeRequest(overrides: Partial<ReviewRequest> = {}): ReviewRequest {
  return {
    language: 'typescript',
    diff: 'diff --git a/a.ts b/a.ts',
    rules: [],
    context: { files: [] },
    ...overrides,
  }
}

describe('buildReviewPrompt', () => {
  it('includes the diff', () => {
    const prompt = buildReviewPrompt(makeRequest({ diff: 'MARKER_DIFF' }))
    expect(prompt).toContain('MARKER_DIFF')
  })

  it('includes the language', () => {
    expect(buildReviewPrompt(makeRequest({ language: 'rust' }))).toContain(
      'rust',
    )
  })

  it('includes each rule', () => {
    const prompt = buildReviewPrompt(
      makeRequest({ rules: ['No Side Effects'] }),
    )
    expect(prompt).toContain('No Side Effects')
  })

  it('includes context files with their paths', () => {
    const prompt = buildReviewPrompt(
      makeRequest({
        context: { files: [{ path: 'src/a.ts', content: 'MARKER_CONTENT' }] },
      }),
    )
    expect(prompt).toContain('src/a.ts')
    expect(prompt).toContain('MARKER_CONTENT')
  })

  it('states the required json shape to ground the model', () => {
    const prompt = buildReviewPrompt(makeRequest())
    expect(prompt).toContain('summary')
    expect(prompt).toContain('comments')
  })
})

describe('checkInputSize', () => {
  it('accepts a small request', () => {
    const check = checkInputSize(makeRequest())
    expect(check.ok).toBe(true)
  })

  it('rejects a request whose context exceeds the input budget', () => {
    const huge = 'x'.repeat(200_000)
    const check = checkInputSize(
      makeRequest({ context: { files: [{ path: 'big.ts', content: huge }] } }),
    )
    expect(check.ok).toBe(false)
    if (!check.ok) {
      expect(check.oversizedFiles[0]?.path).toBe('big.ts')
    }
  })

  it('reports files ordered by estimated size, largest first', () => {
    const check = checkInputSize(
      makeRequest({
        context: {
          files: [
            { path: 'small.ts', content: 'x'.repeat(1000) },
            { path: 'big.ts', content: 'x'.repeat(200_000) },
          ],
        },
      }),
    )
    expect(check.ok).toBe(false)
    if (!check.ok) {
      expect(check.oversizedFiles.map((f) => f.path)).toEqual([
        'big.ts',
        'small.ts',
      ])
    }
  })
})
