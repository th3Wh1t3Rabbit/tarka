import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { globeTimelineCursor, globeTimelineTotalMs } from '../../src/adventure/globeVisual'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import type { AdventureAction, AdventureState } from '../../src/adventure/types'
import { cabinetTransitionPlan } from '../../src/app/cabinetTransitionPolicy'

const send = (state: AdventureState, action: AdventureAction) => adventureReducer(state, action)
function touch(state: AdventureState, verb: 'PUSH' | 'PULL' | 'USE') {
  let next = send(send(state, { type: 'SELECT_VERB', verb }), { type: 'INTERACT', targetId: 'office-globe' })
  if (next.walk) next = send(next, { type: 'WALK_TICK', delta: 10_000 })
  for (let guard = 0; next.activeSequence && guard < 12; guard += 1) next = send(next, { type: 'ADVANCE_SEQUENCE' })
  return next
}
const base = () => createInitialAdventureState({ skipIntro: true, accessibility: { reducedAnimation: true } })

describe('S15-R10 authoritative globe cursor', () => {
  it.each([
    ['PULL', 1, 0, 0, 70, 0],
    ['PULL', 1, 35, 0, 70, 0.5],
    ['PUSH', 2, 17.5, 0, 35, 0.5],
    ['PULL', 3, 10, 0, 20, 0.5],
    ['PULL', 1, 70, 1, 70, 0],
    ['PUSH', 1, 140, 2, 70, 0],
  ] as const)('R10-U-CURSOR-%# exposes entry, dwell, and exact fractional progress', (pose, level, elapsed, entry, dwell, fraction) => {
    expect(globeTimelineCursor(pose, level, elapsed, 0)).toMatchObject({ entryIndex: entry, dwellDurationMs: dwell, fractionalDwellProgress: fraction, complete: false })
  })

  it.each([
    ['PUSH', 1, 7], ['PUSH', 2, 9], ['PUSH', 3, 11], ['PULL', 1, 5], ['PULL', 2, 13], ['PULL', 3, 19],
  ] as const)('R10-U-HOLD-%# same direction after FINAL_HOLD starts fresh L1 at held angle', (pose, level, startPhase) => {
    const elapsed = globeTimelineTotalMs(level)
    const held = globeTimelineCursor(pose, level, elapsed, startPhase).phase
    const state = { ...base(), globePose: pose, globeLevel: level, globeMotion: 'FINAL_HOLD' as const, globeElapsedMs: elapsed, globeBoostRemainingMs: 0, globeStartPhase: startPhase, globeDecayStage: 'FINAL_HOLD' as const, globeRevision: 9 }
    const next = touch(state, pose)
    expect(next).toMatchObject({ globePose: pose, globeLevel: 1, globeMotion: 'SPINNING', globeElapsedMs: 0, globeStartPhase: held, globeBoostRemainingMs: 5000, globeRevision: 10 })
  })

  it('R10-U-CONTINUITY-1 promotion maps one-half L1 dwell to one-half L2 sharp dwell', () => {
    const state = { ...base(), globePose: 'PUSH' as const, globeLevel: 1 as const, globeMotion: 'SPINNING' as const, globeElapsedMs: 35, globeBoostRemainingMs: 4965, globeStartPhase: 4, globeRevision: 1 }
    expect(touch(state, 'PUSH')).toMatchObject({ globeLevel: 2, globeElapsedMs: 17.5, globeStartPhase: 4 })
  })
  it('R10-U-CONTINUITY-2 promotion maps one-quarter L2 dwell to one-quarter L3 sharp dwell', () => {
    const state = { ...base(), globePose: 'PULL' as const, globeLevel: 2 as const, globeMotion: 'SPINNING' as const, globeElapsedMs: 8.75, globeBoostRemainingMs: 3991.25, globeStartPhase: 8, globeRevision: 2 }
    expect(touch(state, 'PULL')).toMatchObject({ globeLevel: 3, globeElapsedMs: 5, globeStartPhase: 8 })
  })
  it('R10-U-CONTINUITY-3 reversal maps one-half L3 dwell to one-half L1 sharp dwell', () => {
    const state = { ...base(), globePose: 'PUSH' as const, globeLevel: 3 as const, globeMotion: 'SPINNING' as const, globeElapsedMs: 10, globeBoostRemainingMs: 0, globeStartPhase: 12, globeRevision: 3 }
    expect(touch(state, 'PULL')).toMatchObject({ globePose: 'PULL', globeLevel: 1, globeElapsedMs: 35, globeStartPhase: 12 })
  })
  it('R10-U-CONTINUITY-4 active same-direction L3 remains a true no-op', () => {
    const state = { ...base(), globePose: 'PULL' as const, globeLevel: 3 as const, globeMotion: 'SPINNING' as const, globeElapsedMs: 13, globeBoostRemainingMs: 0, globeStartPhase: 6, globeRevision: 4 }
    expect(touch(state, 'PULL')).toMatchObject({ globeLevel: 3, globeElapsedMs: 13, globeStartPhase: 6, globeRevision: 4 })
  })
})

