import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import type { AdventureAction, AdventureState, HotspotId, InventoryItemId, VerbId } from '../../src/adventure/types'
import { terminalHintMilestone } from '../../src/controller/content/adapter'
import { S7_R3_CONTENT_IDENTITY, r2bInteraction, validateR2bRuntimeSelection } from '../../src/controller/content/s7-r3'
import { PERFORMANCE_SPANS, PERFORMANCE_TRACKS, TIMING_INTENTIONS, performanceSpanAnchorsAreExact } from '../../src/controller/mission/performance'
import { availableCards, createInvestigationState, investigationReducer, recommendations } from '../../src/investigation/state'
import { buildFrozenFixture } from '../../src/investigation/fixture'

const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const fixture = () => buildFrozenFixture(json('public/scenarios/euler-2023-false-exit/scenario.json'), json('public/scenarios/euler-2023-false-exit/evidence-graph.json'))
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
const send = (state: AdventureState, action: AdventureAction) => adventureReducer(state, action)
function interact(state: AdventureState, verb: VerbId, targetId: HotspotId, itemId?: InventoryItemId) {
  let next = send(state, { type: 'SELECT_VERB', verb })
  if (itemId) next = send(next, { type: 'ACT_ON_ITEM', itemId })
  next = send(next, { type: 'INTERACT', targetId })
  return send(next, { type: 'WALK_TICK', delta: 2_000 })
}
function drain(state: AdventureState) { let next = state; for (let i = 0; next.speech && i < 60; i++) next = send(next, { type: 'ADVANCE_SPEECH' }); return next }
function drainSequence(state: AdventureState) { let next = state; for (let i = 0; next.activeSequence && i < 30; i++) next = send(next, { type: 'ADVANCE_SEQUENCE' }); return next }
function settle(state: AdventureState) { return drain(drainSequence(state)) }

