import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { animationClips } from '../../src/adventure/animationCues'
import { interfaceTreatment } from '../../src/adventure/controlPolicy'
import { globeSnapshotAt, globeTimeline, globeTimelineTotalMs } from '../../src/adventure/globeVisual'
import { PRODUCTION_PHYSICAL_CHOREOGRAPHY, routeAnimationPolicy, routeAnimationPolicyForState } from '../../src/adventure/physicalChoreography'
import { GLOBE_LEVEL_1_PROMOTION_MS, GLOBE_LEVEL_2_PROMOTION_MS, adventureReducer, createInitialAdventureState, terminalCanOpen, terminalIsPowered } from '../../src/adventure/reducer'
import type { AdventureAction, AdventureState } from '../../src/adventure/types'
import { clipFacingPolicy } from '../../src/app/characterFacingPolicy'
import { characterPoseClipId } from '../../src/app/characterVisual'
import { renderedAnimationPolicy } from '../../src/app/renderedAnimationPolicy'

const send = (state: AdventureState, action: AdventureAction) => adventureReducer(state, action)
const inventory = JSON.parse(readFileSync('public/art-packs/production/indexes/APPROVED_ANIMATION_CAPABILITY_INVENTORY.json', 'utf8')) as {
  counts: { rook: number; arthur: number; total: number }
  authorityInputs: Array<{ path: string; bytes: number; sha256: string }>
  frames: Array<Record<string, unknown> & { actor: string; relativePath: string; sha256: string; disposition: string }>
}
const matrix = readFileSync('public/art-packs/production/indexes/PRODUCTION_ROUTE_TO_ANIMATION_MATRIX.csv', 'utf8').trim().split('\n')

function touch(state: AdventureState, verb: 'PUSH' | 'PULL' | 'USE' = 'PUSH') {
  let next = send(send(state, { type: 'SELECT_VERB', verb }), { type: 'INTERACT', targetId: 'office-globe' })
  if (next.walk) next = send(next, { type: 'WALK_TICK', delta: 10_000 })
  for (let guard = 0; next.activeSequence && guard < 12; guard += 1) next = send(next, { type: 'ADVANCE_SEQUENCE' })
  return next
}

function touchAtContact(state: AdventureState, verb: 'PUSH' | 'PULL' | 'USE' = 'PUSH') {
  let next = send(send(state, { type: 'SELECT_VERB', verb }), { type: 'INTERACT', targetId: 'office-globe' })
  if (next.walk) next = send(next, { type: 'WALK_TICK', delta: 10_000 })
  for (let guard = 0; next.activeSequence?.currentSemanticContact == null && guard < 12; guard += 1) next = send(next, { type: 'ADVANCE_SEQUENCE' })
  return next
}

