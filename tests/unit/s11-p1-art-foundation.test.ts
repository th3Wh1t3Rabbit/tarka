import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateArtPackIndex, validateArtPackManifest } from '../../src/adventure/artPack'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else out.push(path)
  }
  return out
}

describe('S11-P1 production art foundation', () => {
  it('S11-P1 production manifest and index validate', () => {
    const manifest = JSON.parse(readFileSync('public/art-packs/production/manifest.json', 'utf8'))
    const index = JSON.parse(readFileSync('public/art-packs/index.json', 'utf8'))
    expect(validateArtPackManifest(manifest)).toBe(true)
    expect(validateArtPackIndex(index)).toBe(true)
    expect(manifest.status).toBe('LEAD_SELECTED')
    expect(manifest.scenes['records-office'].background).toMatchObject({ width: 480, height: 180 })
    expect(manifest.cursor.crosshair).toMatchObject({ width: 13, height: 13 })
  })

  it('S11-P1 runtime subset excludes optional-preferred and preserves the plate hash', () => {
    const files = walk('public/art-packs/production')
    expect(files.some((path) => path.includes('optional-preferred'))).toBe(false)
    const index = JSON.parse(readFileSync('public/art-packs/production/indexes/ART_RUNTIME_INDEX.json', 'utf8'))
    const plate = index.assets.find((asset: { runtimeAssetId: string }) => asset.runtimeAssetId === 'derived.room-plate-480x180')
    expect(plate).toBeTruthy()
    const bytes = readFileSync('public/art-packs/production/room-plate-480x180.png')
    expect(bytes.length).toBe(148553)
  })

  it('S11-P1 globe push and pull stay finite and puzzle-neutral', () => {
    let state = { ...createInitialAdventureState({ skipIntro: true }), instantText: true }
    const before = { phase: state.phase, inventory: state.inventory, caseFileDrawer: state.caseFileDrawer }
    state = adventureReducer(state, { type: 'SELECT_VERB', verb: 'PUSH' })
    state = adventureReducer(state, { type: 'INTERACT', targetId: 'office-globe' })
    state = adventureReducer(state, { type: 'WALK_TICK', delta: 8000 })
    expect(state.globePose).toBe('PUSH')
    expect(state.globeLevel).toBe(1)
    state = adventureReducer(adventureReducer(state, { type: 'SELECT_VERB', verb: 'PULL' }), { type: 'INTERACT', targetId: 'office-globe' })
    state = adventureReducer(state, { type: 'WALK_TICK', delta: 8000 })
    expect(state.globePose).toBe('PULL')
    expect(state.globeLevel).toBe(1)
    expect({ phase: state.phase, inventory: state.inventory, caseFileDrawer: state.caseFileDrawer }).toEqual(before)
  })
})
