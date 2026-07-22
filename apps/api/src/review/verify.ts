import type { ContextFile, ReviewComment } from '@exocortex/contract'

export interface VerifyResult {
  kept: ReviewComment[]
  dropped: ReviewComment[]
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function verifyComments(
  comments: readonly ReviewComment[],
  files: readonly ContextFile[],
): VerifyResult {
  const contents = new Map(
    files.map((file) => [file.path, normalize(file.content)]),
  )
  const kept: ReviewComment[] = []
  const dropped: ReviewComment[] = []

  for (const comment of comments) {
    const content = contents.get(comment.file)
    const quote = normalize(comment.quote)
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
