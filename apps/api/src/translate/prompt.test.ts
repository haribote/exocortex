import { describe, expect, it } from 'vitest'
import { buildTranslatePrompt } from './prompt.js'

describe('buildTranslatePrompt', () => {
  it('names both the language and its code for source and target', () => {
    const prompt = buildTranslatePrompt({
      text: 'こんにちは',
      from: 'ja',
      to: 'en',
    })
    expect(prompt).toContain('Japanese (ja)')
    expect(prompt).toContain('English (en)')
  })

  it('puts exactly two blank lines before the text', () => {
    const prompt = buildTranslatePrompt({
      text: 'MARKER',
      from: 'ja',
      to: 'en',
    })
    expect(prompt.endsWith('into English:\n\n\nMARKER')).toBe(true)
  })

  it('preserves newlines inside the text', () => {
    const prompt = buildTranslatePrompt({ text: 'a\nb', from: 'ja', to: 'en' })
    expect(prompt.endsWith('a\nb')).toBe(true)
  })
})
