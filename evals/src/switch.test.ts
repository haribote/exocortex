import { describe, expect, it } from 'vitest'
import {
  applyConfig,
  buildOllamaListScript,
  buildOllamaPsScript,
  buildOllamaPullScript,
  buildSwitchScript,
  DEFAULT_TARGET,
  type EvalConfig,
  ensureModelsAvailable,
  fullyOnGpu,
  loadConfigs,
  missingModels,
  parseOllamaList,
  type RemoteRunner,
  remoteTarget,
  renderEnvironmentEntry,
  type SwitchDeps,
  shellQuote,
  sshArgs,
  waitForHealth,
} from './switch.ts'

const thinky: EvalConfig = {
  id: 'thinky',
  env: { REVIEW_MODEL: 'gemma4:12b', REVIEW_THINK: 'true' },
}

// No knob carries a value like this today: "<|think|>" came from a setting that
// was measured to change nothing and then removed. It stays here as a fixture
// because it is made entirely of characters cmd.exe and bash would act on,
// which is exactly what the quoting has to survive.
const metacharacters: EvalConfig = {
  id: 'quoting',
  env: { REVIEW_MODEL: 'gemma4:12b', SHELL_PROBE: '<|think|>' },
}

function fakeDeps(overrides: Partial<SwitchDeps> = {}): SwitchDeps {
  return {
    runner: () => 'NAME ID SIZE PROCESSOR\ngemma4:12b abc 9 GB 100% GPU\n',
    waitForHealth: async () => {},
    warmUp: async () => ({ model: 'gemma4:12b', wallMs: 42_000, status: 200 }),
    now: () => new Date('2026-07-25T02:00:00.000Z'),
    ...overrides,
  }
}

describe('shellQuote', () => {
  it('wraps a value so the shell sees it literally', () => {
    expect(shellQuote('<|think|>')).toBe("'<|think|>'")
    expect(shellQuote('gemma4:12b')).toBe("'gemma4:12b'")
  })

  it('survives an embedded single quote', () => {
    expect(shellQuote("it's")).toBe("'it'\\''s'")
  })

  it('leaves a value that tries to break out inert', () => {
    expect(shellQuote("'; rm -rf / #")).toBe("''\\''; rm -rf / #'")
  })
})

describe('buildSwitchScript', () => {
  it('quotes every value, including one full of shell metacharacters', () => {
    expect(buildSwitchScript(metacharacters, DEFAULT_TARGET)).toBe(
      [
        'set -eu',
        "cd '/home/haribote/exocortex'",
        "REVIEW_MODEL='gemma4:12b' SHELL_PROBE='<|think|>' docker compose up -d 'ai-api'",
        '',
      ].join('\n'),
    )
  })

  it('orders assignments by name so the same config yields the same script', () => {
    const shuffled: EvalConfig = {
      id: 'quoting',
      env: { SHELL_PROBE: '<|think|>', REVIEW_MODEL: 'gemma4:12b' },
    }

    expect(buildSwitchScript(shuffled, DEFAULT_TARGET)).toBe(
      buildSwitchScript(metacharacters, DEFAULT_TARGET),
    )
  })

  it('refuses an environment variable name that is not a bare identifier', () => {
    const sneaky: EvalConfig = {
      id: 'bad',
      env: { 'A; rm -rf /': 'x' },
    }

    expect(() => buildSwitchScript(sneaky, DEFAULT_TARGET)).toThrow(
      /environment variable name/,
    )
  })

  it('reads the compose directory and service from the target', () => {
    const script = buildSwitchScript(
      { id: 'other', env: { REVIEW_MODEL: 'gemma4:12b' } },
      { ...DEFAULT_TARGET, composeDir: '/srv/app', service: 'api' },
    )

    expect(script).toContain("cd '/srv/app'")
    expect(script).toContain("docker compose up -d 'api'")
  })
})

describe('sshArgs', () => {
  it('sends the script over stdin, so no config value reaches a command line', () => {
    expect(sshArgs(DEFAULT_TARGET)).toEqual([
      'exocortex',
      'wsl -d exocortex -- bash -s',
    ])
  })

  it('builds a command line free of characters any shell would act on', () => {
    const line = sshArgs(DEFAULT_TARGET).join(' ')

    expect(line).not.toContain('<|think|>')
    expect(line).toMatch(/^[A-Za-z0-9 _.@:-]+$/)
  })

  it('refuses a host or distro that is not a bare token', () => {
    expect(() => sshArgs({ ...DEFAULT_TARGET, host: 'a b | c' })).toThrow(
      /ssh host/,
    )
    expect(() => sshArgs({ ...DEFAULT_TARGET, distro: 'a|b' })).toThrow(
      /wsl distro/,
    )
  })
})

