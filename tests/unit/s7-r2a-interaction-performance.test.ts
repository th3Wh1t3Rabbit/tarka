import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { VERBS, type AdventureAction, type AdventureState, type HotspotId, type InventoryItemId, type VerbId } from '../../src/adventure/types'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import { HERO_HOTSPOTS, resolveHeroInteraction } from '../../src/controller/interaction/spec'
import { GENERIC_PERFORMANCE_FALLBACKS, SCRIPTED_SEQUENCES, SEMANTIC_CONTACTS, STAGE_MARKS, idleIntentsAt } from '../../src/controller/mission/performance'
import { dialogueTopicsForState } from '../../src/adventure/content'
import { publicSpeaker, terminalHintMilestone } from '../../src/controller/content/adapter'
import { buildFrozenFixture } from '../../src/investigation/fixture'
import { createInvestigationState, investigationReducer, recommendations } from '../../src/investigation/state'

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const fixture = () => buildFrozenFixture(read('public/scenarios/euler-2023-false-exit/scenario.json'), read('public/scenarios/euler-2023-false-exit/evidence-graph.json'))
const send = (state: AdventureState, action: AdventureAction) => adventureReducer(state, action)
function interact(state: AdventureState, verb: VerbId, targetId: HotspotId, itemId?: InventoryItemId) {
  let next = send(state, { type: 'SELECT_VERB', verb })
  if (itemId) next = send(next, { type: 'ACT_ON_ITEM', itemId })
  next = send(next, { type: 'INTERACT', targetId })
  return send(next, { type: 'WALK_TICK', delta: 2_000 })
}
function drainBlocking(state: AdventureState) { let next = state; for (let i = 0; next.activeSequence && i < 30; i++) next = send(next, { type: 'ADVANCE_SEQUENCE' }); for (let i = 0; next.speech && i < 30; i++) next = send(next, { type: 'ADVANCE_SPEECH' }); return next }
function drainOptional(state: AdventureState) { let next = state; for (let i = 0; next.nonblockingSpeech && i < 30; i++) next = send(next, { type: 'ADVANCE_SPEECH', channel: 'NONBLOCKING' }); return next }

