import { estimateTokens, MAX_INPUT_TOKENS } from '@exocortex/contract'
import { describe, expect, it } from 'vitest'
import {
  baseInputTokens,
  buildReviewPrompt,
  packContext,
  type ReviewPromptInput,
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