describe('S15-R9 exact globe reconciliation', () => {
  it.each([[1, 108, 9760], [2, 144, 9159], [3, 240, 9075]] as const)('R9-GLOBE-%s owns the exact entry count and total', (level, entries, total) => {
    expect(globeTimeline('PULL', level)).toHaveLength(entries)
    expect(globeTimelineTotalMs(level)).toBe(total)
  })

  it('R9-GLOBE-L1 uses the approved sharp bank throughout', () => {
    expect(new Set(globeTimeline('PULL', 1).map(entry => entry.surface))).toEqual(new Set(['sharp']))
  })

  it('R9-GLOBE-L2 uses the approved sharp bank throughout', () => {
    expect(new Set(globeTimeline('PULL', 2).map(entry => entry.surface))).toEqual(new Set(['sharp']))
  })

  it.each([[0, 'sharp'], [5, 'sharp'], [6, 'soft'], [11, 'soft'], [12, 'full'], [167, 'full'], [192, 'soft'], [215, 'sharp'], [216, 'sharp']] as const)('R9-GLOBE-L3 surface at entry %s is %s', (index, surface) => {
    expect(globeTimeline('PULL', 3)[index]?.surface).toBe(surface)
  })

  it.each([[1, 12], [2, 0], [3, 0]] as const)('R9-GLOBE-PUSH level %s holds its natural final phase %s', (level, phase) => {
    expect(globeSnapshotAt('PUSH', level, globeTimelineTotalMs(level), 0)).toMatchObject({ phase, surface: 'sharp', decayStage: 'FINAL_HOLD', complete: true })
  })

  it.each([[1, 12], [2, 0], [3, 0]] as const)('R9-GLOBE-PULL level %s holds its natural final phase %s', (level, phase) => {
    expect(globeSnapshotAt('PULL', level, globeTimelineTotalMs(level), 0)).toMatchObject({ phase, surface: 'sharp', decayStage: 'FINAL_HOLD', complete: true })
  })

  it('R9-GLOBE sharp phase paths use the real approved bank identities', () => {
    expect(globeSnapshotAt('PULL', 1, 0, 0).source).toMatch(/globe_idle\.png$/)
    expect(globeSnapshotAt('PULL', 1, 70, 0).source).toMatch(/globe_spin_left\.png$/)
    expect(globeSnapshotAt('PULL', 1, 140, 0).source).toMatch(/globe_spin_left__phase_02\.png$/)
  })

  it('R9-GLOBE promotion windows are exactly 5000ms then 4000ms', () => {
    expect([GLOBE_LEVEL_1_PROMOTION_MS, GLOBE_LEVEL_2_PROMOTION_MS]).toEqual([5000, 4000])
  })

  it('R9-GLOBE same direction promotes L1 to L2 inside 5000ms', () => {
    let state = touch(createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true } }), 'PUSH')
    state = send(state, { type: 'GLOBE_TICK', deltaMs: 4999 })
    expect(touch(state, 'PUSH')).toMatchObject({ globeLevel: 2, globeBoostRemainingMs: 4000 })
  })

  it('R9-GLOBE same direction restarts L1 after 5000ms', () => {
    let state = touch(createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true } }), 'PUSH')
    state = send(state, { type: 'GLOBE_TICK', deltaMs: 5000 })
    expect(touch(state, 'PUSH').globeLevel).toBe(1)
  })

  it('R9-GLOBE same direction promotes L2 to L3 inside 4000ms', () => {
    let state = touch(touch(createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true } }), 'PUSH'), 'PUSH')
    state = send(state, { type: 'GLOBE_TICK', deltaMs: 3999 })
    expect(touch(state, 'PUSH')).toMatchObject({ globeLevel: 3, globeBoostRemainingMs: 0 })
  })

  it('R9-GLOBE L3 same-direction touch preserves all schedule identity', () => {
    let state = touch(touch(touch(createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true } }), 'PUSH'), 'PUSH'), 'PUSH')
    state = send(state, { type: 'GLOBE_TICK', deltaMs: 777 })
    const before = { revision: state.globeRevision, elapsed: state.globeElapsedMs, start: state.globeStartPhase, level: state.globeLevel, pose: state.globePose }
    state = touch(state, 'PUSH')
    expect({ revision: state.globeRevision, elapsed: state.globeElapsedMs, start: state.globeStartPhase, level: state.globeLevel, pose: state.globePose }).toEqual(before)
  })

  it('R9-GLOBE reverse preserves phase, clears blur, reverses, and starts L1 synchronously', () => {
    let state = touch(touch(touch(createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true } }), 'PUSH'), 'PUSH'), 'PUSH')
    state = send(state, { type: 'GLOBE_TICK', deltaMs: 1000 })
    const phase = globeSnapshotAt(state.globePose, state.globeLevel, state.globeElapsedMs, state.globeStartPhase).phase
    state = touch(state, 'PULL')
    expect(state).toMatchObject({ globePose: 'PULL', globeLevel: 1, globeStartPhase: phase, globeBoostRemainingMs: 5000 })
    expect(state.globeElapsedMs).toBeGreaterThanOrEqual(0)
    expect(state.globeElapsedMs).toBeLessThan(70)
    expect(globeSnapshotAt(state.globePose, state.globeLevel, state.globeElapsedMs, state.globeStartPhase).surface).toBe('sharp')
  })

  it('R9-GLOBE semantic decay reaches trickle before final hold', () => {
    const timeline = globeTimeline('PULL', 1)
    const beforeTail = timeline.slice(0, 84).reduce((sum, entry) => sum + entry.dwellMs, 0)
    expect(globeSnapshotAt('PULL', 1, beforeTail, 0).decayStage).toBe('TRICKLE')
    expect(globeSnapshotAt('PULL', 1, 9760, 0).decayStage).toBe('FINAL_HOLD')
  })

  it('R9-GLOBE-RUNTIME-TOTAL does not truncate the accepted L1 schedule at 1500ms', () => {
    let state = touch(createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true } }), 'PUSH')
    state = send(state, { type: 'GLOBE_TICK', deltaMs: 1500 })
    expect(state).toMatchObject({ globeMotion: 'SPINNING', globeElapsedMs: 1500, globeLevel: 1 })
  })

  it('R9-GLOBE controls remain active while the finite globe schedule runs', () => {
    const state = touch(createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true } }), 'USE')
    expect(state.globeMotion).toBe('SPINNING')
    expect(interfaceTreatment(state)).toBe('ACTIVE')
  })

  it('R9-GLOBE-CONTROLS keeps the tray active at the real globe contact', () => {
    const state = touchAtContact(createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true } }), 'PUSH')
    expect(state.activeSequence?.currentSemanticContact).toBe('CONTACT.GLOBE.PUSH')
    expect(interfaceTreatment(state)).toBe('ACTIVE')
  })
})

