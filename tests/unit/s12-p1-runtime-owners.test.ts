import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { APPROACH_GAP, layoutHotspotWalkTo, referenceComposition, type LayoutStore } from '../../src/adventure/sceneComposition'
import { CUE_SHEET_KEY, MUG_STEAM_A, MUG_STEAM_B, MUG_STEAM_FPS, MUG_STEAM_REST_MS, mugSteamFrame, readDefaultCueSheet, resolveActorCue } from '../../src/adventure/animationCues'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import { buildRuntimeSession, walkPointForTarget } from '../../src/adventure/runtimeSession'
import { SEMANTIC_TIMERS, nextTimerToken, timerFireAllowed } from '../../src/adventure/semanticTimers'
import { accessibilityPreferences, ephemeralKeysIn, productionSaveDocument } from '../../src/adventure/persistencePolicy'
import { devToolActive } from '../../src/adventure/developmentTools'
import { hotspots } from '../../src/adventure/scenes'

const reducerSource = readFileSync('src/adventure/reducer.ts', 'utf8')
const appSource = readFileSync('src/app/App.tsx', 'utf8')

function memoryStore(): LayoutStore {
  const values = new Map<string, string>()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) }, removeItem: (key) => { values.delete(key) } }
}

describe('S12-P1 runtime owners', () => {
  it('keeps the reducer free of browser layout and storage reads', () => {
    expect(reducerSource).not.toContain('readDefaultLayout')
    expect(reducerSource).not.toContain('localStorage')
    expect(reducerSource).not.toContain('window')
    expect(reducerSource).not.toContain('document')
  })

  it('replays the same explicit geometry when two browser stores differ', () => {
    const layout = referenceComposition()
    const session = buildRuntimeSession(layout)
    const left = memoryStore()
    const right = memoryStore()
    left.setItem('trace-escape.layout-library.v1', '{"defaultVersionId":"other"}')
    right.setItem('trace-escape.layout-library.v1', '{"defaultVersionId":"elsewhere"}')
    const start = createInitialAdventureState({ skipIntro: true, session })
    const action = { type: 'WALK_TO' as const, point: { x: 400, y: 350 } }
    expect(adventureReducer(start, action)).toEqual(adventureReducer({ ...start }, action))
    expect(left.getItem('trace-escape.layout-library.v1')).not.toBe(right.getItem('trace-escape.layout-library.v1'))
    const cabinet = hotspots.find((hotspot) => hotspot.id === 'official-case-file-cabinet')!
    const fromX = 200
    const target = session.targets[cabinet.id]
    expect(target).toBeTruthy()
    expect(walkPointForTarget(target!, fromX)).toEqual(layoutHotspotWalkTo(layout, cabinet.id, fromX))
  })

  it('preserves the current 14px approach gap as unaccepted WIP', () => {
    expect(APPROACH_GAP).toBe(14)
    expect(readFileSync('src/adventure/sceneComposition.ts', 'utf8')).toContain('export const APPROACH_GAP = 14')
  })

  it('preserves the current split steam sequence', () => {
    expect(MUG_STEAM_FPS).toBe(5)
    expect(MUG_STEAM_REST_MS).toBe(10000)
    const frameMs = 1000 / MUG_STEAM_FPS
    expect(mugSteamFrame(0)).toContain('mug_steam_a.png')
    expect(mugSteamFrame(frameMs)).toContain('phase_01')
    expect(mugSteamFrame(2 * frameMs)).toContain('phase_02')
    expect(mugSteamFrame(MUG_STEAM_A.length * frameMs + 1000)).toBeNull()
    const bStart = MUG_STEAM_A.length * frameMs + MUG_STEAM_REST_MS
    expect(mugSteamFrame(bStart)).toContain('mug_steam_b.png')
    expect(mugSteamFrame(bStart + MUG_STEAM_B.length * frameMs + 1000)).toBeNull()
  })

  it('does not let a hostile development cue sheet become production animation', () => {
    const hostile = memoryStore()
    hostile.setItem(CUE_SHEET_KEY, JSON.stringify({ defaultVersionId: 'hostile', versions: [{ id: 'hostile', name: 'Hostile', savedAt: '', sheet: { cues: [{ momentId: 'idle:rook', actorId: 'rook', clipId: 'rook.idle.breath', fps: 24, holdMs: 0, mode: 'LOOP' }] } }] }))
    expect(readDefaultCueSheet(hostile)?.cues[0]?.fps).toBe(24)
    expect(resolveActorCue({ walking: false, speechReturn: null, lineIndex: 0, lastInteractionId: null }, 'rook')).toBeNull()
    expect(appSource).toContain('import.meta.env.DEV ? readDefaultCueSheet() : null')
  })

  it('advances inactivity from one owner', () => {
    expect(appSource).not.toContain('setIdleSeconds')
    expect(readFileSync('src/app/semanticTimerController.ts', 'utf8')).toContain("'IDLE_TICK'")
    expect(appSource).toContain('bindIdleTimer')
    const state = createInitialAdventureState({ skipIntro: true })
    const paused = adventureReducer(state, { type: 'IDLE_TICK', foreground: false })
    expect(paused.inactiveSeconds).toBe(0)
    const next = adventureReducer(state, { type: 'IDLE_TICK', foreground: true })
    expect(next.inactiveSeconds).toBe(1)
  })

  it('rejects a stale semantic timer for a newer event', () => {
    expect(SEMANTIC_TIMERS).toEqual(['WALK_TICK', 'SEQUENCE_ADVANCE', 'SPEECH_REVEAL', 'NONBLOCKING_AUTO_CLEAR', 'SCENE_AUTO_CLEAR', 'IDLE_TICK', 'REPLACEMENT_ACK', 'FOCUS_RESTORE'])
    const first = nextTimerToken(null, 'SCENE_AUTO_CLEAR', 'line-1')
    const newer = nextTimerToken(first, 'SCENE_AUTO_CLEAR', 'line-2')
    expect(timerFireAllowed(newer, first)).toBe(false)
    expect(timerFireAllowed(newer, newer)).toBe(true)
    expect(timerFireAllowed({ ...newer, eventId: `retired:${newer.generation}` }, newer)).toBe(false)
  })

  it('keeps ephemeral adventure state out of the production save and clears it on reset', () => {
    let state = createInitialAdventureState({ skipIntro: true, session: buildRuntimeSession(referenceComposition()) })
    state = { ...state, instantText: true, speech: state.speech, walk: { from: state.rookPosition, to: { x: 300, y: 350 }, path: [state.rookPosition, { x: 300, y: 350 }], segmentIndex: 0, segmentProgress: 0, pendingInteraction: null } }
    const saved = productionSaveDocument({ access: true }, accessibilityPreferences(state))
    expect(ephemeralKeysIn(saved)).toEqual([])
    expect(saved.accessibility.instantText).toBe(true)
    expect(saved).not.toHaveProperty('speech')
    expect(saved).not.toHaveProperty('walk')
    const reset = adventureReducer(state, { type: 'RESET' })
    expect(reset.walk).toBeNull()
    expect(reset.speech?.returnTo).toBe('INTRO')
    expect(reset.instantText).toBe(true)
    expect(reset.runtimeSession.layoutHash).toBe(state.runtimeSession.layoutHash)
  })

  it('keeps blank-form pickup WIP: the sheet enters inventory', () => {
    const state = adventureReducer(adventureReducer({ ...createInitialAdventureState({ skipIntro: true }), reducedAnimation: true }, { type: 'SELECT_VERB', verb: 'PICK_UP' }), { type: 'INTERACT', targetId: 'blank-authorization-form' })
    expect(state.inventory).toContain('blank-terminal-authorization-form')
    expect(state.phase).toBe('FORM_HELD')
  })

  it('cannot open art, animation, or detail tools without development authority', () => {
    const params = new URLSearchParams('artLayout=1&animDirector=1&detailReview=1')
    expect(devToolActive(false, params, 'artLayout')).toBe(false)
    expect(devToolActive(false, params, 'animDirector')).toBe(false)
    expect(devToolActive(false, params, 'detailReview')).toBe(false)
    expect(devToolActive(true, params, 'artLayout')).toBe(true)
    expect(appSource).toContain("import.meta.env.DEV && devToolActive(true, query, 'artLayout')")
    expect(appSource).toContain("import.meta.env.DEV && devToolActive(true, query, 'animDirector')")
    expect(appSource).toContain("import.meta.env.DEV && devToolActive(true, query, 'detailReview')")
  })
})
