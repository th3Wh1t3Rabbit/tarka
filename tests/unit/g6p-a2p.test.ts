import { describe, expect, it } from 'vitest'
import { advanceDialogueInput, createDialoguePlayback, RECORDS_OFFICE_NARRATIVE, UNRESOLVED_LEAD_COPY_KEYS } from '../../src/adventure/narrative'
import { createEulerMissionState, eulerMissionReducer, EULER_MISSION_TRUTH, missionCanDeadlock, type EulerMissionState, type JourneyStyle } from '../../src/adventure/eulerMission'
import { initialPropState, PROP_STATE_IDS, transitionProp } from '../../src/adventure/propCatalog'
import { ARCHIVIST_ANIMATION_IDS, createPlaceholderSemanticCatalog, productionCatalogIsComplete, REACTION_OVERLAY_IDS, ROOK_ANIMATION_IDS, ROOK_WALK_SEQUENCE, semanticCatalogDiagnostics, validateSemanticCatalog } from '../../src/adventure/semanticCatalog'
import { attachMicroLoop, attachOverlay, createSequenceState, deterministicBlinkAt, mirrorTransform, requestAnimation, sequenceFor, setTextReveal, talkFrameId, tickSemanticPlayback, tickSequence } from '../../src/adventure/sequenceEngine'

