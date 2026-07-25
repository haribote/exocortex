import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { type EvalCase, loadCases } from './cases.ts'
import { callReview, DEFAULT_ENDPOINT, DEFAULT_TIMEOUT_MS } from './client.ts'
import { createFixture } from './fixture.ts'
import { parseResults, RUNS_DIR, type RunRecord } from './report.ts'
import { scoreOutcome } from './score.ts'
import {
  applyConfig,
  type EvalConfig,
  loadConfigs,
  remoteTarget,
  renderEnvironmentEntry,
  sshRunner,
  type WarmUpResult,
  waitForHealth,
} from './switch.ts'

export const DEFAULT_HEALTH_TIMEOUT_MS = 180_000

export interface RunOptions {
  runId: string
  configs: string[] | null
  caseIds: string[] | null
  repeats: number
  endpoint: string
  timeoutMs: number
  switchEnabled: boolean
  healthTimeoutMs: number
}

export interface ResolvedConfig {
  id: string
  env: Record<string, string> | null
}

function list(value: string | undefined): string[] | null {
  if (value === undefined) return null
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

export function parseOptions(
  argv: readonly string[],
  env: Record<string, string | undefined> = process.env,
): RunOptions {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      run: { type: 'string', default: 'default' },
      configs: { type: 'string' },
      cases: { type: 'string' },
      repeats: { type: 'string', default: '1' },
      endpoint: { type: 'string', default: DEFAULT_ENDPOINT },
      timeout: { type: 'string', default: String(DEFAULT_TIMEOUT_MS) },
      switch: { type: 'boolean', default: false },
      'health-timeout': {
        type: 'string',
        default: String(DEFAULT_HEALTH_TIMEOUT_MS),
      },
    },
  })

  const repeats = Number(values.repeats)
  if (!Number.isInteger(repeats) || repeats < 1) {
    throw new Error(`--repeats must be a positive integer: ${values.repeats}`)
  }

  return {
    runId: values.run as string,
    configs: list(values.configs),
    caseIds: list(values.cases),
    repeats,
    endpoint: values.endpoint as string,
    timeoutMs: Number(values.timeout),
    switchEnabled: values.switch === true || env.EXOCORTEX_SWITCH === '1',
    healthTimeoutMs: Number(values['health-timeout']),
  }
}

// Without --switch the harness never touches the server: configs stay plain
// labels and a mismatched model is only a warning, as it was before switching
// existed. Restarting a production service is opt-in.
export function resolveConfigs(
  options: RunOptions,
  defined: readonly EvalConfig[],
): ResolvedConfig[] {
  if (!options.switchEnabled) {
    return (options.configs ?? ['default']).map((id) => ({ id, env: null }))
  }

  if (options.configs === null) {
    return defined.map((config) => ({ id: config.id, env: config.env }))
  }

  return options.configs.map((id) => {
    const found = defined.find((config) => config.id === id)
    if (!found) {
      throw new Error(
        `no such config in configs.json: ${id} (have ${defined.map((config) => config.id).join(', ')})`,
      )
    }
    return { id: found.id, env: found.env }
  })
}

function selectCases(options: RunOptions): EvalCase[] {
  const all = loadCases()
  if (!options.caseIds) return all

  return options.caseIds.map((id) => {
    const found = all.find((evalCase) => evalCase.spec.id === id)
    if (!found) throw new Error(`no such case: ${id}`)
    return found
  })
}

function doneKey(configId: string, caseId: string, repeat: number): string {
  return [configId, caseId, repeat].join('\t')
}

function readDone(resultsPath: string): Set<string> {
  if (!existsSync(resultsPath)) return new Set()
  const records = parseResults(readFileSync(resultsPath, 'utf8'))
  return new Set(
    records.map((record) =>
      doneKey(record.configId, record.caseId, record.repeat),
    ),
  )
}

async function measure(
  options: RunOptions,
  configId: string,
  evalCase: EvalCase,
  repeat: number,
): Promise<RunRecord> {
  const fixture = createFixture(evalCase)
  try {
    const outcome = await callReview({
      archive: fixture.archive,
      params: fixture.params,
      endpoint: options.endpoint,
      timeoutMs: options.timeoutMs,
    })
    const score = scoreOutcome(
      { files: evalCase.treeFiles, expected: evalCase.expected },
      outcome,
    )
    const record: RunRecord = {
      runId: options.runId,
      configId,
      caseId: evalCase.spec.id,
      repeat,
      startedAt: new Date().toISOString(),
      model: outcome.response?.meta.model ?? null,
      summary: outcome.response?.summary ?? null,
      comments: outcome.response?.comments ?? [],
      score,
    }
    if (!score.schemaOk) record.body = outcome.body
    return record
  } finally {
    fixture.cleanup()
  }
}

