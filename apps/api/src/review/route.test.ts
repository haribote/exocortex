import { describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import type {
  OllamaChatRequest,
  OllamaChatResult,
  OllamaClient,
} from '../ollama.js'
import {
  OllamaResponseError,
  OllamaTimeoutError,
  OllamaUnreachableError,
} from '../ollama.js'
import { InvalidBaseError } from './git.js'
import type { BuildInputResult, BuildReviewInput } from './input.js'
import { SnapshotExtractError, SnapshotTooLargeError } from './snapshot.js'

function fakeOllama(
  result: OllamaChatResult,
  capture?: (r: OllamaChatRequest) => void,
): OllamaClient {
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

function appWith(ollama: OllamaClient, buildReviewInput?: BuildReviewInput) {
  return createApp({
    apiToken: 'secret',
    ollama,
    reviewModel: 'qwen2.5-coder:14b',
    translateModel: 'test-translate-model',
    buildReviewInput: buildReviewInput ?? fakeBuild(okInput),
  })
}

const auth = { Authorization: 'Bearer secret' }

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
  return app.request('/review', { method: 'POST', headers: auth, body })
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
