import { estimateTokens, MAX_INPUT_TOKENS } from '@exocortex/contract'
import { describe, expect, it } from 'vitest'
import {
  baseInputTokens,
  buildReviewBody,
  buildReviewPrompt,
  packContext,
  type ReviewPromptInput,
  SYSTEM_INSTRUCTION,
} from './prompt.js'

function makeInput(
  overrides: Partial<ReviewPromptInput> = {},
): ReviewPromptInput {
  return {
    language: 'typescript',
    diff: 'diff --git a/a.ts b/a.ts',
    rules: [],
    contextFiles: [],
    ...overrides,
  }
}

describe('buildReviewPrompt', () => {
  it('includes the diff', () => {
    const prompt = buildReviewPrompt(makeInput({ diff: 'MARKER_DIFF' }))
    expect(prompt).toContain('MARKER_DIFF')
  })

  it('includes the language', () => {
    expect(buildReviewPrompt(makeInput({ language: 'rust' }))).toContain('rust')
  })

  it('numbers every line of a context file', () => {
    const prompt = buildReviewPrompt(
      makeInput({
        contextFiles: [{ path: 'a.ts', content: 'const a = 1\nconst b = 2' }],
      }),
    )
    expect(prompt).toContain('1\tconst a = 1')
    expect(prompt).toContain('2\tconst b = 2')
  })

  it('tells the model that the line numbers are the ones to cite', () => {
    const prompt = buildReviewPrompt(makeInput())
    expect(prompt).toMatch(/line number/i)
  })

  it('defines each severity so the model does not inflate them', () => {
    const prompt = buildReviewPrompt(makeInput())
    for (const severity of ['critical', 'major', 'minor', 'info']) {
      expect(prompt).toMatch(new RegExp(`"${severity}":`))
    }
  })

  it('tells the model not to report what it cannot point at', () => {
    expect(buildReviewPrompt(makeInput())).toMatch(/do not report it/i)
  })

  it('includes each rule', () => {
    const prompt = buildReviewPrompt(makeInput({ rules: ['No Side Effects'] }))
    expect(prompt).toContain('No Side Effects')
  })

  it('includes context files with their paths', () => {
    const prompt = buildReviewPrompt(
      makeInput({
        contextFiles: [{ path: 'src/a.ts', content: 'MARKER_CONTENT' }],
      }),
    )
    expect(prompt).toContain('src/a.ts')
    expect(prompt).toContain('MARKER_CONTENT')
  })

  it('states the required json shape to ground the model', () => {
    const prompt = buildReviewPrompt(makeInput())
    expect(prompt).toContain('summary')
    expect(prompt).toContain('comments')
  })
})

const bare = makeInput()

const withRules = makeInput({ rules: ['No Side Effects', 'Prefer const'] })

const withContext = makeInput({
  rules: ['No Side Effects'],
  contextFiles: [
    { path: 'a.ts', content: 'const a = 1\nconst b = 2' },
    { path: 'src/b.ts', content: 'export function f() {\n  return 1\n}' },
  ],
  diff: 'diff --git a/a.ts b/a.ts\n+const a = 1',
  language: 'rust',
})

// These snapshots are the baseline prompt as of bf23918, transcribed verbatim.
// The eval compares every configuration against that exact text, so a diff here
// invalidates the comparison rather than reporting a harmless refactor. Do not
// run vitest -u to make one pass: change the snapshot only when the intent is to
// abandon the old baseline and re-measure every configuration against a new one.
describe('baseline prompt text', () => {
  it('renders a prompt with neither rules nor context files', () => {
    expect(buildReviewPrompt(bare)).toMatchInlineSnapshot(`
      "You are a meticulous senior code reviewer.
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
      {"summary": string, "comments": [{"severity": string, "file": string, "line": number, "quote": string, "message": string}]}

      Language: typescript

      Diff to review:
      \`\`\`diff
      diff --git a/a.ts b/a.ts
      \`\`\`"
    `)
  })

  it('renders a prompt with rules', () => {
    expect(buildReviewPrompt(withRules)).toMatchInlineSnapshot(`
      "You are a meticulous senior code reviewer.
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
      {"summary": string, "comments": [{"severity": string, "file": string, "line": number, "quote": string, "message": string}]}

      Language: typescript

      Project rules:
      - No Side Effects
      - Prefer const

      Diff to review:
      \`\`\`diff
      diff --git a/a.ts b/a.ts
      \`\`\`"
    `)
  })

  it('renders a prompt with rules and context files', () => {
    expect(buildReviewPrompt(withContext)).toMatchInlineSnapshot(`
      "You are a meticulous senior code reviewer.
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
      {"summary": string, "comments": [{"severity": string, "file": string, "line": number, "quote": string, "message": string}]}

      Language: rust

      Project rules:
      - No Side Effects

      File: a.ts
      \`\`\`
      1	const a = 1
      2	const b = 2
      \`\`\`

      File: src/b.ts
      \`\`\`
      1	export function f() {
      2	  return 1
      3	}
      \`\`\`

      Diff to review:
      \`\`\`diff
      diff --git a/a.ts b/a.ts
      +const a = 1
      \`\`\`"
    `)
  })
})

