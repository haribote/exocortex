export class OllamaUnreachableError extends Error {}
export class OllamaTimeoutError extends Error {}

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
        throw new OllamaUnreachableError(`ollama returned ${response.status}`)
      }

      const parsed = (await response.json()) as {
        message?: { content?: string }
        total_duration?: number
      }
      return {
        content: parsed.message?.content ?? '',
        totalDurationMs: Math.round((parsed.total_duration ?? 0) / 1_000_000),
      }
    },
  }
}
