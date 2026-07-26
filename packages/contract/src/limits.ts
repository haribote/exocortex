export const MAX_CONTEXT_TOKENS = 65536
// The input cap is a fixed number rather than a share of the window. Thinking is
// fed back as prompt, and its size tracks how hard the case is rather than how
// big the input is: over 56 gemma4:12b reviews it added p50 5286, p95 8295, max
// 21411 tokens on top of the input. A cap derived from the window would spend
// every extra token on more input and leave that spread nowhere to go, which is
// exactly how a 32768 window ended up truncating the output mid-JSON.
export const MAX_INPUT_TOKENS = 20480
export const RESERVED_OUTPUT_TOKENS = MAX_CONTEXT_TOKENS - MAX_INPUT_TOKENS

// Measured over the same 291 characters: gemma4:12b 2.58, qwen3.5:9b 2.94,
// qwen3:14b 3.13. Taking the densest tokenizer keeps the estimate on the safe
// side for every model the review path runs against.
const CHARS_PER_TOKEN = 2.58

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}
