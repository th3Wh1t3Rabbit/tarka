import type { ArtAsset } from './types'

const ROOT = '/art-packs/production/files/included/core-v2.1/forms'

export const FORM_ART = {
  BLANK: { src: `${ROOT}/ticket_blank.png`, width: 20, height: 26, sha256: '7c7716134849e21bfd4c0f31490be27c3357c02cbd2970412aed43f5abba2da5' },
  SIGNED_DOODLED: { src: `${ROOT}/ticket_filled.png`, width: 32, height: 24, sha256: 'ee46c8764507cc7d1e3f9d631ddd4cf8bd5307582da3fbbf0d4ea68ccfee3ebb' },
  APPROVED_OK: { src: `${ROOT}/ticket_stamped_OK.png`, width: 32, height: 24, sha256: '802abf59015f5a40cc7ac2ea95cf2a5ae95121455706ac20491eb02fd3d2f77f' },
} as const satisfies Record<string, ArtAsset & { sha256: string }>

export function formAsset(state: keyof typeof FORM_ART): ArtAsset {
  const { src, width, height } = FORM_ART[state]
  return { src, width, height }
}
