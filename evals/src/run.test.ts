import { describe, expect, it } from 'vitest'
import { parseOptions, resolveConfigs } from './run.ts'
import { type EvalConfig, loadConfigs } from './switch.ts'

const defined: EvalConfig[] = loadConfigs()

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
    expect(options.caseIds).toBeNull()
    expect(options.repeats).toBe(1)
    expect(options.endpoint).toBe('http://localhost:11435')
  })
})

describe('resolveConfigs without --switch', () => {
  it('measures one config named default, touching nothing remote', () => {
    const configs = resolveConfigs(parseOptions([], {}), defined)

    expect(configs).toEqual([{ id: 'default', env: null }])
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
})

describe('resolveConfigs with --switch', () => {
  it('runs every config in configs.json when none is named', () => {
    const configs = resolveConfigs(parseOptions(['--switch'], {}), defined)

    expect(configs.map((config) => config.id)).toEqual([
      'C0',
      'C0p',
      'C1',
      'C2',
      'C3',
      'C4',
    ])
    expect(configs[2]?.env).toEqual({
      REVIEW_MODEL: 'gemma4:12b',
      REVIEW_SYSTEM_MODE: 'prefix',
      REVIEW_THINK_PREFIX: '<|think|>',
    })
  })

  it('narrows to the named configs, in the order given', () => {
    const configs = resolveConfigs(
      parseOptions(['--switch', '--configs', 'C2,C0'], {}),
      defined,
    )

    expect(configs.map((config) => config.id)).toEqual(['C2', 'C0'])
  })

  it('refuses an id that configs.json does not define', () => {
    expect(() =>
      resolveConfigs(
        parseOptions(['--switch', '--configs', 'C9'], {}),
        defined,
      ),
    ).toThrow(/no such config/)
  })
})
