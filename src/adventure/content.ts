import type { AdventureState, BlockedInteraction, BrcgInvestigationState, CaseStackState, DialogueTopic, DrawerOpenState, HotspotId, InteractionRule, InventoryItem, InventoryItemId, InvestigationMilestone, ItemRule, MiscContentsState, PuzzlePhase, R55PerformanceCue, SpeechLine, VerbId } from './types'
import { R55_OPENING, R55_SOURCE_SLICE_INVENTORY, r55SpeechByEvent, r55SpeechBySourceSlice, r55TextByEvent, type R55SourceEventKey } from '../story/r55/production'
import { hotspots } from './scenes'
import { speechForExactRoute } from './r55RouteContract'
import { FINAL_FORM_COMPLETION, FINAL_PEN_PICKUP, finalSpeechByEvent } from '../story/s17/finalScript'

export { hotspots }
export const PHASE_ORDER: PuzzlePhase[] = ['START', 'FORM_HELD', 'PEN_HELD', 'FORM_AND_PEN', 'FORM_COMPLETED', 'FORM_SUBMITTED', 'COMPLETE']
export const PROVISIONAL_OPENING: SpeechLine[] = R55_OPENING
export const LEAD_OPENING_SHELL: SpeechLine[] = R55_OPENING
export const CASE_CABINET_EXTERIOR_FALLBACK: SpeechLine[] = [{
  speaker: 'SYSTEM',
  copyKey: 'NON_R55_FALLBACK_PENDING_PRINCIPAL_POLISH.CASE_CABINET_EXTERIOR',
  text: 'OFFICIAL CASE-FILE CABINET',
}]

const event = (key: R55SourceEventKey, ...indices: number[]): SpeechLine[] => {
  if (!indices.length) return r55SpeechByEvent(key)
  return indices.flatMap(index => {
    const slice = R55_SOURCE_SLICE_INVENTORY.find(candidate => candidate.eventKey === key && candidate.startIndex === index)
    if (!slice) throw new Error(`R55 source slice does not begin at ${key}[${index}]`)
    return r55SpeechBySourceSlice(slice.routeId)
  })
}
const text = (key: R55SourceEventKey, index = 0) => r55TextByEvent(key)[index]!
const uniqueSpeech = (...groups: SpeechLine[][]) => groups.flat().filter((line, index, all) => all.findIndex((candidate) => candidate.text.replace(/\s+/g, ' ').trim() === line.text.replace(/\s+/g, ' ').trim()) === index)
export const FORM_SEQUENCE_SPEECH = {
  FORM_REVIEW: event('COPY.A1:Review dialogue').map((line) => line.copyKey === 'r55-b4dd7229323d4f112fca'
    ? {
      ...line,
      beatAfterMs: 650,
      performanceCues: [{ cueId: 'S17.ROOK.CHEEKY.FORM_REVIEW', actor: 'rook', intent: 'SILENT_CHEEKY_CAMERA_REACTION', selectedClip: 'rook.camera-cheeky-hold', fallback: false, fallbackReason: null, supportedTrack: 'FACE' }] satisfies R55PerformanceCue[],
    }
    : line),
  POST_STAMP_AUTHORIZATION: uniqueSpeech(event('COPY.A1:Stamp, return, and authorization'), event('COPY.A1:Confidential-files warning and approved continuation')),
} as const
export const CASEFILE_SEQUENCE_SPEECH = {
  CASEFILE_SEARCH: event('COPY.A2_A4:`PICK UP DISORDERLY STACK OF CONFIDENTIAL FILES`'),
  CASEFILE_RECITATION: event('COPY.A2_A4:Initial Euler-file recitation'),
} as const
export const DRAWER_SEQUENCE_SPEECH = {
  DRAWER_RUBBER_BAND: uniqueSpeech(event('COPY.A2_A4:`PICK UP MISCELLANEOUS CATCH-ALL JUNK DRAWER CONTENTS`'), event('COPY.A2_A4:Rubber band')),
  DRAWER_RUBIKS_CUBE: event('COPY.A2_A4:Rubik’s Cube'),
  DRAWER_VHS: event('COPY.A2_A4:*Sharknado 2* VHS'),
  DRAWER_PIGGY_BANK: event('COPY.A2_A4:Piggy bank'),
  DRAWER_TOOLBOX: uniqueSpeech(event('COPY.A2_A4:Do-It-Herself Small Pink Toolbox'), event('COPY.A2_A4:Retrospective justification after the fifth item'), event('COPY.A2_A4:End of collection')),
} as const
const PRINCIPAL_PEN_PICKUP = FINAL_PEN_PICKUP
const PRINCIPAL_FORM_COMPLETION = FINAL_FORM_COMPLETION
const FINAL_TOOLBOX_OPEN = finalSpeechByEvent('COPY.A2_A4:`OPEN` or `USE` toolbox')
const FINAL_TOOLBOX_OPEN_EMPTY = finalSpeechByEvent('COPY.A2_A4:`LOOK AT` open empty toolbox')
const FINAL_TOOLBOX_CLOSE = finalSpeechByEvent('COPY.INVENTORY:CLOSE after opening')
const FINAL_BROKEN_PEN_REFUSAL = finalSpeechByEvent('COPY.A1:GIVE to Arthur or attempt to return/use with inkwell')
const exactNoEffect = (id: string, copy: string): SpeechLine[] => [{ speaker: 'ROOK', text: copy, copyKey: id, deliveryParts: [copy], authority: 'FINAL_SCRIPT_RECONCILIATION' }]

