import { describe, expect, it } from 'vitest'
import { PRODUCTION_PHYSICAL_CHOREOGRAPHY } from '../../src/adventure/physicalChoreography'
import { productionComposition } from '../../src/adventure/layout7Production'
import { layoutEntitySrc, layoutHotspotPixels, PERSISTENT_MISC_JUNK_OVERLAY } from '../../src/adventure/sceneComposition'
import { cabinetTransitionPlan } from '../../src/app/cabinetTransitionPolicy'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import type { AdventureState } from '../../src/adventure/types'
import { buildRuntimeSession } from '../../src/adventure/runtimeSession'

describe('Principal drawer corrections', () => {
  const official = productionComposition.entities.find(entity => entity.id === 'official-cabinet')!
  const misc = productionComposition.entities.find(entity => entity.id === 'misc-cabinet')!

  it('binds official files to filed drawer 2 before and after Euler is removed', () => {
    expect(official.runtimeAssetId).toBe('cabinet.official.drawer-02-filed')
    expect(official.states.filed).toContain('drawer_02_filed_open.png')
    const before = layoutEntitySrc(official, { caseOpen: true, caseUnsearched: true, miscOpen: false, terminalOn: false })
    const after = layoutEntitySrc(official, { caseOpen: true, caseUnsearched: false, miscOpen: false, terminalOn: false })
    expect(after).toBe(before)
    expect(after).toContain('drawer_02_filed_open.png')
  })

  it('keeps the bottom miscellaneous drawer visibly full after useful objects are extracted', () => {
    const before = layoutEntitySrc(misc, { caseOpen: false, caseUnsearched: true, miscOpen: true, miscUncollected: true, terminalOn: false })
    const after = layoutEntitySrc(misc, { caseOpen: false, caseUnsearched: true, miscOpen: true, miscUncollected: false, terminalOn: false })
    expect(after).toBe(before)
    expect(after).toContain('cabinet_open__drawer_04_open.png')
    expect(PERSISTENT_MISC_JUNK_OVERLAY).toEqual(expect.objectContaining({
      src: expect.stringContaining('/drawers/misc_open_junk.png'),
      offsetY: 18,
      crop: { left: 22, top: 53, width: 22, height: 5 },
    }))
    expect(layoutHotspotPixels(productionComposition, 'miscellaneous-catch-all-contents', 2)).not.toBeNull()
  })

  it('keeps the official file hotspot on drawer 2 and misc contents on bottom drawer 4', () => {
    const officialBox = layoutHotspotPixels(productionComposition, 'official-case-file-cabinet', 2)!
    const officialContents = layoutHotspotPixels(productionComposition, 'disorderly-stack-of-confidential-files', 2)!
    const miscBox = layoutHotspotPixels(productionComposition, 'miscellaneous-drawer-cabinet', 2)!
    const miscContents = layoutHotspotPixels(productionComposition, 'miscellaneous-catch-all-contents', 2)!
    expect((officialContents.top - officialBox.top) / officialBox.height).toBeCloseTo(.25, 1)
    expect((miscContents.top - miscBox.top) / miscBox.height).toBeCloseTo(.63, 1)
  })

  it('uses matching transition families, a normal case-file reach, and reserved misc extraction motion', () => {
    expect(cabinetTransitionPlan('official-cabinet', official.states.closed!, official.states.filed!).frames).toEqual(
      Array.from({ length: 6 }, (_, index) => expect.stringContaining(`drawer_02_filed_phase_0${index + 1}.png`)),
    )
    expect(cabinetTransitionPlan('misc-cabinet', misc.states.closed!, misc.states.open!).frames).toEqual(
      Array.from({ length: 6 }, (_, index) => expect.stringContaining(`drawer_04_phase_0${index + 1}.png`)),
    )
    expect(PRODUCTION_PHYSICAL_CHOREOGRAPHY.find(route => route.routeId === 'required.pickup-case-stack')).toMatchObject({
      classification: 'ITEM_CONTACT',
      animation: { clipId: 'rook.reach.neutral' },
      poseClass: 'EMPTY_HAND_REACH',
    })
    expect(PRODUCTION_PHYSICAL_CHOREOGRAPHY.find(route => route.routeId === 'required.pickup-misc-contents')).toMatchObject({
      animation: { clipId: 'rook.drawer-extract' },
      poseClass: 'EMPTY_HAND_REACH',
    })
  })

  it('keeps the signed-form handoff ten logical pixels farther from Arthur than ordinary proximity', () => {
    let state: AdventureState = {
      ...createInitialAdventureState({ skipIntro: true }),
      phase: 'FORM_COMPLETED' as const,
      inventory: ['signed-terminal-authorization-form-with-doodles' as const, 'broken-feather-pen' as const],
    }
    state = adventureReducer(state, { type: 'SELECT_VERB', verb: 'GIVE' })
    state = adventureReducer(state, { type: 'SELECT_ITEM', itemId: 'signed-terminal-authorization-form-with-doodles' })
    state = adventureReducer(state, { type: 'INTERACT', targetId: 'mr-index' })
    expect(state.walk?.to).toEqual({ x: 406, y: 365 })
    expect(state.walk?.pendingInteraction).toMatchObject({ verb: 'GIVE', targetId: 'mr-index', itemId: 'signed-terminal-authorization-form-with-doodles' })
  })

  it('does not let later mixed drawer dialogue turn Rook away before the extraction contacts', () => {
    let state: AdventureState = {
      ...createInitialAdventureState({ skipIntro: true, session: buildRuntimeSession(productionComposition) }),
      phase: 'COMPLETE',
      authorizationState: 'APPROVED',
      miscDrawer: 'OPEN',
      miscContents: 'UNCOLLECTED',
    }
    state = adventureReducer(state, { type: 'SELECT_VERB', verb: 'PICK_UP' })
    state = adventureReducer(state, { type: 'INTERACT', targetId: 'miscellaneous-catch-all-contents' })
    state = adventureReducer(state, { type: 'WALK_TICK', delta: 8000 })
    expect(state.activeSequence?.id).toBe('SEQUENCE.DRAWER_LOOT')
    expect(state.rookFacing).toBe('RIGHT')
    for (let guard = 0; guard < 4 && state.activeSequence?.currentSemanticContact !== 'CONTACT.DRAWER_PICKUP_1'; guard += 1) {
      state = adventureReducer(state, { type: 'ADVANCE_SEQUENCE' })
    }
    expect(state.activeSequence?.currentSemanticContact).toBe('CONTACT.DRAWER_PICKUP_1')
    expect(state.rookFacing).toBe('RIGHT')
  })

  it('does not grant the Euler folder until the search dialogue finds it', () => {
    let state: AdventureState = {
      ...createInitialAdventureState({ skipIntro: true, session: buildRuntimeSession(productionComposition) }),
      phase: 'COMPLETE',
      authorizationState: 'APPROVED',
      caseFileDrawer: 'OPEN',
      caseStack: 'UNSEARCHED',
    }
    state = adventureReducer(state, { type: 'SELECT_VERB', verb: 'PICK_UP' })
    state = adventureReducer(state, { type: 'INTERACT', targetId: 'disorderly-stack-of-confidential-files' })
    state = adventureReducer(state, { type: 'WALK_TICK', delta: 8000 })
    for (let guard = 0; guard < 8 && state.activeSequence?.currentActionId !== 'search-dialogue'; guard += 1) {
      state = adventureReducer(state, { type: 'ADVANCE_SEQUENCE' })
    }
    expect(state.activeSequence).toMatchObject({ currentActionId: 'search-dialogue', waitingSpeechStage: 'CASEFILE_SEARCH' })
    expect(state.speech?.lines.at(-1)?.text).toBe('Euler Finance. There you are.')
    expect(state.inventory).not.toContain('euler-case-file')
    while (state.speech) state = adventureReducer(state, { type: 'ADVANCE_SPEECH' })
    state = adventureReducer(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state.activeSequence?.currentSemanticContact).toBe('CONTACT.CASEFILE_COLLECT')
    expect(state.inventory).toContain('euler-case-file')
    expect(state.caseStack).toBe('SEARCHED_EULER_REMOVED')
    state = adventureReducer(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state.activeSequence).toMatchObject({ currentActionId: 'recite-file', waitingSpeechStage: 'CASEFILE_RECITATION' })
    expect(state.speech?.lines[0]?.text).toContain('March 13, 2023')
  })
})
