import {
  type ContextFile,
  type ContextFileSize,
  estimateTokens,
  MAX_INPUT_TOKENS,
  type ReviewRequest,
} from '@exocortex/contract'

export type SizeCheck =
  | { ok: true; inputTokens: number }
  | { ok: false; inputTokens: number; contextFiles: ContextFileSize[] }

const SYSTEM_INSTRUCTION = `You are a meticulous senior code reviewer.
Review the given diff and report concrete, actionable problems.
Do not praise. Do not restate what the code does. Report only problems worth fixing.
Assign each comment a severity: "critical", "major", "minor", or "info".
Respond with JSON matching this shape:
{"summary": string, "comments": [{"severity": string, "file": string, "line": number, "message": string}]}`

function renderContextFile(file: ContextFile): string {
  return `File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\``
}

export function buildReviewPrompt(request: ReviewRequest): string {
  const sections: string[] = [
    SYSTEM_INSTRUCTION,
    `Language: ${request.language}`,
  ]

  if (request.rules.length > 0) {
    sections.push(
      `Project rules:\n${request.rules.map((r) => `- ${r}`).join('\n')}`,
    )
  }

  for (const file of request.context.files) {
    sections.push(renderContextFile(file))
  }

  sections.push(`Diff to review:\n\`\`\`diff\n${request.diff}\n\`\`\``)

  return sections.join('\n\n')
}

export function checkInputSize(request: ReviewRequest): SizeCheck {
  const inputTokens = estimateTokens(buildReviewPrompt(request))
  if (inputTokens <= MAX_INPUT_TOKENS) {
    return { ok: true, inputTokens }
  }

  const contextFiles: ContextFileSize[] = request.context.files
    .map((file) => ({
      path: file.path,
      estimatedTokens: estimateTokens(renderContextFile(file)),
    }))
    .sort((a, b) => b.estimatedTokens - a.estimatedTokens)

  return { ok: false, inputTokens, contextFiles }
}
