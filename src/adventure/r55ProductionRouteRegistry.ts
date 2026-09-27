import { blockedInteractions, dialogueMenuSpeechForState, incompatibleUseFallback, inventorySpeechForState, itemRules, usefulRules } from './content'
import { adventureReducer, createInitialAdventureState } from './reducer'
import type { AdventureState, HotspotId, InteractionRule, InventoryItemId, ItemRule, PuzzlePhase, SpeechLine, VerbId } from './types'
import type { HeroTerminalRoute } from '../story/r55/runtimeAdapters'
import { selectBrcgTerminalSpeech, selectEndingVariantSpeech, selectHeroTerminalSpeech } from '../app/productionCopySelectors'
import { R55_OPENING, type R55SourceEventKey } from '../story/r55/production'

export type R55ProductionOwnerFamily = 'opening' | 'useful-rule' | 'item-rule' | 'blocked-interaction' | 'dead-end' | 'inventory-state' | 'arthur-item' | 'arthur-dialogue' | 'reducer-state' | 'hero-terminal' | 'brcg-terminal' | 'ending-completion'

export interface R55ExpectedSource {
  eventKey: R55SourceEventKey
  startIndex?: number
}

export interface R55ProductionRouteDescriptor {
  routeId: string
  ownerFamily: R55ProductionOwnerFamily
  ownerId: string
  actionInput: Readonly<Record<string, unknown>>
  stateFixture: Readonly<Record<string, unknown>>
  expectedSources: readonly R55ExpectedSource[]
  expectedNodeIds?: readonly string[]
  expectedNonR55CopyKeys?: readonly string[]
  exerciseId: string
}

const route = (descriptor: Omit<R55ProductionRouteDescriptor, 'exerciseId'>): R55ProductionRouteDescriptor => ({ ...descriptor, exerciseId: `s14-r6:actual-action:${descriptor.routeId}` })
const source = (eventKey: R55SourceEventKey, startIndex?: number): R55ExpectedSource => startIndex === undefined ? { eventKey } : { eventKey, startIndex }
const owner = (routeId: string, ownerFamily: R55ProductionOwnerFamily, ownerId: string, actionInput: Record<string, unknown>, stateFixture: Record<string, unknown>, ...expectedSources: R55ExpectedSource[]) => route({ routeId, ownerFamily, ownerId, actionInput, stateFixture, expectedSources })
const dead = (routeId: string, verb: VerbId, targetId: HotspotId, expected: R55ExpectedSource, itemId: InventoryItemId | null = null, stateFixture: Record<string, unknown> = {}) => owner(routeId, 'dead-end', 'deadEndSpeech', { verb, targetId, itemId }, stateFixture, expected)
const inventory = (routeId: string, itemId: InventoryItemId, verb: VerbId, expected: R55ExpectedSource, stateFixture: Record<string, unknown> = {}, targetItemId: InventoryItemId | null = null) => owner(routeId, 'inventory-state', 'inventorySpeechForState', { itemId, verb, targetItemId }, stateFixture, expected)
const arthur = (routeId: string, itemId: InventoryItemId, expected: R55ExpectedSource, stateFixture: Record<string, unknown> = {}) => owner(routeId, 'arthur-item', 'arthurItemSpeech', { itemId }, stateFixture, expected)
const dialogue = (routeId: string, topicId: string, phase: PuzzlePhase, expected: R55ExpectedSource, stateFixture: Record<string, unknown> = {}) => owner(routeId, 'arthur-dialogue', 'dialogueTopicsForState', { topicId }, { phase, inventory: [], exhaustedTopics: [], ...stateFixture }, expected)
const sources = (...expectedSources: R55ExpectedSource[]) => expectedSources

const phaseInventory: Record<PuzzlePhase, InventoryItemId[]> = {
  START: [], FORM_HELD: ['blank-terminal-authorization-form'], PEN_HELD: ['loose-feather-pen'], FORM_AND_PEN: ['blank-terminal-authorization-form', 'loose-feather-pen'],
  FORM_COMPLETED: ['signed-terminal-authorization-form-with-doodles', 'broken-feather-pen'], FORM_SUBMITTED: ['broken-feather-pen'], COMPLETE: ['broken-feather-pen', 'approved-stamped-terminal-authorization-form', 'euler-case-file'],
}

const usefulExpected: Record<string, readonly R55ExpectedSource[]> = {
  'take-form': [], 'take-pen': [], 'take-form-2': [], 'take-pen-2': [],
  'give-form': sources(source('COPY.A1:Review dialogue'), source('COPY.A1:Stamp, return, and authorization'), source('COPY.A1:Confidential-files warning and approved continuation')),
  'reprimand-start': sources(source('COPY.A1:Every preauthorization attempt')), 'reprimand-form-held': sources(source('COPY.A1:Every preauthorization attempt')), 'reprimand-pen-held': sources(source('COPY.A1:Every preauthorization attempt')), 'reprimand-form-and-pen': sources(source('COPY.A1:Every preauthorization attempt')), 'reprimand-form-completed': sources(source('COPY.A1:Every preauthorization attempt')), 'reprimand-form-submitted': sources(source('COPY.A1:Every preauthorization attempt')),
  'look-case-cabinet': [], 'look-drawer': sources(source('COPY.A2_A4:`LOOK AT MISCELLANEOUS CATCH-ALL JUNK DRAWER CONTENTS`')),
  'open-case-drawer': [], 'pull-case-drawer': [], 'close-case-drawer': [], 'push-case-drawer': [], 'use-case-drawer-open': [], 'use-case-drawer-shut': [],
  'look-case-stack': sources(source('COPY.A2_A4:`LOOK AT DISORDERLY STACK OF CONFIDENTIAL FILES`')), 'pickup-case-stack': sources(source('COPY.A2_A4:`PICK UP DISORDERLY STACK OF CONFIDENTIAL FILES`'), source('COPY.A2_A4:Initial Euler-file recitation')),
  'open-misc-drawer': [], 'pull-misc-drawer': [], 'close-misc-drawer': [], 'push-misc-drawer': [], 'use-misc-drawer-open': [], 'use-misc-drawer-shut': [],
  'look-misc-contents': sources(source('COPY.A2_A4:`LOOK AT MISCELLANEOUS CATCH-ALL JUNK DRAWER CONTENTS`')), 'pickup-misc-contents': sources(source('COPY.A2_A4:`PICK UP MISCELLANEOUS CATCH-ALL JUNK DRAWER CONTENTS`'), source('COPY.A2_A4:Rubber band'), source('COPY.A2_A4:Rubik’s Cube'), source('COPY.A2_A4:*Sharknado 2* VHS'), source('COPY.A2_A4:Piggy bank'), source('COPY.A2_A4:Do-It-Herself Small Pink Toolbox'), source('COPY.A2_A4:Retrospective justification after the fifth item'), source('COPY.A2_A4:End of collection')),
}
const usefulFixture = (rule: InteractionRule): Record<string, unknown> => {
  const phase = rule.phase === 'ANY' ? 'COMPLETE' : rule.phase
  const inventory = [...phaseInventory[phase]]
  if (rule.itemId && !inventory.includes(rule.itemId)) inventory.push(rule.itemId)
  return { phase, inventory, ...(rule.requiresDrawer ? { [rule.requiresDrawer.drawer]: rule.requiresDrawer.is } : {}), ...(rule.requiresStack ? { caseStack: rule.requiresStack } : {}), ...(rule.requiresMisc ? { miscContents: rule.requiresMisc } : {}) }
}

