import type { ReviewComment, Severity } from '@exocortex/contract'
import type { ResolvedFinding } from './cases.ts'
import type { ReviewOutcome } from './client.ts'

export const NEAR_LINES = 2

const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  minor: 1,
  major: 2,
  critical: 3,
}

// TODO: replace with normalizeQuote from @exocortex/contract once feat/review-model-knobs lands.
export function normalizeQuote(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
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
  perComment: CommentScore[]
  perExpected: ExpectedScore[]
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
    perComment,
    perExpected,
  }
}
