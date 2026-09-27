export type ScreenFacing = 'LEFT' | 'RIGHT'
export type ClipFacingRule = 'NATIVE_LEFT_MIRRORABLE' | 'NATIVE_RIGHT_MIRRORABLE' | 'CAMERA_FIXED' | 'DIRECTION_FIXED'

export interface ClipFacingPolicy {
  actor: 'ROOK' | 'MR_INDEX'
  clipId: string
  rule: ClipFacingRule
  nativeFacing: ScreenFacing | 'CAMERA' | 'EXPLICIT'
  mirrorHorizontal: boolean
}

/** Clip-family facing owner. Camera and explicitly directed glances never mirror. */
export function clipFacingPolicy(actor: 'ROOK' | 'MR_INDEX', clipId: string, facing: ScreenFacing): ClipFacingPolicy {
  const fixedCamera = clipId.includes('.camera') || clipId.includes('camera-')
  const fixedDirection = clipId.includes('.glance-left') || clipId.includes('.glance-right')
  if (fixedCamera) return { actor, clipId, rule: 'CAMERA_FIXED', nativeFacing: 'CAMERA', mirrorHorizontal: false }
  if (fixedDirection) return { actor, clipId, rule: 'DIRECTION_FIXED', nativeFacing: 'EXPLICIT', mirrorHorizontal: false }
  if (actor === 'MR_INDEX') return { actor, clipId, rule: 'NATIVE_LEFT_MIRRORABLE', nativeFacing: 'LEFT', mirrorHorizontal: facing === 'RIGHT' }
  return { actor, clipId, rule: 'NATIVE_RIGHT_MIRRORABLE', nativeFacing: 'RIGHT', mirrorHorizontal: facing === 'LEFT' }
}
