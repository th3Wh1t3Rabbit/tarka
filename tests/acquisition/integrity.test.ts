import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { gunzipSync } from 'node:zlib'

import { afterEach, describe, expect, it } from 'vitest'

import type {
  AllowanceUsage,
  CallLedgerRecord,
  EndpointPolicy,
  PlannedRequest,
  ProviderPolicy,
  RequestAllowance,
} from '../../src/acquisition/contracts.js'
import { inspectExplicitCredentialSource, resolveExplicitCredentialStatus } from '../../src/acquisition/integrity/credential.js'
import { evaluateAllowance } from '../../src/acquisition/integrity/governor.js'
import { canonicalJson, fingerprintRequest, hashCanonicalObject, sha256Hex } from '../../src/acquisition/integrity/identity.js'
import { appendLedgerRecord, readLedger, recoverCrashPartialLedgerTail, validateLedgerRecord } from '../../src/acquisition/integrity/ledger.js'
import { canRequestNextPage, getRateDelay, getRetryDecision, parseRetryAfterMs } from '../../src/acquisition/integrity/retry.js'
import { beginRequestAttempt, storeFixtureResponse, verifyContentStore } from '../../src/acquisition/integrity/store.js'
import { createNansenTransport, splitResponseMetadata, validateTransportRequest } from '../../src/acquisition/live/transport.js'
import { LiveAcquisitionSession, type LiveEndpointPolicy, withExclusiveRunLock } from '../../src/acquisition/live/executor.js'
import { MANDATORY_PRECALL_CHECKS, precallSigningPayload, REQUIRED_PRECALL_COMMANDS, verifyPrecallAuthorization, type PrecallAuthorizationReport } from '../../src/acquisition/live/precall.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function temporaryStore() {
  const root = await mkdtemp(join(tmpdir(), 'trace-integrity-'))
  temporaryDirectories.push(root)
  return {
    root,
    roots: { primaryRoot: join(root, 'primary'), mirrorRoot: join(root, 'mirror') },
    ledgerPath: join(root, 'private', 'ledger', 'calls.jsonl'),
  }
}

function request(overrides: Partial<PlannedRequest> = {}): PlannedRequest {
  return {
    identityVersion: '1.0.0',
    endpoint: '/fixture/v1/historical/events',
    endpointClass: 'historical-events',
    apiVersion: 'fixture-v1',
    requestBody: { address: 'synthetic-address', filters: { order: 'asc', limit: 2 } },
    candidateId: 'synthetic-candidate-a',
    purposeId: 'proof-closure',
    temporalWindow: { start: '2024-01-01T00:00:00.000Z', end: '2024-01-02T00:00:00.000Z' },
    normalizationContractVersion: '1.0.0',
    pagination: { page: 1, cursor: null },
    refresh: null,
    ...overrides,
  }
}

const endpointPolicy: EndpointPolicy = {
  endpoint: '/fixture/v1/historical/events',
  apiVersion: 'fixture-v1',
  endpointClass: 'historical-events',
  planningCreditCost: 2,
  allowedLenses: ['ROUTE_SCAN', 'CONVERSION_TRACE'],
  redistribution: 'PUBLIC_ALLOWLISTED',
  maximumPages: 4,
  transport: 'FIXTURE_ONLY_G3',
}

function allowance(overrides: Partial<RequestAllowance> = {}): RequestAllowance {
  return {
    schemaVersion: '1.0.0',
    allowanceId: 'fixture-allowance',
    leadAuthorizationId: 'lead-fixture-authorization',
    approvedCandidateIds: ['synthetic-candidate-a'],
    approvedEndpoints: ['/fixture/v1/historical/events'],
    maximumRequests: 3,
    maximumProjectedCredits: 6,
    maximumPerEndpointCalls: { '/fixture/v1/historical/events': 3 },
    validFromUtc: '2026-09-14T00:00:00.000Z',
    validUntilUtc: '2026-09-15T00:00:00.000Z',
    ...overrides,
  }
}

function usage(overrides: Partial<AllowanceUsage> = {}): AllowanceUsage {
  return { issuedRequests: 0, projectedCredits: 0, endpointCalls: {}, ...overrides }
}

const providerPolicy: Pick<ProviderPolicy, 'minimumDelayMs' | 'retry'> = {
  minimumDelayMs: 1_000,
  retry: {
    maximumAttempts: 3,
    baseDelayMs: 1_000,
    maximumDelayMs: 8_000,
    retryableHttpStatuses: [429, 500, 502, 503, 504],
    nonRetryableHttpStatuses: [400, 401, 402, 403, 404, 422],
  },
}

function storeInput(store: Awaited<ReturnType<typeof temporaryStore>>, overrides: Partial<Parameters<typeof storeFixtureResponse>[0]> = {}): Parameters<typeof storeFixtureResponse>[0] {
  return {
    roots: store.roots,
    ledgerPath: store.ledgerPath,
    request: request(),
    rawBody: JSON.stringify({ data: [{ syntheticId: 'event-1' }], creditsUsed: 2 }),
    plannedCreditEstimate: 2,
    maximumAllowedCredits: 6,
    attemptNumber: 1,
    startedAtUtc: '2026-09-14T12:00:00.000Z',
    completedAtUtc: '2026-09-14T12:00:01.000Z',
    httpStatus: 200,
    returnedCreditMetadata: { creditsUsed: 2 },
    returnedRateMetadata: { remaining: 9 },
    normalizerVersion: 'fixture-normalizer-1.0.0',
    finalStatus: 'SIMULATED',
    ...overrides,
  }
}

function validRecord(overrides: Partial<CallLedgerRecord> = {}): CallLedgerRecord {
  const hash = 'a'.repeat(64)
  return {
    schemaVersion: '1.0.0',
    callSequence: 1,
    candidateId: 'synthetic-candidate-a',
    purposeId: 'proof-closure',
    endpoint: '/fixture/v1/historical/events',
    requestFingerprint: hash,
    canonicalRequestHash: hash,
    plannedCreditEstimate: 2,
    maximumAllowedCredits: 6,
    attemptNumber: 1,
    status: 'IN_PROGRESS',
    startedAtUtc: '2026-09-14T12:00:00.000Z',
    completedAtUtc: null,
    httpStatus: null,
    redactedRequestMetadata: { page: 1, cursorPresent: false },
    providerRequestId: null,
    returnedCreditMetadata: null,
    returnedRateMetadata: null,
    rawSha256: null,
    rawStorageLocations: null,
    normalizedSha256: null,
    normalizerVersion: 'fixture-normalizer-1.0.0',
    decision: { result: 'PENDING', reason: 'RAW_STORAGE_PENDING' },
    publicExportStatus: 'NOT_EVALUATED',
    ...overrides,
  }
}

