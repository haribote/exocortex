import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MAX_INPUT_TOKENS } from '@exocortex/contract'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBuildReviewInput } from './input.js'

let repo: string

const isolatedEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
}

function git(...args: string[]): void {
  execFileSync('git', args, { cwd: repo, env: isolatedEnv })
}

function snapshot(): Uint8Array {
  const archive = join(repo, '..', 'snapshot.tgz')
  execFileSync('tar', ['czf', archive, '-C', repo, '.'])
  return readFileSync(archive)
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'exocortex-input-'))
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'test')
  writeFileSync(join(repo, 'a.ts'), 'export const a = 1\n')
  git('add', '.')
  git('commit', '-qm', 'initial')
})

afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
})

const build = createBuildReviewInput()
const params = { language: 'typescript', rules: [] as string[] }

describe('createBuildReviewInput', () => {
  it('builds the diff and context from an uncommitted change', async () => {
    writeFileSync(join(repo, 'a.ts'), 'export const a = 999\n')
    const result = await build(snapshot(), params)

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.input.diff).toContain('export const a = 999')
    expect(result.input.contextFiles.map((f) => f.path)).toContain('a.ts')
    expect(result.inputTokens).toBeGreaterThan(0)
  })

  it('reports too_large when the diff alone exceeds the input budget', async () => {
    writeFileSync(join(repo, 'a.ts'), `${'x'.repeat(MAX_INPUT_TOKENS * 3)}\n`)
    const result = await build(snapshot(), params)
    expect(result.kind).toBe('too_large')
  })

  it('drops oversized context and keeps the prompt within the input budget', async () => {
    writeFileSync(join(repo, 'CLAUDE.md'), 'y'.repeat(MAX_INPUT_TOKENS * 3))
    git('add', '.')
    git('commit', '-qm', 'huge rules')
    writeFileSync(join(repo, 'a.ts'), 'export const a = 999\n')
    const result = await build(snapshot(), params)

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.input.contextFiles.map((f) => f.path)).toContain('a.ts')
    expect(result.input.contextFiles.map((f) => f.path)).not.toContain(
      'CLAUDE.md',
    )
    expect(result.droppedContextFiles).toBeGreaterThan(0)
    expect(result.inputTokens).toBeLessThanOrEqual(MAX_INPUT_TOKENS)
  })

  it('reports no_changes when the working tree matches HEAD', async () => {
    const result = await build(snapshot(), params)
    expect(result.kind).toBe('no_changes')
  })

  it('diffs against a base ref when given', async () => {
    git('checkout', '-qb', 'feature')
    writeFileSync(join(repo, 'c.ts'), 'export const c = 1\n')
    git('add', '.')
    git('commit', '-qm', 'add c')
    const result = await build(snapshot(), { ...params, base: 'main' })

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.input.diff).toContain('export const c = 1')
  })
})
