import { describe, expect, it } from 'vitest'
import { buildReviewPrompt, type ReviewPromptInput } from './prompt.js'

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
