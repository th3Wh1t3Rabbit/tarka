import projection from './generated/r55-production.json' with { type: 'json' }
import type { SpeechLine } from '../../adventure/types'
import { finalScriptHasEvent, finalSpeechByEvent, finalSpeechBySourceNode } from '../s17/finalScript'

export type R55EventKey = keyof typeof projection.aliases
export type R55SourceEventKey = (typeof projection.events)[number]['key']
export type R55SourceSliceId = (typeof projection.sourceSlices)[number]['routeId']
export type SideLeadCompletion = 'RESOLVED' | 'BRCG_UNRESOLVED' | 'NOTE_UNRESOLVED' | 'UNDISCOVERED'

const events = new Map(projection.events.map(event => [event.key, event]))
const sourceSlices = new Map(projection.sourceSlices.map(slice => [slice.routeId, slice]))
const CUE_TRACKS: Record<string, import('../../adventure/types').PerformanceTrackId> = {
  EXPRESSION: 'FACE', GAZE: 'GAZE', MOVEMENT: 'BODY', STAGE: 'BODY', PROP: 'PROP', STAMP: 'PROP', BEAT: 'TIME', TIME: 'TIME', VOICE_TEXT: 'VOICE_TEXT',
}
const cueTrack = (intent: string): import('../../adventure/types').PerformanceTrackId | null => CUE_TRACKS[intent] ?? null

type ProjectionLine = {
  nodeId: string
  ledgerId: string
  speaker: string | null
  text: string
  source: {
    path: string
    byteStart: number
    byteEnd: number
    lineStart: number
    lineEnd: number
  }
  sourceHashes: {
    memberSha256: string
    rawSha256: string
    displaySha256: string
  }
  cues: readonly {
    actor: string | null
    intent: string
    selectedClip: string | null
    fallback: boolean
    fallbackReason: string | null
  }[]
}

export function r55EventBySourceKey(eventKey: R55SourceEventKey) {
  const event = events.get(eventKey)
  if (!event) throw new Error(`Required R55 source event is unavailable: ${eventKey}`)
  return event
}

export function r55SourceSlice(routeId: R55SourceSliceId) {
  const slice = sourceSlices.get(routeId)
  if (!slice) throw new Error(`Required R55 source slice is unavailable: ${routeId}`)
  return slice
}

export function r55Event(key: R55EventKey) {
  const owner = projection.aliases[key]
  const event = events.get(owner)
  if (!event) throw new Error(`Required R55 production event is unavailable: ${key}`)
  return event
}

function toSpeech(eventKey: string, line: ProjectionLine): SpeechLine {
  return {
    speaker: line.speaker === 'ARTHUR' ? 'MR_INDEX' : line.speaker === 'ROOK' ? 'ROOK' : 'SYSTEM',
    text: line.text,
    copyKey: line.nodeId,
    r55Source: { eventKey, nodeId: line.nodeId, ledgerId: line.ledgerId, source: line.source, sourceHashes: line.sourceHashes },
    performanceCues: line.cues.map((cue, index) => ({
      cueId: `${line.nodeId}:cue:${index + 1}`,
      actor: cue.actor === 'rook' || cue.actor === 'arthur' ? cue.actor : null,
      intent: cue.intent,
      selectedClip: cue.selectedClip,
      fallback: cue.fallback,
      fallbackReason: cue.fallbackReason,
      supportedTrack: cueTrack(cue.intent),
    })),
  }
}

export function r55SpeechByEvent(eventKey: R55SourceEventKey): SpeechLine[] {
  if (finalScriptHasEvent(eventKey)) return finalSpeechByEvent(eventKey)
  return (r55EventBySourceKey(eventKey).lines as readonly ProjectionLine[]).map(line => toSpeech(eventKey, line))
}

export function r55SpeechBySourceSlice(routeId: R55SourceSliceId): SpeechLine[] {
  const slice = r55SourceSlice(routeId)
  const lines = (r55EventBySourceKey(slice.eventKey).lines as readonly ProjectionLine[]).slice(slice.startIndex, slice.endIndex)
  if (finalScriptHasEvent(slice.eventKey)) return lines.flatMap(line => finalSpeechBySourceNode(line.nodeId))
  return lines.map(line => toSpeech(slice.eventKey, line))
}

export function r55TextByEvent(eventKey: R55SourceEventKey): string[] {
  if (finalScriptHasEvent(eventKey)) return finalSpeechByEvent(eventKey).map(line => line.text)
  return r55EventBySourceKey(eventKey).lines.map(line => line.text)
}