describe('buildOllamaPsScript', () => {
  it('asks the ollama service what it has resident', () => {
    expect(buildOllamaPsScript(DEFAULT_TARGET)).toContain(
      'docker compose exec -T ollama ollama ps',
    )
  })
})

describe('remoteTarget', () => {
  it('falls back to the documented defaults', () => {
    expect(remoteTarget({})).toEqual(DEFAULT_TARGET)
  })

  it('takes every field from the environment', () => {
    expect(
      remoteTarget({
        EXOCORTEX_SSH_HOST: 'box',
        EXOCORTEX_WSL_DISTRO: 'ubuntu',
        EXOCORTEX_COMPOSE_DIR: '/srv/app',
        EXOCORTEX_API_SERVICE: 'api',
      }),
    ).toEqual({
      host: 'box',
      distro: 'ubuntu',
      composeDir: '/srv/app',
      service: 'api',
    })
  })
})

describe('loadConfigs', () => {
  const configs = loadConfigs()

  it('ships the baseline alone, so candidates are named by the caller', () => {
    expect(configs.map((config) => config.id)).toEqual(['default'])
  })

  it('points the baseline at the model the api defaults to', () => {
    expect(configs[0]?.env).toEqual({ REVIEW_MODEL: 'gemma4:12b' })
  })

  it('gives every config a REVIEW_MODEL to check against', () => {
    for (const config of configs) {
      expect(config.env.REVIEW_MODEL, config.id).toBeTypeOf('string')
    }
  })

  it('builds a usable script for every config', () => {
    for (const config of configs) {
      expect(() => buildSwitchScript(config, DEFAULT_TARGET)).not.toThrow()
    }
  })
})

describe('parseOllamaList', () => {
  const listing = [
    'NAME              ID              SIZE      MODIFIED',
    'gemma4:12b        1a2b3c4d5e6f    8.1 GB    2 days ago',
    'qwen3.5:27b       0f9e8d7c6b5a    17 GB     3 weeks ago',
    '',
  ].join('\n')

  it('keeps the names and drops the header', () => {
    expect(parseOllamaList(listing)).toEqual(['gemma4:12b', 'qwen3.5:27b'])
  })

  it('reads an empty library as an empty list', () => {
    expect(parseOllamaList('NAME ID SIZE MODIFIED\n')).toEqual([])
    expect(parseOllamaList('')).toEqual([])
  })
})

describe('missingModels', () => {
  it('is empty when the server has everything asked for', () => {
    expect(
      missingModels(['gemma4:12b'], ['gemma4:12b', 'qwen3.5:27b']),
    ).toEqual([])
  })

  it('names every model the server does not have, once', () => {
    expect(
      missingModels(
        ['gemma4:12b', 'gemma4:26b', 'qwen3.5:27b', 'gemma4:26b'],
        ['gemma4:12b'],
      ),
    ).toEqual(['gemma4:26b', 'qwen3.5:27b'])
  })

  it('reads a bare name as the latest tag, the way ollama does', () => {
    expect(missingModels(['gemma4'], ['gemma4:latest'])).toEqual([])
    expect(missingModels(['gemma4:latest'], ['gemma4'])).toEqual([])
    expect(missingModels(['gemma4'], ['gemma4:12b'])).toEqual(['gemma4'])
  })
})

