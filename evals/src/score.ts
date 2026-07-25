import {
  MAX_CONTEXT_TOKENS,
  normalizeQuote,
  type ReviewComment,
  type Severity,
} from '@exocortex/contract'
import type { ResolvedFinding } from './cases.ts'
import type { ReviewOutcome } from './client.ts'

export const NEAR_LINES = 2

const THINKING_KEY = /think/i
const TOKEN_KEY = /token|count|eval/i
const LENGTH_KEY = /len|char/i
const PROMPT_TOKEN_KEYS = [
  'promptEvalTokens',
  'prompt_eval_count',
  'promptTokens',
]

const OUTPUT_TOKEN_KEYS = ['outputTokens', 'eval_count', 'completionTokens']

const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  minor: 1,
  major: 2,
  critical: 3,
}

export interface ScoreTarget {
  files: ReadonlyMap<string, string>
  expected: readonly ResolvedFinding[]
}

export interface CommentScore {
  index: number
  file: string
  line: number
  severity: Severity
  quoteMatchesCitedLine: boolean
  hallucinatedPath: boolean
  matchedExpectedId: string | null
}

export interface ExpectedScore {
  id: string
  file: string
  line: number
  span: number
  hitLine: boolean
  hitNear2: boolean
  hitFile: boolean
  severityFloorMet: boolean
}

export interface Score {
  status: number
  schemaOk: boolean
  comments: number
  quoteMatches: number
  quoteMatchRate: number | null
  hallucinatedPaths: number
  expectedTotal: number
  hitLine: number
  hitNear2: number
  hitFile: number
  unmatchedComments: number
  severityCounts: Record<Severity, number>
  droppedComments: number | null
  droppedCommentRate: number | null
  droppedContextFiles: number | null
  inputTokens: number | null
  serverDurationMs: number | null
  wallMs: number
  thinkingTokens: number | null
  thinkingChars: number | null
  thinkingMeta: Record<string, number> | null
  promptEvalTokens: number | null
  outputTokens: number | null
  contextRemaining: number | null
  perComment: CommentScore[]
  perExpected: ExpectedScore[]
}

// The contract does not declare a thinking field yet, and its name is not
// settled. Read whatever the server actually sent rather than the parsed value,
// and treat a missing field as unknown instead of an error.
export function rawMeta(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'object' || raw === null) return null
  const meta = (raw as { meta?: unknown }).meta
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    return null
  }
  return meta as Record<string, unknown>
}

function numericEntries(
  meta: Record<string, unknown> | null,
  matches: (key: string) => boolean,
): [string, number][] {
  if (meta === null) return []
  return Object.entries(meta).filter(
    (entry): entry is [string, number] =>
      matches(entry[0]) &&
      typeof entry[1] === 'number' &&
      !Number.isNaN(entry[1]),
  )
}

export interface ThinkingMetrics {
  thinkingTokens: number | null
  thinkingChars: number | null
  thinkingMeta: Record<string, number> | null
}

export function readThinking(raw: unknown): ThinkingMetrics {
  const found = numericEntries(rawMeta(raw), (key) => THINKING_KEY.test(key))
  if (found.length === 0) {
    return { thinkingTokens: null, thinkingChars: null, thinkingMeta: null }
  }

  return {
    thinkingTokens: found.find(([key]) => TOKEN_KEY.test(key))?.[1] ?? null,
    thinkingChars: found.find(([key]) => LENGTH_KEY.test(key))?.[1] ?? null,
    thinkingMeta: Object.fromEntries(found),
  }
}

function readTokenCount(raw: unknown, keys: readonly string[]): number | null {
  const meta = rawMeta(raw)
  if (meta === null) return null
  for (const key of keys) {
    const value = meta[key]
    if (typeof value === 'number' && !Number.isNaN(value)) return value
  }
  return null
}

export function readPromptEvalTokens(raw: unknown): number | null {
  return readTokenCount(raw, PROMPT_TOKEN_KEYS)
}

// eval_count excludes the thinking text while `format` is set, so this counts
// the JSON output alone. Read thinkingChars alongside it to see the real cost.
export function readOutputTokens(raw: unknown): number | null {
  return readTokenCount(raw, OUTPUT_TOKEN_KEYS)
}

function citedLine(
  files: ReadonlyMap<string, string>,
  comment: ReviewComment,
): string | undefined {
  const content = files.get(comment.file)
  if (content === undefined) return undefined
  return content.split('\n')[comment.line - 1]
}

