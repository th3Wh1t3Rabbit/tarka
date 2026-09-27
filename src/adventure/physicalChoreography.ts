import { usefulRules } from './content'
import { hotspots } from './scenes'
import type { AdventureState, HotspotId, InteractionRule, InventoryItemId, MrIndexPose, PendingInteraction, PhysicalPoseClass, PhysicalPoseDirective, RookPose, VerbId } from './types'

export type PhysicalRouteClass = 'EMPTY_HAND_CONTACT' | 'ITEM_CONTACT' | 'PAPER_HANDOFF' | 'SPEECH_ONLY_NO_REACH' | 'UNREACHABLE_PHYSICAL_REFUSAL'
export type RouteAnimationId = 'rook.reach.neutral' | 'rook.inspect-lean' | 'rook.drawer-extract' | 'rook.case-file' | 'rook.give' | 'NONE'
export interface RouteAnimationPolicy {
  poseClass: PhysicalPoseClass
  clipId: RouteAnimationId
  framePolicy: 'NEUTRAL_REACH_ONLY' | 'KEY_ITEM_ONLY' | 'PAPER_HANDOFF_ONLY' | 'NO_PHYSICAL_CLIP'
  forceJustification: null
}
export interface PhysicalChoreographyContract {
  routeId: string
  target: HotspotId
  verb: VerbId
  requiredItem: InventoryItemId | null
  classification: PhysicalRouteClass
  approachOwner: 'runtimeSession.walkPointForTarget'
  facingOwner: 'reducer.faceObject'
  poseClass: PhysicalPoseClass
  contactId: string | null
  mutationOwner: string | null
  postContactSpeechOwner: string
  animation: RouteAnimationPolicy
}

export const PHYSICAL_VERBS = new Set<VerbId>(['GIVE', 'PICK_UP', 'USE', 'OPEN', 'CLOSE', 'PUSH', 'PULL'])
const DRAWERS = new Set<HotspotId>(['official-case-file-cabinet', 'miscellaneous-drawer-cabinet'])
const UNREACHABLE = new Set<HotspotId>(['window', 'wall-clock', 'wall-be-the-change', 'wall-think-outside', 'wall-city-bridge', 'wall-building', 'wall-records-sign'])

function ruleClass(rule: InteractionRule): PhysicalRouteClass {
  if (rule.handover) return 'PAPER_HANDOFF'
  if (rule.id === 'pickup-case-stack') return 'ITEM_CONTACT'
  if (rule.verb === 'PICK_UP') return 'EMPTY_HAND_CONTACT'
  if (rule.id.startsWith('reprimand-')) return 'EMPTY_HAND_CONTACT'
  if (DRAWERS.has(rule.targetId)) return 'EMPTY_HAND_CONTACT'
  return rule.itemId ? 'ITEM_CONTACT' : 'SPEECH_ONLY_NO_REACH'
}
function poseFor(classification: PhysicalRouteClass): PhysicalPoseClass {
  if (classification === 'EMPTY_HAND_CONTACT') return 'EMPTY_HAND_REACH'
  if (classification === 'ITEM_CONTACT') return 'ITEM_REACH'
  if (classification === 'PAPER_HANDOFF') return 'PAPER_REACH'
  return 'NO_REACH'
}
export function routeAnimationPolicy(poseClass: PhysicalPoseClass): RouteAnimationPolicy {
  if (poseClass === 'EMPTY_HAND_REACH') return { poseClass, clipId: 'rook.reach.neutral', framePolicy: 'NEUTRAL_REACH_ONLY', forceJustification: null }
  if (poseClass === 'ITEM_REACH') return { poseClass, clipId: 'rook.case-file', framePolicy: 'KEY_ITEM_ONLY', forceJustification: null }
  if (poseClass === 'PAPER_REACH') return { poseClass, clipId: 'rook.give', framePolicy: 'PAPER_HANDOFF_ONLY', forceJustification: null }
  return { poseClass, clipId: 'NONE', framePolicy: 'NO_PHYSICAL_CLIP', forceJustification: null }
}
function drawerContact(rule: InteractionRule) {
  const cabinet = rule.targetId === 'official-case-file-cabinet' ? 'CASE' : 'MISC'
  const state = rule.setCaseFileDrawer ?? rule.setMiscDrawer
  return state ? `CONTACT.DRAWER.${cabinet}.${state}` : null
}
function contractForRule(rule: InteractionRule): PhysicalChoreographyContract {
  const classification = ruleClass(rule)
  // The authored repeated extraction clip belongs only to the multi-object
  // catch-all sequence. The official-file route uses the ordinary neutral
  // empty-hand reach rather than the downward pickup/extraction motion.
  const drawerExtraction = rule.id === 'pickup-misc-contents'
  const caseFileReach = rule.id === 'pickup-case-stack'
  const contactId = rule.handover?.contact ?? drawerContact(rule) ?? rule.contactGrants?.at(-1)?.contact ?? (classification === 'ITEM_CONTACT' || classification === 'EMPTY_HAND_CONTACT' ? `CONTACT.ITEM.${rule.id}` : null)
  return {
    routeId: `required.${rule.id}`, target: rule.targetId, verb: rule.verb, requiredItem: rule.itemId ?? null,
    classification, approachOwner: 'runtimeSession.walkPointForTarget', facingOwner: 'reducer.faceObject', poseClass: drawerExtraction || caseFileReach ? 'EMPTY_HAND_REACH' : poseFor(classification), contactId,
    mutationOwner: contactId ? 'reducer.advancePhysicalSequence@semantic-contact' : null,
    postContactSpeechOwner: rule.speech.length ? `usefulRules.${rule.id}.speech` : 'SILENT_STATE_CHANGE',
    animation: drawerExtraction
      ? { poseClass: 'EMPTY_HAND_REACH', clipId: 'rook.drawer-extract', framePolicy: 'NEUTRAL_REACH_ONLY', forceJustification: null }
      : caseFileReach
        ? routeAnimationPolicy('EMPTY_HAND_REACH')
      : routeAnimationPolicy(poseFor(classification)),
  }
}

