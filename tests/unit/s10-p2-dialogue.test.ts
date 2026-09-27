import { describe, expect, it } from 'vitest'
import { adventureReducer, createInitialAdventureState, isTalking } from '../../src/adventure/reducer'
import { controlClass, interfaceTreatment, worldDialogueAllowed } from '../../src/adventure/controlPolicy'
import type { AdventureState } from '../../src/adventure/types'
import dialoguePolicy from '../../src/adventure/policies/dialogue_control_policy.json'

const fresh = (): AdventureState => ({ ...createInitialAdventureState({ skipIntro: true }), instantText: true })
const send = (state: AdventureState, action: Parameters<typeof adventureReducer>[1]) => adventureReducer(state, action)

describe('S10-P2 dialogue control', () => {
  it('S10-P2 nonblocking Rook self-talk continues while Rook walks', () => {
    let state = send({ ...fresh(), instantText: false }, { type: 'APPLY_CONTROL_FIXTURE', fixture: 'PREBRIEF_EVIDENCE_SEA' })
    expect(state.nonblockingSpeech?.control).toBe('NONBLOCKING_SELF_TALK')
    expect(interfaceTreatment(state)).toBe('ACTIVE')
    state = send(send(state, { type: 'SELECT_VERB', verb: 'OPEN' }), { type: 'INTERACT', targetId: 'official-case-file-cabinet' })
    state = send(state, { type: 'WALK_TICK', delta: 24 })
    expect(state.walk).not.toBeNull()
    expect(state.nonblockingSpeech?.lines[0]?.copyKey).toBe('TODO.STORY.PREBRIEF_EVIDENCE_SEA_REACTION')
    expect(isTalking(state, 'ROOK')).toBe(true)
    expect(interfaceTreatment(state)).toBe('ACTIVE')
  })

  it('S10-P2 replacing a pending action during self-talk keeps the line and runs only the replacement', () => {
    let state = send(fresh(), { type: 'APPLY_CONTROL_FIXTURE', fixture: 'POST_RESULT_SELF_TALK' })
    const line = state.nonblockingSpeech?.lines[0]?.text
    state = send(send(state, { type: 'SELECT_VERB', verb: 'OPEN' }), { type: 'INTERACT', targetId: 'official-case-file-cabinet' })
    state = send(state, { type: 'WALK_TICK', delta: 12 })
    state = send(send(state, { type: 'SELECT_VERB', verb: 'PICK_UP' }), { type: 'INTERACT', targetId: 'blank-authorization-form' })
    expect(state.nonblockingSpeech?.lines[0]?.text).toBe(line)
    state = send(state, { type: 'WALK_TICK', delta: 8000 })
    expect(state.nonblockingSpeech?.lines[0]?.text).toBe(line)
    expect(state.caseFileDrawer).toBe('CLOSED')
    expect(state.inventory).toEqual(['blank-terminal-authorization-form'])
  })

  it('S10-P2 Rook talk performance stays active while locomotion walks', () => {
    let state = send({ ...fresh(), instantText: false }, { type: 'APPLY_CONTROL_FIXTURE', fixture: 'VOLUNTARY_EARLY_EXIT' })
    state = send(send(state, { type: 'SELECT_VERB', verb: 'OPEN' }), { type: 'INTERACT', targetId: 'filing-drawers' })
    state = send(state, { type: 'WALK_TICK', delta: 30 })
    expect(state.walk).not.toBeNull()
    expect(isTalking(state, 'ROOK')).toBe(true)
    expect(state.nonblockingSpeech?.control).toBe('NONBLOCKING_SELF_TALK')
    expect(controlClass(state)).toBe('WALK_PENDING_REPLACEABLE')
  })

  it('paced Space or Enter finishes the open line before a later press moves on', () => {
    let state = createInitialAdventureState()
    const first = state.speech!.lines[0]!
    state = send(state, { type: 'REVEAL_TICK', characters: 3 })
    expect(state.speech!.visibleCharacters).toBeGreaterThan(0)
    expect(state.speech!.visibleCharacters).toBeLessThan(first.text.length)
    state = send(state, { type: 'ADVANCE_SPEECH' })
    expect(state.speech!.lineIndex).toBe(0)
    expect(state.speech!.visibleCharacters).toBe(first.text.length)
    state = send(state, { type: 'ADVANCE_SPEECH' })
    expect(state.speech!.lineIndex).toBe(1)
    expect(state.speech!.visibleCharacters).toBe(0)
    const second = state.speech!.lines[1]!
    state = send(state, { type: 'ADVANCE_SPEECH' })
    expect(state.speech!.lineIndex).toBe(1)
    expect(state.speech!.visibleCharacters).toBe(second.text.length)
  })

  it('S10-P2 ordinary Arthur dialogue starts in place and both actors face each other', () => {
    const start = fresh()
    const position = start.rookPosition
    const state = send(send(start, { type: 'SELECT_VERB', verb: 'TALK_TO' }), { type: 'INTERACT', targetId: 'mr-index' })
    expect(state.walk).toBeNull()
    expect(state.rookPosition).toEqual(position)
    expect(state.dialogueOpen).toBe(true)
    expect(state.rookFacing).toBe('RIGHT')
    expect(state.mrIndexFacing).toBe('LEFT')
    expect(controlClass(state)).toBe('BLOCKING_WORLD_DIALOGUE')
    expect(interfaceTreatment(state)).toBe('BLACKOUT')
  })

  it('Arthur topics replace the verb band, hide while a topic plays, and return when it ends', () => {
    let state = send(send(fresh(), { type: 'SELECT_VERB', verb: 'TALK_TO' }), { type: 'INTERACT', targetId: 'mr-index' })
    expect(state.dialogueOpen).toBe(true)
    expect(state.speech).toBeNull()
    expect(interfaceTreatment(state)).toBe('BLACKOUT')
    state = send(state, { type: 'CHOOSE_DIALOGUE_TOPIC', topicId: 'sports' })
    expect(state.dialogueOpen).toBe(false)
    expect(state.speech?.returnTo).toBe('DIALOGUE')
    expect(interfaceTreatment(state)).toBe('BLACKOUT')
    for (let step = 0; step < 12 && state.speech; step += 1) state = send(state, { type: 'ADVANCE_SPEECH' })
    expect(state.speech).toBeNull()
    expect(state.dialogueOpen).toBe(true)
    expect(interfaceTreatment(state)).toBe('BLACKOUT')
    state = send(state, { type: 'CLOSE_DIALOGUE' })
    expect(state.dialogueOpen).toBe(false)
    expect(interfaceTreatment(state)).toBe('ACTIVE')
    const looked = send(send(fresh(), { type: 'SELECT_VERB', verb: 'LOOK_AT' }), { type: 'INTERACT', targetId: 'historical-clock' })
    expect(looked.dialogueOpen).toBe(false)
    expect(looked.speech?.returnTo).not.toBe('DIALOGUE')
    expect(interfaceTreatment(looked)).not.toBe('BLACKOUT')
  })

  it('S10-P2 staged cutscene blacks the 480 by 90 band and restores focus', () => {
    const opening = createInitialAdventureState()
    expect(opening.speech?.control).toBe('BLOCKING_CUTSCENE')
    expect(controlClass(opening)).toBe('BLOCKING_CUTSCENE')
    expect(interfaceTreatment(opening)).toBe('BLACKOUT')
    expect(opening.dialoguePresentation).toBe('FULLSCREEN_CRT')
    const presented = send(opening, { type: 'SET_DIALOGUE_PRESENTATION', mode: 'PLAIN_LIST' })
    expect(interfaceTreatment(presented)).toBe('BLACKOUT')
    expect(presented.dialoguePresentation).toBe('PLAIN_LIST')
    const staged = send(fresh(), { type: 'APPLY_CONTROL_FIXTURE', fixture: 'POST_SOLVE_STAGED' })
    expect(staged.speech?.lines[0]?.copyKey).toBe('TODO.STORY.POST_SOLVE_DIALOGUE')
    expect(staged.speech?.lines[0]?.text).toContain('PLACEHOLDER')
    expect(interfaceTreatment(staged)).toBe('BLACKOUT')
    expect(dialoguePolicy.blackout.logicalBand).toEqual({ x: 0, y: 180, width: 480, height: 90 })
    expect(dialoguePolicy.blackout.roomExpands).toBe(false)
  })

  it('S10-P2 plain-list announces replacement through the same reducer', () => {
    let state = send(fresh(), { type: 'SET_DIALOGUE_PRESENTATION', mode: 'PLAIN_LIST' })
    state = send(send(state, { type: 'SELECT_VERB', verb: 'OPEN' }), { type: 'INTERACT', targetId: 'official-case-file-cabinet' })
    state = send(state, { type: 'WALK_TO', point: { x: 80, y: 300 } })
    expect(state.dialoguePresentation).toBe('PLAIN_LIST')
    expect(controlClass(state)).toBe('WALK_PENDING_REPLACEABLE')
    expect(state.intentReplacement?.text).toContain('Prior action replaced')
    expect(state.intentReplacement?.id).toBe(1)
    expect(interfaceTreatment(state)).toBe('ACTIVE')
  })

  it('S10-P2 runtime provider calls stay zero', () => {
    expect(worldDialogueAllowed(true)).toBe(false)
    expect(worldDialogueAllowed(false)).toBe(true)
    expect(dialoguePolicy.terminal.worldDialogueWhileOpen).toBe(false)
    expect(dialoguePolicy.terminal.oneSemanticModel).toBe(true)
    expect(JSON.stringify(dialoguePolicy)).not.toContain('nansen_api')
    expect(JSON.stringify(dialoguePolicy)).not.toContain('fetch(')
  })

  it('S10-P2 R4 toolbox and journey policy hooks stay outside Hero state', () => {
    const state = send(fresh(), { type: 'APPLY_CONTROL_FIXTURE', fixture: 'PREBRIEF_EVIDENCE_SEA' })
    expect(state.phase).toBe('START')
    expect(state.inventory).toEqual([])
    expect(state.piggyNoteReadState).toBe('UNREAD')
    expect(state.caseFileDrawer).toBe('CLOSED')
    expect(dialoguePolicy.bindings.prebriefEvidenceSea.control).toBe('NONBLOCKING_SELF_TALK')
    expect(dialoguePolicy.bindings.preauthorizationCabinet.contactBeforeStoryLine).toBe(true)
  })
})