describe('canonical request identity', () => {
  it('sorts object keys recursively while retaining array order', () => {
    expect(canonicalJson({ z: 1, a: { y: true, x: ['b', 'a'] } })).toBe('{"a":{"x":["b","a"],"y":true},"z":1}')
    expect(hashCanonicalObject({ b: 2, a: 1 })).toBe(hashCanonicalObject({ a: 1, b: 2 }))
    expect(sha256Hex('synthetic')).toMatch(/^[a-f0-9]{64}$/)
  })

  it('changes identity for pages and deliberate refreshes only when explicit', () => {
    const base = fingerprintRequest(request())
    expect(fingerprintRequest(request({ requestBody: { filters: { limit: 2, order: 'asc' }, address: 'synthetic-address' } }))).toBe(base)
    expect(fingerprintRequest(request({ pagination: { page: 2, cursor: 'fixture-page-2' } }))).not.toBe(base)
    expect(fingerprintRequest(request({ refresh: { reason: 'Lead-authorized fixture replay', identity: 'refresh-2' } }))).not.toBe(base)
    expect(() => fingerprintRequest(request({ refresh: { reason: '', identity: 'refresh-2' } }))).toThrow(/deliberate refresh/i)
  })

  it('rejects unsupported and cyclic canonical values', () => {
    expect(() => canonicalJson({ amount: Number.NaN })).toThrow(/finite numbers/i)
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(() => canonicalJson(cyclic as never)).toThrow(/cyclic/i)
  })
})

describe('nonexecuting credential boundary', () => {
  it('reports only redacted status for injected synthetic values', () => {
    const synthetic = ['fixture', 'value', 'only'].join('-')
    const result = inspectExplicitCredentialSource({ environmentValue: synthetic })
    expect(result).toEqual({ status: 'PRESENT', source: 'ENVIRONMENT', redacted: true })
    expect(JSON.stringify(result)).not.toContain(synthetic)
  })

  it('fails closed for absent, conflicting, and header-unsafe inputs', () => {
    expect(inspectExplicitCredentialSource({})).toMatchObject({ status: 'ABSENT', source: 'NONE' })
    expect(inspectExplicitCredentialSource({ environmentValue: ['fixture', 'one'].join('-'), fileValue: ['fixture', 'two'].join('-') })).toMatchObject({ status: 'CONFLICT', source: 'MULTIPLE' })
    expect(inspectExplicitCredentialSource({ fileValue: ['fixture', 'line\nbreak'].join('-') })).toMatchObject({ status: 'INVALID', source: 'EXPLICIT_FILE' })
  })

  it('resolves status only through an explicitly injected future environment reader', async () => {
    const syntheticValue = ['fixture', 'environment', 'value'].join('-')
    const calls: string[] = []
    const result = await resolveExplicitCredentialStatus(
      { kind: 'ENVIRONMENT', identifier: ['FUTURE', 'FIXTURE', 'SOURCE'].join('_') },
      {
        readEnvironment: (identifier) => {
          calls.push(identifier)
          return syntheticValue
        },
        readFile: () => {
          throw new Error('unexpected fixture reader')
        },
      },
    )
    expect(calls).toEqual([['FUTURE', 'FIXTURE', 'SOURCE'].join('_')])
    expect(result).toEqual({ status: 'PRESENT', source: 'ENVIRONMENT', redacted: true })
    expect(JSON.stringify(result)).not.toContain(syntheticValue)
  })

  it('uses only an explicitly injected future file reader and redacts reader failures', async () => {
    const syntheticValue = ['fixture', 'file', 'value'].join('-')
    const syntheticFailure = ['fixture', 'failure', syntheticValue].join('-')
    let fileReads = 0
    let environmentReads = 0
    const readers = {
      readEnvironment: () => {
        environmentReads += 1
        return null
      },
      readFile: () => {
        fileReads += 1
        return syntheticValue
      },
    }
    expect(await resolveExplicitCredentialStatus({ kind: 'EXPLICIT_FILE', path: ['future', 'fixture', 'source'].join('/') }, readers)).toEqual({ status: 'PRESENT', source: 'EXPLICIT_FILE', redacted: true })
    expect(fileReads).toBe(1)
    expect(environmentReads).toBe(0)

    const failure = await resolveExplicitCredentialStatus(
      { kind: 'EXPLICIT_FILE', path: ['future', 'fixture', 'source'].join('/') },
      { ...readers, readFile: () => { throw new Error(syntheticFailure) } },
    )
    expect(failure).toEqual({ status: 'INVALID', source: 'EXPLICIT_FILE', redacted: true })
    expect(JSON.stringify(failure)).not.toContain(syntheticFailure)
  })

  it('does not invoke injected readers without an explicit source and fails closed on empty selectors', async () => {
    let reads = 0
    const readers = {
      readEnvironment: () => { reads += 1; return null },
      readFile: () => { reads += 1; return null },
    }
    expect(await resolveExplicitCredentialStatus(null, readers)).toEqual({ status: 'ABSENT', source: 'NONE', redacted: true })
    expect(await resolveExplicitCredentialStatus({ kind: 'ENVIRONMENT', identifier: ' ' }, readers)).toEqual({ status: 'INVALID', source: 'ENVIRONMENT', redacted: true })
    expect(await resolveExplicitCredentialStatus({ kind: 'EXPLICIT_FILE', path: '' }, readers)).toEqual({ status: 'INVALID', source: 'EXPLICIT_FILE', redacted: true })
    expect(reads).toBe(0)
  })
})

