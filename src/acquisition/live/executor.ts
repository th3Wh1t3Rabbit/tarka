import type { AllowanceUsage, EndpointPolicy, JsonObject, PlannedRequest, ProviderPolicy, RequestAllowance, StoreRoots } from '../contracts.js'
import { evaluateAllowance } from '../integrity/governor.js'
import { fingerprintRequest } from '../integrity/identity.js'
import { readLedger } from '../integrity/ledger.js'
import { getRetryDecision } from '../integrity/retry.js'
import { beginRequestAttempt, failRequestAttempt, loadReusableResponse, storeFixtureResponse } from '../integrity/store.js'
import { splitResponseMetadata, type TransportResponse } from './transport.js'
import { mkdir, open, rm } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface LiveEndpointPolicy extends EndpointPolicy {
  method: 'GET' | 'POST'
}

export interface LiveExecutionResult {
  reused: boolean
  attemptsIssued: number
  projectedCredits: number
  status: number
  rawBody: Uint8Array
  rawSha256: string
  normalizedSha256: string
  creditMetadata: JsonObject | null
  rateMetadata: JsonObject | null
}

export interface LiveSessionOptions {
  roots: StoreRoots
  ledgerPath: string
  allowance: RequestAllowance
  retryPolicy: Pick<ProviderPolicy, 'minimumDelayMs' | 'retry'>
  transport: (input: { endpoint: string; method: 'GET' | 'POST'; body?: JsonObject; credential: string }) => Promise<TransportResponse>
  credential: string
  sleep?: (milliseconds: number) => Promise<void>
  now?: () => Date
  candidateLimits: Record<string, { maxHttpAttempts: number; maxProjectedCredits: number }>
  protectedMinimumRemainingCredits: number
}

export interface ExecutionControls {
  allowReuse?: boolean
  maximumAttempts?: number
}

export async function withExclusiveRunLock<T>(lockPath: string, operation: () => Promise<T>): Promise<T> {
  await mkdir(dirname(lockPath), { recursive: true })
  let handle: Awaited<ReturnType<typeof open>>
  try {
    handle = await open(lockPath, 'wx')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('Acquisition run lock is already held; concurrent execution is prohibited', { cause: error })
    throw error
  }
  try {
    await handle.writeFile(`${process.pid}\n`, 'utf8')
    await handle.sync()
    return await operation()
  } finally {
    await handle.close()
    await rm(lockPath, { force: true })
  }
}

function usageFromIssuedAttempts(records: Awaited<ReturnType<typeof readLedger>>, allowanceId: string): AllowanceUsage {
  return records.filter((record) => record.status === 'IN_PROGRESS' && record.redactedRequestMetadata.allowanceId === allowanceId)
    .reduce<AllowanceUsage>((usage, record) => ({
      issuedRequests: usage.issuedRequests + 1,
      projectedCredits: usage.projectedCredits + record.plannedCreditEstimate,
      endpointCalls: { ...usage.endpointCalls, [record.endpoint]: (usage.endpointCalls[record.endpoint] ?? 0) + 1 },
    }), { issuedRequests: 0, projectedCredits: 0, endpointCalls: {} })
}

function numericMetadata(metadata: JsonObject | null, key: string): number | null {
  const value = metadata?.[key]
  if ((typeof value !== 'string' && typeof value !== 'number') || !Number.isFinite(Number(value))) return null
  return Number(value)
}

function candidateIssuedUsage(records: Awaited<ReturnType<typeof readLedger>>, candidateId: string): { attempts: number; projectedCredits: number; actualCredits: number } {
  const starts = records.filter((record) => record.status === 'IN_PROGRESS' && record.candidateId === candidateId)
  const terminals = records.filter((record) => ['COMPLETED', 'FAILED'].includes(record.status) && record.candidateId === candidateId)
  return {
    attempts: starts.length,
    projectedCredits: starts.reduce((sum, record) => sum + record.plannedCreditEstimate, 0),
    actualCredits: terminals.reduce((sum, record) => sum + (numericMetadata(record.returnedCreditMetadata, 'x-nansen-credits-used') ?? record.plannedCreditEstimate), 0),
  }
}

