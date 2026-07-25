import { reviewResultJsonSchema } from '@exocortex/contract'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type AppDeps, createApp } from '../app.js'
import type {
  OllamaChatRequest,
  OllamaChatResult,
  OllamaClient,
} from '../ollama.js'
import {
  createOllamaClient,
  OllamaResponseError,
  OllamaTimeoutError,
  OllamaUnreachableError,
} from '../ollama.js'
import { InvalidBaseError } from './git.js'
import type { BuildInputResult, BuildReviewInput } from './input.js'
import {
  buildReviewBody,
  buildReviewPrompt,
  SYSTEM_INSTRUCTION,
} from './prompt.js'
import { parseReviewSystemMode, parseReviewThink } from './route.js'
import { SnapshotExtractError, SnapshotTooLargeError } from './snapshot.js'

type ReviewKnobs = Pick<
  AppDeps,
  'reviewSystemMode' | 'reviewThinkPrefix' | 'reviewThink'
>

function fakeOllama(
  result: OllamaChatResult,
  capture?: (r: OllamaChatRequest) => void,
): Pick<OllamaClient, 'chat'> {
  return {
    async chat(request) {
      capture?.(request)
      return result
    },
  }
}

const okInput: BuildInputResult = {
  kind: 'ok',
  input: {
    language: 'typescript',
    diff: 'diff --git a/a.ts b/a.ts',
    rules: [],
    contextFiles: [{ path: 'a.ts', content: 'const a = 1\n' }],
  },
  inputTokens: 42,
  droppedContextFiles: 0,
}

function fakeBuild(result: BuildInputResult | (() => never)): BuildReviewInput {
  return async () => (typeof result === 'function' ? result() : result)
}

function appWith(
  ollama: Pick<OllamaClient, 'chat'>,
  buildReviewInput?: BuildReviewInput,
  knobs: ReviewKnobs = {},
) {
  return createApp({
    ollama: {
      async chatStream() {
        throw new Error('chatStream is not used by /review')
      },
      ...ollama,
    },
    reviewModel: 'qwen2.5-coder:14b',
    translateModel: 'test-translate-model',
    buildReviewInput: buildReviewInput ?? fakeBuild(okInput),
    ...knobs,
  })
}

function form(
  params: unknown,
  snapshot: Uint8Array | 'omit' = new Uint8Array([1]),
) {
  const fd = new FormData()
  fd.append(
    'params',
    typeof params === 'string' ? params : JSON.stringify(params),
  )
  if (snapshot !== 'omit') {
    fd.append(
      'snapshot',
      new Blob([snapshot], { type: 'application/gzip' }),
      'snapshot.tgz',
    )
  }
  return fd
}

function post(app: ReturnType<typeof appWith>, body: FormData) {
  return app.request('/review', { method: 'POST', body })
}

const validResult = JSON.stringify({
  summary: 'looks risky',
  comments: [
    {
      severity: 'major',
      file: 'a.ts',
      line: 1,
      quote: 'const a = 1',
      message: 'unchecked index access',
    },
  ],
})

