import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PRODUCTION_PHYSICAL_CHOREOGRAPHY } from '../../src/adventure/physicalChoreography'
import { DRAWER_SEQUENCE_SPEECH } from '../../src/adventure/content'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import { SCRIPTED_SEQUENCES } from '../../src/controller/mission/performance'
import type { AdventureAction, AdventureState, HotspotId, InventoryItemId, PuzzlePhase, VerbId } from '../../src/adventure/types'

type Observation = {
  testId: string
  route: string
  action: string
  phase: PuzzlePhase
  inventory: InventoryItemId[]
  semanticContact: string | null
  physicalPose: string | null
  rookPose: string
  arthurPose: string
  formPaperOwner: string
  deskStampOwner: string
  speechDisposition: string
}

const observations: Observation[] = []
const send = (state: AdventureState, action: AdventureAction) => adventureReducer(state, action)
const fixture = (phase: PuzzlePhase, inventory: InventoryItemId[] = []): AdventureState => ({
  ...createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true, instantText: true } }),
  phase,
  inventory,
})

function begin(state: AdventureState, verb: VerbId, targetId: HotspotId, itemId?: InventoryItemId) {
  let next = send({ ...state, speech: null, nonblockingSpeech: null }, { type: 'SELECT_VERB', verb })
  if (itemId) next = send(next, { type: 'SELECT_ITEM', itemId })
  next = send(next, { type: 'INTERACT', targetId })
  if (next.walk) next = send(next, { type: 'WALK_TICK', delta: 10_000 })
  return next
}

function observe(testId: string, route: string, state: AdventureState) {
  observations.push({
    testId,
    route,
    action: state.activeSequence?.currentActionId ?? 'SETTLED',
    phase: state.phase,
    inventory: [...state.inventory],
    semanticContact: state.activeSequence?.currentSemanticContact ?? state.lastSemanticContact,
    physicalPose: state.activeSequence?.currentPhysicalPoseClass ?? null,
    rookPose: state.rookPose,
    arthurPose: state.mrIndexPose,
    formPaperOwner: state.activeSequence?.currentPropOwners.FORM_PAPER ?? (state.inventory.includes('approved-stamped-terminal-authorization-form') ? 'ROOK_APPROVED_INVENTORY' : state.inventory.includes('signed-terminal-authorization-form-with-doodles') ? 'ROOK_INVENTORY' : 'NONE'),
    deskStampOwner: state.activeSequence?.currentPropOwners.DESK_STAMP ?? (state.mrIndexPose === 'STAMP' ? 'ARTHUR_IN_USE' : 'DESK'),
    speechDisposition: state.speech ? 'BLOCKING' : state.nonblockingSpeech ? 'NONBLOCKING' : 'NONE',
  })
}

function advanceToAction(state: AdventureState, actionId: string) {
  let next = state
  for (let guard = 0; next.activeSequence && next.activeSequence.currentActionId !== actionId && guard < 30; guard += 1) next = send(next, { type: 'ADVANCE_SEQUENCE' })
  expect(next.activeSequence?.currentActionId).toBe(actionId)
  return next
}

function finish(state: AdventureState) {
  let next = state
  for (let guard = 0; next.activeSequence && guard < 30; guard += 1) next = send(next, { type: 'ADVANCE_SEQUENCE' })
  expect(next.activeSequence).toBeNull()
  return next
}

