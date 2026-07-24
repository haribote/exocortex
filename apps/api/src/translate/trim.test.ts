import { describe, expect, it } from 'vitest'
import { createDeltaTrimmer } from './trim.js'

function emitted(deltas: string[]): string[] {
  const trimmer = createDeltaTrimmer()
  return deltas.map((delta) => trimmer.push(delta))
}

function joined(deltas: string[]): string {
  return emitted(deltas).join('')
}

describe('createDeltaTrimmer', () => {
  it('drops deltas that are entirely leading whitespace', () => {
    expect(emitted(['  ', '  Hello'])).toEqual(['', 'Hello'])
  })

  it('keeps whitespace between two pieces of text', () => {
    expect(emitted(['Hello', '\n\n', 'world'])).toEqual([
      'Hello',
      '',
      '\n\nworld',
    ])
  })

  it('accumulates held whitespace across several deltas', () => {
    expect(emitted(['Hello  ', '  ', 'world'])).toEqual([
      'Hello',
      '',
      '    world',
    ])
  })

  it('discards trailing whitespace that is never followed by text', () => {
    expect(joined(['Hello', '\n'])).toBe('Hello')
  })

  it('trims both ends of a single delta', () => {
    expect(emitted(['  Hello  '])).toEqual(['Hello'])
  })

  it('never emits an empty string for a delta that carries text', () => {
    expect(emitted(['\n\n\nこんにちは'])).toEqual(['こんにちは'])
  })

  it('produces nothing at all for an all-whitespace stream', () => {
    expect(joined(['  ', '\n', '\t'])).toBe('')
  })

  it.each([
    [['  ', '  Hello']],
    [['Hello', '\n\n', 'world']],
    [['Hello  ', '  ', 'world']],
    [['  Hello  ']],
    [['\n\nHello world\n\n']],
    [['\u{FEFF}Hello\u{FEFF}']],
  ])('matches String.prototype.trim over the whole stream: %j', (deltas) => {
    expect(joined(deltas)).toBe(deltas.join('').trim())
  })
})
