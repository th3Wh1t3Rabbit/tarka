import type { SpeechLine } from '../adventure/types'
import {
  brcgTerminalSpeech,
  endingVariantSpeechForStatus,
  heroTerminalSpeech,
  type HeroTerminalRoute,
} from '../story/r55/runtimeAdapters'

export function selectHeroTerminalSpeech(route: HeroTerminalRoute): SpeechLine[] {
  return heroTerminalSpeech(route)
}

export function selectBrcgTerminalSpeech(state: 'UNTESTED' | 'RESOLVED'): SpeechLine[] {
  return brcgTerminalSpeech(state)
}

export function selectEndingVariantSpeech(brcgResolved: boolean): SpeechLine[] {
  return endingVariantSpeechForStatus(brcgResolved)
}
