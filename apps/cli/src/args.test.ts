import { describe, expect, it } from 'vitest'
import { parseOptions, USAGE } from './args.js'

describe('parseOptions', () => {
  it('defaults the language when it is not given', () => {
    const parsed = parseOptions([])
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.options.language).toBe('typescript')
    }
  })

  it('reads the base ref', () => {
    const parsed = parseOptions(['--base', 'main'])
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.options.base).toBe('main')
    }
  })

  it('reports an unknown option instead of throwing', () => {
    const parsed = parseOptions(['--nope'])
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.message).toMatch(/--nope/)
    }
  })

  it('reports a missing option value instead of throwing', () => {
    const parsed = parseOptions(['--base'])
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.message).toMatch(/--base/)
    }
  })
})

describe('USAGE', () => {
  it('documents every option parseOptions accepts', () => {
    for (const option of [
      '--base',
      '--staged',
      '--json',
      '--language',
      '--help',
    ]) {
      expect(USAGE).toContain(option)
    }
  })
})
