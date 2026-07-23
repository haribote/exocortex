import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type ContextFile, estimateTokens } from '@exocortex/contract'
import { findImporters, findImports, findRelatedDocs } from './related.js'

export interface CollectOptions {
  root: string
  changedFiles: string[]
  diff: string
  budgetTokens: number
}

export interface CollectResult {
  files: ContextFile[]
  dropped: number
}

const RULE_FILES = ['CLAUDE.md', 'AGENTS.md', 'biome.json', '.eslintrc.json']

export function collectContext(options: CollectOptions): CollectResult {
  const { root, changedFiles } = options

  const rules = RULE_FILES.filter((name) => existsSync(join(root, name)))
  const docs = findRelatedDocs(root, changedFiles)
  const importers = changedFiles.flatMap((file) => findImporters(root, file))
  const imports = changedFiles.flatMap((file) => findImports(root, file))

  const ordered = [...changedFiles, ...rules, ...docs, ...importers, ...imports]

  const seen = new Set<string>()
  const files: ContextFile[] = []
  let used = estimateTokens(options.diff)
  let dropped = 0

  for (const path of ordered) {
    if (seen.has(path)) continue
    seen.add(path)

    const full = join(root, path)
    if (!existsSync(full)) continue

    const content = readFileSync(full, 'utf8')
    const cost = estimateTokens(content)
    if (used + cost > options.budgetTokens) {
      dropped++
      continue
    }

    files.push({ path, content })
    used += cost
  }

  return { files, dropped }
}
