import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import type { ArtAsset, ArtPackIndexEntry, ArtPackManifest, AssetProbe } from '../../src/adventure/types'

export const placeholderManifest = JSON.parse(
  readFileSync(new URL('../../public/art-packs/placeholder/manifest.json', import.meta.url), 'utf8'),
) as ArtPackManifest

export function candidateFixture(id = 'lead-candidate', label = 'Lead candidate') {
  const manifest = structuredClone(placeholderManifest)
  manifest.id = id
  manifest.label = label
  manifest.status = 'LEAD_SELECTED'
  rewritePaths(manifest, '/art-packs/placeholder/', `/art-packs/${id}/`)
  const indexEntry: ArtPackIndexEntry = { id, label, status: 'LEAD_SELECTED' }
  return { manifest, indexEntry }
}

export const exactProbe: AssetProbe = async (asset: ArtAsset) => ({
  status: 'LOADED',
  width: asset.width,
  height: asset.height,
  contentFingerprint: createHash('sha256').update(asset.src).digest('hex'),
})

function rewritePaths(value: unknown, from: string, to: string): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item) => rewritePaths(item, from, to))
    return
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'src' && typeof child === 'string') (value as Record<string, unknown>)[key] = child.replace(from, to)
    else rewritePaths(child, from, to)
  }
}
