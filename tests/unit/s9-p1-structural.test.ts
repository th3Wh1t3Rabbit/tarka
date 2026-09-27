import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { adventureReducer, createInitialAdventureState, currentSpeechLine, phaseReached } from '../../src/adventure/reducer'
import { blockedInteractions, deadEndResponse, dialogueTopicsForState, inventoryItems, itemRules, PHASE_ORDER, usefulRules } from '../../src/adventure/content'
import { officeLines } from '../../src/controller/content/adapter'
import { RECORDS_OFFICE_STEPS } from '../../src/controller/mission/choreography'
import { SCRIPTED_SEQUENCES, sequenceForRule } from '../../src/controller/mission/performance'
import { HERO_HOTSPOTS } from '../../src/controller/interaction/spec'
import { recordsOfficeHotspots } from '../../src/adventure/scenes'
import { BARK_1_AFTER_S, BARK_2_AFTER_S, S9_FORM_BARK_1, S9_FORM_BARK_2, S9_OFFICE_HINTS } from '../../src/controller/content/s9-placeholders'
import { buildFrozenFixture } from '../../src/investigation/fixture'
import { availableCards, collectedStartingClues, createInvestigationState, exportLocalSave, investigationReducer, knownRecords, restoreInvestigation, terminalCapabilities, visibleClues, type Command } from '../../src/investigation/state'
import type { HotspotId, InventoryItemId, PuzzlePhase, VerbId } from '../../src/adventure/types'

const base = 'public/scenarios/euler-2023-false-exit/'
const frozen = buildFrozenFixture(JSON.parse(readFileSync(base + 'scenario.json', 'utf8')), JSON.parse(readFileSync(base + 'evidence-graph.json', 'utf8')))

type Office = ReturnType<typeof createInitialAdventureState>
const fresh = (): Office => ({ ...createInitialAdventureState({ skipIntro: true }), reducedAnimation: true, instantText: true })
const drain = (state: Office): Office => {
  let s = state
  for (let i = 0; i < 40 && s.activeSequence; i++) s = adventureReducer(s, { type: 'ADVANCE_SEQUENCE' })
  for (let i = 0; i < 40 && s.speech; i++) { s = adventureReducer(s, { type: 'REVEAL_FULL' }); s = adventureReducer(s, { type: 'ADVANCE_SPEECH' }) }
  for (let i = 0; i < 10 && s.nonblockingSpeech; i++) { s = adventureReducer(s, { type: 'REVEAL_FULL', channel: 'NONBLOCKING' }); s = adventureReducer(s, { type: 'ADVANCE_SPEECH', channel: 'NONBLOCKING' }) }
  return s
}
const doVerb = (s: Office, verb: VerbId, targetId: HotspotId, itemId?: InventoryItemId): Office => {
  const shells = targetId === 'official-case-file-cabinet' || targetId === 'miscellaneous-drawer-cabinet'
  const base = shells && s.phase !== 'COMPLETE' ? { ...s, phase: 'COMPLETE' as const } : s
  let x = adventureReducer(base, { type: 'SELECT_VERB', verb })
  if (itemId) x = adventureReducer(x, { type: 'SELECT_ITEM', itemId })
  return drain(adventureReducer(x, { type: 'INTERACT', targetId }))
}
const combine = (s: Office, first: InventoryItemId, second: InventoryItemId): Office => {
  let x = adventureReducer(s, { type: 'SELECT_VERB', verb: 'USE' })
  x = adventureReducer(x, { type: 'ACT_ON_ITEM', itemId: first })
  return drain(adventureReducer(x, { type: 'ACT_ON_ITEM', itemId: second }))
}
const stepOnce = (s: Office): Office => adventureReducer(s, { type: 'ADVANCE_SEQUENCE' })

const FORM = 'blank-terminal-authorization-form' as const
const PEN = 'loose-feather-pen' as const
const SIGNED = 'signed-terminal-authorization-form-with-doodles' as const
const BROKEN = 'broken-feather-pen' as const
const STAMPED = 'approved-stamped-terminal-authorization-form' as const

function playToFormAndPen(): Office {
  let s = fresh()
  s = doVerb(s, 'PICK_UP', 'blank-authorization-form')
  return doVerb(s, 'PICK_UP', 'pen-stand')
}

function playToFormCompleted(): Office {
  return combine(playToFormAndPen(), FORM, PEN)
}

