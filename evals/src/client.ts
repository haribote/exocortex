import { readFileSync } from 'node:fs'
import { type ReviewResponse, reviewResponseSchema } from '@exocortex/contract'
import { Agent, type Dispatcher, FormData, fetch } from 'undici'

export const DEFAULT_ENDPOINT = 'http://localhost:11435'
// The server gives one /review call 900000 before it answers with
// inference_timeout. Aborting here first would replace that answer with a
// client-side error and hide the outcome the run is meant to record.
export const DEFAULT_TIMEOUT_MS = 960_000

// /review answers only once the whole review is written, so its response headers
// arrive minutes after the request goes out. undici caps that wait at 300000 by
// default and no AbortSignal raises it, which ended long runs as a transport
// failure at five minutes. The ceiling on the call belongs to the signal above,
// so both timers are off here. Node's built-in fetch rejects an Agent from this
// package, hence undici's own fetch.
export const reviewDispatcher = new Agent({
  headersTimeout: 0,
  bodyTimeout: 0,
})

export interface ReviewParams {
  language: string
  base?: string
  staged?: boolean
  rules?: string[]
}

export interface ReviewCall {
  archive: string
  params: ReviewParams
  endpoint?: string
  timeoutMs?: number
  dispatcher?: Dispatcher
}

export interface ReviewOutcome {
  status: number
  body: string
  wallMs: number
  response?: ReviewResponse
  // reviewResponseSchema strips meta fields it does not declare, so anything the
  // server grows before the contract catches up is only visible here.
  raw?: unknown
  parseError?: string
}

export async function callReview(call: ReviewCall): Promise<ReviewOutcome> {
  const endpoint = call.endpoint ?? DEFAULT_ENDPOINT
  const form = new FormData()
  form.set('params', JSON.stringify(call.params))
  form.set(
    'snapshot',
    new File([readFileSync(call.archive)], 'snapshot.tgz', {
      type: 'application/gzip',
    }),
  )

  const startedAt = performance.now()
  const response = await fetch(`${endpoint}/review`, {
    method: 'POST',
    body: form,
    dispatcher: call.dispatcher ?? reviewDispatcher,
    signal: AbortSignal.timeout(call.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  })
  const body = await response.text()
  const wallMs = Math.round(performance.now() - startedAt)

  const outcome: ReviewOutcome = { status: response.status, body, wallMs }

  let raw: unknown
  try {
    raw = JSON.parse(body)
  } catch {
    outcome.parseError = 'response body is not json'
    return outcome
  }

  outcome.raw = raw
  const parsed = reviewResponseSchema.safeParse(raw)
  if (parsed.success) {
    outcome.response = parsed.data
  } else {
    outcome.parseError = parsed.error.message
  }

  return outcome
}