function allActualCredits(records: Awaited<ReturnType<typeof readLedger>>, allowanceId: string): number {
  return records.filter((record) => ['COMPLETED', 'FAILED'].includes(record.status) && record.redactedRequestMetadata.allowanceId === allowanceId)
    .reduce((sum, record) => sum + (numericMetadata(record.returnedCreditMetadata, 'x-nansen-credits-used') ?? record.plannedCreditEstimate), 0)
}

function hasUnreconciledPaidAttempt(records: Awaited<ReturnType<typeof readLedger>>, allowanceId: string): boolean {
  const terminalAttempts = new Set(records
    .filter((record) => ['COMPLETED', 'FAILED'].includes(record.status) && record.redactedRequestMetadata.allowanceId === allowanceId)
    .map((record) => `${record.requestFingerprint}:${record.attemptNumber}`))
  const unmatched = records.some((record) => record.status === 'IN_PROGRESS'
    && record.redactedRequestMetadata.allowanceId === allowanceId
    && record.plannedCreditEstimate > 0
    && !terminalAttempts.has(`${record.requestFingerprint}:${record.attemptNumber}`))
  if (unmatched) return true
  return records.some((record) => {
    if (record.status !== 'FAILED' || record.redactedRequestMetadata.allowanceId !== allowanceId || record.plannedCreditEstimate <= 0) return false
    const cost = numericMetadata(record.returnedCreditMetadata, 'x-nansen-credits-cost')
    const used = numericMetadata(record.returnedCreditMetadata, 'x-nansen-credits-used')
    const remaining = numericMetadata(record.returnedCreditMetadata, 'x-nansen-credits-remaining')
    return record.decision.reason !== 'HTTP_ERROR_RESPONSE_DURABLY_STORED'
      || cost !== record.plannedCreditEstimate
      || used === null
      || used < 0
      || used > record.plannedCreditEstimate
      || remaining === null
  })
}

function parseProviderBody(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown
  } catch {
    return { nonJsonResponse: Buffer.from(bytes).toString('utf8') }
  }
}

export class LiveAcquisitionSession {
  private lastIssuedAtMs: number | null = null
  private creditBaseline: number | null = null
  private lastReportedCredits: number | null = null
  private readonly sleep: (milliseconds: number) => Promise<void>
  private readonly now: () => Date

