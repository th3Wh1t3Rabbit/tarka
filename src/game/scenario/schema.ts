export type AssetId = 'GOLD' | 'CYAN' | 'VIOLET'
export type EntityId = 'origin' | 'fork' | 'quiet' | 'high-activity' | 'converter' | 'archive'
export type EvidenceClass = 'route-event' | 'state-delta' | 'conversion-event' | 'activity-context'
export type TheorySlot = 'route' | 'transformation' | 'destination' | 'proof'

export interface SyntheticEntity {
  id: EntityId
  name: string
  kind: 'origin' | 'reservoir' | 'noise-engine' | 'converter' | 'archive'
}

export interface AssetAmount {
  asset: AssetId
  amount: number
}

export interface SyntheticEvent {
  id: string
  timestamp: number
  kind: 'origin' | 'retention' | 'transfer' | 'activity' | 'conversion' | 'accumulation'
  from: EntityId | null
  to: EntityId
  inputs: AssetAmount[]
  outputs: AssetAmount[]
  markedUnits: number
  syntheticInteractions: number
  label: string
}

export interface BalanceRecord {
  entity: EntityId
  timestamp: number
  phase: 'before' | 'after'
  balances: AssetAmount[]
}

export interface EvidenceRecord {
  id: string
  class: EvidenceClass
  eventIds: string[]
  claim: string
  nonColorCue: string
}

export interface TheoryOption {
  id: string
  label: string
}

export type TheoryOptions = Record<TheorySlot, [TheoryOption, TheoryOption]>

export interface TheorySelection {
  route: string | null
  transformation: string | null
  destination: string | null
  proof: string | null
}

export interface SolverContradiction {
  slot: TheorySlot
  code: 'NO_MARKED_STATE' | 'CONVERSION_MISMATCH' | 'DESTINATION_MISMATCH' | 'PROOF_INSUFFICIENT'
  evidenceIds: string[]
  display: string
}

export interface TheoryEvaluation {
  accepted: boolean
  firstContradiction: SolverContradiction | null
  proofEvidenceIds: string[]
}

export interface SyntheticScenario {
  schemaVersion: '2.0.0'
  compilerVersion: '1.0.0'
  scenarioId: 'synthetic-prism-calibration-v2'
  title: 'The Signal Vault // Prism Calibration'
  chain: 'SYNTHETIC'
  historicalWindow: null
  historicalCutoff: null
  generatedAt: '2026-09-14T00:00:00Z'
  synthetic: true
  provenance: {
    source: 'synthetic-fixture'
    note: 'Fictional calibration data; no external data or market claim.'
    externalData: false
  }
  entities: SyntheticEntity[]
  events: SyntheticEvent[]
  balances: BalanceRecord[]
  evidence: EvidenceRecord[]
  theoryOptions: TheoryOptions
  canonicalTheory: Required<TheorySelection>
  truthTimeline: string[]
}

export const emptyTheory: TheorySelection = {
  route: null,
  transformation: null,
  destination: null,
  proof: null,
}