const REQUIRED = usefulRules.filter(rule => PHYSICAL_VERBS.has(rule.verb)).map(contractForRule)
const DYNAMIC: PhysicalChoreographyContract[] = [
  { routeId: 'dynamic.lamp.use', target: 'desk-lamp', verb: 'USE', requiredItem: null, classification: 'EMPTY_HAND_CONTACT', approachOwner: 'runtimeSession.walkPointForTarget', facingOwner: 'reducer.faceObject', poseClass: 'EMPTY_HAND_REACH', contactId: 'CONTACT.LAMP.TOGGLE', mutationOwner: 'reducer.advancePhysicalSequence@semantic-contact', postContactSpeechOwner: 'deadEndSpeech.lamp-state', animation: routeAnimationPolicy('EMPTY_HAND_REACH') },
  ...(['USE', 'PUSH', 'PULL'] as const).map((verb): PhysicalChoreographyContract => ({ routeId: `dynamic.globe.${verb.toLowerCase()}`, target: 'office-globe', verb, requiredItem: null, classification: 'EMPTY_HAND_CONTACT', approachOwner: 'runtimeSession.walkPointForTarget', facingOwner: 'reducer.faceObject', poseClass: 'EMPTY_HAND_REACH', contactId: `CONTACT.GLOBE.${verb === 'PULL' ? 'PULL' : 'PUSH'}`, mutationOwner: 'reducer.advancePhysicalSequence@semantic-contact', postContactSpeechOwner: 'deadEndSpeech.globe-state', animation: routeAnimationPolicy('EMPTY_HAND_REACH') })),
]

/** Typed production owner. Runtime and qualification both consume these rows. */
export const PRODUCTION_PHYSICAL_CHOREOGRAPHY: readonly PhysicalChoreographyContract[] = [...REQUIRED, ...DYNAMIC]

export function resolvePhysicalPose(
  current: { rookPose: RookPose; mrIndexPose: MrIndexPose },
  directive: PhysicalPoseDirective | null,
): { rookPose: RookPose; mrIndexPose: MrIndexPose } {
  if (!directive) return { rookPose: current.rookPose, mrIndexPose: current.mrIndexPose }
  let rookPose = directive.releaseActors?.includes('ROOK') ? 'IDLE' as const : current.rookPose
  let mrIndexPose = directive.releaseActors?.includes('ARTHUR') ? 'IDLE' as const : current.mrIndexPose
  if (directive.actor === 'ROOK') {
    rookPose = directive.poseClass === 'EMPTY_HAND_REACH' ? 'REACH'
      : directive.poseClass === 'ITEM_REACH' ? 'INSPECT'
        : directive.poseClass === 'PAPER_REACH' ? 'USE_GIVE'
          : directive.poseClass === 'IDLE' ? 'IDLE' : rookPose
  }
  if (directive.actor === 'ARTHUR') {
    mrIndexPose = directive.poseClass === 'EMPTY_HAND_REACH' ? 'RECEIVE'
      : directive.poseClass === 'DOCUMENT_REVIEW' ? 'DOCUMENT'
      : directive.poseClass === 'STAMP_USE' ? 'STAMP'
        : directive.poseClass === 'IDLE' ? 'IDLE' : mrIndexPose
  }
  if (directive.poseClass === 'IDLE' && !directive.actor) {
    rookPose = 'IDLE'
    mrIndexPose = 'IDLE'
  }
  return { rookPose, mrIndexPose }
}

