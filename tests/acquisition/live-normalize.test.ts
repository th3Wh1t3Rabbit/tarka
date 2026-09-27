import { describe, expect, it } from 'vitest'

import { buildCandidateReport, criticalSeedIdentities, evaluateConnectedRoute, isInsideContextWindow, normalizeUniqueEvidence, parseObservations, toNormalizedRecord, type AcquiredItem, type CandidateConfig, type StructuredObservation } from '../../scripts/acquisition/g4a-audition.js'

const hash = `0x${'1'.repeat(64)}`
const from = `0x${'2'.repeat(40)}`
const to = `0x${'3'.repeat(40)}`
const token = `0x${'4'.repeat(40)}`
const digest = 'a'.repeat(64)

const candidate: CandidateConfig = {
  id: 'EULER_2023_INITIAL_EXPLOIT', chain: 'ethereum',
  auditionWindow: { start: '2023-03-13T08:45:00Z', end: '2023-03-13T12:15:00Z' },
  contextWindow: { start: '2023-03-13T08:30:00Z', end: '2023-03-13T12:30:00Z' },
  addresses: { from, to }, transactions: { exact: hash }, limits: { maxHttpAttempts: 36, maxProjectedCredits: 120 },
}

function item(body: unknown): AcquiredItem {
  return { purpose: 'exact-seed', endpoint: '/api/v1/transaction-with-token-transfer-lookup', requestBody: { chain: 'ethereum', transaction_hash: hash }, status: 200, rawSha256: digest, normalizedSha256: 'b'.repeat(64), body, attemptsIssued: 1, projectedCredits: 1, creditMetadata: { 'x-nansen-credits-used': '1' }, retrievedAtUtc: '2026-09-14T12:00:00Z' }
}