export function isTheoryComplete(theory: TheorySelection): theory is Required<TheorySelection> {
  return Object.values(theory).every((value) => typeof value === 'string' && value.length > 0)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function hasUniqueValues(values: string[]): boolean {
  return new Set(values).size === values.length
}

const entityIds = new Set<EntityId>(['origin', 'fork', 'quiet', 'high-activity', 'converter', 'archive'])
const entityKinds = new Set<SyntheticEntity['kind']>(['origin', 'reservoir', 'noise-engine', 'converter', 'archive'])
const eventKinds = new Set<SyntheticEvent['kind']>(['origin', 'retention', 'transfer', 'activity', 'conversion', 'accumulation'])
const assetIds = new Set<AssetId>(['GOLD', 'CYAN', 'VIOLET'])
const evidenceClasses = new Set<EvidenceClass>(['route-event', 'state-delta', 'conversion-event', 'activity-context'])
const theorySlots: TheorySlot[] = ['route', 'transformation', 'destination', 'proof']
const canonicalEvidence: EvidenceRecord[] = [
  { id: 'origin-event', class: 'route-event', eventIds: ['evt-origin-departure'], claim: '24 GOLD DEPARTS ORIGIN', nonColorCue: 'ORIGIN EVENT stamp' },
  { id: 'fork-state-delta', class: 'state-delta', eventIds: ['evt-fork-retention', 'evt-quiet-continuation'], claim: '7 GOLD RETAINED // 17 GOLD CONTINUES', nonColorCue: 'Before/after numeric readout' },
  { id: 'quiet-transformation-gap', class: 'route-event', eventIds: ['evt-quiet-continuation'], claim: '17 GOLD IN // 0 GOLD OUT', nonColorCue: 'PARTIAL // TRANSFORMATION SUSPECTED stamp' },
  { id: 'activity-contradiction', class: 'activity-context', eventIds: ['evt-high-activity'], claim: 'ACTIVITY ≠ DESTINATION', nonColorCue: 'Fractured geometry and CONTRADICTION label' },
  { id: 'conversion-event', class: 'conversion-event', eventIds: ['evt-prism-conversion'], claim: '17 GOLD → 11 CYAN + 6 VIOLET', nonColorCue: 'One-input/two-output numeric machine readout' },
  { id: 'archive-successor-delta', class: 'state-delta', eventIds: ['evt-archive-accumulation'], claim: '0 / 0 → 11 CYAN / 6 VIOLET', nonColorCue: 'BEFORE/AFTER paired-reservoir readout' },
]
const canonicalTheoryOptions: TheoryOptions = {
  route: [{ id: 'quiet-converter', label: 'Quiet Reservoir → Prism Converter' }, { id: 'high-noise', label: 'High Activity → Noise Engine' }],
  transformation: [{ id: 'gold-to-successors', label: '17 GOLD → 11 CYAN + 6 VIOLET' }, { id: 'signal-terminated', label: 'No transformation; signal terminated' }],
  destination: [{ id: 'prism-archive', label: 'Prism Archive' }, { id: 'high-chamber', label: 'High Activity chamber' }],
  proof: [{ id: 'conversion-plus-delta', label: 'Conversion event + successor-state delta' }, { id: 'activity-plus-intensity', label: 'Interaction count + visual intensity' }],
}
const canonicalTruthTimeline = [
  'T+04  24 GOLD DEPARTS ORIGIN',
  'T+18   7 GOLD RETAINED AT FORK',
  'T+18  17 GOLD CONTINUES TO QUIET RESERVOIR',
  'T+31  17 GOLD ENTERS PRISM CONVERTER',
  'T+31  11 CYAN + 6 VIOLET CREATED',
  'T+36  SUCCESSOR STATES ACCUMULATE IN PRISM ARCHIVE',
]

function sameCanonicalValue(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected)
}

function isAssetAmount(value: unknown): value is AssetAmount {
  if (!isRecord(value)) return false
  return assetIds.has(value.asset as AssetId) && isNonNegativeInteger(value.amount)
}

function isAssetAmountList(value: unknown): value is AssetAmount[] {
  return Array.isArray(value)
    && value.every(isAssetAmount)
    && hasUniqueValues(value.map(({ asset }) => asset))
}

function amountFor(amounts: AssetAmount[], asset: AssetId): number {
  return amounts.find((amount) => amount.asset === asset)?.amount ?? 0
}

function totalAmount(amounts: AssetAmount[]): number {
  return amounts.reduce((sum, amount) => sum + amount.amount, 0)
}

function sameAmounts(left: AssetAmount[], right: AssetAmount[]): boolean {
  return [...assetIds].every((asset) => amountFor(left, asset) === amountFor(right, asset))
}

function hasExactAmounts(actual: AssetAmount[], expected: AssetAmount[]): boolean {
  return actual.length === expected.length && sameAmounts(actual, expected)
}