describe('append-only strict ledger', () => {
  it('appends, flushes, reads, and enforces contiguous sequences', async () => {
    const store = await temporaryStore()
    await appendLedgerRecord(store.ledgerPath, validRecord())
    await appendLedgerRecord(store.ledgerPath, validRecord({ callSequence: 2, status: 'FAILED', completedAtUtc: '2026-09-14T12:00:02.000Z', decision: { result: 'REJECTED', reason: 'FIXTURE_FAILURE' } }))
    expect(await readLedger(store.ledgerPath)).toHaveLength(2)
    expect((await readFile(store.ledgerPath, 'utf8')).split('\n')).toHaveLength(3)
    await expect(appendLedgerRecord(store.ledgerPath, validRecord({ callSequence: 4 }))).rejects.toThrow(/not next/i)
  })

  it('quarantines and truncates only an unterminated partial JSON tail, idempotently', async () => {
    const store = await temporaryStore()
    await appendLedgerRecord(store.ledgerPath, validRecord())
    await writeFile(store.ledgerPath, `${await readFile(store.ledgerPath, 'utf8')}{"schemaVersion":"1.0`, 'utf8')
    const recovered = await recoverCrashPartialLedgerTail(store.ledgerPath)
    expect(recovered).toMatchObject({ recovered: true, recoveredByteLength: 21 })
    expect(await readFile(recovered.quarantinedPath as string, 'utf8')).toBe('{"schemaVersion":"1.0')
    expect(await readLedger(store.ledgerPath)).toHaveLength(1)
    expect(await recoverCrashPartialLedgerTail(store.ledgerPath)).toEqual({ recovered: false, quarantinedPath: null, recoveredByteLength: 0 })
    await writeFile(store.ledgerPath, `${await readFile(store.ledgerPath, 'utf8')}{"second":`, 'utf8')
    const secondRecovery = await recoverCrashPartialLedgerTail(store.ledgerPath)
    expect(secondRecovery.recovered).toBe(true)
    expect(secondRecovery.quarantinedPath).not.toBe(recovered.quarantinedPath)
  })

  it('recovers a partial UTF-8 tail but rejects malformed complete and earlier records', async () => {
    const store = await temporaryStore()
    await appendLedgerRecord(store.ledgerPath, validRecord())
    const complete = await readFile(store.ledgerPath)
    await writeFile(store.ledgerPath, Buffer.concat([complete, Buffer.from('{"x":"'), Buffer.from([0xe2, 0x82])]))
    expect((await recoverCrashPartialLedgerTail(store.ledgerPath)).recovered).toBe(true)

    await writeFile(store.ledgerPath, Buffer.from(`${JSON.stringify(validRecord())}\n{bad}\n`))
    await expect(recoverCrashPartialLedgerTail(store.ledgerPath)).rejects.toThrow(/line 2/i)
    await writeFile(store.ledgerPath, Buffer.from(`{bad}\n${JSON.stringify(validRecord({ callSequence: 2 }))}\n`))
    await expect(recoverCrashPartialLedgerTail(store.ledgerPath)).rejects.toThrow(/line 1/i)
  })

  it('leaves empty and complete ledgers intact and fails closed on complete JSON without a newline', async () => {
    const store = await temporaryStore()
    await mkdir(dirname(store.ledgerPath), { recursive: true })
    await writeFile(store.ledgerPath, '')
    expect((await recoverCrashPartialLedgerTail(store.ledgerPath)).recovered).toBe(false)
    await appendLedgerRecord(store.ledgerPath, validRecord())
    expect((await recoverCrashPartialLedgerTail(store.ledgerPath)).recovered).toBe(false)
    await writeFile(store.ledgerPath, JSON.stringify(validRecord()))
    await expect(recoverCrashPartialLedgerTail(store.ledgerPath)).rejects.toThrow(/missing its newline/i)
  })

  it('rejects extra schema keys, unsafe metadata, and malformed JSONL', async () => {
    expect(() => validateLedgerRecord({ ...validRecord(), extra: true })).toThrow(/schema keys/i)
    expect(() => validateLedgerRecord({ ...validRecord(), redactedRequestMetadata: { ['author' + 'ization']: ['Bear', 'er synthetic'].join('') } })).toThrow(/unsafe/i)
    const store = await temporaryStore()
    await mkdir(dirname(store.ledgerPath), { recursive: true })
    await writeFile(store.ledgerPath, '{not-json}\n', 'utf8')
    await expect(readLedger(store.ledgerPath)).rejects.toThrow(/line 1/i)
  })

  it('requires SIMULATED terminal records to carry complete durable metadata', async () => {
    const hollow = validRecord({
      status: 'SIMULATED',
      completedAtUtc: '2026-09-14T12:00:01.000Z',
      httpStatus: 200,
      decision: { result: 'ACCEPTED', reason: 'FIXTURE_SIMULATION' },
    })
    expect(() => validateLedgerRecord(hollow)).toThrow(/terminal records require durable primary, mirror, and normalized content/i)

    const store = await temporaryStore()
    await mkdir(dirname(store.ledgerPath), { recursive: true })
    await writeFile(store.ledgerPath, `${JSON.stringify(hollow)}\n`, 'utf8')
    await expect(readLedger(store.ledgerPath)).rejects.toThrow(/terminal records require/i)
    expect(await verifyContentStore(store.roots, store.ledgerPath)).toMatchObject({
      ok: false,
      checkedRecords: 0,
      errors: [expect.stringMatching(/terminal records require/i)],
    })
  })
})

describe('default-deny allowance governor', () => {
  const evaluate = (allowanceValue = allowance(), usageValue = usage(), requestValue = request(), policyValue = endpointPolicy, nowUtc = '2026-09-14T12:00:00.000Z') => evaluateAllowance({ allowance: allowanceValue, usage: usageValue, request: requestValue, endpointPolicy: policyValue, nowUtc })

  it('allows a request only inside every bound and returns immutable next usage', () => {
    const current = usage()
    const result = evaluate(allowance(), current)
    expect(result).toEqual({
      allowed: true,
      reason: 'ALLOWED',
      projectedRequestCredits: 2,
      nextUsage: { issuedRequests: 1, projectedCredits: 2, endpointCalls: { '/fixture/v1/historical/events': 1 } },
    })
    expect(current).toEqual(usage())
  })

  it('denies candidate, endpoint, time, request, credit, and per-endpoint boundary crossings', () => {
    expect(evaluate(allowance(), usage(), request({ candidateId: 'not-approved' })).reason).toBe('CANDIDATE_NOT_APPROVED')
    expect(evaluate(allowance(), usage(), request({ endpoint: '/fixture/unapproved' })).reason).toBe('ENDPOINT_NOT_APPROVED')
    expect(evaluate(allowance(), usage(), request(), endpointPolicy, '2026-09-15T00:00:00.001Z').reason).toBe('OUTSIDE_VALIDITY_WINDOW')
    expect(evaluate(allowance({ maximumRequests: 1 }), usage({ issuedRequests: 1 })).reason).toBe('REQUEST_LIMIT_EXCEEDED')
    expect(evaluate(allowance({ maximumProjectedCredits: 3 }), usage({ projectedCredits: 2 })).reason).toBe('CREDIT_LIMIT_EXCEEDED')
    expect(evaluate(allowance({ maximumPerEndpointCalls: { '/fixture/v1/historical/events': 1 } }), usage({ endpointCalls: { '/fixture/v1/historical/events': 1 } })).reason).toBe('ENDPOINT_LIMIT_EXCEEDED')
    expect(evaluate(allowance({ maximumPerEndpointCalls: {} })).reason).toBe('ENDPOINT_LIMIT_MISSING')
  })

  it('denies policy mismatch and malformed usage instead of guessing', () => {
    expect(evaluate(allowance(), usage(), request({ apiVersion: 'unapproved-version' })).reason).toBe('POLICY_MISMATCH')
    expect(evaluate(allowance(), usage({ issuedRequests: -1 })).reason).toBe('INVALID_USAGE')
    expect(evaluate(allowance({ approvedCandidateIds: null as never })).reason).toBe('INVALID_ALLOWANCE')
  })
})

