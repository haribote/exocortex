#!/usr/bin/env node
import { requestTranslate } from './client.js'
import { readEnv } from './env.js'
import { readStdin } from './stdin.js'
import { parseTranslateOptions, TRANSLATE_USAGE } from './translate-args.js'

const parsed = parseTranslateOptions(process.argv.slice(2))

if (!parsed.ok) {
  console.error(parsed.message)
  console.error(TRANSLATE_USAGE)
  process.exit(1)
}

if (parsed.help) {
  console.log(TRANSLATE_USAGE)
  process.exit(0)
}

const values = parsed.options

try {
  const { endpoint, token } = readEnv()

  const text = values.text ?? (await readStdin())

  if (text.trim().length === 0) {
    console.error('no text to translate')
    console.error(TRANSLATE_USAGE)
    process.exit(1)
  }

  const response = await requestTranslate({
    endpoint,
    token,
    request: { text, from: values.from, to: values.to },
  })

  console.log(values.json ? JSON.stringify(response, null, 2) : response.text)
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : String(cause))
  process.exit(1)
}