function quoteMatchesCitedLine(
  files: ReadonlyMap<string, string>,
  comment: ReviewComment,
): boolean {
  const line = citedLine(files, comment)
  if (line === undefined) return false
  const quote = normalizeQuote(comment.quote)
  return quote.length > 0 && normalizeQuote(line) === quote
}

function withinSpan(finding: ResolvedFinding, line: number): boolean {
  return line >= finding.line && line <= finding.line + finding.span - 1
}

function withinNear(finding: ResolvedFinding, line: number): boolean {
  return (
    line >= finding.line - NEAR_LINES &&
    line <= finding.line + finding.span - 1 + NEAR_LINES
  )
}

function distance(finding: ResolvedFinding, line: number): number {
  if (withinSpan(finding, line)) return 0
  const last = finding.line + finding.span - 1
  return Math.min(Math.abs(line - finding.line), Math.abs(line - last))
}

function nearestExpected(
  expected: readonly ResolvedFinding[],
  comment: ReviewComment,
): ResolvedFinding | null {
  const candidates = expected.filter(
    (finding) =>
      finding.file === comment.file && withinNear(finding, comment.line),
  )
  if (candidates.length === 0) return null

  return candidates.reduce((best, finding) =>
    distance(finding, comment.line) < distance(best, comment.line)
      ? finding
      : best,
  )
}

export function scoreOutcome(
  target: ScoreTarget,
  outcome: ReviewOutcome,
): Score {
  const schemaOk = outcome.status === 200 && outcome.response !== undefined
  const response = schemaOk ? outcome.response : undefined
  const comments = response?.comments ?? []
  const meta = response?.meta

  const perComment = comments.map((comment, index): CommentScore => {
    const matched = nearestExpected(target.expected, comment)
    return {
      index,
      file: comment.file,
      line: comment.line,
      severity: comment.severity,
      quoteMatchesCitedLine: quoteMatchesCitedLine(target.files, comment),
      hallucinatedPath: !target.files.has(comment.file),
      matchedExpectedId: matched?.id ?? null,
    }
  })

  const perExpected = target.expected.map((finding): ExpectedScore => {
    const sameFile = comments.filter((comment) => comment.file === finding.file)
    const near = sameFile.filter((comment) => withinNear(finding, comment.line))
    return {
      id: finding.id,
      file: finding.file,
      line: finding.line,
      span: finding.span,
      hitLine: sameFile.some((comment) => withinSpan(finding, comment.line)),
      hitNear2: near.length > 0,
      hitFile: sameFile.length > 0,
      severityFloorMet: near.some(
        (comment) =>
          SEVERITY_RANK[comment.severity] >=
          SEVERITY_RANK[finding.severityFloor],
      ),
    }
  })

  const severityCounts: Record<Severity, number> = {
    critical: 0,
    major: 0,
    minor: 0,
    info: 0,
  }
  for (const comment of comments) severityCounts[comment.severity]++

  const quoteMatches = perComment.filter(
    (scored) => scored.quoteMatchesCitedLine,
  ).length
  const dropped = meta?.droppedComments ?? null
  const returned = dropped === null ? 0 : dropped + comments.length
  const thinking = readThinking(outcome.raw)
  const promptEvalTokens = readPromptEvalTokens(outcome.raw)

  return {
    status: outcome.status,
    schemaOk,
    comments: comments.length,
    quoteMatches,
    quoteMatchRate: comments.length > 0 ? quoteMatches / comments.length : null,
    hallucinatedPaths: perComment.filter((scored) => scored.hallucinatedPath)
      .length,
    expectedTotal: target.expected.length,
    hitLine: perExpected.filter((scored) => scored.hitLine).length,
    hitNear2: perExpected.filter((scored) => scored.hitNear2).length,
    hitFile: perExpected.filter((scored) => scored.hitFile).length,
    unmatchedComments: perComment.filter(
      (scored) => scored.matchedExpectedId === null,
    ).length,
    severityCounts,
    droppedComments: dropped,
    droppedCommentRate:
      dropped !== null && returned > 0 ? dropped / returned : null,
    droppedContextFiles: meta?.droppedContextFiles ?? null,
    inputTokens: meta?.inputTokens ?? null,
    serverDurationMs: meta?.durationMs ?? null,
    wallMs: outcome.wallMs,
    ...thinking,
    promptEvalTokens,
    outputTokens: readOutputTokens(outcome.raw),
    contextRemaining:
      promptEvalTokens === null ? null : MAX_CONTEXT_TOKENS - promptEvalTokens,
    perComment,
    perExpected,
  }
}
