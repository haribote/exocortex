import {
  estimateTokens,
  MAX_INPUT_TOKENS,
  type ReviewRequest,
} from '@exocortex/contract'
import { collectCandidates } from './context.js'
import { collectDiff } from './git.js'
import {
  baseInputTokens,
  buildReviewPrompt,
  packContext,
  type ReviewPromptInput,
} from './prompt.js'
import { extractSnapshot } from './snapshot.js'

export type BuildInputResult =
  | {
      kind: 'ok'
      input: ReviewPromptInput
      inputTokens: number
      droppedContextFiles: number
    }
  | { kind: 'no_changes' }
  | { kind: 'too_large' }

export type BuildReviewInput = (
  snapshot: Uint8Array,
  params: ReviewRequest,
) => Promise<BuildInputResult>

export function createBuildReviewInput(): BuildReviewInput {
  return async (snapshot, params) => {
    const { dir, cleanup } = await extractSnapshot(snapshot)
    try {
      const { diff, changedFiles } = collectDiff({
        cwd: dir,
        base: params.base,
        staged: params.staged,
      })

      if (diff.length === 0) {
        return { kind: 'no_changes' }
      }

      const base = { language: params.language, diff, rules: params.rules }
      if (baseInputTokens(base) > MAX_INPUT_TOKENS) {
        return { kind: 'too_large' }
      }

      const candidates = collectCandidates(dir, changedFiles)
      const { files, dropped } = packContext(base, candidates)

      const input: ReviewPromptInput = { ...base, contextFiles: files }

      return {
        kind: 'ok',
        input,
        inputTokens: estimateTokens(buildReviewPrompt(input)),
        droppedContextFiles: dropped,
      }
    } finally {
      await cleanup()
    }
  }
}
