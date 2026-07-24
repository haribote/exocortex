export interface DeltaTrimmer {
  push(delta: string): string
}

export function createDeltaTrimmer(): DeltaTrimmer {
  let leading = true
  let held = ''

  return {
    push(delta) {
      const text = leading ? delta.trimStart() : delta
      if (leading) {
        if (text === '') {
          return ''
        }
        leading = false
      }

      const kept = text.trimEnd()
      if (kept === '') {
        held += text
        return ''
      }

      const emitted = held + kept
      held = text.slice(kept.length)
      return emitted
    },
  }
}
