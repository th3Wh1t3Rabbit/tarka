import { describe, expect, it } from 'vitest'
import { activeMomentId, ambientClip, builtinCues, clipById, cueMoments, MUG_STEAM_A, MUG_STEAM_B, MUG_STEAM_FPS, MUG_STEAM_REST_MS, mugSteamFrame, readDefaultCueSheet, resolveActorCue, resolveCue, saveCueVersion, setDefaultCueVersion, upsertCue } from '../../src/adventure/animationCues'
import type { LayoutStore } from '../../src/adventure/sceneComposition'

function memoryStore(): LayoutStore {
  const values = new Map<string, string>()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) }, removeItem: (key) => { values.delete(key) } }
}

describe('animation cue sheets', () => {
  it('defaults idle breath, walking, and mug steam when no sheet is chosen', () => {
    expect(resolveCue(null, 'idle:rook', 'rook')?.clipId).toBe('rook.idle.breath')
    expect(resolveCue(null, 'idle:arthur', 'arthur')?.clipId).toBe('arthur.idle.breath')
    expect(resolveCue(null, 'idle:mug', 'mug')?.clipId).toBe('mug.steam')
    expect(clipById('rook.idle.breath')?.frames.length).toBeGreaterThan(1)
    expect(activeMomentId({ walking: true, speechReturn: null, lineIndex: 0, lastInteractionId: null }, 'rook')).toBe('walk:rook')
    expect(activeMomentId({ walking: false, speechReturn: 'DIALOGUE', lineIndex: 1, lastInteractionId: 'DIALOGUE.sports' }, 'arthur')).toBe('dialogue:sports:1')
    expect(activeMomentId({ walking: false, speechReturn: 'SCENE', lineIndex: 0, lastInteractionId: 'INTERACTION.REQUIRED.take-pen' }, 'rook')).toBe('interaction:take-pen')
  })

  it('uses the chosen saved sheet in live play and keeps other moments on the builtin', () => {
    const storage = memoryStore()
    const sheet = upsertCue({ cues: [] }, { momentId: 'dialogue:sports:0', actorId: 'arthur', clipId: 'arthur.explain', fps: 4, holdMs: 400, mode: 'HOLD' })
    const saved = saveCueVersion(storage, 'Sports explain', sheet, false)
    expect(readDefaultCueSheet(storage)).toBeNull()
    const version = saved.versions[0]!
    setDefaultCueVersion(storage, version.id)
    const live = readDefaultCueSheet(storage)
    const sports = resolveActorCue({ walking: false, speechReturn: 'DIALOGUE', lineIndex: 0, lastInteractionId: 'DIALOGUE.sports' }, 'arthur', live)
    expect(sports?.cue.clipId).toBe('arthur.explain')
    expect(sports?.cue.fps).toBe(4)
    expect(sports?.cue.holdMs).toBe(400)
    expect(resolveActorCue({ walking: false, speechReturn: null, lineIndex: 0, lastInteractionId: null }, 'rook', live)).toBeNull()
    expect(cueMoments().some((moment) => moment.id === 'dialogue:sports:0')).toBe(true)
    expect(builtinCues().some((cue) => cue.momentId === 'idle:mug')).toBe(true)
    expect(ambientClip('rook', 0)?.id).toBe('rook.idle.still')
    expect(ambientClip('arthur', 0)?.id).toBe('arthur.idle.still')
    const rookSeen = new Set(Array.from({ length: 220 }, (_, second) => ambientClip('rook', second)?.id))
    const arthurSeen = new Set(Array.from({ length: 120 }, (_, second) => ambientClip('arthur', second)?.id))
    expect(rookSeen.has('rook.idle.breath')).toBe(true)
    expect(rookSeen.has('rook.foot-tap')).toBe(true)
    expect(arthurSeen.has('arthur.glance-left')).toBe(true)
    expect(arthurSeen.has('arthur.glance-right')).toBe(true)
    const taps = clipById('rook.foot-tap')!
    expect(taps.frames.some((frame) => frame.includes('blink'))).toBe(false)
    expect(taps.frames.length).toBeGreaterThan(12)
    expect(rookSeen.has('rook.posture')).toBe(true)
    const openingRest = Array.from({ length: 5 }, (_, second) => ambientClip('rook', second)?.id)
    expect(openingRest.every((id) => id === 'rook.idle.still')).toBe(true)
    expect(Array.from({ length: 30 }, (_, second) => ambientClip('rook', second)?.id).some((id) => id && id !== 'rook.idle.breath')).toBe(true)
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
})
