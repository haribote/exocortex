import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CASES_DIR, countAnchors, findAnchorLine, loadCases } from './cases.ts'

const cases = loadCases()

describe('loadCases', () => {
  it('loads every case directory under cases/', () => {
    const dirs = readdirSync(CASES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    expect(cases.map((evalCase) => evalCase.spec.id)).toEqual(dirs)
  })

  it('covers the planned distribution of categories', () => {
    const counts: Record<string, number> = {}
    for (const evalCase of cases) {
      counts[evalCase.spec.category] = (counts[evalCase.spec.category] ?? 0) + 1
    }
    expect(counts).toEqual({
      logic: 2,
      dataflow: 2,
      convention: 2,
      'error-handling': 2,
      concurrency: 2,
      resource: 2,
      clean: 6,
      size: 2,
    })
  })

  it('keeps the planted bugs and the false positive probes balanced', () => {
    const planted = cases.filter(
      (evalCase) => !evalCase.spec.clean && evalCase.spec.category !== 'size',
    )
    const clean = cases.filter((evalCase) => evalCase.spec.clean)
    expect(planted).toHaveLength(12)
    expect(clean).toHaveLength(6)
  })

  it('exercises all three review modes', () => {
    const modes = new Set(cases.map((evalCase) => evalCase.spec.mode))
    expect([...modes].sort()).toEqual(['base', 'staged', 'worktree'])
  })

  it('gives every case a head tree that differs from its base tree', () => {
    for (const evalCase of cases) {
      expect(evalCase.headFiles.size, evalCase.spec.id).toBeGreaterThan(0)
    }
  })

  it('marks a case clean exactly when it expects no finding', () => {
    for (const evalCase of cases) {
      expect(evalCase.spec.clean, evalCase.spec.id).toBe(
        evalCase.expected.length === 0,
      )
    }
  })

  it('overlays head onto base to build the working tree', () => {
    const convention = cases.find(
      (evalCase) => evalCase.spec.id === 'convention-nondeterminism-01',
    )
    expect(convention?.treeFiles.get('CLAUDE.md')).toContain('Math.random()')
    expect(convention?.treeFiles.get('src/sim/walk.ts')).toBe(
      convention?.headFiles.get('src/sim/walk.ts'),
    )
  })
})

describe('fixture sources', () => {
  it('stores every fixture source with a .txt extension', () => {
    const entries = readdirSync(CASES_DIR, {
      recursive: true,
      withFileTypes: true,
    })
    const offenders = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => name !== 'case.json' && !name.endsWith('.txt'))

    expect(offenders).toEqual([])
  })
})

describe('anchors', () => {
  it('resolves every anchor to exactly one line of the file it names', () => {
    for (const evalCase of cases) {
      for (const expected of evalCase.expected) {
        const content = evalCase.treeFiles.get(expected.file)
        const where = `${evalCase.spec.id}/${expected.id}`

        expect(
          content,
          `${where}: ${expected.file} is not in the tree`,
        ).toBeDefined()
        expect(countAnchors(content ?? '', expected.anchor), where).toBe(1)
      }
    }
  })

  it('points each resolved line at the anchor text', () => {
    for (const evalCase of cases) {
      for (const expected of evalCase.expected) {
        const content = evalCase.treeFiles.get(expected.file) ?? ''
        const line = content.split('\n')[expected.line - 1]

        expect(line?.trim(), `${evalCase.spec.id}/${expected.id}`).toBe(
          expected.anchor.trim(),
        )
      }
    }
  })
})

describe('findAnchorLine', () => {
  const content = 'const a = 1\n  const b = 2\nconst c = 3\n'

  it('returns a 1-based line number', () => {
    expect(findAnchorLine(content, 'const a = 1')).toBe(1)
    expect(findAnchorLine(content, 'const c = 3')).toBe(3)
  })

  it('ignores indentation on both sides', () => {
    expect(findAnchorLine(content, 'const b = 2')).toBe(2)
  })

  it('throws when the anchor is nowhere in the file', () => {
    expect(() => findAnchorLine(content, 'const z = 9')).toThrow(/0 times/)
  })

  it('throws when the anchor is not unique', () => {
    expect(() => findAnchorLine('x\nx\n', 'x')).toThrow(/2 times/)
  })
})
