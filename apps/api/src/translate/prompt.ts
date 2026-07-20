import type { LanguageCode, TranslateRequest } from '@exocortex/contract'

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  ja: 'Japanese',
  en: 'English',
}

export function buildTranslatePrompt(request: TranslateRequest): string {
  const source = LANGUAGE_NAMES[request.from]
  const target = LANGUAGE_NAMES[request.to]

  return (
    `You are a professional ${source} (${request.from}) to ${target} (${request.to}) translator. ` +
    `Your goal is to accurately convey the meaning and nuances of the original ${source} text ` +
    `while adhering to ${target} grammar, vocabulary, and cultural sensitivities.\n` +
    `Produce only the ${target} translation, without any additional explanations or commentary. ` +
    `Please translate the following ${source} text into ${target}:\n\n\n${request.text}`
  )
}
