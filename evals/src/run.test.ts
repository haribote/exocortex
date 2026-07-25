import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  composeConfigs,
  definedConfigs,
  parseOptions,
  requiredModels,
  resolveConfigs,
} from './run.ts'
import { type EvalConfig, loadConfigs } from './switch.ts'

const defined: EvalConfig[] = loadConfigs()
const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

function writeConfigsFile(configs: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'evals-configs-'))
  dirs.push(dir)
  const path = join(dir, 'configs.local.json')
  writeFileSync(path, JSON.stringify(configs))
  return path
}

describe('parseOptions', () => {
  it('leaves switching off by default', () => {
    expect(parseOptions([], {}).switchEnabled).toBe(false)
  })

  it('turns switching on with --switch', () => {
    expect(parseOptions(['--switch'], {}).switchEnabled).toBe(true)
  })

  it('turns switching on with EXOCORTEX_SWITCH=1', () => {
    expect(parseOptions([], { EXOCORTEX_SWITCH: '1' }).switchEnabled).toBe(true)
  })

  it('ignores any other value of EXOCORTEX_SWITCH', () => {
    expect(parseOptions([], { EXOCORTEX_SWITCH: '0' }).switchEnabled).toBe(
      false,
    )
    expect(parseOptions([], { EXOCORTEX_SWITCH: 'yes' }).switchEnabled).toBe(
      false,
    )
  })

  it('keeps the rest of the defaults', () => {
    const options = parseOptions([], {})

    expect(options.runId).toBe('default')
    expect(options.configs).toBeNull()
    expect(options.candidates).toBeNull()
    expect(options.configsFile).toBeNull()
    expect(options.caseIds).toBeNull()
    expect(options.repeats).toBe(1)
    expect(options.pull).toBe(false)
    expect(options.endpoint).toBe('http://localhost:11435')
  })

  it('reads the candidates as a list of model names', () => {
    const options = parseOptions(
      ['--switch', '--candidates', 'gemma4:26b, qwen3.5:27b'],
      {},
    )

    expect(options.candidates).toEqual(['gemma4:26b', 'qwen3.5:27b'])
  })

  it('refuses the switching options when switching is off', () => {
    expect(() => parseOptions(['--candidates', 'gemma4:26b'], {})).toThrow(
      /--candidates needs --switch/,
    )
    expect(() =>
      parseOptions(['--configs-file', 'configs.local.json'], {}),
    ).toThrow(/--configs-file needs --switch/)
    expect(() => parseOptions(['--pull'], {})).toThrow(/--pull needs --switch/)
  })

  it('accepts them once switching is on', () => {
    const options = parseOptions(['--candidates', 'gemma4:26b', '--pull'], {
      EXOCORTEX_SWITCH: '1',
    })

    expect(options.pull).toBe(true)
    expect(options.candidates).toEqual(['gemma4:26b'])
  })
})

describe('resolveConfigs without --switch', () => {
  // The label is not "default" on purpose: configs.json calls its baseline
  // "default", and results.ndjson is resumed on (configId, caseId, repeat).
  // One name for both would let "whatever the server happens to run" and
  // "gemma4:12b, pinned" collide inside a single --run.
  it('measures one config named current, touching nothing remote', () => {
    const configs = resolveConfigs(parseOptions([], {}), defined)

    expect(configs).toEqual([{ id: 'current', env: null }])
  })

  it('never resolves to the same id as the baseline in configs.json', () => {
    const label = resolveConfigs(parseOptions([], {}), defined)[0]?.id
    const baseline = resolveConfigs(parseOptions(['--switch'], {}), defined)[0]

    expect(label).toBe('current')
    expect(baseline?.id).toBe('default')
    expect(label).not.toBe(baseline?.id)
  })

  it('treats --configs as plain labels, not as configs.json ids', () => {
    const configs = resolveConfigs(
      parseOptions(['--configs', 'qwen3:14b,gemma4:12b'], {}),
      defined,
    )

    expect(configs).toEqual([
      { id: 'qwen3:14b', env: null },
      { id: 'gemma4:12b', env: null },
    ])
  })

  it('accepts a label that configs.json has never heard of', () => {
    expect(() =>
      resolveConfigs(
        parseOptions(['--configs', 'something-else'], {}),
        defined,
      ),
    ).not.toThrow()
  })

  it('gives every config a null env, which is what keeps the run local', () => {
    const configs = resolveConfigs(
      parseOptions(['--configs', 'a,b,c'], {}),
      defined,
    )

    expect(configs.every((config) => config.env === null)).toBe(true)
  })

  it('asks for no model, so nothing has to exist on the server', () => {
    const configs = resolveConfigs(
      parseOptions(['--configs', 'a,b'], {}),
      defined,
    )

    expect(requiredModels(configs)).toEqual([])
  })
})

describe('resolveConfigs with --switch', () => {
  it('runs every config in configs.json when none is named', () => {
    const configs = resolveConfigs(parseOptions(['--switch'], {}), defined)

    expect(configs).toEqual([
      { id: 'default', env: { REVIEW_MODEL: 'gemma4:12b' } },
    ])
  })

  it('narrows to the named configs, in the order given', () => {
    const extra: EvalConfig[] = [
      ...defined,
      {
        id: 'thinkless',
        env: { REVIEW_MODEL: 'gemma4:12b', REVIEW_THINK: 'false' },
      },
    ]
    const configs = resolveConfigs(
      parseOptions(['--switch', '--configs', 'thinkless,default'], {}),
      extra,
    )

    expect(configs.map((config) => config.id)).toEqual(['thinkless', 'default'])
  })

  it('refuses an id that no config defines', () => {
    expect(() =>
      resolveConfigs(
        parseOptions(['--switch', '--configs', 'nope'], {}),
        defined,
      ),
    ).toThrow(/no such config/)
  })
})

