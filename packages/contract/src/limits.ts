export const MAX_CONTEXT_TOKENS = 32768
// Thinking is fed back as prompt, so it eats the context window alongside the
// input. Measured over 56 gemma4:12b reviews, that overhead was p50 5286,
// p95 8295, max 21411 tokens, and it tracks how hard the case is rather than
// how big the input is. 12288 covers p95 plus the JSON output with margin.
export const RESERVED_OUTPUT_TOKENS = 12288
export const MAX_INPUT_TOKENS = MAX_CONTEXT_TOKENS - RESERVED_OUTPUT_TOKENS

const CHARS_PER_TOKEN = 3

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}
