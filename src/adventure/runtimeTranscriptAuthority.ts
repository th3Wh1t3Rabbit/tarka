import {
  blockedInteractions,
  deadEndSpeech,
  dialogueMenuSpeechForState,
  dialogueTopicsForState,
  hotspots,
  inventoryItems,
  inventorySpeechForState,
  itemRules,
  usefulRules,
} from './content'
import type { AdventureState, InventoryItemId, PuzzlePhase, SpeechLine } from './types'
import { VERBS } from './types'
import { PRINCIPAL_OPENING } from '../story/s15r2/principalFeedback'
import { R55_BRCG_PAYOFF, R55_ENDING_UNIVERSAL } from '../story/r55/production'
import { selectBrcgTerminalSpeech, selectEndingVariantSpeech, selectHeroTerminalSpeech } from '../app/productionCopySelectors'
import type { HeroTerminalRoute } from '../story/r55/runtimeAdapters'
import { normalizeProductionDialogue } from './dialogueDelivery'

export interface RuntimeTranscriptDelivery {
  routeId: string
  deliveryOrder: number
  deliveryId: string
  sourceDeliveryId: string
  speaker: SpeechLine['speaker']
  text: string
  beatBeforeMs: number
  beatAfterMs: number
  performance: readonly string[]
  sourceAuthority: string
}

export interface RuntimeTranscriptRoute {
  routeId: string
  owner: string
  lines: readonly SpeechLine[]
  deliveries: readonly RuntimeTranscriptDelivery[]
}

const itemIds = Object.keys(inventoryItems) as InventoryItemId[]
const phases: PuzzlePhase[] = ['START', 'FORM_HELD', 'PEN_HELD', 'FORM_AND_PEN', 'FORM_COMPLETED', 'FORM_SUBMITTED', 'COMPLETE']
const heroRoutes: HeroTerminalRoute[] = ['PREBRIEF_INITIAL', 'PREBRIEF_REPEAT', 'PREBRIEF_REENTRY', 'DELTA_1', 'DELTA_2', 'THEORY_RESOLUTION']

function deliveryId(line: SpeechLine, order: number) {
  return line.copyKey ?? line.finalScriptSource?.sourceNodeId ?? line.r55Source?.nodeId ?? `delivery-${order}`
}

function sourceDeliveryId(line: SpeechLine, order: number) {
  return line.sourceCopyKey ?? line.finalScriptSource?.sourceRecordId ?? line.r55Source?.nodeId ?? line.copyKey ?? `delivery-${order}`
}

function sourceAuthority(line: SpeechLine) {
  if (line.finalScriptSource) return `FINAL_SCRIPT:${line.finalScriptSource.eventKey}:${line.finalScriptSource.sourceNodeId}`
  if (line.r55Source) return `R55:${line.r55Source.eventKey}:${line.r55Source.nodeId}:${line.r55Source.sourceHashes.displaySha256}`
  return `${line.authority ?? 'RUNTIME'}:${line.copyKey ?? 'UNKEYED'}`
}

function route(routeId: string, owner: string, lines: readonly SpeechLine[]): RuntimeTranscriptRoute {
  // Mirror the reducer's player-visible dialogue normalization exactly. This
  // audit manifest records authored deliveryParts, provisional wrapping,
  // trademark cleanup, and adjacent duplicate suppression from the effective
  // runtime owners instead of describing only their pre-render source arrays.
  const effectiveLines = normalizeProductionDialogue(lines).filter((line, index, all) => index === 0 || line.speaker !== all[index - 1]!.speaker || line.text !== all[index - 1]!.text)
  const deliveries = effectiveLines.map((line, index) => ({
      routeId,
      deliveryOrder: index + 1,
      deliveryId: deliveryId(line, index + 1),
      sourceDeliveryId: sourceDeliveryId(line, index + 1),
      speaker: line.speaker,
      text: line.text,
      beatBeforeMs: line.beatBeforeMs ?? 0,
      beatAfterMs: line.beatAfterMs ?? 0,
      performance: (line.performanceCues ?? []).map(cue => `${cue.actor ?? 'none'}:${cue.supportedTrack ?? 'none'}:${cue.selectedClip ?? cue.intent}`),
      sourceAuthority: sourceAuthority(line),
  }))
  const identities = new Set(deliveries.map(delivery => delivery.deliveryId))
  if (identities.size !== deliveries.length) throw new Error(`RUNTIME_TRANSCRIPT_DUPLICATE_DELIVERY_ID:${routeId}`)
  return {
    routeId,
    owner,
    lines: effectiveLines,
    deliveries,
  }
}

const commonState = {
  phase: 'COMPLETE' as const,
  caseFileDrawer: 'OPEN' as const,
  miscDrawer: 'OPEN' as const,
  caseStack: 'UNSEARCHED' as const,
  miscContents: 'UNCOLLECTED' as const,
  globePose: 'IDLE' as const,
  globeLevel: 0 as const,
  globeMilestones: 0,
  lampPower: 'ON' as const,
  lampSpeech: 0 as const,
  piggyNoteReadState: 'BACK_READ' as const,
  brcgInvestigationState: 'UNTESTED' as const,
  investigationMilestone: 'BEFORE_Q1' as const,
  lastInteractionId: null,
}

