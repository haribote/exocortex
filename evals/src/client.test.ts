import { mkdtempSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Agent } from 'undici'
import { afterEach, describe, expect, it } from 'vitest'
import { callReview, callReviewStream } from './client.ts'

let server: Server | undefined

afterEach(() => {
  server?.close()
  server = undefined
})

function archiveFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'evals-client-'))
  const path = join(dir, 'snapshot.tgz')
  writeFileSync(path, 'not really a tarball')
  return path
}

// The review server answers only once the whole review is written, so the
// response headers arrive minutes after the request. This stands in for that.
async function endpointDelayingHeaders(delayMs: number): Promise<string> {
  const created = createServer((req, res) => {
    req.resume()
    req.on('end', () => {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ summary: 's', comments: [] }))
      }, delayMs)
    })
  })
  server = created
  await new Promise<void>((resolve) => {
    created.listen(0, '127.0.0.1', resolve)
  })
  const address = created.address()
  if (address === null || typeof address === 'string') {
    throw new Error('server did not bind a port')
  }
  return `http://127.0.0.1:${address.port}`
}

async function endpointReturning(
  status: number,
  contentType: string,
  body: string,
): Promise<string> {
  const created = createServer((req, res) => {
    req.resume()
    req.on('end', () => {
      res.writeHead(status, { 'Content-Type': contentType })
      res.end(body)
    })
  })
  server = created
  await new Promise<void>((resolve) => {
    created.listen(0, '127.0.0.1', resolve)
  })
  const address = created.address()
  if (address === null || typeof address === 'string') {
    throw new Error('server did not bind a port')
  }
  return `http://127.0.0.1:${address.port}`
}

function ndjsonMeta(overrides: Record<string, unknown> = {}) {
  return {
    model: 'gemma4:12b',
    inputTokens: 100,
    durationMs: 1000,
    droppedComments: 0,
    droppedContextFiles: 0,
    ...overrides,
  }
}

describe('callReview', () => {
  it('sends the request through the dispatcher it is given', async () => {
    const endpoint = await endpointDelayingHeaders(1_000)

    const outcome = callReview({
      archive: archiveFile(),
      params: { language: 'typescript' },
      endpoint,
      dispatcher: new Agent({ headersTimeout: 100 }),
    })

    await expect(outcome).rejects.toThrow()
  })

  it('waits for headers that arrive well after the request', async () => {
    const endpoint = await endpointDelayingHeaders(1_000)

    const outcome = await callReview({
      archive: archiveFile(),
      params: { language: 'typescript' },
      endpoint,
    })

    expect(outcome.status).toBe(200)
  })
})