  constructor(private readonly options: LiveSessionOptions) {
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)))
    this.now = options.now ?? (() => new Date())
  }

  setCreditBaseline(remainingCredits: number, latestDurableRemainingCredits = remainingCredits): void {
    if (!Number.isFinite(remainingCredits) || remainingCredits < 0 || !Number.isFinite(latestDurableRemainingCredits) || latestDurableRemainingCredits < 0 || latestDurableRemainingCredits > remainingCredits) throw new Error('Credit baseline is invalid')
    if (remainingCredits - latestDurableRemainingCredits > this.options.allowance.maximumProjectedCredits) throw new Error('Durable credit history exceeds the global allowance')
    this.creditBaseline = remainingCredits
    this.lastReportedCredits = latestDurableRemainingCredits
  }

  async execute(request: PlannedRequest, endpointPolicy: LiveEndpointPolicy, controls: ExecutionControls = {}): Promise<LiveExecutionResult> {
    const initialRecords = await readLedger(this.options.ledgerPath)
    if (endpointPolicy.planningCreditCost > 0 && hasUnreconciledPaidAttempt(initialRecords, this.options.allowance.allowanceId)) {
      throw new Error('Unreconciled paid attempt requires manual credit reconciliation; automatic reissue is prohibited')
    }
    const reusable = controls.allowReuse === false ? null : await loadReusableResponse(this.options.roots, this.options.ledgerPath, request)
    if (reusable !== null) {
      return {
        reused: true,
        attemptsIssued: 0,
        projectedCredits: 0,
        status: reusable.ledgerRecord.httpStatus ?? 200,
        rawBody: reusable.rawBody,
        rawSha256: reusable.ledgerRecord.rawSha256 as string,
        normalizedSha256: reusable.ledgerRecord.normalizedSha256 as string,
        creditMetadata: reusable.ledgerRecord.returnedCreditMetadata,
        rateMetadata: reusable.ledgerRecord.returnedRateMetadata,
      }
    }

    const requestFingerprint = fingerprintRequest(request)
    const priorRecords = await readLedger(this.options.ledgerPath)
    let attempt = priorRecords.filter((record) => record.status === 'IN_PROGRESS' && record.requestFingerprint === requestFingerprint).length + 1
    const maximumAttempts = Math.min(controls.maximumAttempts ?? this.options.retryPolicy.retry.maximumAttempts, this.options.retryPolicy.retry.maximumAttempts)
    if (attempt > maximumAttempts) throw new Error('Request attempt ceiling exhausted before issue')
    while (attempt <= maximumAttempts) {
      const records = await readLedger(this.options.ledgerPath)
      const usage = usageFromIssuedAttempts(records, this.options.allowance.allowanceId)
      const decision = evaluateAllowance({ allowance: this.options.allowance, usage, request, endpointPolicy, nowUtc: this.now().toISOString() })
      if (!decision.allowed) throw new Error(`Allowance denied before HTTP attempt: ${decision.reason}`)
      if (allActualCredits(records, this.options.allowance.allowanceId) + endpointPolicy.planningCreditCost > this.options.allowance.maximumProjectedCredits) throw new Error('Global actual-credit ceiling would be exceeded')
      if (endpointPolicy.planningCreditCost > 0) {
        if (this.lastReportedCredits === null) throw new Error('Paid request prohibited before account-credit baseline')
        if (this.lastReportedCredits - endpointPolicy.planningCreditCost < this.options.protectedMinimumRemainingCredits) throw new Error('Protected minimum credit balance would be crossed')
      }

      const candidateLimit = this.options.candidateLimits[request.candidateId]
      if (!candidateLimit) throw new Error('Candidate has no approved live-attempt budget')
      const candidateUsage = candidateIssuedUsage(records, request.candidateId)
      if (candidateUsage.attempts + 1 > candidateLimit.maxHttpAttempts) throw new Error('Candidate HTTP-attempt ceiling would be exceeded')
      if (candidateUsage.projectedCredits + endpointPolicy.planningCreditCost > candidateLimit.maxProjectedCredits) throw new Error('Candidate projected-credit ceiling would be exceeded')
      if (candidateUsage.actualCredits + endpointPolicy.planningCreditCost > candidateLimit.maxProjectedCredits) throw new Error('Candidate actual-credit ceiling would be exceeded')

      const persistedLast = records.filter(({ status }) => status === 'IN_PROGRESS').map(({ startedAtUtc }) => Date.parse(startedAtUtc)).filter(Number.isFinite).at(-1) ?? null
      const previousIssuedAt = Math.max(this.lastIssuedAtMs ?? 0, persistedLast ?? 0)
      if (previousIssuedAt > 0) {
        const delay = Math.max(0, this.options.retryPolicy.minimumDelayMs - (this.now().getTime() - previousIssuedAt))
        if (delay > 0) await this.sleep(delay)
      }
      const startedAtUtc = this.now().toISOString()
      const baseInput = {
        roots: this.options.roots,
        ledgerPath: this.options.ledgerPath,
        request,
        rawBody: new Uint8Array(),
        plannedCreditEstimate: endpointPolicy.planningCreditCost,
        maximumAllowedCredits: this.options.allowance.maximumProjectedCredits,
        attemptNumber: attempt,
        startedAtUtc,
        completedAtUtc: startedAtUtc,
        httpStatus: 200,
        redactedRequestMetadata: {
          allowanceId: this.options.allowance.allowanceId,
          apiVersion: request.apiVersion,
          endpointClass: request.endpointClass,
          page: request.pagination.page,
          cursorPresent: request.pagination.cursor !== null,
          deliberateRefresh: request.refresh !== null,
        },
        normalizerVersion: request.normalizationContractVersion,
      } as const
      await beginRequestAttempt(baseInput)
      this.lastIssuedAtMs = this.now().getTime()

      let response: TransportResponse
      try {
        response = await this.options.transport({
          endpoint: request.endpoint,
          method: endpointPolicy.method,
          ...(endpointPolicy.method === 'POST' ? { body: request.requestBody } : {}),
          credential: this.options.credential,
        })
      } catch {
        const completedAtUtc = this.now().toISOString()
        await failRequestAttempt({ ...baseInput, completedAtUtc }, 'TRANSPORT_FAILURE_NO_RESPONSE')
        if (endpointPolicy.planningCreditCost > 0) throw new Error('Paid transport failed without a reconcilable response; retry is prohibited')
        if (attempt >= maximumAttempts) throw new Error('Transport failed: ATTEMPTS_EXHAUSTED')
        const retry = getRetryDecision({ outcome: { timeout: true }, attemptNumber: attempt, policy: this.options.retryPolicy })
        if (!retry.retry) throw new Error(`Transport failed: ${retry.reason}`)
        await this.sleep(retry.delayMs)
        attempt = retry.nextAttemptNumber as number
        continue
      }

      const metadata = splitResponseMetadata(response.capturedHeaders)
      const completedAtUtc = this.now().toISOString()
      let accountingFailure: string | null = null
      let reconciledRemaining: number | null = null
      if (endpointPolicy.planningCreditCost > 0) {
        const quotedCost = numericMetadata(metadata.credit, 'x-nansen-credits-cost')
        const usedCredits = numericMetadata(metadata.credit, 'x-nansen-credits-used')
        const remainingCredits = numericMetadata(metadata.credit, 'x-nansen-credits-remaining')
        if (quotedCost === null || usedCredits === null || remainingCredits === null) accountingFailure = 'Paid response is missing mandatory credit accounting headers'
        else if (quotedCost !== endpointPolicy.planningCreditCost || usedCredits > endpointPolicy.planningCreditCost || usedCredits < 0) accountingFailure = 'Unexpected endpoint credit cost; acquisition stopped after durable storage'
        else if (this.creditBaseline === null || this.lastReportedCredits === null) accountingFailure = 'Paid response arrived before account-credit baseline'
        else if (remainingCredits < this.options.protectedMinimumRemainingCredits) accountingFailure = 'Protected minimum credit balance was crossed; acquisition stopped after durable storage'
        else if (remainingCredits > this.lastReportedCredits || this.lastReportedCredits - remainingCredits !== usedCredits || this.creditBaseline - remainingCredits > this.options.allowance.maximumProjectedCredits) accountingFailure = 'Running provider-credit reconciliation failed'
        else reconciledRemaining = remainingCredits
      }
      const acceptedResponse = response.status === 200 && accountingFailure === null
      const stored = await storeFixtureResponse({
        ...baseInput,
        completedAtUtc,
        httpStatus: response.status,
        rawBody: response.body,
        normalize: (exact) => parseProviderBody(exact) as never,
        providerRequestId: metadata.requestId,
        returnedCreditMetadata: metadata.credit,
        returnedRateMetadata: metadata.rate,
        finalStatus: acceptedResponse ? 'COMPLETED' : 'FAILED',
        decision: acceptedResponse
          ? { result: 'ACCEPTED', reason: 'HTTP_RESPONSE_DURABLY_STORED' }
          : { result: 'REJECTED', reason: accountingFailure === null ? 'HTTP_ERROR_RESPONSE_DURABLY_STORED' : 'CREDIT_ACCOUNTING_POLICY_REJECTED' },
        publicExportStatus: acceptedResponse && endpointPolicy.redistribution === 'PUBLIC_ALLOWLISTED' ? 'ALLOWED' : 'REJECTED',
      })
      if (accountingFailure !== null) throw new Error(accountingFailure)
      if (reconciledRemaining !== null) this.lastReportedCredits = reconciledRemaining
      if (response.status === 200) {
        return {
          reused: false,
          attemptsIssued: attempt,
          projectedCredits: endpointPolicy.planningCreditCost * attempt,
          status: response.status,
          rawBody: response.body,
          rawSha256: stored.rawSha256,
          normalizedSha256: stored.normalizedSha256,
          creditMetadata: metadata.credit,
          rateMetadata: metadata.rate,
        }
      }
      const retry = getRetryDecision({
        outcome: { httpStatus: response.status },
        attemptNumber: attempt,
        policy: this.options.retryPolicy,
        retryAfter: response.capturedHeaders['retry-after'] ?? null,
        nowUtc: completedAtUtc,
      })
      if (attempt >= maximumAttempts) throw new Error(`HTTP ${response.status}: ATTEMPTS_EXHAUSTED`)
      if (!retry.retry) throw new Error(`HTTP ${response.status}: ${retry.reason}`)
      await this.sleep(retry.delayMs)
      attempt = retry.nextAttemptNumber as number
    }
    throw new Error('Retry loop exhausted')
  }
}