const itemExpected: Record<string, readonly R55ExpectedSource[]> = {
  'combine-form-pen': [], 'open-toolbox': sources(source('COPY.A2_A4:`OPEN` or `USE` toolbox')), 'use-toolbox': sources(source('COPY.A2_A4:`OPEN` or `USE` toolbox')),
  'open-toolbox-open': [], 'use-toolbox-open': sources(source('COPY.A2_A4:`LOOK AT` open empty toolbox')), 'smash-piggy': sources(source('COPY.BRCG:Hammer + Piggy Bank')),
}
const itemFixture = (rule: ItemRule): Record<string, unknown> => {
  const phase = rule.phases === 'ANY' || Array.isArray(rule.phases) ? 'COMPLETE' : rule.phases
  return { phase, inventory: [...new Set([rule.itemId, ...(rule.targetItemId ? [rule.targetItemId] : [])])] }
}

const backgroundLooks: Array<[string, HotspotId, number]> = [
  ['change', 'wall-be-the-change', 0], ['think', 'wall-think-outside', 2], ['clock', 'wall-clock', 4], ['employee', 'wall-employee', 7], ['city', 'wall-city-bridge', 9], ['building', 'wall-building', 11], ['preserve', 'wall-preserve', 12], ['records', 'wall-records-sign', 14], ['stanchion', 'wall-not-a-number', 16], ['window', 'window', 18], ['books', 'book-shelf', 20], ['globe', 'office-globe', 21], ['lamp', 'desk-lamp', 22], ['stamp', 'arthur-stamp', 23], ['mug', 'coffee-mug', 24],
]
const backgroundTalks: Array<[string, HotspotId, number]> = [
  ['change', 'wall-be-the-change', 0], ['think', 'wall-think-outside', 1], ['clock', 'wall-clock', 2], ['employee', 'wall-employee', 4], ['city', 'wall-city-bridge', 5], ['building', 'wall-building', 6], ['preserve', 'wall-preserve', 7], ['records', 'wall-records-sign', 8], ['stanchion', 'wall-not-a-number', 9], ['window', 'window', 10], ['books', 'book-shelf', 11], ['globe', 'office-globe', 12], ['mug', 'coffee-mug', 13],
]

