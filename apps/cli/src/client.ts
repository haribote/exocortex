import type {
  ErrorResponse,
  ReviewRequest,
  ReviewResponse,
} from '@exocortex/contract'

export interface ClientOptions {
  endpoint: string
  token: string
  request: ReviewRequest
}

const MAX_RETRIES = 5

function isAuthHeaderError(error: ErrorResponse | null): boolean {
  return error?.error === 'unauthorized'
}

export async function requestReview(
  options: ClientOptions,
): Promise<ReviewResponse> {
  let request = options.request

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(`${options.endpoint}/review`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (response.ok) {
      return (await response.json()) as ReviewResponse
    }

    const error = (await response
      .json()
      .catch(() => null)) as ErrorResponse | null

    if (response.status === 400 && isAuthHeaderError(error)) {
      throw new Error(
        'authentication failed: the token is malformed (check EXOCORTEX_TOKEN)',
      )
    }
    if (response.status === 401) {
      throw new Error('authentication failed: check the API token')
    }
    if (response.status === 502) {
      throw new Error(
        `ollama returned an error: check the model name and whether ollama itself is healthy (${error?.message ?? 'unknown error'})`,
      )
    }
    if (response.status === 503) {
      throw new Error('could not reach ollama: is the Windows machine running?')
    }
    if (response.status === 504) {
      throw new Error(
        'inference timed out: retry, or reduce the amount of context',
      )
    }
    if (response.status !== 413) {
      throw new Error(
        `review failed (${response.status}): ${error?.message ?? 'unknown error'}`,
      )
    }

    const largest = error?.contextFiles?.[0]?.path
    const remaining = largest
      ? request.context.files.filter((file) => file.path !== largest)
      : request.context.files.slice(0, -1)

    if (remaining.length === request.context.files.length) {
      throw new Error(
        'context is too large even after dropping every optional file',
      )
    }

    request = { ...request, context: { files: remaining } }
  }

  throw new Error('context is too large: gave up after repeated retries')
}
