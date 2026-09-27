import type { SpeechLine } from '../../adventure/types'
import { R55_ENDING_BRCG, R55_ENDING_DEFAULT, R55_SOURCE_SLICE_INVENTORY, r55SpeechByEvent, r55SpeechBySourceSlice } from './production'

function sourceEntrypoint(eventKey: string, startIndex: number): SpeechLine[] {
  const slice = R55_SOURCE_SLICE_INVENTORY.find(candidate => candidate.eventKey === eventKey && candidate.startIndex === startIndex)
  if (!slice) throw new Error(`R55 runtime adapter source entrypoint is unavailable: ${eventKey}[${startIndex}]`)
  return r55SpeechBySourceSlice(slice.routeId)
}

export type HeroTerminalRoute = 'PREBRIEF_INITIAL' | 'PREBRIEF_REPEAT' | 'PREBRIEF_REENTRY' | 'DELTA_1' | 'DELTA_2' | 'THEORY_RESOLUTION'

export function heroTerminalSpeech(route: HeroTerminalRoute): SpeechLine[] {
  if (route === 'PREBRIEF_INITIAL') return sourceEntrypoint('COPY.HERO:Prebrief entry — authorized, no Euler file, no BRCG lead', 0)
  if (route === 'PREBRIEF_REPEAT') return sourceEntrypoint('COPY.HERO:Prebrief entry — authorized, no Euler file, no BRCG lead', 1)
  if (route === 'PREBRIEF_REENTRY') return sourceEntrypoint('COPY.HERO:Prebrief entry — authorized, no Euler file, no BRCG lead', 2)
  if (route === 'DELTA_1') return r55SpeechByEvent('COPY.HERO:Evidence Delta 1')
  if (route === 'DELTA_2') return r55SpeechByEvent('COPY.HERO:Evidence Delta 2')
  return r55SpeechByEvent('COPY.HERO:Theory resolution')
}

export function brcgTerminalSpeech(state: 'UNTESTED' | 'RESOLVED'): SpeechLine[] {
  return r55SpeechByEvent(state === 'RESOLVED' ? 'COPY.BRCG:BRCG resolved' : 'COPY.BRCG:Read, BRCG untested')
}

export function endingVariantSpeechForStatus(brcgResolved: boolean): SpeechLine[] {
  return brcgResolved ? R55_ENDING_BRCG : R55_ENDING_DEFAULT
}