function buildRoutes(): RuntimeTranscriptRoute[] {
  const routes: RuntimeTranscriptRoute[] = [route('opening.principal', 'PRINCIPAL_OPENING', PRINCIPAL_OPENING)]

  for (const rule of usefulRules) routes.push(route(`useful.${rule.id}`, `usefulRules:${rule.id}`, rule.speech))
  for (const rule of itemRules) routes.push(route(`item.${rule.id}`, `itemRules:${rule.id}`, rule.speech))
  for (const blocked of blockedInteractions) routes.push(route(`blocked.${blocked.verb}.${blocked.targetId}.${blocked.itemId}`, 'blockedInteractions', blocked.speech ?? [{ speaker: 'ROOK', text: blocked.text, copyKey: blocked.copyKey }]))

  for (const target of hotspots) for (const verb of VERBS) {
    routes.push(route(`world.${verb}.${target.id}.bare`, 'deadEndSpeech', deadEndSpeech(verb, target.id, null, commonState)))
    if (verb === 'USE' || verb === 'GIVE') for (const itemId of itemIds) {
      routes.push(route(`world.${verb}.${target.id}.item.${itemId}`, 'deadEndSpeech:selected-item', deadEndSpeech(verb, target.id, itemId, commonState)))
    }
  }

  for (const itemId of itemIds) for (const verb of VERBS) {
    routes.push(route(`inventory.${verb}.${itemId}`, 'inventorySpeechForState', inventorySpeechForState(itemId, verb, commonState)))
  }
  for (const source of itemIds) for (const target of itemIds) if (source !== target) {
    routes.push(route(`inventory.USE.${source}.with.${target}`, 'inventorySpeechForState:item-pair', inventorySpeechForState(source, 'USE', commonState, target)))
  }

  for (const phase of phases) {
    routes.push(route(`dialogue.${phase}.menu`, 'dialogueMenuSpeechForState', dialogueMenuSpeechForState(phase)))
    const inventory = phase === 'COMPLETE' ? ['euler-case-file'] as InventoryItemId[] : []
    const initial = dialogueTopicsForState({ phase, inventory, exhaustedTopics: [], investigationMilestone: 'BEFORE_Q1' })
    const repeats = dialogueTopicsForState({ phase, inventory, exhaustedTopics: initial.map(topic => topic.id), investigationMilestone: 'BEFORE_Q1' })
    for (const topic of initial) routes.push(route(`dialogue.${phase}.${topic.id}.initial`, 'dialogueTopicsForState', topic.lines))
    for (const topic of repeats) routes.push(route(`dialogue.${phase}.${topic.id}.repeat`, 'dialogueTopicsForState:repeat', topic.lines))
  }

  for (const hero of heroRoutes) routes.push(route(`hero.${hero}`, 'selectHeroTerminalSpeech', selectHeroTerminalSpeech(hero)))
  for (const state of ['UNTESTED', 'RESOLVED'] as const) routes.push(route(`brcg.${state}`, 'selectBrcgTerminalSpeech', selectBrcgTerminalSpeech(state)))
  routes.push(route('ending.universal', 'R55_ENDING_UNIVERSAL', R55_ENDING_UNIVERSAL))
  routes.push(route('ending.variant.default', 'selectEndingVariantSpeech', selectEndingVariantSpeech(false)))
  routes.push(route('ending.variant.brcg', 'selectEndingVariantSpeech', selectEndingVariantSpeech(true)))
  routes.push(route('ending.brcg-payoff', 'R55_BRCG_PAYOFF', R55_BRCG_PAYOFF))
  return routes
}

/**
 * Executable, deterministic audit manifest generated from the effective
 * player-facing runtime owners. Production dispatch remains in content.ts,
 * reducer.ts, the final-script adapters, and route selectors. The permanent
 * test suite pins this mirror's serialized digest so changing an owner, line,
 * beat, cue, or source identity requires an explicit review.
 */
export const RUNTIME_TRANSCRIPT_AUTHORITY = buildRoutes()
export const RUNTIME_TRANSCRIPT_DELIVERIES = RUNTIME_TRANSCRIPT_AUTHORITY.flatMap(candidate => candidate.deliveries)

export function runtimeTranscriptRoute(routeId: string) {
  return RUNTIME_TRANSCRIPT_AUTHORITY.find(candidate => candidate.routeId === routeId) ?? null
}

export function transcriptLines(state: Pick<AdventureState, 'speech' | 'nonblockingSpeech' | 'activeSequence'>) {
  return state.speech?.lines ?? state.nonblockingSpeech?.lines ?? state.activeSequence?.pendingSpeech ?? []
}

export const TRANSCRIPT_MANIFEST_POLICY = {
  schemaVersion: 's17-p2-r3-runtime-transcript-v1',
  windowFloor: 8,
  vhsAllowedRoutes: RUNTIME_TRANSCRIPT_AUTHORITY.filter(candidate => candidate.lines.some(line => /VHS|videotape|doesn.t play them/i.test(line.text))).map(candidate => candidate.routeId),
} as const