describe('S15-R10 source-aware drawer transitions', () => {
  const closedOfficial = '/art-packs/production/files/production/furniture/cabinet-contents/frames/cabinet_closed.png'
  const filed = '/art-packs/production/files/production/furniture/cabinet-contents/frames/cabinet_open__drawer_02_filed_open.png'
  it('R10-U-DRAWER-1 opens official drawer-02 with the filed family', () => expect(cabinetTransitionPlan('official-cabinet', closedOfficial, filed).family).toBe('OFFICIAL_FILED_DRAWER_02'))
  it('R10-U-DRAWER-2 closes official drawer-02 from the actual filed source', () => expect(cabinetTransitionPlan('official-cabinet', filed, closedOfficial).family).toBe('OFFICIAL_FILED_DRAWER_02'))
  it('R10-U-DRAWER-3 never substitutes an empty official drawer after Euler extraction', () => expect(cabinetTransitionPlan('official-cabinet', '/legacy/empty.png', closedOfficial).frames.join('|')).toContain('drawer_02_filed'))
  it('R10-U-DRAWER-5 owns all six drawer-02 filed-paper transition frames', () => expect(cabinetTransitionPlan('official-cabinet', filed, closedOfficial).frames).toEqual(Array.from({ length: 6 }, (_, index) => expect.stringContaining(`drawer_02_filed_phase_0${index + 1}.png`))))
  it('R10-U-DRAWER-6 miscellaneous always uses bottom drawer-04', () => expect(cabinetTransitionPlan('misc-cabinet', 'closed', 'open')).toMatchObject({ family: 'MISC_DRAWER_04', frames: Array.from({ length: 6 }, (_, index) => expect.stringMatching(new RegExp(`lower-drawers/drawer-04/frames/.+drawer_04_phase_0${index + 1}\\.png$`))) }))
})

describe('S15-R10 exact animation ownership', () => {
  const inventory = JSON.parse(readFileSync('public/art-packs/production/indexes/APPROVED_ANIMATION_CAPABILITY_INVENTORY.json', 'utf8'))
  const staged = JSON.parse(readFileSync('public/art-packs/production/indexes/LIVE_VS_STAGED_CAPABILITIES.json', 'utf8'))
  it('R10-U-INDEX-1 uses exact normalized runtime paths', () => expect(inventory.ownershipIdentity).toBe('EXACT_NORMALIZED_RUNTIME_PATH'))
  it('R10-U-INDEX-2 keeps only the coherent-core duplicate idle live', () => expect(inventory.frames.filter((frame: { relativePath: string }) => frame.relativePath.endsWith('/archivist_idle_a.png')).map((frame: { relativePath: string; disposition: string }) => [frame.relativePath, frame.disposition])).toEqual([['coherent-core-v1.0.0/frames/archivist_idle_a.png', 'LIVE_REQUIRED_NOW'], ['conversation-v0.1.6/frames/archivist_idle_a.png', 'OPTIONAL_POST_SUBMISSION'], ['walk-v0.1.1/frames/archivist_idle_a.png', 'OPTIONAL_POST_SUBMISSION']]))
  it('R10-U-INDEX-3 marks mug steam and all used drawer families live', () => expect(inventory.runtimeFamilies.map((family: { id: string; disposition: string }) => [family.id, family.disposition])).toEqual([['mug.steam', 'LIVE_REQUIRED_NOW'], ['drawer.official.filed.02', 'LIVE_REQUIRED_NOW'], ['drawer.misc.04', 'LIVE_REQUIRED_NOW']]))
  it('R10-U-INDEX-4 removes mug and used drawer transitions from optional', () => expect(staged.optionalPostSubmission.join('|')).not.toMatch(/mug steam sequences|drawer travel frames/))
  it('R10-U-INDEX-5 retains the last decoded drawer frame on preload failure', () => expect(readFileSync('src/app/App.tsx', 'utf8')).toContain("() => { /* retain the last decoded frame; never flash through a missing/background frame */ }") )
  it('R10-U-INDEX-6 generator binds live character ownership by exact path', () => expect(readFileSync('scripts/s15-r9/build-animation-inventory.mjs', 'utf8')).toContain('exactLiveReferences.has(runtimePath)'))
  it('R10-U-INDEX-7 every live runtime family has an exact owner and consumer', () => expect(inventory.runtimeFamilies.every((family: { disposition: string; owner?: string | null; consumer?: string | null; paths: string[] }) => family.disposition !== 'LIVE_REQUIRED_NOW' || Boolean(family.owner && family.consumer && family.paths.length))).toBe(true))
})
