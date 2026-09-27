import type { DialogueDisplay, SpeechLine } from './types'

export const FULL_TYPEWRITER_EXCEPTION = {
  copyKey: 'r55-06f7c85f1a47a3c7bf5f',
  eventKey: 'COPY.BACKGROUND:First global reach of maximum speed',
  text: 'Wheeeeeeee!',
} as const

export function isFullTypewriterException(line: Pick<SpeechLine, 'copyKey' | 'text' | 'finalScriptSource' | 'r55Source'>) {
  const eventKey = line.finalScriptSource?.eventKey ?? line.r55Source?.eventKey
  return line.copyKey === FULL_TYPEWRITER_EXCEPTION.copyKey
    && eventKey === FULL_TYPEWRITER_EXCEPTION.eventKey
    && line.text === FULL_TYPEWRITER_EXCEPTION.text
}

export function speechShouldReveal(line: SpeechLine, display: DialogueDisplay, instantText: boolean) {
  if (instantText) return false
  return display === 'TYPED' || isFullTypewriterException(line)
}

export function initialVisibleCharacters(line: SpeechLine, display: DialogueDisplay, instantText: boolean) {
  return speechShouldReveal(line, display, instantText) ? 0 : line.text.length
}

export function effectiveReadingDisplay(line: SpeechLine, display: DialogueDisplay, instantText: boolean): DialogueDisplay {
  return speechShouldReveal(line, display, instantText) ? 'TYPED' : 'FULL'
}
