import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  extractSnapshot,
  SnapshotExtractError,
  SnapshotTooLargeError,
} from './snapshot.js'

let work: string

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), 'exocortex-snap-'))
})

afterEach(() => {
  rmSync(work, { recursive: true, force: true })
})

function tarball(files: Record<string, string>): Uint8Array {
  const content = join(work, 'content')
  mkdirSync(content)
  for (const [path, body] of Object.entries(files)) {
    const full = join(content, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, body)
  }
  const archive = join(work, 'snapshot.tgz')
  execFileSync('tar', ['czf', archive, '-C', content, '.'])
  return readFileSync(archive)
}

describe('extractSnapshot', () => {
  it('extracts the archived files into an isolated directory', async () => {
    const snapshot = await extractSnapshot(
      tarball({
        'a.ts': 'export const a = 1\n',
        'nested/b.ts': 'const b = 2\n',
      }),
    )
    try {
      expect(readFileSync(join(snapshot.dir, 'a.ts'), 'utf8')).toBe(
        'export const a = 1\n',
      )
      expect(readFileSync(join(snapshot.dir, 'nested/b.ts'), 'utf8')).toBe(
        'const b = 2\n',
      )
    } finally {
      await snapshot.cleanup()
    }
  })

  it('cleanup removes the extraction directory', async () => {
    const snapshot = await extractSnapshot(tarball({ 'a.ts': 'a\n' }))
    expect(existsSync(snapshot.dir)).toBe(true)
    await snapshot.cleanup()
    expect(existsSync(snapshot.dir)).toBe(false)
  })

  it('rejects a snapshot over the byte limit', async () => {
    await expect(
      extractSnapshot(new Uint8Array(10), { maxBytes: 5 }),
    ).rejects.toBeInstanceOf(SnapshotTooLargeError)
  })

  it('rejects bytes that are not a valid gzip archive', async () => {
    await expect(
      extractSnapshot(new Uint8Array([1, 2, 3, 4])),
    ).rejects.toBeInstanceOf(SnapshotExtractError)
  })
})
