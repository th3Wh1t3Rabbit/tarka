import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildFrozenFixture } from '../../src/investigation/fixture'
import { dialogueTopicsForState, usefulRules, itemRules, blockedInteractions, inventoryItems, deadEndResponse } from '../../src/adventure/content'
import { DIALOGUE_COPY, INVENTORY_COPY } from '../../src/controller/content/lead-shell'
import { S9_OFFICE_HINTS, S9_FORM_REMINDER_REPLIES, S9_CASE_FILE_REMINDER, S9_EMPTY_KNOWN_INPUTS_STATUS, S9_FORM_BARK_1, S9_FORM_BARK_2 } from '../../src/controller/content/s9-placeholders'
import { createInitialAdventureState, adventureReducer } from '../../src/adventure/reducer'
import { SIDE_LEAD_TOKENS } from '../../src/investigation/sideLead'
import {
  availableCards, candidateRouteResolvedMilestone, collectedStartingClues, createInvestigationState, exportLocalSave,
  investigationReducer, knownRecords, recommendations, restoreInvestigation, terminalCapabilities, visibleClues,
  type Command,
} from '../../src/investigation/state'

const base = 'public/scenarios/euler-2023-false-exit/'
const frozen = buildFrozenFixture(JSON.parse(readFileSync(base + 'scenario.json', 'utf8')), JSON.parse(readFileSync(base + 'evidence-graph.json', 'utf8')))
const earn = () => investigationReducer(frozen, createInvestigationState(frozen), { type: 'EARN_ACCESS' })
const collect = () => investigationReducer(frozen, earn(), { type: 'COLLECT_CASE_FILE' })
const review = (s: ReturnType<typeof earn>) => investigationReducer(frozen, s, { type: 'REVIEW_RECEIPT' })
const dispatchOnce = () => investigationReducer(frozen, review(collect()), { type: 'DISPATCH', path: 'TERMINAL' })
const run = (commands: Command[]) => commands.reduce((state, command) => investigationReducer(frozen, command.type === 'DISPATCH' ? review(state) : state, command), earn())
const candidateRoute = (recordId: string): Command[] => [{ type: 'SELECT_RESULT', recordId }, { type: 'STAGE_CARD', cardId: 'CARD.FOLLOW_FORWARD' }, { type: 'DISPATCH', path: 'TERMINAL' }]
const opening = frozen.records.find((r) => r.id === frozen.openingRecordId)!
const link = frozen.records.find((r) => r.id === frozen.proof.slots.LINK)!

