import { describe, expect, it } from 'vitest'
import { inspectArtPackCandidate, validateArtPackManifest } from '../../src/adventure/artPack'
import type { AssetProbe } from '../../src/adventure/types'
import { candidateFixture, exactProbe, placeholderManifest } from '../fixtures/art-pack'

describe('ArtPackManifest v2 integrity diagnostics', () => {
  it('activates a complete candidate whose animation bytes have genuinely distinct fingerprints', async () => {
    const { manifest, indexEntry } = candidateFixture()
    const result = await inspectArtPackCandidate(manifest.id, indexEntry, manifest, exactProbe, placeholderManifest)
    expect(result.manifest?.id).toBe(manifest.id)
    expect(result.diagnostics.disposition).toBe('COMPLETE_LEAD_SELECTED')
    expect(result.diagnostics.requiredSlots.every(({ status }) => status === 'PASS')).toBe(true)
    expect(result.diagnostics.invalidSlots).toEqual([])
  })

  it.each([
    ['Rook walk', (manifest: ReturnType<typeof candidateFixture>['manifest']) => [manifest.characters.rook.animations.walkEast!.frames[0]!.src, manifest.characters.rook.animations.walkEast!.frames[1]!.src], ['characters.rook.walkEast.frame1', 'characters.rook.walkEast.frame2']],
    ['Rook talk', (manifest: ReturnType<typeof candidateFixture>['manifest']) => [manifest.characters.rook.animations.talkClosed!.frames[0]!.src, manifest.characters.rook.animations.talkOpen!.frames[0]!.src], ['characters.rook.talkClosed.frame1', 'characters.rook.talkOpen.frame1']],
    ['Mr. Index talk', (manifest: ReturnType<typeof candidateFixture>['manifest']) => [manifest.characters.mrIndex.animations.talkClosed!.frames[0]!.src, manifest.characters.mrIndex.animations.talkOpen!.frames[0]!.src], ['characters.mrIndex.talkClosed.frame1', 'characters.mrIndex.talkOpen.frame1']],
  ] as const)('rejects path-distinct but content-identical %s states', async (_label, select, expectedSlots) => {
    const { manifest, indexEntry } = candidateFixture()
    const duplicatePaths = new Set(select(manifest))
    const duplicateFingerprint = 'a'.repeat(64)
    const probe: AssetProbe = async (asset) => {
      const result = await exactProbe(asset)
      return result.status === 'LOADED' && duplicatePaths.has(asset.src) ? { ...result, contentFingerprint: duplicateFingerprint } : result
    }
    const result = await inspectArtPackCandidate(manifest.id, indexEntry, manifest, probe, placeholderManifest)
    expect(result.manifest).toBeNull()
    expect(result.diagnostics.disposition).toBe('INVALID_REQUIRED_ASSETS')
    expect(result.diagnostics.invalidSlots).toEqual(expect.arrayContaining([...expectedSlots]))
    for (const semanticSlot of expectedSlots) {
      expect(result.diagnostics.requiredSlots.find((slot) => slot.semanticSlot === semanticSlot)).toMatchObject({ status: 'DUPLICATE_CONTENT', contentFingerprint: duplicateFingerprint })
    }
  })

  it('rejects duplicate content among installed optional Rook walk frames', async () => {
    const { manifest, indexEntry } = candidateFixture()
    const frame = manifest.characters.rook.animations.walkEast!.frames[0]!
    manifest.characters.rook.animations.walkEast!.frames.push(
      { ...frame, src: '/art-packs/lead-candidate/characters/rook-walk-3.svg' },
      { ...frame, src: '/art-packs/lead-candidate/characters/rook-walk-4.svg' },
    )
    const duplicateFingerprint = 'b'.repeat(64)
    const optionalPaths = new Set(manifest.characters.rook.animations.walkEast!.frames.slice(2).map(({ src }) => src))
    const probe: AssetProbe = async (asset) => {
      const result = await exactProbe(asset)
      return result.status === 'LOADED' && optionalPaths.has(asset.src) ? { ...result, contentFingerprint: duplicateFingerprint } : result
    }
    const result = await inspectArtPackCandidate(manifest.id, indexEntry, manifest, probe, placeholderManifest)
    expect(result.manifest).toBeNull()
    expect(result.diagnostics.disposition).toBe('INVALID_REQUIRED_ASSETS')
    expect(result.diagnostics.invalidSlots).toEqual(expect.arrayContaining(['characters.rook.walkEast.frame3', 'characters.rook.walkEast.frame4']))
  })

  it.each([
    ['missing file', 'MISSING'],
    ['decode failure', 'DECODE_FAILED'],
  ] as const)('fails closed for a required %s and identifies its semantic slot', async (_label, failure) => {
    const { manifest, indexEntry } = candidateFixture()
    const failedPath = manifest.cursor.crosshair.src
    const probe: AssetProbe = async (asset) => asset.src === failedPath
      ? { status: failure, detail: `Fixture ${failure}` }
      : exactProbe(asset)
    const result = await inspectArtPackCandidate(manifest.id, indexEntry, manifest, probe, placeholderManifest)
    expect(result.manifest).toBeNull()
    expect(result.diagnostics.disposition).toBe('INVALID_REQUIRED_ASSETS')
    expect(result.diagnostics.invalidSlots).toContain('cursor.crosshair')
    expect(result.diagnostics.requiredSlots.find(({ semanticSlot }) => semanticSlot === 'cursor.crosshair')).toMatchObject({ status: failure, actualDimensions: null })
  })

  it('rejects decoded dimensions that disagree with manifest dimensions', async () => {
    const { manifest, indexEntry } = candidateFixture()
    const failedPath = manifest.inventory['blank-terminal-authorization-form'].src
    const probe: AssetProbe = async (asset) => {
      const result = await exactProbe(asset)
      return asset.src === failedPath && result.status === 'LOADED' ? { ...result, width: 480, height: 180 } : result
    }
    const result = await inspectArtPackCandidate(manifest.id, indexEntry, manifest, probe, placeholderManifest)
    const diagnostic = result.diagnostics.requiredSlots.find(({ semanticSlot }) => semanticSlot === 'inventory.blank-terminal-authorization-form')
    expect(result.manifest).toBeNull()
    expect(diagnostic).toMatchObject({ status: 'DIMENSION_MISMATCH', actualDimensions: { width: 480, height: 180 } })
  })

  it('rejects declared and animation dimensions that disagree with the fixed slot contract', async () => {
    const { manifest, indexEntry } = candidateFixture()
    manifest.characters.rook.animations.walkEast!.frameWidth = 49
    const result = await inspectArtPackCandidate(manifest.id, indexEntry, manifest, exactProbe, placeholderManifest)
    expect(result.manifest).toBeNull()
    expect(result.diagnostics.invalidSlots).toContain('characters.rook.walkEast.frame1')
    expect(result.diagnostics.requiredSlots.find(({ semanticSlot }) => semanticSlot === 'characters.rook.walkEast.frame1')?.status).toBe('DIMENSION_MISMATCH')
  })

  it.each([
    ['id', (entry: ReturnType<typeof candidateFixture>['indexEntry']) => { entry.id = 'different-pack' }],
    ['label', (entry: ReturnType<typeof candidateFixture>['indexEntry']) => { entry.label = 'Different label' }],
    ['status', (entry: ReturnType<typeof candidateFixture>['indexEntry']) => { entry.status = 'AUDITION_EMPTY' }],
  ])('rejects an index/manifest %s mismatch without probing assets', async (_field, mutate) => {
    const { manifest, indexEntry } = candidateFixture()
    mutate(indexEntry)
    let probes = 0
    const result = await inspectArtPackCandidate(manifest.id, indexEntry, manifest, async (asset) => { probes += 1; return exactProbe(asset) }, placeholderManifest)
    expect(result.manifest).toBeNull()
    expect(result.diagnostics.disposition).toBe('INVALID_INDEX_MANIFEST_MISMATCH')
    expect(result.diagnostics.indexManifestConsistent).toBe(false)
    expect(probes).toBe(0)
  })

  it('accepts intentionally absent optional layers and optional walk frames', async () => {
    const { manifest, indexEntry } = candidateFixture()
    manifest.scenes['records-office'].midgroundLayers = []
    manifest.scenes['records-office'].foregroundLayers = []
    const result = await inspectArtPackCandidate(manifest.id, indexEntry, manifest, exactProbe, placeholderManifest)
    expect(result.diagnostics.disposition).toBe('COMPLETE_LEAD_SELECTED')
    expect(result.diagnostics.optionalSlots.some(({ status }) => status === 'OPTIONAL_ABSENT')).toBe(true)
  })

  it('lists a declared optional decode failure without claiming a complete pack', async () => {
    const { manifest, indexEntry } = candidateFixture()
    const optionalPath = manifest.scenes['records-office'].midgroundLayers[0]!.asset.src
    const probe: AssetProbe = async (asset) => asset.src === optionalPath
      ? { status: 'DECODE_FAILED', detail: 'Optional fixture cannot decode.' }
      : exactProbe(asset)
    const result = await inspectArtPackCandidate(manifest.id, indexEntry, manifest, probe, placeholderManifest)
    expect(result.manifest?.id).toBe(manifest.id)
    expect(result.manifest?.scenes['records-office'].midgroundLayers).toHaveLength(0)
    expect(result.diagnostics.disposition).toBe('LEAD_SELECTED_WITH_OPTIONAL_OMISSIONS')
    expect(result.diagnostics.fallbackActive).toBe(true)
    expect(result.diagnostics.invalidSlots).toContain('scenes.records-office.midgroundLayers.records-atmosphere')
  })

  it('requires distinct closed/open talking assets for both characters', async () => {
    const { manifest, indexEntry } = candidateFixture()
    manifest.characters.mrIndex.animations.talkOpen!.frames[0] = structuredClone(manifest.characters.mrIndex.animations.talkClosed!.frames[0]!)
    const result = await inspectArtPackCandidate(manifest.id, indexEntry, manifest, exactProbe, placeholderManifest)
    expect(result.manifest).toBeNull()
    expect(result.diagnostics.invalidSlots).toContain('characters.mrIndex.talkOpen.frame1')
  })

  it.each([
    '/art-packs/lead-candidate/%2e%2e/placeholder/cursor/crosshair.svg',
    '/art-packs/lead-candidate/%2Fplaceholder/cursor/crosshair.svg',
    '/art-packs/placeholder/cursor/crosshair.svg',
  ])('rejects a noncanonical or non-owned resource path: %s', (sourcePath) => {
    const { manifest } = candidateFixture()
    manifest.cursor.crosshair.src = sourcePath
    expect(validateArtPackManifest(manifest)).toBe(false)
  })

  it.each([
    ['custom animation', (manifest: ReturnType<typeof candidateFixture>['manifest']) => { manifest.characters.rook.animations.custom = structuredClone(manifest.characters.rook.animations.idle!) }],
    ['custom prop state', (manifest: ReturnType<typeof candidateFixture>['manifest']) => { manifest.props.penStand!.states.custom = structuredClone(manifest.props.penStand!.default) }],
    ['custom inventory resource', (manifest: ReturnType<typeof candidateFixture>['manifest']) => { (manifest.inventory as Record<string, unknown>).custom = structuredClone(manifest.inventory['blank-terminal-authorization-form']) }],
  ])('rejects an unsupported %s so every declared resource remains diagnosable', (_name, mutate) => {
    const { manifest } = candidateFixture()
    mutate(manifest)
    expect(validateArtPackManifest(manifest)).toBe(false)
  })

  it.each([
    ['missing required placements', (manifest: ReturnType<typeof candidateFixture>['manifest']) => { manifest.scenes['records-office'].propPlacements = [] }],
    ['duplicate placement', (manifest: ReturnType<typeof candidateFixture>['manifest']) => { manifest.scenes['records-office'].propPlacements.push(structuredClone(manifest.scenes['records-office'].propPlacements[0]!)) }],
    ['off-plane placement', (manifest: ReturnType<typeof candidateFixture>['manifest']) => { manifest.scenes['records-office'].propPlacements[0]!.x = 961 }],
    ['off-plane anchor', (manifest: ReturnType<typeof candidateFixture>['manifest']) => { manifest.scenes['records-office'].characterAnchors.rookStart!.y = 361 }],
    ['unbounded scale', (manifest: ReturnType<typeof candidateFixture>['manifest']) => { manifest.characters.rook.scale = 5 }],
  ])('rejects %s before scene alignment can report complete', (_name, mutate) => {
    const { manifest } = candidateFixture()
    mutate(manifest)
    expect(validateArtPackManifest(manifest)).toBe(false)
  })

  it.each([
    ['duplicate walk frames', (manifest: ReturnType<typeof candidateFixture>['manifest']) => { manifest.characters.rook.animations.walkEast!.frames[1] = structuredClone(manifest.characters.rook.animations.walkEast!.frames[0]!) }],
    ['walk below 6 FPS', (manifest: ReturnType<typeof candidateFixture>['manifest']) => { manifest.characters.rook.animations.walkEast!.fps = 5 }],
    ['talk above 10 FPS', (manifest: ReturnType<typeof candidateFixture>['manifest']) => { manifest.characters.mrIndex.animations.talkOpen!.fps = 11 }],
  ])('rejects %s', (_name, mutate) => {
    const { manifest } = candidateFixture()
    mutate(manifest)
    expect(validateArtPackManifest(manifest)).toBe(false)
  })
})