export const inventoryItems: Record<InventoryItemId, InventoryItem> = {
  'blank-terminal-authorization-form': { id: 'blank-terminal-authorization-form', name: 'blank authorization form', description: text('COPY.A1:LOOK AT in inventory', 0), assetSlot: 'blank-terminal-authorization-form' },
  'loose-feather-pen': { id: 'loose-feather-pen', name: 'historical-looking feather pen', description: text('COPY.A1:LOOK AT in inventory', 2), assetSlot: 'loose-feather-pen' },
  'signed-terminal-authorization-form-with-doodles': { id: 'signed-terminal-authorization-form-with-doodles', name: 'scribbled authorization form', description: text('COPY.A1:LOOK AT', 1), assetSlot: 'signed-terminal-authorization-form-with-doodles' },
  'broken-feather-pen': { id: 'broken-feather-pen', name: 'poorly-handled broken feather pen', description: text('COPY.A1:LOOK AT', 2), assetSlot: 'broken-feather-pen' },
  'approved-stamped-terminal-authorization-form': { id: 'approved-stamped-terminal-authorization-form', name: 'approved dinosaur-doodled authorization form', description: text('COPY.A1:10. Approved-form inventory observation'), assetSlot: 'approved-stamped-terminal-authorization-form' },
  'euler-case-file': { id: 'euler-case-file', name: 'Euler case file', description: text('COPY.A2_A4:Inventory `LOOK AT EULER CASE FILE`'), assetSlot: 'euler-case-file' },
  'rubber-band': { id: 'rubber-band', name: 'rubber band', description: text('COPY.INVENTORY:LOOK AT', 1), assetSlot: 'rubber-band' },
  'rubiks-cube': { id: 'rubiks-cube', name: "Rubik's Cube", description: text('COPY.INVENTORY:LOOK AT', 2), assetSlot: 'rubiks-cube' },
  'sharknado-2-vhs': { id: 'sharknado-2-vhs', name: 'Sharknado 2 VHS', description: text('COPY.INVENTORY:LOOK AT', 3), assetSlot: 'sharknado-2-vhs' },
  'piggy-bank-intact': { id: 'piggy-bank-intact', name: 'piggy bank', description: text('COPY.INVENTORY:LOOK AT', 8), assetSlot: 'piggy-bank-intact' },
  'small-toolbox-closed': { id: 'small-toolbox-closed', name: 'small toolbox', description: text('COPY.INVENTORY:Closed LOOK AT'), assetSlot: 'small-toolbox-closed' },
  'small-toolbox-open-empty': { id: 'small-toolbox-open-empty', name: 'open empty toolbox', description: text('COPY.INVENTORY:Open-empty LOOK AT'), assetSlot: 'small-toolbox-open-empty' },
  'hammer': { id: 'hammer', name: 'hammer', description: text('COPY.INVENTORY:LOOK AT', 6), assetSlot: 'hammer' },
  'nails': { id: 'nails', name: 'nails', description: text('COPY.INVENTORY:LOOK AT', 7), assetSlot: 'nails' },
  'fictional-token-note': { id: 'fictional-token-note', name: 'office-note token lead', description: text('COPY.INVENTORY:Unread LOOK AT'), assetSlot: 'fictional-token-note' },
}

export const usefulRules: InteractionRule[] = [
  { id: 'take-form', verb: 'PICK_UP', targetId: 'blank-authorization-form', phase: 'START', nextPhase: 'FORM_HELD', addItems: ['blank-terminal-authorization-form'], speech: [] },
  { id: 'take-pen', verb: 'PICK_UP', targetId: 'pen-stand', phase: 'START', nextPhase: 'PEN_HELD', addItems: ['loose-feather-pen'], speech: PRINCIPAL_PEN_PICKUP },
  { id: 'take-form-2', verb: 'PICK_UP', targetId: 'blank-authorization-form', phase: 'PEN_HELD', nextPhase: 'FORM_AND_PEN', addItems: ['blank-terminal-authorization-form'], speech: [] },
  { id: 'take-pen-2', verb: 'PICK_UP', targetId: 'pen-stand', phase: 'FORM_HELD', nextPhase: 'FORM_AND_PEN', addItems: ['loose-feather-pen'], speech: PRINCIPAL_PEN_PICKUP },
  { id: 'give-form', verb: 'GIVE', targetId: 'mr-index', itemId: 'signed-terminal-authorization-form-with-doodles', phase: 'FORM_COMPLETED', nextPhase: 'COMPLETE', handover: { contact: 'CONTACT.FORM_HANDOFF', removeItems: ['signed-terminal-authorization-form-with-doodles'], nextPhase: 'FORM_SUBMITTED' }, addItems: ['approved-stamped-terminal-authorization-form'], speech: uniqueSpeech(FORM_SEQUENCE_SPEECH.FORM_REVIEW, FORM_SEQUENCE_SPEECH.POST_STAMP_AUTHORIZATION) },
  ...(['START', 'FORM_HELD', 'PEN_HELD', 'FORM_AND_PEN', 'FORM_COMPLETED', 'FORM_SUBMITTED'] as const).map((phase): InteractionRule => ({ id: `reprimand-${phase.toLowerCase().replaceAll('_', '-')}`, verb: 'USE', targetId: 'nansen-terminal', phase, nextPhase: phase, speech: event('COPY.A1:Every preauthorization attempt') })),
  { id: 'look-case-cabinet', verb: 'LOOK_AT', targetId: 'official-case-file-cabinet', phase: 'ANY', nextPhase: null, speech: CASE_CABINET_EXTERIOR_FALLBACK },
  { id: 'look-drawer', verb: 'LOOK_AT', targetId: 'miscellaneous-drawer-cabinet', phase: 'ANY', nextPhase: null, speech: event('COPY.A2_A4:`LOOK AT MISCELLANEOUS CATCH-ALL JUNK DRAWER CONTENTS`') },
  { id: 'open-case-drawer', verb: 'OPEN', targetId: 'official-case-file-cabinet', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'caseFileDrawer', is: 'CLOSED' }, setCaseFileDrawer: 'OPEN', speech: [] },
  { id: 'pull-case-drawer', verb: 'PULL', targetId: 'official-case-file-cabinet', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'caseFileDrawer', is: 'CLOSED' }, setCaseFileDrawer: 'OPEN', speech: [] },
  { id: 'close-case-drawer', verb: 'CLOSE', targetId: 'official-case-file-cabinet', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'caseFileDrawer', is: 'OPEN' }, setCaseFileDrawer: 'CLOSED', speech: [] },
  { id: 'push-case-drawer', verb: 'PUSH', targetId: 'official-case-file-cabinet', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'caseFileDrawer', is: 'OPEN' }, setCaseFileDrawer: 'CLOSED', speech: [] },
  { id: 'use-case-drawer-open', verb: 'USE', targetId: 'official-case-file-cabinet', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'caseFileDrawer', is: 'CLOSED' }, setCaseFileDrawer: 'OPEN', speech: [] },
  { id: 'use-case-drawer-shut', verb: 'USE', targetId: 'official-case-file-cabinet', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'caseFileDrawer', is: 'OPEN' }, setCaseFileDrawer: 'CLOSED', speech: [] },
  { id: 'look-case-stack', verb: 'LOOK_AT', targetId: 'disorderly-stack-of-confidential-files', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'caseFileDrawer', is: 'OPEN' }, speech: event('COPY.A2_A4:`LOOK AT DISORDERLY STACK OF CONFIDENTIAL FILES`') },
  { id: 'pickup-case-stack', verb: 'PICK_UP', targetId: 'disorderly-stack-of-confidential-files', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'caseFileDrawer', is: 'OPEN' }, requiresStack: 'UNSEARCHED', contactGrants: [{ contact: 'CONTACT.CASEFILE_COLLECT', addItems: ['euler-case-file'] }], drawerStateAfter: { caseStack: 'SEARCHED_EULER_REMOVED' }, speech: [...CASEFILE_SEQUENCE_SPEECH.CASEFILE_SEARCH, ...CASEFILE_SEQUENCE_SPEECH.CASEFILE_RECITATION] },
  { id: 'open-misc-drawer', verb: 'OPEN', targetId: 'miscellaneous-drawer-cabinet', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'miscDrawer', is: 'CLOSED' }, setMiscDrawer: 'OPEN', speech: [] },
  { id: 'pull-misc-drawer', verb: 'PULL', targetId: 'miscellaneous-drawer-cabinet', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'miscDrawer', is: 'CLOSED' }, setMiscDrawer: 'OPEN', speech: [] },
  { id: 'close-misc-drawer', verb: 'CLOSE', targetId: 'miscellaneous-drawer-cabinet', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'miscDrawer', is: 'OPEN' }, setMiscDrawer: 'CLOSED', speech: [] },
  { id: 'push-misc-drawer', verb: 'PUSH', targetId: 'miscellaneous-drawer-cabinet', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'miscDrawer', is: 'OPEN' }, setMiscDrawer: 'CLOSED', speech: [] },
  { id: 'use-misc-drawer-open', verb: 'USE', targetId: 'miscellaneous-drawer-cabinet', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'miscDrawer', is: 'CLOSED' }, setMiscDrawer: 'OPEN', speech: [] },
  { id: 'use-misc-drawer-shut', verb: 'USE', targetId: 'miscellaneous-drawer-cabinet', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'miscDrawer', is: 'OPEN' }, setMiscDrawer: 'CLOSED', speech: [] },
  { id: 'look-misc-contents', verb: 'LOOK_AT', targetId: 'miscellaneous-catch-all-contents', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'miscDrawer', is: 'OPEN' }, speech: event('COPY.A2_A4:`LOOK AT MISCELLANEOUS CATCH-ALL JUNK DRAWER CONTENTS`') },
  { id: 'pickup-misc-contents', verb: 'PICK_UP', targetId: 'miscellaneous-catch-all-contents', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'miscDrawer', is: 'OPEN' }, requiresMisc: 'UNCOLLECTED', contactGrants: [{ contact: 'CONTACT.DRAWER_PICKUP_1', addItems: ['rubber-band'] }, { contact: 'CONTACT.DRAWER_PICKUP_2', addItems: ['rubiks-cube'] }, { contact: 'CONTACT.DRAWER_PICKUP_3', addItems: ['sharknado-2-vhs'] }, { contact: 'CONTACT.DRAWER_PICKUP_4', addItems: ['piggy-bank-intact'] }, { contact: 'CONTACT.DRAWER_PICKUP_5', addItems: ['small-toolbox-closed'] }], drawerStateAfter: { miscContents: 'COLLECTED_GUM_REMAINS' }, speech: [...DRAWER_SEQUENCE_SPEECH.DRAWER_RUBBER_BAND, ...DRAWER_SEQUENCE_SPEECH.DRAWER_RUBIKS_CUBE, ...DRAWER_SEQUENCE_SPEECH.DRAWER_VHS, ...DRAWER_SEQUENCE_SPEECH.DRAWER_PIGGY_BANK, ...DRAWER_SEQUENCE_SPEECH.DRAWER_TOOLBOX] },
]

