import type { ScenarioCatalog } from './contracts'
import { eulerBundle } from './euler'
import { syntheticBundle } from './synthetic-compiled'

export const scenarioCatalog: ScenarioCatalog = {
  schemaVersion: '1.0.0',
  defaultScenarioId: eulerBundle.scenario.scenarioId,
  entries: [
    { id: eulerBundle.scenario.scenarioId, kind: eulerBundle.scenario.kind, title: eulerBundle.scenario.title, bundle: eulerBundle },
    { id: syntheticBundle.scenario.scenarioId, kind: syntheticBundle.scenario.kind, title: syntheticBundle.scenario.title, bundle: syntheticBundle },
  ],
}

export function getScenarioBundle(id: string = scenarioCatalog.defaultScenarioId) {
  const entry = scenarioCatalog.entries.find((candidate) => candidate.id === id)
  if (!entry) throw new Error(`Unknown scenario: ${id}`)
  return entry.bundle
}

export function resolveBrowserScenario(search: string) {
  const requested = new URLSearchParams(search).get('scenario')
  return getScenarioBundle(requested === 'synthetic' ? 'synthetic-prism-calibration-v2' : requested ?? undefined)
}

export { eulerEvidenceGraph } from './euler'