export function validateScenario(value: unknown): value is SyntheticScenario {
  if (!isRecord(value)) return false
  const candidate = value as unknown as Partial<SyntheticScenario>
  if (candidate.schemaVersion !== '2.0.0'
    || candidate.compilerVersion !== '1.0.0'
    || candidate.scenarioId !== 'synthetic-prism-calibration-v2'
    || candidate.title !== 'The Signal Vault // Prism Calibration'
    || candidate.chain !== 'SYNTHETIC'
    || candidate.historicalWindow !== null
    || candidate.historicalCutoff !== null
    || candidate.generatedAt !== '2026-09-14T00:00:00Z'
    || candidate.synthetic !== true
    || candidate.provenance?.source !== 'synthetic-fixture'
    || candidate.provenance.note !== 'Fictional calibration data; no external data or market claim.'
    || candidate.provenance.externalData !== false) return false
  if (!Array.isArray(candidate.entities) || !Array.isArray(candidate.events)
    || !Array.isArray(candidate.balances) || !Array.isArray(candidate.evidence)
    || !Array.isArray(candidate.truthTimeline) || !candidate.theoryOptions || !candidate.canonicalTheory) return false

  if (candidate.entities.length !== 6 || !candidate.entities.every((entity) => {
    if (!isRecord(entity)) return false
    return entityIds.has(entity.id as EntityId)
      && isNonEmptyString(entity.name)
      && entityKinds.has(entity.kind as SyntheticEntity['kind'])
  })) return false
  const declaredEntityIds = candidate.entities.map(({ id }) => id)
  if (!hasUniqueValues(declaredEntityIds) || declaredEntityIds.some((id) => !entityIds.has(id))) return false
  const expectedEntityKinds: Record<EntityId, SyntheticEntity['kind']> = {
    origin: 'origin',
    fork: 'reservoir',
    quiet: 'reservoir',
    'high-activity': 'noise-engine',
    converter: 'converter',
    archive: 'archive',
  }
  if (candidate.entities.some(({ id, kind }) => expectedEntityKinds[id] !== kind)) return false

  if (candidate.events.length !== 6 || !candidate.events.every((event) => {
    if (!isRecord(event)) return false
    return isNonEmptyString(event.id)
      && isNonNegativeInteger(event.timestamp)
      && eventKinds.has(event.kind as SyntheticEvent['kind'])
      && (event.from === null || entityIds.has(event.from as EntityId))
      && entityIds.has(event.to as EntityId)
      && isAssetAmountList(event.inputs)
      && isAssetAmountList(event.outputs)
      && isNonNegativeInteger(event.markedUnits)
      && isNonNegativeInteger(event.syntheticInteractions)
      && isNonEmptyString(event.label)
  })) return false
  const eventIds = candidate.events.map(({ id }) => id)
  if (!hasUniqueValues(eventIds)) return false

  if (candidate.balances.length < 4 || !candidate.balances.every((balance) => {
    if (!isRecord(balance)) return false
    return entityIds.has(balance.entity as EntityId)
      && isNonNegativeInteger(balance.timestamp)
      && (balance.phase === 'before' || balance.phase === 'after')
      && isAssetAmountList(balance.balances)
  })) return false
  const balanceKeys = candidate.balances.map(({ entity, timestamp, phase }) => `${entity}:${timestamp}:${phase}`)
  if (!hasUniqueValues(balanceKeys)) return false

  if (candidate.evidence.length < 6 || !candidate.evidence.every((evidence) => {
    if (!isRecord(evidence)) return false
    return isNonEmptyString(evidence.id)
      && evidenceClasses.has(evidence.class as EvidenceClass)
      && Array.isArray(evidence.eventIds)
      && evidence.eventIds.length > 0
      && evidence.eventIds.every((eventId) => typeof eventId === 'string' && eventIds.includes(eventId))
      && hasUniqueValues(evidence.eventIds as string[])
      && isNonEmptyString(evidence.claim)
      && isNonEmptyString(evidence.nonColorCue)
  })) return false
  const evidenceIds = candidate.evidence.map(({ id }) => id)
  if (!hasUniqueValues(evidenceIds) || !sameCanonicalValue(candidate.evidence, canonicalEvidence)) return false

  if (!isRecord(candidate.theoryOptions) || !isTheoryComplete(candidate.canonicalTheory)) return false
  for (const slot of theorySlots) {
    const options: unknown = candidate.theoryOptions[slot]
    if (!Array.isArray(options) || options.length !== 2 || !options.every((option) => {
      if (!isRecord(option)) return false
      return isNonEmptyString(option.id) && isNonEmptyString(option.label)
    })) return false
    const optionIds = options.map((option) => (option as TheoryOption).id)
    const canonicalValue = candidate.canonicalTheory[slot]
    if (!hasUniqueValues(optionIds) || typeof canonicalValue !== 'string' || !optionIds.includes(canonicalValue)) return false
  }
  if (!sameCanonicalValue(candidate.theoryOptions, canonicalTheoryOptions)) return false

  if (candidate.truthTimeline.length !== 6
    || !candidate.truthTimeline.every(isNonEmptyString)
    || !sameCanonicalValue(candidate.truthTimeline, canonicalTruthTimeline)) return false

  const eventById = new Map(candidate.events.map((event) => [event.id, event]))
  const origin = eventById.get('evt-origin-departure')
  const retention = eventById.get('evt-fork-retention')
  const quiet = eventById.get('evt-quiet-continuation')
  const activity = eventById.get('evt-high-activity')
  const conversion = eventById.get('evt-prism-conversion')
  const accumulation = eventById.get('evt-archive-accumulation')
  if (!origin || !retention || !quiet || !activity || !conversion || !accumulation) return false

  const originUnits = amountFor(origin.outputs, 'GOLD')
  const retainedUnits = amountFor(retention.outputs, 'GOLD')
  const continuingUnits = amountFor(quiet.outputs, 'GOLD')
  if (originUnits !== 24 || retainedUnits !== 7 || continuingUnits !== 17
    || retainedUnits + continuingUnits !== originUnits
    || activity.markedUnits !== 0) return false

  if (origin.kind !== 'origin' || origin.from !== 'origin' || origin.to !== 'fork' || origin.timestamp !== 4
    || !hasExactAmounts(origin.inputs, [{ asset: 'GOLD', amount: 24 }])
    || !hasExactAmounts(origin.outputs, [{ asset: 'GOLD', amount: 24 }])
    || origin.markedUnits !== 24 || origin.syntheticInteractions !== 1
    || retention.kind !== 'retention' || retention.from !== 'fork' || retention.to !== 'fork' || retention.timestamp !== 18
    || !hasExactAmounts(retention.inputs, [{ asset: 'GOLD', amount: 24 }])
    || !hasExactAmounts(retention.outputs, [{ asset: 'GOLD', amount: 7 }])
    || retention.markedUnits !== 7 || retention.syntheticInteractions !== 1
    || quiet.kind !== 'transfer' || quiet.from !== 'fork' || quiet.to !== 'quiet' || quiet.timestamp !== 18
    || !hasExactAmounts(quiet.inputs, [{ asset: 'GOLD', amount: 17 }])
    || !hasExactAmounts(quiet.outputs, [{ asset: 'GOLD', amount: 17 }])
    || quiet.markedUnits !== 17 || quiet.syntheticInteractions !== 1
    || activity.kind !== 'activity' || activity.from !== 'fork' || activity.to !== 'high-activity' || activity.timestamp !== 18
    || activity.inputs.length !== 0 || activity.outputs.length !== 0
    || activity.syntheticInteractions !== 86) return false

  const conversionInput = totalAmount(conversion.inputs)
  const conversionOutput = totalAmount(conversion.outputs)
  if (conversionInput !== 17 || conversionOutput !== 17 || conversion.markedUnits !== 17
    || conversion.kind !== 'conversion' || conversion.from !== 'quiet' || conversion.to !== 'converter' || conversion.timestamp !== 31
    || amountFor(conversion.inputs, 'GOLD') !== 17
    || amountFor(conversion.outputs, 'CYAN') !== 11
    || amountFor(conversion.outputs, 'VIOLET') !== 6
    || conversion.syntheticInteractions !== 1
    || accumulation.kind !== 'accumulation' || accumulation.from !== 'converter' || accumulation.to !== 'archive' || accumulation.timestamp !== 36
    || accumulation.markedUnits !== 17 || accumulation.syntheticInteractions !== 1
    || !sameAmounts(conversion.outputs, accumulation.inputs)
    || !sameAmounts(accumulation.inputs, accumulation.outputs)) return false

  const forkBefore = candidate.balances.find((balance) => balance.entity === 'fork' && balance.phase === 'before')
  const forkAfter = candidate.balances.find((balance) => balance.entity === 'fork' && balance.phase === 'after')
  const archiveBefore = candidate.balances.find((balance) => balance.entity === 'archive' && balance.phase === 'before')
  const archiveAfter = candidate.balances.find((balance) => balance.entity === 'archive' && balance.phase === 'after')
  if (!forkBefore || !forkAfter || !archiveBefore || !archiveAfter
    || forkBefore.timestamp !== 17 || !hasExactAmounts(forkBefore.balances, [{ asset: 'GOLD', amount: 0 }])
    || forkAfter.timestamp !== 18 || !hasExactAmounts(forkAfter.balances, [{ asset: 'GOLD', amount: 7 }])
    || archiveBefore.timestamp !== 35
    || !hasExactAmounts(archiveBefore.balances, [{ asset: 'CYAN', amount: 0 }, { asset: 'VIOLET', amount: 0 }])
    || archiveAfter.timestamp !== 36
    || !hasExactAmounts(archiveAfter.balances, conversion.outputs)) return false

  return candidate.canonicalTheory.route === 'quiet-converter'
    && candidate.canonicalTheory.transformation === 'gold-to-successors'
    && candidate.canonicalTheory.destination === 'prism-archive'
    && candidate.canonicalTheory.proof === 'conversion-plus-delta'
}
