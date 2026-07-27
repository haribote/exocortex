import { reviewResultJsonSchema } from '@exocortex/contract'
import type { OllamaChatRequest, OllamaThink } from '../ollama.js'
import type { ReviewSystemMode } from './config.js'
import {
  buildReviewBody,
  buildReviewPrompt,
  type ReviewPromptInput,
  SYSTEM_INSTRUCTION,
} from './prompt.js'

// Ollama stops for "length" when the context ran out before the model finished.
// The content is then a prefix of the intended answer, so the json it breaks on
// is a symptom of the budget rather than of the model writing bad json.
export const OUT_OF_CONTEXT = 'length'

export interface ChatConfig {
  model: string
  systemMode?: ReviewSystemMode
  think?: OllamaThink
}

export function buildChatRequest(
  config: ChatConfig,
  input: ReviewPromptInput,
): OllamaChatRequest {
  const request: OllamaChatRequest = {
    model: config.model,
    prompt:
      config.systemMode === 'prefix'
        ? buildReviewBody(input)
        : buildReviewPrompt(input),
    format: reviewResultJsonSchema,
    temperature: 0,
  }
  if (config.systemMode === 'prefix') {
    request.system = SYSTEM_INSTRUCTION
  }
  if (config.think !== undefined) {
    request.think = config.think
  }
  return request
}
