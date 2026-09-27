import { describe, expect, it } from 'vitest'
import { CUE_SHEET_KEY, animationClips } from '../../src/adventure/animationCues'
import { ANIMATION_REVIEW_WORKSPACE_KEY, DEFAULT_BEAT_MS, animationReviewClips, forkCurrentGameProject, normalizeReviewProject, readReviewWorkspace, replaceTimeline, reviewClipById, reviewProjectDiff, saveReviewVersion, timelineFor, writeReviewDraft } from '../../src/adventure/animationReview'
import type { LayoutStore } from '../../src/adventure/sceneComposition'

function memoryStore(): LayoutStore {
  const values = new Map<string, string>()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) }, removeItem: (key) => { values.delete(key) } }
}

describe('S17-P2-R1 isolated animation review workspace', () => {
  it('defines one beat as 500 ms and seeds the fork from current game bindings plus the complete review catalog', () => {
    const project = forkCurrentGameProject('2026-09-26T00:00:00.000Z')
    expect(DEFAULT_BEAT_MS).toBe(500)
    expect(project.baseSheet).toEqual(project.workingSheet)
    expect(project.source.clipCatalog.map((clip) => clip.id)).toEqual(animationReviewClips().map((clip) => clip.id))
    expect(project.source.clipCatalog.map((clip) => clip.id)).toEqual(expect.arrayContaining(animationClips().map((clip) => clip.id)))
    expect(project.source.clipCatalog.length).toBeGreaterThan(animationClips().length)
    expect(reviewClipById('rook.think.raise')?.reviewAvailability).toBe('REVIEW_OPTION')
    expect(animationClips().some((clip) => clip.id === 'rook.think.raise')).toBe(false)
    expect(project.baseSheet.cues.map((cue) => cue.clipId)).toEqual(expect.arrayContaining(['rook.walk', 'rook.talk', 'rook.reach.neutral', 'arthur.document', 'arthur.point', 'arthur.camera-talk']))
    expect(project.timelines.length).toBeGreaterThan(10)
  })

  it('stores drafts and immutable versions only under the review key', () => {
    const store = memoryStore()
    const workspace = readReviewWorkspace(store)
    const written = writeReviewDraft(store, workspace, workspace.draft)
    const saved = saveReviewVersion(store, written, written.draft, 'Principal experiment')
    expect(saved.versions).toHaveLength(1)
    expect(store.getItem(ANIMATION_REVIEW_WORKSPACE_KEY)).toContain('Principal experiment')
    expect(store.getItem(CUE_SHEET_KEY)).toBeNull()
  })

  it('records per-character segment changes as a diff without changing the baseline', () => {
    const project = forkCurrentGameProject('2026-09-26T00:00:00.000Z')
    const originalBase = JSON.stringify(project.baseSheet)
    const timeline = timelineFor(project, 'current:rook-talk')
    const next = replaceTimeline(project, { ...timeline, tracks: { ...timeline.tracks, rook: [...(timeline.tracks.rook ?? []), { id: 'chin-talk', kind: 'SEQUENCE', actorId: 'rook', clipId: 'rook.talk.think', frameIndex: 0, durationMs: 2000, fps: 8, mode: 'LOOP', note: 'Keep chin pose while talking.' }] } })
    expect(reviewProjectDiff(next).timelineTrackChanges).toBe(1)
    expect(reviewProjectDiff(next).changedMomentIds).toContain('current:rook-talk')
    expect(JSON.stringify(next.baseSheet)).toBe(originalBase)
  })

  it('keeps the thinking mouth cycle entirely inside the hand-to-chin pose', () => {
    const thinking = animationClips().find((clip) => clip.id === 'rook.talk.think')!
    expect(thinking.frames).toEqual([expect.stringMatching(/rook_thinking_chin\.png$/), expect.stringMatching(/rook_talk_thinking\.png$/)])
    expect(thinking.intendedUse).toContain('hand remains at the chin')
  })

  it('upgrades an older v3 review snapshot to the complete isolated catalog on import', () => {
    const project = forkCurrentGameProject('2026-09-26T00:00:00.000Z')
    project.source.clipCatalog = project.source.clipCatalog.filter((clip) => clip.reviewAvailability === 'CURRENT_GAME')
    const normalized = normalizeReviewProject(project)!
    expect(normalized.source.clipCatalog.some((clip) => clip.id === 'rook.think.raise')).toBe(true)
    expect(normalized.source.clipCatalog.some((clip) => clip.id === 'arthur.stamp-talk')).toBe(true)
  })

  it('offers generalized pose-preserving talk controls only for verified frame pairs', () => {
    const supported = [
      'rook.talk', 'rook.talk.think', 'rook.talk.arms', 'rook.talk.document', 'rook.talk.item',
      'rook.talk.inspect', 'rook.talk.emphasis', 'rook.talk.shrug', 'rook.talk.proud', 'rook.talk.point',
      'arthur.talk', 'arthur.point', 'arthur.document', 'arthur.document-adjust',
      'arthur.present', 'arthur.sardonic', 'arthur.slouch', 'arthur.stamp-talk',
    ]
    for (const id of supported) expect(reviewClipById(id)?.poseTalkControl, id).toBeDefined()
    expect(reviewClipById('rook.talk.smirk')?.poseTalkControl).toBeUndefined()
    expect(reviewClipById('arthur.camera-talk')?.poseTalkControl).toBeUndefined()
    expect(reviewClipById('arthur.explain')?.poseTalkControl).toBeUndefined()
    expect(reviewClipById('arthur.stamp-talk')?.frames).toEqual([
      expect.stringMatching(/archivist_stamp_up\.png$/),
      expect.stringMatching(/archivist_stamp_up_talk\.png$/),
    ])
  })
})