export const R55_TRUE_PRODUCTION_ROUTE_REGISTRY: readonly R55ProductionRouteDescriptor[] = [
  owner('opening.player-paced', 'opening', 'createInitialAdventureState', { skipIntro: false }, {},
    source('COPY.A1:A1.1 — Arrival'), source('COPY.A1:A1.2 — Arthur / Mr. A'), source('COPY.A1:A1.3 — Forgotten brief'), source('COPY.A1:A1.4 — Euler, blockchain, Nansen'), source('COPY.A1:A1.5 — Authorization instructions')),

  ...usefulRules.map(rule => route({ routeId: `useful.${rule.id}`, ownerFamily: 'useful-rule', ownerId: rule.id, actionInput: { verb: rule.verb, targetId: rule.targetId, itemId: rule.itemId ?? null }, stateFixture: usefulFixture(rule), expectedSources: usefulExpected[rule.id] ?? [], ...(rule.id === 'take-pen' || rule.id === 'take-pen-2' ? { expectedNodeIds: ['OVR-PEN-01', 'OVR-PEN-02', 'OVR-PEN-03'] } : {}), ...(rule.id === 'look-case-cabinet' ? { expectedNonR55CopyKeys: ['NON_R55_FALLBACK_PENDING_PRINCIPAL_POLISH.CASE_CABINET_EXTERIOR'] } : {}) })),

  ...itemRules.map(rule => route({ routeId: `item.${rule.id}`, ownerFamily: 'item-rule', ownerId: rule.id, actionInput: { verb: rule.verb, itemId: rule.itemId, targetItemId: rule.targetItemId ?? null }, stateFixture: itemFixture(rule), expectedSources: itemExpected[rule.id] ?? [], ...(rule.id === 'combine-form-pen' ? { expectedNodeIds: ['OVR-FORM-01', 'OVR-FORM-02', 'OVR-FORM-03', 'OVR-FORM-04'] } : {}), ...(rule.id === 'open-toolbox-open' ? { expectedNonR55CopyKeys: ['S17.P2.R3.TOOLBOX.ALREADY_OPEN'] } : {}) })),

  ...blockedInteractions.map(blocked => route({ routeId: `blocked.${blocked.verb.toLowerCase()}.${blocked.targetId}.${blocked.itemId}`, ownerFamily: 'blocked-interaction', ownerId: `${blocked.verb}:${blocked.targetId}:${blocked.itemId}`, actionInput: { ...blocked }, stateFixture: { phase: 'COMPLETE', inventory: [blocked.itemId] }, expectedSources: [], expectedNodeIds: blocked.speech?.map(line => line.copyKey!) ?? [blocked.copyKey] })),

  dead('dead.request-look', 'LOOK_AT', 'request-dispenser', source('COPY.A1:LOOK AT', 0)),
  dead('dead.request-pickup', 'PICK_UP', 'request-dispenser', source('COPY.A1:PICK UP', 0)),
  dead('dead.request-push', 'PUSH', 'request-dispenser', source('COPY.A1:PUSH or PULL')),
  dead('dead.request-open', 'OPEN', 'request-dispenser', source('COPY.A1:OPEN')),
  dead('dead.request-close', 'CLOSE', 'request-dispenser', source('COPY.A1:CLOSE')),
  dead('dead.request-use', 'USE', 'request-dispenser', source('COPY.A1:USE')),
  dead('dead.blank-form-look', 'LOOK_AT', 'blank-authorization-form', source('COPY.A1:LOOK AT in world', 0)),
  dead('dead.pen-look', 'LOOK_AT', 'pen-stand', source('COPY.A1:LOOK AT in world', 1)),
  dead('dead.blank-form-give', 'GIVE', 'mr-index', source('COPY.A1:GIVE blank form to Arthur'), 'blank-terminal-authorization-form'),
  dead('dead.incompatible-pen', 'USE', 'coffee-mug', source('COPY.A1:USE with an incompatible target'), 'loose-feather-pen'),
  dead('dead.blank-form-open', 'OPEN', 'blank-authorization-form', source('COPY.A1:OPEN or CLOSE')),
  ...backgroundLooks.map(([id, targetId, startIndex]) => dead(`background.look.${id}`, 'LOOK_AT', targetId, source('COPY.BACKGROUND:LOOK AT', startIndex))),
  ...backgroundTalks.map(([id, targetId, startIndex]) => id === 'change'
    ? owner(`background.talk.${id}`, 'dead-end', 'deadEndSpeech', { verb: 'TALK_TO', targetId, itemId: null }, {}, source('COPY.BACKGROUND:TALK TO', 0), source('COPY.BACKGROUND:TALK TO', 1))
    : dead(`background.talk.${id}`, 'TALK_TO', targetId, source('COPY.BACKGROUND:TALK TO', startIndex))),
  dead('background.employee-removal', 'PICK_UP', 'wall-employee', source('COPY.BACKGROUND:PICK UP / removal attempt')),
  dead('background.city-pick', 'PICK_UP', 'wall-city-bridge', source('COPY.BACKGROUND:PICK UP / USE', 0)),
  dead('background.records-use', 'USE', 'wall-records-sign', source('COPY.BACKGROUND:PICK UP / USE', 1)),
  dead('background.stanchion-pick', 'PICK_UP', 'wall-not-a-number', source('COPY.BACKGROUND:PICK UP / USE', 2)),
  route({ routeId: 'background.preserve-short', ownerFamily: 'dead-end', ownerId: 'deadEndSpeech', actionInput: { verb: 'GIVE', targetId: 'wall-preserve', itemId: null }, stateFixture: {}, expectedSources: [], expectedNodeIds: ['S17.REACHABILITY.wall-preserve.GIVE.1'] }),
  dead('background.preserve-vault', 'OPEN', 'wall-preserve', source('COPY.BACKGROUND:OPEN / PULL')),
  dead('background.window-physical', 'PUSH', 'window', source('COPY.BACKGROUND:Physical interaction')),
  dead('background.books-physical', 'OPEN', 'book-shelf', source('COPY.BACKGROUND:PICK UP / USE / OPEN / PUSH / CLOSE / PULL')),
  dead('background.globe-pickup', 'PICK_UP', 'office-globe', source('COPY.BACKGROUND:PICK UP', 0)),
  route({ routeId: 'background.lamp-pickup', ownerFamily: 'dead-end', ownerId: 'deadEndSpeech', actionInput: { verb: 'PICK_UP', targetId: 'desk-lamp', itemId: null }, stateFixture: {}, expectedSources: [], expectedNodeIds: ['S17.REACHABILITY.desk-lamp.PICK_UP.1', 'S17.REACHABILITY.desk-lamp.PICK_UP.2'] }),
  dead('background.mug-pickup', 'PICK_UP', 'coffee-mug', source('COPY.BACKGROUND:PICK UP', 2)),
  dead('background.globe-give', 'GIVE', 'office-globe', source('COPY.BACKGROUND:GIVE')),
  dead('background.globe-open', 'OPEN', 'office-globe', source('COPY.BACKGROUND:OPEN / CLOSE')),
  dead('background.lamp-push', 'PUSH', 'desk-lamp', source('COPY.BACKGROUND:PUSH or PULL', 0)),
  dead('background.mug-pull', 'PULL', 'coffee-mug', source('COPY.BACKGROUND:PUSH or PULL', 1)),
  dead('background.stamp-before', 'PICK_UP', 'arthur-stamp', source('COPY.BACKGROUND:PICK UP — before authorization approval'), null, { phase: 'START' }),
  dead('background.stamp-after', 'PICK_UP', 'arthur-stamp', source('COPY.BACKGROUND:PICK UP — after authorization approval'), null, { phase: 'COMPLETE' }),
  dead('background.stamp-use-approved', 'USE', 'arthur-stamp', source('COPY.BACKGROUND:USE — after approval'), null, { phase: 'COMPLETE' }),
  dead('background.stamp-use-before', 'USE', 'arthur-stamp', source('COPY.BACKGROUND:USE or `USE BARELY LEGIBLE SIGNED AUTHORIZATION FORM WITH STAMP`'), null, { phase: 'START' }),
  dead('background.stamp-push', 'PUSH', 'arthur-stamp', source('COPY.BACKGROUND:PUSH, PULL, OPEN, or CLOSE')),
  dead('background.mug-use', 'USE', 'coffee-mug', source('COPY.BACKGROUND:USE')),
  dead('background.global-refusal', 'OPEN', 'wall-be-the-change', source('COPY.BACKGROUND:Global rules')),
  dead('repeat.case-stack-look', 'LOOK_AT', 'disorderly-stack-of-confidential-files', source('COPY.REPEAT:LOOK AT', 0), null, { caseStack: 'SEARCHED_EULER_REMOVED' }),
  dead('repeat.misc-look', 'LOOK_AT', 'miscellaneous-catch-all-contents', source('COPY.REPEAT:LOOK AT', 1), null, { miscContents: 'COLLECTED_GUM_REMAINS' }),
  dead('repeat.case-stack-pickup', 'PICK_UP', 'disorderly-stack-of-confidential-files', source('COPY.REPEAT:PICK UP', 0), null, { caseStack: 'SEARCHED_EULER_REMOVED' }),
  dead('repeat.misc-pickup', 'PICK_UP', 'miscellaneous-catch-all-contents', source('COPY.REPEAT:PICK UP', 1), null, { miscContents: 'COLLECTED_GUM_REMAINS' }),
  route({ routeId: 'repeat.case-drawer-open', ownerFamily: 'dead-end', ownerId: 'deadEndSpeech', actionInput: { verb: 'OPEN', targetId: 'official-case-file-cabinet', itemId: null }, stateFixture: { phase: 'COMPLETE', caseFileDrawer: 'OPEN' }, expectedSources: [], expectedNodeIds: ['S17.REACHABILITY.official-case-file-cabinet.OPEN.1'] }),
  route({ routeId: 'repeat.case-drawer-closed', ownerFamily: 'dead-end', ownerId: 'deadEndSpeech', actionInput: { verb: 'CLOSE', targetId: 'official-case-file-cabinet', itemId: null }, stateFixture: { phase: 'COMPLETE', caseFileDrawer: 'CLOSED' }, expectedSources: [], expectedNodeIds: ['S17.REACHABILITY.official-case-file-cabinet.CLOSE.1'] }),
  route({ routeId: 'repeat.misc-drawer-open', ownerFamily: 'dead-end', ownerId: 'deadEndSpeech', actionInput: { verb: 'OPEN', targetId: 'miscellaneous-drawer-cabinet', itemId: null }, stateFixture: { phase: 'COMPLETE', miscDrawer: 'OPEN' }, expectedSources: [], expectedNodeIds: ['S17.REACHABILITY.miscellaneous-drawer-cabinet.OPEN.1'] }),
  route({ routeId: 'repeat.misc-drawer-closed', ownerFamily: 'dead-end', ownerId: 'deadEndSpeech', actionInput: { verb: 'CLOSE', targetId: 'miscellaneous-drawer-cabinet', itemId: null }, stateFixture: { phase: 'COMPLETE', miscDrawer: 'CLOSED' }, expectedSources: [], expectedNodeIds: ['S17.REACHABILITY.miscellaneous-drawer-cabinet.CLOSE.1'] }),

  inventory('inventory.blank-form-look', 'blank-terminal-authorization-form', 'LOOK_AT', source('COPY.A1:LOOK AT in inventory', 0)),
  inventory('inventory.pen-look', 'loose-feather-pen', 'LOOK_AT', source('COPY.A1:LOOK AT in inventory', 2)),
  inventory('inventory.signed-look', 'signed-terminal-authorization-form-with-doodles', 'LOOK_AT', source('COPY.A1:LOOK AT', 1)),
  inventory('inventory.broken-first-look', 'broken-feather-pen', 'LOOK_AT', source('COPY.A1:LOOK AT', 2)),
  inventory('inventory.approved-first-look', 'approved-stamped-terminal-authorization-form', 'LOOK_AT', source('COPY.A1:10. Approved-form inventory observation')),
  inventory('inventory.approved-repeat-look', 'approved-stamped-terminal-authorization-form', 'LOOK_AT', source('COPY.INVENTORY:LOOK AT', 0), { lastInteractionId: 'INTERACTION.ITEM.look-approved-stamped-terminal-authorization-form' }),
  inventory('inventory.rubber-look', 'rubber-band', 'LOOK_AT', source('COPY.INVENTORY:LOOK AT', 1)),
  inventory('inventory.cube-look', 'rubiks-cube', 'LOOK_AT', source('COPY.INVENTORY:LOOK AT', 2)),
  inventory('inventory.vhs-look', 'sharknado-2-vhs', 'LOOK_AT', source('COPY.INVENTORY:LOOK AT', 3)),
  inventory('inventory.hammer-repeat-look', 'hammer', 'LOOK_AT', source('COPY.INVENTORY:LOOK AT', 6), { lastInteractionId: 'INTERACTION.ITEM.look-hammer' }),
  inventory('inventory.nails-repeat-look', 'nails', 'LOOK_AT', source('COPY.INVENTORY:LOOK AT', 7), { lastInteractionId: 'INTERACTION.ITEM.look-nails' }),
  inventory('inventory.piggy-repeat-look', 'piggy-bank-intact', 'LOOK_AT', source('COPY.INVENTORY:LOOK AT', 8), { lastInteractionId: 'INTERACTION.ITEM.look-piggy-bank-intact' }),
  inventory('inventory.broken-repeat-look', 'broken-feather-pen', 'LOOK_AT', source('COPY.INVENTORY:LOOK AT', 13), { lastInteractionId: 'INTERACTION.ITEM.look-broken-feather-pen' }),
  inventory('inventory.toolbox-closed-first-look', 'small-toolbox-closed', 'LOOK_AT', source('COPY.A2_A4:`LOOK AT` closed toolbox')),
  inventory('inventory.toolbox-closed-repeat-look', 'small-toolbox-closed', 'LOOK_AT', source('COPY.INVENTORY:Closed LOOK AT'), { lastInteractionId: 'INTERACTION.ITEM.look-small-toolbox-closed' }),
  inventory('inventory.toolbox-open-first-look', 'small-toolbox-open-empty', 'LOOK_AT', source('COPY.A2_A4:`LOOK AT` open empty toolbox')),
  inventory('inventory.hammer-first-look', 'hammer', 'LOOK_AT', source('COPY.A2_A4:`LOOK AT HAMMER`')),
  inventory('inventory.nails-first-look', 'nails', 'LOOK_AT', source('COPY.A2_A4:`LOOK AT SMALL HANDFUL OF DAINTY NAILS`')),
  inventory('inventory.piggy-first-look', 'piggy-bank-intact', 'LOOK_AT', source('COPY.A2_A4:`LOOK AT PIGGY BANK`')),
  inventory('inventory.piggy-first-talk', 'piggy-bank-intact', 'TALK_TO', source('COPY.A2_A4:`TALK TO PIGGY BANK`')),
  inventory('inventory.piggy-repeat-talk', 'piggy-bank-intact', 'TALK_TO', source('COPY.INVENTORY:TALK TO'), { lastInteractionId: 'INTERACTION.ITEM.talk_to-piggy-bank-intact' }),
  inventory('inventory.euler-initial', 'euler-case-file', 'LOOK_AT', source('COPY.A2_A4:Inventory `LOOK AT EULER CASE FILE`'), { investigationMilestone: 'BEFORE_Q1' }),
  inventory('inventory.euler-before-q1', 'euler-case-file', 'LOOK_AT', source('COPY.INVENTORY:Before Question 1 is complete'), { investigationMilestone: 'BEFORE_Q1', lastInteractionId: 'INTERACTION.ITEM.look-euler-case-file' }),
  inventory('inventory.euler-after-q1', 'euler-case-file', 'LOOK_AT', source('COPY.INVENTORY:After Question 1, before Question 2'), { investigationMilestone: 'AFTER_Q1' }),
  inventory('inventory.euler-after-q2', 'euler-case-file', 'LOOK_AT', source('COPY.INVENTORY:After Question 2, before Question 3'), { investigationMilestone: 'AFTER_Q2' }),
  inventory('inventory.euler-exact', 'euler-case-file', 'LOOK_AT', source('COPY.INVENTORY:After Question 3, before proof assembly'), { investigationMilestone: 'EXACT_RECEIPT' }),
  inventory('inventory.euler-proof', 'euler-case-file', 'LOOK_AT', source('COPY.INVENTORY:Proof complete, case not yet closed'), { investigationMilestone: 'PROOF_COMPLETE' }),
  inventory('inventory.euler-proof-repeat', 'euler-case-file', 'LOOK_AT', source('COPY.REPEAT:Proof complete, case not yet closed'), { investigationMilestone: 'PROOF_COMPLETE', lastInteractionId: 'INTERACTION.ITEM.look-euler-case-file' }),
  ...(['rubber-band', 'rubiks-cube', 'hammer', 'nails', 'fictional-token-note'] as const).map(itemId => route({
    routeId: `inventory.invalid-pair.${itemId}`,
    ownerFamily: 'inventory-state',
    ownerId: 'inventorySpeechForState',
    actionInput: { itemId, verb: 'USE', targetItemId: 'sharknado-2-vhs' },
    stateFixture: {},
    expectedSources: [],
    expectedNonR55CopyKeys: [inventorySpeechForState(itemId, 'USE', {}, 'sharknado-2-vhs')[0]!.copyKey!],
  })),
  inventory('inventory.note-unread-repeat', 'fictional-token-note', 'LOOK_AT', source('COPY.INVENTORY:Unread LOOK AT'), { piggyNoteReadState: 'UNREAD', lastInteractionId: 'INTERACTION.ITEM.look-fictional-token-note' }),
  inventory('inventory.note-open-untested', 'fictional-token-note', 'OPEN', source('COPY.BRCG:OPEN or CLOSE — untested'), { piggyNoteReadState: 'BACK_READ', brcgInvestigationState: 'UNTESTED' }),
  inventory('inventory.note-open-untested-repeat', 'fictional-token-note', 'OPEN', source('COPY.INVENTORY:OPEN or CLOSE — BRCG untested'), { piggyNoteReadState: 'BACK_READ', brcgInvestigationState: 'UNTESTED', lastInteractionId: 'INTERACTION.ITEM.open-fictional-token-note' }),
  inventory('inventory.note-close-resolved', 'fictional-token-note', 'CLOSE', source('COPY.BRCG:OPEN or CLOSE — resolved'), { piggyNoteReadState: 'BACK_READ', brcgInvestigationState: 'RESOLVED' }),
  inventory('inventory.note-close-resolved-repeat', 'fictional-token-note', 'CLOSE', source('COPY.INVENTORY:OPEN or CLOSE — BRCG resolved'), { piggyNoteReadState: 'BACK_READ', brcgInvestigationState: 'RESOLVED', lastInteractionId: 'INTERACTION.ITEM.close-fictional-token-note' }),
  route({ routeId: 'inventory.toolbox-close', ownerFamily: 'inventory-state', ownerId: 'inventorySpeechForState', actionInput: { itemId: 'small-toolbox-open-empty', verb: 'CLOSE', targetItemId: null }, stateFixture: {}, expectedSources: [source('COPY.INVENTORY:CLOSE after opening')] }),
  route({ routeId: 'inventory.generic-open', ownerFamily: 'inventory-state', ownerId: 'inventorySpeechForState', actionInput: { itemId: 'rubber-band', verb: 'OPEN', targetItemId: null }, stateFixture: {}, expectedSources: [], expectedNonR55CopyKeys: ['S17.P2.R3.INVENTORY.OPEN_NO_EFFECT'] }),
  route({ routeId: 'inventory.generic-close', ownerFamily: 'inventory-state', ownerId: 'inventorySpeechForState', actionInput: { itemId: 'rubber-band', verb: 'CLOSE', targetItemId: null }, stateFixture: {}, expectedSources: [], expectedNonR55CopyKeys: ['S17.P2.R3.INVENTORY.CLOSE_NO_EFFECT'] }),
  route({ routeId: 'inventory.generic-push', ownerFamily: 'inventory-state', ownerId: 'inventorySpeechForState', actionInput: { itemId: 'rubber-band', verb: 'PUSH', targetItemId: null }, stateFixture: {}, expectedSources: [], expectedNonR55CopyKeys: ['S17.P2.R3.INVENTORY.MOVE_NO_EFFECT'] }),
  route({
    routeId: 'inventory.generic-use', ownerFamily: 'dead-end', ownerId: 'deadEndSpeech',
    actionInput: { verb: 'USE', targetId: 'blank-authorization-form', itemId: 'approved-stamped-terminal-authorization-form' },
    stateFixture: {}, expectedSources: [],
    expectedNonR55CopyKeys: [incompatibleUseFallback('approved-stamped-terminal-authorization-form', 'blank-authorization-form')[0]!.copyKey!],
  }),
  dead('inventory.case-terminal-use', 'USE', 'nansen-terminal', source('COPY.INVENTORY:USE with Case Terminal'), 'sharknado-2-vhs'),

  arthur('arthur.broken-pen', 'broken-feather-pen', source('COPY.A1:GIVE to Arthur or attempt to return/use with inkwell')),
  arthur('arthur.approved-form', 'approved-stamped-terminal-authorization-form', source('COPY.INVENTORY:GIVE to Arthur'), { phase: 'COMPLETE' }),
  arthur('arthur.euler', 'euler-case-file', source('COPY.ARTHUR:Euler Case File')),
  arthur('arthur.pen', 'loose-feather-pen', source('COPY.ARTHUR:Feather Pen — intact, before form completion')),
  arthur('arthur.rubber', 'rubber-band', source('COPY.ARTHUR:Rubber Band')),
  arthur('arthur.cube', 'rubiks-cube', source('COPY.ARTHUR:Rubik’s Cube')),
  arthur('arthur.vhs', 'sharknado-2-vhs', source('COPY.ARTHUR:Sharknado 2 VHS')),
  arthur('arthur.piggy', 'piggy-bank-intact', source('COPY.ARTHUR:Intact Piggy Bank')),
  arthur('arthur.toolbox', 'small-toolbox-closed', source('COPY.ARTHUR:Do-It-Herself Small Pink Toolbox')),
  arthur('arthur.hammer', 'hammer', source('COPY.ARTHUR:Heavy-Duty Hammer')),
  arthur('arthur.nails', 'nails', source('COPY.ARTHUR:Small Handful of Dainty Nails')),
  arthur('arthur.note-unread', 'fictional-token-note', source('COPY.ARTHUR:Unread'), { piggyNoteReadState: 'UNREAD' }),
  arthur('arthur.note-untested', 'fictional-token-note', source('COPY.ARTHUR:Read, BRCG untested'), { piggyNoteReadState: 'BACK_READ', brcgInvestigationState: 'UNTESTED' }),
  arthur('arthur.note-resolved', 'fictional-token-note', source('COPY.ARTHUR:BRCG resolved'), { piggyNoteReadState: 'BACK_READ', brcgInvestigationState: 'RESOLVED' }),
  owner('arthur.use-canonical.pen', 'arthur-item', 'arthurItemSpeech', { itemId: 'loose-feather-pen', verb: 'USE' }, {}, source('COPY.ARTHUR:Feather Pen — intact, before form completion')),
  owner('arthur.use-canonical.approved-form', 'arthur-item', 'arthurItemSpeech', { itemId: 'approved-stamped-terminal-authorization-form', verb: 'USE' }, { phase: 'COMPLETE' }, source('COPY.INVENTORY:GIVE to Arthur')),

  owner('dialogue.menu-preauth', 'arthur-dialogue', 'dialogueMenuSpeechForState', {}, { phase: 'START' }, source('COPY.A1:1. Silent Arthur topic menu')),
  owner('dialogue.menu-postauth', 'arthur-dialogue', 'dialogueMenuSpeechForState', {}, { phase: 'COMPLETE' }, source('COPY.ARTHUR:Postauthorization root menu')),
  dialogue('dialogue.form-none', 'form-reminder', 'START', source('COPY.A1:No form collected')),
  dialogue('dialogue.form-held', 'form-reminder', 'FORM_HELD', source('COPY.A1:Form collected, pen not collected')),
  dialogue('dialogue.form-and-pen', 'form-reminder', 'FORM_AND_PEN', source('COPY.A1:Form and pen available, form incomplete')),
  dialogue('dialogue.form-completed', 'form-reminder', 'FORM_COMPLETED', source('COPY.A1:Completed form available')),
  dialogue('dialogue.form-repeat', 'form-reminder', 'START', source('COPY.A1:Repeated explicit reminder'), { exhaustedTopics: ['form-reminder'] }),
  dialogue('dialogue.nansen-preauth', 'nansen-benefit', 'START', source('COPY.A1:3. Nansen reminder topic')),
  dialogue('dialogue.sports-preauth', 'sports', 'START', source('COPY.A1:4. Weekend-game topic')),
  dialogue('dialogue.health-preauth', 'health', 'START', source('COPY.A1:5. Health-benefits topic')),
  owner('dialogue.exit-preauth', 'arthur-dialogue', 'leave', { topicId: 'leave' }, { phase: 'START', inventory: [], exhaustedTopics: [] }, source('COPY.A1:6. Exit topic')),
  owner('dialogue.guidance-no-file', 'arthur-dialogue', 'case-file', { topicId: 'case-file' }, { phase: 'COMPLETE', inventory: [], exhaustedTopics: [], investigationMilestone: 'BEFORE_Q1' }, source('COPY.ARTHUR:Authorized, Euler file not collected')),
  owner('dialogue.guidance-before-q1', 'arthur-dialogue', 'case-file', { topicId: 'case-file' }, { phase: 'COMPLETE', inventory: ['euler-case-file'], exhaustedTopics: [], investigationMilestone: 'BEFORE_Q1' }, source('COPY.ARTHUR:Euler file collected, Question 1 incomplete')),
  owner('dialogue.guidance-after-q1', 'arthur-dialogue', 'case-file', { topicId: 'case-file' }, { phase: 'COMPLETE', inventory: ['euler-case-file'], exhaustedTopics: [], investigationMilestone: 'AFTER_Q1' }, source('COPY.ARTHUR:Question 1 complete, Question 2 incomplete')),
  owner('dialogue.guidance-after-q2', 'arthur-dialogue', 'case-file', { topicId: 'case-file' }, { phase: 'COMPLETE', inventory: ['euler-case-file'], exhaustedTopics: [], investigationMilestone: 'AFTER_Q2' }, source('COPY.ARTHUR:Question 2 complete, Question 3 incomplete')),
  owner('dialogue.guidance-exact', 'arthur-dialogue', 'case-file', { topicId: 'case-file' }, { phase: 'COMPLETE', inventory: ['euler-case-file'], exhaustedTopics: [], investigationMilestone: 'EXACT_RECEIPT' }, source('COPY.ARTHUR:Exact receipt found, proof incomplete')),
  owner('dialogue.guidance-proof', 'arthur-dialogue', 'case-file', { topicId: 'case-file' }, { phase: 'COMPLETE', inventory: ['euler-case-file'], exhaustedTopics: [], investigationMilestone: 'PROOF_COMPLETE' }, source('COPY.ARTHUR:Proof complete, case open')),
  dialogue('dialogue.nansen-postauth', 'nansen-benefit', 'COMPLETE', source('COPY.ARTHUR:TELL ME AGAIN HOW NANSEN HELPS')),
  dialogue('dialogue.sports-postauth', 'sports', 'COMPLETE', source('COPY.A1:4. Weekend-game topic')),
  dialogue('dialogue.health-postauth', 'health', 'COMPLETE', source('COPY.ARTHUR:SO, HOW ARE THE HEALTH BENEFITS WORKING HERE?')),
  dialogue('dialogue.name-postauth', 'arthur-name', 'COMPLETE', source('COPY.ARTHUR:CAN I CALL YOU ARTHUR YET?')),
  owner('dialogue.exit-postauth', 'arthur-dialogue', 'leave', { topicId: 'leave' }, { phase: 'COMPLETE', inventory: [], exhaustedTopics: [] }, source('COPY.ARTHUR:Exit')),

  owner('hero.prebrief-initial', 'hero-terminal', 'selectHeroTerminalSpeech', { route: 'PREBRIEF_INITIAL' }, {}, source('COPY.HERO:Prebrief entry — authorized, no Euler file, no BRCG lead', 0)),
  owner('hero.prebrief-repeat', 'hero-terminal', 'selectHeroTerminalSpeech', { route: 'PREBRIEF_REPEAT' }, {}, source('COPY.HERO:Prebrief entry — authorized, no Euler file, no BRCG lead', 1)),
  owner('hero.prebrief-reentry', 'hero-terminal', 'selectHeroTerminalSpeech', { route: 'PREBRIEF_REENTRY' }, {}, source('COPY.HERO:Prebrief entry — authorized, no Euler file, no BRCG lead', 2)),
  owner('hero.delta-1', 'hero-terminal', 'selectHeroTerminalSpeech', { route: 'DELTA_1' }, {}, source('COPY.HERO:Evidence Delta 1')),
  owner('hero.delta-2', 'hero-terminal', 'selectHeroTerminalSpeech', { route: 'DELTA_2' }, {}, source('COPY.HERO:Evidence Delta 2')),
  owner('hero.theory', 'hero-terminal', 'selectHeroTerminalSpeech', { route: 'THEORY_RESOLUTION' }, {}, source('COPY.HERO:Theory resolution')),
  owner('brcg.untested', 'brcg-terminal', 'selectBrcgTerminalSpeech', { state: 'UNTESTED' }, {}, source('COPY.BRCG:Read, BRCG untested')),
  owner('brcg.resolved', 'brcg-terminal', 'selectBrcgTerminalSpeech', { state: 'RESOLVED' }, {}, source('COPY.BRCG:BRCG resolved')),

  owner('reducer.cabinet-first', 'reducer-state', 'adventureReducer', { fixture: 'CABINET_FIRST' }, {}, source('COPY.A1:First attempt')),
  owner('reducer.cabinet-repeat', 'reducer-state', 'adventureReducer', { fixture: 'CABINET_REPEAT' }, {}, source('COPY.A1:Repeat attempt')),
  owner('reducer.ambient-first', 'reducer-state', 'adventureReducer', { fixture: 'AMBIENT_FIRST' }, {}, source('COPY.A1:9. Ambient reminders', 0)),
  owner('reducer.ambient-second', 'reducer-state', 'adventureReducer', { fixture: 'AMBIENT_SECOND' }, {}, source('COPY.A1:9. Ambient reminders', 1)),
  owner('reducer.note-read', 'reducer-state', 'adventureReducer', { fixture: 'NOTE_READ' }, {}, source('COPY.BRCG:Unread Note — LOOK AT')),
  owner('reducer.brcg-payoff', 'reducer-state', 'adventureReducer', { fixture: 'BRCG_PAYOFF' }, {}, source('COPY.BRCG:One-Time World-Side Payoff')),
  owner('reducer.return-exchange', 'reducer-state', 'adventureReducer', { fixture: 'RETURN_EXCHANGE' }, {}, source('COPY.END:Exact copy'), source('COPY.END:3. Friendship and pizza continuation')),
  owner('reducer.return-tag', 'reducer-state', 'adventureReducer', { fixture: 'RETURN_TAG' }, {}, source('COPY.REPEAT:6. Re-entering the terminal')),
  owner('reducer.globe-speed-1', 'reducer-state', 'adventureReducer', { fixture: 'GLOBE_SPEED_1' }, {}, source('COPY.BACKGROUND:First global reach of speed 1')),
  owner('reducer.globe-speed-2', 'reducer-state', 'adventureReducer', { fixture: 'GLOBE_SPEED_2' }, {}, source('COPY.BACKGROUND:First global reach of speed 2')),
  owner('reducer.globe-maximum', 'reducer-state', 'adventureReducer', { fixture: 'GLOBE_MAXIMUM' }, {}, source('COPY.BACKGROUND:First global reach of maximum speed')),
  owner('reducer.globe-maximum-repeat', 'reducer-state', 'adventureReducer', { fixture: 'GLOBE_MAXIMUM_REPEAT' }, {}, source('COPY.BACKGROUND:Further compatible acceleration at maximum')),
  owner('reducer.globe-reversal', 'reducer-state', 'adventureReducer', { fixture: 'GLOBE_REVERSAL' }, {}, source('COPY.BACKGROUND:Actual reversal')),
  owner('reducer.lamp-off', 'reducer-state', 'adventureReducer', { fixture: 'LAMP_OFF' }, {}, source('COPY.BACKGROUND:First `USE`: ON → OFF')),
  owner('reducer.lamp-on', 'reducer-state', 'adventureReducer', { fixture: 'LAMP_ON' }, {}, source('COPY.BACKGROUND:First later `USE`: OFF → ON')),
  owner('ending.default', 'ending-completion', 'selectEndingVariantSpeech', { brcgResolved: false }, {}, source('COPY.END:4.1 Default ending — BRCG not completed')),
  owner('ending.brcg', 'ending-completion', 'selectEndingVariantSpeech', { brcgResolved: true }, {},
    source('COPY.END:4.1 Default ending — BRCG not completed'),
    source('COPY.END:4.2 BRCG-completed ending')),
] as const

