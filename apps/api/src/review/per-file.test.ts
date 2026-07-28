import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { MAX_INPUT_TOKENS, reviewStreamLineSchema } from '@exocortex/contract'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type {
  OllamaChatOptions,
  OllamaChatRequest,
  OllamaChatResult,
} from '../ollama.js'
import {
  OllamaResponseError,
  OllamaStreamError,
  OllamaTimeoutError,
  OllamaUnreachableError,
} from '../ollama.js'
import {
  createBuildPerFilePlan,
  PER_FILE_REQUEST_TIMEOUT_MS,
  type PerFilePlan,
  type PerFileTarget,
  runPerFileReview,
} from './per-file.js'

const CONTENT = 'const a = 1\n'

function target(path: string): PerFileTarget {
  return {
    kind: 'ok',
    path,
    input: {
      language: 'typescript',
      diff: `diff --git a/${path} b/${path}`,
      rules: [],
      contextFiles: [{ path, content: CONTENT }],
    },
    inputTokens: 42,
    droppedContextFiles: 0,
  }
}

function plan(targets: PerFileTarget[], skipped = 0): PerFilePlan {
  return { targets, skipped }
}

function modelJson(file: string, quote = 'const a = 1'): string {
  return JSON.stringify({
    summary: `reviewed ${file}`,
    comments: [{ severity: 'major', file, line: 1, quote, message: 'm' }],
  })
}

function ok(content: string): OllamaChatResult {
  return { content, totalDurationMs: 1 }
}

interface Recorder {
  lines: string[]
  aborted: boolean
  writeln(line: string): Promise<unknown>
}

function recorder(): Recorder {
  return {
    lines: [],
    aborted: false,
    async writeln(line: string) {
      this.lines.push(line)
      return undefined
    },
  }
}

type ChatHandler = (
  request: OllamaChatRequest,
  options?: OllamaChatOptions,
) => Promise<OllamaChatResult>

function ollamaOf(handler: ChatHandler) {
  return { chat: handler }
}

function replying(...results: (OllamaChatResult | Error)[]) {
  let index = 0
  return ollamaOf(async () => {
    const next = results[index++]
    if (next instanceof Error) throw next
    if (next === undefined)
      throw new Error('ollama called more times than set up')
    return next
  })
}

async function run(
  targets: PerFileTarget[],
  ollama: { chat: ChatHandler },
  extra: { skipped?: number; stream?: Recorder } = {},
) {
  const stream = extra.stream ?? recorder()
  await runPerFileReview(
    plan(targets, extra.skipped ?? 0),
    { ollama, model: 'gemma4:12b' },
    stream,
  )
  return stream
}

function parsed(stream: Recorder): Record<string, unknown>[] {
  return stream.lines.map((line) => JSON.parse(line) as Record<string, unknown>)
}

