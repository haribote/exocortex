import type { ReviewResponse } from '@exocortex/contract'
import { describe, expect, it } from 'vitest'
import { formatReview } from './format.js'

const response: ReviewResponse = {
  summary: 'two issues found',
  comments: [
    {
      severity: 'minor',
      file: 'b.ts',
      line: 8,
      quote: 'let x = 1',
      message: 'prefer const',
    },
    {
      severity: 'critical',
      file: 'a.ts',
      line: 3,
      quote: 'a.b.c',
      message: 'null deref',
    },
  ],
  meta: {
    model: 'qwen2.5-coder:14b',
    inputTokens: 100,
    durationMs: 2000,
    droppedComments: 0,
  },
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

describe('formatReview quote and dropped count', () => {
  it('shows the quoted line under each comment', () => {
    expect(formatReview(response)).toContain('a.b.c')
  })

  it('reports how many comments were dropped as unverifiable', () => {
    const dropped: ReviewResponse = {
      ...response,
      meta: { ...response.meta, droppedComments: 3 },
    }
    expect(formatReview(dropped)).toMatch(/3 .*dropped/i)
  })

  it('says nothing about dropped comments when none were dropped', () => {
    expect(formatReview(response)).not.toMatch(/dropped/i)
  })
})