export const itemRules: ItemRule[] = [
  { id: 'combine-form-pen', verb: 'USE', itemId: 'blank-terminal-authorization-form', targetItemId: 'loose-feather-pen', phases: 'FORM_AND_PEN', nextPhase: 'FORM_COMPLETED', removeItems: ['blank-terminal-authorization-form', 'loose-feather-pen'], addItems: ['signed-terminal-authorization-form-with-doodles', 'broken-feather-pen'], speech: PRINCIPAL_FORM_COMPLETION },
  { id: 'open-toolbox', verb: 'OPEN', itemId: 'small-toolbox-closed', phases: 'ANY', nextPhase: null, removeItems: ['small-toolbox-closed'], addItems: ['small-toolbox-open-empty', 'hammer', 'nails'], speech: FINAL_TOOLBOX_OPEN },
  { id: 'use-toolbox', verb: 'USE', itemId: 'small-toolbox-closed', phases: 'ANY', nextPhase: null, removeItems: ['small-toolbox-closed'], addItems: ['small-toolbox-open-empty', 'hammer', 'nails'], speech: FINAL_TOOLBOX_OPEN },
  { id: 'open-toolbox-open', verb: 'OPEN', itemId: 'small-toolbox-open-empty', phases: 'ANY', nextPhase: null, removeItems: [], addItems: [], speech: exactNoEffect('S17.P2.R3.TOOLBOX.ALREADY_OPEN', 'It’s already open.') },
  { id: 'use-toolbox-open', verb: 'USE', itemId: 'small-toolbox-open-empty', phases: 'ANY', nextPhase: null, removeItems: [], addItems: [], speech: FINAL_TOOLBOX_OPEN_EMPTY },
  { id: 'smash-piggy', verb: 'USE', itemId: 'hammer', targetItemId: 'piggy-bank-intact', phases: 'ANY', nextPhase: null, removeItems: ['piggy-bank-intact'], addItems: ['fictional-token-note'], speech: finalSpeechByEvent('COPY.BRCG:Hammer + Piggy Bank') },
]

const brokenPen = FINAL_BROKEN_PEN_REFUSAL[0]!
export const blockedInteractions: BlockedInteraction[] = [
  { verb: 'GIVE', targetId: 'mr-index', itemId: 'broken-feather-pen', copyKey: brokenPen.copyKey!, text: brokenPen.text, speech: FINAL_BROKEN_PEN_REFUSAL },
  { verb: 'USE', targetId: 'pen-stand', itemId: 'broken-feather-pen', copyKey: brokenPen.copyKey!, text: brokenPen.text, speech: FINAL_BROKEN_PEN_REFUSAL },
]

const preauthTopics: DialogueTopic[] = [
  { id: 'form-reminder', label: dialogueMenuSpeechForState('START')[0]!.text, lines: [] },
  { id: 'nansen-benefit', label: dialogueMenuSpeechForState('START')[1]!.text, lines: event('COPY.A1:3. Nansen reminder topic') },
  { id: 'sports', label: dialogueMenuSpeechForState('START')[2]!.text, lines: event('COPY.A1:4. Weekend-game topic') },
  { id: 'health', label: dialogueMenuSpeechForState('START')[3]!.text, lines: event('COPY.A1:5. Health-benefits topic') },
  { id: 'leave', label: dialogueMenuSpeechForState('START')[4]!.text, lines: event('COPY.A1:6. Exit topic'), closes: true },
]
export const dialogueTopics = preauthTopics

export function dialogueMenuSpeechForState(phase: PuzzlePhase): SpeechLine[] {
  return event(phase === 'COMPLETE' ? 'COPY.ARTHUR:Postauthorization root menu' : 'COPY.A1:1. Silent Arthur topic menu')
}