export function routePoseDirective(route: PhysicalChoreographyContract): PhysicalPoseDirective {
  return { actor: 'ROOK', poseClass: route.animation.poseClass }
}

/** Shared reducer/renderer/qualification owner for the current physical clip. */
export function routeAnimationPolicyForState(state: Pick<AdventureState, 'activeSequence' | 'rookPose'>): RouteAnimationPolicy | null {
  const active = state.activeSequence
  if (active) {
    const routeId = active.pendingStateChangeRule.startsWith('required.') || active.pendingStateChangeRule.startsWith('dynamic.')
      ? active.pendingStateChangeRule : `required.${active.pendingStateChangeRule}`
    const route = PRODUCTION_PHYSICAL_CHOREOGRAPHY.find(row => row.routeId === routeId)
    if (route && active.currentPhysicalPoseClass === route.poseClass) return route.animation
    if (active.currentPhysicalPoseClass) return routeAnimationPolicy(active.currentPhysicalPoseClass)
  }
  if (state.rookPose === 'REACH') return routeAnimationPolicy('EMPTY_HAND_REACH')
  if (state.rookPose === 'INSPECT') return { poseClass: 'NO_REACH', clipId: 'rook.inspect-lean', framePolicy: 'NO_PHYSICAL_CLIP', forceJustification: null }
  if (state.rookPose === 'USE_GIVE') return routeAnimationPolicy('PAPER_REACH')
  return null
}

export function scriptedPoseDirective(
  route: PhysicalChoreographyContract,
  sequenceId: string,
  physicalPose: PhysicalPoseDirective | undefined,
): PhysicalPoseDirective | null {
  const expectedClass = sequenceId === 'SEQUENCE.FORM_REVIEW_RETURN' ? 'PAPER_HANDOFF'
    : sequenceId === 'SEQUENCE.CASEFILE_COLLECTION' ? 'ITEM_CONTACT'
      : sequenceId === 'SEQUENCE.DRAWER_LOOT' ? 'EMPTY_HAND_CONTACT' : null
  if (expectedClass && route.classification !== expectedClass) throw Error(`SCRIPTED_PHYSICAL_ROUTE_DRIFT:${sequenceId}:${route.routeId}`)
  return physicalPose ?? null
}

export function physicalChoreographyFor(pending: PendingInteraction, state: Pick<AdventureState, 'phase'>, ruleId?: string): PhysicalChoreographyContract | null {
  if (!PHYSICAL_VERBS.has(pending.verb)) return null
  const owned = ruleId ? PRODUCTION_PHYSICAL_CHOREOGRAPHY.find(row => row.routeId === `required.${ruleId}`) : PRODUCTION_PHYSICAL_CHOREOGRAPHY.find(row => row.target === pending.targetId && row.verb === pending.verb && row.requiredItem === pending.itemId && row.routeId.startsWith('dynamic.'))
  if (owned) return owned
  const classification: PhysicalRouteClass = pending.itemId
    ? pending.targetId === 'mr-index' && pending.itemId === 'signed-terminal-authorization-form-with-doodles' ? 'PAPER_HANDOFF' : 'ITEM_CONTACT'
    : UNREACHABLE.has(pending.targetId) ? 'UNREACHABLE_PHYSICAL_REFUSAL' : 'SPEECH_ONLY_NO_REACH'
  return {
    routeId: `fallback.${state.phase}.${pending.verb}.${pending.targetId}.${pending.itemId ?? 'NONE'}`,
    target: pending.targetId, verb: pending.verb, requiredItem: pending.itemId, classification,
    approachOwner: 'runtimeSession.walkPointForTarget', facingOwner: 'reducer.faceObject', poseClass: poseFor(classification), contactId: null, mutationOwner: null,
    postContactSpeechOwner: classification === 'UNREACHABLE_PHYSICAL_REFUSAL' ? 'deadEndSpeech.unreachable' : 'deadEndSpeech.stateful', animation: routeAnimationPolicy(poseFor(classification)),
  }
}

export function completePhysicalCoverage(state: Pick<AdventureState, 'phase'>): PhysicalChoreographyContract[] {
  return hotspots.flatMap(target => [...PHYSICAL_VERBS].map(verb => physicalChoreographyFor({ verb, targetId: target.id, itemId: null }, state)!))
}