describe('S15-R9 terminal, route animation, and facing closure', () => {
  it('R9-TERMINAL is OFF before approved return even when authorization is approved', () => {
    const state = { ...createInitialAdventureState({ skipIntro: true }), phase: 'FORM_SUBMITTED' as const, authorizationState: 'APPROVED' as const }
    expect(terminalIsPowered(state)).toBe(false)
    expect(terminalCanOpen(state)).toBe(false)
  })

  it('R9-TERMINAL turns ON once the approved form is in Rook inventory', () => {
    const state = { ...createInitialAdventureState({ skipIntro: true }), phase: 'COMPLETE' as const, authorizationState: 'APPROVED' as const, inventory: ['approved-stamped-terminal-authorization-form' as const] }
    expect(terminalIsPowered(state)).toBe(true)
    expect(terminalCanOpen(state)).toBe(true)
  })

  it.each([
    ['EMPTY_HAND_REACH', 'rook.reach.neutral', 'NEUTRAL_REACH_ONLY'],
    ['ITEM_REACH', 'rook.case-file', 'KEY_ITEM_ONLY'],
    ['PAPER_REACH', 'rook.give', 'PAPER_HANDOFF_ONLY'],
    ['NO_REACH', 'NONE', 'NO_PHYSICAL_CLIP'],
  ] as const)('R9-ROUTE %s maps to %s without force', (pose, clipId, framePolicy) => {
    expect(routeAnimationPolicy(pose)).toEqual({ poseClass: pose, clipId, framePolicy, forceJustification: null })
  })

  it('R9-ROUTE keeps neutral reach generic and reserves drawer extraction for its exact route', () => {
    const routes = PRODUCTION_PHYSICAL_CHOREOGRAPHY.filter(route => route.poseClass === 'EMPTY_HAND_REACH')
    expect(routes.length).toBeGreaterThanOrEqual(15)
    expect(new Set(routes.map(route => route.animation.clipId))).toEqual(new Set(['rook.reach.neutral', 'rook.drawer-extract']))
    expect(routes.filter(route => route.animation.clipId === 'rook.drawer-extract').map(route => route.routeId)).toEqual(['required.pickup-misc-contents'])
    expect(animationClips().find(clip => clip.id === 'rook.reach.neutral')?.frames).toEqual([expect.stringMatching(/rook_use_reach\.png$/)])
  })

  it.each([
    ['R9-ROUTE-FORM', 'required.take-form'],
    ['R9-ROUTE-CABINET-CLOSE', 'required.close-case-drawer'],
    ['R9-ROUTE-GLOBE', 'dynamic.globe.push'],
  ] as const)('%s uses the one neutral frame and no effort frame', (_id, routeId) => {
    expect(PRODUCTION_PHYSICAL_CHOREOGRAPHY.find(route => route.routeId === routeId)?.animation.clipId).toBe('rook.reach.neutral')
    expect(animationClips().find(clip => clip.id === 'rook.reach.neutral')?.frames).toEqual([expect.stringMatching(/rook_use_reach\.png$/)])
  })

  it('R9-ROUTE exposes no generic force animation clip', () => {
    expect(animationClips().some(clip => /force|effort|press|pull/.test(clip.id))).toBe(false)
  })

  it('R9-ROUTE renderer lookup shares the typed route owner', () => {
    const base = createInitialAdventureState({ skipIntro: true })
    expect(routeAnimationPolicyForState({ ...base, rookPose: 'REACH' })?.clipId).toBe('rook.reach.neutral')
    expect(routeAnimationPolicyForState({ ...base, rookPose: 'INSPECT' })?.clipId).toBe('rook.inspect-lean')
    expect(routeAnimationPolicyForState({ ...base, rookPose: 'USE_GIVE' })?.clipId).toBe('rook.give')
  })

  it.each([
    ['MR_INDEX', 'arthur.point', 'RIGHT', true, 'NATIVE_LEFT_MIRRORABLE'],
    ['MR_INDEX', 'arthur.point', 'LEFT', false, 'NATIVE_LEFT_MIRRORABLE'],
    ['ROOK', 'rook.talk', 'LEFT', true, 'NATIVE_RIGHT_MIRRORABLE'],
    ['ROOK', 'rook.talk', 'RIGHT', false, 'NATIVE_RIGHT_MIRRORABLE'],
    ['MR_INDEX', 'arthur.camera-address', 'RIGHT', false, 'CAMERA_FIXED'],
    ['MR_INDEX', 'arthur.glance-left', 'RIGHT', false, 'DIRECTION_FIXED'],
  ] as const)('R9-FACING %s %s toward %s mirrors=%s by %s', (actor, clip, facing, mirrored, rule) => {
    expect(clipFacingPolicy(actor, clip, facing)).toMatchObject({ mirrorHorizontal: mirrored, rule })
  })

  it('R9-OPENING holds the closed document before entry and plays its family only when Arthur speaks', () => {
    let state = createInitialAdventureState()
    expect(characterPoseClipId('MR_INDEX', state)).toBe('arthur.document')
    state = send(state, { type: 'BEGIN_ROOK_ENTRY' })
    expect(characterPoseClipId('MR_INDEX', state)).toBe('arthur.document')
    state = send(state, { type: 'WALK_TICK', delta: 10_000 })
    expect(state.openingStage).toBe('DIALOGUE')
    expect(characterPoseClipId('MR_INDEX', state)).toBe('arthur.document')
    const frames = ['/document-hold.png', '/document-talk.png']
    expect(renderedAnimationPolicy({ actor: 'MR_INDEX', speakerOwner: 'ROOK', clipId: 'arthur.document', frames, active: true, loop: true })).toMatchObject({ frames: ['/document-hold.png'], active: false, loop: false })
    expect(renderedAnimationPolicy({ actor: 'MR_INDEX', speakerOwner: 'MR_INDEX', clipId: 'arthur.document', frames, active: true, loop: true })).toMatchObject({ frames: ['/document-hold.png', '/document-hold.png', '/document-talk.png', '/document-hold.png', '/document-hold.png'], active: true, loop: true })
  })

  it('R9-POINT keeps Arthur pointing and both reprimand facings through Rook response, then releases once', () => {
    let state = createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true, instantText: true } })
    state = send(send(state, { type: 'SELECT_VERB', verb: 'USE' }), { type: 'INTERACT', targetId: 'nansen-terminal' })
    if (state.walk) state = send(state, { type: 'WALK_TICK', delta: 10_000 })
    for (let guard = 0; state.activeSequence?.waitingSpeechStage !== 'BLOCKED_REPRIMAND' && guard < 12; guard += 1) state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state).toMatchObject({ rookFacing: 'LEFT', mrIndexFacing: 'RIGHT', arthurPointHold: true, rookPose: 'IDLE' })
    expect(state.speech?.lines.length).toBeGreaterThan(0)
    while (state.speech) {
      state = send(state, { type: 'REVEAL_FULL' })
      state = send(state, { type: 'ADVANCE_SPEECH' })
    }
    expect(state.activeSequence).toMatchObject({ status: 'ACTION_ACTIVE', currentActionId: 'reprimand', waitingSpeechStage: null })
    expect(state.arthurPointHold).toBe(true)
    state = send(state, { type: 'ADVANCE_SEQUENCE' })
    expect(state.activeSequence).toBeNull()
    expect(state.arthurPointHold).toBe(false)
  })
})

