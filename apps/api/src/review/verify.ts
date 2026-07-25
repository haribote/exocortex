import {
  type ContextFile,
  normalizeQuote,
  type ReviewComment,
} from '@exocortex/contract'

export interface VerifyResult {
  kept: ReviewComment[]
  dropped: ReviewComment[]
}

export function verifyComments(
  comments: readonly ReviewComment[],
  files: readonly ContextFile[],
): VerifyResult {
  const contents = new Map(
    files.map((file) => [file.path, normalizeQuote(file.content)]),
  )
  const kept: ReviewComment[] = []
  const dropped: ReviewComment[] = []

  for (const comment of comments) {
    const content = contents.get(comment.file)
    const quote = normalizeQuote(comment.quote)
    const unverifiable =
      content !== undefined && (quote.length === 0 || !content.includes(quote))

    if (unverifiable) {
      dropped.push(comment)
    } else {
      kept.push(comment)
    }
  }

  return { kept, dropped }
}
