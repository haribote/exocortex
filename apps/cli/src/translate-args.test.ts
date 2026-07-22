import { describe, expect, it } from 'vitest'
import { parseTranslateOptions, TRANSLATE_USAGE } from './translate-args.js'

describe('parseTranslateOptions', () => {
  it('reads the translation direction', () => {
    const parsed = parseTranslateOptions(['--from', 'ja', '--to', 'en'])
    expect(parsed.ok).toBe(true)
    if (parsed.ok && !parsed.help) {
      expect(parsed.options.from).toBe('ja')
      expect(parsed.options.to).toBe('en')
    }
  })

  it('reads the text from a positional argument', () => {
    const parsed = parseTranslateOptions([
      '--from',
      'ja',
      '--to',
      'en',
      'こんにちは',
    ])
    expect(parsed.ok).toBe(true)
    if (parsed.ok && !parsed.help) {
      expect(parsed.options.text).toBe('こんにちは')
    }
  })

  it('joins multiple positional arguments with a space', () => {
    const parsed = parseTranslateOptions([
      '--from',
      'en',
      '--to',
      'ja',
      'hello',
      'world',
    ])
    expect(parsed.ok).toBe(true)
    if (parsed.ok && !parsed.help) {
      expect(parsed.options.text).toBe('hello world')
    }
  })

  it('leaves the text undefined when no positional is given', () => {
    const parsed = parseTranslateOptions(['--from', 'ja', '--to', 'en'])
    expect(parsed.ok).toBe(true)
    if (parsed.ok && !parsed.help) {
      expect(parsed.options.text).toBeUndefined()
    }
  })

  it('accepts --help without requiring a direction', () => {
    const parsed = parseTranslateOptions(['--help'])
    expect(parsed).toEqual({ ok: true, help: true })
  })

  it('reports a missing --from instead of guessing', () => {
    const parsed = parseTranslateOptions(['--to', 'en'])
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.message).toMatch(/--from/)
    }
  })

  it('reports a missing --to instead of guessing', () => {
    const parsed = parseTranslateOptions(['--from', 'ja'])
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.message).toMatch(/--to/)
    }
  })

  it('rejects a language outside the contract', () => {
    const parsed = parseTranslateOptions(['--from', 'fr', '--to', 'en'])
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.message).toMatch(/fr/)
    }
  })

  it('reports an unknown option instead of throwing', () => {
    const parsed = parseTranslateOptions(['--nope'])
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.message).toMatch(/--nope/)
    }
  })
})

describe('TRANSLATE_USAGE', () => {
  it('names the command', () => {
    expect(TRANSLATE_USAGE).toContain('exoc-translate')
  })

  it('documents every option parseTranslateOptions accepts', () => {
    for (const option of ['--from', '--to', '--json', '--help']) {
      expect(TRANSLATE_USAGE).toContain(option)
    }
  })
})
