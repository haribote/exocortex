import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { readStdin } from './stdin.js'

describe('readStdin', () => {
  it('joins every chunk into one string', async () => {
    const stream = Readable.from(['こんに', 'ちは\n', 'world'])

    expect(await readStdin(stream)).toBe('こんにちは\nworld')
  })

  it('returns an empty string for an empty stream', async () => {
    expect(await readStdin(Readable.from([]))).toBe('')
  })

  it('reads buffers as utf-8', async () => {
    const stream = Readable.from([Buffer.from('日本語', 'utf8')])

    expect(await readStdin(stream)).toBe('日本語')
  })
})
