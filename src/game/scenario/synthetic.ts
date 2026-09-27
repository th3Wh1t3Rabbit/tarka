import type { SyntheticScenario } from './schema'

export const syntheticScenario: SyntheticScenario = {
  schemaVersion: '2.0.0',
  compilerVersion: '1.0.0',
  scenarioId: 'synthetic-prism-calibration-v2',
  title: 'The Signal Vault // Prism Calibration',
  chain: 'SYNTHETIC',
  historicalWindow: null,
  historicalCutoff: null,
  generatedAt: '2026-09-14T00:00:00Z',
  synthetic: true,
  provenance: {
    source: 'synthetic-fixture',
    note: 'Fictional calibration data; no external data or market claim.',
    externalData: false,
  },
  entities: [
    { id: 'origin', name: 'Origin', kind: 'origin' },
    { id: 'fork', name: 'Fork Reservoir', kind: 'reservoir' },
    { id: 'quiet', name: 'Quiet Reservoir', kind: 'reservoir' },
    { id: 'high-activity', name: 'High Activity', kind: 'noise-engine' },
    { id: 'converter', name: 'Prism Converter', kind: 'converter' },
    { id: 'archive', name: 'Prism Archive', kind: 'archive' },
  ],
  events: [
    {
      id: 'evt-origin-departure', timestamp: 4, kind: 'origin', from: 'origin', to: 'fork',
      inputs: [{ asset: 'GOLD', amount: 24 }], outputs: [{ asset: 'GOLD', amount: 24 }],
      markedUnits: 24, syntheticInteractions: 1, label: '24 GOLD DEPARTS ORIGIN',
    },
    {
      id: 'evt-fork-retention', timestamp: 18, kind: 'retention', from: 'fork', to: 'fork',
      inputs: [{ asset: 'GOLD', amount: 24 }], outputs: [{ asset: 'GOLD', amount: 7 }],
      markedUnits: 7, syntheticInteractions: 1, label: '7 GOLD RETAINED AT FORK',
    },
    {
      id: 'evt-quiet-continuation', timestamp: 18, kind: 'transfer', from: 'fork', to: 'quiet',
      inputs: [{ asset: 'GOLD', amount: 17 }], outputs: [{ asset: 'GOLD', amount: 17 }],
      markedUnits: 17, syntheticInteractions: 1, label: '17 GOLD CONTINUES TO QUIET RESERVOIR',
    },
    {
      id: 'evt-high-activity', timestamp: 18, kind: 'activity', from: 'fork', to: 'high-activity',
      inputs: [], outputs: [], markedUnits: 0, syntheticInteractions: 86,
      label: '86 SYNTHETIC INTERACTIONS // 0 MARKED UNITS RETAINED',
    },
    {
      id: 'evt-prism-conversion', timestamp: 31, kind: 'conversion', from: 'quiet', to: 'converter',
      inputs: [{ asset: 'GOLD', amount: 17 }],
      outputs: [{ asset: 'CYAN', amount: 11 }, { asset: 'VIOLET', amount: 6 }],
      markedUnits: 17, syntheticInteractions: 1, label: '17 GOLD ENTERS PRISM CONVERTER',
    },
    {
      id: 'evt-archive-accumulation', timestamp: 36, kind: 'accumulation', from: 'converter', to: 'archive',
      inputs: [{ asset: 'CYAN', amount: 11 }, { asset: 'VIOLET', amount: 6 }],
      outputs: [{ asset: 'CYAN', amount: 11 }, { asset: 'VIOLET', amount: 6 }],
      markedUnits: 17, syntheticInteractions: 1, label: 'SUCCESSOR STATES ACCUMULATE IN PRISM ARCHIVE',
    },
  ],
  balances: [
    { entity: 'fork', timestamp: 17, phase: 'before', balances: [{ asset: 'GOLD', amount: 0 }] },
    { entity: 'fork', timestamp: 18, phase: 'after', balances: [{ asset: 'GOLD', amount: 7 }] },
    { entity: 'archive', timestamp: 35, phase: 'before', balances: [{ asset: 'CYAN', amount: 0 }, { asset: 'VIOLET', amount: 0 }] },
    { entity: 'archive', timestamp: 36, phase: 'after', balances: [{ asset: 'CYAN', amount: 11 }, { asset: 'VIOLET', amount: 6 }] },
  ],
  evidence: [
    { id: 'origin-event', class: 'route-event', eventIds: ['evt-origin-departure'], claim: '24 GOLD DEPARTS ORIGIN', nonColorCue: 'ORIGIN EVENT stamp' },
    { id: 'fork-state-delta', class: 'state-delta', eventIds: ['evt-fork-retention', 'evt-quiet-continuation'], claim: '7 GOLD RETAINED // 17 GOLD CONTINUES', nonColorCue: 'Before/after numeric readout' },
    { id: 'quiet-transformation-gap', class: 'route-event', eventIds: ['evt-quiet-continuation'], claim: '17 GOLD IN // 0 GOLD OUT', nonColorCue: 'PARTIAL // TRANSFORMATION SUSPECTED stamp' },
    { id: 'activity-contradiction', class: 'activity-context', eventIds: ['evt-high-activity'], claim: 'ACTIVITY ≠ DESTINATION', nonColorCue: 'Fractured geometry and CONTRADICTION label' },
    { id: 'conversion-event', class: 'conversion-event', eventIds: ['evt-prism-conversion'], claim: '17 GOLD → 11 CYAN + 6 VIOLET', nonColorCue: 'One-input/two-output numeric machine readout' },
    { id: 'archive-successor-delta', class: 'state-delta', eventIds: ['evt-archive-accumulation'], claim: '0 / 0 → 11 CYAN / 6 VIOLET', nonColorCue: 'BEFORE/AFTER paired-reservoir readout' },
  ],
  theoryOptions: {
    route: [
      { id: 'quiet-converter', label: 'Quiet Reservoir → Prism Converter' },
      { id: 'high-noise', label: 'High Activity → Noise Engine' },
    ],
    transformation: [
      { id: 'gold-to-successors', label: '17 GOLD → 11 CYAN + 6 VIOLET' },
      { id: 'signal-terminated', label: 'No transformation; signal terminated' },
    ],
    destination: [
      { id: 'prism-archive', label: 'Prism Archive' },
      { id: 'high-chamber', label: 'High Activity chamber' },
    ],
    proof: [
      { id: 'conversion-plus-delta', label: 'Conversion event + successor-state delta' },
      { id: 'activity-plus-intensity', label: 'Interaction count + visual intensity' },
    ],
  },
  canonicalTheory: {
    route: 'quiet-converter',
    transformation: 'gold-to-successors',
    destination: 'prism-archive',
    proof: 'conversion-plus-delta',
  },
  truthTimeline: [
    'T+04  24 GOLD DEPARTS ORIGIN',
    'T+18   7 GOLD RETAINED AT FORK',
    'T+18  17 GOLD CONTINUES TO QUIET RESERVOIR',
    'T+31  17 GOLD ENTERS PRISM CONVERTER',
    'T+31  11 CYAN + 6 VIOLET CREATED',
    'T+36  SUCCESSOR STATES ACCUMULATE IN PRISM ARCHIVE',
  ],
}
