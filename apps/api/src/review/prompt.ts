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

Every context file below is shown with a line number before a tab on each line.
Use those line numbers in the "line" field. Do not count lines yourself.
Report a problem only if you can point at the exact line that contains it.
If the code you want to complain about is not in the given files, do not report it.

Put the offending line in "quote", copied character for character from the file.
Do not paraphrase it, do not reformat it, do not invent it.
Every comment whose quote does not appear in the file is discarded before you are read,
so a comment you cannot quote is a comment nobody sees.

Assign each comment a severity:
- "critical": the changed code is wrong or unsafe, and will fail or corrupt data as written
- "major": the changed code will behave incorrectly in a plausible case
- "minor": a real defect whose impact is small
- "info": a suggestion that is safe to ignore

Respond with JSON matching this shape:
{"summary": string, "comments": [{"severity": string, "file": string, "line": number, "quote": string, "message": string}]}`

function numberLines(content: string): string {
  return content
    .split('\n')
    .map((line, index) => `${index + 1}\t${line}`)
    .join('\n')
}

function renderContextFile(file: ContextFile): string {
  return `File: ${file.path}\n\`\`\`\n${numberLines(file.content)}\n\`\`\``
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
