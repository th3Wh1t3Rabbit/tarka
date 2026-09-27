import { useEffect, useState } from 'react'
import { performanceFrame, resolvePerformance, type PerformanceProfile, type PerformanceRequest } from '../adventure/performanceCatalog'
import { publicObjectName } from '../controller/content/adapter'
import type { CharacterId } from '../adventure/semanticCatalog'

/** Callers request intent; neither names nor frame counts are baked in. */
export function PerformancePortrait({ profile, character, request, revealing = false, reduced = false }: { profile: PerformanceProfile; character: CharacterId; request: PerformanceRequest; revealing?: boolean; reduced?: boolean }) {
  const clip = resolvePerformance(profile, character, request)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (reduced || clip.frames.length < 2 || (clip.intention === 'SPEAK' && !revealing)) return
    const start = performance.now()
    const timer = window.setInterval(() => setElapsed(performance.now() - start), 40)
    return () => window.clearInterval(timer)
  }, [clip, reduced, revealing])
  const index = performanceFrame(clip, elapsed, revealing, reduced)
  const asset = clip.frames[index]!.asset
  const mirrored = Boolean(request.facing && request.facing !== clip.sourceFacing && clip.mirror)
  return <figure data-testid={`performance-${character}`} data-intention={request.intention} data-resolved-clip={clip.id} data-frame-count={clip.frames.length} data-frame={index}><img src={asset.src} alt={`${publicObjectName({ id: character, name: 'Rook' }, true)} placeholder performance`} width={asset.width} height={asset.height} style={{ imageRendering: 'pixelated', transform: mirrored ? 'scaleX(-1)' : undefined }} /><figcaption>{request.intention} · {profile.status} · production art late-bound</figcaption></figure>
}