describe('conservative retry, rate, and pagination decisions', () => {
  it.each([
    [200, 'SUCCESS'],
    [400, 'AUTH_FAILURE'], [401, 'AUTH_FAILURE'], [402, 'AUTH_FAILURE'], [403, 'AUTH_FAILURE'], [404, 'AUTH_FAILURE'], [422, 'AUTH_FAILURE'],
  ])('does not retry HTTP %i (%s)', (httpStatus, reason) => {
    expect(getRetryDecision({ outcome: { httpStatus }, attemptNumber: 1, policy: providerPolicy })).toMatchObject({ retry: false, reason })
  })

  it('retries 429, 500, and timeout conservatively and stops at the attempt bound', () => {
    expect(getRetryDecision({ outcome: { httpStatus: 429 }, attemptNumber: 1, policy: providerPolicy, jitterUnit: 0 })).toEqual({ retry: true, reason: 'RETRYABLE_STATUS', delayMs: 1_000, nextAttemptNumber: 2 })
    expect(getRetryDecision({ outcome: { httpStatus: 500 }, attemptNumber: 2, policy: providerPolicy, jitterUnit: 1 })).toMatchObject({ retry: true, delayMs: 2_500, nextAttemptNumber: 3 })
    for (const httpStatus of [502, 503, 504]) expect(getRetryDecision({ outcome: { httpStatus }, attemptNumber: 1, policy: providerPolicy })).toMatchObject({ retry: true, reason: 'RETRYABLE_STATUS' })
    expect(getRetryDecision({ outcome: { timeout: true }, attemptNumber: 1, policy: providerPolicy })).toMatchObject({ retry: true, reason: 'TIMEOUT' })
    expect(getRetryDecision({ outcome: { httpStatus: 429 }, attemptNumber: 3, policy: providerPolicy })).toMatchObject({ retry: false, reason: 'ATTEMPTS_EXHAUSTED' })
  })

  it('honors Retry-After and blocks accounting continuation when credits are absent', () => {
    expect(getRetryDecision({ outcome: { httpStatus: 429 }, attemptNumber: 1, policy: providerPolicy, retryAfter: '12', jitterUnit: 0 }).delayMs).toBe(12_000)
    expect(parseRetryAfterMs('Sun, 14 Sep 2026 12:00:05 GMT', '2026-09-14T12:00:00.000Z')).toBe(5_000)
    expect(getRetryDecision({ outcome: { httpStatus: 200 }, attemptNumber: 1, policy: providerPolicy, creditMetadataPresent: false })).toMatchObject({ retry: false, reason: 'MISSING_CREDIT_METADATA' })
    expect(getRateDelay({ minimumDelayMs: 1_000, lastRequestAtUtc: '2026-09-14T12:00:00.000Z', nowUtc: '2026-09-14T12:00:00.250Z' })).toBe(750)
  })

  it('requires allowance and accounting for every bounded, unique page', () => {
    const base = { currentPage: 1, nextCursor: 'fixture-next', seenCursors: [], endpointPolicy, allowanceDecision: { allowed: true }, creditMetadataPresent: true }
    expect(canRequestNextPage(base)).toEqual({ allowed: true, reason: 'NEXT_PAGE_ALLOWED', nextPage: 2, cursor: 'fixture-next' })
    expect(canRequestNextPage({ ...base, allowanceDecision: { allowed: false } }).reason).toBe('ALLOWANCE_DENIED')
    expect(canRequestNextPage({ ...base, creditMetadataPresent: false }).reason).toBe('MISSING_CREDIT_METADATA')
    expect(canRequestNextPage({ ...base, nextCursor: null }).reason).toBe('NO_NEXT_PAGE')
    expect(canRequestNextPage({ ...base, currentPage: 4 }).reason).toBe('PAGE_LIMIT_REACHED')
    expect(canRequestNextPage({ ...base, seenCursors: ['fixture-next'] }).reason).toBe('CURSOR_REPEATED')
  })
})

describe('allowlisted Nansen build-time transport', () => {
  it('uses the exact host/method, captures only approved response headers, and never returns request headers', async () => {
    let observedUrl = ''
    let observedInit: RequestInit | undefined
    const transport = createNansenTransport(async (input, init) => {
      observedUrl = String(input)
      observedInit = init
      return new Response('{"credits_remaining":300}', { status: 200, headers: { 'X-Nansen-Credits-Remaining': '300', 'X-Request-Id': 'fixture-request', 'Set-Cookie': 'never' } })
    })
    const result = await transport({ endpoint: '/api/v1/account', method: 'GET', credential: ['fixture', 'transport', 'value'].join('-') })
    expect(observedUrl).toBe('https://api.nansen.ai/api/v1/account')
    expect((observedInit?.headers as Record<string, string>).apikey).toBeTruthy()
    expect(result.capturedHeaders).toEqual({ 'x-nansen-credits-remaining': '300', 'x-request-id': 'fixture-request' })
    expect(JSON.stringify(result)).not.toContain('fixture-transport-value')
    expect(splitResponseMetadata(result.capturedHeaders)).toEqual({ requestId: 'fixture-request', credit: { 'x-nansen-credits-remaining': '300' }, rate: null })
  })

  it('fails closed for endpoint and method drift', () => {
    expect(() => validateTransportRequest({ endpoint: '/api/v1/smart-money', method: 'POST', body: {} })).toThrow(/endpoint/i)
    expect(() => validateTransportRequest({ endpoint: '/api/v1/account', method: 'POST', body: {} })).toThrow(/method/i)
    expect(() => validateTransportRequest({ endpoint: '/api/v1/profiler/address/transactions', method: 'GET' })).toThrow(/method/i)
  })
})