function speechFromState(state: AdventureState): SpeechLine[] {
  const lines = state.speech?.lines ?? state.nonblockingSpeech?.lines ?? state.activeSequence?.pendingSpeech ?? state.transcript
  const seen = new Set<string>()
  return lines.flatMap((line) => {
    const base = line.copyKey?.replace(/\.delivery-\d+$/, '')
    if (!base || base === line.copyKey) return [line]
    if (seen.has(base)) return []
    seen.add(base)
    return [{ ...line, copyKey: base }]
  })
}

function worldInteraction(base: AdventureState, verb: VerbId, targetId: HotspotId): AdventureState {
  let state = adventureReducer({ ...base, speech: null, nonblockingSpeech: null, walk: null }, { type: 'SELECT_VERB', verb })
  state = adventureReducer(state, { type: 'INTERACT', targetId })
  if (state.walk) state = adventureReducer(state, { type: 'WALK_TICK', delta: 10_000 })
  return state
}

function executeReducerFixture(fixture: string): SpeechLine[] {
  if (fixture === 'CABINET_FIRST' || fixture === 'CABINET_REPEAT') {
    const state = { ...createInitialAdventureState({ skipIntro: true }), phase: 'START' as const, interactionRepeats: fixture === 'CABINET_REPEAT' ? { 'cabinet-policy:official-case-file-cabinet': 1 } : {} }
    return speechFromState(worldInteraction(state, 'OPEN', 'official-case-file-cabinet'))
  }
  if (fixture === 'AMBIENT_FIRST' || fixture === 'AMBIENT_SECOND') {
    const state = { ...createInitialAdventureState({ skipIntro: true }), barksFired: fixture === 'AMBIENT_FIRST' ? 0 : 1, inactiveSeconds: 10_000 }
    return speechFromState(adventureReducer(state, { type: 'PLAY_FORM_BARK' }))
  }
  if (fixture === 'NOTE_READ') {
    let state: AdventureState = { ...createInitialAdventureState({ skipIntro: true }), inventory: ['fictional-token-note'], selectedVerb: 'LOOK_AT', piggyNoteReadState: 'UNREAD' }
    state = adventureReducer(state, { type: 'ACT_ON_ITEM', itemId: 'fictional-token-note' })
    return speechFromState(state)
  }
  if (fixture === 'BRCG_PAYOFF') {
    const state = { ...createInitialAdventureState({ skipIntro: true }), brcgPayoffPlayed: false }
    return speechFromState(adventureReducer(state, { type: 'PLAY_BRCG_PAYOFF' }))
  }
  if (fixture === 'RETURN_EXCHANGE') {
    const state = { ...createInitialAdventureState({ skipIntro: true }), phase: 'COMPLETE' as const, returnExchangePlayed: false }
    return speechFromState(adventureReducer(state, { type: 'RETURN_FROM_COMPLETED_CASE' }))
  }
  if (fixture === 'RETURN_TAG') {
    const state = { ...createInitialAdventureState({ skipIntro: true }), phase: 'COMPLETE' as const, returnExchangePlayed: true, returnTagPlayed: false }
    return speechFromState(adventureReducer(state, { type: 'PLAY_RETURN_TAG' }))
  }
  const globe = fixture.startsWith('GLOBE_')
  if (globe) {
    const states: Record<string, Partial<AdventureState>> = {
      GLOBE_SPEED_1: { globePose: 'IDLE', globeLevel: 0, globeMilestones: 0 },
      GLOBE_SPEED_2: { globePose: 'PUSH', globeLevel: 1, globeMilestones: 1 << 1 },
      GLOBE_MAXIMUM: { globePose: 'PUSH', globeLevel: 2, globeMilestones: (1 << 1) | (1 << 2) },
      GLOBE_MAXIMUM_REPEAT: { globePose: 'PUSH', globeLevel: 3, globeMilestones: (1 << 1) | (1 << 2) | (1 << 3) },
      GLOBE_REVERSAL: { globePose: 'PUSH', globeLevel: 2, globeMilestones: (1 << 1) | (1 << 2) },
    }
    const verb: VerbId = fixture === 'GLOBE_REVERSAL' ? 'PULL' : 'PUSH'
    return speechFromState(settleSequence(worldInteraction({ ...createInitialAdventureState({ skipIntro: true }), ...states[fixture] }, verb, 'office-globe')))
  }
  if (fixture === 'LAMP_OFF' || fixture === 'LAMP_ON') {
    const state = { ...createInitialAdventureState({ skipIntro: true }), lampPower: fixture === 'LAMP_OFF' ? 'ON' as const : 'OFF' as const, lampSpeech: fixture === 'LAMP_OFF' ? 0 as const : 1 as const }
    return speechFromState(settleSequence(worldInteraction(state, 'USE', 'desk-lamp')))
  }
  throw new Error(`Unknown R55 reducer fixture: ${fixture}`)
}