describe('S7-R3 exact content, runtime seams, and semantic performance', () => {
  it('preserves all eight admitted files byte-for-byte and validates catalog identities', () => {
    const expected: Record<string, string> = {
      'content/parallel/narrative/S7_R2B_CLAIM_BOUNDARY_AUDIT.json': '8cc73e4f2a9eb73c48307a49cd155794843590a3bff65cfbf0661b5f51ed1fe6',
      'content/parallel/narrative/S7_R2B_CONTENT_CATALOG.json': '24fbc0221056f7aaf8aa64862b97ed7c6a1e24f82d7230866b49189d41611953',
      'content/parallel/narrative/S7_R2B_INTERACTION_MATRIX.json': '877f500e51d53218c7af2b855934c37a8af76a6fe752844aff500e4d46908a8d',
      'content/parallel/narrative/S7_R2B_LINE_LENGTH_REPORT.json': 'a88870fbb5c985a0d44e41919f191b0473938c0a88d78a6f00410475ad07c4a6',
      'content/parallel/narrative/S7_R2B_RUNTIME_SELECTION_MAP.json': '664e774b787b83aa9dc196d7be5bbc28977e376c7acf7fc95407df43f32ce1c4',
      'content/parallel/narrative/S7_R2B_SEMANTIC_INTENTS.json': 'e8eb03344e8e23cea6e3d1bc27c8fba84ab9df0bcd6380a4c4eafcfcef63d5aa',
      'content/parallel/narrative/S7_R2B_SOURCE_LINE_LEDGER.json': '73c711c0826f35afd9981ab8b6388d11132a0fa8d725bac5c4c1007d80e41809',
      'docs/parallel/lane-a/TE_IFACE_CONTENT_v1.2.0.json': 'afcec0c5b761e282e65c02a355d7e6e61625c4ace01cdc5a52324ed910ef8d0a',
    }
    for (const [path, hash] of Object.entries(expected)) expect(sha(path)).toBe(hash)
    expect(validateR2bRuntimeSelection()).toBe(true)
    expect(S7_R3_CONTENT_IDENTITY).toMatchObject({ interface: 'TE-IFACE-CONTENT@1.2.0', entryCount: 191 })
  })

  it('keeps all 208 source-ledger texts literal in the exact Lead design', () => {
    const ledger = json('content/parallel/narrative/S7_R2B_SOURCE_LINE_LEDGER.json')
    const design = readFileSync('artifacts/g6p-s7-r3/INPUTS/TRACE_ESCAPE_S7_R2_LEAD_AUTHORED_PUZZLE_DIALOGUE_INTERACTION_DESIGN_v1.0.0_2026-09-18.md', 'utf8')
    expect(ledger.items).toHaveLength(208)
    for (const item of ledger.items) expect(design).toContain(item.source_text)
  })

  it('uses structured Rook, System, Arthur entries for terminal TALK TO with one caption', () => {
    const interaction = r2bInteraction('nansen-terminal', 'TALK_TO')!
    expect(interaction.lines.map(({ speaker, text }) => ({ speaker, text }))).toEqual([
      { speaker: 'ROOK', text: 'Hello?' },
      { speaker: 'SYSTEM', text: '[BZZZT.]' },
      { speaker: 'MR_INDEX', text: 'It prefers structured questions.' },
    ])
    expect(interaction.lines.filter(({ text }) => text === '[BZZZT.]')).toHaveLength(1)
  })

  it('appends only the current transcript line and never preloads future lines', () => {
    let state = createInitialAdventureState()
    expect(state.transcript).toHaveLength(1)
    expect(state.transcript[0]?.text).toBe(state.speech?.lines[0]?.text)
    state = send(state, { type: 'ADVANCE_SPEECH' })
    expect(state.transcript).toHaveLength(1)
    state = send(state, { type: 'ADVANCE_SPEECH' })
    expect(state.transcript).toHaveLength(2)
    expect(state.transcript[1]?.text).toBe(state.speech?.lines[1]?.text)
  })

  it('records contact order and applies form handover, stamped return, and cabinet mutations only on their declared contacts', () => {
    const FORM = 'blank-terminal-authorization-form' as const
    const PEN = 'loose-feather-pen' as const
    const SIGNED = 'signed-terminal-authorization-form-with-doodles' as const
    let state = { ...createInitialAdventureState({ skipIntro: true }), reducedAnimation: true }
    state = settle(interact(state, 'PICK_UP', 'blank-authorization-form'))
    state = settle(interact(state, 'PICK_UP', 'pen-stand'))
    expect(state.inventory).toEqual([FORM, PEN])
    state = send(state, { type: 'SELECT_VERB', verb: 'USE' })
    state = send(state, { type: 'ACT_ON_ITEM', itemId: FORM })
    state = settle(send(state, { type: 'ACT_ON_ITEM', itemId: PEN }))
    expect(state.phase).toBe('FORM_COMPLETED')
    state = interact(state, 'GIVE', 'mr-index', SIGNED)
    expect(state.activeSequence?.actionIndex).toBe(-1)
    expect(state.phase).toBe('FORM_COMPLETED')
    expect(state.inventory).toEqual([SIGNED, 'broken-feather-pen'])
    while (state.activeSequence?.currentSemanticContact !== 'CONTACT.FORM_HANDOFF') state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state.phase).toBe('FORM_SUBMITTED')
    expect(state.inventory).toEqual(['broken-feather-pen'])
    while (state.activeSequence?.currentSemanticContact !== 'CONTACT.FORM_STAMP') state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state.inventory).toEqual(['broken-feather-pen'])
    while (state.activeSequence?.currentSemanticContact !== 'CONTACT.FORM_RETURN') state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state.phase).toBe('COMPLETE')
    expect(state.inventory).toEqual(['broken-feather-pen', 'approved-stamped-terminal-authorization-form'])
    state = drainSequence(state)
    const form = state.sequenceEvents.filter(({ sequenceId }) => sequenceId === 'SEQUENCE.FORM_REVIEW_RETURN')
    expect(form.filter(({ semanticContact }) => semanticContact).map(({ semanticContact }) => semanticContact)).toEqual(['CONTACT.FORM_HANDOFF', 'CONTACT.FORM_STAMP', 'CONTACT.FORM_RETURN'])
    expect(form.find(({ mutationApplied }) => mutationApplied)?.semanticContact).toBe('CONTACT.FORM_HANDOFF')
    expect([...state.sequenceEvents].reverse().find(({ sequenceId, mutationApplied }) => sequenceId === 'SEQUENCE.FORM_REVIEW_RETURN' && mutationApplied)?.semanticContact).toBe('CONTACT.FORM_RETURN')
    state = drain(state)
    state = settle(interact(state, 'OPEN', 'official-case-file-cabinet'))
    expect(state.caseFileDrawer).toBe('OPEN')
    state = interact(state, 'PICK_UP', 'disorderly-stack-of-confidential-files')
    state = settle(drainSequence(state))
    expect([...state.sequenceEvents].reverse().find(({ sequenceId, mutationApplied }) => sequenceId === 'SEQUENCE.CASEFILE_COLLECTION' && mutationApplied)?.semanticContact).toBe('CONTACT.CASEFILE_COLLECT')
    state = drain(state)
    state = settle(interact(state, 'OPEN', 'miscellaneous-drawer-cabinet'))
    expect(state.miscDrawer).toBe('OPEN')
    state = settle(interact(state, 'PICK_UP', 'miscellaneous-catch-all-contents'))
    expect([...state.sequenceEvents].reverse().find(({ sequenceId, mutationApplied }) => sequenceId === 'SEQUENCE.DRAWER_LOOT' && mutationApplied)?.semanticContact).toBe('CONTACT.DRAWER_PICKUP_5')
  })

  it('ignores conflicting input, resets atomically, and retains the declared focus-return target', () => {
    const SIGNED = 'signed-terminal-authorization-form-with-doodles' as const
    let state: AdventureState = { ...createInitialAdventureState({ skipIntro: true }), phase: 'FORM_COMPLETED', inventory: [SIGNED, 'broken-feather-pen'], reducedAnimation: true }
    state = interact(state, 'GIVE', 'mr-index', SIGNED)
    const reserved = state
    expect(send(state, { type: 'SELECT_VERB', verb: 'PUSH' })).toEqual(reserved)
    while (state.activeSequence?.currentSemanticContact !== 'CONTACT.FORM_RETURN') state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state.inventory).toEqual(['broken-feather-pen', 'approved-stamped-terminal-authorization-form'])
    const reset = send(state, { type: 'RESET' })
    expect(reset.activeSequence).toBeNull()
    expect(reset.phase).toBe('START')
    expect(reset.inventory).toEqual([])

    state = { ...createInitialAdventureState({ skipIntro: true }), phase: 'FORM_COMPLETED', inventory: [SIGNED, 'broken-feather-pen'], reducedAnimation: true }
    state = drainSequence(interact(state, 'GIVE', 'mr-index', SIGNED))
    expect(state.activeSequence).toBeNull()
    expect(state.focusReturnTarget).toBe('mr-index')
    expect(state.speech).not.toBeNull()
  })

  it('crosses phrase cues from revealed characters and keeps after-line reactions player-paced', () => {
    let state = createInitialAdventureState()
    while (state.speech?.lines[state.speech.lineIndex]?.copyKey !== 'lane_a.s7r2b.opening.3') {
      state = send(state, { type: 'ADVANCE_SPEECH' })
      state = send(state, { type: 'ADVANCE_SPEECH' })
    }
    expect(state.speech?.performance.crossedCueIds).toContain('PERF.OPEN.ROOK.CONFIDENCE')
    state = send(state, { type: 'REVEAL_TICK', characters: 'Right.'.length })
    expect(state.speech?.performance.crossedCueIds).toEqual(expect.arrayContaining(['PERF.OPEN.RIGHT.BEAT', 'PERF.OPEN.RIGHT.GAZE']))
    const line = state.speech!.lines[state.speech!.lineIndex]!.text
    state = send(state, { type: 'REVEAL_TICK', characters: line.indexOf('Mr. A—') - state.speech!.visibleCharacters })
    expect(state.speech?.performance.crossedCueIds).toContain('PERF.OPEN.NICKNAME.LEAN')
    state = send(state, { type: 'REVEAL_FULL' })
    state = send(state, { type: 'ADVANCE_SPEECH' })
    expect(state.speech?.performance.activeActor).toBe('ARTHUR')
    expect(state.speech?.performance.crossedCueIds).toContain('PERF.OPEN.INTERRUPT')
    state = send(state, { type: 'REVEAL_FULL' })
    expect(state.speech?.performance.afterLineHold).toBe(true)
    expect(state.speech?.lines[state.speech.lineIndex]?.copyKey).toBe('lane_a.s7r2b.opening.4')
    state = send(state, { type: 'TOGGLE_REDUCED_ANIMATION' })
    expect(state.speech?.performance.reducedMotion).toBe(true)
    expect(state.speech?.performance.crossedCueIds).toContain('PERF.OPEN.COMIC_HOLD')
  })

  it('preserves legacy INCIDENT and adds distinct subject-free INCIDENT_DAI with window and DAI predicates', () => {
    const f = fixture()
    const earned = investigationReducer(f, createInvestigationState(f), { type: 'EARN_ACCESS' })
    const collected = investigationReducer(f, earned, { type: 'COLLECT_CASE_FILE' })
    expect(recommendations(f, collected).map(({ id }) => id)).toEqual(['CARD.INCIDENT_DAI'])
    const state = investigationReducer(f, investigationReducer(f, collected, { type: 'REVIEW_RECEIPT' }), { type: 'DISPATCH', path: 'TERMINAL' })
    const cards = availableCards(f, state)
    const legacy = cards.find(({ id }) => id === 'CARD.INCIDENT')!
    const dai = cards.find(({ id }) => id === 'CARD.INCIDENT_DAI')!
    expect(legacy.effects.map(({ field }) => field)).toEqual(['FROM', 'TO', 'SUBJECT'])
    expect(legacy.effects.some(({ field }) => field === 'ASSET')).toBe(false)
    expect(dai.effects.map(({ field }) => field)).toEqual(['ASSET', 'FROM', 'TO'])
    expect(dai.effects.find(({ field }) => field === 'ASSET')?.value).toBe('DAI')
  })

  it('requires exact LINK identity for convergence and starts its correction once', () => {
    const f = fixture()
    let state = investigationReducer(f, createInvestigationState(f), { type: 'EARN_ACCESS' })
    state = { ...state, exactEventIds: [`EXACT.${f.proof.slots.AMOUNT}`] }
    expect(terminalHintMilestone(state)).not.toBe('TERMINAL.EXACT_CONVERGENCE_VERIFIED')
    state = { ...state, exactConvergenceVerified: true }
    expect(terminalHintMilestone(state)).toBe('TERMINAL.EXACT_CONVERGENCE_VERIFIED')
    state = investigationReducer(f, state, { type: 'ACK_EXACT_CORRECTION' })
    expect(state.exactCorrectionStarted).toBe(true)
    expect(investigationReducer(f, state, { type: 'ACK_EXACT_CORRECTION' })).toEqual(state)
  })

  it('plays the required return only on explicit completed-case return and keeps the optional tag one-shot and neutral', () => {
    let state: AdventureState = { ...createInitialAdventureState({ skipIntro: true }), phase: 'COMPLETE', inventory: ['broken-feather-pen', 'approved-stamped-terminal-authorization-form'] }
    const before = { phase: state.phase, inventory: state.inventory, archived: state.archivedEvidenceIds }
    expect(state.returnExchangePlayed).toBe(false)
    state = send(state, { type: 'RETURN_FROM_COMPLETED_CASE' })
    expect(state.speech?.lines.map(({ text }) => text)).toEqual(['Case closed.', 'Bounded.', 'Case bounded.', 'Now it is closed.'])
    state = drain(state)
    state = send(state, { type: 'RETURN_FROM_COMPLETED_CASE' })
    expect(state.speech).toBeNull()
    state = send(state, { type: 'PLAY_RETURN_TAG' })
    expect(state.returnTagPlayed).toBe(true)
    expect({ phase: state.phase, inventory: state.inventory, archived: state.archivedEvidenceIds }).toEqual(before)
    state = drain(state)
    expect(send(state, { type: 'PLAY_RETURN_TAG' })).toEqual(state)
  })

  it('keeps Arthur’s broken-pen reply after Rook asks who is buying in both ending branches', () => {
    const endingLines = (brcgResolved: boolean) => {
      const state: AdventureState = { ...createInitialAdventureState({ skipIntro: true }), phase: 'COMPLETE' }
      return send(state, { type: 'RETURN_FROM_COMPLETED_CASE', brcgResolved }).speech?.lines.map(({ text }) => text) ?? []
    }
    const defaultEnding = endingLines(false)
    const brcgEnding = endingLines(true)
    const prompt = 'So you’re buying?'
    const reply = 'You broke my pen. I’d say you owe me.'

    expect(defaultEnding[defaultEnding.indexOf(prompt) + 1]).toBe(reply)
    expect(brcgEnding[brcgEnding.indexOf(prompt) + 1]).toBe(reply)
    expect(defaultEnding.some(line => line.startsWith('And besides'))).toBe(false)
    expect(brcgEnding.some(line => line.startsWith('And besides'))).toBe(true)
  })

  it('supports all six tracks, twelve timing intentions, exact intraline anchors, and complete fallbacks', () => {
    const catalog = json('content/parallel/narrative/S7_R2B_CONTENT_CATALOG.json')
    const copy = new Map<string, string>(catalog.entries.map((entry: { key: string; text: string }) => [entry.key, entry.text]))
    expect(PERFORMANCE_TRACKS).toEqual(['FACE', 'GAZE', 'BODY', 'PROP', 'VOICE_TEXT', 'TIME'])
    expect(new Set(PERFORMANCE_SPANS.map(({ track }) => track))).toEqual(new Set(PERFORMANCE_TRACKS))
    expect(TIMING_INTENTIONS).toHaveLength(12)
    expect(performanceSpanAnchorsAreExact(copy)).toBe(true)
    expect(PERFORMANCE_SPANS.some(({ copyKey, trigger }) => copyKey === 'lane_a.s7r2b.exact_correction.1' && trigger === 'AFTER_SUBSTRING')).toBe(true)
    expect(PERFORMANCE_SPANS.every(({ fallback, reducedMotionFallback, screenReaderNote }) => fallback && reducedMotionFallback && screenReaderNote === null)).toBe(true)
  })
})