function reminderFor(state: Pick<AdventureState, 'phase'>) {
  if (state.phase === 'START') return event('COPY.A1:No form collected')
  if (state.phase === 'FORM_HELD') return event('COPY.A1:Form collected, pen not collected')
  if (state.phase === 'PEN_HELD' || state.phase === 'FORM_AND_PEN') return event('COPY.A1:Form and pen available, form incomplete')
  if (state.phase === 'FORM_COMPLETED' || state.phase === 'FORM_SUBMITTED') return event('COPY.A1:Completed form available')
  return event('COPY.ARTHUR:Global Arthur fallback — approved')
}
type GuidanceState = Pick<AdventureState, 'phase' | 'inventory'> & Partial<Pick<AdventureState, 'investigationMilestone'>>
export function arthurGuidanceSpeech(state: GuidanceState): SpeechLine[] {
  if (state.phase !== 'COMPLETE') return reminderFor(state)
  if (!state.inventory.includes('euler-case-file')) return event('COPY.ARTHUR:Authorized, Euler file not collected')
  const milestone = state.investigationMilestone ?? 'BEFORE_Q1'
  if (milestone === 'AFTER_Q1') return event('COPY.ARTHUR:Question 1 complete, Question 2 incomplete')
  if (milestone === 'AFTER_Q2') return event('COPY.ARTHUR:Question 2 complete, Question 3 incomplete')
  if (milestone === 'EXACT_RECEIPT') return event('COPY.ARTHUR:Exact receipt found, proof incomplete')
  if (milestone === 'PROOF_COMPLETE') return event('COPY.ARTHUR:Proof complete, case open')
  return event('COPY.ARTHUR:Euler file collected, Question 1 incomplete')
}

export function postAuthorizationDirectionSpeech(kind: 'INITIAL' | 'REMINDER' | 'REPEAT'): SpeechLine[] {
  if (kind === 'INITIAL') return event('COPY.A2_A4:A2.1 — Post-authorization direction')
  return event('COPY.A2_A4:A2.2 — Optional Arthur reminder', kind === 'REMINDER' ? 0 : 10)
}

export function dialogueTopicsForState(state: Pick<AdventureState, 'phase' | 'exhaustedTopics' | 'inventory'> & Partial<Pick<AdventureState, 'investigationMilestone'>>): DialogueTopic[] {
  const postauthMenu = dialogueMenuSpeechForState('COMPLETE')
  const postauth: DialogueTopic[] = [
    { id: 'case-file', label: postauthMenu[0]!.text, lines: arthurGuidanceSpeech(state) },
    { id: 'nansen-benefit', label: postauthMenu[1]!.text, lines: event('COPY.ARTHUR:TELL ME AGAIN HOW NANSEN HELPS') },
    { id: 'sports', label: postauthMenu[2]!.text, lines: event('COPY.A1:4. Weekend-game topic') },
    { id: 'health', label: postauthMenu[3]!.text, lines: event('COPY.ARTHUR:SO, HOW ARE THE HEALTH BENEFITS WORKING HERE?') },
    { id: 'arthur-name', label: postauthMenu[4]!.text, lines: event('COPY.ARTHUR:CAN I CALL YOU ARTHUR YET?') },
    { id: 'leave', label: postauthMenu[5]!.text, lines: event('COPY.ARTHUR:Exit'), closes: true },
  ]
  return (state.phase === 'COMPLETE' ? postauth : preauthTopics)
    .filter(topic => topic.closes || topic.id === 'form-reminder' || topic.id === 'case-file' || !state.exhaustedTopics.includes(topic.id))
    .map(topic => topic.id === 'form-reminder' ? { ...topic, lines: state.exhaustedTopics.includes('form-reminder') ? event('COPY.A1:Repeated explicit reminder') : reminderFor(state) } : topic)
}

const backgroundLookIndex: Partial<Record<HotspotId, number>> = {
  'wall-be-the-change': 0, 'wall-think-outside': 2, 'wall-clock': 4, 'historical-clock': 4, 'wall-employee': 7,
  'wall-city-bridge': 9, 'wall-building': 11, 'wall-preserve': 12, 'wall-records-sign': 14, 'wall-not-a-number': 16,
  window: 18, 'book-shelf': 20, 'tall-books': 20, 'office-globe': 21, 'desk-lamp': 22, 'arthur-stamp': 23, 'coffee-mug': 24,
}
const backgroundTalkIndex: Partial<Record<HotspotId, number>> = {
  'wall-be-the-change': 0, 'wall-think-outside': 1, 'wall-clock': 2, 'historical-clock': 2, 'wall-employee': 4,
  'wall-city-bridge': 5, 'wall-building': 6, 'wall-preserve': 7, 'wall-records-sign': 8, 'wall-not-a-number': 9,
  window: 10, 'book-shelf': 11, 'tall-books': 11, 'office-globe': 12, 'coffee-mug': 13,
}
export interface DrawerContext {
  caseFileDrawer: DrawerOpenState
  miscDrawer: DrawerOpenState
  caseStack: CaseStackState
  miscContents: MiscContentsState
  globeLevel?: number
  globePose?: string
  globeMilestones?: number
  lampPower?: 'ON' | 'OFF'
  lampSpeech?: 0 | 1 | 2
  phase?: PuzzlePhase
  investigationMilestone?: InvestigationMilestone
  brcgInvestigationState?: BrcgInvestigationState
  piggyNoteReadState?: 'UNREAD' | 'BACK_READ'
}
const CLOSED_DRAWERS: DrawerContext = { caseFileDrawer: 'CLOSED', miscDrawer: 'CLOSED', caseStack: 'UNSEARCHED', miscContents: 'UNCOLLECTED' }
const UNREACHABLE_WALLS = new Set<HotspotId>(['wall-be-the-change', 'wall-think-outside', 'wall-clock', 'historical-clock', 'wall-city-bridge', 'wall-building', 'wall-records-sign'])
const PHYSICAL_WALL_VERBS = new Set<VerbId>(['GIVE', 'PICK_UP', 'USE', 'OPEN', 'CLOSE', 'PUSH', 'PULL'])
const BLANK_FORM_PUSH_PULL_SPEECH: readonly SpeechLine[] = [
  { speaker: 'ROOK', text: 'If I could, I’d turn this into an origami swan...', copyKey: 'TRG-I-blank-terminal-authorization-form-06.1', deliveryParts: ['If I could, I’d turn this into an origami swan...'], authority: 'PRINCIPAL_S17_DELTA' },
  { speaker: 'ROOK', text: 'but I still need it for the case.', copyKey: 'TRG-I-blank-terminal-authorization-form-06.2', deliveryParts: ['but I still need it for the case.'], authority: 'PRINCIPAL_S17_DELTA' },
]

export const INCOMPATIBLE_USE_FALLBACK_BAG = [
  'I don’t think so.',
  'Those don’t really go together.',
  'I don’t see how that helps us with the case.',
  'That feels like a bad idea.',
  'I should probably keep those separate.',
] as const
export const INVENTORY_TALK_FALLBACK_BAG = [
  'I have a feeling it doesn’t want to hear what I have to say.',
  'I should be focusing on the case... instead of making small talk with inanimate objects.',
  'I think this conversation would be a little one-sided.',
  'We’re not on speaking terms.',
] as const

