import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { CaseSpec, EvalCase } from './cases.ts'
import type { ReviewParams } from './client.ts'

export const BASE_BRANCH = 'main'
// Not 'head': on a case-insensitive filesystem git cannot tell refs/heads/head
// from HEAD, and rev-parse --abbrev-ref HEAD comes back empty.
export const HEAD_BRANCH = 'feature'

const ISOLATED_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
}

export interface Fixture {
  root: string
  repo: string
  archive: string
  params: ReviewParams
  cleanup(): void
}

function git(repo: string, ...args: string[]): void {
  execFileSync('git', args, { cwd: repo, encoding: 'utf8', env: ISOLATED_ENV })
}

function writeTree(repo: string, files: ReadonlyMap<string, string>): void {
  for (const [path, content] of files) {
    const full = join(repo, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
}

function archiveTar(repo: string, archive: string): void {
  // --no-mac-metadata: bsdtar otherwise stores an AppleDouble `._*` entry beside
  // every file, and those land in the extracted tree the server reviews.
  const flags = process.platform === 'darwin' ? ['--no-mac-metadata'] : []
  execFileSync('tar', [...flags, '-czf', archive, '-C', repo, '.'])
}

export function reviewParams(spec: CaseSpec): ReviewParams {
  const language = spec.language ?? 'typescript'
  if (spec.mode === 'base') return { language, base: BASE_BRANCH }
  if (spec.mode === 'staged') return { language, staged: true }
  return { language }
}

export function createFixture(evalCase: EvalCase): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'exocortex-eval-'))
  const cleanup = () => rmSync(root, { recursive: true, force: true })
  const repo = join(root, 'repo')
  const archive = join(root, 'snapshot.tgz')

  try {
    mkdirSync(repo)
    git(repo, 'init', '-q', '-b', BASE_BRANCH)
    git(repo, 'config', 'user.email', 'evals@example.com')
    git(repo, 'config', 'user.name', 'exocortex evals')

    writeTree(repo, evalCase.baseFiles)
    git(repo, 'add', '-A')
    git(repo, 'commit', '-qm', 'base')

    if (evalCase.spec.mode === 'base') {
      git(repo, 'checkout', '-qb', HEAD_BRANCH)
    }

    writeTree(repo, evalCase.headFiles)
    for (const path of evalCase.spec.deletions ?? []) {
      rmSync(join(repo, path))
    }

    if (evalCase.spec.mode === 'base') {
      git(repo, 'add', '-A')
      git(repo, 'commit', '-qm', 'head')
    }
    if (evalCase.spec.mode === 'staged') {
      git(repo, 'add', '-A')
    }

    archiveTar(repo, archive)

    return { root, repo, archive, params: reviewParams(evalCase.spec), cleanup }
  } catch (cause) {
    cleanup()
    throw cause
  }
}
