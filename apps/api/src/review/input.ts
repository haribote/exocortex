import {
  CONTEXT_BUDGET_TOKENS,
  estimateTokens,
  type ReviewRequest,
} from '@exocortex/contract'
import { collectContext } from './context.js'
import { collectDiff } from './git.js'
import { buildReviewPrompt, type ReviewPromptInput } from './prompt.js'
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
      if (estimateTokens(diff) > CONTEXT_BUDGET_TOKENS) {
        return { kind: 'too_large' }
      }

      const { files, dropped } = collectContext({
        root: dir,
        changedFiles,
        diff,
        budgetTokens: CONTEXT_BUDGET_TOKENS,
      })

      const input: ReviewPromptInput = {
        language: params.language,
        diff,
        rules: params.rules,
        contextFiles: files,
      }

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