describe('buildReviewBody', () => {
  const inputs: ReviewPromptInput[] = [bare, withRules, withContext]

  it('rejoins with the system instruction into the exact prompt buildReviewPrompt returns', () => {
    for (const input of inputs) {
      expect(buildReviewPrompt(input)).toBe(
        [SYSTEM_INSTRUCTION, buildReviewBody(input)].join('\n\n'),
      )
    }
  })

  it('does not repeat the system instruction inside the body', () => {
    expect(buildReviewBody(makeInput())).not.toContain(SYSTEM_INSTRUCTION)
  })
})

describe('buildReviewPrompt quote grounding', () => {
  it('requires a verbatim quote in the declared json shape', () => {
    expect(buildReviewPrompt(makeInput())).toContain('"quote"')
  })

  it('warns that an unquotable comment will be discarded', () => {
    expect(buildReviewPrompt(makeInput())).toMatch(/discard/i)
  })
})

describe('packContext', () => {
  const base = { language: 'typescript', diff: 'diff', rules: [] }

  it('keeps candidates that fit and reports none dropped', () => {
    const result = packContext(base, [
      { path: 'a.ts', content: 'const a = 1\n' },
      { path: 'b.ts', content: 'const b = 2\n' },
    ])
    expect(result.files.map((f) => f.path)).toEqual(['a.ts', 'b.ts'])
    expect(result.dropped).toBe(0)
  })

  it('drops a candidate that does not fit and counts it', () => {
    const huge = { path: 'big.ts', content: 'x'.repeat(MAX_INPUT_TOKENS * 3) }
    const result = packContext(base, [huge])
    expect(result.files).toEqual([])
    expect(result.dropped).toBe(1)
  })

  it('skips an oversized candidate and still packs smaller ones after it', () => {
    const huge = { path: 'big.ts', content: 'x'.repeat(MAX_INPUT_TOKENS * 3) }
    const small = { path: 'small.ts', content: 'const s = 1\n' }
    const result = packContext(base, [huge, small])
    expect(result.files.map((f) => f.path)).toEqual(['small.ts'])
    expect(result.dropped).toBe(1)
  })

  it('keeps the rendered prompt within the input limit, counting line numbers', () => {
    const candidates = Array.from({ length: 40 }, (_, i) => ({
      path: `f${i}.ts`,
      content: `${'a'.repeat(60)}\n`.repeat(200),
    }))
    const { files } = packContext(base, candidates)
    expect(files.length).toBeGreaterThan(0)
    expect(files.length).toBeLessThan(candidates.length)
    const prompt = buildReviewPrompt({ ...base, contextFiles: files })
    expect(estimateTokens(prompt)).toBeLessThanOrEqual(MAX_INPUT_TOKENS)
  })

  it('measures cost against the rendered file, not the raw content', () => {
    const file = { path: 'x.ts', content: 'a\n'.repeat(500) }
    const { files } = packContext(base, [file])
    const contribution =
      estimateTokens(buildReviewPrompt({ ...base, contextFiles: files })) -
      baseInputTokens(base)
    // line numbers and code fences make the real contribution exceed the raw estimate
    expect(contribution).toBeGreaterThan(estimateTokens(file.content))
  })
})
