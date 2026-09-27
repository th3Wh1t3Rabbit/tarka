import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { officialContract, resolveLocalSchema } from '../../scripts/nq5/official.mjs'
import { projectResponse } from '../../scripts/nq5/projection.mjs'
import { decimalLexeme, parseExactJson } from '../../scripts/nq5/exact-json.mjs'
import { fixtureCell } from '../fixtures/nq5-offline.mjs'
import { accountReport, candidate, offlineReport } from '../fixtures/nq5-offline.mjs'
import { freezeAcceptedT1 } from '../../scripts/nq5/t1.mjs'
import { resolveApprovedCredential } from '../../scripts/nq5/credential.mjs'
import { buildFrozenFixture } from '../../src/investigation/fixture'
import { createInvestigationState } from '../../src/investigation/state'
import { investigationCue } from '../../src/investigation/cues'

const refresh = JSON.parse(readFileSync('docs/nq5/R1_OFFICIAL_SOURCE_REFRESH.json'))
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(Date.parse(refresh.snapshots[0].retrievedAtUtc) + 1000)) })
afterEach(() => vi.useRealTimers())
const address = `0x${'1'.repeat(40)}`, target = `0x${'2'.repeat(40)}`, token = `0x${'4'.repeat(40)}`

describe('R1 frozen official Nansen contract admission/projection — keyless schema fixtures', () => {
  it.each(['profiler/address/transactions', 'profiler/address/historical-balances'])('admits exact documented path/schema/pricing/rate/coverage/redistribution: %s', (family) => {
    const contract = officialContract(refresh, family, 'FREE')
    expect(contract.snapshotDocuments.endpoint.mode).toBe('NANSEN_OFFICIAL_OPENAPI'); expect(contract.credits).toBe(1); expect(contract.requestsPerMinute).toBe(200)
  })
  it.each(['profiler/address/counterparties', 'profiler/address/historical-transactions', 'transaction-with-token-transfer-lookup'])('fails closed on absent exact-name redistribution rule: %s', (family) => {
    expect(() => officialContract(refresh, family, 'PRO')).toThrow(/unresolved/)
  })
  it('strips nested incidental labels and private prices while preserving numeric token lexemes exactly', () => {
    const contract = officialContract(refresh, 'profiler/address/transactions', 'FREE')
    const bytes = Buffer.from(`{"pagination":{"page":1,"per_page":100,"is_last_page":true},"data":[{"chain":"ethereum","method":"sent","block_timestamp":"2023-03-13T11:38:11Z","transaction_hash":"0x${'3'.repeat(64)}","source_type":"transfer","tokens_sent":[{"token_symbol":"TEST","token_amount":20000000000000000000.125,"token_address":"${token}","chain":"ethereum","from_address":"${address}","to_address":"${target}","from_address_label":"PRIVATE_LABEL","private_header":"SENTINEL_PRIVATE_VALUE","price_usd":10}]}]}`)
    const projection = projectResponse(contract, JSON.parse(bytes), fixtureCell(), '2023-03-13T12:15:00Z', bytes)
    expect(projection.rows[0].amount).toBe('20000000000000000000.125'); expect(JSON.stringify(projection)).not.toMatch(/PRIVATE_LABEL|SENTINEL_PRIVATE_VALUE|price_usd/)
  })
  it('projects official state as bounded balance facts, not a causing transaction', () => {
    const contract = officialContract(refresh, 'profiler/address/historical-balances', 'PRO')
    const bytes = Buffer.from(`{"pagination":{"page":1,"per_page":100,"is_last_page":true},"data":[{"block_timestamp":"2023-03-13T11:38:11Z","token_address":"${token}","chain":"ethereum","token_symbol":"TEST","token_amount":1234.500000000000000001,"value_usd":999}]} `)
    const projection = projectResponse(contract, JSON.parse(bytes), fixtureCell(), '2023-03-13T12:15:00Z', bytes)
    expect(projection.rows[0].balance).toBe('1234.500000000000000001'); expect(projection.rows[0]).not.toHaveProperty('transaction_hash'); expect(projection.rows[0]).not.toHaveProperty('value_usd')
  })
  it('rejects schema drift, unknown plan, post-cutoff values, absent raw lexemes and non-Ethereum chain', () => {
    expect(() => officialContract(refresh, 'profiler/address/transactions', 'OTHER_REDACTED')).toThrow()
    const contract = officialContract(refresh, 'profiler/address/historical-balances', 'PRO')
    const body = { pagination: {}, data: [{ chain: 'solana', token_address: token, token_symbol: 'TEST', block_timestamp: '2023-03-13T11:38:11Z', token_amount: 1 }] }
    expect(() => projectResponse(contract, body, fixtureCell(), '2023-03-13T12:15:00Z', Buffer.from(JSON.stringify(body)))).toThrow()
    expect(() => projectResponse(contract, body, fixtureCell(), '2023-03-13T12:15:00Z')).toThrow()
    body.data[0].chain = 'ethereum'; body.data[0].block_timestamp = '2023-03-14T00:00:00Z'
    expect(() => projectResponse(contract, body, fixtureCell(), '2023-03-13T12:15:00Z', Buffer.from(JSON.stringify(body)))).toThrow()
  })
  it('never resolves remote or recursive contract references', () => {
    expect(() => resolveLocalSchema({}, { $ref: 'https://example.invalid/private' })).toThrow()
    expect(() => resolveLocalSchema({ a: { $ref: '#/a' } }, { $ref: '#/a' })).toThrow()
  })
  it('retains exact exponents and rejects duplicate keys, malformed values and excessive exponents', () => {
    expect(parseExactJson(Buffer.from('{"amount":1.234567890123456789e20}')).amount).toBe('1.234567890123456789e20')
    expect(decimalLexeme('1.234567890123456789e20')).toBe('123456789012345678900')
    expect(decimalLexeme('-1.2e-3')).toBe('-0.0012')
    expect(() => parseExactJson(Buffer.from('{"a":1,"a":2}'))).toThrow()
    expect(() => parseExactJson(Buffer.from('{"a":01}'))).toThrow()
    expect(() => decimalLexeme('1e1001')).toThrow()
  })
  it('freezes only accepted presently issuable page1 questions, with no speculative reserve or floor claim', () => {
    const base = 'public/scenarios/euler-2023-false-exit/'
    const fixture = buildFrozenFixture(JSON.parse(readFileSync(base + 'scenario.json')), JSON.parse(readFileSync(base + 'evidence-graph.json')))
    const frozen = freezeAcceptedT1(refresh, accountReport(5000), fixture)
    expect(frozen.plan.frozen).toBe(false); expect(frozen.report.frozenNextBatchRequests).toBe(0); expect(frozen.plan.requiresVerifiedCampaignHistoryIncludingInitialEmptiness).toBe(true)
    expect(frozen.plan.requests.length).toBeGreaterThan(0); expect(frozen.plan.requests.length).toBeLessThanOrEqual(256); expect(frozen.reserve.requests).toHaveLength(0); expect(frozen.completeTargetPlan).toBe(false)
    expect(frozen.report.blockedFamilies.map(row => row.family)).toEqual(['profiler/address/counterparties', 'transaction-with-token-transfer-lookup'])
    expect(frozen.plan.requests.every(row => row.partition.page === 1)).toBe(true)
    expect(frozen.plan.requests.every((row) => row.partition.minimumWindowSeconds >= 3600 && row.stopRule.includes('durable'))).toBe(true)
    expect(frozen.plan.worstCaseCredits + frozen.reserve.worstCaseCredits).toBeLessThanOrEqual(4750)
    expect(freezeAcceptedT1(refresh, accountReport(250), fixture).plan.frozen).toBe(false)
    const cue = investigationCue(createInvestigationState(fixture)); expect(cue.optional).toBe(true); expect(cue.props.canister).toBe('EMPTY'); expect(cue.fallback).toContain('proof open')
    expect(JSON.stringify(cue)).not.toMatch(/clip|anchor|width|height|frame/)
  }, 20000)
  it('does not examine the environment or explicit credential source until exact-cut offline PASS', () => {
    const environment = vi.fn(() => ({ [['NANSEN', 'API', 'KEY'].join('_')]: 'synthetic_fixture_not_real' }))
    expect(() => resolveApprovedCredential(undefined, candidate, undefined, environment)).toThrow(); expect(environment).not.toHaveBeenCalled()
    expect(resolveApprovedCredential(offlineReport(), candidate, undefined, environment)).toBe('synthetic_fixture_not_real')
    expect(environment).toHaveBeenCalledTimes(1)
  })
})
