#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { CLI_CONTEXT_BUDGET_TOKENS } from '@exocortex/contract'
import { requestReview } from './client.js'
import { collectContext } from './collect.js'
import { formatReview } from './format.js'
import { collectDiff, repoRoot } from './git.js'

const USAGE = `Usage: ai-review [options]

  --base <ref>       diff against <ref> instead of the working tree
  --staged           review only staged changes
  --json             print the raw response as JSON
  --language <lang>  language passed to the reviewer (default: typescript)
  --help             show this message`

function parseOptions() {
  try {
    return parseArgs({
      options: {
        base: { type: 'string' },
        staged: { type: 'boolean' },
        json: { type: 'boolean' },
        language: { type: 'string', default: 'typescript' },
        help: { type: 'boolean' },
      },
    }).values
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : String(cause))
    console.error(USAGE)
    process.exit(1)
  }
}

const values = parseOptions()

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