async function warmUp(
  options: RunOptions,
  evalCase: EvalCase,
): Promise<WarmUpResult> {
  const fixture = createFixture(evalCase)
  try {
    const outcome = await callReview({
      archive: fixture.archive,
      params: fixture.params,
      endpoint: options.endpoint,
      timeoutMs: options.timeoutMs,
    })
    return {
      model: outcome.response?.meta.model ?? null,
      wallMs: outcome.wallMs,
      status: outcome.status,
    }
  } finally {
    fixture.cleanup()
  }
}

// The first request after a switch pays for loading the model into VRAM, so its
// result is thrown away rather than recorded alongside the measured ones.
async function prepare(
  options: RunOptions,
  config: ResolvedConfig,
  warmUpCase: EvalCase,
  environmentPath: string,
): Promise<boolean> {
  if (config.env === null) return true

  const entry = await applyConfig(
    { id: config.id, env: config.env },
    remoteTarget(),
    {
      runner: sshRunner,
      waitForHealth: () =>
        waitForHealth({
          endpoint: options.endpoint,
          timeoutMs: options.healthTimeoutMs,
        }),
      warmUp: () => warmUp(options, warmUpCase),
      now: () => new Date(),
    },
  )

  appendFileSync(environmentPath, renderEnvironmentEntry(entry))
  console.log(`${config.id}: switch ${entry.status}`)

  if (entry.status !== 'ok') {
    console.error(`${config.id}: skipped, ${entry.note ?? entry.status}`)
    process.exitCode = 1
    return false
  }
  return true
}

function describe(record: RunRecord): string {
  const score = record.score
  return [
    `${record.configId} ${record.caseId} #${record.repeat}`,
    `status=${score.status}`,
    `comments=${score.comments}`,
    `quote=${score.quoteMatches}/${score.comments}`,
    `hit@±2=${score.hitNear2}/${score.expectedTotal}`,
    `unmatched=${score.unmatchedComments}`,
    `wall=${(score.wallMs / 1000).toFixed(1)}s`,
  ].join(' ')
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))
  const cases = selectCases(options)
  const warmUpCase = cases[0]
  if (warmUpCase === undefined) throw new Error('no cases selected')

  const configs = resolveConfigs(
    options,
    options.switchEnabled ? loadConfigs() : [],
  )
  const dir = join(RUNS_DIR, options.runId)
  mkdirSync(dir, { recursive: true })

  const resultsPath = join(dir, 'results.ndjson')
  const environmentPath = join(dir, 'environment.md')
  const done = readDone(resultsPath)

  for (const config of configs) {
    const configId = config.id
    const expectedModel = config.env?.REVIEW_MODEL ?? configId

    if (!(await prepare(options, config, warmUpCase, environmentPath))) {
      continue
    }

    for (const evalCase of cases) {
      for (let repeat = 1; repeat <= options.repeats; repeat++) {
        const key = doneKey(configId, evalCase.spec.id, repeat)
        if (done.has(key)) {
          console.log(`skip ${key.replaceAll('\t', ' ')} (already recorded)`)
          continue
        }

        let record: RunRecord
        try {
          record = await measure(options, configId, evalCase, repeat)
        } catch (cause) {
          console.error(
            `transport failure on ${key.replaceAll('\t', ' ')}: ${String(cause)}`,
          )
          console.error(
            `nothing was recorded for it. fix the tunnel and re-run with --run ${options.runId} to resume.`,
          )
          process.exitCode = 1
          return
        }

        if (record.model !== null && record.model !== expectedModel) {
          console.warn(
            `warning: config ${configId} but the server reported model ${record.model}`,
          )
        }

        appendFileSync(resultsPath, `${JSON.stringify(record)}\n`)
        done.add(key)
        console.log(describe(record))
      }
    }
  }

  console.log(`results are in ${resultsPath}`)
}

if (process.argv[1] === import.meta.filename) {
  await main()
}
