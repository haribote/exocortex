import { parseArgs } from 'node:util'

export const USAGE = `Usage: ai-review [options]

  --base <ref>       diff against <ref> instead of the working tree
  --staged           review only staged changes
  --json             print the raw response as JSON
  --language <lang>  language passed to the reviewer (default: typescript)
  --help             show this message`

function parse(args: string[]) {
  return parseArgs({
    args,
    options: {
      base: { type: 'string' },
      staged: { type: 'boolean' },
      json: { type: 'boolean' },
      language: { type: 'string', default: 'typescript' },
      help: { type: 'boolean' },
    },
  }).values
}

export type ParsedOptions =
  | { ok: true; options: ReturnType<typeof parse> }
  | { ok: false; message: string }

export function parseOptions(args: string[]): ParsedOptions {
  try {
    return { ok: true, options: parse(args) }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : String(cause),
    }
  }
}
