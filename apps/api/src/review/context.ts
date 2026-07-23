import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ContextFile } from '@exocortex/contract'
import { findImporters, findImports, findRelatedDocs } from './related.js'

const RULE_FILES = ['CLAUDE.md', 'AGENTS.md', 'biome.json', '.eslintrc.json']

// Ordered by priority: changed files, then project rules, related docs,
// importers, and imports. Budget packing happens later in packContext.
export function collectCandidates(
  root: string,
  changedFiles: string[],
): ContextFile[] {
  const rules = RULE_FILES.filter((name) => existsSync(join(root, name)))
  const docs = findRelatedDocs(root, changedFiles)
  const importers = changedFiles.flatMap((file) => findImporters(root, file))
  const imports = changedFiles.flatMap((file) => findImports(root, file))

  const ordered = [...changedFiles, ...rules, ...docs, ...importers, ...imports]

  const seen = new Set<string>()
  const files: ContextFile[] = []

  for (const path of ordered) {
    if (seen.has(path)) continue
    seen.add(path)

    const full = join(root, path)
    if (!existsSync(full)) continue

    files.push({ path, content: readFileSync(full, 'utf8') })
  }

  return files
}