describe('G6P-A2P semantic art and deterministic animation contract', () => {
  const catalog = createPlaceholderSemanticCatalog()

  it('covers every required semantic character and overlay id', () => {
    expect(validateSemanticCatalog(catalog)).toBe(true)
    expect(Object.keys(catalog.characters.rook)).toEqual([...ROOK_ANIMATION_IDS])
    expect(Object.keys(catalog.characters.archivist)).toEqual([...ARCHIVIST_ANIMATION_IDS])
    expect(Object.keys(catalog.overlays)).toEqual([...REACTION_OVERLAY_IDS])
  })

  it('defines the proper four-phase walk order with distinct semantic content requirements', () => {
    const order = ROOK_WALK_SEQUENCE
    expect(order).toEqual(['walk.contact_a', 'walk.passing_a', 'walk.contact_b', 'walk.passing_b'])
    expect(new Set(order.map((id) => catalog.characters.rook[id].frames[0]!.contentTag)).size).toBe(4)
    expect(order.every((id) => catalog.characters.rook[id].mirrorHorizontal)).toBe(true)
    let playback = createSequenceState('rook', 'walk.contact_a')
    playback = tickSemanticPlayback(playback, catalog, 120)
    expect(playback.animationId).toBe('walk.passing_a')
    playback = tickSemanticPlayback(playback, catalog, 240)
    expect(playback.animationId).toBe('walk.passing_b')
    playback = tickSemanticPlayback(playback, catalog, 120)
    expect(playback.animationId).toBe('walk.contact_a')
  })

  it('mirrors permitted left-facing talk without moving the stable feet anchor', () => {
    const right = createSequenceState('rook', 'talk.neutral.open', 'RIGHT')
    const left = { ...right, facing: 'LEFT' as const }
    const sequence = catalog.characters.rook['talk.neutral.open']
    expect(mirrorTransform(right, sequence)).toBe('none')
    expect(mirrorTransform(left, sequence)).toBe('scaleX(-1)')
    expect(sequence.anchor).toEqual({ x: 24, y: 86 })
  })

  it('cycles talk only while text is revealing and stops closed', () => {
    const sequence = { ...catalog.characters.rook['talk.neutral.open'], frames: [
      { assetSlot: 'closed', durationMs: 100, contentTag: 'closed' },
      { assetSlot: 'open', durationMs: 100, contentTag: 'open' },
    ] }
    let state = setTextReveal(createSequenceState('rook', sequence.id), true)
    state = tickSequence(state, sequence, 100)
    expect(state.frameIndex).toBe(1)
    state = setTextReveal(state, false)
    expect(tickSequence(state, sequence, 1_000).frameIndex).toBe(0)
    expect(talkFrameId({ ...state, elapsedMs: 150 })).toBe('talk.neutral.closed')
    const revealing = setTextReveal(state, true)
    expect(talkFrameId({ ...revealing, elapsedMs: 150 })).toBe('talk.neutral.open')
    expect(talkFrameId({ ...revealing, elapsedMs: 150 }, true)).toBe('talk.emphasis.open')
  })

  it('never synthesizes camera-glance/front poses through side mirroring', () => {
    for (const character of ['rook', 'archivist'] as const) {
      const pose = catalog.characters[character]['react.camera_glance']
      expect(pose.frontFacing).toBe(true)
      expect(pose.mirrorHorizontal).toBe(false)
      expect(pose.fallback).toBeNull()
      expect(pose.resolution).toBe('OPTIONAL_UNINSTALLED')
    }
  })

  it('keeps held emotion while compatible micro-loops run and rejects foot taps while walking', () => {
    const annoyed = { ...createSequenceState('rook', 'react.annoyed'), held: true }
    expect(attachMicroLoop(annoyed, 'blink').animationId).toBe('react.annoyed')
    expect(attachMicroLoop(annoyed, 'foot_tap').microLoop).toBe('foot_tap')
    const confused = { ...createSequenceState('rook', 'react.confused'), held: true }
    expect(attachMicroLoop(confused, 'eyebrow').animationId).toBe('react.confused')
    const skeptical = { ...createSequenceState('archivist', 'react.skeptical'), held: true }
    expect(attachMicroLoop(skeptical, 'blink').animationId).toBe('react.skeptical')
    expect(attachMicroLoop(createSequenceState('rook', 'walk.contact_a'), 'foot_tap').microLoop).toBeNull()
  })

  it('attaches/removes independent overlays and keeps reduced-motion meaning', () => {
    const state = createSequenceState('rook', 'react.surprised')
    expect(attachOverlay(state, 'reaction.exclaim').overlay).toBe('reaction.exclaim')
    expect(attachOverlay(attachOverlay(state, 'reaction.exclaim'), null).overlay).toBeNull()
    const sequence = sequenceFor(catalog, state)
    expect(tickSequence(state, sequence, 10_000, true).animationId).toBe('react.surprised')
    expect(catalog.overlays['reaction.exclaim'].reducedMotionFrame).toBe(0)
    const pulsing = tickSemanticPlayback(attachOverlay(state, 'reaction.exclaim'), catalog, 180)
    expect(pulsing.frameIndex).toBe(0)
    expect(pulsing.overlayFrameIndex).toBe(1)
  })

  it('drives separate semantic mouth IDs only while text is revealing', () => {
    let talking = setTextReveal(createSequenceState('rook', 'talk.neutral.closed'), true)
    talking = tickSemanticPlayback(talking, catalog, 150)
    expect(talking.animationId).toBe('talk.neutral.open')
    talking = tickSemanticPlayback(talking, catalog, 150)
    expect(talking.animationId).toBe('talk.neutral.closed')
    talking = setTextReveal(talking, false)
    expect(tickSemanticPlayback(talking, catalog, 300).animationId).toBe('talk.neutral.closed')
  })

  it('uses deterministic blink timing and isolates character state', () => {
    expect(deterministicBlinkAt(17, 2)).toBe(deterministicBlinkAt(17, 2))
    const rook = attachOverlay(createSequenceState('rook'), 'reaction.idea')
    const archivist = createSequenceState('archivist')
    expect(rook.overlay).toBe('reaction.idea')
    expect(archivist.overlay).toBeNull()
    const crossCharacter = requestAnimation(rook, catalog.characters.rook['idle.neutral'], catalog.characters.archivist['gesture.point'])
    expect(crossCharacter.animationId).toBe('idle.neutral')
  })

  it('keeps placeholder play functional but fails LEAD_SELECTED completeness on fallbacks', () => {
    const rows = semanticCatalogDiagnostics(catalog)
    expect(rows.every(({ status }) => status === 'PASS' || status === 'MISSING')).toBe(true)
    const candidate = createPlaceholderSemanticCatalog('candidate', 'LEAD_SELECTED')
    expect(productionCatalogIsComplete(candidate)).toBe(false)
    const bogus = structuredClone(catalog)
    bogus.characters.rook['idle.neutral'].frames[0]!.assetSlot = 'characters.rook.missing.frame1'
    expect(validateSemanticCatalog(bogus)).toBe(false)
    const traversal = structuredClone(catalog)
    traversal.assets['characters.rook.animations.idle.frame1']!.src = '/art-packs/placeholder/../other/rook.svg'
    expect(validateSemanticCatalog(traversal)).toBe(false)
  })
})

