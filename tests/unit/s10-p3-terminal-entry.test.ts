import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import type { AdventureState, HotspotId, VerbId } from '../../src/adventure/types'

const fresh = (): AdventureState => ({ ...createInitialAdventureState({ skipIntro: true }), instantText: true, phase: 'COMPLETE' })
const send = (state: AdventureState, action: Parameters<typeof adventureReducer>[1]) => adventureReducer(state, action)
const arm = (state: AdventureState, verb: VerbId, targetId: HotspotId) => send(send(state, { type: 'SELECT_VERB', verb }), { type: 'INTERACT', targetId })
const terminal = { x: 870, y: 365 }
const snapshot = (state: AdventureState) => ({
  phase: state.phase,
  inventory: state.inventory,
  caseFileDrawer: state.caseFileDrawer,
  miscDrawer: state.miscDrawer,
  caseStack: state.caseStack,
  miscContents: state.miscContents,
  piggyNoteReadState: state.piggyNoteReadState,
})

describe('S10-P3 terminal entry', () => {
  it('S10-P3 pending official-drawer OPEN is replaced by reducer-owned terminal entry', () => {
    let state = arm(fresh(), 'OPEN', 'official-case-file-cabinet')
    expect(state.walk?.pendingInteraction?.targetId).toBe('official-case-file-cabinet')
    state = send(state, { type: 'REQUEST_TERMINAL_ENTRY' })
    expect(state.intentReplacement?.copyKey).toBe('TODO.STORY.INTENT_REPLACED')
    expect(state.walk?.pendingInteraction).toEqual({ verb: 'USE', targetId: 'nansen-terminal', itemId: null })
    state = send(state, { type: 'WALK_TICK', delta: 8000 })
    expect(state.caseFileDrawer).toBe('CLOSED')
    expect(state.lastSemanticContact).toBe('CONTACT.TERMINAL_ENTRY')
  })

  it('S10-P3 pending misc-content PICK UP to terminal entry replaces it', () => {
    let state = arm({ ...fresh(), miscDrawer: 'OPEN' }, 'PICK_UP', 'miscellaneous-catch-all-contents')
    state = send(state, { type: 'REQUEST_TERMINAL_ENTRY' })
    state = send(state, { type: 'WALK_TICK', delta: 8000 })
    expect(state.miscContents).toBe('UNCOLLECTED')
    expect(state.walk?.pendingInteraction ?? null).toBeNull()
    expect(state.lastInteractionId).toBe('INTERACTION.TERMINAL_ENTRY')
  })

  it('S10-P3 pending pen PICK UP to terminal entry replaces it', () => {
    let state = arm(fresh(), 'PICK_UP', 'pen-stand')
    state = send(state, { type: 'REQUEST_TERMINAL_ENTRY' })
    state = send(state, { type: 'WALK_TICK', delta: 8000 })
    expect(state.inventory).not.toContain('loose-feather-pen')
    expect(state.lastSemanticContact).toBe('CONTACT.TERMINAL_ENTRY')
  })

  it('S10-P3 pending completed-form GIVE to terminal entry replaces it', () => {
    let state = arm({ ...fresh(), inventory: ['signed-terminal-authorization-form-with-doodles'] }, 'GIVE', 'mr-index')
    state = send(state, { type: 'ACT_ON_ITEM', itemId: 'signed-terminal-authorization-form-with-doodles' })
    state = send(state, { type: 'INTERACT', targetId: 'mr-index' })
    expect(state.walk?.pendingInteraction?.verb).toBe('GIVE')
    state = send(state, { type: 'REQUEST_TERMINAL_ENTRY' })
    state = send(state, { type: 'WALK_TICK', delta: 8000 })
    expect(state.phase).toBe('COMPLETE')
    expect(state.inventory).toContain('signed-terminal-authorization-form-with-doodles')
    expect(state.lastSemanticContact).toBe('CONTACT.TERMINAL_ENTRY')
  })

  it('S10-P3 floor walk to terminal entry redirects to the terminal', () => {
    let state = send(fresh(), { type: 'WALK_TO', point: { x: 80, y: 300 } })
    expect(state.walk?.pendingInteraction).toBeNull()
    state = send(state, { type: 'REQUEST_TERMINAL_ENTRY' })
    expect(state.intentReplacement?.copyKey).toBe('TODO.STORY.INTENT_REPLACED')
    expect(state.walk?.to).toEqual(terminal)
    expect(state.walk?.pendingInteraction?.targetId).toBe('nansen-terminal')
  })

  it('S10-P3 superseded world action never fires before during or after terminal play', () => {
    let state = arm(fresh(), 'OPEN', 'official-case-file-cabinet')
    state = send(state, { type: 'REQUEST_TERMINAL_ENTRY' })
    state = send(state, { type: 'WALK_TICK', delta: 8000 })
    const during = send(state, { type: 'INTERACT', targetId: 'official-case-file-cabinet' })
    expect(during.caseFileDrawer).toBe('CLOSED')
    const closed = send(during, { type: 'CLOSE_TERMINAL' })
    const after = send(closed, { type: 'WALK_TICK', delta: 8000 })
    expect(after.caseFileDrawer).toBe('CLOSED')
    expect(after.walk).toBeNull()
  })

  it('S10-P3 one replacement event mounts and ACKs before terminal presentation', () => {
    let state = arm(fresh(), 'OPEN', 'official-case-file-cabinet')
    state = send(state, { type: 'REQUEST_TERMINAL_ENTRY' })
    expect(state.intentReplacement?.id).toBe(1)
    expect(state.terminalEntryPending).toBe(false)
    state = send(state, { type: 'WALK_TICK', delta: 8000 })
    expect(state.terminalEntryPending).toBe(true)
    expect(state.intentReplacement?.id).toBe(1)
    state = send(state, { type: 'ACK_INTENT_REPLACEMENT', id: 1 })
    expect(state.intentReplacement).toBeNull()
    expect(state.terminalEntryPending).toBe(true)
    state = send(state, { type: 'ACK_TERMINAL_PRESENTATION' })
    expect(state.terminalEntryPending).toBe(false)
    expect(state.worldQuiescent).toBe(true)
  })

  it('S10-P3 world terminal hotspot requests reducer-owned entry', () => {
    const byButton = send(send(fresh(), { type: 'REQUEST_TERMINAL_ENTRY' }), { type: 'WALK_TICK', delta: 8000 })
    const byHotspot = send(send(send(fresh(), { type: 'SELECT_VERB', verb: 'USE' }), { type: 'INTERACT', targetId: 'nansen-terminal' }), { type: 'WALK_TICK', delta: 8000 })
    expect(byButton.lastSemanticContact).toBe('CONTACT.TERMINAL_ENTRY')
    expect(byHotspot.lastSemanticContact).toBe(byButton.lastSemanticContact)
    expect(byHotspot.lastInteractionId).toBe('INTERACTION.TERMINAL_ENTRY')
    expect(byButton.lastInteractionId).toBe(byHotspot.lastInteractionId)
  })

  it('S10-P3 keyboard and PLAIN_LIST terminal entry use the same path', () => {
    const plain = send(fresh(), { type: 'SET_DIALOGUE_PRESENTATION', mode: 'PLAIN_LIST' })
    const entered = send(send(plain, { type: 'REQUEST_TERMINAL_ENTRY' }), { type: 'WALK_TICK', delta: 8000 })
    expect(entered.dialoguePresentation).toBe('PLAIN_LIST')
    expect(entered.lastSemanticContact).toBe('CONTACT.TERMINAL_ENTRY')
    expect(readFileSync('src/app/App.tsx', 'utf8')).toContain("dispatch(state.selectedVerb ? { type: 'INTERACT', targetId: hotspot.id }")
  })

  it('S10-P3 terminal does not open before Rook reaches its interaction point', () => {
    const state = send(fresh(), { type: 'REQUEST_TERMINAL_ENTRY' })
    expect(state.terminalEntryPending).toBe(false)
    expect(state.worldQuiescent).toBe(false)
    expect(state.walk).not.toBeNull()
    expect(state.rookPosition).not.toEqual(terminal)
  })

  it('S10-P3 already-at-terminal path commits once without fake walking', () => {
    const state = send({ ...fresh(), rookPosition: terminal }, { type: 'REQUEST_TERMINAL_ENTRY' })
    expect(state.walk).toBeNull()
    expect(state.rookPosition).toEqual(terminal)
    expect(state.terminalEntryPending).toBe(true)
    expect(state.lastSemanticContact).toBe('CONTACT.TERMINAL_ENTRY')
  })

  it('S10-P3 office walk and pendingInteraction are null at terminal mount', () => {
    const state = send(send(fresh(), { type: 'REQUEST_TERMINAL_ENTRY' }), { type: 'WALK_TICK', delta: 8000 })
    expect(state.terminalEntryPending).toBe(true)
    expect(state.walk).toBeNull()
    expect(state.selectedVerb).toBeNull()
  })

  it('S10-P3 protected world-state snapshot remains unchanged while terminal is open', () => {
    let state = send(send(fresh(), { type: 'REQUEST_TERMINAL_ENTRY' }), { type: 'WALK_TICK', delta: 8000 })
    state = send(state, { type: 'ACK_TERMINAL_PRESENTATION' })
    const before = snapshot(state)
    state = send(state, { type: 'WALK_TICK', delta: 8000 })
    state = send(state, { type: 'SELECT_VERB', verb: 'OPEN' })
    state = send(state, { type: 'INTERACT', targetId: 'official-case-file-cabinet' })
    state = send(state, { type: 'REQUEST_HINT', tier: 'DIRECT_HINT' })
    state = send(state, { type: 'PLAY_FORM_BARK' })
    expect(snapshot(state)).toEqual(before)
    expect(state.worldQuiescent).toBe(true)
  })

  it('S10-P3 walk timer cannot mutate state behind the terminal', () => {
    const committed = send(send(fresh(), { type: 'REQUEST_TERMINAL_ENTRY' }), { type: 'WALK_TICK', delta: 8000 })
    const behind = {
      ...committed,
      walk: { from: { x: 100, y: 298 }, to: { x: 400, y: 298 }, path: [{ x: 100, y: 298 }, { x: 400, y: 298 }], segmentIndex: 0, segmentProgress: 0, pendingInteraction: { verb: 'OPEN' as const, targetId: 'official-case-file-cabinet' as const, itemId: null } },
    }
    const ticked = send(behind, { type: 'WALK_TICK', delta: 8000 })
    expect(ticked.rookPosition).toEqual(behind.rookPosition)
    expect(ticked.caseFileDrawer).toBe('CLOSED')
  })

  it('S10-P3 closing terminal does not resurrect the old action', () => {
    let state = arm(fresh(), 'PULL', 'miscellaneous-drawer-cabinet')
    state = send(state, { type: 'REQUEST_TERMINAL_ENTRY' })
    state = send(state, { type: 'WALK_TICK', delta: 8000 })
    state = send(state, { type: 'CLOSE_TERMINAL' })
    expect(state.walk).toBeNull()
    expect(state.worldQuiescent).toBe(false)
    expect(state.miscDrawer).toBe('CLOSED')
    expect(state.terminalEntryPending).toBe(false)
  })

  it('S10-P3 Direct Curious and Mistaken terminal journeys still pass', () => {
    const journeys = readFileSync('tests/e2e/s5-integration.spec.ts', 'utf8')
    expect(journeys).toContain('DIRECT_SOLVER')
    expect(journeys).toContain('CURIOUS_EXPLORER')
    expect(journeys).toContain('MISTAKEN_INVESTIGATOR')
    expect(readFileSync('tests/fixtures/s2/browser-helpers.ts', 'utf8')).toContain('hotspot-nansen-terminal')
  })

  it('S10-P3 terminal focus restoration uses the world target', () => {
    const app = readFileSync('src/app/App.tsx', 'utf8')
    expect(app).toContain("document.querySelector<HTMLElement>('[data-testid=\"hotspot-nansen-terminal\"]')")
    expect(app).not.toContain('className="case-entry"')
    expect(app).not.toContain('openCase()')
    expect(app).not.toContain('setTerminalOpen(true)')
    expect(app).toContain("dispatch({ type: 'ACK_TERMINAL_PRESENTATION' })")
  })

  it('S10-P3 replacement-event R2 browser suite remains green', () => {
    const suite = readFileSync('tests/e2e/s10-p2-r2-event.spec.ts', 'utf8')
    expect(suite).toContain('reload with a mounted event clears and cannot resurrect the old intent')
    expect(suite).toContain('MutationObserver')
  })

  it('S10-P3 cabinet R4 blackout policy and facing regressions remain green', () => {
    const blocked = send(arm({ ...createInitialAdventureState({ skipIntro: true }), instantText: true }, 'OPEN', 'official-case-file-cabinet'), { type: 'WALK_TICK', delta: 8000 })
    expect(blocked.activeSequence?.id).toBe('SEQUENCE.CABINET_POLICY_BLOCK')
    expect(blocked.caseFileDrawer).toBe('CLOSED')
    expect(readFileSync('src/styles/a0.css', 'utf8')).toContain('adventure-interface-band')
  })

  it('S10-P3 runtime provider calls remain zero and no data art final copy ref or release effect occurs', () => {
    const policy = readFileSync('src/adventure/policies/terminal_entry_intent_policy.json', 'utf8')
    const audit = readFileSync('src/adventure/policies/direct_action_button_audit.json', 'utf8')
    expect(policy).not.toContain('nansen_api')
    expect(policy).not.toContain('fetch(')
    expect(audit).toContain('SINGLE_INTENT_REQUEST_TERMINAL_ENTRY')
    expect(readFileSync('src/adventure/controlPolicy.ts', 'utf8')).toContain('PLACEHOLDER — Story binds final copy')
  })
})