describe('S7-R2A interaction, dialogue, staging, and dependency shell', () => {
  it('resolves every hero hotspot × nine verbs through a closed semantic ID contract', () => {
    expect(HERO_HOTSPOTS).toHaveLength(6)
    for (const target of HERO_HOTSPOTS) for (const verb of VERBS) {
      const result = resolveHeroInteraction(verb, target, 'COMPLETE', null)
      expect(result.id).toMatch(/^INTERACTION\.(REQUIRED|OPTIONAL)\./)
      expect(result.copyIds.length).toBeGreaterThan(0)
      expect(result.actorIntentions.length).toBeGreaterThan(0)
      if (result.classification === 'OPTIONAL_NONBLOCKING') expect(result.stateEffects).toEqual(['NONE'])
    }
  })

  it('keeps optional interactions state-neutral and safely saturates globe escalation', () => {
    let state = { ...createInitialAdventureState({ skipIntro: true }), reducedAnimation: true }
    const baseline = { phase: state.phase, inventory: state.inventory, archived: state.archivedEvidenceIds }
    for (let i = 0; i < 6; i++) {
      state = interact(state, 'PUSH', 'office-globe')
      expect({ phase: state.phase, inventory: state.inventory, archived: state.archivedEvidenceIds }).toEqual(baseline)
      expect(state.lastSoundIntent).toBe('SFX.GLOBE_SPIN')
      state = drainOptional(state)
    }
    expect(state.interactionRepeats['PUSH:office-globe']).toBe(6)
    expect(resolveHeroInteraction('PUSH', 'office-globe', 'START', null, 99).repeatIndex).toBe(3)
  })

  it('mutates form handover, stamped return, cabinet collection, and drawer acquisition at the declared semantic contacts', () => {
    const FORM = 'blank-terminal-authorization-form' as const
    const PEN = 'loose-feather-pen' as const
    const SIGNED = 'signed-terminal-authorization-form-with-doodles' as const
    let state = { ...createInitialAdventureState({ skipIntro: true }), reducedAnimation: true }
    state = drainBlocking(interact(state, 'PICK_UP', 'blank-authorization-form'))
    expect(state.inventory).toEqual([FORM])
    state = drainBlocking(interact(state, 'PICK_UP', 'pen-stand'))
    expect(state.inventory).toEqual([FORM, PEN])
    state = send(state, { type: 'SELECT_VERB', verb: 'USE' })
    state = send(state, { type: 'ACT_ON_ITEM', itemId: FORM })
    state = drainBlocking(send(state, { type: 'ACT_ON_ITEM', itemId: PEN }))
    expect(state.phase).toBe('FORM_COMPLETED')
    state = interact(state, 'GIVE', 'mr-index', SIGNED)
    expect(state.lastSequenceId).toBe('SEQUENCE.FORM_REVIEW_RETURN')
    state = drainBlocking(state)
    expect(state.lastSemanticContact).toBe('CONTACT.FORM_RETURN')
    expect(state.phase).toBe('COMPLETE')
    expect(state.inventory).toEqual(['broken-feather-pen', 'approved-stamped-terminal-authorization-form'])
    expect(state.sequenceEvents.find((e) => e.semanticContact === 'CONTACT.FORM_HANDOFF')?.mutationApplied).toBe(true)
    state = drainBlocking(interact({ ...state }, 'OPEN', 'official-case-file-cabinet'))
    expect(state.caseFileDrawer).toBe('OPEN')
    expect(state.inventory).not.toContain('euler-case-file')
    state = drainBlocking(interact(state, 'PICK_UP', 'disorderly-stack-of-confidential-files'))
    expect(state.lastSequenceId).toBe('SEQUENCE.CASEFILE_COLLECTION')
    expect(state.lastSemanticContact).toBe('CONTACT.CASEFILE_COLLECT')
    expect(state.inventory).toContain('euler-case-file')
    state = drainBlocking(interact(state, 'OPEN', 'miscellaneous-drawer-cabinet'))
    expect(state.miscDrawer).toBe('OPEN')
    expect(state.inventory).not.toContain('rubber-band')
    state = drainBlocking(interact(state, 'PICK_UP', 'miscellaneous-catch-all-contents'))
    expect(state.lastSequenceId).toBe('SEQUENCE.DRAWER_LOOT')
    expect(state.lastSemanticContact).toBe('CONTACT.DRAWER_PICKUP_5')
    expect(state.sequenceEvents.filter((e) => e.semanticContact?.startsWith('CONTACT.DRAWER_PICKUP'))).toHaveLength(5)
  })

  it('keeps blocking and nonblocking channels separate with transcript and reveal-then-advance behavior', () => {
    let state = { ...createInitialAdventureState({ skipIntro: true }), reducedAnimation: true }
    state = interact(state, 'LOOK_AT', 'office-globe')
    expect(state.nonblockingSpeech).not.toBeNull()
    const phase = state.phase
    state = send(state, { type: 'REQUEST_HINT', tier: 'METHOD_HINT' })
    expect(state.speech).not.toBeNull()
    expect(state.nonblockingSpeech).not.toBeNull()
    expect(state.transcript.some((entry) => entry.channel === 'NONBLOCKING')).toBe(true)
    expect(state.transcript.some((entry) => entry.channel === 'BLOCKING')).toBe(true)
    const firstLine = state.speech!.lines[0]!.text
    state = send(state, { type: 'ADVANCE_SPEECH' })
    expect(state.speech?.visibleCharacters).toBe(firstLine.length)
    expect(state.phase).toBe(phase)
    state = send(state, { type: 'ADVANCE_SPEECH' })
    expect(state.speech).toBeNull()
    expect(state.nonblockingSpeech).not.toBeNull()
  })

  it('removes completed optional topics while retaining reminders and exit topics', () => {
    let state = { ...createInitialAdventureState({ skipIntro: true }), reducedAnimation: true }
    state = interact(state, 'TALK_TO', 'mr-index')
    state = send(state, { type: 'CHOOSE_DIALOGUE_TOPIC', topicId: 'sports' })
    state = drainBlocking(state)
    const topics = dialogueTopicsForState(state)
    expect(topics.some(({ id }) => id === 'sports')).toBe(false)
    expect(topics.some(({ id }) => id === 'form-reminder')).toBe(true)
    expect(topics.some(({ id }) => id === 'leave')).toBe(true)
    expect(state.dialogueAnnouncement).toMatch(/^Topic completed\. \d+ topics remain\.$/)
    expect(publicSpeaker('MR_INDEX')).toBe('Arthur')
  })

  it('selects named terminal milestones rather than selected-record or any-event shortcuts', () => {
    const f = fixture()
    let state = investigationReducer(f, createInvestigationState(f), { type: 'EARN_ACCESS' })
    expect(terminalHintMilestone(state)).toBe('TERMINAL.ACCESS_EARNED')
    state = investigationReducer(f, state, { type: 'SECTION', section: 'EXPLORE' })
    expect(terminalHintMilestone(state)).toBe('TERMINAL.BROAD_SEA_SEEN')
    state = { ...state, result: { query: state.query, recordIds: [f.openingRecordId], folders: [{ id: 'FOLDER.TEST', recordId: f.openingRecordId, summary: 'test', whyMatched: [], grade: 'EXACT', status: 'UNTESTED', maySupport: 'test', cannotProve: 'test', nextQuestionIds: [], sortReason: 'test' }], zeroClass: null, coverageIds: [], delta: { previousCount: 0, newCount: 1, includedReason: 'test', excluded: [] } } }
    expect(terminalHintMilestone(state)).toBe('TERMINAL.CANDIDATES_AVAILABLE')
    state = { ...state, comparison: [f.openingRecordId, f.secondRecordId] }
    expect(terminalHintMilestone(state)).toBe('TERMINAL.COMPARISON_AVAILABLE')
    state = { ...state, workingTheory: 'FIRST_TRAIL_STOPS_AT_FIRST_ENGINE' }
    expect(terminalHintMilestone(state)).toBe('TERMINAL.WORKING_THEORY_SELECTED')
  })

  it('foregrounds the exact Lead-authored opening question trio', () => {
    const f = fixture()
    const earned = investigationReducer(f, createInvestigationState(f), { type: 'EARN_ACCESS' })
    const collected = investigationReducer(f, earned, { type: 'COLLECT_CASE_FILE' })
    expect(recommendations(f, collected).map(({ id }) => id)).toEqual(['CARD.INCIDENT_DAI'])
  })

  it('files AMOUNT and RECEIVER in either order and rejects LINK until both are filed', () => {
    const f = fixture()
    const base = { ...investigationReducer(f, createInvestigationState(f), { type: 'EARN_ACCESS' }), discoveredRecords: [...new Set(Object.values(f.proof.slots))], exactEventIds: [`EXACT.${f.proof.slots.LINK}`] }
    const rejected = investigationReducer(f, base, { type: 'ASSEMBLE', slot: 'LINK', recordId: f.proof.slots.LINK })
    expect(rejected.assembly.LINK).toBeUndefined()
    expect(rejected.error).toContain('AMOUNT and RECEIVER')
    for (const order of [['AMOUNT', 'RECEIVER'], ['RECEIVER', 'AMOUNT']] as const) {
      let state = base
      for (const slot of order) state = investigationReducer(f, state, { type: 'ASSEMBLE', slot, recordId: f.proof.slots[slot] })
      state = investigationReducer(f, state, { type: 'ASSEMBLE', slot: 'LINK', recordId: f.proof.slots.LINK })
      expect(state.complete).toBe(true)
      expect(terminalHintMilestone(state)).toBe('TERMINAL.PROOF_COMPLETE')
    }
  })

  it('provides deterministic idles, reduced-motion static fallback, and generic sequence fallbacks', () => {
    expect(idleIntentsAt(6, false)).toEqual([{ actor: 'ROOK', intention: 'IDLE', cue: 'MICRO_IDLE' }])
    expect(idleIntentsAt(26, false)).toEqual(idleIntentsAt(6, false))
    expect(idleIntentsAt(10, true).every(({ cue }) => cue === 'STATIC')).toBe(true)
    expect(GENERIC_PERFORMANCE_FALLBACKS).toEqual(['IDLE', 'TALK', 'LISTEN', 'USE'])
    expect(STAGE_MARKS).toHaveLength(9)
    expect(SEMANTIC_CONTACTS).toHaveLength(13)
    expect(SCRIPTED_SEQUENCES.every((sequence) => sequence.actions.every((action) => ['GENERIC', 'STATIC_TEXT'].includes(action.fallback)))).toBe(true)
  })
})
