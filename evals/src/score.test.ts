import type { ReviewComment, ReviewResponse } from '@exocortex/contract'
import { describe, expect, it } from 'vitest'
import type { ResolvedFinding } from './cases.ts'
import type { ReviewOutcome } from './client.ts'
import { normalizeQuote, type ScoreTarget, scoreOutcome } from './score.ts'

const cart = [
  'export function shippingFee(amount: number): number {',
  '  if (amount <= FREE_SHIPPING_THRESHOLD) {',
  '    return 0',
  '  }',
  '  return SHIPPING_FEE',
  '}',
  '',
].join('\n')

const expected: ResolvedFinding = {
  id: 'e1',
  file: 'src/cart.ts',
  anchor: 'if (amount <= FREE_SHIPPING_THRESHOLD) {',
  span: 1,
  summary: '比較が反転している',
  severityFloor: 'major',
  line: 2,
}

const target: ScoreTarget = {
  files: new Map([['src/cart.ts', cart]]),
  expected: [expected],
}

const cleanTarget: ScoreTarget = { files: target.files, expected: [] }

function comment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    severity: 'major',
    file: 'src/cart.ts',
    line: 2,
    quote: 'if (amount <= FREE_SHIPPING_THRESHOLD) {',
    message: '比較が反転しています',
    ...overrides,
  }
}

function outcome(
  comments: ReviewComment[],
  meta: Partial<ReviewResponse['meta']> = {},
): ReviewOutcome {
  const response: ReviewResponse = {
    summary: 's',
    comments,
    meta: {
      model: 'qwen3:14b',
      inputTokens: 1200,
      durationMs: 9000,
      droppedComments: 0,
      droppedContextFiles: 0,
      ...meta,
    },
  }
  return {
    status: 200,
    body: JSON.stringify(response),
    wallMs: 9500,
    response,
  }
}

describe('normalizeQuote', () => {
  it('collapses whitespace and trims, exactly as the server does', () => {
    expect(normalizeQuote('  if (a\t&&  b) {\n')).toBe('if (a && b) {')
  })
})