export function r55Speech(key: R55EventKey): SpeechLine[] {
  return r55SpeechByEvent(projection.aliases[key])
}

export const R55_OPENING = (['opening.a1_1', 'opening.a1_2', 'opening.a1_3', 'opening.a1_4', 'opening.a1_5'] as const).flatMap(r55Speech)
export const R55_ENDING_UNIVERSAL = [...r55Speech('ending.universal'), ...r55Speech('ending.friendship')]
const R55_ENDING_SHARED_PEN_REPLY = r55Speech('ending.default')
export const R55_ENDING_DEFAULT = [...R55_ENDING_SHARED_PEN_REPLY]
export const R55_ENDING_BRCG = [...R55_ENDING_SHARED_PEN_REPLY, ...r55Speech('ending.brcg')]
export const R55_BRCG_PAYOFF = r55Speech('brcg.payoff')

export const R55_BRCG = {
  symbol: projection.structured.brcg.symbol.value,
  name: projection.structured.brcg.name.value,
  contract: projection.structured.brcg.contract.value,
  quantity: projection.structured.brcg.quantity.value,
  snapshot: projection.structured.brcg.snapshot.value,
  unitPrice: projection.structured.brcg.unitPrice.value,
  theoreticalValue: projection.structured.brcg.theoreticalValue.value,
  summaryValue: projection.structured.brcg.summaryValue.value,
  liquidity: projection.structured.brcg.liquidity.value,
  exactLiquidity: projection.structured.brcg.exactLiquidity.value,
  buyers7d: projection.structured.brcg.buyers7d.value,
  sellers7d: projection.structured.brcg.sellers7d.value,
  volume7d: projection.structured.brcg.volume7d.value,
  netflow7d: projection.structured.brcg.netflow7d.value,
} as const

export const R55_E03_COUNTS = {
  q1PriorAccepted: projection.structured.e03['{{E03_Q1_PRIOR_ACCEPTED_COUNT}}'].value,
  q2PriorAccepted: projection.structured.e03['{{E03_Q2_PRIOR_ACCEPTED_COUNT}}'].value,
  q2CurrentAccepted: projection.structured.e03['{{E03_Q2_CURRENT_ACCEPTED_COUNT}}'].value,
} as const

export const R55_MISSION_02_STINGER = projection.structured.completion.stinger.map(row => row.value).join('\n\n')
export const R55_COMPLETION_SIDE_LEAD: Record<SideLeadCompletion, string> = {
  RESOLVED: projection.structured.completion.sideLead.RESOLVED.value,
  BRCG_UNRESOLVED: projection.structured.completion.sideLead.BRCG_UNRESOLVED.value,
  NOTE_UNRESOLVED: projection.structured.completion.sideLead.NOTE_UNRESOLVED.value,
  UNDISCOVERED: projection.structured.completion.sideLead.UNDISCOVERED.value,
}
export const R55_COMPLETION = {
  title: projection.structured.completion.title.value,
  recordLabel: projection.structured.completion.recordLabel.value,
  closedLabel: projection.structured.completion.closedLabel.value,
  caseName: projection.structured.completion.caseName.value,
  record: [projection.structured.completion.caseSolved.value, projection.structured.completion.exactReceipt.value, projection.structured.completion.findingLine1.value, projection.structured.completion.findingLine2.value].join('\n\n'),
  unresolvedPrompt: projection.structured.completion.unresolvedPrompt.map(row => row.value).join('\n'),
  competition: projection.structured.completion.competition.map(row => row.value).join('\n\n'),
  attribution: projection.structured.completion.attribution.value,
  thanks: projection.structured.completion.thanks.value,
  resetTitle: projection.structured.completion.resetTitle.value,
  resetConfirm: projection.structured.completion.resetConfirm.value,
  resetCancel: projection.structured.completion.resetCancel.value,
} as const
export const R55_SOURCE_BINDINGS = projection.structured
export const R55_SHARED_EVENT_ALIASES = projection.sharedEventAliases
/** Authenticated source inventory. This is not a runtime-route registry. */
export const R55_SOURCE_SLICE_INVENTORY = projection.sourceSlices
export const R55_PRODUCTION_IDENTITY = {
  projectionSha256: projection.projectionSha256,
  ...projection.authority,
  coverage: projection.coverage,
} as const