describe('durable live request execution', () => {
  it('accounts each issued retry, stores both responses twice, and reuses the success without spending', async () => {
    const store = await temporaryStore()
    const liveRequest = request({ endpoint: '/api/v1/profiler/address/transactions', apiVersion: 'nansen-v1' })
    const livePolicy: LiveEndpointPolicy = { ...endpointPolicy, endpoint: liveRequest.endpoint, apiVersion: 'nansen-v1', planningCreditCost: 1, transport: 'NANSEN_BUILD_TIME_G4A', method: 'POST' }
    const liveAllowance = allowance({ approvedEndpoints: [liveRequest.endpoint], maximumRequests: 3, maximumProjectedCredits: 3, maximumPerEndpointCalls: { [liveRequest.endpoint]: 3 } })
    let transportCalls = 0
    let clock = Date.parse('2026-09-14T12:00:00Z')
    const session = new LiveAcquisitionSession({
      roots: store.roots, ledgerPath: store.ledgerPath, allowance: liveAllowance, retryPolicy: { ...providerPolicy, retry: { ...providerPolicy.retry, retryableHttpStatuses: [429, 500, 502, 503, 504], nonRetryableHttpStatuses: [400, 401, 402, 403, 404, 422] } }, credential: 'fixture-live-value',
      candidateLimits: { 'synthetic-candidate-a': { maxHttpAttempts: 3, maxProjectedCredits: 3 } },
      protectedMinimumRemainingCredits: 0,
      now: () => new Date(clock += 1_000), sleep: async () => undefined,
      transport: async () => {
        transportCalls += 1
        return transportCalls === 1
          ? { status: 500, body: Buffer.from('{"error":"temporary"}'), capturedHeaders: { 'retry-after': '0', 'x-nansen-credits-cost': '1', 'x-nansen-credits-used': '1', 'x-nansen-credits-remaining': '299' } }
          : { status: 200, body: Buffer.from('{"data":[{"transaction_hash":"0x01"}]}'), capturedHeaders: { 'x-nansen-credits-cost': '1', 'x-nansen-credits-used': '1', 'x-nansen-credits-remaining': '298', 'x-request-id': 'fixture-live' } }
      },
    })
    session.setCreditBaseline(300)
    const first = await session.execute(liveRequest, livePolicy)
    expect(first).toMatchObject({ reused: false, attemptsIssued: 2, projectedCredits: 2, status: 200 })
    expect((await readLedger(store.ledgerPath)).map(({ status }) => status)).toEqual(['IN_PROGRESS', 'FAILED', 'IN_PROGRESS', 'COMPLETED'])
    const second = await session.execute(liveRequest, livePolicy)
    expect(second).toMatchObject({ reused: true, attemptsIssued: 0, projectedCredits: 0 })
    expect(transportCalls).toBe(2)
    expect(await verifyContentStore(store.roots, store.ledgerPath)).toMatchObject({ ok: true })
  })

  it('refuses to reuse a fresh account preflight and enforces its one-attempt allowance', async () => {
    const store = await temporaryStore()
    const accountRequest = request({ endpoint: '/api/v1/account', apiVersion: 'nansen-v1', requestBody: {}, candidateId: 'account-fixture', refresh: { reason: 'fresh account check', identity: 'run-one' } })
    const accountPolicy: LiveEndpointPolicy = { ...endpointPolicy, endpoint: accountRequest.endpoint, apiVersion: 'nansen-v1', planningCreditCost: 0, transport: 'NANSEN_BUILD_TIME_G4A', method: 'GET' }
    const accountAllowance = allowance({ approvedCandidateIds: ['account-fixture'], approvedEndpoints: [accountRequest.endpoint], maximumRequests: 1, maximumProjectedCredits: 0, maximumPerEndpointCalls: { [accountRequest.endpoint]: 1 } })
    let calls = 0
    const session = new LiveAcquisitionSession({ roots: store.roots, ledgerPath: store.ledgerPath, allowance: accountAllowance, retryPolicy: providerPolicy, credential: 'fixture-account-value', candidateLimits: { 'account-fixture': { maxHttpAttempts: 1, maxProjectedCredits: 0 } }, protectedMinimumRemainingCredits: 0, now: () => new Date('2026-09-14T12:00:00Z'), sleep: async () => undefined, transport: async () => { calls += 1; return { status: 200, body: Buffer.from('{"credits_remaining":300}'), capturedHeaders: {} } } })
    await session.execute(accountRequest, accountPolicy, { allowReuse: false, maximumAttempts: 1 })
    await expect(session.execute(accountRequest, accountPolicy, { allowReuse: false, maximumAttempts: 1 })).rejects.toThrow(/attempt ceiling/i)
    expect(calls).toBe(1)
  })

  it('stops after durably storing a response whose charged cost exceeds reviewed metadata', async () => {
    const store = await temporaryStore()
    const liveRequest = request({ endpoint: '/api/v1/profiler/address/transactions', apiVersion: 'nansen-v1' })
    const livePolicy: LiveEndpointPolicy = { ...endpointPolicy, endpoint: liveRequest.endpoint, apiVersion: 'nansen-v1', planningCreditCost: 1, transport: 'NANSEN_BUILD_TIME_G4A', method: 'POST' }
    const liveAllowance = allowance({ approvedEndpoints: [liveRequest.endpoint], maximumProjectedCredits: 3, maximumPerEndpointCalls: { [liveRequest.endpoint]: 3 } })
    const session = new LiveAcquisitionSession({ roots: store.roots, ledgerPath: store.ledgerPath, allowance: liveAllowance, retryPolicy: providerPolicy, credential: 'fixture-cost-value', candidateLimits: { 'synthetic-candidate-a': { maxHttpAttempts: 3, maxProjectedCredits: 3 } }, protectedMinimumRemainingCredits: 0, now: () => new Date('2026-09-14T12:00:00Z'), sleep: async () => undefined, transport: async () => ({ status: 200, body: Buffer.from('{"data":[]}'), capturedHeaders: { 'x-nansen-credits-cost': '2', 'x-nansen-credits-used': '2', 'x-nansen-credits-remaining': '298' } }) })
    session.setCreditBaseline(300)
    await expect(session.execute(liveRequest, livePolicy)).rejects.toThrow(/unexpected endpoint credit cost/i)
    expect((await readLedger(store.ledgerPath)).map(({ status }) => status)).toEqual(['IN_PROGRESS', 'FAILED'])
  })

  it('does not retry a paid request when transport fails before credit reconciliation', async () => {
    const store = await temporaryStore()
    const liveRequest = request({ endpoint: '/api/v1/profiler/address/transactions', apiVersion: 'nansen-v1' })
    const livePolicy: LiveEndpointPolicy = { ...endpointPolicy, endpoint: liveRequest.endpoint, apiVersion: 'nansen-v1', planningCreditCost: 1, transport: 'NANSEN_BUILD_TIME_G4A', method: 'POST' }
    const liveAllowance = allowance({ approvedEndpoints: [liveRequest.endpoint], maximumProjectedCredits: 3, maximumPerEndpointCalls: { [liveRequest.endpoint]: 3 } })
    let calls = 0
    const session = new LiveAcquisitionSession({ roots: store.roots, ledgerPath: store.ledgerPath, allowance: liveAllowance, retryPolicy: providerPolicy, credential: 'fixture-transport-value', candidateLimits: { 'synthetic-candidate-a': { maxHttpAttempts: 3, maxProjectedCredits: 3 } }, protectedMinimumRemainingCredits: 0, now: () => new Date('2026-09-14T12:00:00Z'), sleep: async () => undefined, transport: async () => { calls += 1; throw new Error('fixture timeout') } })
    session.setCreditBaseline(300)
    await expect(session.execute(liveRequest, livePolicy)).rejects.toThrow(/retry is prohibited/i)
    expect(calls).toBe(1)
    expect((await readLedger(store.ledgerPath)).map(({ status }) => status)).toEqual(['IN_PROGRESS', 'FAILED'])
    const resumed = new LiveAcquisitionSession({ roots: store.roots, ledgerPath: store.ledgerPath, allowance: liveAllowance, retryPolicy: providerPolicy, credential: 'fixture-transport-value', candidateLimits: { 'synthetic-candidate-a': { maxHttpAttempts: 3, maxProjectedCredits: 3 } }, protectedMinimumRemainingCredits: 0, now: () => new Date('2026-09-14T12:00:01Z'), sleep: async () => undefined, transport: async () => { calls += 1; throw new Error('must not issue') } })
    resumed.setCreditBaseline(300)
    await expect(resumed.execute(liveRequest, livePolicy)).rejects.toThrow(/manual credit reconciliation/i)
    expect(calls).toBe(1)
  })

  it('blocks all paid issuing when a prior paid attempt has no terminal reconciliation', async () => {
    const store = await temporaryStore()
    const liveRequest = request({ endpoint: '/api/v1/profiler/address/transactions', apiVersion: 'nansen-v1' })
    const livePolicy: LiveEndpointPolicy = { ...endpointPolicy, endpoint: liveRequest.endpoint, apiVersion: 'nansen-v1', planningCreditCost: 1, transport: 'NANSEN_BUILD_TIME_G4A', method: 'POST' }
    const liveAllowance = allowance({ approvedEndpoints: [liveRequest.endpoint], maximumProjectedCredits: 3, maximumPerEndpointCalls: { [liveRequest.endpoint]: 3 } })
    await beginRequestAttempt(storeInput(store, { request: liveRequest, plannedCreditEstimate: 1, maximumAllowedCredits: 3, redactedRequestMetadata: { allowanceId: liveAllowance.allowanceId }, finalStatus: 'COMPLETED' }))
    let calls = 0
    const session = new LiveAcquisitionSession({ roots: store.roots, ledgerPath: store.ledgerPath, allowance: liveAllowance, retryPolicy: providerPolicy, credential: 'fixture-unmatched-value', candidateLimits: { 'synthetic-candidate-a': { maxHttpAttempts: 3, maxProjectedCredits: 3 } }, protectedMinimumRemainingCredits: 0, now: () => new Date('2026-09-14T12:00:00Z'), sleep: async () => undefined, transport: async () => { calls += 1; return { status: 200, body: Buffer.from('{"data":[]}'), capturedHeaders: {} } } })
    session.setCreditBaseline(300)
    await expect(session.execute(liveRequest, livePolicy)).rejects.toThrow(/manual credit reconciliation/i)
    expect(calls).toBe(0)
  })

  it('enforces the protected credit floor before issue and after durable response storage', async () => {
    const beforeStore = await temporaryStore()
    const liveRequest = request({ endpoint: '/api/v1/profiler/address/transactions', apiVersion: 'nansen-v1' })
    const livePolicy: LiveEndpointPolicy = { ...endpointPolicy, endpoint: liveRequest.endpoint, apiVersion: 'nansen-v1', planningCreditCost: 1, transport: 'NANSEN_BUILD_TIME_G4A', method: 'POST' }
    const liveAllowance = allowance({ approvedEndpoints: [liveRequest.endpoint], maximumProjectedCredits: 3, maximumPerEndpointCalls: { [liveRequest.endpoint]: 3 } })
    let beforeCalls = 0
    const beforeSession = new LiveAcquisitionSession({ roots: beforeStore.roots, ledgerPath: beforeStore.ledgerPath, allowance: liveAllowance, retryPolicy: providerPolicy, credential: 'fixture-floor-before', candidateLimits: { 'synthetic-candidate-a': { maxHttpAttempts: 3, maxProjectedCredits: 3 } }, protectedMinimumRemainingCredits: 250, now: () => new Date('2026-09-14T12:00:00Z'), sleep: async () => undefined, transport: async () => { beforeCalls += 1; return { status: 200, body: Buffer.from('{"data":[]}'), capturedHeaders: {} } } })
    beforeSession.setCreditBaseline(250)
    await expect(beforeSession.execute(liveRequest, livePolicy)).rejects.toThrow(/protected minimum/i)
    expect(beforeCalls).toBe(0)

    const afterStore = await temporaryStore()
    const afterSession = new LiveAcquisitionSession({ roots: afterStore.roots, ledgerPath: afterStore.ledgerPath, allowance: liveAllowance, retryPolicy: providerPolicy, credential: 'fixture-floor-after', candidateLimits: { 'synthetic-candidate-a': { maxHttpAttempts: 3, maxProjectedCredits: 3 } }, protectedMinimumRemainingCredits: 250, now: () => new Date('2026-09-14T12:00:00Z'), sleep: async () => undefined, transport: async () => ({ status: 200, body: Buffer.from('{"data":[]}'), capturedHeaders: { 'x-nansen-credits-cost': '1', 'x-nansen-credits-used': '1', 'x-nansen-credits-remaining': '249' } }) })
    afterSession.setCreditBaseline(252)
    await expect(afterSession.execute(liveRequest, livePolicy)).rejects.toThrow(/protected minimum/i)
    expect((await readLedger(afterStore.ledgerPath)).map(({ status }) => status)).toEqual(['IN_PROGRESS', 'FAILED'])
  })

  it('accounts actual credits within the active numbered allowance rather than prior campaigns', async () => {
    const store = await temporaryStore()
    const historicalRequest = request({ candidateId: 'prior-campaign', purposeId: 'prior-paid-call', refresh: { reason: 'historical fixture', identity: 'prior' } })
    await storeFixtureResponse(storeInput(store, {
      request: historicalRequest,
      plannedCreditEstimate: 50,
      maximumAllowedCredits: 50,
      redactedRequestMetadata: { allowanceId: 'PRIOR-ALLOWANCE' },
      returnedCreditMetadata: { 'x-nansen-credits-used': '50', 'x-nansen-credits-remaining': '300' },
      finalStatus: 'COMPLETED',
    }))
    const liveRequest = request({ endpoint: '/api/v1/profiler/address/transactions', apiVersion: 'nansen-v1' })
    const livePolicy: LiveEndpointPolicy = { ...endpointPolicy, endpoint: liveRequest.endpoint, apiVersion: 'nansen-v1', planningCreditCost: 1, transport: 'NANSEN_BUILD_TIME_G4A', method: 'POST' }
    const isolatedAllowance = allowance({ allowanceId: 'CURRENT-ALLOWANCE', approvedEndpoints: [liveRequest.endpoint], maximumRequests: 1, maximumProjectedCredits: 1, maximumPerEndpointCalls: { [liveRequest.endpoint]: 1 } })
    const session = new LiveAcquisitionSession({
      roots: store.roots, ledgerPath: store.ledgerPath, allowance: isolatedAllowance, retryPolicy: providerPolicy, credential: 'fixture-isolated-value',
      candidateLimits: { 'synthetic-candidate-a': { maxHttpAttempts: 1, maxProjectedCredits: 1 } }, protectedMinimumRemainingCredits: 0,
      now: () => new Date('2026-09-14T12:00:01Z'), sleep: async () => undefined,
      transport: async () => ({ status: 200, body: Buffer.from('{"data":[]}'), capturedHeaders: { 'x-nansen-credits-cost': '1', 'x-nansen-credits-used': '1', 'x-nansen-credits-remaining': '299' } }),
    })
    session.setCreditBaseline(300)
    await expect(session.execute(liveRequest, livePolicy)).resolves.toMatchObject({ attemptsIssued: 1, projectedCredits: 1 })
  })

  it('holds one exclusive run lock and fails closed for a concurrent process', async () => {
    const store = await temporaryStore()
    const lockPath = join(store.root, 'run.lock')
    let release!: () => void
    const held = withExclusiveRunLock(lockPath, async () => new Promise<void>((resolve) => { release = resolve }))
    await new Promise((resolve) => setTimeout(resolve, 10))
    await expect(withExclusiveRunLock(lockPath, async () => undefined)).rejects.toThrow(/concurrent execution/i)
    release()
    await held
    await expect(withExclusiveRunLock(lockPath, async () => 'ok')).resolves.toBe('ok')
  })
})