describe('scoreOutcome', () => {
  it('reports schemaOk for a parsed 200', () => {
    const score = scoreOutcome(target, outcome([comment()]))

    expect(score.schemaOk).toBe(true)
    expect(score.comments).toBe(1)
  })

  it('reports schemaOk false when the response never parsed', () => {
    const score = scoreOutcome(target, {
      status: 502,
      body: '{"error":"invalid_model_output","message":"..."}',
      wallMs: 120,
      parseError: 'not a review response',
    })

    expect(score.schemaOk).toBe(false)
    expect(score.comments).toBe(0)
    expect(score.status).toBe(502)
  })

  it('reports schemaOk false when a parsed body came back with a non-200', () => {
    const score = scoreOutcome(target, { ...outcome([]), status: 500 })

    expect(score.schemaOk).toBe(false)
  })

  it('counts a quote that matches the line it cites', () => {
    const score = scoreOutcome(target, outcome([comment()]))

    expect(score.quoteMatches).toBe(1)
    expect(score.quoteMatchRate).toBe(1)
    expect(score.perComment[0]?.quoteMatchesCitedLine).toBe(true)
  })

  it('normalizes whitespace before comparing, exactly as the server does', () => {
    const score = scoreOutcome(
      target,
      outcome([
        comment({ quote: '  if (amount   <= FREE_SHIPPING_THRESHOLD) {\n' }),
      ]),
    )

    expect(score.quoteMatches).toBe(1)
  })

  it('rejects a quote that is only part of the cited line', () => {
    const score = scoreOutcome(
      target,
      outcome([comment({ quote: 'FREE_SHIPPING_THRESHOLD' })]),
    )

    expect(score.quoteMatches).toBe(0)
  })

  it('rejects a quote that belongs to a different line of the same file', () => {
    const score = scoreOutcome(target, outcome([comment({ line: 5 })]))

    expect(score.quoteMatches).toBe(0)
    expect(score.perComment[0]?.quoteMatchesCitedLine).toBe(false)
  })

  it('rejects a line number past the end of the file', () => {
    const score = scoreOutcome(target, outcome([comment({ line: 999 })]))

    expect(score.quoteMatches).toBe(0)
  })

  it('flags a comment on a file the fixture does not have', () => {
    const score = scoreOutcome(
      target,
      outcome([comment({ file: 'src/ghost.ts' })]),
    )

    expect(score.hallucinatedPaths).toBe(1)
    expect(score.perComment[0]?.hallucinatedPath).toBe(true)
    expect(score.quoteMatches).toBe(0)
  })

  it('counts a hit at every level when the line is exact', () => {
    const score = scoreOutcome(target, outcome([comment()]))

    expect(score.hitLine).toBe(1)
    expect(score.hitNear2).toBe(1)
    expect(score.hitFile).toBe(1)
    expect(score.unmatchedComments).toBe(0)
  })

  it('counts a near miss as ±2 and file but not line', () => {
    const score = scoreOutcome(target, outcome([comment({ line: 4 })]))

    expect(score.hitLine).toBe(0)
    expect(score.hitNear2).toBe(1)
    expect(score.hitFile).toBe(1)
  })

  it('counts a far miss in the right file as file only', () => {
    const score = scoreOutcome(target, outcome([comment({ line: 6 })]))

    expect(score.hitLine).toBe(0)
    expect(score.hitNear2).toBe(0)
    expect(score.hitFile).toBe(1)
    expect(score.unmatchedComments).toBe(1)
  })

  it('honours span when deciding an exact hit', () => {
    const spanned: ScoreTarget = {
      files: target.files,
      expected: [{ ...expected, span: 3 }],
    }
    const score = scoreOutcome(spanned, outcome([comment({ line: 4 })]))

    expect(score.hitLine).toBe(1)
  })

  it('records whether the severity floor was met', () => {
    const below = scoreOutcome(target, outcome([comment({ severity: 'info' })]))
    const above = scoreOutcome(
      target,
      outcome([comment({ severity: 'critical' })]),
    )

    expect(below.perExpected[0]?.severityFloorMet).toBe(false)
    expect(above.perExpected[0]?.severityFloorMet).toBe(true)
  })

  it('treats every comment on a clean case as a false positive candidate', () => {
    const score = scoreOutcome(cleanTarget, outcome([comment(), comment()]))

    expect(score.expectedTotal).toBe(0)
    expect(score.unmatchedComments).toBe(2)
  })

  it('tallies severities', () => {
    const score = scoreOutcome(
      cleanTarget,
      outcome([
        comment({ severity: 'minor' }),
        comment({ severity: 'minor' }),
        comment({ severity: 'critical' }),
      ]),
    )

    expect(score.severityCounts).toEqual({
      critical: 1,
      major: 0,
      minor: 2,
      info: 0,
    })
  })

  it('carries the server meta through, including the drop rate', () => {
    const score = scoreOutcome(
      target,
      outcome([comment()], { droppedComments: 3, droppedContextFiles: 2 }),
    )

    expect(score.droppedComments).toBe(3)
    expect(score.droppedContextFiles).toBe(2)
    expect(score.droppedCommentRate).toBe(0.75)
    expect(score.serverDurationMs).toBe(9000)
    expect(score.inputTokens).toBe(1200)
    expect(score.wallMs).toBe(9500)
  })

  it('leaves meta-derived metrics null when there is no meta to read', () => {
    const score = scoreOutcome(target, {
      status: 503,
      body: '{"error":"ollama_unreachable"}',
      wallMs: 30,
    })

    expect(score.droppedComments).toBeNull()
    expect(score.droppedCommentRate).toBeNull()
    expect(score.quoteMatchRate).toBeNull()
  })

  it('is a pure function of its inputs', () => {
    const call = outcome([comment()])
    const first = scoreOutcome(target, call)
    const second = scoreOutcome(target, call)

    expect(first).toEqual(second)
    expect(target.files.get('src/cart.ts')).toBe(cart)
  })
})
