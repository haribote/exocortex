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
import { DEBUG_EDGE_CHARS, truncateForDebug } from './route.js'
import { SnapshotExtractError, SnapshotTooLargeError } from './snapshot.js'

type ReviewKnobs = Pick<
  AppDeps,
  'reviewSystemMode' | 'reviewThink' | 'reviewDebugRaw'
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

  // "prefix" names where the instruction goes, not a string prepended to it:
  // the system message is SYSTEM_INSTRUCTION verbatim, with nothing in front.
  // Thinking is turned on by REVIEW_THINK, never by a marker in this message.
  it('splits the instruction into a system message when systemMode is prefix', async () => {
    const captured = await capture({ reviewSystemMode: 'prefix' })

    expect(captured.system).toBe(SYSTEM_INSTRUCTION)
    expect(captured.prompt).toBe(buildReviewBody(okInput.input))
  })

  it('passes think through to ollama', async () => {
    expect((await capture({ reviewThink: 'high' })).think).toBe('high')
    expect((await capture({ reviewThink: false })).think).toBe(false)
    expect((await capture({ reviewThink: true })).think).toBe(true)
  })
})

// Guards the request envelope only: which keys are present, in which order, and
// that the default carries a single user message with no system or think field.
// The prompt text itself is pinned by the snapshots in prompt.test.ts.
describe('POST /review default request bytes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('serialises the default request with the expected keys in the expected order', async () => {
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

  // outputTokens comes from eval_count, which excludes the thinking text while
  // `format` is set. Measuring the thinking budget needs its own field.
  it('reports the thinking length when ollama returns thinking', async () => {
    const app = appWith(
      fakeOllama({
        content: validResult,
        totalDurationMs: 10,
        outputTokens: 340,
        thinking: 'a'.repeat(4537),
      }),
    )
    const body = await (
      await post(app, form({ language: 'typescript' }))
    ).json()

    expect(body.meta.thinkingChars).toBe(4537)
  })

  it('omits thinkingChars when the model did not think', async () => {
    const app = appWith(
      fakeOllama({ content: validResult, totalDurationMs: 10 }),
    )
    const body = await (
      await post(app, form({ language: 'typescript' }))
    ).json()

    expect(body.meta).not.toHaveProperty('thinkingChars')
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
  async function invalidOutput(
    result: Partial<OllamaChatResult> & { content: string },
    debugRaw?: boolean,
  ) {
    const app = appWith(
      fakeOllama({ totalDurationMs: 0, ...result }),
      undefined,
      { reviewDebugRaw: debugRaw },
    )
    const res = await post(app, form({ language: 'typescript' }))
    expect(res.status).toBe(502)
    return await res.json()
  }

  it('does not leak the raw model output by default', async () => {
    expect(
      await invalidOutput({ content: 'not valid json' }),
    ).not.toHaveProperty('raw')
    expect(
      await invalidOutput({ content: '{"summary": 1}' }),
    ).not.toHaveProperty('raw')
  })

  it('does not leak the raw model output when debugRaw is off', async () => {
    const body = await invalidOutput(
      { content: 'not valid json', thinking: 'pondering' },
      false,
    )
    expect(body).not.toHaveProperty('raw')
    expect(body).not.toHaveProperty('thinking')
  })

  it('includes the raw model output when debugRaw is on', async () => {
    expect((await invalidOutput({ content: 'not valid json' }, true)).raw).toBe(
      'not valid json',
    )
    expect((await invalidOutput({ content: '{"summary": 1}' }, true)).raw).toBe(
      '{"summary": 1}',
    )
  })

  // The failure this flag exists to diagnose is thinking eating the output
  // budget, and in that case the reasoning is the only evidence there is.
  it('includes the thinking text alongside the raw output', async () => {
    const body = await invalidOutput(
      { content: '', thinking: 'let me count the tokens' },
      true,
    )
    expect(body.raw).toBe('')
    expect(body.thinking).toBe('let me count the tokens')
  })

  it('omits thinking when the model reported none', async () => {
    const body = await invalidOutput({ content: 'not valid json' }, true)
    expect(body).not.toHaveProperty('thinking')
  })

  it('keeps both ends of an oversized output, because json breaks at the tail', async () => {
    const content = `${'h'.repeat(DEBUG_EDGE_CHARS)}MIDDLE${'t'.repeat(DEBUG_EDGE_CHARS)}`
    const body = await invalidOutput({ content }, true)

    expect(body.raw.startsWith('h'.repeat(DEBUG_EDGE_CHARS))).toBe(true)
    expect(body.raw.endsWith('t'.repeat(DEBUG_EDGE_CHARS))).toBe(true)
    expect(body.raw).not.toContain('MIDDLE')
  })

  it('leaves output that fits within both edges untouched', async () => {
    const content = 'x'.repeat(DEBUG_EDGE_CHARS * 2)
    expect((await invalidOutput({ content }, true)).raw).toBe(content)
  })

  it('truncates the thinking text the same way', async () => {
    const thinking = `${'h'.repeat(DEBUG_EDGE_CHARS)}MIDDLE${'t'.repeat(DEBUG_EDGE_CHARS)}`
    const body = await invalidOutput({ content: 'nope', thinking }, true)
    expect(body.thinking).not.toContain('MIDDLE')
  })
})

describe('truncateForDebug', () => {
  it('returns short text unchanged', () => {
    expect(truncateForDebug('hello')).toBe('hello')
  })

  // slice() on a raw string would cut an astral character in half and emit a
  // lone surrogate, which JSON.stringify turns into U+FFFD.
  it('never splits an astral character into lone surrogates', () => {
    const emoji = '🙂'
    const text = emoji.repeat(DEBUG_EDGE_CHARS * 2 + 10)
    const truncated = truncateForDebug(text)

    expect(truncated).not.toContain('�')
    expect(JSON.parse(JSON.stringify(truncated))).toBe(truncated)
    expect(Array.from(truncated).filter((c) => c === emoji)).toHaveLength(
      DEBUG_EDGE_CHARS * 2,
    )
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