function stableFallbackIndex(identity: string, count: number): number {
  let hash = 2166136261
  for (let index = 0; index < identity.length; index += 1) hash = Math.imul(hash ^ identity.charCodeAt(index), 16777619)
  return (hash >>> 0) % count
}
function approvedFallback(bagId: string, bag: readonly string[], identity: string): SpeechLine[] {
  const index = stableFallbackIndex(identity, bag.length)
  const text = bag[index]!
  return [{ speaker: 'ROOK', text, copyKey: `${bagId}.${index + 1}`, deliveryParts: [text], authority: 'FINAL_APPROVED_FALLBACK_CONTRACT' }]
}
export function incompatibleUseFallback(itemId: InventoryItemId, targetId: string): SpeechLine[] {
  return approvedFallback('FALLBACK.USE.INCOMPATIBLE.V1', INCOMPATIBLE_USE_FALLBACK_BAG, `${itemId}:USE:${targetId}`)
}
export function inventoryTalkFallback(itemId: InventoryItemId): SpeechLine[] {
  if (itemId === 'fictional-token-note') return [
    { speaker: 'ROOK', text: 'I should be focusing on the case...', copyKey: 'FALLBACK.TALK.INVENTORY.V1.2a', deliveryParts: ['I should be focusing on the case...'], authority: 'FINAL_APPROVED_FALLBACK_CONTRACT' },
    { speaker: 'ROOK', text: 'instead of making small talk with inanimate objects.', copyKey: 'FALLBACK.TALK.INVENTORY.V1.2b', deliveryParts: ['instead of making small talk with inanimate objects.'], authority: 'FINAL_APPROVED_FALLBACK_CONTRACT' },
  ]
  return approvedFallback('FALLBACK.TALK.INVENTORY.V1', INVENTORY_TALK_FALLBACK_BAG, `${itemId}:TALK_TO`)
}

