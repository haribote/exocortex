import { mkdtempSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Agent } from 'undici'
import { afterEach, describe, expect, it } from 'vitest'
import { callReview } from './client.ts'

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