describe('composeConfigs', () => {
  const baseline: EvalConfig = {
    id: 'default',
    env: { REVIEW_MODEL: 'gemma4:12b' },
  }

  it('measures the baseline first and only once', () => {
    const configs = composeConfigs(
      [baseline],
      [],
      ['gemma4:26b', 'qwen3.5:27b'],
    )

    expect(configs.map((config) => config.id)).toEqual([
      'default',
      'gemma4:26b',
      'qwen3.5:27b',
    ])
    expect(configs.filter((config) => config.id === 'default')).toHaveLength(1)
  })

  it('turns a candidate into a config that only sets REVIEW_MODEL', () => {
    const configs = composeConfigs([baseline], [], ['gemma4:26b'])

    expect(configs[1]).toEqual({
      id: 'gemma4:26b',
      env: { REVIEW_MODEL: 'gemma4:26b' },
    })
  })

  it('keeps a baseline defined by the configs file, without measuring two', () => {
    const fromFile: EvalConfig[] = [
      { id: 'default', env: { REVIEW_MODEL: 'gemma4:26b' } },
      {
        id: 'thinkless',
        env: { REVIEW_MODEL: 'gemma4:26b', REVIEW_THINK: 'false' },
      },
    ]
    const configs = composeConfigs([baseline], fromFile, [])

    expect(configs.map((config) => config.id)).toEqual(['default', 'thinkless'])
    expect(configs[0]?.env).toEqual({ REVIEW_MODEL: 'gemma4:26b' })
  })

  it('still puts the baseline first when the file defines other configs only', () => {
    const configs = composeConfigs(
      [baseline],
      [
        {
          id: 'thinkless',
          env: { REVIEW_MODEL: 'gemma4:12b', REVIEW_THINK: 'false' },
        },
      ],
      ['gemma4:26b'],
    )

    expect(configs.map((config) => config.id)).toEqual([
      'default',
      'thinkless',
      'gemma4:26b',
    ])
  })

  it('drops a candidate that a config of the same id already covers', () => {
    const configs = composeConfigs([baseline], [], ['default'])

    expect(configs.map((config) => config.id)).toEqual(['default'])
    expect(configs[0]?.env).toEqual({ REVIEW_MODEL: 'gemma4:12b' })
  })

  it('measures whatever else configs.json defines', () => {
    const configs = composeConfigs(
      [baseline, { id: 'prefix', env: { REVIEW_SYSTEM_MODE: 'prefix' } }],
      [],
      [],
    )

    expect(configs.map((config) => config.id)).toEqual(['default', 'prefix'])
  })
})

describe('definedConfigs', () => {
  it('defines nothing without --switch, so configs stay labels', () => {
    expect(definedConfigs(parseOptions([], {}))).toEqual([])
  })

  it('reads the repository baseline plus the candidates', () => {
    const configs = definedConfigs(
      parseOptions(['--switch', '--candidates', 'gemma4:26b'], {}),
    )

    expect(configs.map((config) => config.id)).toEqual([
      'default',
      'gemma4:26b',
    ])
  })

  it('merges a configs file with the candidates', () => {
    const path = writeConfigsFile([
      {
        id: 'thinkless',
        env: { REVIEW_MODEL: 'gemma4:12b', REVIEW_THINK: 'false' },
      },
    ])
    const configs = definedConfigs(
      parseOptions(
        ['--switch', '--configs-file', path, '--candidates', 'gemma4:26b'],
        {},
      ),
    )

    expect(configs.map((config) => config.id)).toEqual([
      'default',
      'thinkless',
      'gemma4:26b',
    ])
  })

  it('lets the configs file own the baseline', () => {
    const path = writeConfigsFile([
      { id: 'default', env: { REVIEW_MODEL: 'qwen3.5:27b' } },
    ])
    const configs = definedConfigs(
      parseOptions(['--switch', '--configs-file', path], {}),
    )

    expect(configs).toEqual([
      { id: 'default', env: { REVIEW_MODEL: 'qwen3.5:27b' } },
    ])
  })

  it('says which file is missing instead of failing on a read', () => {
    expect(() =>
      definedConfigs(
        parseOptions(['--switch', '--configs-file', '/nope/configs.json'], {}),
      ),
    ).toThrow(/no such configs file/)
  })
})

describe('requiredModels', () => {
  it('collects every REVIEW_MODEL once, in the order measured', () => {
    const options = parseOptions(
      ['--switch', '--candidates', 'gemma4:26b,gemma4:12b,qwen3.5:27b'],
      {},
    )
    const configs = resolveConfigs(options, definedConfigs(options))

    expect(requiredModels(configs)).toEqual([
      'gemma4:12b',
      'gemma4:26b',
      'qwen3.5:27b',
    ])
  })

  it('ignores a config that sets no model', () => {
    expect(
      requiredModels([{ id: 'prefix', env: { REVIEW_SYSTEM_MODE: 'x' } }]),
    ).toEqual([])
  })
})