export function deadEndSpeech(verb: VerbId, targetId: HotspotId, itemId: InventoryItemId | null, state: DrawerContext = CLOSED_DRAWERS): SpeechLine[] {
  const reachableFallback = (...texts: string[]): SpeechLine[] => texts.map((copy, index) => ({ speaker: 'ROOK', text: copy, copyKey: `S17.REACHABILITY.${targetId}.${verb}.${index + 1}`, deliveryParts: [copy], authority: 'FINAL_SCRIPT_RECONCILIATION' }))
  if (targetId === 'filing-drawers' && verb === 'LOOK_AT' && !itemId) return CASE_CABINET_EXTERIOR_FALLBACK
  if (targetId === 'mr-index' && verb === 'LOOK_AT' && !itemId) return [
    { speaker: 'ROOK', text: 'Arthur the Archivist. Officially, and chronically, unimpressed.', copyKey: 'S17.LATE.LOOK_ARTHUR.1', deliveryParts: ['Arthur the Archivist. Officially, and chronically, unimpressed.'], authority: 'PRINCIPAL_S17_DELTA' },
    { speaker: 'ROOK', text: 'And soon to be my new bestie.', copyKey: 'S17.LATE.LOOK_ARTHUR.2', deliveryParts: ['And soon to be my new bestie.'], authority: 'PRINCIPAL_S17_DELTA' },
  ]
  if (targetId === 'nansen-terminal' && verb === 'LOOK_AT' && !itemId) return [
    { speaker: 'ROOK', text: 'Boy, they sure don’t make them like they used to.', copyKey: 'S17.LATE.LOOK_TERMINAL.1', deliveryParts: ['Boy, they sure don’t make them like they used to.'], authority: 'PRINCIPAL_S17_DELTA' },
    { speaker: 'ROOK', text: 'I bet this thing was the terminal to have in its heyday.', copyKey: 'S17.LATE.LOOK_TERMINAL.2', deliveryParts: ['I bet this thing was the terminal to have in its heyday.'], emphasis: [{ start: 21, end: 24 }], authority: 'PRINCIPAL_S17_DELTA' },
    { speaker: 'ROOK', text: 'Now... it gets by more on its charm than performance.', copyKey: 'S17.LATE.LOOK_TERMINAL.3', deliveryParts: ['Now... it gets by more on its charm than performance.'], authority: 'PRINCIPAL_S17_DELTA' },
    { speaker: 'ROOK', text: 'But hey, so long as it has Nansen™ access...', copyKey: 'S17.LATE.LOOK_TERMINAL.4', deliveryParts: ['But hey, so long as it has Nansen™ access...'], authority: 'PRINCIPAL_S17_DELTA' },
    { speaker: 'ROOK', text: 'it’s supercharged, and a critical component in our investigation.', copyKey: 'S17.LATE.LOOK_TERMINAL.5', deliveryParts: ['it’s supercharged, and a critical component in our investigation.'], authority: 'PRINCIPAL_S17_DELTA' },
  ]
  if (targetId === 'nansen-terminal' && verb === 'TALK_TO' && !itemId) return [
    { speaker: 'ROOK', text: 'Access main program grid.', copyKey: 'S17.P08.TERMINAL_TALK.ROOK', deliveryParts: ['Access main program grid.'], authority: 'PRINCIPAL_S17_DELTA' },
    { speaker: 'TERMINAL', text: '* AH-AH-AH *', copyKey: 'S17.P08.TERMINAL_TALK.REPLY_1', deliveryParts: ['* AH-AH-AH *'], literalMarkup: true, authority: 'PRINCIPAL_S17_DELTA' },
    { speaker: 'TERMINAL', text: "* YOU DIDN'T SAY THE MAGIC WORD! *", copyKey: 'S17.P08.TERMINAL_TALK.REPLY_2', deliveryParts: ["* YOU DIDN'T SAY THE MAGIC WORD! *"], literalMarkup: true, authority: 'PRINCIPAL_S17_DELTA' },
  ]
  if (targetId === 'official-case-file-cabinet' || targetId === 'miscellaneous-drawer-cabinet') {
    const open = targetId === 'official-case-file-cabinet' ? state.caseFileDrawer === 'OPEN' : state.miscDrawer === 'OPEN'
    if (open && (verb === 'OPEN' || verb === 'PULL')) return reachableFallback('It’s already open.')
    if (!open && (verb === 'CLOSE' || verb === 'PUSH')) return reachableFallback('It’s already closed.')
  }
  if (targetId === 'disorderly-stack-of-confidential-files' && verb === 'PICK_UP' && state.caseStack === 'SEARCHED_EULER_REMOVED') return event('COPY.REPEAT:PICK UP', 0)
  if (targetId === 'miscellaneous-catch-all-contents' && verb === 'PICK_UP' && state.miscContents === 'COLLECTED_GUM_REMAINS') return event('COPY.REPEAT:PICK UP', 1)
  if (targetId === 'disorderly-stack-of-confidential-files' && verb === 'LOOK_AT' && state.caseStack === 'SEARCHED_EULER_REMOVED') return event('COPY.REPEAT:LOOK AT', 0)
  if (targetId === 'miscellaneous-catch-all-contents' && verb === 'LOOK_AT' && state.miscContents === 'COLLECTED_GUM_REMAINS') return event('COPY.REPEAT:LOOK AT', 1)
  if (targetId === 'request-dispenser' && !itemId) {
    if (verb === 'LOOK_AT') return event('COPY.A1:LOOK AT', 0)
    if (verb === 'PICK_UP') return event('COPY.A1:PICK UP', 0)
    if (verb === 'PUSH' || verb === 'PULL') return event('COPY.A1:PUSH or PULL')
    if (verb === 'OPEN') return event('COPY.A1:OPEN')
    if (verb === 'CLOSE') return event('COPY.A1:CLOSE')
    if (verb === 'USE') return event('COPY.A1:USE')
  }
  if (targetId === 'blank-authorization-form' && !itemId) {
    if (verb === 'LOOK_AT') return event('COPY.A1:LOOK AT in world', 0)
    if (verb === 'USE') return reachableFallback('I should pick it up first.')
    if (verb === 'OPEN' || verb === 'CLOSE') return event('COPY.A1:OPEN or CLOSE')
    if (verb === 'PUSH' || verb === 'PULL') return [...BLANK_FORM_PUSH_PULL_SPEECH]
  }
  if (targetId === 'pen-stand' && !itemId) {
    if (verb === 'LOOK_AT') return event('COPY.A1:LOOK AT in world', 1)
    if (verb === 'USE') return reachableFallback('I should pick it up first.')
  }
  if (targetId === 'disorderly-stack-of-confidential-files' && verb === 'LOOK_AT') return event('COPY.A2_A4:`LOOK AT DISORDERLY STACK OF CONFIDENTIAL FILES`')
  if (targetId === 'miscellaneous-catch-all-contents' && verb === 'LOOK_AT') return event('COPY.A2_A4:`LOOK AT MISCELLANEOUS CATCH-ALL JUNK DRAWER CONTENTS`')
  if (itemId === 'blank-terminal-authorization-form' && targetId === 'mr-index' && verb === 'GIVE') return event('COPY.A1:GIVE blank form to Arthur')
  if (itemId && targetId === 'mr-index' && verb === 'GIVE') return arthurItemSpeech(itemId, state)
  if (itemId === 'loose-feather-pen' && verb === 'USE' && targetId !== 'blank-authorization-form') return event('COPY.A1:USE with an incompatible target')
  // Selected inventory USE is resolved before bare-world object behavior so an
  // item can never toggle the lamp/globe or borrow another object's copy.
  if (itemId && verb === 'USE') {
    if (targetId === 'arthur-stamp' && itemId === 'signed-terminal-authorization-form-with-doodles') return event(state.phase === 'COMPLETE' ? 'COPY.BACKGROUND:USE — after approval' : 'COPY.BACKGROUND:USE or `USE BARELY LEGIBLE SIGNED AUTHORIZATION FORM WITH STAMP`')
    if (itemId === 'sharknado-2-vhs') return targetId === 'nansen-terminal' ? event('COPY.INVENTORY:USE with Case Terminal') : event('COPY.INVENTORY:Invalid USE elsewhere')
    return incompatibleUseFallback(itemId, targetId)
  }
  // A selected GIVE describes the selected object, never the target. Specific
  // Arthur/puzzle routes above remain authoritative; truly unreachable wall
  // targets retain the physical reachability response.
  if (itemId && verb === 'GIVE') {
    if (UNREACHABLE_WALLS.has(targetId) || targetId === 'wall-building') return speechForExactRoute('unreachableWall')
    return exactNoEffect(`S17.P2.R3.GIVE.${itemId}.${targetId}`, 'I should hang onto this.')
  }
  if (verb === 'LOOK_AT' && backgroundLookIndex[targetId] != null) return event('COPY.BACKGROUND:LOOK AT', backgroundLookIndex[targetId]!)
  if (verb === 'TALK_TO' && targetId === 'coffee-mug') return event('COPY.BACKGROUND:TALK TO', 13)
  if (verb === 'TALK_TO' && targetId === 'wall-be-the-change') return [...event('COPY.BACKGROUND:TALK TO', 0), ...event('COPY.BACKGROUND:TALK TO', 1)]
  if (verb === 'TALK_TO' && backgroundTalkIndex[targetId] != null) return event('COPY.BACKGROUND:TALK TO', backgroundTalkIndex[targetId]!)
  if (verb === 'PICK_UP' && targetId === 'office-globe') return event('COPY.BACKGROUND:PICK UP', 0)
  if (verb === 'PICK_UP' && targetId === 'desk-lamp') return reachableFallback('It has a permanent position on this desk.', 'I respect seniority.')
  if (verb === 'PICK_UP' && targetId === 'coffee-mug') return event('COPY.BACKGROUND:PICK UP', 2)
  if (targetId === 'office-globe' && (verb === 'PUSH' || verb === 'PULL' || verb === 'USE')) {
    const direction = verb === 'PULL' ? 'PULL' : 'PUSH'
    if (state.globePose && state.globePose !== 'IDLE' && state.globePose !== direction) return speechForExactRoute('globeReversal')
    if ((state.globeLevel ?? 0) >= 3) return speechForExactRoute('globeMaximumRepeat')
    const nextLevel = Math.min(3, (state.globeLevel ?? 0) + 1) as 1 | 2 | 3
    if (((state.globeMilestones ?? 0) & (1 << nextLevel)) !== 0) return []
    const firstReach = {
      0: 'globeSpeed1',
      1: 'globeSpeed2',
      2: 'globeMaximum',
    } as const
    return speechForExactRoute(firstReach[(state.globeLevel ?? 0) as 0 | 1 | 2])
  }
  if (targetId === 'window' && ['PICK_UP', 'USE', 'OPEN', 'CLOSE', 'PUSH', 'PULL'].includes(verb)) return event('COPY.BACKGROUND:Physical interaction')
  if ((targetId === 'book-shelf' || targetId === 'tall-books') && ['PICK_UP', 'USE', 'OPEN', 'CLOSE', 'PUSH', 'PULL'].includes(verb)) return event('COPY.BACKGROUND:PICK UP / USE / OPEN / PUSH / CLOSE / PULL')
  if (targetId === 'office-globe' && verb === 'GIVE') return event('COPY.BACKGROUND:GIVE')
  if (targetId === 'office-globe' && (verb === 'OPEN' || verb === 'CLOSE')) return event('COPY.BACKGROUND:OPEN / CLOSE')
  if (targetId === 'desk-lamp' && (verb === 'PUSH' || verb === 'PULL')) return event('COPY.BACKGROUND:PUSH or PULL', 0)
  if (targetId === 'coffee-mug' && (verb === 'PUSH' || verb === 'PULL')) return event('COPY.BACKGROUND:PUSH or PULL', 1)
  if (targetId === 'wall-city-bridge' && (verb === 'PICK_UP' || verb === 'USE')) return speechForExactRoute('cityPickUse')
  if (targetId === 'wall-records-sign' && (verb === 'PICK_UP' || verb === 'USE')) return speechForExactRoute('recordsPickUse')
  if (targetId === 'wall-not-a-number' && (verb === 'PICK_UP' || verb === 'USE')) return speechForExactRoute('stanchionPickUse')
  if (targetId === 'wall-preserve' && verb === 'PICK_UP') return speechForExactRoute('preserveShort')
  if (targetId === 'wall-preserve' && verb === 'GIVE') return reachableFallback('It’s not mine to give.')
  if (targetId === 'wall-preserve' && (verb === 'USE' || verb === 'OPEN' || verb === 'PULL')) return speechForExactRoute('preserveVault')
  if (targetId === 'wall-employee' && verb === 'PICK_UP') return speechForExactRoute('employeeRemoval')
  if (targetId === 'wall-building' && PHYSICAL_WALL_VERBS.has(verb)) return speechForExactRoute('unreachableWall')
  if (targetId === 'desk-lamp' && verb === 'USE') {
    if ((state.lampSpeech ?? 0) >= 2) return []
    return speechForExactRoute(state.lampPower === 'OFF' ? 'lampOn' : 'lampOff')
  }
  if (targetId === 'coffee-mug' && verb === 'USE') return event('COPY.BACKGROUND:USE')
  if (UNREACHABLE_WALLS.has(targetId) && PHYSICAL_WALL_VERBS.has(verb)) return speechForExactRoute('unreachableWall')
  if (targetId === 'arthur-stamp') {
    if (verb === 'TALK_TO') return reachableFallback('It probably wouldn’t respond.')
    if (verb === 'PICK_UP') return event(state.phase === 'COMPLETE' ? 'COPY.BACKGROUND:PICK UP — after authorization approval' : 'COPY.BACKGROUND:PICK UP — before authorization approval')
    if (verb === 'USE') return event(state.phase === 'COMPLETE' ? 'COPY.BACKGROUND:USE — after approval' : 'COPY.BACKGROUND:USE or `USE BARELY LEGIBLE SIGNED AUTHORIZATION FORM WITH STAMP`')
    return event('COPY.BACKGROUND:PUSH, PULL, OPEN, or CLOSE')
  }
  const correctedReachable = new Set<HotspotId>(['filing-drawers', 'request-dispenser', 'pen-stand', 'official-case-file-cabinet', 'disorderly-stack-of-confidential-files', 'miscellaneous-drawer-cabinet', 'miscellaneous-catch-all-contents', 'nansen-terminal', 'coffee-mug', 'desk-lamp', 'tall-books', 'book-shelf', 'blank-authorization-form', 'wall-employee', 'wall-preserve', 'wall-not-a-number'])
  if (correctedReachable.has(targetId) && verb === 'GIVE') return reachableFallback('It’s not mine to give.')
  if (correctedReachable.has(targetId) && verb === 'TALK_TO') return reachableFallback('It probably wouldn’t respond.')
  if ((targetId === 'wall-employee' || targetId === 'wall-preserve' || targetId === 'wall-not-a-number') && (verb === 'USE' || verb === 'PUSH' || verb === 'PULL')) return reachableFallback('That won’t help.')
  if ((targetId === 'wall-employee' || targetId === 'wall-not-a-number') && verb === 'OPEN') return reachableFallback('There’s nothing to open.')
  if ((targetId === 'wall-employee' || targetId === 'wall-preserve' || targetId === 'wall-not-a-number') && verb === 'CLOSE') return reachableFallback('There’s nothing to close.')
  if (verb === 'OPEN') return exactNoEffect('S17.P2.R3.WORLD.OPEN_NO_EFFECT', 'There’s nothing to open.')
  if (verb === 'CLOSE') return exactNoEffect('S17.P2.R3.WORLD.CLOSE_NO_EFFECT', 'There’s nothing to close.')
  if ((verb === 'PUSH' || verb === 'PULL') && itemId === 'blank-terminal-authorization-form') return [...BLANK_FORM_PUSH_PULL_SPEECH]
  if (verb === 'PUSH' || verb === 'PULL') return exactNoEffect('S17.P2.R3.WORLD.MOVE_NO_EFFECT', 'That won’t help.')
  if (verb === 'USE') return reachableFallback('That won’t help.')
  if (verb === 'LOOK_AT') return event('COPY.BACKGROUND:Global rules')
  if (verb === 'PICK_UP') return event('COPY.BACKGROUND:PICK UP / removal attempt')
  return event('COPY.BACKGROUND:Global rules')
}
export function deadEndResponse(verb: VerbId, targetId: HotspotId, itemId: InventoryItemId | null, state?: DrawerContext): string {
  return deadEndSpeech(verb, targetId, itemId, state)[0]!.text
}