describe('ensureModelsAvailable', () => {
  const library = 'NAME ID SIZE MODIFIED\ngemma4:12b abc 8.1 GB 2 days ago\n'

  function recordingRunner(output: string | ((script: string) => string)) {
    const scripts: string[] = []
    const runner: RemoteRunner = (_args, script) => {
      scripts.push(script)
      return typeof output === 'string' ? output : output(script)
    }
    return { scripts, runner }
  }

  it('asks the server nothing when no config pins a model', () => {
    const { scripts, runner } = recordingRunner(library)

    ensureModelsAvailable([], DEFAULT_TARGET, { runner, pull: false })

    expect(scripts).toEqual([])
  })

  it('returns quietly once every model is there', () => {
    const { scripts, runner } = recordingRunner(library)

    ensureModelsAvailable(['gemma4:12b'], DEFAULT_TARGET, {
      runner,
      pull: false,
    })

    expect(scripts).toHaveLength(1)
    expect(scripts[0]).toContain('ollama list')
  })

  it('names every missing model and pulls none of them without --pull', () => {
    const { scripts, runner } = recordingRunner(library)

    expect(() =>
      ensureModelsAvailable(
        ['gemma4:12b', 'gemma4:26b', 'qwen3.5:27b'],
        DEFAULT_TARGET,
        { runner, pull: false },
      ),
    ).toThrow(/gemma4:26b, qwen3\.5:27b/)

    expect(scripts.some((script) => script.includes('ollama pull'))).toBe(false)
    expect(scripts.some((script) => script.includes('docker compose up'))).toBe(
      false,
    )
  })

  it('tells the caller that --pull is the way to fetch them', () => {
    const { runner } = recordingRunner(library)

    expect(() =>
      ensureModelsAvailable(['gemma4:26b'], DEFAULT_TARGET, {
        runner,
        pull: false,
      }),
    ).toThrow(/--pull/)
  })

  it('fetches the missing models with --pull, then checks again', () => {
    let pulled = false
    const { scripts, runner } = recordingRunner((script) => {
      if (script.includes('ollama pull')) {
        pulled = true
        return ''
      }
      return pulled ? `${library}gemma4:26b def 17 GB just now\n` : library
    })

    ensureModelsAvailable(['gemma4:12b', 'gemma4:26b'], DEFAULT_TARGET, {
      runner,
      pull: true,
    })

    expect(scripts.filter((script) => script.includes('ollama pull'))).toEqual([
      [
        'set -eu',
        "cd '/home/haribote/exocortex'",
        "docker compose exec -T ollama ollama pull 'gemma4:26b' >/dev/null",
        '',
      ].join('\n'),
    ])
  })

  it('refuses to start when a pull left the model absent anyway', () => {
    const { runner } = recordingRunner(library)

    expect(() =>
      ensureModelsAvailable(['gemma4:26b'], DEFAULT_TARGET, {
        runner,
        pull: true,
      }),
    ).toThrow(/still does not have gemma4:26b/)
  })

  it('says the listing itself failed rather than blaming the models', () => {
    const runner: RemoteRunner = () => {
      throw new Error('ssh: connect failed')
    }

    expect(() =>
      ensureModelsAvailable(['gemma4:12b'], DEFAULT_TARGET, {
        runner,
        pull: false,
      }),
    ).toThrow(/could not list the models/)
  })
})

describe('buildOllamaListScript', () => {
  it('reads the library from the ollama service', () => {
    expect(buildOllamaListScript(DEFAULT_TARGET)).toContain(
      'docker compose exec -T ollama ollama list',
    )
  })
})

describe('buildOllamaPullScript', () => {
  it('quotes the model name, so no name reaches the shell unguarded', () => {
    expect(buildOllamaPullScript(DEFAULT_TARGET, "a'; rm -rf / #")).toContain(
      "ollama pull 'a'\\''; rm -rf / #'",
    )
  })
})

