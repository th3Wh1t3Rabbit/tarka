import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'

import type { CallLedgerRecord, JsonObject, PlannedRequest, RequestAllowance } from '../../src/acquisition/contracts.js'
import { withExplicitCredential } from '../../src/acquisition/integrity/credential.js'
import { hashCanonicalObject } from '../../src/acquisition/integrity/identity.js'
import { readLedger } from '../../src/acquisition/integrity/ledger.js'
import { verifyContentStore } from '../../src/acquisition/integrity/store.js'
import { LiveAcquisitionSession, withExclusiveRunLock, type LiveEndpointPolicy } from '../../src/acquisition/live/executor.js'
import { createNansenTransport } from '../../src/acquisition/live/transport.js'
import { fail, printReport, readJson, redactPrivatePaths, resolveCredentialSource, resolvePrivateStoreRoot, writeJson } from './common.js'

const candidateId = 'EULER_2023_G6_COVERAGE'
const coreStart = '2023-03-13T08:30:00Z'
const coreEnd = '2023-03-13T12:30:00Z'
const q1Start = '2023-03-13T08:45:00Z'
const q1End = '2023-03-13T11:45:00Z'
const firstEngine = '0xebc29199c817dc47ba12e3f86102564d640cbf99'
const dai = '0x6b175474e89094c44da98b954eedeac495271d0f'
const geometryAddresses = [firstEngine, '0x036cec1a199234fc02f72d29e596a09440825f1c', '0xb66cd966670d962c227b3eaba30a872dbfb995db']
const metadataTokens = ['0xe025e3ca2be02316033184551d4d3aa22024d9dc', '0x6085bc95f506c326dcbcd7a6dd6c79fbc18d4686', '0x028171bca77440897b824ca71d1c56cac55b68a3']
const receivingPoint = '0xb66cd966670d962c227b3eaba30a872dbfb995db'
const extractionEngine = '0x036cec1a199234fc02f72d29e596a09440825f1c'
const exactExpectations: ExactLookupExpectation[] = [
  { transactionHash: '0xc310a0affe2169d1f6feec1c63dbc7f7c62a887fa48795d327d4d2da2d6b111d', observedAtUtc: '2023-03-13T08:50:59Z', callFrom: '0x5f259d0b76665c337c6104145894f4d1d2758b8c', callTo: firstEngine, netAt: { address: firstEngine, assetAddress: dai, amount: 8_877_507.3483067 } },
  { transactionHash: '0x298bde3f9e53f7a5d870f7f5d56ee2f5e41fa25e6eb5e74611ac97025405db55', observedAtUtc: '2023-03-13T09:12:23Z', callFrom: '0xb2698c2d99ad2c302a95a8db26b08d17a77cedd4', callTo: extractionEngine, transfers: [{ from: extractionEngine, to: receivingPoint, assetAddress: dai, amount: 34_186_225.91950095 }, { from: extractionEngine, to: receivingPoint, assetSymbol: 'ETH', amount: 88_752.69745982855 }] },
  { transactionHash: '0xdae809e4a1ddf77c39d44a4acfe6165bedbc19a385c4b241242cc9bd582a80b9', observedAtUtc: '2023-03-13T11:38:11Z', transfers: [{ from: firstEngine, to: receivingPoint, assetAddress: dai, amount: 8_877_507.348306697 }] },
]

interface EndpointFile { endpoints: Array<LiveEndpointPolicy & { method: 'GET' | 'POST' }> }
interface ResultItem { purposeId: string; endpoint: string; reused: boolean; attemptsIssued: number; projectedCredits: number; rawSha256: string; body: unknown }
interface ExactTransferExpectation { from: string; to: string; assetAddress?: string; assetSymbol?: string; amount: number }
interface ExactLookupExpectation { transactionHash: string; observedAtUtc: string; callFrom?: string; callTo?: string; transfers?: ExactTransferExpectation[]; netAt?: { address: string; assetAddress: string; amount: number } }