describe.sequential('S15-R6 true physical pose and form handoff closure', () => {
  it('R6-01 consumes one typed physical owner for generic and scripted routes', () => {
    for (const id of ['take-form', 'take-form-2', 'take-pen', 'take-pen-2', 'pickup-misc-contents']) {
      expect(PRODUCTION_PHYSICAL_CHOREOGRAPHY.find(row => row.routeId === `required.${id}`)).toMatchObject({ classification: 'EMPTY_HAND_CONTACT', poseClass: 'EMPTY_HAND_REACH' })
    }
    expect(PRODUCTION_PHYSICAL_CHOREOGRAPHY.find(row => row.routeId === 'required.pickup-case-stack')).toMatchObject({ classification: 'ITEM_CONTACT', poseClass: 'EMPTY_HAND_REACH', animation: { clipId: 'rook.reach.neutral' } })
    expect(PRODUCTION_PHYSICAL_CHOREOGRAPHY.find(row => row.routeId === 'required.give-form')).toMatchObject({ classification: 'PAPER_HANDOFF', poseClass: 'PAPER_REACH' })
    const drawer = SCRIPTED_SEQUENCES.find(sequence => sequence.id === 'SEQUENCE.DRAWER_LOOT')!
    expect(drawer.actions.filter(action => action.contact?.startsWith('CONTACT.DRAWER_PICKUP')).every(action => action.physicalPose?.poseClass === 'EMPTY_HAND_REACH')).toBe(true)
    expect(drawer.actions.filter(action => action.speechStage?.startsWith('DRAWER_')).every(action => action.physicalPose?.poseClass === 'IDLE' && action.physicalPose.releaseActors?.includes('ROOK'))).toBe(true)
  })

  it('R6-02 observes empty-hand contact in both form and pen acquisition orders', () => {
    const cases: Array<[string, AdventureState, HotspotId, PuzzlePhase]> = [
      ['take-form', fixture('START'), 'blank-authorization-form', 'FORM_HELD'],
      ['take-form-2', fixture('PEN_HELD', ['loose-feather-pen']), 'blank-authorization-form', 'FORM_AND_PEN'],
      ['take-pen', fixture('START'), 'pen-stand', 'PEN_HELD'],
      ['take-pen-2', fixture('FORM_HELD', ['blank-terminal-authorization-form']), 'pen-stand', 'FORM_AND_PEN'],
    ]
    for (const [id, initial, target, phaseAfter] of cases) {
      let state = begin(initial, 'PICK_UP', target)
      state = advanceToAction(state, 'contact')
      expect(state, `R6_EMPTY_HAND_${id}`).toMatchObject({ phase: phaseAfter, rookPose: 'REACH' })
      expect(state.activeSequence, `R6_EMPTY_HAND_OWNER_${id}`).toMatchObject({ pendingStateChangeRule: `required.${id}`, currentPhysicalPoseClass: 'EMPTY_HAND_REACH', stateChangeOccurred: true })
      expect(state.activeSequence?.currentSemanticContact).toBe(`CONTACT.ITEM.${id}`)
      expect(state.inventory).not.toContain('approved-stamped-terminal-authorization-form')
      observe(`s15-r6:${id}`, `PICK_UP ${target}`, state)
    }
  })

  it('R6-03 observes empty-hand reach at every miscellaneous-loot pickup contact', () => {
    let state = begin({ ...fixture('COMPLETE', ['broken-feather-pen', 'approved-stamped-terminal-authorization-form', 'euler-case-file']), miscDrawer: 'OPEN' }, 'PICK_UP', 'miscellaneous-catch-all-contents')
    const contacts = ['CONTACT.DRAWER_PICKUP_1', 'CONTACT.DRAWER_PICKUP_2', 'CONTACT.DRAWER_PICKUP_3', 'CONTACT.DRAWER_PICKUP_4', 'CONTACT.DRAWER_PICKUP_5']
    const stages = ['DRAWER_RUBBER_BAND', 'DRAWER_RUBIKS_CUBE', 'DRAWER_VHS', 'DRAWER_PIGGY_BANK', 'DRAWER_TOOLBOX']
    for (const [index, contact] of contacts.entries()) {
      while (state.activeSequence?.currentSemanticContact !== contact) state = send(state, { type: 'ADVANCE_SEQUENCE' })
      expect(state, `R6_DRAWER_EMPTY_HAND_${contact}`).toMatchObject({ rookPose: 'REACH' })
      expect(state.activeSequence?.currentPhysicalPoseClass, `R6_DRAWER_OWNER_${contact}`).toBe('EMPTY_HAND_REACH')
      observe(`s15-r6:drawer:${contact}`, 'PICK_UP miscellaneous-catch-all-contents', state)
      state = send(state, { type: 'ADVANCE_SEQUENCE' })
      expect(state.activeSequence).toMatchObject({ status: 'WAITING_FOR_SPEECH', waitingSpeechStage: stages[index], currentPhysicalPoseClass: 'IDLE' })
      expect(state.rookPose, `R6_DRAWER_RELEASE_${contact}`).toBe('IDLE')
      expect(state.speech, `R6_DRAWER_SPEECH_${contact}`).not.toBeNull()
      expect(state.speech?.lines.map(line => line.text), `R6_DRAWER_STAGE_COPY_${contact}`).toEqual(DRAWER_SEQUENCE_SPEECH[stages[index] as keyof typeof DRAWER_SEQUENCE_SPEECH].map(line => line.text))
      state = send(state, { type: 'ADVANCE_SEQUENCE' })
    }
    expect(state.inventory).toEqual(expect.arrayContaining(['rubber-band', 'rubiks-cube', 'sharknado-2-vhs', 'piggy-bank-intact', 'small-toolbox-closed']))
    expect(state.inventory).toHaveLength(new Set(state.inventory).size)
    expect(state.miscContents).toBe('COLLECTED_GUM_REMAINS')
  })

  it('R6-04 uses the normal empty-hand reach for Euler without a premature held-file pose', () => {
    let state = begin({ ...fixture('COMPLETE', ['broken-feather-pen', 'approved-stamped-terminal-authorization-form']), caseFileDrawer: 'OPEN' }, 'PICK_UP', 'disorderly-stack-of-confidential-files')
    state = advanceToAction(state, 'collect')
    expect(state, 'R6_CASE_FILE_ITEM_POSE').toMatchObject({ rookPose: 'REACH', caseStack: 'SEARCHED_EULER_REMOVED' })
    expect(state.activeSequence, 'R6_CASE_FILE_ITEM_OWNER').toMatchObject({ currentSemanticContact: 'CONTACT.CASEFILE_COLLECT', currentPhysicalPoseClass: 'EMPTY_HAND_REACH' })
    expect(state.inventory.filter(id => id === 'euler-case-file')).toHaveLength(1)
    observe('s15-r6:case-file-collect', 'PICK_UP disorderly-stack-of-confidential-files', state)
  })

  it('R6-05 observes one-paper offer, handoff, review, bounded stamp, return, and staging', () => {
    const signed = 'signed-terminal-authorization-form-with-doodles' as const
    const approved = 'approved-stamped-terminal-authorization-form' as const
    const initial = fixture('FORM_COMPLETED', [signed, 'broken-feather-pen'])
    let state = begin(initial, 'GIVE', 'mr-index', signed)
    expect(state.rookPosition).not.toEqual(initial.rookPosition)
    expect(state.rookFacing).toBe('RIGHT')

    state = advanceToAction(state, 'offer')
    expect(state, 'R6_FORM_OFFER_POSE').toMatchObject({ rookPose: 'USE_GIVE', mrIndexPose: 'IDLE', phase: 'FORM_COMPLETED' })
    expect(state.activeSequence, 'R6_FORM_OFFER_OWNER').toMatchObject({ currentPhysicalPoseClass: 'PAPER_REACH', currentPropOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'DESK' } })
    expect(state.inventory.filter(id => id === signed)).toHaveLength(1)
    observe('s15-r6:form-offer', 'GIVE signed form TO Arthur', state)

    state = advanceToAction(state, 'receive')
    expect(state, 'R6_FORM_PRE_CONTACT_HOLD').toMatchObject({ rookPose: 'USE_GIVE', mrIndexPose: 'IDLE', phase: 'FORM_COMPLETED' })
    expect(state.activeSequence, 'R6_FORM_PRE_CONTACT_OWNER').toMatchObject({ currentPhysicalPoseClass: 'IDLE', currentPropOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'DESK' } })
    observe('s15-r6:form-receive', 'Rook holds the only visible signed form while Arthur waits empty-handed', state)

    state = advanceToAction(state, 'handoff')
    expect(state, 'R6_FORM_HANDOFF_CONTACT').toMatchObject({ rookPose: 'IDLE', mrIndexPose: 'RECEIVE', phase: 'FORM_SUBMITTED' })
    expect(state.activeSequence, 'R6_FORM_HANDOFF_OWNER').toMatchObject({ currentSemanticContact: 'CONTACT.FORM_HANDOFF', currentPhysicalPoseClass: 'EMPTY_HAND_REACH', currentPropOwners: { FORM_PAPER: 'ARTHUR_VISIBLE', DESK_STAMP: 'DESK' } })
    expect(state.inventory).not.toContain(signed)
    expect(state.inventory).not.toContain(approved)
    observe('s15-r6:form-handoff', 'GIVE signed form TO Arthur', state)

    state = advanceToAction(state, 'review')
    expect(state, 'R6_FORM_REVIEW_DOCUMENT').toMatchObject({ rookPose: 'IDLE', mrIndexPose: 'DOCUMENT' })
    expect(state.activeSequence?.currentPropOwners.FORM_PAPER).toBe('ARTHUR_VISIBLE')
    observe('s15-r6:form-review', 'Arthur reviews signed form', state)

    state = advanceToAction(state, 'return')
    expect(state, 'R6_FORM_RETURN_RELEASES_PAPER').toMatchObject({ rookPose: 'USE_GIVE', mrIndexPose: 'IDLE', phase: 'FORM_SUBMITTED' })
    expect(state.activeSequence).toMatchObject({ currentSemanticContact: 'CONTACT.FORM_RETURN', currentPhysicalPoseClass: 'PAPER_REACH', currentPropOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'DESK' } })
    expect(state.inventory).not.toContain(approved)
    expect(state.inventory).not.toContain(signed)
    observe('s15-r6:form-return', 'Arthur returns signed form to Rook before stamping', state)

    state = advanceToAction(state, 'stamp')
    expect(state, 'R6_FORM_STAMP_BOUNDED').toMatchObject({ rookPose: 'USE_GIVE', mrIndexPose: 'STAMP', phase: 'COMPLETE' })
    expect(state.activeSequence, 'R6_DESK_STAMP_HIDDEN_IN_USE').toMatchObject({ currentSemanticContact: 'CONTACT.FORM_STAMP', currentPhysicalPoseClass: 'STAMP_USE', currentPropOwners: { FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'ARTHUR_IN_USE' } })
    expect(state.inventory.filter(id => id === approved)).toHaveLength(1)
    observe('s15-r6:form-stamp', 'Arthur stamps the form while Rook holds it', state)

    state = advanceToAction(state, 'stamp-caption')
    expect(state, 'R6_FORM_POST_STAMP_HOLD').toMatchObject({ rookPose: 'USE_GIVE', mrIndexPose: 'IDLE' })
    expect(state.activeSequence?.currentPropOwners, 'R6_DESK_STAMP_RESTORED').toMatchObject({ FORM_PAPER: 'ROOK_VISIBLE', DESK_STAMP: 'DESK' })
    observe('s15-r6:form-post-stamp', 'approval dialogue follows the returned-form stamp', state)

    state = finish(state)
    expect(state).toMatchObject({ rookPose: 'IDLE', mrIndexPose: 'IDLE', phase: 'COMPLETE' })
    expect(state.inventory.filter(id => id === approved)).toHaveLength(1)
    expect(state.speech).toBeNull()
    expect(state.transcript.some(line => line.finalScriptSource?.eventKey === 'COPY.A1:Review dialogue')).toBe(true)
    expect(state.transcript.some(line => line.finalScriptSource?.eventKey === 'COPY.A1:Stamp, return, and authorization')).toBe(true)
    observe('s15-r6:form-settled', 'form exchange settles only after the staged approval dialogue', state)
  })

  it('R6-06 binds evidence to real observed stages rather than registry-only PASS rows', () => {
    expect(observations.length).toBeGreaterThanOrEqual(17)
    expect(observations.every(row => row.testId.startsWith('s15-r6:') && row.route.length > 8 && row.action.length > 0)).toBe(true)
    expect(observations.some(row => row.semanticContact === 'CONTACT.FORM_HANDOFF' && row.arthurPose === 'DOCUMENT' && row.formPaperOwner === 'ARTHUR_VISIBLE')).toBe(true)
    expect(observations.some(row => row.semanticContact === 'CONTACT.FORM_STAMP' && row.arthurPose === 'STAMP' && row.formPaperOwner === 'ROOK_VISIBLE' && row.deskStampOwner === 'ARTHUR_IN_USE')).toBe(true)
  })
})

afterAll(() => {
  if (process.env.S15_R6_WRITE_RECEIPT !== '1') return
  const out = resolve('review/s15-r6/RECEIPTS')
  mkdirSync(out, { recursive: true })
  writeFileSync(resolve(out, 'REDUCER_STAGE_OBSERVATIONS.json'), `${JSON.stringify({ schema: 'tarka.s15-r6.reducer-stage-observations.v1', status: 'PASS', observations }, null, 2)}\n`)
})
