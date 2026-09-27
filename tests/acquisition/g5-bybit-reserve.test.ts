import { describe, expect, it } from 'vitest'

import { evaluateReserve, hasDurableSemanticResponse, isExactCreditPair, reserveRequestPlan } from '../../scripts/acquisition/g5-bybit-reserve.js'
import type { CallLedgerRecord } from '../../src/acquisition/contracts.js'
import { hashCanonicalObject } from '../../src/acquisition/integrity/identity.js'
import type { AcquiredItem, CandidateConfig, EndpointConfigFile } from '../../scripts/acquisition/g4a-audition.js'

const candidate: CandidateConfig = {
  id: 'BYBIT_2025_DRAIN_FALLBACK', chain: 'ethereum',
  auditionWindow: { start: '2025-02-21T14:00:00Z', end: '2025-02-21T18:00:00Z' },
  contextWindow: { start: '2025-02-21T13:30:00Z', end: '2025-02-21T20:30:00Z' },
  addresses: {
    victim_safe: '0x1111111111111111111111111111111111111111', initial_attacker: '0x2222222222222222222222222222222222222222',
    known_exploiter_recipient: '0x3333333333333333333333333333333333333333', delegatecall_contract: '0x4444444444444444444444444444444444444444',
    malicious_implementation: '0x5555555555555555555555555555555555555555',
  },
  transactions: Object.fromEntries(['safe_upgrade', 'eth_drain', 'cmeth_drain', 'meth_drain', 'steth_drain'].map((name, index) => [name, `0x${String(index + 1).repeat(64)}`])),
  limits: { maxHttpAttempts: 18, maxProjectedCredits: 60 },
}

const lookupPolicy: EndpointConfigFile['endpoints'][number] = {
  endpoint: '/api/v1/transaction-with-token-transfer-lookup', method: 'POST' as const, apiVersion: 'nansen-v1', endpointClass: 'historical-events' as const,
  planningCreditCost: 1, allowedLenses: ['ROUTE_SCAN', 'CONVERSION_TRACE'], redistribution: 'PUBLIC_ALLOWLISTED',
  maximumPages: 1, transport: 'NANSEN_BUILD_TIME_G4A' as const,
}
const endpoints: EndpointConfigFile = { endpoints: [lookupPolicy] }

function item(name: keyof typeof candidate.transactions, index: number): AcquiredItem {
  const transactionHash = candidate.transactions[name]!
  const victim = candidate.addresses.victim_safe!
  const recipient = candidate.addresses.known_exploiter_recipient!
  const auxiliary = [candidate.addresses.delegatecall_contract!, candidate.addresses.malicious_implementation!, candidate.addresses.initial_attacker!][index % 3]!
  return {
    purpose: `exact-${name}`, endpoint: lookupPolicy.endpoint, requestBody: { chain: 'ethereum', transaction_hash: transactionHash }, status: 200,
    rawSha256: String(index + 1).repeat(64), normalizedSha256: String(index + 2).repeat(64), attemptsIssued: 1, projectedCredits: 1, creditMetadata: null,
    retrievedAtUtc: '2026-09-14T20:00:00Z', body: { data: [{ transaction_hash: transactionHash, block_timestamp: `2025-02-21T14:0${index}:00`, chain: 'ethereum', from_address: auxiliary, to_address: recipient, native_value: 0, token_transfer_array: index === 0 ? null : [{ transfer_id: `transfer-${index}`, from_address: victim, to_address: recipient, token_address: `0x${String(index + 6).repeat(40)}`, token_amount: index + 1 }] }] },
  }
}

describe('G5 Bybit reserve audition boundary', () => {
  it('plans only the five exact public seed lookups', () => {
    const plan = reserveRequestPlan(candidate, endpoints)
    expect(plan).toHaveLength(5)
    expect(plan.every(({ request }) => request.candidateId === candidate.id && request.endpoint === lookupPolicy.endpoint && request.requestBody.chain === 'ethereum')).toBe(true)
    expect(plan.map(({ purpose }) => purpose)).toEqual(['exact-safe_upgrade', 'exact-eth_drain', 'exact-cmeth_drain', 'exact-meth_drain', 'exact-steth_drain'])
  })

  it('never repeats any durable semantic response, including an accounting-rejected one', () => {
    const request = reserveRequestPlan(candidate, endpoints)[0]!.request
    const record = { status: 'FAILED', endpoint: request.endpoint, canonicalRequestHash: hashCanonicalObject(request.requestBody), rawSha256: 'a'.repeat(64), normalizedSha256: 'b'.repeat(64), rawStorageLocations: { primary: '/private/a', mirror: '/private/b' } } as CallLedgerRecord
    expect(hasDurableSemanticResponse([record], request)).toBe(true)
    expect(hasDurableSemanticResponse([{ ...record, rawSha256: null }], request)).toBe(false)
  })

  it('recommends reserve eligibility only for complete exact, branched, bounded proof', () => {
    const items = Object.keys(candidate.transactions).map((name, index) => item(name as keyof typeof candidate.transactions, index))
    const result = evaluateReserve(candidate, items)
    expect(result).toMatchObject({ recommendation: 'RESERVE_ELIGIBLE', exactFound: 5, exactExpected: 5, routeProof: true, branchProof: true, transformationProof: true, temporalIntegrity: true, fatalDefects: [] })
    expect(result.total).toBeGreaterThanOrEqual(78)
    expect(result.criticalNodes.length).toBeGreaterThanOrEqual(6)
    expect(result.criticalNodes.length).toBeLessThanOrEqual(10)
  })

  it('defers when exact proof closure is incomplete', () => {
    const result = evaluateReserve(candidate, [item('eth_drain', 1)])
    expect(result.recommendation).toBe('DEFER')
    expect(result.fatalDefects).toContain('NO_EXACT_PROOF_CLOSURE')
    expect(result.unsupportedGaps).toHaveLength(2)
  })

  it('requires exact fresh-baseline credit reconciliation', () => {
    expect(isExactCreditPair(100, 99, 1)).toBe(true)
    expect(isExactCreditPair(100, 98, 1)).toBe(false)
    expect(isExactCreditPair(null, 99, 1)).toBe(false)
  })
})
