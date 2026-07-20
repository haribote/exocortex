import type { ReviewResponse } from '@exocortex/contract'
import { describe, expect, it } from 'vitest'
import { formatReview } from './format.js'

const response: ReviewResponse = {
  summary: 'two issues found',
  comments: [
    { severity: 'minor', file: 'b.ts', line: 8, message: 'prefer const' },
    { severity: 'critical', file: 'a.ts', line: 3, message: 'null deref' },
  ],
  meta: { model: 'qwen2.5-coder:14b', inputTokens: 100, durationMs: 2000 },
}

describe('formatReview', () => {
  it('includes the summary', () => {
    expect(formatReview(response)).toContain('two issues found')
  })

  it('orders comments by severity, most severe first', () => {
    const output = formatReview(response)
    expect(output.indexOf('null deref')).toBeLessThan(
      output.indexOf('prefer const'),
    )
  })

  it('renders each comment as file:line', () => {
    expect(formatReview(response)).toContain('a.ts:3')
  })

  it('reports the model and duration', () => {
    const output = formatReview(response)
    expect(output).toContain('qwen2.5-coder:14b')
    expect(output).toContain('2000')
  })

  it('states when there are no comments', () => {
    const empty: ReviewResponse = { ...response, comments: [] }
    expect(formatReview(empty)).toContain('No issues')
  })
})