function stateFromFixture(fixture: Readonly<Record<string, unknown>>, requiredItems: readonly InventoryItemId[] = []): AdventureState {
  const base = createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true, instantText: true } })
  const fixtureItems = Array.isArray(fixture.inventory) ? fixture.inventory as InventoryItemId[] : []
  return { ...base, ...fixture, inventory: [...new Set([...fixtureItems, ...requiredItems])], speech: null, nonblockingSpeech: null, walk: null, activeSequence: null } as AdventureState
}

function settleSequence(state: AdventureState): AdventureState {
  let next = state
  for (let index = 0; next.activeSequence && index < 120; index += 1) {
    if (next.activeSequence.status === 'WAITING_FOR_SPEECH' && next.speech) {
      next = adventureReducer(next, { type: 'REVEAL_FULL' })
      next = adventureReducer(next, { type: 'ADVANCE_SPEECH' })
    } else next = adventureReducer(next, { type: 'ADVANCE_SEQUENCE' })
  }
  if (next.activeSequence) throw new Error('R55 action sequence did not settle')
  return next
}

function dispatchWorldAction(base: AdventureState, verb: VerbId, targetId: HotspotId, itemId: InventoryItemId | null): AdventureState {
  let state = adventureReducer(base, { type: 'SELECT_VERB', verb })
  if (itemId) state = adventureReducer(state, { type: 'ACT_ON_ITEM', itemId })
  state = adventureReducer(state, { type: 'INTERACT', targetId })
  if (state.walk) state = adventureReducer(state, { type: 'WALK_TICK', delta: 10_000 })
  return settleSequence(state)
}