describe('S15-R9 complete capability inventory and route matrix', () => {
  it('R9-INVENTORY contains every shipped Rook and Arthur PNG exactly once', () => {
    expect(inventory.counts).toEqual({ rook: 174, arthur: 78, total: 252 })
    expect(new Set(inventory.frames.map(frame => `${frame.actor}:${frame.relativePath}`)).size).toBe(252)
  })

  it('R9-INVENTORY records and hashes every required authority input', () => {
    expect(inventory.authorityInputs).toHaveLength(17)
    for (const input of inventory.authorityInputs) {
      const bytes = readFileSync(input.path)
      expect(input.bytes).toBe(bytes.length)
      expect(input.sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
    }
  })

  it('R9-INVENTORY gives every frame complete guidance and a controlled disposition', () => {
    const allowed = new Set(['LIVE_REQUIRED_NOW', 'RESERVED_FOR_SCRIPT_BINDING', 'OPTIONAL_POST_SUBMISSION', 'DO_NOT_USE_OR_SUPERSEDED'])
    for (const frame of inventory.frames) {
      expect(frame.sha256).toMatch(/^[a-f0-9]{64}$/)
      expect(frame.runtimeIdentity).toBe(`sha256:${frame.sha256}`)
      expect(frame.width).toBe(48)
      expect(frame.height).toBe(88)
      expect(frame.authoritySource).toBeTruthy()
      expect(frame.intendedUse).toBeTruthy()
      expect(frame.guidance).toBeTruthy()
      expect(frame.mirroringRule).toBeTruthy()
      expect(allowed.has(frame.disposition)).toBe(true)
    }
  })

  it('R9-INVENTORY quarantines every generic effort/press/pull frame', () => {
    const force = inventory.frames.filter(frame => /effort|use_press|use_pull|pull_action|push_action/.test(frame.relativePath))
    expect(force.length).toBeGreaterThan(0)
    expect(new Set(force.map(frame => frame.disposition))).toEqual(new Set(['DO_NOT_USE_OR_SUPERSEDED']))
  })

  it('R9-MATRIX covers every production physical route plus required seams', () => {
    expect(matrix.length - 1).toBeGreaterThanOrEqual(30)
    const body = matrix.join('\n')
    for (const route of PRODUCTION_PHYSICAL_CHOREOGRAPHY) expect(body).toContain(`"${route.routeId.replace(/^required\./, '')}"`)
    for (const seam of ['opening-paper', 'cabinet-reprimand', 'terminal-reprimand', 'arthur-topics', 'form-review', 'terminal-entry', 'ending', 'completion']) expect(body).toContain(`"${seam}"`)
  })

  it('R9-INDEXES truthfully publish live document, point, globe, terminal, and neutral-reach behavior', () => {
    const clipIndex = readFileSync('public/art-packs/production/indexes/CLIP_AND_CAPABILITY_INDEX.json', 'utf8')
    const parsedClipIndex = JSON.parse(clipIndex) as { arthurLive: string[] }
    const liveIndex = readFileSync('public/art-packs/production/indexes/LIVE_VS_STAGED_CAPABILITIES.json', 'utf8')
    for (const value of ['arthur.document', 'arthur.point', 'rook.reach.neutral', '9760', '9159', '9075']) expect(clipIndex).toContain(value)
    expect(parsedClipIndex.arthurLive).toContain('arthur.document')
    for (const value of ['terminal OFF before approved form return', 'opening closed-paper hold', 'single typed route-to-animation policy']) expect(liveIndex).toContain(value)
  })
})
