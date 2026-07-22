import {
  type ErrorResponse,
  errorResponseSchema,
  type ReviewRequest,
  type ReviewResponse,
  reviewResponseSchema,
  type TranslateRequest,
  type TranslateResponse,
  translateResponseSchema,
} from '@exocortex/contract'

export interface ClientOptions {
  endpoint: string
  token: string
  request: ReviewRequest
}

export interface TranslateClientOptions {
  endpoint: string
  token: string
  request: TranslateRequest
}

const MAX_RETRIES = 5

function isAuthHeaderError(error: ErrorResponse | null): boolean {
  return error?.error === 'unauthorized'
}

function parseErrorBody(body: unknown): ErrorResponse | null {
  if (body === null || body === undefined) {
    return null
  }
  const parsed = errorResponseSchema.safeParse(body)
  if (!parsed.success) {
    throw new Error(
      `received an error response that does not match the error contract: ${parsed.error.message}`,
    )
  }
  return parsed.data
}

async function post(
  endpoint: string,
  path: string,
  token: string,
  body: unknown,
): Promise<Response> {
  try {
    return await fetch(`${endpoint}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (cause) {
    throw new Error(
      `could not reach ${endpoint}: check that the Windows machine is on, docker compose is running, and EXOCORTEX_ENDPOINT is correct`,
      { cause },
    )
  }
}

function httpError(
  status: number,
  error: ErrorResponse | null,
  what: string,
): Error | null {
  if (status === 400 && isAuthHeaderError(error)) {
    return new Error(
      'authentication failed: the token is malformed (check EXOCORTEX_TOKEN)',
    )
  }
  if (status === 401) {
    return new Error('authentication failed: check the API token')
  }
  if (status === 502) {
    return new Error(
      `ollama returned an error: check the model name and whether ollama itself is healthy (${error?.message ?? 'unknown error'})`,
    )
  }
  if (status === 503) {
    return new Error('could not reach ollama: is the Windows machine running?')
  }
  if (status === 504) {
    return new Error(
      'inference timed out: retry, or reduce the amount of context',
    )
  }
  if (status === 413) {
    return null
  }
  return new Error(
    `${what} failed (${status}): ${error?.message ?? 'unknown error'}`,
  )
}

export async function requestTranslate(
  options: TranslateClientOptions,
): Promise<TranslateResponse> {
  const response = await post(
    options.endpoint,
    '/translate',
    options.token,
    options.request,
  )

  if (response.ok) {
    const body = await response.json().catch(() => undefined)
    const parsed = translateResponseSchema.safeParse(body)
    if (!parsed.success) {
      throw new Error(
        `received a response that does not match the translate contract: ${parsed.error.message}`,
      )
    }
    return parsed.data
  }

  const error = parseErrorBody(await response.json().catch(() => null))
  throw (
    httpError(response.status, error, 'translate') ??
    new Error(`translate failed (${response.status}): text is too large`)
  )
}

export async function requestReview(
  options: ClientOptions,
): Promise<ReviewResponse> {
  let request = options.request

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await post(
      options.endpoint,
      '/review',
      options.token,
      request,
    )

    if (response.ok) {
      const body = await response.json().catch(() => undefined)
      const parsed = reviewResponseSchema.safeParse(body)
      if (!parsed.success) {
        throw new Error(
          `received a response that does not match the review contract: ${parsed.error.message}`,
        )
      }
      return parsed.data
    }

    const error = parseErrorBody(await response.json().catch(() => null))

    const failure = httpError(response.status, error, 'review')
    if (failure) {
      throw failure
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