describe('POST /review', () => {
  it('returns the parsed review with meta', async () => {
    const app = appWith(
      fakeOllama({ content: validResult, totalDurationMs: 1234 }),
    )
    const res = await post(app, form({ language: 'typescript' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary).toBe('looks risky')
    expect(body.comments[0].severity).toBe('major')
    expect(body.meta.model).toBe('qwen2.5-coder:14b')
    expect(body.meta.durationMs).toBe(1234)
    expect(body.meta.inputTokens).toBe(42)
    expect(body.meta.droppedContextFiles).toBe(0)
  })

  it('passes the json schema to ollama as format', async () => {
    let captured: OllamaChatRequest | undefined
    const app = appWith(
      fakeOllama({ content: validResult, totalDurationMs: 0 }, (r) => {
        captured = r
      }),
    )
    await post(app, form({ language: 'typescript' }))

    expect(captured?.format).toMatchObject({ type: 'object' })
    expect(captured?.temperature).toBe(0)
  })

  it('returns 400 when params is missing a required field', async () => {
    const app = appWith(
      fakeOllama({ content: validResult, totalDurationMs: 0 }),
    )
    const res = await post(app, form({ staged: true }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when params is not json', async () => {
    const app = appWith(
      fakeOllama({ content: validResult, totalDurationMs: 0 }),
    )
    const res = await post(app, form('not json at all'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when the snapshot file is missing', async () => {
    const app = appWith(
      fakeOllama({ content: validResult, totalDurationMs: 0 }),
    )
    const res = await post(app, form({ language: 'typescript' }, 'omit'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when the snapshot has no changes', async () => {
    const app = appWith(
      fakeOllama({ content: validResult, totalDurationMs: 0 }),
      fakeBuild({ kind: 'no_changes' }),
    )
    const res = await post(app, form({ language: 'typescript' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('no_changes')
  })

  it('returns 413 when the diff alone exceeds the budget', async () => {
    const app = appWith(
      fakeOllama({ content: validResult, totalDurationMs: 0 }),
      fakeBuild({ kind: 'too_large' }),
    )
    const res = await post(app, form({ language: 'typescript' }))
    expect(res.status).toBe(413)
    expect((await res.json()).error).toBe('context_too_large')
  })

  it('returns 413 when the snapshot is too large', async () => {
    const app = appWith(
      fakeOllama({ content: validResult, totalDurationMs: 0 }),
      fakeBuild(() => {
        throw new SnapshotTooLargeError('too big')
      }),
    )
    const res = await post(app, form({ language: 'typescript' }))
    expect(res.status).toBe(413)
    expect((await res.json()).error).toBe('snapshot_too_large')
  })

  it('returns 400 when the snapshot cannot be extracted', async () => {
    const app = appWith(
      fakeOllama({ content: validResult, totalDurationMs: 0 }),
      fakeBuild(() => {
        throw new SnapshotExtractError('bad archive')
      }),
    )
    const res = await post(app, form({ language: 'typescript' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_snapshot')
  })

  it('returns 400 when the base ref is invalid', async () => {
    const app = appWith(
      fakeOllama({ content: validResult, totalDurationMs: 0 }),
      fakeBuild(() => {
        throw new InvalidBaseError('base does not resolve')
      }),
    )
    const res = await post(app, form({ language: 'typescript', base: 'nope' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_request')
  })

  it('returns 504 when ollama times out', async () => {
    const app = appWith({
      async chat() {
        throw new OllamaTimeoutError('ollama request timed out')
      },
    })
    const res = await post(app, form({ language: 'typescript' }))
    expect(res.status).toBe(504)
    expect((await res.json()).error).toBe('inference_timeout')
  })

  it('returns 503 when ollama is unreachable', async () => {
    const app = appWith({
      async chat() {
        throw new OllamaUnreachableError('down')
      },
    })
    const res = await post(app, form({ language: 'typescript' }))
    expect(res.status).toBe(503)
  })

  it('returns 502 when ollama returns an error response', async () => {
    const app = appWith({
      async chat() {
        throw new OllamaResponseError('ollama returned 500', 500)
      },
    })
    const res = await post(app, form({ language: 'typescript' }))
    expect(res.status).toBe(502)
    expect((await res.json()).error).toBe('ollama_error')
  })

  it('returns 502 when ollama returns valid json that violates the schema', async () => {
    const app = appWith(
      fakeOllama({ content: '{"summary": 1}', totalDurationMs: 0 }),
    )
    const res = await post(app, form({ language: 'typescript' }))
    expect(res.status).toBe(502)
    expect((await res.json()).error).toBe('invalid_model_output')
  })

  it('returns 502 when ollama returns content that is not valid json', async () => {
    const app = appWith(
      fakeOllama({ content: 'not valid json at all', totalDurationMs: 0 }),
    )
    const res = await post(app, form({ language: 'typescript' }))
    expect(res.status).toBe(502)
    expect((await res.json()).error).toBe('invalid_model_output')
  })
})

describe('POST /review model knobs', () => {
  async function capture(knobs: ReviewKnobs = {}) {
    let captured: OllamaChatRequest | undefined
    const app = appWith(
      fakeOllama({ content: validResult, totalDurationMs: 0 }, (r) => {
        captured = r
      }),
      undefined,
      knobs,
    )
    await post(app, form({ language: 'typescript' }))
    if (captured === undefined) {
      throw new Error('ollama.chat was never called')
    }
    return captured
  }

  it('sends the single-prompt request unchanged when nothing is configured', async () => {
    const captured = await capture()

    expect(captured.prompt).toBe(buildReviewPrompt(okInput.input))
    expect(captured.system).toBeUndefined()
    expect(captured.think).toBeUndefined()
    expect('system' in captured).toBe(false)
    expect('think' in captured).toBe(false)
  })

  it('sends the same single-prompt request when systemMode is explicitly none', async () => {
    const captured = await capture({ reviewSystemMode: 'none' })

    expect(captured.prompt).toBe(buildReviewPrompt(okInput.input))
    expect(captured.system).toBeUndefined()
  })

  it('splits the instruction into a system message when systemMode is prefix', async () => {
    const captured = await capture({ reviewSystemMode: 'prefix' })

    expect(captured.system).toBe(SYSTEM_INSTRUCTION)
    expect(captured.prompt).toBe(buildReviewBody(okInput.input))
  })

  it('prepends the think prefix to the system message', async () => {
    const captured = await capture({
      reviewSystemMode: 'prefix',
      reviewThinkPrefix: 'Reasoning: high\n',
    })

    expect(captured.system).toBe(`Reasoning: high\n${SYSTEM_INSTRUCTION}`)
  })

  it('ignores the think prefix while systemMode is none', async () => {
    const captured = await capture({ reviewThinkPrefix: 'Reasoning: high\n' })

    expect(captured.prompt).toBe(buildReviewPrompt(okInput.input))
    expect(captured.system).toBeUndefined()
  })

  it('passes think through to ollama', async () => {
    expect((await capture({ reviewThink: 'high' })).think).toBe('high')
    expect((await capture({ reviewThink: false })).think).toBe(false)
    expect((await capture({ reviewThink: true })).think).toBe(true)
  })
})

// The eval compares runs against the unconfigured baseline, so the bytes on the
// wire must not move when a knob is merely available but unused.
describe('POST /review default request bytes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('serialises to the same body the single-prompt design always sent', async () => {
    let captured = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init: RequestInit) => {
        captured = String(init.body)
        return new Response(
          JSON.stringify({ message: { content: validResult } }),
        )
      }),
    )

    const app = createApp({
      ollama: createOllamaClient('http://ollama:11434'),
      reviewModel: 'qwen2.5-coder:14b',
      translateModel: 'test-translate-model',
      buildReviewInput: fakeBuild(okInput),
    })
    await post(app, form({ language: 'typescript' }))

    expect(captured).toBe(
      JSON.stringify({
        model: 'qwen2.5-coder:14b',
        stream: false,
        messages: [{ role: 'user', content: buildReviewPrompt(okInput.input) }],
        format: reviewResultJsonSchema,
        options: { temperature: 0 },
      }),
    )
  })
})

describe('POST /review meta counters', () => {
  it('reports the token counts and load duration when ollama returns them', async () => {
    const app = appWith(
      fakeOllama({
        content: validResult,
        totalDurationMs: 10,
        promptEvalTokens: 1200,
        outputTokens: 340,
        loadDurationMs: 5600,
      }),
    )
    const body = await (
      await post(app, form({ language: 'typescript' }))
    ).json()

    expect(body.meta.promptEvalTokens).toBe(1200)
    expect(body.meta.outputTokens).toBe(340)
    expect(body.meta.loadDurationMs).toBe(5600)
  })

  it('omits the counters entirely when ollama does not report them', async () => {
    const app = appWith(
      fakeOllama({ content: validResult, totalDurationMs: 10 }),
    )
    const body = await (
      await post(app, form({ language: 'typescript' }))
    ).json()

    expect(Object.keys(body.meta).sort()).toEqual([
      'droppedComments',
      'droppedContextFiles',
      'durationMs',
      'inputTokens',
      'model',
    ])
  })
})

describe('POST /review raw output debugging', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  async function invalidOutput(content: string) {
    const app = appWith(fakeOllama({ content, totalDurationMs: 0 }))
    const res = await post(app, form({ language: 'typescript' }))
    expect(res.status).toBe(502)
    return await res.json()
  }

  it('does not leak the raw model output by default', async () => {
    expect(await invalidOutput('not valid json')).not.toHaveProperty('raw')
    expect(await invalidOutput('{"summary": 1}')).not.toHaveProperty('raw')
  })

  it('does not leak the raw model output when the flag is not exactly "1"', async () => {
    vi.stubEnv('REVIEW_DEBUG_RAW', 'true')
    expect(await invalidOutput('not valid json')).not.toHaveProperty('raw')
  })

  it('includes the raw model output when REVIEW_DEBUG_RAW is 1', async () => {
    vi.stubEnv('REVIEW_DEBUG_RAW', '1')
    expect((await invalidOutput('not valid json')).raw).toBe('not valid json')
    expect((await invalidOutput('{"summary": 1}')).raw).toBe('{"summary": 1}')
  })

  it('truncates the raw model output to 2000 characters', async () => {
    vi.stubEnv('REVIEW_DEBUG_RAW', '1')
    const body = await invalidOutput('x'.repeat(5000))
    expect(body.raw).toHaveLength(2000)
  })
})

describe('parseReviewSystemMode', () => {
  it('defaults to none when unset, empty, or unrecognised', () => {
    expect(parseReviewSystemMode(undefined)).toBe('none')
    expect(parseReviewSystemMode('')).toBe('none')
    expect(parseReviewSystemMode('nonsense')).toBe('none')
    expect(parseReviewSystemMode('none')).toBe('none')
  })

  it('selects prefix when asked for', () => {
    expect(parseReviewSystemMode('prefix')).toBe('prefix')
  })
})

describe('parseReviewThink', () => {
  it('leaves think unset when the variable is unset or empty', () => {
    expect(parseReviewThink(undefined)).toBeUndefined()
    expect(parseReviewThink('')).toBeUndefined()
  })

  it('reads "true" and "false" as booleans', () => {
    expect(parseReviewThink('true')).toBe(true)
    expect(parseReviewThink('false')).toBe(false)
  })

  it('passes any other value through as a string level', () => {
    expect(parseReviewThink('high')).toBe('high')
    expect(parseReviewThink('low')).toBe('low')
  })
})

describe('POST /review comment verification', () => {
  function resultWith(quote: string) {
    return JSON.stringify({
      summary: 's',
      comments: [
        { severity: 'major', file: 'a.ts', line: 1, quote, message: 'm' },
      ],
    })
  }

  async function review(content: string) {
    const app = appWith(fakeOllama({ content, totalDurationMs: 0 }))
    const res = await post(app, form({ language: 'typescript' }))
    return await res.json()
  }

  it('keeps a comment whose quote exists in the collected context', async () => {
    const body = await review(resultWith('const a = 1'))
    expect(body.comments).toHaveLength(1)
    expect(body.meta.droppedComments).toBe(0)
  })

  it('drops a comment whose quote does not exist and counts it', async () => {
    const body = await review(resultWith('const nope = 9'))
    expect(body.comments).toHaveLength(0)
    expect(body.meta.droppedComments).toBe(1)
  })
})