export interface R55ActualActionObservation {
  lines: SpeechLine[]
  finalState: AdventureState
  selectedOwnerId: string
}

export const R55_ACTUAL_ACTION_MATRIX = R55_TRUE_PRODUCTION_ROUTE_REGISTRY

export function executeR55ActualAction(descriptor: R55ProductionRouteDescriptor): R55ActualActionObservation {
  const action = descriptor.actionInput as Record<string, unknown>
  const fixture = descriptor.stateFixture as Record<string, unknown>
  if (descriptor.ownerFamily === 'opening') {
    const finalState = createInitialAdventureState({ skipIntro: Boolean(action.skipIntro) })
    return { lines: R55_OPENING, finalState, selectedOwnerId: 'createInitialAdventureState' }
  }
  if (descriptor.ownerFamily === 'useful-rule' || descriptor.ownerFamily === 'blocked-interaction' || descriptor.ownerFamily === 'dead-end') {
    const itemId = (action.itemId ?? null) as InventoryItemId | null
    const finalState = dispatchWorldAction(stateFromFixture(fixture, itemId ? [itemId] : []), action.verb as VerbId, action.targetId as HotspotId, itemId)
    return { lines: speechFromState(finalState), finalState, selectedOwnerId: finalState.lastInteractionId ?? 'NONE' }
  }
  if (descriptor.ownerFamily === 'item-rule' || descriptor.ownerFamily === 'inventory-state') {
    const itemId = action.itemId as InventoryItemId
    const targetItemId = (action.targetItemId ?? null) as InventoryItemId | null
    let finalState = stateFromFixture(fixture, [itemId, ...(targetItemId ? [targetItemId] : [])])
    finalState = adventureReducer(finalState, { type: 'SELECT_VERB', verb: action.verb as VerbId })
    finalState = adventureReducer(finalState, { type: 'ACT_ON_ITEM', itemId })
    if (targetItemId) finalState = adventureReducer(finalState, { type: 'ACT_ON_ITEM', itemId: targetItemId })
    return { lines: speechFromState(finalState), finalState, selectedOwnerId: finalState.lastInteractionId ?? 'NONE' }
  }
  if (descriptor.ownerFamily === 'arthur-item') {
    const itemId = action.itemId as InventoryItemId
    const finalState = dispatchWorldAction(stateFromFixture(fixture, [itemId]), (action.verb ?? 'GIVE') as VerbId, 'mr-index', itemId)
    return { lines: speechFromState(finalState), finalState, selectedOwnerId: finalState.lastInteractionId ?? 'NONE' }
  }
  if (descriptor.ownerFamily === 'arthur-dialogue') {
    let finalState = dispatchWorldAction(stateFromFixture({ exhaustedTopics: [], ...fixture }), 'TALK_TO', 'mr-index', null)
    if (descriptor.ownerId === 'dialogueMenuSpeechForState') return { lines: dialogueMenuSpeechForState(finalState.phase), finalState, selectedOwnerId: 'DIALOGUE.MENU' }
    finalState = adventureReducer(finalState, { type: 'CHOOSE_DIALOGUE_TOPIC', topicId: action.topicId as string })
    return { lines: speechFromState(finalState), finalState, selectedOwnerId: finalState.lastInteractionId ?? 'DIALOGUE.CLOSED' }
  }
  if (descriptor.ownerFamily === 'reducer-state') {
    const finalState = stateFromFixture(fixture)
    return { lines: executeReducerFixture(action.fixture as string), finalState, selectedOwnerId: `REDUCER.${action.fixture}` }
  }
  if (descriptor.ownerFamily === 'hero-terminal') {
    const finalState = stateFromFixture(fixture)
    return { lines: selectHeroTerminalSpeech(action.route as HeroTerminalRoute), finalState, selectedOwnerId: `COMPONENT.HERO.${action.route}` }
  }
  if (descriptor.ownerFamily === 'brcg-terminal') {
    const finalState = stateFromFixture(fixture)
    return { lines: selectBrcgTerminalSpeech(action.state as 'UNTESTED' | 'RESOLVED'), finalState, selectedOwnerId: `COMPONENT.BRCG.${action.state}` }
  }
  if (descriptor.ownerFamily === 'ending-completion') {
    const finalState = stateFromFixture(fixture)
    return { lines: selectEndingVariantSpeech(Boolean(action.brcgResolved)), finalState, selectedOwnerId: `COMPONENT.ENDING.${Boolean(action.brcgResolved)}` }
  }
  throw new Error(`Unknown R55 production owner family: ${descriptor.ownerFamily}`)
}

export function executeR55TrueProductionRoute(descriptor: R55ProductionRouteDescriptor): SpeechLine[] {
  return executeR55ActualAction(descriptor).lines
}