describe('runPerFileReview', () => {
  it('writes one result line per file and a done line last', async () => {
    const stream = await run(
      [target('a.ts'), target('b.ts')],
      replying(ok(modelJson('a.ts')), ok(modelJson('b.ts'))),
    )

    const lines = parsed(stream)
    expect(lines).toHaveLength(3)
    expect(lines[0]?.file).toBe('a.ts')
    expect(lines[1]?.file).toBe('b.ts')
    expect(lines[2]).toEqual({
      done: true,
      meta: {
        model: 'gemma4:12b',
        reviewed: 2,
        skipped: 0,
        failed: 0,
        durationMs: expect.any(Number),
      },
    })
  })

  it('emits lines the contract can parse', async () => {
    const stream = await run(
      [target('a.ts'), target('b.ts')],
      replying(ok(modelJson('a.ts')), new OllamaStreamError('stream ended')),
    )

    for (const line of stream.lines) {
      expect(reviewStreamLineSchema.safeParse(JSON.parse(line)).success).toBe(
        true,
      )
    }
  })

  // The whole point of splitting the review: one file coming apart must not
  // take the files that already succeeded with it.
  it('keeps going after a file fails and counts it', async () => {
    const stream = await run(
      [target('a.ts'), target('b.ts'), target('c.ts')],
      replying(
        ok(modelJson('a.ts')),
        new OllamaStreamError('ollama stream ended before completion'),
        ok(modelJson('c.ts')),
      ),
    )

    const lines = parsed(stream)
    expect(lines[0]?.file).toBe('a.ts')
    expect(lines[1]).toEqual({
      file: 'b.ts',
      error: 'ollama_error',
      message: 'ollama stream ended before completion',
    })
    expect(lines[2]?.file).toBe('c.ts')
    expect(lines[3]?.meta).toMatchObject({ reviewed: 2, failed: 1 })
  })

  // A timeout here means the thinking ran away on this one file, not that the
  // server is wedged, so the run goes on to the next file.
  it('treats a timeout as this file failing rather than the run', async () => {
    const stream = await run(
      [target('a.ts'), target('b.ts')],
      replying(new OllamaTimeoutError('timed out'), ok(modelJson('b.ts'))),
    )

    const lines = parsed(stream)
    expect(lines[0]).toEqual({
      file: 'a.ts',
      error: 'inference_timeout',
      message: 'ollama did not respond in time',
    })
    expect(lines[1]?.file).toBe('b.ts')
    expect(lines[2]?.meta).toMatchObject({ reviewed: 1, failed: 1 })
  })

  // Absence of the done line is what tells the client the remaining files were
  // never attempted, so there must not be one.
  it('stops without a done line when ollama is unreachable', async () => {
    let calls = 0
    const ollama = ollamaOf(async () => {
      calls += 1
      throw new OllamaUnreachableError('could not reach ollama')
    })
    const stream = await run([target('a.ts'), target('b.ts')], ollama)

    const lines = parsed(stream)
    expect(calls).toBe(1)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toEqual({
      file: 'a.ts',
      error: 'ollama_unreachable',
      message: 'could not reach ollama',
    })
  })

  // A done line saying reviewed=0 is indistinguishable from a clean review to a
  // client that reads the result lines and stops there, so a run that reviewed
  // nothing at all has to say so as an error.
  it('ends with a run error instead of a done line when every file failed', async () => {
    const stream = await run(
      [target('a.ts'), target('b.ts')],
      replying(
        new OllamaTimeoutError('timed out'),
        new OllamaStreamError('stream ended'),
      ),
    )

    const lines = parsed(stream)
    expect(lines).toHaveLength(3)
    expect(lines[2]).toEqual({
      error: 'all_files_failed',
      message: 'every file in the run failed to review',
    })
    expect(stream.lines.some((line) => line.includes('"done"'))).toBe(false)
    expect(
      reviewStreamLineSchema.safeParse(JSON.parse(stream.lines[2] ?? '')).success,
    ).toBe(true)
  })

  // Nothing failing and nothing being reviewed is a run with no work in it, and
  // that is the one honest empty review.
  it('keeps the done line when the plan targeted nothing', async () => {
    const stream = await run([], replying(), { skipped: 3 })

    const lines = parsed(stream)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      done: true,
      meta: { reviewed: 0, skipped: 3, failed: 0 },
    })
  })

  it('reports a response error from ollama as ollama_error', async () => {
    const stream = await run(
      [target('a.ts')],
      replying(new OllamaResponseError('model not found', 404)),
    )
    expect(parsed(stream)[0]).toMatchObject({
      error: 'ollama_error',
      message: 'model not found',
    })
  })

  it('reports a truncated generation as context_exhausted', async () => {
    const stream = await run(
      [target('a.ts')],
      replying({ ...ok('{"summary":"s"'), doneReason: 'length' }),
    )
    expect(parsed(stream)[0]).toMatchObject({
      file: 'a.ts',
      error: 'context_exhausted',
    })
  })

  it('reports unparseable output as invalid_model_output', async () => {
    const stream = await run([target('a.ts')], replying(ok('not json')))
    expect(parsed(stream)[0]).toMatchObject({
      file: 'a.ts',
      error: 'invalid_model_output',
      message: 'model did not return valid json',
    })
  })

  it('reports output that misses the schema as invalid_model_output', async () => {
    const stream = await run(
      [target('a.ts')],
      replying(ok(JSON.stringify({ summary: 's' }))),
    )
    expect(parsed(stream)[0]).toMatchObject({
      file: 'a.ts',
      error: 'invalid_model_output',
    })
  })

  it('reports a file whose own diff exceeds the budget without calling ollama', async () => {
    let calls = 0
    const ollama = ollamaOf(async () => {
      calls += 1
      return ok(modelJson('a.ts'))
    })
    const stream = await run([{ kind: 'too_large', path: 'huge.ts' }], ollama)

    const lines = parsed(stream)
    expect(calls).toBe(0)
    expect(lines[0]).toMatchObject({
      file: 'huge.ts',
      error: 'context_too_large',
    })
    // The only file there was never got reviewed, so the run ends as an error
    // rather than as a done line with an empty review in it.
    expect(lines[1]).toMatchObject({ error: 'all_files_failed' })
  })

  it('carries the count of files the plan never targeted into the done line', async () => {
    const stream = await run(
      [target('a.ts')],
      replying(ok(modelJson('a.ts'))),
      {
        skipped: 9,
      },
    )
    expect(parsed(stream)[1]?.meta).toMatchObject({ skipped: 9 })
  })

  it('drops a comment whose quote is not in the file it names', async () => {
    const stream = await run(
      [target('a.ts')],
      replying(ok(modelJson('a.ts', 'const nope = 9'))),
    )

    const line = parsed(stream)[0]
    expect(line?.comments).toEqual([])
    expect(line?.meta).toMatchObject({ droppedComments: 1 })
  })

  it('gives ollama the per-file deadline rather than the whole-review one', async () => {
    let seen: OllamaChatOptions | undefined
    const ollama = ollamaOf(async (_request, options) => {
      seen = options
      return ok(modelJson('a.ts'))
    })
    await run([target('a.ts')], ollama)
    expect(seen?.requestTimeoutMs).toBe(PER_FILE_REQUEST_TIMEOUT_MS)
  })

  it('stops before the next file once the client goes away', async () => {
    const stream = recorder()
    let calls = 0
    const ollama = ollamaOf(async () => {
      calls += 1
      stream.aborted = true
      return ok(modelJson('a.ts'))
    })
    await run([target('a.ts'), target('b.ts')], ollama, { stream })

    expect(calls).toBe(1)
    expect(stream.lines.some((line) => line.includes('"done"'))).toBe(false)
  })

  it('writes heartbeats while a file is still being reviewed', async () => {
    const ollama = ollamaOf(
      () =>
        new Promise<OllamaChatResult>((resolve) => {
          setTimeout(() => resolve(ok(modelJson('a.ts'))), 30)
        }),
    )
    const stream = recorder()
    await runPerFileReview(
      plan([target('a.ts')]),
      { ollama, model: 'gemma4:12b', heartbeatMs: 5 },
      stream,
    )

    const beats = stream.lines.filter((line) => line.includes('heartbeat'))
    expect(beats.length).toBeGreaterThan(0)
    expect(JSON.parse(beats[0] as string)).toEqual({ heartbeat: true })
    expect(stream.lines[stream.lines.length - 1]).toContain('"done"')
  })
})

