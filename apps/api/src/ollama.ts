export class OllamaUnreachableError extends Error {}
export class OllamaTimeoutError extends Error {}

export class OllamaResponseError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export interface OllamaChatRequest {
  model: string
  prompt: string
  format?: unknown
  temperature?: number
}

export interface OllamaChatResult {
  content: string
  totalDurationMs: number
}

export interface OllamaClient {
  chat(request: OllamaChatRequest): Promise<OllamaChatResult>
}

const REQUEST_TIMEOUT_MS = 300_000

export function createOllamaClient(baseUrl: string): OllamaClient {
  return {
    async chat(request) {
      const body: Record<string, unknown> = {
        model: request.model,
        stream: false,
        messages: [{ role: 'user', content: request.prompt }],
      }
      if (request.format !== undefined) {
        body.format = request.format
      }
      if (request.temperature !== undefined) {
        body.options = { temperature: request.temperature }
      }

      let response: Response
      try {
        response = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
      } catch (cause) {
        if (cause instanceof Error && cause.name === 'TimeoutError') {
          throw new OllamaTimeoutError('ollama request timed out', { cause })
        }
        throw new OllamaUnreachableError('failed to reach ollama', { cause })
      }

      if (!response.ok) {
        throw new OllamaResponseError(
          `ollama returned ${response.status}`,
          response.status,
        )
      }

      const parsed: unknown = await response.json()
      return toChatResult(parsed)
    },
  }
}

function toChatResult(body: unknown): OllamaChatResult {
  const record = isRecord(body) ? body : {}
  const message = isRecord(record.message) ? record.message : {}
  const content = typeof message.content === 'string' ? message.content : ''
  const totalDuration =
    typeof record.total_duration === 'number' ? record.total_duration : 0
  return {
    content,
    totalDurationMs: Math.round(totalDuration / 1_000_000),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