describe('reviewed-schema historical evidence normalization', () => {
  it('derives exact relationships from response rows, never request echoes or unrelated nested strings', () => {
    expect(parseObservations(item({ request: { transaction_hash: hash }, data: [] }))).toEqual([])
    expect(parseObservations(item({ data: [{ chain: 'ethereum', transaction_hash: `0x${'9'.repeat(64)}`, from_address: from, to_address: to, block_timestamp: '2023-03-13T09:00:00Z', token_transfer_array: [], note: hash }] }))).toEqual([])
    const observations = parseObservations(item({ data: [{ chain: 'ethereum', transaction_hash: hash, from_address: from, to_address: to, block_timestamp: '2023-03-13T09:00:00Z', token_transfer_array: [{ transfer_id: `${hash}-1`, from_address: from, to_address: to, token_address: token, token_amount: 10, from_address_label: 'private', to_address_label: 'private' }] }] }))
    expect(observations).toHaveLength(2)
    expect(observations[1]).toMatchObject({ kind: 'TOKEN_TRANSFER', transactionHash: hash, fromAddress: from, toAddress: to, asset: token, amount: 10 })
    expect(JSON.stringify(observations)).not.toContain('private')
  })

  it('fails closed for absent transfer structure and incompatible token identity', () => {
    expect(() => parseObservations(item({ data: [{ chain: 'ethereum', transaction_hash: hash, from_address: from, to_address: to, block_timestamp: '2023-03-13T09:00:00Z' }] }))).toThrow(/token_transfer_array/)
    expect(() => parseObservations(item({ data: [{ chain: 'ethereum', transaction_hash: hash, from_address: from, to_address: to, block_timestamp: '2023-03-13T09:00:00Z', token_transfer_array: [{ transfer_id: `${hash}-1`, from_address: from, to_address: to, token_amount: 10 }] }] }))).toThrow(/token_address/)
  })

  it('classifies post-cutoff response evidence as inadmissible instead of publishing it', () => {
    const [observation] = parseObservations(item({ data: [{ chain: 'ethereum', transaction_hash: hash, from_address: from, to_address: to, block_timestamp: '2023-03-13T12:20:00Z', token_transfer_array: [] }] }))
    expect(toNormalizedRecord(candidate, observation!)).toMatchObject({ temporalClass: 'UNKNOWN', admissibleToChrono: false })
  })

  it('treats provider timestamps without an explicit suffix as UTC rather than local time', () => {
    const [observation] = parseObservations(item({ data: [{ chain: 'ethereum', transaction_hash: hash, from_address: from, to_address: to, block_timestamp: '2023-03-13T09:00:00', token_transfer_array: [] }] }))
    expect(observation?.observedAtUtc).toBe('2023-03-13T09:00:00.000Z')
    expect(toNormalizedRecord(candidate, observation!)).toMatchObject({ temporalClass: 'HISTORICAL_AT_CUTOFF', admissibleToChrono: true })
  })

  it('keeps provider observations outside the requested context window out of the candidate graph', () => {
    const [observation] = parseObservations(item({ data: [{ chain: 'ethereum', transaction_hash: hash, from_address: from, to_address: to, block_timestamp: '2023-03-13T08:00:00', token_transfer_array: [] }] }))
    expect(isInsideContextWindow(candidate, observation!)).toBe(false)
    expect(toNormalizedRecord(candidate, observation!)).toMatchObject({ temporalClass: 'HISTORICAL_AT_CUTOFF', admissibleToChrono: true })
  })

  it('counts acquired out-of-window rows without emitting invalid normalized records', () => {
    const outside = item({ data: [{ chain: 'ethereum', transaction_hash: hash, from_address: from, to_address: to, block_timestamp: '2023-03-13T08:00:00', token_transfer_array: [] }] })
    const report = buildCandidateReport(candidate, 78, [outside], { endpoints: [] })
    expect(report.omittedEventCensus).toMatchObject({ postCutoffOrUnknown: 0, outOfWindow: 1 })
    expect(report.normalizedEvidenceGraph).toMatchObject({ allEvidence: [], publicEvidenceCount: 0 })
  })

  it('deduplicates semantically identical provider rows before graph validation', () => {
    const observations = parseObservations(item({ data: [{ chain: 'ethereum', transaction_hash: hash, from_address: from, to_address: to, block_timestamp: '2023-03-13T09:00:00Z', token_transfer_array: [{ transfer_id: `${hash}-1`, from_address: from, to_address: to, token_address: token, token_amount: 10 }, { transfer_id: `${hash}-1`, from_address: from, to_address: to, token_address: token, token_amount: 10 }] }] }))
    expect(observations).toHaveLength(3)
    expect(normalizeUniqueEvidence(candidate, observations)).toHaveLength(2)
  })

  it('preserves distinct provider transfer events even when their visible facts match', () => {
    const observations = parseObservations(item({ data: [{ chain: 'ethereum', transaction_hash: hash, from_address: from, to_address: to, block_timestamp: '2023-03-13T09:00:00Z', token_transfer_array: [{ transfer_id: `${hash}-1`, from_address: from, to_address: to, token_address: token, token_amount: 10 }, { transfer_id: `${hash}-2`, from_address: from, to_address: to, token_address: token, token_amount: 10 }] }] }))
    expect(observations).toHaveLength(3)
    expect(normalizeUniqueEvidence(candidate, observations)).toHaveLength(3)
  })

  it('requires transformation evidence to lie on the exact directed route', () => {
    const middle = `0x${'5'.repeat(40)}`
    const routeCandidate: CandidateConfig = {
      ...candidate,
      addresses: { mev_front_runner_exploiter_3: from, main_exploiter_1: `0x${'6'.repeat(40)}`, main_recipient_exploiter_2: to },
      transactions: { mev_dai_withdrawal_to_main_route: hash },
    }
    const observation = (overrides: Partial<StructuredObservation>): StructuredObservation => ({
      kind: 'TRANSACTION', grade: 'EXACT', endpoint: '/api/v1/transaction-with-token-transfer-lookup', rawSha256: digest,
      normalizedSha256: 'b'.repeat(64), retrievedAtUtc: '2026-09-14T12:00:00Z', observedAtUtc: '2023-03-13T09:00:00Z',
      transactionHash: hash, fromAddress: from, toAddress: to, sourcePurpose: 'exact-route', ...overrides,
    })
    const disconnected = evaluateConnectedRoute(routeCandidate, [
      observation({}),
      observation({ kind: 'TOKEN_TRANSFER', transactionHash: `0x${'9'.repeat(64)}`, fromAddress: middle, toAddress: to, asset: token, amount: 10 }),
    ])
    expect(disconnected).toMatchObject({ routeProof: true, transformationProof: false })

    const connected = evaluateConnectedRoute(routeCandidate, [
      observation({ toAddress: middle }),
      observation({ kind: 'TOKEN_TRANSFER', fromAddress: middle, toAddress: to, asset: token, amount: 10 }),
    ])
    expect(connected).toMatchObject({ routeProof: true, transformationProof: true })
    expect(connected.connectedObservations).toHaveLength(2)
  })

  it('counts non-seed route intermediaries before applying the 6–10-node fatal guardrail', () => {
    const intermediaries = Array.from({ length: 9 }, (_, index) => `0x${(index + 10).toString(16).padStart(40, '0')}`)
    const route = [from, ...intermediaries, to]
    const observations = route.slice(0, -1).map<StructuredObservation>((address, index) => ({
      kind: 'TRANSACTION', grade: 'EXACT', endpoint: '/api/v1/transaction-with-token-transfer-lookup', rawSha256: digest,
      normalizedSha256: 'b'.repeat(64), retrievedAtUtc: '2026-09-14T12:00:00Z', observedAtUtc: '2023-03-13T09:00:00Z',
      transactionHash: hash, fromAddress: address, toAddress: route[index + 1]!, sourcePurpose: 'oversized-route',
    }))
    expect(criticalSeedIdentities(candidate, observations, observations)).toHaveLength(12)
  })
})