describe('S9-P1 office structural mechanics', () => {
  it('collects form and pen in either order into FORM_AND_PEN', () => {
    const a = doVerb(doVerb(fresh(), 'PICK_UP', 'blank-authorization-form'), 'PICK_UP', 'pen-stand')
    expect(a.phase).toBe('FORM_AND_PEN')
    expect([...a.inventory].sort()).toEqual([FORM, PEN].sort())
    const b = doVerb(doVerb(fresh(), 'PICK_UP', 'pen-stand'), 'PICK_UP', 'blank-authorization-form')
    expect(b.phase).toBe('FORM_AND_PEN')
    expect([...b.inventory].sort()).toEqual([FORM, PEN].sort())
  })
  it('combines form and pen in either selection order with byte-equivalent state', () => {
    const a = combine(playToFormAndPen(), FORM, PEN)
    const b = combine(playToFormAndPen(), PEN, FORM)
    expect(a.phase).toBe('FORM_COMPLETED')
    expect(b.phase).toBe('FORM_COMPLETED')
    expect(a.inventory).toEqual(b.inventory)
    expect(a.inventory).toEqual([SIGNED, BROKEN])
  })
  it('renders rule-level lines for required interactions, never stale matrix cells', () => {
    let s = fresh()
    s = adventureReducer(s, { type: 'SELECT_VERB', verb: 'PICK_UP' })
    s = adventureReducer(s, { type: 'INTERACT', targetId: 'blank-authorization-form' })
    expect(currentSpeechLine(s)?.text).toContain('Blank authorization form.')
    s = drain(s)
    s = adventureReducer(s, { type: 'SELECT_VERB', verb: 'PICK_UP' })
    s = adventureReducer(s, { type: 'INTERACT', targetId: 'pen-stand' })
    expect(currentSpeechLine(s)?.text).toContain('Loose feather pen.')
    s = drain(s)
    s = combine(s, FORM, PEN)
    s = adventureReducer(s, { type: 'SELECT_VERB', verb: 'GIVE' })
    s = adventureReducer(s, { type: 'SELECT_ITEM', itemId: SIGNED })
    s = adventureReducer(s, { type: 'INTERACT', targetId: 'mr-index' })
    s = drain(s)
    expect(s.phase).toBe('COMPLETE')
    expect(JSON.stringify(s.transcript)).toContain('Completed form, with doodles.')
    expect(JSON.stringify(s.transcript)).not.toMatch(/not a recognized request/)
  })
  it('authorizes only at the stamped-form return contact', () => {
    let s = playToFormCompleted()
    expect(s.phase).toBe('FORM_COMPLETED')
    s = adventureReducer(s, { type: 'SELECT_VERB', verb: 'GIVE' })
    s = adventureReducer(s, { type: 'SELECT_ITEM', itemId: SIGNED })
    s = adventureReducer(s, { type: 'INTERACT', targetId: 'mr-index' })
    expect(s.activeSequence?.id).toBe('SEQUENCE.FORM_REVIEW_RETURN')
    for (let i = 0; i < 20 && s.activeSequence && s.phase !== 'FORM_SUBMITTED'; i++) s = stepOnce(s)
    expect(s.phase).toBe('FORM_SUBMITTED')
    expect(s.inventory).not.toContain(SIGNED)
    expect(s.inventory).not.toContain(STAMPED)
    s = drain(s)
    expect(s.phase).toBe('COMPLETE')
    expect(s.inventory).toContain(STAMPED)
    expect(s.inventory).toContain(BROKEN)
    const handoff = s.sequenceEvents.find((e) => e.semanticContact === 'CONTACT.FORM_HANDOFF')
    const ret = s.sequenceEvents.find((e) => e.semanticContact === 'CONTACT.FORM_RETURN')
    expect(handoff?.mutationApplied).toBe(true)
    expect(handoff?.inventoryAfter).not.toContain(SIGNED)
    expect(ret?.mutationApplied).toBe(true)
    expect(ret?.inventoryAfter).toContain(STAMPED)
    expect(ret?.phaseAfter).toBe('COMPLETE')
  })
  it('keeps the broken pen through give/inkwell refusals without loss', () => {
    expect(blockedInteractions).toHaveLength(2)
    const s = playToFormCompleted()
    for (const [verb, target] of [['GIVE', 'mr-index'], ['USE', 'pen-stand']] as const) {
      let x = adventureReducer(s, { type: 'SELECT_VERB', verb })
      x = adventureReducer(x, { type: 'SELECT_ITEM', itemId: BROKEN })
      const refused = adventureReducer(x, { type: 'INTERACT', targetId: target })
      expect(refused.nonblockingSpeech).not.toBeNull()
      expect(refused.activeSequence).toBeNull()
      expect(refused.inventory).toEqual(s.inventory)
      expect(refused.phase).toBe(s.phase)
      expect(refused.inventory).toContain(BROKEN)
    }
  })
  it('reprimands pre-authorization terminal use deterministically without opening', () => {
    const phases: PuzzlePhase[] = ['START', 'FORM_HELD', 'PEN_HELD', 'FORM_AND_PEN', 'FORM_COMPLETED', 'FORM_SUBMITTED']
    for (const phase of phases) {
      let s: Office = { ...fresh(), phase }
      s = adventureReducer(s, { type: 'SELECT_VERB', verb: 'USE' })
      s = adventureReducer(s, { type: 'INTERACT', targetId: 'nansen-terminal' })
      expect(s.activeSequence?.id).toBe('SEQUENCE.TERMINAL_REPRIMAND')
      const end = drain(s)
      expect(end.phase).toBe(phase)
      expect(end.inventory).toEqual([])
      expect(end.activeSequence).toBeNull()
      const again = drain(adventureReducer(adventureReducer(end, { type: 'SELECT_VERB', verb: 'USE' }), { type: 'INTERACT', targetId: 'nansen-terminal' }))
      expect(again.phase).toBe(phase)
      expect(again.activeSequence).toBeNull()
    }
  })
  it('collects the Euler file exactly once via the drawer seam and rummage contact', () => {
    let s = doVerb(fresh(), 'OPEN', 'official-case-file-cabinet')
    expect(s.caseFileDrawer).toBe('OPEN')
    expect(s.inventory).not.toContain('euler-case-file')
    expect(s.caseStack).toBe('UNSEARCHED')
    const looked = doVerb(s, 'LOOK_AT', 'disorderly-stack-of-confidential-files')
    expect(looked.inventory).not.toContain('euler-case-file')
    expect(looked.caseStack).toBe('UNSEARCHED')
    s = doVerb(s, 'PICK_UP', 'disorderly-stack-of-confidential-files')
    expect(s.inventory.filter((i) => i === 'euler-case-file')).toHaveLength(1)
    expect(s.caseStack).toBe('SEARCHED_EULER_REMOVED')
    const contacts = s.sequenceEvents.filter((e) => e.sequenceId === 'SEQUENCE.CASEFILE_COLLECTION').map((e) => e.semanticContact)
    expect(contacts).toContain('CONTACT.CASEFILE_COLLECT')
    const collectEvent = s.sequenceEvents.find((e) => e.semanticContact === 'CONTACT.CASEFILE_COLLECT')!
    expect(collectEvent.inventoryAfter).toContain('euler-case-file')
    expect(collectEvent.inventoryBefore).not.toContain('euler-case-file')
    s = doVerb(s, 'PICK_UP', 'disorderly-stack-of-confidential-files')
    expect(s.inventory.filter((i) => i === 'euler-case-file')).toHaveLength(1)
    s = doVerb(s, 'CLOSE', 'official-case-file-cabinet')
    expect(s.caseFileDrawer).toBe('CLOSED')
    expect(s.inventory.filter((i) => i === 'euler-case-file')).toHaveLength(1)
  })
  it('collects the misc contents once across five ordered per-contact acquisitions', () => {
    let s = doVerb(fresh(), 'OPEN', 'miscellaneous-drawer-cabinet')
    expect(s.miscDrawer).toBe('OPEN')
    expect(s.inventory).toHaveLength(0)
    expect(s.miscContents).toBe('UNCOLLECTED')
    const looked = doVerb(s, 'LOOK_AT', 'miscellaneous-catch-all-contents')
    expect(looked.inventory).toHaveLength(0)
    s = doVerb(s, 'PICK_UP', 'miscellaneous-catch-all-contents')
    const order = ['rubber-band', 'rubiks-cube', 'sharknado-2-vhs', 'piggy-bank-intact', 'small-toolbox-closed'] as const
    for (const item of order) {
      expect(s.inventory.filter((i) => i === item)).toHaveLength(1)
    }
    const pickups = s.sequenceEvents.filter((e) => e.sequenceId === 'SEQUENCE.DRAWER_LOOT' && e.semanticContact?.startsWith('CONTACT.DRAWER_PICKUP'))
    expect(pickups.map((e) => e.semanticContact)).toEqual(['CONTACT.DRAWER_PICKUP_1', 'CONTACT.DRAWER_PICKUP_2', 'CONTACT.DRAWER_PICKUP_3', 'CONTACT.DRAWER_PICKUP_4', 'CONTACT.DRAWER_PICKUP_5'])
    pickups.forEach((event, index) => {
      expect(event.inventoryAfter).toContain(order[index])
      expect(event.inventoryBefore).not.toContain(order[index])
    })
    expect(s.miscContents).toBe('COLLECTED_GUM_REMAINS')
    expect(s.sequenceEvents.filter((e) => e.semanticContact === 'CONTACT.DRAWER_ACQUIRE')).toHaveLength(0)
    expect(pickups.at(-1)?.mutationApplied).toBe(true)
    const again = doVerb(s, 'PICK_UP', 'miscellaneous-catch-all-contents')
    for (const item of order) {
      expect(again.inventory.filter((i) => i === item)).toHaveLength(1)
    }
    expect(again.sequenceEvents.length).toBe(s.sequenceEvents.length)
  })
  it('opens the toolbox and smashes the piggy bank atomically with hammer retention', () => {
    let s = doVerb(doVerb(fresh(), 'OPEN', 'miscellaneous-drawer-cabinet'), 'PICK_UP', 'miscellaneous-catch-all-contents')
    const before = structuredClone(s)
    s = drain(adventureReducer(adventureReducer(s, { type: 'SELECT_VERB', verb: 'OPEN' }), { type: 'ACT_ON_ITEM', itemId: 'small-toolbox-closed' }))
    expect(s.inventory).not.toContain('small-toolbox-closed')
    expect(s.inventory).toContain('small-toolbox-open-empty')
    expect(s.inventory).toContain('hammer')
    expect(s.inventory).toContain('nails')
    expect(before.inventory.length + 2).toBe(s.inventory.length)
    let t = adventureReducer(s, { type: 'SELECT_VERB', verb: 'USE' })
    t = adventureReducer(t, { type: 'ACT_ON_ITEM', itemId: 'hammer' })
    t = drain(adventureReducer(t, { type: 'ACT_ON_ITEM', itemId: 'piggy-bank-intact' }))
    expect(t.inventory).not.toContain('piggy-bank-intact')
    expect(t.inventory).toContain('hammer')
    expect(t.inventory).toContain('fictional-token-note')
  })
  it('fits the maximum approved simultaneous inventory in ten slots', () => {
    let s = doVerb(playToFormCompleted(), 'GIVE', 'mr-index', SIGNED)
    expect(s.phase).toBe('COMPLETE')
    s = doVerb(doVerb(s, 'OPEN', 'miscellaneous-drawer-cabinet'), 'PICK_UP', 'miscellaneous-catch-all-contents')
    s = adventureReducer(adventureReducer(s, { type: 'SELECT_VERB', verb: 'OPEN' }), { type: 'ACT_ON_ITEM', itemId: 'small-toolbox-closed' })
    s = drain(s)
    let t = adventureReducer(s, { type: 'SELECT_VERB', verb: 'USE' })
    t = adventureReducer(t, { type: 'ACT_ON_ITEM', itemId: 'hammer' })
    t = drain(adventureReducer(t, { type: 'ACT_ON_ITEM', itemId: 'piggy-bank-intact' }))
    t = doVerb(doVerb(t, 'OPEN', 'official-case-file-cabinet'), 'PICK_UP', 'disorderly-stack-of-confidential-files')
    t = doVerb(t, 'GIVE', 'mr-index', SIGNED)
    expect(t.phase).toBe('COMPLETE')
    expect(new Set(t.inventory).size).toBe(t.inventory.length)
    expect(t.inventory.length).toBe(10)
    expect([...t.inventory].sort()).toEqual(['approved-stamped-terminal-authorization-form', 'broken-feather-pen', 'euler-case-file', 'rubber-band', 'rubiks-cube', 'sharknado-2-vhs', 'small-toolbox-open-empty', 'hammer', 'nails', 'fictional-token-note'].sort())
    expect(t.inventory).not.toContain('small-toolbox-closed')
    expect(t.inventory).not.toContain('piggy-bank-intact')
    expect(t.inventory).toContain('euler-case-file')
    expect(t.inventory).toContain('fictional-token-note')
    expect(t.inventory).toContain(STAMPED)
  })
  it('retires the tube path completely from rules, hotspots, menus, and phases', () => {
    expect(PHASE_ORDER).toEqual(['START', 'FORM_HELD', 'PEN_HELD', 'FORM_AND_PEN', 'FORM_COMPLETED', 'FORM_SUBMITTED', 'COMPLETE'])
    expect(recordsOfficeHotspots.map((h) => h.id)).not.toEqual(expect.arrayContaining(['pneumatic-tube', 'dispatch-plunger', 'record-canister']))
    expect([...HERO_HOTSPOTS]).not.toEqual(expect.arrayContaining(['pneumatic-tube', 'dispatch-plunger', 'record-canister']))
    const retired = /tube|plunger|canister|strip|blank-request|completed-request|stamped-request/i
    for (const rule of usefulRules) {
      expect(rule.id).not.toMatch(retired)
      expect(JSON.stringify(rule)).not.toMatch(/pneumatic-tube|dispatch-plunger|record-canister|first-breach-strip/)
    }
    for (const rule of itemRules) expect(rule.id).not.toMatch(retired)
    for (const step of RECORDS_OFFICE_STEPS) expect(step.id).not.toMatch(/tube|plunger|canister|strip/i)
    for (const seq of SCRIPTED_SEQUENCES) expect(seq.id).not.toMatch(/TUBE|CANISTER|STRIP/)
    for (const phase of PHASE_ORDER) {
      const topics = dialogueTopicsForState({ phase, exhaustedTopics: [], inventory: [] })
      expect(JSON.stringify(topics)).not.toMatch(/tube|plunger|canister|strip/i)
    }
    expect(Object.keys(inventoryItems).sort()).toEqual(['approved-stamped-terminal-authorization-form', 'blank-terminal-authorization-form', 'broken-feather-pen', 'euler-case-file', 'fictional-token-note', 'hammer', 'loose-feather-pen', 'nails', 'piggy-bank-intact', 'rubber-band', 'rubiks-cube', 'sharknado-2-vhs', 'signed-terminal-authorization-form-with-doodles', 'small-toolbox-closed', 'small-toolbox-open-empty'].sort())
  })
  it('keeps rule, contract, and sequence bindings in exact parity', () => {
    const hotspotRules = usefulRules.filter((r) => r.targetId)
    expect(RECORDS_OFFICE_STEPS.slice(1).filter((s) => s.target).map((s) => s.id)).toEqual(hotspotRules.map((r) => r.id))
    for (const rule of hotspotRules) {
      expect(sequenceForRule(rule.id) || null).toEqual(rule.id === 'give-form' || rule.id.startsWith('reprimand-') || rule.id === 'pickup-case-stack' || rule.id === 'pickup-misc-contents' ? expect.anything() : null)
    }
    expect(itemRules.map((r) => r.id).sort()).toEqual(['combine-form-pen', 'open-toolbox', 'open-toolbox-open', 'smash-piggy', 'use-toolbox', 'use-toolbox-open'].sort())
    expect(RECORDS_OFFICE_STEPS.filter((s) => !s.target && s.verb).map((s) => s.id).sort()).toEqual(['combine-form-pen', 'open-toolbox', 'open-toolbox-open', 'smash-piggy', 'use-toolbox', 'use-toolbox-open'].sort())
  })
  it('renders every menu topic with no dead buttons and exact exhaustion', () => {
    const pre = dialogueTopicsForState({ phase: 'START', exhaustedTopics: [], inventory: [] }).map((t) => t.id)
    expect(pre).toEqual(['form-reminder', 'sports', 'health', 'nansen-benefit', 'back', 'leave'])
    const post = dialogueTopicsForState({ phase: 'COMPLETE', exhaustedTopics: [], inventory: [] }).map((t) => t.id)
    expect(post).toEqual(['sports', 'health', 'nansen-benefit', 'case-file', 'leave'])
    let s: Office = { ...fresh(), dialogueOpen: true }
    s = adventureReducer(s, { type: 'CHOOSE_DIALOGUE_TOPIC', topicId: 'sports' })
    expect(s.exhaustedTopics).toContain('sports')
    expect(dialogueTopicsForState({ phase: s.phase, exhaustedTopics: s.exhaustedTopics, inventory: s.inventory }).map((t) => t.id)).not.toContain('sports')
    expect(dialogueTopicsForState({ phase: s.phase, exhaustedTopics: s.exhaustedTopics, inventory: s.inventory }).map((t) => t.id)).toContain('form-reminder')
    const reminder = dialogueTopicsForState({ phase: 'START', exhaustedTopics: [], inventory: [] }).find((t) => t.id === 'form-reminder')!
    const reminderLate = dialogueTopicsForState({ phase: 'FORM_COMPLETED', exhaustedTopics: [], inventory: [] }).find((t) => t.id === 'form-reminder')!
    expect(reminder.lines.length).toBe(1)
    expect(reminderLate.lines.length).toBe(1)
    expect(reminder.lines[0]?.text).not.toBe(reminderLate.lines[0]?.text)
    expect(reminder.lines[0]?.copyKey).toMatch(/^lane_a\.s9\./)
    for (const phase of PHASE_ORDER) {
      for (const topic of dialogueTopicsForState({ phase, exhaustedTopics: [], inventory: [] })) {
        if (topic.closes) continue
        expect(topic.lines.length).toBeGreaterThan(0)
      }
    }
  })
  it('bounds reminder barks and never lets them gate progress', () => {    expect(BARK_1_AFTER_S).toBe(75)
    expect(BARK_2_AFTER_S).toBe(165)
    let s = fresh()
    expect(adventureReducer(s, { type: 'PLAY_FORM_BARK' }).barksFired).toBe(0)
    for (let i = 0; i < 75; i++) s = adventureReducer(s, { type: 'IDLE_TICK', foreground: true })
    s = adventureReducer(s, { type: 'PLAY_FORM_BARK' })
    expect(s.barksFired).toBe(1)
    expect(s.nonblockingSpeech).not.toBeNull()
    expect(s.phase).toBe('START')
    expect(s.inventory).toEqual([])
    s = drain(s)
    expect(s.inactiveSeconds).toBe(0)
    for (let i = 0; i < 165; i++) s = adventureReducer(s, { type: 'IDLE_TICK', foreground: true })
    s = adventureReducer(s, { type: 'PLAY_FORM_BARK' })
    expect(s.barksFired).toBe(2)
    s = drain(s)
    const third = adventureReducer(s, { type: 'PLAY_FORM_BARK' })
    expect(third.barksFired).toBe(2)
    expect(third.nonblockingSpeech).toBeNull()
    const authorized: Office = { ...fresh(), phase: 'COMPLETE' }
    expect(adventureReducer(authorized, { type: 'PLAY_FORM_BARK' }).barksFired).toBe(0)
    const busy: Office = { ...fresh(), speech: { lines: [{ speaker: 'ROOK', text: 'x' }], lineIndex: 0, visibleCharacters: 0, returnTo: 'SCENE', performance: { copyKey: null, actor: 'ROOK', crossedCueIds: [], intentions: {}, activeActor: 'ROOK', afterLineHold: false, reducedMotion: false } } }
    expect(adventureReducer(busy, { type: 'PLAY_FORM_BARK' }).barksFired).toBe(0)
    expect(S9_FORM_BARK_1.key).toMatch(/^lane_a\.s9\./)
    expect(S9_FORM_BARK_2.key).toMatch(/^lane_a\.s9\./)
  })
  it('counts player-controlled inactivity in the reducer and resets on progress', () => {
    let s = fresh()
    expect(s.inactiveSeconds).toBe(0)
    s = adventureReducer(s, { type: 'IDLE_TICK', foreground: true })
    s = adventureReducer(s, { type: 'IDLE_TICK', foreground: true })
    expect(s.inactiveSeconds).toBe(2)
    const busy: Office = { ...s, speech: { lines: [{ speaker: 'ROOK', text: 'x' }], lineIndex: 0, visibleCharacters: 0, returnTo: 'SCENE', performance: { copyKey: null, actor: 'ROOK', crossedCueIds: [], intentions: {}, activeActor: 'ROOK', afterLineHold: false, reducedMotion: false } } }
    expect(adventureReducer(busy, { type: 'IDLE_TICK', foreground: true }).inactiveSeconds).toBe(2)
    s = doVerb(s, 'PICK_UP', 'blank-authorization-form')
    expect(s.phase).toBe('FORM_HELD')
    expect(s.inactiveSeconds).toBe(0)
    s = adventureReducer(s, { type: 'HOVER_HOTSPOT', hotspotId: 'pen-stand' })
    s = adventureReducer(s, { type: 'IDLE_TICK', foreground: true })
    expect(s.inactiveSeconds).toBe(1)
    s = adventureReducer(s, { type: 'SELECT_VERB', verb: 'LOOK_AT' })
    expect(s.inactiveSeconds).toBe(0)
  })
  it('keeps office hints procedural with no verb selection or click order', () => {
    const banned = /\bPULL\b|\bPICK_UP\b|\bLOOK_AT\b|\bTALK_TO\b|CLICK|click order|verb selection/i
    for (const phase of PHASE_ORDER) {
      for (const tier of ['METHOD_HINT', 'CASE_HINT', 'DIRECT_HINT'] as const) {
        const hint = S9_OFFICE_HINTS[phase][tier]
        expect(hint.key).toMatch(/^lane_a\.s9\./)
        expect(hint.text).not.toMatch(banned)
        const s: Office = { ...fresh(), phase }
        const hinted = adventureReducer(s, { type: 'REQUEST_HINT', tier })
        expect(currentSpeechLine(hinted)?.text).toBe(hint.text)
      }
    }
  })
  it('preserves author newlines through copy lookup as one entry', () => {
    const lines = officeLines('lane_a.puzzle.newline-probe', [{ speaker: 'ROOK', text: 'First line.\nSecond line.' }])
    expect(lines).toHaveLength(1)
    expect(lines[0]?.text).toContain('\n')
    const css = readFileSync('src/styles/a0.css', 'utf8')
    expect(css).toMatch(/\.speech-panel span \{[^}]*white-space: pre-line/)
    expect(css).toMatch(/\.nonblocking-speech span \{[^}]*white-space: pre-line/)
  })
  it('exposes stable cabinet hotspots with placeholder geometry', () => {
    const official = recordsOfficeHotspots.find((h) => h.id === 'official-case-file-cabinet')!
    const misc = recordsOfficeHotspots.find((h) => h.id === 'miscellaneous-drawer-cabinet')!
    expect(official.walkTo.y).toBeGreaterThanOrEqual(250)
    expect(misc.walkTo.y).toBeGreaterThanOrEqual(250)
    expect(deadEndResponse('PUSH', 'official-case-file-cabinet', null)).toBeTruthy()
    expect(deadEndResponse('PUSH', 'miscellaneous-drawer-cabinet', null)).toBeTruthy()
    expect(phaseReached({ ...fresh(), phase: 'COMPLETE' }, 'FORM_SUBMITTED')).toBe(true)
  })
})