describe('applyConfig', () => {
  it('recreates the service, then reports ok when the model matches', async () => {
    const seen: { args: readonly string[]; script: string }[] = []
    const entry = await applyConfig(
      thinky,
      DEFAULT_TARGET,
      fakeDeps({
        runner: (args, script) => {
          seen.push({ args, script })
          return '100% GPU'
        },
      }),
    )

    expect(entry.status).toBe('ok')
    expect(entry.reportedModel).toBe('gemma4:12b')
    expect(entry.warmUpMs).toBe(42_000)
    expect(seen[0]?.script).toContain("REVIEW_MODEL='gemma4:12b'")
    expect(seen[0]?.args).toEqual(['exocortex', 'wsl -d exocortex -- bash -s'])
    expect(seen[1]?.script).toContain('ollama ps')
  })

  it('reports a mismatch instead of recording the config under a wrong label', async () => {
    const entry = await applyConfig(
      thinky,
      DEFAULT_TARGET,
      fakeDeps({
        warmUp: async () => ({ model: 'gemma4:26b', wallMs: 100, status: 200 }),
      }),
    )

    expect(entry.status).toBe('model-mismatch')
    expect(entry.reportedModel).toBe('gemma4:26b')
    expect(entry.expectedModel).toBe('gemma4:12b')
  })

  it('does not throw when the switch itself fails', async () => {
    const entry = await applyConfig(
      thinky,
      DEFAULT_TARGET,
      fakeDeps({
        runner: () => {
          throw new Error('ssh: connect failed')
        },
      }),
    )

    expect(entry.status).toBe('switch-failed')
    expect(entry.note).toContain('ssh: connect failed')
  })

  it('reports unhealthy when the api never comes back', async () => {
    const entry = await applyConfig(
      thinky,
      DEFAULT_TARGET,
      fakeDeps({
        waitForHealth: async () => {
          throw new Error('timed out waiting for /health')
        },
      }),
    )

    expect(entry.status).toBe('unhealthy')
  })

  it('keeps going when ollama ps fails, since it is only a note', async () => {
    let call = 0
    const entry = await applyConfig(
      thinky,
      DEFAULT_TARGET,
      fakeDeps({
        runner: () => {
          call++
          if (call === 2) throw new Error('exec failed')
          return ''
        },
      }),
    )

    expect(entry.status).toBe('ok')
    expect(entry.ollamaPs).toBeNull()
  })
})

describe('fullyOnGpu', () => {
  it('is true when every resident model sits entirely on the GPU', () => {
    expect(fullyOnGpu('NAME PROCESSOR\ngemma4:12b 100% GPU\n')).toBe(true)
  })

  it('is false when anything spilled to the CPU', () => {
    expect(fullyOnGpu('NAME PROCESSOR\ngemma4:12b 38%/62% CPU/GPU\n')).toBe(
      false,
    )
  })

  it('is unknown when nothing is resident', () => {
    expect(fullyOnGpu('NAME ID SIZE PROCESSOR UNTIL\n')).toBeNull()
    expect(fullyOnGpu(null)).toBeNull()
  })
})

describe('renderEnvironmentEntry', () => {
  it('records the config and flags a run that is not fully on the GPU', () => {
    const markdown = renderEnvironmentEntry({
      configId: 'thinky',
      switchedAt: '2026-07-25T02:00:00.000Z',
      env: thinky.env,
      expectedModel: 'gemma4:12b',
      reportedModel: 'gemma4:12b',
      warmUpMs: 42_000,
      ollamaPs: 'NAME PROCESSOR\ngemma4:12b 38%/62% CPU/GPU\n',
      status: 'ok',
      note: null,
    })

    expect(markdown).toContain('## thinky')
    expect(markdown).toContain('REVIEW_MODEL=gemma4:12b REVIEW_THINK=true')
    expect(markdown).toContain('レイテンシ比較から除外')
  })

  it('says nothing about exclusion when the model is fully on the GPU', () => {
    const markdown = renderEnvironmentEntry({
      configId: 'default',
      switchedAt: '2026-07-25T02:00:00.000Z',
      env: { REVIEW_MODEL: 'gemma4:12b' },
      expectedModel: 'gemma4:12b',
      reportedModel: 'gemma4:12b',
      warmUpMs: 30_000,
      ollamaPs: 'NAME PROCESSOR\ngemma4:12b 100% GPU\n',
      status: 'ok',
      note: null,
    })

    expect(markdown).not.toContain('レイテンシ比較から除外')
  })
})

describe('waitForHealth', () => {
  it('returns as soon as the api reports ok', async () => {
    let calls = 0
    await waitForHealth({
      endpoint: 'http://localhost:11435',
      timeoutMs: 10_000,
      intervalMs: 0,
      sleep: async () => {},
      fetchImpl: async () => {
        calls++
        if (calls < 3) throw new Error('ECONNREFUSED')
        return new Response(JSON.stringify({ status: 'ok' }))
      },
    })

    expect(calls).toBe(3)
  })

  it('gives up once the deadline passes', async () => {
    let clock = 0
    await expect(
      waitForHealth({
        endpoint: 'http://localhost:11435',
        timeoutMs: 100,
        intervalMs: 0,
        sleep: async () => {
          clock += 60
        },
        now: () => clock,
        fetchImpl: async () => {
          throw new Error('ECONNREFUSED')
        },
      }),
    ).rejects.toThrow(/health/)
  })
})