describe('G6P-A2P prop, dialogue, and mission skeleton', () => {
  it('enumerates every required prop family and rejects illegal transitions', () => {
    expect(Object.keys(PROP_STATE_IDS)).toEqual(['requestDispenser', 'requestTicket', 'penStand', 'dispatchPlunger', 'recordCanister', 'nansenTerminal', 'caseAccessArtifact', 'ledger', 'deskLamp', 'globe', 'mug', 'filingCabinet', 'door'])
    const pressing = transitionProp(initialPropState('dispatchPlunger'), 'pressing')
    expect(transitionProp(pressing, 'down').state).toBe('down')
    expect(() => transitionProp(initialPropState('dispatchPlunger'), 'recovering')).toThrow(/Illegal/)
  })

  it('requires one input to finish a line and another to advance, with no timer advance', () => {
    let state = createDialoguePlayback()
    const sameObject = state
    expect(state).toBe(sameObject)
    state = advanceDialogueInput(state, RECORDS_OFFICE_NARRATIVE)
    expect(state.cueIndex).toBe(0)
    expect(state.visibleCharacters).toBe(RECORDS_OFFICE_NARRATIVE[0]!.provisionalText.length)
    state = advanceDialogueInput(state, RECORDS_OFFICE_NARRATIVE)
    expect(state.cueIndex).toBe(1)
    expect(UNRESOLVED_LEAD_COPY_KEYS).toHaveLength(10)
    expect(RECORDS_OFFICE_NARRATIVE.every(({ advance }) => advance === 'PLAYER_PACED')).toBe(true)
  })

  function completeJourney(journey: JourneyStyle) {
    let state = createEulerMissionState(journey)
    state = eulerMissionReducer(state, { type: 'COMPLETE_ONBOARDING' })
    state = eulerMissionReducer(state, { type: 'ACQUIRE_FIRST_RECORD' })
    const order = journey === 'CURIOUS' ? ['second-breach', 'first-breach'] as const : ['first-breach', 'second-breach'] as const
    for (const branchId of order) state = eulerMissionReducer(state, { type: 'INSPECT_BRANCH', branchId })
    if (journey === 'MISTAKEN') {
      state = eulerMissionReducer(state, { type: 'SELECT_HYPOTHESIS', hypothesisId: 'FIRST_TRAIL_STOPS_AT_FIRST_ENGINE' })
      state = eulerMissionReducer(state, { type: 'TEST_HYPOTHESIS' })
      expect(state.hypothesisResult).toBe('FALSIFIED')
      expect(state.recoveryCount).toBe(1)
    }
    state = eulerMissionReducer(state, { type: 'SELECT_HYPOTHESIS', hypothesisId: 'FIRST_TRAIL_JOINS_SECOND_ROUTE' })
    state = eulerMissionReducer(state, { type: 'TEST_HYPOTHESIS' })
    for (const [slot, evidenceId] of [['AMOUNT', 'EXACT_EARLY_NET'], ['RECEIVER', 'EXACT_MAIN_RECEIVER'], ['LINK', 'EXACT_CONVERGENCE']] as const) state = eulerMissionReducer(state, { type: 'ASSEMBLE', slot, evidenceId })
    return state
  }

  it.each(['DIRECT', 'CURIOUS', 'MISTAKEN'] as JourneyStyle[])('%s journey completes without deadlock', (journey) => {
    const state = completeJourney(journey)
    expect(state.stage).toBe('COMPLETE')
    expect(missionCanDeadlock(state)).toBe(false)
  })

  it('keeps contextual evidence out of exact assembly and preserves the frozen/no-network boundary', () => {
    let state: EulerMissionState = { ...completeJourney('DIRECT'), stage: 'CASE_ASSEMBLY', assembly: {}, objective: 'BUILD THE CASE.' }
    state = eulerMissionReducer(state, { type: 'ASSEMBLE', slot: 'LINK', evidenceId: 'CONTEXT_SECONDARY' })
    expect(state.assembly.LINK).toBeUndefined()
    expect(state.objective).toBe("THAT RECORD DOESN'T CLOSE THE TRAIL.")
    expect(EULER_MISSION_TRUTH.historicalCutoffUtc).toBe('2023-03-13T12:15:00Z')
    expect(EULER_MISSION_TRUTH.networkPolicy).toBe('FROZEN_RECORD_ONLY')
    expect(EULER_MISSION_TRUTH.conclusionBoundary).toContain('NO CLAIM OF IDENTITY')
  })
})
