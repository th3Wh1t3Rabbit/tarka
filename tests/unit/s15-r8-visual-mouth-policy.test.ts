import { describe, expect, it } from 'vitest'
import { renderedAnimationPolicy } from '../../src/app/renderedAnimationPolicy'

const documentFrames = ['document-hold.png', 'document-talk.png']
const pointFrames = ['point.png', 'point-talk.png']

describe('S15-R8 rendered mouth-frame ownership', () => {
  it('keeps the document gaze stable while Arthur owns speech', () => {
    const talking = renderedAnimationPolicy({ actor: 'MR_INDEX', speakerOwner: 'MR_INDEX', clipId: 'arthur.document', frames: documentFrames, active: true, loop: false })
    expect(talking).toMatchObject({ frames: ['document-hold.png', 'document-hold.png', 'document-talk.png', 'document-hold.png', 'document-hold.png'], active: true, loop: true, mouthMode: 'POSE_TALK' })
    const listening = renderedAnimationPolicy({ actor: 'MR_INDEX', speakerOwner: 'ROOK', clipId: 'arthur.document', frames: documentFrames, active: true, loop: true })
    expect(listening).toMatchObject({ frames: ['document-hold.png'], active: false, loop: false, mouthMode: 'POSE_LISTEN' })
    expect(listening.identity).not.toBe(talking.identity)
  })

  it('cycles the point mouth only while Arthur owns speech', () => {
    const talking = renderedAnimationPolicy({ actor: 'MR_INDEX', speakerOwner: 'MR_INDEX', clipId: 'arthur.point', frames: pointFrames, active: true, loop: false })
    expect(talking).toMatchObject({ frames: pointFrames, active: true, loop: true, mouthMode: 'POSE_TALK' })
    const listening = renderedAnimationPolicy({ actor: 'MR_INDEX', speakerOwner: 'ROOK', clipId: 'arthur.point', frames: pointFrames, active: true, loop: true })
    expect(listening).toMatchObject({ frames: ['point.png'], active: false, loop: false, mouthMode: 'POSE_LISTEN' })
    expect(listening.identity).not.toBe(talking.identity)
  })

  it('keeps a stable identity through consecutive same-speaker deliveries', () => {
    const first = renderedAnimationPolicy({ actor: 'MR_INDEX', speakerOwner: 'MR_INDEX', clipId: 'arthur.document', frames: documentFrames, active: true, loop: false })
    const next = renderedAnimationPolicy({ actor: 'MR_INDEX', speakerOwner: 'MR_INDEX', clipId: 'arthur.document', frames: documentFrames, active: true, loop: false })
    expect(next.identity).toBe(first.identity)
  })

  it('rebases policy identity for changed speakers and final dismissal', () => {
    const arthur = renderedAnimationPolicy({ actor: 'MR_INDEX', speakerOwner: 'MR_INDEX', clipId: 'arthur.point', frames: pointFrames, active: true, loop: true })
    const rook = renderedAnimationPolicy({ actor: 'MR_INDEX', speakerOwner: 'ROOK', clipId: 'arthur.point', frames: pointFrames, active: true, loop: true })
    const dismissed = renderedAnimationPolicy({ actor: 'MR_INDEX', speakerOwner: 'NONE', clipId: 'arthur.point', frames: pointFrames, active: true, loop: true })
    expect(new Set([arthur.identity, rook.identity, dismissed.identity]).size).toBe(3)
    expect(rook.frames).toEqual(['point.png'])
    expect(dismissed.frames).toEqual(['point.png'])
  })

  it('preserves ordinary talk looping under the same production owner', () => {
    const ordinary = renderedAnimationPolicy({ actor: 'ROOK', speakerOwner: 'ROOK', clipId: 'rook.talk', frames: ['closed.png', 'open.png'], active: true, loop: true })
    expect(ordinary).toMatchObject({ frames: ['closed.png', 'open.png'], active: true, loop: true, mouthMode: 'ORDINARY_TALK' })
  })
})