describe('objective pre-call authorization verification', () => {
  const makeReport = (): PrecallAuthorizationReport => {
    const unsigned = {
      schemaVersion: '1.0.0' as const, generatedAtUtc: '2026-09-14T12:00:00Z', authorizationId: 'LEAD-G4A-NANSEN-DISCOVERY-001', reviewedCommit: 'a'.repeat(40), reviewedTree: 'd'.repeat(40), campaignRootBindingSha256: 'e'.repeat(64), campaignLedgerRecordCount: 0, trackedTreeClean: true,
      credentialInputMode: 'NONE' as const, credentialStatus: 'NOT_RESOLVED_BY_SEQUENCE' as const, checks: Object.fromEntries(MANDATORY_PRECALL_CHECKS.map((name) => [name, true])), snapshots: { endpoints: 'b'.repeat(64) }, commandResults: Object.fromEntries(REQUIRED_PRECALL_COMMANDS.map((name) => [name, { ok: true, outputSha256: 'c'.repeat(64) }])), plannedUse: {}, providerCallsBeforeReport: 0, AUTHORIZED_TO_ISSUE: true,
    }
    return { ...unsigned, verificationSha256: hashCanonicalObject(precallSigningPayload(unsigned)) }
  }

  it('accepts only a fresh report bound to the current reviewed commit and exact snapshots', () => {
    const report = makeReport()
    const expected = { currentCommit: report.reviewedCommit, currentTree: report.reviewedTree, authorizationId: report.authorizationId, campaignRootBindingSha256: report.campaignRootBindingSha256, snapshots: report.snapshots, commandLogHashes: Object.fromEntries(REQUIRED_PRECALL_COMMANDS.map((name) => [name, 'c'.repeat(64)])), nowUtc: '2026-09-14T12:10:00Z' }
    expect(verifyPrecallAuthorization(report, expected)).toEqual(report)
    expect(() => verifyPrecallAuthorization({ ...report, reviewedCommit: 'c'.repeat(40) }, expected)).toThrow(/current reviewed commit/i)
    expect(() => verifyPrecallAuthorization({ ...report, checks: { ...report.checks, secretScan: false } }, expected)).toThrow(/mandatory checks/i)
    expect(() => verifyPrecallAuthorization(report, { ...expected, snapshots: { endpoints: 'c'.repeat(64) } })).toThrow(/snapshot mismatch/i)
    expect(() => verifyPrecallAuthorization(report, { ...expected, nowUtc: '2026-09-15T12:10:00Z' })).toThrow(/stale/i)
  })
})

