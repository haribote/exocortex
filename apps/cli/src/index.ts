#!/usr/bin/env node
import { CLI_CONTEXT_BUDGET_TOKENS } from '@exocortex/contract'
import { parseOptions, USAGE } from './args.js'
import { requestReview } from './client.js'
import { collectContext } from './collect.js'
import { formatReview } from './format.js'
import { collectDiff, repoRoot } from './git.js'

const parsed = parseOptions(process.argv.slice(2))

if (!parsed.ok) {
  console.error(parsed.message)
  console.error(USAGE)
  process.exit(1)
}

const values = parsed.options

if (values.help) {
  console.log(USAGE)
  process.exit(0)
}

const endpoint = process.env.EXOCORTEX_ENDPOINT
const token = process.env.EXOCORTEX_TOKEN

if (!endpoint || !token) {
  console.error('EXOCORTEX_ENDPOINT and EXOCORTEX_TOKEN must be set')
  process.exit(1)
}

try {
  const root = repoRoot(process.cwd())
  const { diff, changedFiles } = collectDiff({
    cwd: root,
    base: values.base,
    staged: values.staged,
  })

  if (diff.length === 0) {
    console.error('no changes to review')
    process.exit(1)
  }

  const files = collectContext({
    root,
    changedFiles,
    diff,
    budgetTokens: CLI_CONTEXT_BUDGET_TOKENS,
  })

  const response = await requestReview({
    endpoint,
    token,
    request: {
      language: values.language,
      diff,
      rules: [],
      context: { files },
    },
  })

  console.log(
    values.json ? JSON.stringify(response, null, 2) : formatReview(response),
  )
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : String(cause))
  process.exit(1)
}
