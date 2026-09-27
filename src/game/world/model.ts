import type { EntityId, SyntheticScenario } from '../scenario/schema'

export type WorldNodeId = EntityId | 'threshold'

export interface WorldNode {
  id: WorldNodeId
  role: 'origin' | 'threshold' | 'fork' | 'quiet' | 'hypothesis' | 'converter' | 'archive'
  position: [number, number, number]
  label: string
}

export interface WorldPassage {
  from: WorldNodeId
  to: WorldNodeId
  role: 'signal' | 'candidate' | 'conversion' | 'successor-cyan' | 'successor-violet'
  initiallyHidden: boolean
}

export interface WorldDescription {
  version: '2.0.0'
  scenarioId: SyntheticScenario['scenarioId']
  nodes: WorldNode[]
  passages: WorldPassage[]
  proceduralOnly: true
}

export function compileSyntheticWorld(scenario: SyntheticScenario): WorldDescription {
  const label = (id: EntityId) => scenario.entities.find((entity) => entity.id === id)?.name ?? id
  return {
    version: '2.0.0',
    scenarioId: scenario.scenarioId,
    proceduralOnly: true,
    nodes: [
      { id: 'origin', role: 'origin', position: [0, 0, 6], label: label('origin') },
      { id: 'threshold', role: 'threshold', position: [0, 0, 1], label: 'Unstable Threshold' },
      { id: 'fork', role: 'fork', position: [0, 0, -2], label: label('fork') },
      { id: 'quiet', role: 'quiet', position: [-4.4, 0, -3.4], label: label('quiet') },
      { id: 'high-activity', role: 'hypothesis', position: [4.4, 0, -3.4], label: label('high-activity') },
      { id: 'converter', role: 'converter', position: [-4.4, -1.2, -8.8], label: label('converter') },
      { id: 'archive', role: 'archive', position: [0, 0, -14.2], label: label('archive') },
    ],
    passages: [
      { from: 'origin', to: 'threshold', role: 'signal', initiallyHidden: false },
      { from: 'threshold', to: 'fork', role: 'signal', initiallyHidden: false },
      { from: 'fork', to: 'quiet', role: 'candidate', initiallyHidden: false },
      { from: 'fork', to: 'high-activity', role: 'candidate', initiallyHidden: false },
      { from: 'quiet', to: 'converter', role: 'conversion', initiallyHidden: true },
      { from: 'converter', to: 'archive', role: 'successor-cyan', initiallyHidden: true },
      { from: 'converter', to: 'archive', role: 'successor-violet', initiallyHidden: true },
    ],
  }
}
