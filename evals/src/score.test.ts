import {
  MAX_CONTEXT_TOKENS,
  normalizeQuote,
  type ReviewComment,
  type ReviewResponse,
} from '@exocortex/contract'
import { describe, expect, it } from 'vitest'
import type { ResolvedFinding } from './cases.ts'
import type { ReviewOutcome } from './client.ts'
import { type ScoreTarget, scoreOutcome } from './score.ts'

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
    raw: response,
  }
}

function outcomeWithMeta(extra: Record<string, unknown>): ReviewOutcome {
  const base = outcome([comment()])
  const raw = {
    ...(base.raw as Record<string, unknown>),
    meta: { ...(base.response as ReviewResponse).meta, ...extra },
  }
  return { ...base, body: JSON.stringify(raw), raw }
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

  it('leaves thinking and prompt tokens null while the contract lacks them', () => {
    const score = scoreOutcome(target, outcome([comment()]))

    expect(score.thinkingTokens).toBeNull()
    expect(score.thinkingChars).toBeNull()
    expect(score.thinkingMeta).toBeNull()
    expect(score.promptEvalTokens).toBeNull()
    expect(score.contextRemaining).toBeNull()
  })

  it('picks up a thinking token count whatever the field ends up being called', () => {
    for (const name of [
      'thinkingTokens',
      'thinking_eval_count',
      'thinkTokenCount',
    ]) {
      const score = scoreOutcome(target, outcomeWithMeta({ [name]: 1242 }))

      expect(score.thinkingTokens, name).toBe(1242)
      expect(score.thinkingMeta, name).toEqual({ [name]: 1242 })
    }
  })

  it('separates a thinking length from a thinking token count', () => {
    const score = scoreOutcome(
      target,
      outcomeWithMeta({ thinkingLength: 1242, thinkingTokens: 401 }),
    )

    expect(score.thinkingChars).toBe(1242)
    expect(score.thinkingTokens).toBe(401)
  })

  it('keeps an unrecognised thinking field rather than dropping it', () => {
    const score = scoreOutcome(target, outcomeWithMeta({ thinking: 1242 }))

    expect(score.thinkingMeta).toEqual({ thinking: 1242 })
    expect(score.thinkingTokens).toBeNull()
  })

  // The names the server actually settled on. A smoke run recorded every one of
  // these as null because the harness was not reading them.
  it('reads the meta fields the server really sends', () => {
    const score = scoreOutcome(
      target,
      outcomeWithMeta({
        promptEvalTokens: 994,
        outputTokens: 145,
        thinkingChars: 4537,
      }),
    )

    expect(score.promptEvalTokens).toBe(994)
    expect(score.outputTokens).toBe(145)
    expect(score.thinkingChars).toBe(4537)
    expect(score.contextRemaining).toBe(MAX_CONTEXT_TOKENS - 994)
  })

  it('leaves outputTokens null when the server omits it', () => {
    const score = scoreOutcome(target, outcomeWithMeta({ promptEvalTokens: 1 }))

    expect(score.outputTokens).toBeNull()
  })

  it('ignores a thinking field that is not a number', () => {
    const score = scoreOutcome(
      target,
      outcomeWithMeta({ thinkingTokens: 'lots' }),
    )

    expect(score.thinkingMeta).toBeNull()
  })

  it('records prompt tokens and what is left of the context window', () => {
    const score = scoreOutcome(
      target,
      outcomeWithMeta({ promptEvalTokens: 30_000 }),
    )

    expect(score.promptEvalTokens).toBe(30_000)
    expect(score.contextRemaining).toBe(MAX_CONTEXT_TOKENS - 30_000)
  })

  it('accepts the raw ollama spelling of the prompt token count', () => {
    const score = scoreOutcome(
      target,
      outcomeWithMeta({ prompt_eval_count: 15_400 }),
    )

    expect(score.promptEvalTokens).toBe(15_400)
  })

  it('reports a negative remainder when the prompt overran the window', () => {
    const score = scoreOutcome(
      target,
      outcomeWithMeta({ promptEvalTokens: MAX_CONTEXT_TOKENS + 232 }),
    )

    expect(score.contextRemaining).toBe(-232)
  })

  it('survives a body that is not shaped like a review response at all', () => {
    for (const raw of [null, 'text', 42, [], { meta: 'nope' }, { meta: [] }]) {
      expect(() =>
        scoreOutcome(target, { status: 502, body: '', wallMs: 1, raw }),
      ).not.toThrow()
    }
  })

  it('is a pure function of its inputs', () => {
    const call = outcome([comment()])
    const first = scoreOutcome(target, call)
    const second = scoreOutcome(target, call)

    expect(first).toEqual(second)
    expect(target.files.get('src/cart.ts')).toBe(cart)
  })
})