describe('dual-root raw-write-first fixture storage', () => {
  it('stores exact response bytes as content-addressed gzip before a completed ledger record', async () => {
    const store = await temporaryStore()
    const input = storeInput(store)
    const result = await storeFixtureResponse(input)
    expect(result.disposition).toBe('STORED')
    expect(gunzipSync(await readFile(result.primaryPath))).toEqual(Buffer.from(input.rawBody as string))
    expect(gunzipSync(await readFile(result.mirrorPath))).toEqual(Buffer.from(input.rawBody as string))
    expect((await readLedger(store.ledgerPath)).map(({ status }) => status)).toEqual(['IN_PROGRESS', 'SIMULATED'])
    expect(await verifyContentStore(store.roots, store.ledgerPath)).toMatchObject({ ok: true, checkedRecords: 2, checkedRawObjects: 2, checkedNormalizedObjects: 1 })
  })

  it('deduplicates a completed request without writing or issuing again', async () => {
    const store = await temporaryStore()
    const input = storeInput(store)
    const first = await storeFixtureResponse(input)
    const second = await storeFixtureResponse({ ...input, rawBody: JSON.stringify({ changedFixtureMustNotIssue: true }), startedAtUtc: '2026-09-14T12:01:00.000Z', completedAtUtc: '2026-09-14T12:01:00.001Z' })
    expect(second.disposition).toBe('REUSED')
    expect(second.rawSha256).toBe(first.rawSha256)
    expect((await readLedger(store.ledgerPath)).map(({ status }) => status)).toEqual(['IN_PROGRESS', 'SIMULATED', 'REUSED'])
  })

  it('recovers a crash-partial ledger tail before resume and reuses durable content without double spend', async () => {
    const store = await temporaryStore()
    const input = storeInput(store)
    await storeFixtureResponse(input)
    await writeFile(store.ledgerPath, `${await readFile(store.ledgerPath, 'utf8')}{"crash":`, 'utf8')
    const resumed = await storeFixtureResponse({ ...input, rawBody: '{"must":"not replace durable content"}' })
    expect(resumed.disposition).toBe('REUSED')
    expect((await readLedger(store.ledgerPath)).map(({ status }) => status)).toEqual(['IN_PROGRESS', 'SIMULATED', 'REUSED'])
  })

  it('gives deliberate refresh a new request identity while reusing identical content safely', async () => {
    const store = await temporaryStore()
    const input = storeInput(store)
    const first = await storeFixtureResponse(input)
    const second = await storeFixtureResponse({ ...input, request: request({ refresh: { reason: 'Lead-authorized fixture refresh', identity: 'refresh-2' } }), startedAtUtc: '2026-09-14T12:02:00.000Z', completedAtUtc: '2026-09-14T12:02:01.000Z' })
    expect(second.ledgerRecord.requestFingerprint).not.toBe(first.ledgerRecord.requestFingerprint)
    expect(second.rawSha256).toBe(first.rawSha256)
  })

  it('preserves primary raw bytes on mirror failure and resumes without duplication', async () => {
    const store = await temporaryStore()
    await mkdir(dirname(store.roots.mirrorRoot), { recursive: true })
    await writeFile(store.roots.mirrorRoot, 'fixture obstruction', 'utf8')
    const input = storeInput(store)
    await expect(storeFixtureResponse(input)).rejects.toThrow()
    expect((await readLedger(store.ledgerPath).then((records) => records.map(({ status }) => status)))).toEqual(['IN_PROGRESS'])
    expect(await verifyContentStore(store.roots, store.ledgerPath)).toMatchObject({ ok: false, errors: [expect.stringMatching(/resumable/i)] })

    await rm(store.roots.mirrorRoot)
    const resumed = await storeFixtureResponse({ ...input, completedAtUtc: '2026-09-14T12:00:02.000Z' })
    expect(resumed.disposition).toBe('RESUMED')
    expect((await readLedger(store.ledgerPath)).map(({ status }) => status)).toEqual(['IN_PROGRESS', 'SIMULATED'])
  })

  it('ignores a crash-left temporary file but refuses committed corruption', async () => {
    const store = await temporaryStore()
    const input = storeInput(store)
    const rawHash = sha256Hex(input.rawBody as string)
    const rawDirectory = join(store.roots.primaryRoot, 'raw', 'sha256', rawHash.slice(0, 2))
    await mkdir(rawDirectory, { recursive: true })
    await writeFile(join(rawDirectory, `.${rawHash}.interrupted.tmp`), 'partial fixture bytes', 'utf8')
    const stored = await storeFixtureResponse(input)
    expect(stored.disposition).toBe('STORED')

    await writeFile(stored.primaryPath, 'corrupted fixture bytes', 'utf8')
    await expect(storeFixtureResponse({ ...input, completedAtUtc: '2026-09-14T12:05:00.000Z' })).rejects.toThrow(/corruption/i)
    expect(await verifyContentStore(store.roots, store.ledgerPath)).toMatchObject({ ok: false })
  })

  it('stores raw copies before normalization and resumes after a normalization interruption', async () => {
    const store = await temporaryStore()
    const input = storeInput(store, { rawBody: '{malformed fixture json' })
    await expect(storeFixtureResponse(input)).rejects.toThrow(/after durable raw storage/i)
    expect((await readLedger(store.ledgerPath)).map(({ status }) => status)).toEqual(['IN_PROGRESS'])

    const resumed = await storeFixtureResponse({ ...input, normalize: () => ({ recovered: true }), completedAtUtc: '2026-09-14T12:00:03.000Z' })
    expect(resumed.disposition).toBe('RESUMED')
    expect(await verifyContentStore(store.roots, store.ledgerPath)).toMatchObject({ ok: true })
  })

  it('refuses a configuration that does not provide an independent mirror root', async () => {
    const store = await temporaryStore()
    const sharedRoot = join(store.root, 'shared')
    await expect(storeFixtureResponse(storeInput(store, { roots: { primaryRoot: sharedRoot, mirrorRoot: sharedRoot } }))).rejects.toThrow(/must be distinct/i)
    expect(await readLedger(store.ledgerPath)).toEqual([])
  })
})