export function arthurItemSpeech(itemId: InventoryItemId, state: Partial<Pick<AdventureState, 'piggyNoteReadState' | 'brcgInvestigationState'>> = {}): SpeechLine[] {
  if (itemId === 'broken-feather-pen') return FINAL_BROKEN_PEN_REFUSAL
  const simple: Partial<Record<InventoryItemId, R55SourceEventKey>> = {
    'blank-terminal-authorization-form': 'COPY.A1:GIVE blank form to Arthur',
    'signed-terminal-authorization-form-with-doodles': 'COPY.INVENTORY:GIVE to Arthur',
    'approved-stamped-terminal-authorization-form': 'COPY.INVENTORY:GIVE to Arthur',
    'loose-feather-pen': 'COPY.ARTHUR:Feather Pen — intact, before form completion',
    'euler-case-file': 'COPY.ARTHUR:Euler Case File',
    'rubber-band': 'COPY.ARTHUR:Rubber Band',
    'rubiks-cube': 'COPY.ARTHUR:Rubik’s Cube',
    'sharknado-2-vhs': 'COPY.ARTHUR:Sharknado 2 VHS',
    'piggy-bank-intact': 'COPY.ARTHUR:Intact Piggy Bank',
    'small-toolbox-closed': 'COPY.ARTHUR:Do-It-Herself Small Pink Toolbox',
    'small-toolbox-open-empty': 'COPY.ARTHUR:Do-It-Herself Small Pink Toolbox',
    hammer: 'COPY.ARTHUR:Heavy-Duty Hammer',
    nails: 'COPY.ARTHUR:Small Handful of Dainty Nails',
  }
  if (itemId === 'fictional-token-note') {
    if (state.piggyNoteReadState !== 'BACK_READ') return event('COPY.ARTHUR:Unread')
    return event(state.brcgInvestigationState === 'RESOLVED' ? 'COPY.ARTHUR:BRCG resolved' : 'COPY.ARTHUR:Read, BRCG untested')
  }
  return event(simple[itemId] ?? 'COPY.ARTHUR:Global Arthur fallback — approved')
}

