export const MAX_CONTEXT_TOKENS = 32768
export const RESERVED_OUTPUT_TOKENS = 4096
export const MAX_INPUT_TOKENS = MAX_CONTEXT_TOKENS - RESERVED_OUTPUT_TOKENS

const CHARS_PER_TOKEN = 3

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}