describe('createBuildPerFilePlan', () => {
  let repo: string

  const isolatedEnv = {
    ...process.env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
  }

  function git(...args: string[]): void {
    execFileSync('git', args, { cwd: repo, env: isolatedEnv })
  }

  function write(path: string, content: string): void {
    const full = join(repo, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }

  function snapshot(): Uint8Array {
    const archive = join(repo, '..', 'per-file-snapshot.tgz')
    execFileSync('tar', ['czf', archive, '-C', repo, '.'])
    return readFileSync(archive)
  }

  const params = {
    language: 'typescript',
    rules: [] as string[],
    mode: 'per-file' as const,
  }

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'exocortex-per-file-'))
    git('init', '-q', '-b', 'main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'test')
    write('a.ts', 'export const a = 1\n')
    write('b.ts', 'export const b = 1\n')
    git('add', '.')
    git('commit', '-qm', 'initial')
  })

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  const build = createBuildPerFilePlan()

  function paths(plan: PerFilePlan): string[] {
    return plan.targets.map((t) => t.path)
  }

  function contextOf(plan: PerFilePlan, path: string): string[] {
    const found = plan.targets.find((t) => t.path === path)
    if (found === undefined || found.kind !== 'ok') return []
    return found.input.contextFiles.map((f) => f.path)
  }

  it('makes one target per changed source file', async () => {
    write('a.ts', 'export const a = 999\n')
    write('b.ts', 'export const b = 999\n')
    const plan = await build(snapshot(), params)

    expect(plan.kind).toBe('ok')
    if (plan.kind !== 'ok') return
    expect(paths(plan)).toEqual(['a.ts', 'b.ts'])
  })

  it('gives each target only its own diff', async () => {
    write('a.ts', 'export const a = 999\n')
    write('b.ts', 'export const b = 888\n')
    const plan = await build(snapshot(), params)

    if (plan.kind !== 'ok') throw new Error('expected a plan')
    const first = plan.targets[0]
    if (first?.kind !== 'ok') throw new Error('expected an ok target')
    expect(first.input.diff).toContain('999')
    expect(first.input.diff).not.toContain('888')
  })

  // The change this whole mode turns on: whole-diff review put every changed
  // file into every prompt, and scoping to one file is what shrinks it.
  it('leaves an unrelated changed file out of a target context', async () => {
    write('a.ts', 'export const a = 999\n')
    write('b.ts', 'export const b = 888\n')
    const plan = await build(snapshot(), params)

    if (plan.kind !== 'ok') throw new Error('expected a plan')
    expect(contextOf(plan, 'a.ts')).toContain('a.ts')
    expect(contextOf(plan, 'a.ts')).not.toContain('b.ts')
  })

  it('still reaches a file the target imports', async () => {
    write('a.ts', "import { b } from './b.js'\nexport const a = b\n")
    const plan = await build(snapshot(), params)

    if (plan.kind !== 'ok') throw new Error('expected a plan')
    expect(contextOf(plan, 'a.ts')).toContain('b.ts')
  })

  it('skips a changed file the language does not cover and counts it', async () => {
    write('a.ts', 'export const a = 999\n')
    write('notes.md', '# notes\n')
    git('add', '.')
    const plan = await build(snapshot(), { ...params, staged: true })

    expect(plan.kind).toBe('ok')
    if (plan.kind !== 'ok') return
    expect(paths(plan)).toEqual(['a.ts'])
    expect(plan.skipped).toBe(1)
  })

  it('reports no_changes when the working tree matches HEAD', async () => {
    const plan = await build(snapshot(), params)
    expect(plan.kind).toBe('no_changes')
  })

  it('marks a file whose own diff exceeds the budget instead of dropping it', async () => {
    write('a.ts', `${'x'.repeat(MAX_INPUT_TOKENS * 3)}\n`)
    const plan = await build(snapshot(), params)

    if (plan.kind !== 'ok') throw new Error('expected a plan')
    expect(plan.targets).toEqual([{ kind: 'too_large', path: 'a.ts' }])
  })

  it('keeps each target within the input budget', async () => {
    write('a.ts', 'export const a = 999\n')
    const plan = await build(snapshot(), params)

    if (plan.kind !== 'ok') throw new Error('expected a plan')
    for (const t of plan.targets) {
      if (t.kind !== 'ok') continue
      expect(t.inputTokens).toBeLessThanOrEqual(MAX_INPUT_TOKENS)
    }
  })

  it('drops related docs when built with includeDocs false', async () => {
    write('design.md', 'a.ts settles payments\n')
    git('add', '.')
    git('commit', '-qm', 'docs')
    write('a.ts', 'export const a = 999\n')

    const withDocs = await build(snapshot(), params)
    const without = await createBuildPerFilePlan({ includeDocs: false })(
      snapshot(),
      params,
    )

    if (withDocs.kind !== 'ok' || without.kind !== 'ok') {
      throw new Error('expected plans')
    }
    expect(contextOf(withDocs, 'a.ts')).toContain('design.md')
    expect(contextOf(without, 'a.ts')).not.toContain('design.md')
  })
})
