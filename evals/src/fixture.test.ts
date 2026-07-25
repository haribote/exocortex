import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { type EvalCase, loadCases } from './cases.ts'
import { createFixture, type Fixture } from './fixture.ts'

const cases = loadCases()
const opened: Fixture[] = []

function open(id: string): Fixture {
  const evalCase = cases.find((candidate) => candidate.spec.id === id)
  if (!evalCase) throw new Error(`no such case: ${id}`)
  const fixture = createFixture(evalCase)
  opened.push(fixture)
  return fixture
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' })
}

function snapshotDir(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const path = join(entry.parentPath, entry.name)
      return `${relative(dir, path)} ${readFileSync(path, 'utf8')}`
    })
    .sort()
}

afterEach(() => {
  while (opened.length > 0) opened.pop()?.cleanup()
})

describe('createFixture', () => {
  it('builds the repo under the OS temp directory and nowhere else', () => {
    const fixture = open('logic-inversion-01')
    const inside = relative(realpathSync(tmpdir()), realpathSync(fixture.repo))

    expect(isAbsolute(inside)).toBe(false)
    expect(inside.startsWith('..')).toBe(false)
  })

  it('takes only the case, so no caller can aim it at an existing repo', () => {
    expect(createFixture.length).toBe(1)
  })

  it('leaves the case source directory byte for byte unchanged', () => {
    const evalCase = cases[0] as EvalCase
    const before = snapshotDir(evalCase.dir)
    open(evalCase.spec.id)

    expect(snapshotDir(evalCase.dir)).toEqual(before)
  })

  it('removes the temp tree on cleanup', () => {
    const fixture = open('clean-refactor-01')
    const root = fixture.root
    fixture.cleanup()
    opened.pop()

    expect(existsSync(root)).toBe(false)
  })

  it('writes a snapshot tarball that holds the repo root, .git included', () => {
    const fixture = open('logic-inversion-01')
    const entries = execFileSync('tar', ['tzf', fixture.archive], {
      encoding: 'utf8',
    }).split('\n')

    expect(entries).toContain('./src/cart.ts')
    expect(entries.some((entry) => entry.startsWith('./.git/'))).toBe(true)
    expect(entries.filter((entry) => entry.includes('/._'))).toEqual([])
  })

  it('leaves the working tree equal to the case tree', () => {
    const fixture = open('convention-nondeterminism-01')
    const evalCase = cases.find(
      (candidate) => candidate.spec.id === 'convention-nondeterminism-01',
    ) as EvalCase

    for (const [path, content] of evalCase.treeFiles) {
      expect(readFileSync(join(fixture.repo, path), 'utf8'), path).toBe(content)
    }
  })
})

describe('the diff the server will collect', () => {
  it('diffs a base-mode case against the base branch', () => {
    const fixture = open('logic-inversion-01')

    expect(fixture.params).toEqual({ language: 'typescript', base: 'main' })
    expect(git(fixture.repo, 'diff', '--name-only', 'main...HEAD')).toBe(
      'src/cart.ts\nsrc/config.ts\n',
    )
    expect(git(fixture.repo, 'diff', 'main...HEAD')).toContain(
      '+  if (amount <= FREE_SHIPPING_THRESHOLD) {',
    )
  })

  it('diffs a worktree-mode case against HEAD, leaving it uncommitted', () => {
    const fixture = open('dataflow-stale-value-01')

    expect(fixture.params).toEqual({ language: 'typescript' })
    expect(git(fixture.repo, 'diff', '--name-only', 'HEAD')).toBe(
      'src/invoice.ts\n',
    )
    expect(git(fixture.repo, 'diff', 'HEAD')).toContain(
      '+  return convertToJpy(order.amount, order.currency)',
    )
    expect(git(fixture.repo, 'status', '--porcelain')).toContain(
      '?? src/discount.ts',
    )
  })

  it('diffs a staged-mode case against the index', () => {
    const fixture = open('convention-nondeterminism-01')

    expect(fixture.params).toEqual({ language: 'typescript', staged: true })
    expect(git(fixture.repo, 'diff', '--name-only', '--cached')).toBe(
      'src/sim/walk.ts\n',
    )
    expect(git(fixture.repo, 'diff', '--cached')).toContain(
      '+    const noise = Math.random() * jitter',
    )
  })

  it('shows a deletion when the case lists one', () => {
    const source = cases.find(
      (candidate) => candidate.spec.id === 'logic-inversion-01',
    ) as EvalCase
    const withDeletion: EvalCase = {
      ...source,
      spec: { ...source.spec, mode: 'worktree', deletions: ['src/config.ts'] },
      headFiles: new Map(),
      treeFiles: new Map(
        [...source.baseFiles].filter(([path]) => path !== 'src/config.ts'),
      ),
      expected: [],
    }
    const fixture = createFixture(withDeletion)
    opened.push(fixture)

    expect(existsSync(join(fixture.repo, 'src/config.ts'))).toBe(false)
    expect(git(fixture.repo, 'diff', '--name-only', 'HEAD')).toBe(
      'src/config.ts\n',
    )
  })

  it('ignores the runner git config so the fixture is reproducible', () => {
    const fixture = open('clean-refactor-01')

    expect(git(fixture.repo, 'config', 'user.email')).toBe(
      'evals@example.com\n',
    )
    expect(git(fixture.repo, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe(
      'feature\n',
    )
  })
})