describe('S9-P1-R1 structural false-success closure', () => {
  it('R1: case-file collection discovers no opening record, engine, outgoing, or proof value', () => {
    const c = collect()
    expect(c.discoveredRecords).toEqual([])
    expect(knownRecords(frozen, c)).toEqual([])
    expect(c.discoveredClues).toEqual(['CLUE.ASSET', 'CLUE.FILE_ASSET_ADDRESS', 'CLUE.AMOUNT', 'CLUE.WINDOW'])
    expect(c.discoveredClues).not.toContain('CLUE.START')
    expect(c.discoveredClues).not.toContain('CLUE.OUT')
    const json = JSON.stringify(c)
    expect(json).not.toContain(opening.destination)
    expect(json).not.toContain(opening.transactionHash)
    expect(json).not.toContain(opening.source)
    expect(json).not.toContain(link.destination)
    expect(json).not.toContain(link.source)
    expect(json).not.toContain(frozen.proof.linkTimeUtc)
    expect(c.selectedRecordId).toBeNull()
    expect(c.result).toBeNull()
    const saved = exportLocalSave(c)
    expect(saved).not.toContain(opening.destination)
    expect(saved).not.toContain(opening.transactionHash)
    expect(saved).not.toContain(link.destination)
    expect(saved).not.toContain(frozen.proof.linkTimeUtc)
  })
  it('R1: collection exposes exactly the allowed opening facts', () => {
    const clues = visibleClues(frozen, collect())
    expect(clues.find(({ id }) => id === 'CLUE.ASSET')!.filters).toEqual([{ field: 'ASSET', value: 'DAI' }])
    expect(clues.find(({ id }) => id === 'CLUE.FILE_ASSET_ADDRESS')!.displayValue).toBe('0x6b175474e89094c44da98b954eedeac495271d0f')
    expect(clues.find(({ id }) => id === 'CLUE.AMOUNT')!.filters[0]!.value).toBe(opening.assetAmounts[0]!.amount)
    expect(clues.find(({ id }) => id === 'CLUE.WINDOW')).toBeTruthy()
  })
  it('R1: the first dispatch discovers the opening result and the First Engine', () => {
    const staged = investigationReducer(frozen, collect(), { type: 'STAGE_CARD', cardId: 'CARD.INCIDENT_DAI' })
    expect(staged.error).toBeNull()
    const d = investigationReducer(frozen, review(staged), { type: 'DISPATCH', path: 'TERMINAL' })
    expect(d.discoveredRecords).toContain(frozen.openingRecordId)
    expect(d.discoveredClues).toContain('CLUE.START')
    expect(d.discoveredClues).toContain('CLUE.OUT')
    expect(d.candidateRouteResolved).toBe(false)
  })
  it('R2: stage 3 foregrounds exactly the one guided first question', () => {
    const caps = terminalCapabilities(frozen, collect())
    expect(caps.stage).toBe(3)
    expect(caps.askCardIds).toEqual(['CARD.INCIDENT_DAI'])
    expect(recommendations(frozen, collect()).map(({ id }) => id)).toEqual(['CARD.INCIDENT_DAI'])
    const cards = availableCards(frozen, collect())
    expect(cards).toHaveLength(1)
    expect(cards[0]!.prerequisites).toEqual(['CLUE.ASSET', 'CLUE.FILE_ASSET_ADDRESS', 'CLUE.WINDOW'])
  })
  it('R3+R4: comparison clicks cannot reach stage 5 and stage 4 has no exact path', () => {
    const d = dispatchOnce()
    expect(terminalCapabilities(frozen, d).stage).toBe(4)
    expect(terminalCapabilities(frozen, d).allowCompare).toBe(false)
    const pair = d.discoveredRecords.filter((id) => id !== frozen.openingRecordId).slice(0, 2)
    const rejected = investigationReducer(frozen, d, { type: 'COMPARE', recordId: pair[0]! })
    expect(rejected.error).toBeTruthy()
    expect(rejected.comparison).toEqual([])
    expect(rejected.commands.some((cmd) => cmd.type === 'COMPARE')).toBe(false)
    expect(rejected.candidateRouteResolved).toBe(false)
    expect(terminalCapabilities(frozen, rejected).stage).toBe(4)
    expect(terminalCapabilities(frozen, rejected).allowTheory).toBe(false)
    expect(availableCards(frozen, rejected).some((c) => c.stage === 'VERIFY')).toBe(false)
    expect(availableCards(frozen, rejected).some((c) => c.id === 'CARD.COMPARE_ROUTES')).toBe(false)
    const exact = investigationReducer(frozen, rejected, { type: 'STAGE_CARD', cardId: 'CARD.EXACT_RECEIPT' })
    expect(exact.error).toBeTruthy()
  })
  it('R3: stage 5 appears only after candidate-route dispatch resolution', () => {
    const routed = run([{ type: 'COLLECT_CASE_FILE' }, { type: 'DISPATCH', path: 'TERMINAL' }, ...candidateRoute(frozen.openingRecordId)])
    expect(routed.candidateRouteResolved).toBe(true)
    expect(candidateRouteResolvedMilestone(frozen, routed)).toBe(true)
    expect(terminalCapabilities(frozen, routed).stage).toBe(5)
    expect(terminalCapabilities(frozen, routed).allowTheory).toBe(true)
    const reselected = investigationReducer(frozen, routed, { type: 'SELECT_RESULT', recordId: frozen.proof.slots.LINK })
    expect(availableCards(frozen, reselected).some((c) => c.id === 'CARD.EXACT_RECEIPT')).toBe(true)
  })
  it('R5: the optional office-note catalog holds exactly one token identity', () => {
    expect(SIDE_LEAD_TOKENS).toHaveLength(1)
    expect(SIDE_LEAD_TOKENS[0]!.id).toBe('FICTIONAL.TOKEN.ALPHA')
  })
  it('R6: no current player-facing tube/plunger/canister/strip copy', () => {
    const banned = /tube|plunger|canister|access strip|physical dispatch/i
    const texts: string[] = []
    for (const rule of [...usefulRules, ...itemRules]) for (const line of rule.speech) texts.push(line.text)
    for (const blocked of blockedInteractions) texts.push(blocked.text)
    for (const key of Object.keys(DIALOGUE_COPY) as (keyof typeof DIALOGUE_COPY)[]) for (const line of DIALOGUE_COPY[key]) texts.push(line.text)
    for (const copy of Object.values(INVENTORY_COPY)) texts.push(copy)
    for (const item of Object.values(inventoryItems)) texts.push(item.name)
    for (const tier of Object.values(S9_OFFICE_HINTS)) for (const hint of Object.values(tier)) texts.push(hint.text)
    for (const reply of Object.values(S9_FORM_REMINDER_REPLIES)) texts.push(reply.text)
    texts.push(S9_CASE_FILE_REMINDER.text, S9_EMPTY_KNOWN_INPUTS_STATUS.text, S9_FORM_BARK_1.text, S9_FORM_BARK_2.text)
    for (const verb of ['LOOK_AT', 'PICK_UP', 'PUSH', 'PULL', 'OPEN', 'CLOSE', 'USE', 'GIVE', 'TALK_TO'] as const) {
      for (const target of ['official-case-file-cabinet', 'miscellaneous-drawer-cabinet', 'mr-index', 'pen-stand', 'form-dispenser'] as const) {
        const out = deadEndResponse(verb, target as never, null)
        if (typeof out === 'string') texts.push(out)
      }
    }
    expect(texts.length).toBeGreaterThan(50)
    for (const text of texts) expect(text).not.toMatch(banned)
    for (const phase of ['START', 'FORM_COMPLETED', 'COMPLETE'] as const) {
      for (const topic of dialogueTopicsForState({ phase: phase as never, exhaustedTopics: [], inventory: [] })) {
        expect(JSON.stringify(topic)).not.toMatch(banned)
      }
    }
  })
  it('R7: hidden or unfocused elapsed time never advances bark eligibility', () => {
    let a = createInitialAdventureState({ skipIntro: true })
    for (let i = 0; i < 1000; i++) a = adventureReducer(a, { type: 'IDLE_TICK', foreground: false })
    expect(a.inactiveSeconds).toBe(0)
    expect(a.barksFired).toBe(0)
    for (let i = 0; i < 80; i++) a = adventureReducer(a, { type: 'IDLE_TICK', foreground: true })
    expect(a.inactiveSeconds).toBe(80)
    a = adventureReducer(a, { type: 'PLAY_FORM_BARK' })
    expect(a.barksFired).toBe(1)
    let hidden = createInitialAdventureState({ skipIntro: true })
    for (let i = 0; i < 1000; i++) hidden = adventureReducer(hidden, { type: 'IDLE_TICK', foreground: false })
    hidden = adventureReducer(hidden, { type: 'PLAY_FORM_BARK' })
    expect(hidden.barksFired).toBe(0)
  })
  it('R8: case-file reminder disappears once the file is held', () => {
    const before = dialogueTopicsForState({ phase: 'COMPLETE', exhaustedTopics: [], inventory: [] })
    expect(before.map(({ id }) => id)).toContain('case-file')
    const after = dialogueTopicsForState({ phase: 'COMPLETE', exhaustedTopics: [], inventory: ['euler-case-file'] })
    expect(after.map(({ id }) => id)).not.toContain('case-file')
    expect(after.map(({ id }) => id)).toEqual(['sports', 'health', 'nansen-benefit', 'leave'])
  })
  it('R9: no player-facing Mr. Index or records-clerk label remains', () => {
    const banned = /Mr\. Index|records clerk/i
    expect(deadEndResponse('LOOK_AT', 'mr-index' as never, null)!).not.toMatch(banned)
    expect(deadEndResponse('PULL', 'mr-index' as never, null)!).not.toMatch(banned)
    for (const phase of ['START', 'FORM_COMPLETED', 'COMPLETE'] as const) {
      for (const topic of dialogueTopicsForState({ phase: phase as never, exhaustedTopics: [], inventory: [] })) {
        expect(JSON.stringify(topic)).not.toMatch(banned)
      }
    }
  })
  it('R10: reset preserves world discoveries while clearing reasoning progress', () => {
    const s = run([{ type: 'COLLECT_CASE_FILE' }, { type: 'COLLECT_SIDE_NOTE' }, { type: 'SELECT_SIDE_TOKEN', tokenId: 'FICTIONAL.TOKEN.ALPHA' }, { type: 'DISPATCH', path: 'TERMINAL' }, ...candidateRoute(frozen.openingRecordId)])
    expect(s.candidateRouteResolved).toBe(true)
    const reset = investigationReducer(frozen, s, { type: 'RESET_CASE' })
    expect(reset.access).toBe(true)
    expect(collectedStartingClues(frozen, reset)).toBe(true)
    expect(reset.sideLead.noteDiscovered).toBe(true)
    expect(reset.result).toBeNull()
    expect(reset.candidateRouteResolved).toBe(false)
    expect(reset.comparison).toEqual([])
    expect(reset.exactEventIds).toEqual([])
    const roundTrip = restoreInvestigation(frozen, exportLocalSave(reset))
    expect(roundTrip.discoveredClues).toEqual(reset.discoveredClues)
    expect(roundTrip.sideLead.noteDiscovered).toBe(true)
    expect(roundTrip.result).toBeNull()
  })
  it('journeys complete in at most three mandatory dispatches', () => {
    const direct = run([{ type: 'COLLECT_CASE_FILE' }, { type: 'DISPATCH', path: 'TERMINAL' }, ...candidateRoute(frozen.proof.slots.LINK), { type: 'SELECT_RESULT', recordId: frozen.proof.slots.LINK }, { type: 'STAGE_CARD', cardId: 'CARD.EXACT_RECEIPT' }, { type: 'DISPATCH', path: 'TERMINAL' }, { type: 'ASSEMBLE', slot: 'AMOUNT', recordId: frozen.proof.slots.AMOUNT }, { type: 'ASSEMBLE', slot: 'RECEIVER', recordId: frozen.proof.slots.RECEIVER }, { type: 'ASSEMBLE', slot: 'LINK', recordId: frozen.proof.slots.LINK }])
    expect(direct.complete).toBe(true)
    expect(direct.commands.filter((c) => c.type === 'DISPATCH')).toHaveLength(3)
    const firstTwo = dispatchOnce().discoveredRecords.filter((id) => id !== frozen.openingRecordId).slice(0, 2)
    const curious = run([{ type: 'COLLECT_CASE_FILE' }, { type: 'DISPATCH', path: 'TERMINAL' }, ...candidateRoute(firstTwo[0]!), { type: 'THEORY', theory: 'FIRST_TRAIL_JOINS_SECOND_ROUTE' }, { type: 'SELECT_RESULT', recordId: frozen.proof.slots.LINK }, { type: 'STAGE_CARD', cardId: 'CARD.EXACT_RECEIPT' }, { type: 'DISPATCH', path: 'TERMINAL' }, { type: 'ASSEMBLE', slot: 'AMOUNT', recordId: frozen.proof.slots.AMOUNT }, { type: 'ASSEMBLE', slot: 'RECEIVER', recordId: frozen.proof.slots.RECEIVER }, { type: 'ASSEMBLE', slot: 'LINK', recordId: frozen.proof.slots.LINK }])
    expect(curious.complete).toBe(true)
    expect(curious.commands.filter((c) => c.type === 'DISPATCH')).toHaveLength(3)
    expect(curious.workingTheory).toBe('FIRST_TRAIL_JOINS_SECOND_ROUTE')
  })
  it('full solve issues no provider call and preserves accepted truth', () => {
    const solved = run([{ type: 'COLLECT_CASE_FILE' }, { type: 'DISPATCH', path: 'TERMINAL' }, ...candidateRoute(frozen.openingRecordId), { type: 'READ_BRANCH', branch: 'SECOND' }, { type: 'SELECT_RESULT', recordId: frozen.proof.slots.LINK }, { type: 'STAGE_CARD', cardId: 'CARD.EXACT_RECEIPT' }, { type: 'DISPATCH', path: 'TERMINAL' }, { type: 'ASSEMBLE', slot: 'AMOUNT', recordId: frozen.proof.slots.AMOUNT }, { type: 'ASSEMBLE', slot: 'RECEIVER', recordId: frozen.proof.slots.RECEIVER }, { type: 'ASSEMBLE', slot: 'LINK', recordId: frozen.proof.slots.LINK }])
    expect(solved.complete).toBe(true)
    expect(frozen.ledger.attempts).toBe(0)
    expect(frozen.ledger.curatedAcceptedCalls).toBe(0)
    expect(JSON.stringify(solved.commands)).not.toMatch(/http|fetch|nansen|alchemy|key|secret|seed/i)
    expect(frozen.records.map(({ id }) => id).sort()).toEqual(['CONTEXT_FIRST_ENGINE_ACTIVITY', 'CONTEXT_SECONDARY', 'EXACT_CONVERGENCE', 'EXACT_EARLY_NET', 'EXACT_MAIN_RECEIVER', 'STATE_EARLY_ENGINE'])
    expect(frozen.proof.slots).toEqual({ AMOUNT: frozen.openingRecordId, RECEIVER: frozen.secondRecordId, LINK: frozen.proof.slots.LINK })
    expect(frozen.proof.conclusion).toBe('THE FIRST TRAIL JOINED THE SECOND ROUTE.')
    expect(frozen.proof.linkTimeUtc).toContain('11:38:11')
  })
})