describe('S9-P1 investigation disclosure and migration', () => {
  const earn = () => investigationReducer(frozen, createInvestigationState(frozen), { type: 'EARN_ACCESS' })
  const collect = () => investigationReducer(frozen, earn(), { type: 'COLLECT_CASE_FILE' })
  const dispatchOnce = () => {
    let s = collect()
    s = investigationReducer(frozen, s, { type: 'REVIEW_RECEIPT' })
    return investigationReducer(frozen, s, { type: 'DISPATCH', path: 'TERMINAL' })
  }
  it('earns access without clues and collects the file exactly once', () => {
    const e = earn()
    expect(e.access).toBe(true)
    expect(e.discoveredClues).toEqual([])
    expect(e.discoveredRecords).toEqual([])
    const c = collect()
    expect(collectedStartingClues(frozen, c)).toBe(true)
    expect(visibleClues(frozen, c).map(({ id }) => id)).toEqual(frozen.startingClueIds)
    expect(frozen.startingClueIds).toEqual(['CLUE.ASSET', 'CLUE.FILE_ASSET_ADDRESS', 'CLUE.AMOUNT', 'CLUE.WINDOW'])
    expect(knownRecords(frozen, c)).toEqual([])
    expect(c.discoveredRecords).not.toContain(frozen.openingRecordId)
    const address = frozen.clues.find(({ id }) => id === 'CLUE.FILE_ASSET_ADDRESS')!
    expect(address.displayValue).toBe('0x6b175474e89094c44da98b954eedeac495271d0f')
    expect(visibleClues(frozen, c).some(({ id }) => id === 'CLUE.START' || id === 'CLUE.OUT')).toBe(false)
    const again = investigationReducer(frozen, c, { type: 'COLLECT_CASE_FILE' })
    expect(again.commands.filter((cmd) => cmd.type === 'COLLECT_CASE_FILE')).toHaveLength(1)
  })
  it('derives the six-stage capability matrix', () => {
    expect(terminalCapabilities(frozen, createInvestigationState(frozen)).stage).toBe(1)
    expect(terminalCapabilities(frozen, createInvestigationState(frozen)).canOpen).toBe(false)
    const s2 = terminalCapabilities(frozen, earn())
    expect(s2.stage).toBe(2)
    expect(s2.sections).toEqual(['CASE'])
    expect(s2.askCardIds).toEqual([])
    expect(s2.showQuerySurface).toBe(false)
    const s3 = terminalCapabilities(frozen, collect())
    expect(s3.stage).toBe(3)
    expect(s3.sections).toEqual(['CASE'])
    expect(s3.askCardIds).toEqual(['CARD.INCIDENT_DAI'])
    expect(s3.showQuerySurface).toBe(true)
    const s4 = terminalCapabilities(frozen, dispatchOnce())
    expect(s4.stage).toBe(4)
    expect(s4.sections).toEqual(['CASE', 'RESULTS', 'SOURCE', 'LEDGER'])
    expect(s4.allowSecondMemory).toBe(true)
    expect(s4.allowTheory).toBe(false)
    expect(s4.askCardIds.some((id) => id === 'CARD.EXACT_RECEIPT')).toBe(false)
    const compared = investigationReducer(frozen, dispatchOnce(), { type: 'COMPARE', recordId: frozen.proof.slots.LINK })
    expect(terminalCapabilities(frozen, compared).stage).toBe(4)
  })
  it('rejects blind unsupported inputs without recording', () => {
    const blind = investigationReducer(frozen, collect(), { type: 'STAGE_CARD', cardId: 'CARD.EXACT_RECEIPT' })
    expect(blind.error).toBeTruthy()
    expect(blind.commands.some((cmd) => cmd.type === 'STAGE_CARD')).toBe(false)
    const early = investigationReducer(frozen, collect(), { type: 'READ_BRANCH', branch: 'SECOND' })
    expect(early.error).toBeTruthy()
    expect(early.discoveredRecords).not.toContain(frozen.secondRecordId)
    const earlyFirst = investigationReducer(frozen, collect(), { type: 'READ_BRANCH', branch: 'FIRST' })
    expect(earlyFirst.error).toBeTruthy()
    expect(earlyFirst.discoveredRecords).not.toContain(frozen.openingRecordId)
    const earlyTheory = investigationReducer(frozen, dispatchOnce(), { type: 'THEORY', theory: 'FIRST_TRAIL_JOINS_SECOND_ROUTE' })
    expect(earlyTheory.error).toBeTruthy()
    expect(earlyTheory.workingTheory).toBeNull()
    const badToken = investigationReducer(frozen, collect(), { type: 'SELECT_SIDE_TOKEN', tokenId: 'CARD.NOPE' })
    expect(badToken.error).toBeTruthy()
  })
  it('migrates historical strip-path saves without restoring the retired path', () => {
    const legacyEntries: Command[] = [{ type: 'EARN_ACCESS' }, { type: 'REVIEW_RECEIPT' }]
    const source = { fixtureId: frozen.id, fixtureMode: frozen.mode, fixtureOrigin: (createInvestigationState(frozen) as { fixtureOrigin: string }).fixtureOrigin }
    void source
    const saved = JSON.stringify({ fixtureId: frozen.id, fixtureMode: frozen.mode, fixtureOrigin: createInvestigationState(frozen).fixtureOrigin, commands: { source: { fixtureId: frozen.id, fixtureMode: frozen.mode, fixtureOrigin: createInvestigationState(frozen).fixtureOrigin }, entries: legacyEntries } })
    const restored = restoreInvestigation(frozen, saved)
    expect(restored.access).toBe(true)
    expect(collectedStartingClues(frozen, restored)).toBe(true)
    expect(JSON.stringify(restored)).not.toMatch(/first-breach-strip|pneumatic|blank-request|completed-request|stamped-request/)
    const roundTrip = restoreInvestigation(frozen, exportLocalSave(collect()))
    expect(roundTrip.commands).toEqual(collect().commands)
    const earnOnly = investigationReducer(frozen, createInvestigationState(frozen), { type: 'EARN_ACCESS' })
    expect(restoreInvestigation(frozen, exportLocalSave(earnOnly))).toEqual(earnOnly)
    expect(restoreInvestigation(frozen, 'not-json')).toEqual(createInvestigationState(frozen))
  })
  it('completes Direct, Curious, and Mistaken journeys under the new mechanics', () => {
    const run = (commands: Command[]) => commands.reduce((state, command) => investigationReducer(frozen, command.type === 'DISPATCH' ? investigationReducer(frozen, state, { type: 'REVIEW_RECEIPT' }) : state, command), earn())
    const candidateRoute = (recordId: string): Command[] => [{ type: 'SELECT_RESULT', recordId }, { type: 'STAGE_CARD', cardId: 'CARD.FOLLOW_FORWARD' }, { type: 'DISPATCH', path: 'TERMINAL' }]
    const prove = (theory?: Command): Command[] => [...(theory ? [theory] : []), { type: 'SELECT_RESULT', recordId: frozen.proof.slots.LINK }, { type: 'STAGE_CARD', cardId: 'CARD.EXACT_RECEIPT' }, { type: 'DISPATCH', path: 'TERMINAL' }, { type: 'ASSEMBLE', slot: 'AMOUNT', recordId: frozen.proof.slots.AMOUNT }, { type: 'ASSEMBLE', slot: 'RECEIVER', recordId: frozen.proof.slots.RECEIVER }, { type: 'ASSEMBLE', slot: 'LINK', recordId: frozen.proof.slots.LINK }]
    const direct = run([{ type: 'COLLECT_CASE_FILE' }, { type: 'DISPATCH', path: 'TERMINAL' }, ...candidateRoute(frozen.proof.slots.LINK), ...prove()])
    expect(direct.complete).toBe(true)
    expect(direct.candidateRouteResolved).toBe(true)
    expect(direct.commands.filter((c) => c.type === 'DISPATCH')).toHaveLength(3)
    const firstTwo = dispatchOnce().discoveredRecords.filter((id) => id !== frozen.openingRecordId).slice(0, 2)
    expect(firstTwo).toHaveLength(2)
    const curious = run([{ type: 'COLLECT_CASE_FILE' }, { type: 'DISPATCH', path: 'TERMINAL' }, ...candidateRoute(firstTwo[0]!), { type: 'COMPARE', recordId: firstTwo[0]! }, { type: 'COMPARE', recordId: firstTwo[1]! }, ...prove({ type: 'THEORY', theory: 'FIRST_TRAIL_JOINS_SECOND_ROUTE' })])
    expect(curious.complete).toBe(true)
    expect(terminalCapabilities(frozen, curious).stage).toBe(6)
    const mistaken = run([{ type: 'COLLECT_CASE_FILE' }, { type: 'DISPATCH', path: 'TERMINAL' }, ...candidateRoute(firstTwo[0]!), { type: 'COMPARE', recordId: firstTwo[0]! }, { type: 'COMPARE', recordId: firstTwo[1]! }, ...prove({ type: 'THEORY', theory: 'FIRST_TRAIL_STOPS_AT_FIRST_ENGINE' })])
    expect(mistaken.complete).toBe(true)
    expect(mistaken.rejectedTheory).not.toBeNull()
  })
  it('keeps the exact card out of reach until candidate-route resolution', () => {
    expect(availableCards(frozen, collect()).some((c) => c.stage === 'VERIFY')).toBe(false)
    const selected = investigationReducer(frozen, dispatchOnce(), { type: 'SELECT_RESULT', recordId: frozen.proof.slots.LINK })
    expect(availableCards(frozen, selected).some((c) => c.id === 'CARD.EXACT_RECEIPT')).toBe(false)
    const staged = investigationReducer(frozen, selected, { type: 'STAGE_CARD', cardId: 'CARD.FOLLOW_FORWARD' })
    const routed = investigationReducer(frozen, investigationReducer(frozen, staged, { type: 'REVIEW_RECEIPT' }), { type: 'DISPATCH', path: 'TERMINAL' })
    expect(routed.candidateRouteResolved).toBe(true)
    expect(terminalCapabilities(frozen, routed).stage).toBe(5)
    const reselected = investigationReducer(frozen, routed, { type: 'SELECT_RESULT', recordId: frozen.proof.slots.LINK })
    expect(availableCards(frozen, reselected).some((c) => c.id === 'CARD.EXACT_RECEIPT')).toBe(true)
  })
})
