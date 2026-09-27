import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { inspectArtPackCandidate, validateArtPackManifest } from '../../src/adventure/artPack'
import { globeFrame, globeGameBox, globeSettleFrame } from '../../src/adventure/globeVisual'
import { containFits, CURSOR_SOURCE_BOX, INVENTORY_RENDER_BOX, renderContractFailure, slotRenderContract } from '../../src/adventure/renderContract'
import { importComposition, referenceComposition, sealComposition } from '../../src/adventure/sceneComposition'
import { inventoryVisibleLabel } from '../../src/adventure/inventoryLabels'
import type { ArtAsset, AssetProbe } from '../../src/adventure/types'

const sha256 = async (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const exactProbe: AssetProbe = async (asset: ArtAsset) => ({ status: 'LOADED', width: asset.width, height: asset.height, contentFingerprint: createHash('sha256').update(asset.src).digest('hex') })

describe('S11-P1-R1 production fit contracts', () => {
  it('keeps source dimensions and the render box independent', () => {
    const contract = slotRenderContract({ packId: 'production', kind: 'inventory', asset: { width: 48, height: 48 }, placeholder: { width: 32, height: 24 } })
    expect(contract?.fitPolicy).toBe('NEAREST_CONTAIN')
    expect(contract?.renderBox).toEqual(INVENTORY_RENDER_BOX)
    expect(contract?.renderBox).not.toEqual({ width: 48, height: 48 })
    expect(containFits({ width: 48, height: 48 }, INVENTORY_RENDER_BOX)).toBe(true)
    expect(renderContractFailure(contract, { width: 48, height: 48 }, { width: 48, height: 48 })).toBeNull()
    expect(renderContractFailure(contract, { width: 48, height: 48 }, { width: 47, height: 48 })).toMatch(/Decoded/)
    expect(slotRenderContract({ packId: 'production', kind: 'character', asset: { width: 48, height: 88 }, placeholder: { width: 48, height: 88 } })).toBeNull()
  })

  it('requires the production cursor to stay 13 by 13', () => {
    const contract = slotRenderContract({ packId: 'production', kind: 'cursor', asset: { width: 16, height: 16 }, placeholder: { width: 16, height: 16 } })
    expect(contract?.renderBox).toEqual(CURSOR_SOURCE_BOX)
    expect(renderContractFailure(contract, { width: 16, height: 16 }, { width: 16, height: 16 })).toMatch(/exact render contract/)
  })

  it('accepts the production pack under the separate render contract', async () => {
    const manifest = JSON.parse(readFileSync('public/art-packs/production/manifest.json', 'utf8'))
    const index = JSON.parse(readFileSync('public/art-packs/index.json', 'utf8'))
    expect(validateArtPackManifest(manifest)).toBe(true)
    const entry = index.packs.find((pack: { id: string }) => pack.id === 'production')
    const placeholder = JSON.parse(readFileSync('public/art-packs/placeholder/manifest.json', 'utf8'))
    const result = await inspectArtPackCandidate('production', entry, manifest, exactProbe, placeholder)
    expect(result.diagnostics.disposition).toBe('COMPLETE_LEAD_SELECTED')
    const inventory = result.diagnostics.requiredSlots.find((slot) => slot.semanticSlot === 'inventory.hammer')
    expect(inventory?.fitPolicy).toBe('NEAREST_CONTAIN')
    expect(inventory?.renderBox).toEqual(INVENTORY_RENDER_BOX)
    expect(inventory?.renderBox).not.toEqual(inventory?.declaredDimensions)
  })

  it('gives every globe level a distinct still and keeps the sprite above Rook at contact', () => {
    const frames = [
      globeFrame('IDLE', 0),
      globeFrame('PUSH', 1), globeFrame('PUSH', 2), globeFrame('PUSH', 3),
      globeFrame('PULL', 1), globeFrame('PULL', 2), globeFrame('PULL', 3),
      globeSettleFrame(),
    ]
    expect(new Set(frames).size).toBe(frames.length)
    const atContact = globeGameBox(280 - 88 * 2)
    expect(atContact.y + atContact.height).toBeLessThanOrEqual(280 - 88 * 2)
  })

  it('round-trips the reference composition and rejects a hotspot edit', async () => {
    const sealed = await sealComposition(referenceComposition(), sha256)
    expect(sealed.error).toBeNull()
    const again = importComposition(JSON.parse(JSON.stringify(sealed.composition)))
    expect(again.error).toBeNull()
    const resealed = await sealComposition(again.composition!, sha256)
    expect(resealed.composition?.contentSha256).toBe(sealed.composition?.contentSha256)
    const edited = structuredClone(sealed.composition!)
    edited.hotspots[0]!.polygon = '0,0 1,0 1,1 0,1'
    expect(importComposition(edited).error).toMatch(/read-only/)
  })

  it('uses short inventory labels without character columns', () => {
    expect(inventoryVisibleLabel('broken feather pen')).toBe('broken pen')
    expect(inventoryVisibleLabel('Euler case file').includes('\n')).toBe(false)
    const css = readFileSync('src/styles/a0.css', 'utf8')
    expect(css).toMatch(/\.inventory-slot img \{ width: calc\(24px \* var\(--a0-scale, 1\)\); height: calc\(24px \* var\(--a0-scale, 1\)\); max-width: none; max-height: none; object-fit: contain;/)
    expect(css).toMatch(/\.provisional-ribbon, \.semantic-performance-label \{ display: none; \}/)
  })
})