describe('S10-P3 direct controls', () => {
  it('S10-P3 direct action buttons are classified', () => {
    const audit = JSON.parse(readFileSync('src/adventure/policies/direct_action_button_audit.json', 'utf8'))
    const app = readFileSync('src/app/App.tsx', 'utf8')
    expect(audit.controls.map((entry: { id: string }) => entry.id)).toEqual([
      'OPEN_CASE_TERMINAL', 'WORLD_USE_NANSEN_TERMINAL', 'PLAY_OPTIONAL_RETURN_TAG',
      'METHOD_HINT', 'CASE_HINT', 'DIRECT_HINT', 'DIALOGUE_PRESENTATION', 'TEXT_PACE',
      'HOTSPOT_CONTRAST', 'EVIDENCE_DRAWER', 'REVIEW_JUMP', 'REVIEW_TALKING', 'REVIEW_RESET', 'REVIEW_HOTSPOTS',
    ])
    expect(app).not.toContain('REQUEST_TERMINAL_ENTRY')
    expect(app).toContain("type: 'INTERACT'")
    expect(app).not.toContain('onClick={() => openCase()}')
    const entered = send({ ...fresh(), walk: { from: { x: 1, y: 298 }, to: { x: 2, y: 298 }, path: [{ x: 1, y: 298 }, { x: 2, y: 298 }], segmentIndex: 0, segmentProgress: 0, pendingInteraction: { verb: 'OPEN', targetId: 'official-case-file-cabinet', itemId: null } } }, { type: 'ENTER_TERMINAL' })
    expect(entered.walk).toBeNull()
  })
})
