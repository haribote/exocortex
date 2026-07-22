import type { ReviewResponse, Severity } from '@exocortex/contract'

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
  info: 3,
}

export function formatReview(response: ReviewResponse): string {
  const lines: string[] = [response.summary, '']

  if (response.comments.length === 0) {
    lines.push('No issues found.')
  } else {
    const sorted = [...response.comments].sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    )
    for (const comment of sorted) {
      lines.push(`[${comment.severity}] ${comment.file}:${comment.line}`)
      lines.push(`  > ${comment.quote}`)
      lines.push(`  ${comment.message}`)
      lines.push('')
    }
  }

  if (response.meta.droppedComments > 0) {
    lines.push(
      `${response.meta.droppedComments} comment(s) dropped: the quoted code was not found in the reviewed files.`,
    )
    lines.push('')
  }

  lines.push(
    `-- ${response.meta.model}, ${response.meta.inputTokens} input tokens, ${response.meta.durationMs}ms`,
  )

  return lines.join('\n')
}
