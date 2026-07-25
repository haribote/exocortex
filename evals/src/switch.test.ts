import { describe, expect, it } from 'vitest'
import {
  applyConfig,
  buildOllamaPsScript,
  buildSwitchScript,
  DEFAULT_TARGET,
  type EvalConfig,
  fullyOnGpu,
  loadConfigs,
  remoteTarget,
  renderEnvironmentEntry,
  type SwitchDeps,
  shellQuote,
  sshArgs,
  waitForHealth,
} from './switch.ts'

// No config in configs.json sets REVIEW_THINK_PREFIX any more: the value turned
// out to have no effect, and thinking is controlled by REVIEW_THINK instead.
// This config stays as a regression test for the escaping, because "<|think|>"
// is made entirely of characters that cmd.exe and bash would otherwise act on.
const thinky: EvalConfig = {
  id: 'C1',
  env: {
    REVIEW_MODEL: 'gemma4:12b',
    REVIEW_SYSTEM_MODE: 'prefix',
    REVIEW_THINK_PREFIX: '<|think|>',
  },
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
    expect(shellQuote('qwen3:14b')).toBe("'qwen3:14b'")
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
    expect(buildSwitchScript(thinky, DEFAULT_TARGET)).toBe(
      [
        'set -eu',
        "cd '/home/haribote/exocortex'",
        "REVIEW_MODEL='gemma4:12b' REVIEW_SYSTEM_MODE='prefix' REVIEW_THINK_PREFIX='<|think|>' docker compose up -d 'ai-api'",
        '',
      ].join('\n'),
    )
  })

  it('orders assignments by name so the same config yields the same script', () => {
    const shuffled: EvalConfig = {
      id: 'C1',
      env: {
        REVIEW_THINK_PREFIX: '<|think|>',
        REVIEW_MODEL: 'gemma4:12b',
        REVIEW_SYSTEM_MODE: 'prefix',
      },
    }

    expect(buildSwitchScript(shuffled, DEFAULT_TARGET)).toBe(
      buildSwitchScript(thinky, DEFAULT_TARGET),
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
      { id: 'C2', env: { REVIEW_MODEL: 'gemma4:12b' } },
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

  it('reads the six configs', () => {
    expect(configs.map((config) => config.id)).toEqual([
      'C0',
      'C0p',
      'C1',
      'C2',
      'C3',
      'C4',
    ])
  })

  it('gives every config a REVIEW_MODEL to check against', () => {
    for (const config of configs) {
      expect(config.env.REVIEW_MODEL, config.id).toBeTypeOf('string')
    }
  })

  it('contrasts thinking through REVIEW_THINK, not a system prompt prefix', () => {
    const byId = new Map(configs.map((config) => [config.id, config.env]))

    expect(byId.get('C1')).toEqual({ REVIEW_MODEL: 'gemma4:12b' })
    expect(byId.get('C2')).toEqual({
      REVIEW_MODEL: 'gemma4:12b',
      REVIEW_THINK: 'false',
    })
    for (const config of configs) {
      expect(config.env.REVIEW_THINK_PREFIX, config.id).toBeUndefined()
    }
  })

  it('builds a usable script for every config', () => {
    for (const config of configs) {
      expect(() => buildSwitchScript(config, DEFAULT_TARGET)).not.toThrow()
    }
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
    expect(seen[0]?.script).toContain("REVIEW_THINK_PREFIX='<|think|>'")
    expect(seen[0]?.args).toEqual(['exocortex', 'wsl -d exocortex -- bash -s'])
    expect(seen[1]?.script).toContain('ollama ps')
  })

  it('reports a mismatch instead of recording the config under a wrong label', async () => {
    const entry = await applyConfig(
      thinky,
      DEFAULT_TARGET,
      fakeDeps({
        warmUp: async () => ({ model: 'qwen3:14b', wallMs: 100, status: 200 }),
      }),
    )

    expect(entry.status).toBe('model-mismatch')
    expect(entry.reportedModel).toBe('qwen3:14b')
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
    expect(fullyOnGpu('NAME PROCESSOR\nqwen3:14b 100% GPU\n')).toBe(true)
  })

  it('is false when anything spilled to the CPU', () => {
    expect(fullyOnGpu('NAME PROCESSOR\nqwen3:14b 38%/62% CPU/GPU\n')).toBe(
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
      configId: 'C1',
      switchedAt: '2026-07-25T02:00:00.000Z',
      env: thinky.env,
      expectedModel: 'gemma4:12b',
      reportedModel: 'gemma4:12b',
      warmUpMs: 42_000,
      ollamaPs: 'NAME PROCESSOR\ngemma4:12b 38%/62% CPU/GPU\n',
      status: 'ok',
      note: null,
    })

    expect(markdown).toContain('## C1')
    expect(markdown).toContain('REVIEW_THINK_PREFIX=<|think|>')
    expect(markdown).toContain('レイテンシ比較から除外')
  })

  it('says nothing about exclusion when the model is fully on the GPU', () => {
    const markdown = renderEnvironmentEntry({
      configId: 'C0',
      switchedAt: '2026-07-25T02:00:00.000Z',
      env: { REVIEW_MODEL: 'qwen3:14b' },
      expectedModel: 'qwen3:14b',
      reportedModel: 'qwen3:14b',
      warmUpMs: 30_000,
      ollamaPs: 'NAME PROCESSOR\nqwen3:14b 100% GPU\n',
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
