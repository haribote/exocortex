import { readFileSync } from 'node:fs'
import { type ReviewResponse, reviewResponseSchema } from '@exocortex/contract'

export const DEFAULT_ENDPOINT = 'http://localhost:11435'
// The server gives one /review call 900000 before it answers with
// inference_timeout. Aborting here first would replace that answer with a
// client-side error and hide the outcome the run is meant to record.
export const DEFAULT_TIMEOUT_MS = 960_000

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
