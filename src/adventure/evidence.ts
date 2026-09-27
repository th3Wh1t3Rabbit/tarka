export const FIRST_BREACH_EVIDENCE_ID = 'EXACT_EARLY_NET' as const
export const ACCEPTED_SCENARIO_PATH = '/scenarios/euler-2023-false-exit/scenario.json' as const

export interface FirstBreachRecord {
  id: typeof FIRST_BREACH_EVIDENCE_ID
  title: 'FIRST BREACH // FIRST ENGINE'
  observedAtUtc: string
  displayTime: string
  displayAmount: string
  exactClaim: string
  proofGrade: 'EXACT_EVENT'
  source: 'Nansen token-transfer record'
  sourceEndpoint: string
  precision: 'NANSEN-PROVIDER PRECISION'
  transactionHash: string
  temporalClass: 'HISTORICAL_AT_CUTOFF'
  historicalCutoffUtc: string
}

type UnknownRecord = Record<string, unknown>

function object(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label}`)
  return value as UnknownRecord
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid ${label}`)
  return value
}

/** Projects the single public A0 record from the accepted, frozen scenario pack. */
export function deriveFirstBreachRecord(value: unknown): FirstBreachRecord {
  const scenario = object(value, 'scenario')
  const evidence = scenario.evidence
  if (!Array.isArray(evidence)) throw new Error('Invalid scenario evidence')
  const raw = object(evidence.find((entry) => object(entry, 'evidence entry').id === FIRST_BREACH_EVIDENCE_ID), 'first breach evidence')
  const facts = object(raw.facts, 'first breach facts')
  const assetAmounts = facts.assetAmounts
  if (!Array.isArray(assetAmounts) || assetAmounts.length !== 1) throw new Error('First breach must have one asset amount')
  const amount = object(assetAmounts[0], 'first breach amount')
  const asset = text(amount.asset, 'first breach asset')
  const quantity = text(amount.amount, 'first breach quantity')
  const cutoff = text(scenario.historicalCutoff, 'historical cutoff')
  const observedAtUtc = text(raw.observedAtUtc, 'observed time')
  if (raw.proofGrade !== 'EXACT_EVENT' || raw.numericPrecisionStatus !== 'PROVIDER_REPORTED_DECIMAL' || raw.temporalClass !== 'HISTORICAL_AT_CUTOFF') throw new Error('First breach proof controls do not match accepted evidence')
  if (asset !== 'DAI' || quantity !== '8877507.3483067') throw new Error('First breach accepted amount changed')
  if (Date.parse(observedAtUtc) > Date.parse(cutoff)) throw new Error('First breach is after the historical cutoff')
  return {
    id: FIRST_BREACH_EVIDENCE_ID,
    title: 'FIRST BREACH // FIRST ENGINE',
    observedAtUtc,
    displayTime: `${observedAtUtc.slice(11, 19)} UTC`,
    displayAmount: 'approximately 8.88M DAI at the First Engine',
    exactClaim: text(raw.claim, 'first breach claim'),
    proofGrade: 'EXACT_EVENT',
    source: 'Nansen token-transfer record',
    sourceEndpoint: text(raw.sourceEndpoint, 'source endpoint'),
    precision: 'NANSEN-PROVIDER PRECISION',
    transactionHash: text(raw.transactionHash, 'transaction hash'),
    temporalClass: 'HISTORICAL_AT_CUTOFF',
    historicalCutoffUtc: cutoff,
  }
}

export async function loadAcceptedFirstBreachRecord(): Promise<FirstBreachRecord> {
  const response = await fetch(ACCEPTED_SCENARIO_PATH, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Accepted scenario ${response.status}`)
  return deriveFirstBreachRecord(await response.json())
}
