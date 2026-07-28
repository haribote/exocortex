import type { OllamaThink } from '../ollama.js'

export type ReviewSystemMode = 'none' | 'prefix'

export class ReviewConfigError extends Error {}

export interface ReviewConfig {
  systemMode: ReviewSystemMode
  think: OllamaThink | undefined
  debugRaw: boolean
  includeDocs: boolean
}

const SYSTEM_MODES: readonly ReviewSystemMode[] = ['none', 'prefix']
const THINK_LEVELS: readonly OllamaThink[] = ['low', 'medium', 'high', 'max']
const BOOLEAN_ON: readonly string[] = ['1', 'true']
const BOOLEAN_OFF: readonly string[] = ['0', 'false']

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

export function parseReviewDebugRaw(value: string | undefined): boolean {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === '' || BOOLEAN_OFF.includes(normalized)) {
    return false
  }
  if (BOOLEAN_ON.includes(normalized)) {
    return true
  }
  return reject('REVIEW_DEBUG_RAW', value ?? '', 'one of 1, 0, true, false')
}

// Unlike the other flags this one defaults on, because it turns off behaviour
// the reviewer already relies on. It exists to measure whether the prose that
// findRelatedDocs pulls in makes the model think longer, so an operator who
// never sets it must keep getting the docs.
export function parseReviewContextDocs(value: string | undefined): boolean {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === '' || BOOLEAN_ON.includes(normalized)) {
    return true
  }
  if (BOOLEAN_OFF.includes(normalized)) {
    return false
  }
  return reject('REVIEW_CONTEXT_DOCS', value ?? '', 'one of 1, 0, true, false')
}

export function loadReviewConfig(
  env: Record<string, string | undefined>,
): ReviewConfig {
  return {
    systemMode: parseReviewSystemMode(env.REVIEW_SYSTEM_MODE),
    think: parseReviewThink(env.REVIEW_THINK),
    debugRaw: parseReviewDebugRaw(env.REVIEW_DEBUG_RAW),
    includeDocs: parseReviewContextDocs(env.REVIEW_CONTEXT_DOCS),
  }
}
