import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateArtPackIndex, validateArtPackManifest } from '../../src/adventure/artPack'
import { LEAD_OPENING_SHELL, usefulRules } from '../../src/adventure/content'
import { deriveFirstBreachRecord } from '../../src/adventure/evidence'
import { adventureReducer, createInitialAdventureState, currentSpeechLine, isTalking } from '../../src/adventure/reducer'
import { buildCommandSentence } from '../../src/adventure/sentence'
import { enterScene, exitScene, getSceneDefinition } from '../../src/adventure/scenes'
import { VERBS, type AdventureAction, type AdventureState, type ArtPackManifest, type HotspotId, type InventoryItemId, type PuzzlePhase, type VerbId } from '../../src/adventure/types'

function send(state: AdventureState, action: AdventureAction) {
  return adventureReducer(state, action)
}

const playableState = () => createInitialAdventureState({ skipIntro: true })

function drainSpeech(state: AdventureState) {
  let next = state
  let guard = 0
  while (next.activeSequence && guard++ < 40) next = send(next, { type: 'ADVANCE_SEQUENCE' })
  while (next.speech && guard++ < 20) next = send(next, { type: 'ADVANCE_SPEECH' })
  return next
}

function interact(state: AdventureState, verb: VerbId, targetId: HotspotId, itemId?: InventoryItemId) {
  let next = send(state, { type: 'SELECT_VERB', verb })
  if (itemId) next = send(next, { type: 'ACT_ON_ITEM', itemId })
  next = send(next, { type: 'INTERACT', targetId })
  next = send(next, { type: 'WALK_TICK', delta: 2_000 })
  return drainSpeech(next)
}