function endpoint(config: EndpointFile, name: string): LiveEndpointPolicy {
  const matches = config.endpoints.filter(({ endpoint: value }) => value === name)
  if (matches.length !== 1) throw new Error(`Reviewed endpoint policy missing or ambiguous: ${name}`)
  return matches[0]!
}

function planned(policy: LiveEndpointPolicy, purposeId: string, requestBody: JsonObject, temporalWindow = { start: coreStart, end: coreEnd }): PlannedRequest {
  return { identityVersion: '1.0.0', endpoint: policy.endpoint, endpointClass: policy.endpointClass, apiVersion: policy.apiVersion, requestBody, candidateId, purposeId, temporalWindow, normalizationContractVersion: 'g6-nansen-1.0.0', pagination: { page: 1, cursor: null }, refresh: null }
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function parse(bytes: Uint8Array): unknown {
  return JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown
}

function numeric(value: unknown): number | null {
  return (typeof value === 'string' || typeof value === 'number') && Number.isFinite(Number(value)) ? Number(value) : null
}

function canonicalUtc(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const explicitUtc = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`
  if (!Number.isFinite(Date.parse(explicitUtc))) return null
  return new Date(explicitUtc).toISOString().replace('.000Z', 'Z')
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= Math.max(0.000001, Math.abs(right) * 1e-13)
}

export function validateExactLookupResponse(body: unknown, expected: ExactLookupExpectation): boolean {
  const rows = Array.isArray(object(body)?.data) ? object(body)!.data as unknown[] : []
  const row = rows.map(object).find((candidate) => typeof candidate?.transaction_hash === 'string' && candidate.transaction_hash.toLowerCase() === expected.transactionHash)
  if (!row || canonicalUtc(row.block_timestamp) !== expected.observedAtUtc) return false
  if (expected.callFrom && (typeof row.from_address !== 'string' || row.from_address.toLowerCase() !== expected.callFrom)) return false
  if (expected.callTo && (typeof row.to_address !== 'string' || row.to_address.toLowerCase() !== expected.callTo)) return false
  const transfers = Array.isArray(row.token_transfer_array) ? row.token_transfer_array.map(object).filter((value): value is Record<string, unknown> => value !== null) : []
  for (const transfer of expected.transfers ?? []) {
    const match = transfers.some((candidate) => typeof candidate.from_address === 'string' && candidate.from_address.toLowerCase() === transfer.from && typeof candidate.to_address === 'string' && candidate.to_address.toLowerCase() === transfer.to && (transfer.assetAddress === undefined || (typeof candidate.token_address === 'string' && candidate.token_address.toLowerCase() === transfer.assetAddress)) && (transfer.assetSymbol === undefined || (typeof candidate.token_symbol === 'string' && candidate.token_symbol.toUpperCase() === transfer.assetSymbol)) && numeric(candidate.token_amount) !== null && nearlyEqual(numeric(candidate.token_amount)!, transfer.amount))
    if (!match) return false
  }
  if (expected.netAt) {
    const net = transfers.filter((candidate) => typeof candidate.token_address === 'string' && candidate.token_address.toLowerCase() === expected.netAt!.assetAddress).reduce((sum, candidate) => {
      const amount = numeric(candidate.token_amount) ?? 0
      if (typeof candidate.to_address === 'string' && candidate.to_address.toLowerCase() === expected.netAt!.address) return sum + amount
      if (typeof candidate.from_address === 'string' && candidate.from_address.toLowerCase() === expected.netAt!.address) return sum - amount
      return sum
    }, 0)
    if (!nearlyEqual(net, expected.netAt.amount)) return false
  }
  return true
}

function findRemaining(value: unknown): number | null {
  const root = object(value)
  if (!root) return null
  for (const key of ['credits_remaining', 'remaining_credits']) {
    const found = numeric(root[key])
    if (found !== null) return found
  }
  for (const nested of Object.values(root)) {
    const found = findRemaining(nested)
    if (found !== null) return found
  }
  return null
}

async function reuseExactLookup(records: CallLedgerRecord[], expected: ExactLookupExpectation): Promise<{ rawSha256: string; reproduced: boolean } | null> {
  const requestHash = hashCanonicalObject({ chain: 'ethereum', transaction_hash: expected.transactionHash })
  const record = [...records].reverse().find((item) => item.status === 'COMPLETED' && item.endpoint === '/api/v1/transaction-with-token-transfer-lookup' && item.canonicalRequestHash === requestHash && item.rawSha256 && item.rawStorageLocations)
  if (!record?.rawStorageLocations || !record.rawSha256) return null
  const [primary, mirror] = await Promise.all([readFile(record.rawStorageLocations.primary), readFile(record.rawStorageLocations.mirror)])
  if (!primary.equals(mirror)) throw new Error('Durable primary/mirror exact-lookup responses differ')
  const body = parse(gunzipSync(primary))
  return { rawSha256: record.rawSha256, reproduced: validateExactLookupResponse(body, expected) }
}

function sanitizeMetadata(body: unknown, token: string) {
  const data = object(object(body)?.data) ?? {}
  return { tokenAddress: String(data.contract_address ?? data.token_address ?? token).toLowerCase(), name: typeof data.name === 'string' ? data.name : null, symbol: typeof data.symbol === 'string' ? data.symbol : null, decimals: numeric(data.decimals), chain: typeof data.chain === 'string' ? data.chain : 'ethereum', temporalClass: 'CURRENT_METADATA_ONLY' }
}

function sanitizeGeometry(body: unknown, address: string) {
  const data = Array.isArray(object(body)?.data) ? object(body)!.data as unknown[] : []
  return { address, temporalClass: 'CURRENT_RELATIONSHIP_CONTEXT', relationshipCount: data.length, counterparties: data.slice(0, 20).flatMap((row) => { const value = object(row); return typeof value?.counterparty_address === 'string' ? [{ address: value.counterparty_address.toLowerCase(), interactionCount: numeric(value.interaction_count) }] : [] }) }
}

function sanitizeActivity(body: unknown) {
  const data = Array.isArray(object(body)?.data) ? object(body)!.data as unknown[] : []
  const relevant = data.flatMap((row) => {
    const value = object(row)
    if (!value) return []
    const serialized = JSON.stringify(value).toLowerCase()
    if (!serialized.includes(dai)) return []
    return [{ transactionHash: typeof value.transaction_hash === 'string' ? value.transaction_hash.toLowerCase() : null, observedAtUtc: canonicalUtc(value.block_timestamp), method: typeof value.method === 'string' ? value.method : null }]
  })
  return { queriedAddress: firstEngine, window: { startUtc: q1Start, endUtc: q1End }, relevantDaiActivityCount: relevant.length, records: relevant, conclusion: relevant.length === 0 ? 'NO_RELEVANT_DAI_ACTIVITY_RETURNED_IN_WINDOW' : 'RELEVANT_DAI_ACTIVITY_RETURNED; PLAYER COPY REMAINS CONSERVATIVE' }
}

async function main() {
  const mode = process.argv[2]
  if (mode !== 'run') throw new Error('Expected run mode')
  const credentialSource = resolveCredentialSource()
  if (credentialSource === null) throw new Error('Explicit Nansen credential source is required')
  const privateRoot = resolvePrivateStoreRoot()
  const roots = { primaryRoot: path.join(privateRoot, 'primary'), mirrorRoot: path.join(privateRoot, 'mirror') }
  const ledgerPath = path.join(roots.primaryRoot, 'ledger', 'calls.jsonl')
  const allowance = await readJson<RequestAllowance>('src/acquisition/config/g6-nansen-coverage-allowance.json')
  const endpointConfig = await readJson<EndpointFile>('src/acquisition/config/nansen-endpoints.json')
  const use = await withExclusiveRunLock(path.join(privateRoot, 'g6-coverage.lock'), () => withExplicitCredential(credentialSource, { readEnvironment: (name) => process.env[name] ?? null, readFile: async (target) => (await readFile(target, 'utf8')).trim() }, async (credential) => {
    const session = new LiveAcquisitionSession({ roots, ledgerPath, allowance, retryPolicy: { minimumDelayMs: 1_000, retry: { maximumAttempts: 3, baseDelayMs: 1_000, maximumDelayMs: 8_000, retryableHttpStatuses: [429, 500, 502, 503, 504], nonRetryableHttpStatuses: [400, 401, 402, 403, 404, 422] } }, transport: createNansenTransport(), credential, candidateLimits: { G6_ACCOUNT_PREFLIGHT: { maxHttpAttempts: 1, maxProjectedCredits: 0 }, [candidateId]: { maxHttpAttempts: 47, maxProjectedCredits: 120 } }, protectedMinimumRemainingCredits: 250 })
    const accountPolicy = endpoint(endpointConfig, '/api/v1/account')
    const now = new Date().toISOString()
    const accountRequest: PlannedRequest = { ...planned(accountPolicy, 'g6-zero-credit-account-preflight', {}, { start: now, end: now }), candidateId: 'G6_ACCOUNT_PREFLIGHT', refresh: { reason: 'Fresh G6 account preflight', identity: hashCanonicalObject({ authorizationId: allowance.leadAuthorizationId, at: now }) } }
    const account = await session.execute(accountRequest, accountPolicy, { allowReuse: false, maximumAttempts: 1 })
    const remaining = findRemaining(parse(account.rawBody)) ?? findRemaining(account.creditMetadata)
    if (remaining === null || remaining < 250) throw new Error('Account preflight did not establish the protected credit floor')
    const prior = await readLedger(ledgerPath)
    const priorRemaining = [...prior].reverse().flatMap(({ returnedCreditMetadata }) => { const value = numeric(returnedCreditMetadata?.['x-nansen-credits-remaining']); return value === null || value > remaining ? [] : [value] }).at(0) ?? remaining
    session.setCreditBaseline(remaining, priorRemaining)

    const results: ResultItem[] = []
    const execute = async (request: PlannedRequest, policy: LiveEndpointPolicy) => {
      const result = await session.execute(request, policy, { maximumAttempts: 3 })
      results.push({ purposeId: request.purposeId, endpoint: request.endpoint, reused: result.reused, attemptsIssued: result.attemptsIssued, projectedCredits: result.projectedCredits, rawSha256: result.rawSha256, body: parse(result.rawBody) })
    }

    const transactionPolicy = endpoint(endpointConfig, '/api/v1/profiler/address/transactions')
    await execute(planned(transactionPolicy, 'Q1_FIRST_ENGINE_ACTIVITY', { address: firstEngine, chain: 'ethereum', date: { from: q1Start, to: q1End }, hide_spam_token: true, filters: { token_address: dai }, pagination: { page: 1, per_page: 100 } }, { start: q1Start, end: q1End }), transactionPolicy)

    const durable = await readLedger(ledgerPath)
    const q2 = []
    for (const expected of exactExpectations) {
      const reused = await reuseExactLookup(durable, expected)
      if (!reused?.reproduced) throw new Error('Q2 critical relationship is missing from durable exact lookup evidence')
      q2.push({ transactionHash: expected.transactionHash, observedAtUtc: expected.observedAtUtc, responseReused: true, rawSha256: reused.rawSha256, relationshipReproduced: true, validation: expected.netAt ? 'TRANSACTION_LOCAL_NET_AT_ENGINE' : 'EXACT_FROM_TO_ASSET_AMOUNT_TIMESTAMP' })
    }

    const metadataPolicy = endpoint(endpointConfig, '/api/v1/tgm/token-information')
    for (const token of metadataTokens) await execute(planned(metadataPolicy, `Q3_PROTOCOL_METADATA_${token.slice(2, 10)}`, { chain: 'ethereum', token_address: token, timeframe: '1d' }, { start: now, end: now }), metadataPolicy)

    const counterpartiesPolicy = endpoint(endpointConfig, '/api/v1/profiler/address/counterparties')
    for (const address of geometryAddresses) await execute(planned(counterpartiesPolicy, `Q4_RELATIONSHIP_GEOMETRY_${address.slice(2, 10)}`, { address, chain: 'ethereum', date: { from: coreStart, to: coreEnd }, source_input: 'Combined', group_by: 'wallet', pagination: { page: 1, per_page: 20 } }), counterpartiesPolicy)

    const ledger = await readLedger(ledgerPath)
    const starts = ledger.filter((record) => record.status === 'IN_PROGRESS' && record.redactedRequestMetadata.allowanceId === allowance.allowanceId)
    const terminals = ledger.filter((record) => ['COMPLETED', 'FAILED'].includes(record.status) && record.redactedRequestMetadata.allowanceId === allowance.allowanceId)
    const actualCredits = terminals.reduce((sum, record) => sum + (numeric(record.returnedCreditMetadata?.['x-nansen-credits-used']) ?? record.plannedCreditEstimate), 0)
    if (starts.length > 20 || actualCredits > 50) throw new Error('G6 soft target reached before Q1-Q4 stop condition')
    const q1 = sanitizeActivity(results.find(({ purposeId }) => purposeId === 'Q1_FIRST_ENGINE_ACTIVITY')?.body)
    const q3 = results.filter(({ purposeId }) => purposeId.startsWith('Q3_')).map((item, index) => sanitizeMetadata(item.body, metadataTokens[index]!))
    const q4 = results.filter(({ purposeId }) => purposeId.startsWith('Q4_')).map((item, index) => sanitizeGeometry(item.body, geometryAddresses[index]!))
    const store = await verifyContentStore(roots, ledgerPath)
    if (!store.ok) throw new Error('Private primary/mirror store verification failed after coverage run')
    const responseRecords = results.map((item) => ({ purposeId: item.purposeId, endpoint: item.endpoint, reused: item.reused, attemptsIssued: item.attemptsIssued, projectedCredits: item.projectedCredits, rawSha256: item.rawSha256 }))
    const report = redactPrivatePaths({ schemaVersion: '1.0.0', status: 'COMPLETED_STOP_CONDITION_MET', authorizationId: allowance.leadAuthorizationId, provider: 'Nansen', credentialStatus: 'PRESENT_REDACTED', countTowardBuildathon1000: false, alchemyCallsInsideLane: 0, stopReason: 'Q1_THROUGH_Q4_SUFFICIENTLY_ANSWERED', usage: { httpAttempts: starts.length, projectedCredits: starts.reduce((sum, record) => sum + record.plannedCreditEstimate, 0), actualCredits, softTarget: { httpAttempts: 20, credits: 50 }, hardMaximum: { httpAttempts: 48, credits: 120 } }, accountPreflight: { result: 'PASS', projectedCredits: 0, remainingCredits: remaining, rawSha256: account.rawSha256 }, answers: { Q1_FIRST_ENGINE_ACTIVITY: q1, Q2_POINT_IN_TIME_ANCHORS: q2, Q3_PROTOCOL_METADATA: q3, Q4_RELATIONSHIP_GEOMETRY: q4 }, rawResponses: responseRecords, durableStore: store, currentMetadataCannotProveHistory: true, relationshipGeometryCannotProveIdentity: true }, privateRoot)
    await writeJson('artifacts/g6/NANSEN_EULER_COVERAGE_REPORT.json', report)
    return report
  }))
  if (use.presence.status !== 'PRESENT' || use.value === undefined) throw new Error('Authorized project credential could not be resolved safely')
  printReport(use.value)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(fail)