type InventoryContext = Partial<Pick<AdventureState, 'investigationMilestone' | 'brcgInvestigationState' | 'piggyNoteReadState' | 'lastInteractionId'>>
export function inventorySpeechForState(itemId: InventoryItemId, verb: VerbId | null, state: InventoryContext = {}, targetItemId: InventoryItemId | null = null): SpeechLine[] {
  if (verb === 'LOOK_AT') {
    if (itemId === 'euler-case-file') {
      if (state.investigationMilestone === undefined || (state.investigationMilestone === 'BEFORE_Q1' && state.lastInteractionId !== 'INTERACTION.ITEM.look-euler-case-file')) return event('COPY.A2_A4:Inventory `LOOK AT EULER CASE FILE`')
      if (state.investigationMilestone === 'PROOF_COMPLETE' && state.lastInteractionId === 'INTERACTION.ITEM.look-euler-case-file') return event('COPY.REPEAT:Proof complete, case not yet closed')
      const progress: Record<InvestigationMilestone, R55SourceEventKey> = {
        BEFORE_Q1: 'COPY.INVENTORY:Before Question 1 is complete', AFTER_Q1: 'COPY.INVENTORY:After Question 1, before Question 2',
        AFTER_Q2: 'COPY.INVENTORY:After Question 2, before Question 3', EXACT_RECEIPT: 'COPY.INVENTORY:After Question 3, before proof assembly',
        PROOF_COMPLETE: 'COPY.INVENTORY:Proof complete, case not yet closed',
      }
      return event(progress[state.investigationMilestone ?? 'BEFORE_Q1'])
    }
    if (itemId === 'fictional-token-note') {
      if (state.piggyNoteReadState !== 'BACK_READ') return event(state.lastInteractionId === 'INTERACTION.ITEM.look-fictional-token-note' ? 'COPY.INVENTORY:Unread LOOK AT' : 'COPY.BRCG:Unread Note — LOOK AT')
      return event(state.brcgInvestigationState === 'RESOLVED' ? 'COPY.BRCG:BRCG resolved' : 'COPY.BRCG:Read, BRCG untested')
    }
    const look: Record<Exclude<InventoryItemId, 'euler-case-file' | 'fictional-token-note'>, [R55SourceEventKey, number]> = {
      'blank-terminal-authorization-form': ['COPY.A1:LOOK AT in inventory', 0],
      'loose-feather-pen': ['COPY.A1:LOOK AT in inventory', 2],
      'signed-terminal-authorization-form-with-doodles': ['COPY.A1:LOOK AT', 1],
      'broken-feather-pen': [state.lastInteractionId === 'INTERACTION.ITEM.look-broken-feather-pen' ? 'COPY.INVENTORY:LOOK AT' : 'COPY.A1:LOOK AT', state.lastInteractionId === 'INTERACTION.ITEM.look-broken-feather-pen' ? 13 : 2],
      'approved-stamped-terminal-authorization-form': [state.lastInteractionId === 'INTERACTION.ITEM.look-approved-stamped-terminal-authorization-form' ? 'COPY.INVENTORY:LOOK AT' : 'COPY.A1:10. Approved-form inventory observation', 0],
      'rubber-band': ['COPY.INVENTORY:LOOK AT', 1],
      'rubiks-cube': ['COPY.INVENTORY:LOOK AT', 2],
      'sharknado-2-vhs': ['COPY.INVENTORY:LOOK AT', 3],
      'piggy-bank-intact': state.lastInteractionId === 'INTERACTION.ITEM.look-piggy-bank-intact' ? ['COPY.INVENTORY:LOOK AT', 8] : ['COPY.A2_A4:`LOOK AT PIGGY BANK`', -1],
      'small-toolbox-closed': state.lastInteractionId === 'INTERACTION.ITEM.look-small-toolbox-closed' ? ['COPY.INVENTORY:Closed LOOK AT', 0] : ['COPY.A2_A4:`LOOK AT` closed toolbox', 0],
      'small-toolbox-open-empty': state.lastInteractionId === 'INTERACTION.ITEM.look-small-toolbox-open-empty' ? ['COPY.INVENTORY:Open-empty LOOK AT', 0] : ['COPY.A2_A4:`LOOK AT` open empty toolbox', 0],
      hammer: state.lastInteractionId === 'INTERACTION.ITEM.look-hammer' ? ['COPY.INVENTORY:LOOK AT', 6] : ['COPY.A2_A4:`LOOK AT HAMMER`', 0],
      nails: state.lastInteractionId === 'INTERACTION.ITEM.look-nails' ? ['COPY.INVENTORY:LOOK AT', 7] : ['COPY.A2_A4:`LOOK AT SMALL HANDFUL OF DAINTY NAILS`', 0],
    }
    return look[itemId][1] < 0 ? event(look[itemId][0]) : event(look[itemId][0], look[itemId][1])
  }
  if (verb === 'TALK_TO' && itemId === 'piggy-bank-intact') return event(state.lastInteractionId === 'INTERACTION.ITEM.talk_to-piggy-bank-intact' ? 'COPY.INVENTORY:TALK TO' : 'COPY.A2_A4:`TALK TO PIGGY BANK`')
  if (verb === 'TALK_TO') return inventoryTalkFallback(itemId)
  if ((verb === 'OPEN' || verb === 'CLOSE') && itemId === 'fictional-token-note') {
    const repeated = state.lastInteractionId === `INTERACTION.ITEM.${verb.toLowerCase()}-fictional-token-note`
    if (state.brcgInvestigationState === 'RESOLVED') return event(repeated ? 'COPY.INVENTORY:OPEN or CLOSE — BRCG resolved' : 'COPY.BRCG:OPEN or CLOSE — resolved')
    return event(repeated ? 'COPY.INVENTORY:OPEN or CLOSE — BRCG untested' : 'COPY.BRCG:OPEN or CLOSE — untested')
  }
  if (verb === 'CLOSE' && itemId === 'small-toolbox-open-empty') return FINAL_TOOLBOX_CLOSE
  if ((verb === 'PUSH' || verb === 'PULL') && itemId === 'blank-terminal-authorization-form') return [...BLANK_FORM_PUSH_PULL_SPEECH]
  if (verb === 'USE' && targetItemId) {
    const signedAndBroken = new Set([itemId, targetItemId])
    if (signedAndBroken.has('broken-feather-pen') && signedAndBroken.has('signed-terminal-authorization-form-with-doodles')) {
      return [{ speaker: 'ROOK', text: 'That won’t help.', copyKey: 'S17.P11.BROKEN_PEN_SIGNED_FORM', deliveryParts: ['That won’t help.'], authority: 'PRINCIPAL_S17_DELTA' }]
    }
    return incompatibleUseFallback(itemId, targetItemId)
  }
  if (verb === 'USE') {
    // This source event is the VHS-specific joke. Other inventory items,
    // especially every form state, must never fall through to it.
    if (itemId === 'sharknado-2-vhs') return event('COPY.INVENTORY:Invalid USE elsewhere')
    return incompatibleUseFallback(itemId, itemId)
  }
  if (verb === 'OPEN') return exactNoEffect('S17.P2.R3.INVENTORY.OPEN_NO_EFFECT', 'There’s nothing to open.')
  if (verb === 'CLOSE') return exactNoEffect('S17.P2.R3.INVENTORY.CLOSE_NO_EFFECT', 'There’s nothing to close.')
  if (verb === 'PUSH' || verb === 'PULL') return exactNoEffect('S17.P2.R3.INVENTORY.MOVE_NO_EFFECT', 'That won’t help.')
  return [{ speaker: 'ROOK', text: 'That won’t help.', copyKey: 'S17.P11.GENERIC_NO_EFFECT', deliveryParts: ['That won’t help.'], authority: 'PRINCIPAL_S17_DELTA' }]
}

export function isVisibleFrom(visibleFrom: PuzzlePhase, phase: PuzzlePhase) {
  return PHASE_ORDER.indexOf(phase) >= PHASE_ORDER.indexOf(visibleFrom)
}