describe('callReviewStream', () => {
  it('folds result, heartbeat, error and done lines into one ReviewResponse', async () => {
    const lines = [
      JSON.stringify({
        file: 'a.ts',
        summary: 'summary a',
        comments: [
          {
            severity: 'major',
            file: 'a.ts',
            line: 1,
            quote: 'q',
            message: 'm',
          },
        ],
        meta: ndjsonMeta({ promptEvalTokens: 10, thinkingChars: 40 }),
      }),
      JSON.stringify({ heartbeat: true }),
      JSON.stringify({
        file: 'b.ts',
        summary: 'summary b',
        comments: [],
        meta: ndjsonMeta({ promptEvalTokens: 20 }),
      }),
      JSON.stringify({
        file: 'c.ts',
        error: 'ollama_error',
        message: 'boom',
      }),
      JSON.stringify({
        done: true,
        meta: {
          model: 'gemma4:12b',
          reviewed: 2,
          skipped: 3,
          failed: 1,
          durationMs: 5000,
        },
      }),
    ]
    const endpoint = await endpointReturning(
      200,
      'application/x-ndjson',
      lines.join('\n'),
    )

    const outcome = await callReviewStream({
      archive: archiveFile(),
      params: { language: 'typescript', mode: 'per-file' },
      endpoint,
    })

    expect(outcome.status).toBe(200)
    expect(outcome.response?.summary).toBe('summary a\nsummary b')
    expect(outcome.response?.comments).toHaveLength(1)
    expect(outcome.response?.meta.model).toBe('gemma4:12b')
    expect(outcome.response?.meta.durationMs).toBe(5000)
    expect(outcome.response?.meta.inputTokens).toBe(200)
    expect(outcome.response?.meta.promptEvalTokens).toBe(30)
    expect(outcome.response?.meta.thinkingChars).toBe(40)
    expect(outcome.response?.meta.outputTokens).toBeUndefined()
    expect(outcome.perFile).toEqual({
      reviewed: 2,
      skipped: 3,
      failed: 1,
      heartbeats: 1,
      completed: true,
      files: [
        {
          file: 'a.ts',
          ok: true,
          thinkingChars: 40,
          promptEvalTokens: 10,
          durationMs: 1000,
        },
        {
          file: 'b.ts',
          ok: true,
          thinkingChars: undefined,
          promptEvalTokens: 20,
          durationMs: 1000,
        },
        { file: 'c.ts', ok: false, error: 'ollama_error' },
      ],
    })
  })

  it('marks the run incomplete and keeps what it read when no done line arrives', async () => {
    const lines = [
      JSON.stringify({
        file: 'a.ts',
        summary: 'summary a',
        comments: [],
        meta: ndjsonMeta(),
      }),
      JSON.stringify({
        file: 'b.ts',
        error: 'ollama_unreachable',
        message: 'could not reach ollama',
      }),
    ]
    const endpoint = await endpointReturning(
      200,
      'application/x-ndjson',
      lines.join('\n'),
    )

    const outcome = await callReviewStream({
      archive: archiveFile(),
      params: { language: 'typescript', mode: 'per-file' },
      endpoint,
    })

    expect(outcome.status).toBe(200)
    expect(outcome.perFile?.completed).toBe(false)
    expect(outcome.perFile?.reviewed).toBe(1)
    expect(outcome.perFile?.skipped).toBe(0)
    expect(outcome.perFile?.failed).toBe(1)
    expect(outcome.response?.summary).toBe('summary a')
  })

  // A run-level error names no file, so folding it into the per-file list
  // would invent a review of a file called undefined.
  it('records an error that names no file as the run failing', async () => {
    const lines = [
      JSON.stringify({
        file: 'a.ts',
        summary: 'summary a',
        comments: [],
        meta: ndjsonMeta(),
      }),
      JSON.stringify({ error: 'review_failed', message: 'the loop gave way' }),
    ]
    const endpoint = await endpointReturning(
      200,
      'application/x-ndjson',
      lines.join('\n'),
    )

    const outcome = await callReviewStream({
      archive: archiveFile(),
      params: { language: 'typescript', mode: 'per-file' },
      endpoint,
    })

    expect(outcome.perFile?.runError).toBe('review_failed')
    expect(outcome.perFile?.completed).toBe(false)
    expect(outcome.perFile?.files.map((f) => f.file)).toEqual(['a.ts'])
    expect(outcome.parseError).toBeUndefined()
  })

  it('keeps what it could read when a line is broken', async () => {
    const lines = [
      JSON.stringify({
        file: 'a.ts',
        summary: 'summary a',
        comments: [],
        meta: ndjsonMeta(),
      }),
      'not json at all {',
      JSON.stringify({
        file: 'b.ts',
        summary: 'summary b',
        comments: [],
        meta: ndjsonMeta(),
      }),
      JSON.stringify({ neither: 'a result nor a done line' }),
    ]
    const endpoint = await endpointReturning(
      200,
      'application/x-ndjson',
      lines.join('\n'),
    )

    const outcome = await callReviewStream({
      archive: archiveFile(),
      params: { language: 'typescript', mode: 'per-file' },
      endpoint,
    })

    expect(outcome.parseError).toContain('line 2')
    expect(outcome.response?.summary).toBe('summary a\nsummary b')
    expect(outcome.perFile?.reviewed).toBe(2)
  })

  it('treats a pre-inference failure the same as callReview, not as ndjson', async () => {
    const endpoint = await endpointReturning(
      400,
      'application/json',
      JSON.stringify({ error: 'invalid_request', message: 'nope' }),
    )

    const outcome = await callReviewStream({
      archive: archiveFile(),
      params: { language: 'typescript', mode: 'per-file' },
      endpoint,
    })

    expect(outcome.status).toBe(400)
    expect(outcome.perFile).toBeUndefined()
    expect(outcome.response).toBeUndefined()
    expect(outcome.raw).toEqual({ error: 'invalid_request', message: 'nope' })
  })
})
