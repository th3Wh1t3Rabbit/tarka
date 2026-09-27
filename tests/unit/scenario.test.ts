import { describe, expect, it } from 'vitest'
import { validateScenario } from '../../src/game/scenario/schema'
import { syntheticScenario } from '../../src/game/scenario/synthetic'
import { canonicalScenarioJson, hashScenario } from '../../src/game/solver/hash'
import { compileSyntheticWorld } from '../../src/game/world/model'
import { getPassageSegments } from '../../src/game/world/layout'

describe('synthetic scenario boundary', () => {
  it('validates the versioned synthetic fixture and its exact provenance', () => {
    expect(validateScenario(syntheticScenario)).toBe(true)
    expect(syntheticScenario.historicalWindow).toBeNull()
    expect(syntheticScenario.historicalCutoff).toBeNull()
    expect(syntheticScenario.provenance).toEqual({
      source: 'synthetic-fixture',
      note: 'Fictional calibration data; no external data or market claim.',
      externalData: false,
    })
  })

  it('accounts for the full 17-unit conversion and archive accumulation', () => {
    const conversion = syntheticScenario.events.find(({ id }) => id === 'evt-prism-conversion')
    const accumulation = syntheticScenario.events.find(({ id }) => id === 'evt-archive-accumulation')
    expect(conversion?.inputs).toEqual([{ asset: 'GOLD', amount: 17 }])
    expect(conversion?.outputs).toEqual([{ asset: 'CYAN', amount: 11 }, { asset: 'VIOLET', amount: 6 }])
    expect(conversion?.outputs.reduce((sum, output) => sum + output.amount, 0)).toBe(17)
    expect(accumulation?.inputs).toEqual(conversion?.outputs)
    expect(accumulation?.outputs).toEqual(conversion?.outputs)
  })

  it('produces a stable, key-order-independent scenario hash', () => {
    expect(hashScenario(syntheticScenario)).toBe('fnv1a64:4dc0ea9b683f34ad')
    const reversedTopLevel = Object.fromEntries(Object.entries(syntheticScenario).reverse())
    expect(canonicalScenarioJson(reversedTopLevel as typeof syntheticScenario)).toBe(canonicalScenarioJson(syntheticScenario))
    expect(hashScenario(reversedTopLevel as typeof syntheticScenario)).toBe(hashScenario(syntheticScenario))
  })

  it('compiles the complete procedural world without historical claims', () => {
    const world = compileSyntheticWorld(syntheticScenario)
    expect(world.proceduralOnly).toBe(true)
    expect(world.nodes).toHaveLength(7)
    expect(world.passages).toHaveLength(7)
  })

  it('keeps renderer-facing world data detached from canonical truth', () => {
    const truthBefore = structuredClone(syntheticScenario)
    const world = compileSyntheticWorld(syntheticScenario)
    world.nodes[0]!.position[0] = 999
    world.passages[0]!.to = 'archive'
    expect(syntheticScenario).toEqual(truthBefore)
  })

  it('derives rendered passage layout from the world description', () => {
    const world = compileSyntheticWorld(syntheticScenario)
    const original = getPassageSegments(world)
    const moved = structuredClone(world)
    const threshold = moved.nodes.find((node) => node.id === 'threshold')
    if (!threshold) throw new Error('fixture threshold missing')
    threshold.position = [3, 0, 1]
    const changed = getPassageSegments(moved)
    expect(changed[0]?.center).not.toEqual(original[0]?.center)
    expect(changed[0]?.rotationY).not.toEqual(original[0]?.rotationY)
  })

  it.each([
    { ...syntheticScenario, synthetic: false },
    { ...syntheticScenario, schemaVersion: '0.0.0' },
    { ...syntheticScenario, events: [null, ...syntheticScenario.events.slice(1)] },
    { ...syntheticScenario, events: syntheticScenario.events.map((event, index) => index === 1 ? { ...event, id: syntheticScenario.events[0]?.id } : event) },
    { ...syntheticScenario, events: syntheticScenario.events.map((event, index) => index === 1 ? { ...event, timestamp: -1 } : event) },
    { ...syntheticScenario, events: syntheticScenario.events.map((event) => event.id === 'evt-prism-conversion' ? { ...event, outputs: [{ asset: 'CYAN', amount: 10 }, { asset: 'VIOLET', amount: 6 }] } : event) },
    { ...syntheticScenario, entities: [syntheticScenario.entities[0], ...syntheticScenario.entities.slice(0, -1)] },
    { ...syntheticScenario, balances: syntheticScenario.balances.map((balance) => balance.entity === 'archive' && balance.phase === 'after' ? { ...balance, balances: [{ asset: 'CYAN', amount: 11 }, { asset: 'VIOLET', amount: 5 }] } : balance) },
    { ...syntheticScenario, evidence: syntheticScenario.evidence.map((evidence, index) => index === 1 ? { ...evidence, id: syntheticScenario.evidence[0]?.id } : evidence) },
    { ...syntheticScenario, theoryOptions: { ...syntheticScenario.theoryOptions, route: [syntheticScenario.theoryOptions.route[0], syntheticScenario.theoryOptions.route[0]] } },
    { ...syntheticScenario, provenance: { source: 'synthetic-fixture', note: '', externalData: false } },
    { ...syntheticScenario, evidence: syntheticScenario.evidence.map((evidence, index) => index === 0 ? { ...evidence, claim: 'CREATIVE DRIFT' } : evidence) },
    { ...syntheticScenario, theoryOptions: { ...syntheticScenario.theoryOptions, route: syntheticScenario.theoryOptions.route.map((option, index) => index === 0 ? { ...option, label: 'CREATIVE DRIFT' } : option) } },
    { ...syntheticScenario, truthTimeline: syntheticScenario.truthTimeline.map((line, index) => index === 5 ? 'CREATIVE DRIFT' : line) },
  ])('rejects malformed nested records and violated truth invariants', (candidate) => {
    expect(validateScenario(candidate)).toBe(false)
  })
})
