import type { NormalizedEvidenceGraph } from '../scenario/contracts'

export interface AtomicPrecisionOutcome {
  evidenceId: string
  status: 'KEY_ABSENT' | 'EXACT_MATCH' | 'ATOMIC_MISMATCH'
  providerDecimal: string
  tokenDecimals: number
  observedAtomicUnits: string | null
}

function expectedAtomicUnits(decimal: string, tokenDecimals: number): string {
  if (!Number.isInteger(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 255) throw new TypeError('Token decimals are invalid')
  const [whole, fraction = ''] = decimal.split('.')
  if (!whole || !/^\d+$/.test(whole) || !/^\d*$/.test(fraction) || fraction.length > tokenDecimals) throw new TypeError('Provider decimal cannot be represented in the declared atomic precision')
  return `${whole}${fraction.padEnd(tokenDecimals, '0')}`.replace(/^0+(?=\d)/, '')
}

export function applyAtomicPrecisionOutcomes(graph: NormalizedEvidenceGraph, outcomes: AtomicPrecisionOutcome[]): NormalizedEvidenceGraph {
  const next = structuredClone(graph)
  for (const outcome of outcomes) {
    const evidence = next.evidence.find(({ id }) => id === outcome.evidenceId)
    if (!evidence) throw new TypeError(`Atomic verification references missing evidence: ${outcome.evidenceId}`)
    const expected = expectedAtomicUnits(outcome.providerDecimal, outcome.tokenDecimals)
    if (outcome.status === 'KEY_ABSENT') {
      if (outcome.observedAtomicUnits !== null) throw new TypeError('Key-absent verification cannot include atomic units')
      continue
    }
    if (outcome.observedAtomicUnits === null || !/^\d+$/.test(outcome.observedAtomicUnits)) throw new TypeError('Atomic verification requires unsigned integer units')
    if (outcome.status === 'ATOMIC_MISMATCH' || outcome.observedAtomicUnits !== expected) throw new Error(`BLOCKED_WITH_EVIDENCE: atomic-unit mismatch for ${outcome.evidenceId}`)
    evidence.numericPrecisionStatus = 'ATOMIC_LOG_VERIFIED'
    evidence.uncertainty = 'Raw Ethereum receipt atomic units match the provider-reported decimal; Nansen remains the primary source for mission truth.'
  }
  return next
}
