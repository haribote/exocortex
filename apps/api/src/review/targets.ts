import { existsSync } from 'node:fs'
import { extname, join } from 'node:path'

export interface SelectTargetsOptions {
  root: string
  changedFiles: readonly string[]
  language: string
}

export interface SelectedTargets {
  targets: string[]
  skipped: number
}

const SCRIPT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']

const EXTENSIONS_BY_LANGUAGE: Record<string, readonly string[]> = {
  typescript: SCRIPT_EXTENSIONS,
  javascript: SCRIPT_EXTENSIONS,
}

export function selectTargets(options: SelectTargetsOptions): SelectedTargets {
  const { root, changedFiles, language } = options
  const normalized = language.trim().toLowerCase()
  const extensions = EXTENSIONS_BY_LANGUAGE[normalized]

  const targets: string[] = []
  let skipped = 0

  for (const file of changedFiles) {
    const full = join(root, file)

    if (!existsSync(full)) {
      skipped += 1
      continue
    }

    // A language with no table entry reviews everything that still exists.
    // Filtering it down to nothing would answer with an empty review, which
    // reads as "no problems found" rather than "nothing was looked at".
    if (extensions === undefined) {
      targets.push(file)
      continue
    }

    if (extensions.includes(extname(file).toLowerCase())) {
      targets.push(file)
    } else {
      skipped += 1
    }
  }

  return { targets, skipped }
}
