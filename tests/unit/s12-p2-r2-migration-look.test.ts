import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { importComposition, LEGACY_LAYOUT6_MIGRATION, readLayoutLibrary, referenceComposition, sealComposition } from '../../src/adventure/sceneComposition'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import { buildRuntimeSession } from '../../src/adventure/runtimeSession'
import { productionComposition } from '../../src/adventure/layout6Production'
import { windowGameBox } from '../../src/adventure/interactionGeometry'

const sha256 = async (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

describe('S12-P2-R2 legacy hotspot migration and look center', () => {
  it('rejects an arbitrary hotspot edit and migrates only the exact Layout6 fixture', async () => {
    const sealed = await sealComposition(referenceComposition(), sha256)
    const edited = structuredClone(sealed.composition!)
    edited.hotspots[0]!.polygon = '0,0 1,0 1,1 0,1'
    expect(importComposition(edited).error).toMatch(/read-only/)
    const raw = readFileSync('tests/fixtures/s12-p2-layout6-library.json')
    expect(createHash('sha256').update(raw).digest('hex')).toBe(LEGACY_LAYOUT6_MIGRATION.librarySha256)
    const library = readLayoutLibrary({ getItem: () => raw.toString('utf8'), setItem() {}, removeItem() {} })
    const layout = library.versions.find((version) => version.id === LEGACY_LAYOUT6_MIGRATION.versionId)
    expect(layout?.composition.hotspots.some((hotspot) => hotspot.id === 'rotunda-exit')).toBe(false)
    expect(layout?.composition.hotspots.some((hotspot) => hotspot.id === 'window')).toBe(true)
    expect(layout?.composition.entities.find((item) => item.id === 'desk')).toMatchObject({ x: 172, y: 123, visible: true })
  })

  it('looks at the object center and walks only when outside that range', () => {
    const session = buildRuntimeSession(productionComposition)
    const cabinet = session.targets['official-case-file-cabinet']!
    const fresh = createInitialAdventureState({ skipIntro: true, session })
    const far = adventureReducer(adventureReducer({ ...fresh, rookPosition: { x: cabinet.centerX - 400, y: 350 } }, { type: 'SELECT_VERB', verb: 'LOOK_AT' }), { type: 'INTERACT', targetId: 'official-case-file-cabinet' })
    expect(far.walk).not.toBeNull()
    expect(far.walk?.to.x).not.toBe(cabinet.centerX)
    expect(far.speech).toBeNull()
    const near = adventureReducer(adventureReducer({ ...fresh, rookPosition: { x: cabinet.centerX + 10, y: cabinet.centerY }, rookFacing: 'RIGHT' }, { type: 'SELECT_VERB', verb: 'LOOK_AT' }), { type: 'INTERACT', targetId: 'official-case-file-cabinet' })
    expect(near.walk).toBeNull()
    expect(near.rookFacing).toBe('LEFT')
    expect(near.nonblockingSpeech).not.toBeNull()
    expect(near.speech).toBeNull()
    const plate = windowGameBox(2)
    expect(session.targets.window?.centerX).toBe(plate.left + plate.width / 2)
  })
})