describe('G6P-A0 deterministic point-and-click domain', () => {
  it('exposes the exact nine-verb grid in the approved order', () => {
    expect(VERBS).toEqual(['GIVE', 'PICK_UP', 'USE', 'OPEN', 'LOOK_AT', 'PUSH', 'CLOSE', 'TALK_TO', 'PULL'])
    expect(new Set(usefulRules.map(({ verb }) => verb))).toEqual(new Set(['GIVE', 'PICK_UP', 'USE', 'OPEN', 'LOOK_AT', 'PUSH', 'CLOSE', 'PULL']))
  })

  it('completes the approved chain without loss or duplicate evidence', () => {
    const FORM = 'blank-terminal-authorization-form' as const
    const PEN = 'loose-feather-pen' as const
    const SIGNED = 'signed-terminal-authorization-form-with-doodles' as const
    let state = playableState()
    state = interact(state, 'PICK_UP', 'blank-authorization-form')
    expect(state.inventory).toEqual([FORM])
    state = interact(state, 'PICK_UP', 'pen-stand')
    expect(state.inventory).toEqual([FORM, PEN])
    state = send(state, { type: 'SELECT_VERB', verb: 'USE' })
    state = send(state, { type: 'ACT_ON_ITEM', itemId: FORM })
    state = drainSpeech(send(state, { type: 'ACT_ON_ITEM', itemId: PEN }))
    expect(state.phase).toBe('FORM_COMPLETED')
    expect(state.inventory).toEqual([SIGNED, 'broken-feather-pen'])
    state = interact(state, 'GIVE', 'mr-index', SIGNED)
    expect(state.phase).toBe('COMPLETE')
    expect(state.inventory).toEqual(['broken-feather-pen', 'approved-stamped-terminal-authorization-form'])
    expect(state.recordArchived).toBe(false)
    expect(state.archivedEvidenceIds).toEqual([])
    state = interact(state, 'USE', 'nansen-terminal')
    expect(state.phase).toBe('COMPLETE')
    expect(state.archivedEvidenceIds).toEqual([])
  })

  it('cancels or replaces a queued interaction while preserving ordinary movement', () => {
    let state = send(playableState(), { type: 'SELECT_VERB', verb: 'PULL' })
    state = send(state, { type: 'INTERACT', targetId: 'request-dispenser' })
    expect(state.walk?.pendingInteraction?.verb).toBe('PULL')
    state = send(state, { type: 'CANCEL_SELECTION' })
    expect(state.walk?.pendingInteraction).toBeNull()
    state = send(state, { type: 'WALK_TICK', delta: 2_000 })
    expect(state.phase).toBe('START')

    state = send(playableState(), { type: 'SELECT_VERB', verb: 'PULL' })
    state = send(state, { type: 'INTERACT', targetId: 'request-dispenser' })
    state = send(state, { type: 'SELECT_VERB', verb: 'LOOK_AT' })
    expect(state.walk?.pendingInteraction).toBeNull()
    state = send(state, { type: 'WALK_TICK', delta: 2_000 })
    expect(state.phase).toBe('START')
    expect(state.selectedVerb).toBe('LOOK_AT')
  })

  it('keeps dead ends deterministic and unable to corrupt critical state', () => {
    const initial = playableState()
    const first = interact(initial, 'PUSH', 'filing-drawers')
    const second = interact(initial, 'PUSH', 'filing-drawers')
    expect(first.phase).toBe('START')
    expect(first.inventory).toEqual([])
    expect(currentSpeechLine(send(send(initial, { type: 'SELECT_VERB', verb: 'PUSH' }), { type: 'INTERACT', targetId: 'filing-drawers' }))).toBeNull()
    expect(first).toEqual(second)
  })

  it('opens optional dialogue without changing the puzzle phase', () => {
    let state = interact(playableState(), 'TALK_TO', 'mr-index')
    expect(state.dialogueOpen).toBe(true)
    expect(state.phase).toBe('START')
    state = send(state, { type: 'CHOOSE_DIALOGUE_TOPIC', topicId: 'form-reminder' })
    expect(isTalking(state, 'MR_INDEX')).toBe(true)
    state = drainSpeech(state)
    expect(state.dialogueOpen).toBe(true)
    expect(state.exhaustedTopics).not.toContain('form-reminder')
  })

  it('never auto-advances speech and stops talking when the line is revealed', () => {
    let state = send(playableState(), { type: 'REVIEW_TALKING' })
    expect(state.speech?.lineIndex).toBe(0)
    expect(isTalking(state, 'ROOK')).toBe(true)
    state = send(state, { type: 'REVEAL_FULL' })
    expect(isTalking(state, 'ROOK')).toBe(false)
    expect(state.speech?.lineIndex).toBe(0)
    state = send(state, { type: 'ADVANCE_SPEECH' })
    expect(state.speech?.lineIndex).toBe(1)
    expect(isTalking(state, 'MR_INDEX')).toBe(true)
  })

  it('composes one-object, two-object, and default Walk to sentences', () => {
    let state = playableState()
    expect(buildCommandSentence(state)).toBe('Walk to')
    state = send(state, { type: 'HOVER_HOTSPOT', hotspotId: 'pen-stand' })
    expect(buildCommandSentence(state)).toBe('Walk to pen stand')
    state = { ...state, inventory: ['blank-terminal-authorization-form'] }
    state = send(state, { type: 'SELECT_VERB', verb: 'USE' })
    state = send(state, { type: 'ACT_ON_ITEM', itemId: 'blank-terminal-authorization-form' })
    expect(buildCommandSentence(state)).toBe('Use blank authorization form with pen stand')
  })

  it('review jumps grant only phase-consistent, non-losable inventory', () => {
    const expectations: Partial<Record<PuzzlePhase, InventoryItemId[]>> = {
      START: [], FORM_HELD: ['blank-terminal-authorization-form'], PEN_HELD: ['loose-feather-pen'], FORM_AND_PEN: ['blank-terminal-authorization-form', 'loose-feather-pen'], FORM_COMPLETED: ['signed-terminal-authorization-form-with-doodles', 'broken-feather-pen'], FORM_SUBMITTED: ['broken-feather-pen'], COMPLETE: ['broken-feather-pen', 'approved-stamped-terminal-authorization-form', 'euler-case-file'],
    }
    for (const [phase, inventory] of Object.entries(expectations)) {
      const state = send(playableState(), { type: 'REVIEW_JUMP', phase: phase as PuzzlePhase })
      expect(state.inventory).toEqual(inventory)
    }
  })

  it('preserves the accepted Nansen record exactly and labels precision safely', () => {
    const scenario: unknown = JSON.parse(readFileSync('public/scenarios/euler-2023-false-exit/scenario.json', 'utf8'))
    const firstBreachRecord = deriveFirstBreachRecord(scenario)
    expect(firstBreachRecord.observedAtUtc).toBe('2023-03-13T08:50:59Z')
    expect(firstBreachRecord.exactClaim).toContain('8,877,507.3483067 DAI')
    expect(firstBreachRecord.precision).toBe('NANSEN-PROVIDER PRECISION')
    expect(firstBreachRecord.proofGrade).toBe('EXACT_EVENT')
    expect(firstBreachRecord.historicalCutoffUtc).toBe('2023-03-13T12:15:00Z')
  })

  it('runs the exact Lead-authored opening with player-paced completion semantics', () => {
    let state = createInitialAdventureState()
    expect(state.introComplete).toBe(false)
    expect(state.speech?.lines).toEqual(LEAD_OPENING_SHELL)
    expect(currentSpeechLine(state)?.text).toContain('This is the Records Office?')
    state = send(state, { type: 'REVEAL_TICK', characters: 3 })
    expect(state.speech?.lineIndex).toBe(0)
    state = send(state, { type: 'ADVANCE_SPEECH' })
    expect(state.speech?.lineIndex).toBe(0)
    state = drainSpeech(state)
    expect(state.introComplete).toBe(true)
    expect(state.speech).toBeNull()
  })

  it('keeps scene geometry outside art bytes and proves the blank fixture hooks', () => {
    const records = getSceneDefinition('records-office')
    const blank = getSceneDefinition('blank-shell')
    expect(records.hotspots).toHaveLength(12)
    expect(records.walkRegion.id).toBe('records-office-walk-v1')
    expect(blank.playable).toBe(false)
    expect(blank.hotspots).toEqual([])
    expect(enterScene('blank-shell').event).toBe('blank-shell:entered')
    expect(exitScene('blank-shell').event).toBe('blank-shell:exited')
  })

  it('validates the exact swap-ready placeholder art-pack manifest', () => {
    const value: unknown = JSON.parse(readFileSync('public/art-packs/placeholder/manifest.json', 'utf8'))
    expect(validateArtPackManifest(value)).toBe(true)
    const manifest = value as ArtPackManifest
    expect(manifest.schemaVersion).toBe('2.0.0')
    expect(manifest.scalingMode).toBe('NEAREST_NEIGHBOR')
    expect(manifest.nativeResolution.width).toBe(480)
    expect(Object.keys(manifest.scenes)).toEqual(['records-office', 'blank-shell'])
    expect(manifest.characters.rook.animations.walkEast!.frames.map(({ src }) => src)).toEqual([
      '/art-packs/placeholder/characters/rook-walk.svg',
      '/art-packs/placeholder/characters/rook-walk-2.svg',
    ])
    expect(manifest.characters.rook.animations.walkEast!.mirrorHorizontal).toBe(true)
    expect(manifest.characters.rook.animations.talkClosed!.frames[0]!.src).not.toBe(manifest.characters.rook.animations.talkOpen!.frames[0]!.src)
    expect(Object.keys(manifest.props.nansenTerminal!.states)).toEqual(['unlocked'])
    const optionalLayersMissing = structuredClone(manifest)
    optionalLayersMissing.scenes['blank-shell'].midgroundLayers = []
    optionalLayersMissing.scenes['blank-shell'].foregroundLayers = []
    expect(validateArtPackManifest(optionalLayersMissing)).toBe(true)
    const missingRequired = structuredClone(manifest)
    delete (missingRequired.inventory as Partial<ArtPackManifest['inventory']>)['euler-case-file']
    expect(validateArtPackManifest(missingRequired)).toBe(false)
    const invalidDepthReference = structuredClone(manifest)
    invalidDepthReference.scenes['records-office'].propPlacements[0]!.depthBand = 'missing-band'
    expect(validateArtPackManifest(invalidDepthReference)).toBe(false)
    const hostile = structuredClone(value) as typeof manifest
    hostile.characters.rook.animations.walkEast!.frames[0]!.src = '//example.invalid/rook.svg'
    expect(validateArtPackManifest(hostile)).toBe(false)
    const index: unknown = JSON.parse(readFileSync('public/art-packs/index.json', 'utf8'))
    expect(validateArtPackIndex(index)).toBe(true)
  })
})
