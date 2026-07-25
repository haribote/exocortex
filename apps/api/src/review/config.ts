import type { OllamaThink } from '../ollama.js'

export type ReviewSystemMode = 'none' | 'prefix'

export class ReviewConfigError extends Error {}

export interface ReviewConfig {
  systemMode: ReviewSystemMode
  thinkPrefix: string | undefined
  think: OllamaThink | undefined
  debugRaw: boolean
}

const SYSTEM_MODES: readonly ReviewSystemMode[] = ['none', 'prefix']
const THINK_LEVELS: readonly OllamaThink[] = ['low', 'medium', 'high', 'max']
const DEBUG_RAW_ON: readonly string[] = ['1', 'true']
const DEBUG_RAW_OFF: readonly string[] = ['0', 'false']

function reject(name: string, value: string, allowed: string): never {
  throw new ReviewConfigError(
    `${name}=${JSON.stringify(value)} is not valid: expected ${allowed}`,
  )
}

export function parseReviewSystemMode(
  value: string | undefined,
): ReviewSystemMode {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === '') {
    return 'none'
  }
  const mode = SYSTEM_MODES.find((candidate) => candidate === normalized)
  if (mode === undefined) {
    reject('REVIEW_SYSTEM_MODE', value ?? '', 'one of none, prefix')
  }
  return mode
}

export function parseReviewThink(
  value: string | undefined,
): OllamaThink | undefined {
  const normalized = (value ?? '').trim()
  if (normalized === '') {
    return undefined
  }
  if (normalized === 'true' || normalized === 'false') {
    return normalized === 'true'
  }
  const level = THINK_LEVELS.find((candidate) => candidate === normalized)
  if (level === undefined) {
    reject(
      'REVIEW_THINK',
      value ?? '',
      'one of true, false, low, medium, high, max',
    )
  }
  return level
}

export function parseReviewThinkPrefix(
  value: string | undefined,
): string | undefined {
  return value === undefined || value === '' ? undefined : value
}

export function parseReviewDebugRaw(value: string | undefined): boolean {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === '' || DEBUG_RAW_OFF.includes(normalized)) {
    return false
  }
  if (DEBUG_RAW_ON.includes(normalized)) {
    return true
  }
  return reject('REVIEW_DEBUG_RAW', value ?? '', 'one of 1, 0, true, false')
}

export function loadReviewConfig(
  env: Record<string, string | undefined>,
): ReviewConfig {
  const systemMode = parseReviewSystemMode(env.REVIEW_SYSTEM_MODE)
  const thinkPrefix = parseReviewThinkPrefix(env.REVIEW_THINK_PREFIX)

  if (thinkPrefix !== undefined && systemMode !== 'prefix') {
    throw new ReviewConfigError(
      'REVIEW_THINK_PREFIX is set but REVIEW_SYSTEM_MODE is not "prefix": the prefix only reaches the model through the system message, so it would be silently dropped',
    )
  }

  return {
    systemMode,
    thinkPrefix,
    think: parseReviewThink(env.REVIEW_THINK),
    debugRaw: parseReviewDebugRaw(env.REVIEW_DEBUG_RAW),
  }
}
