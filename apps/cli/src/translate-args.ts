import { parseArgs } from 'node:util'
import { type LanguageCode, languageCodeSchema } from '@exocortex/contract'

export const TRANSLATE_USAGE = `Usage: exoc-translate --from <lang> --to <lang> [text]

  --from <lang>  source language: ja or en
  --to <lang>    target language: ja or en
  --json         print the raw response as JSON
  --help         show this message

Reads the text from stdin when no text argument is given.`

export interface TranslateOptions {
  from: LanguageCode
  to: LanguageCode
  text: string | undefined
  json: boolean | undefined
}

export type ParsedTranslateOptions =
  | { ok: true; help: true }
  | { ok: true; help: false; options: TranslateOptions }
  | { ok: false; message: string }

function parseLanguage(flag: string, value: unknown): LanguageCode {
  if (value === undefined) {
    throw new Error(`${flag} is required: pass ja or en`)
  }
  const parsed = languageCodeSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`${flag} must be ja or en, got ${String(value)}`)
  }
  return parsed.data
}

export function parseTranslateOptions(args: string[]): ParsedTranslateOptions {
  try {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        from: { type: 'string' },
        to: { type: 'string' },
        json: { type: 'boolean' },
        help: { type: 'boolean' },
      },
    })

    if (values.help) {
      return { ok: true, help: true }
    }

    return {
      ok: true,
      help: false,
      options: {
        from: parseLanguage('--from', values.from),
        to: parseLanguage('--to', values.to),
        text: positionals.length > 0 ? positionals.join(' ') : undefined,
        json: values.json,
      },
    }
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : String(cause),
    }
  }
}
