import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'

import type { CallLedgerRecord, JsonObject } from '../../src/acquisition/contracts.js'
import { fingerprintRequest, hashCanonicalObject, sha256Hex } from '../../src/acquisition/integrity/identity.js'
import { findCompletedRequest, readLedger } from '../../src/acquisition/integrity/ledger.js'
import { verifyContentStore } from '../../src/acquisition/integrity/store.js'
import { precallSigningPayload, type PrecallAuthorizationReport } from '../../src/acquisition/live/precall.js'
import { buildCandidateReport, candidateRequestPlan, type AcquiredItem, type CandidateConfig, type EndpointConfigFile } from './g4a-audition.js'
import { fail, printReport, readJson, resolvePrivateStoreRoot, writeJson } from './common.js'

interface CandidateConfigFile {
  schemaVersion: string
  threshold: number
  priorityOrder: string[]
  candidates: CandidateConfig[]
}

function metadataNumber(record: CallLedgerRecord, name: string): number | null {
  const value = record.returnedCreditMetadata?.[name]
  return (typeof value === 'string' || typeof value === 'number') && Number.isFinite(Number(value)) ? Number(value) : null
}

async function main() {
  const gitRoot = path.resolve(execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim())
  if (gitRoot !== path.resolve(process.cwd())) throw new Error('G4A must run from the canonical repository root')
  const campaignRoot = resolvePrivateStoreRoot()

  const precall = await readJson<PrecallAuthorizationReport>('artifacts/g4a/PRECALL_AUTHORIZATION_REPORT.json')
  if (!precall.AUTHORIZED_TO_ISSUE || precall.authorizationId !== 'LEAD-G4A-NANSEN-DISCOVERY-001') throw new Error('Original pre-call authorization is not valid')
  if (precall.campaignRootBindingSha256 !== sha256Hex(campaignRoot) || precall.verificationSha256 !== hashCanonicalObject(precallSigningPayload(precall))) throw new Error('Original pre-call authorization integrity failed')
  execFileSync('git', ['merge-base', '--is-ancestor', precall.reviewedCommit, 'HEAD'])

  const roots = { primaryRoot: path.join(campaignRoot, 'primary'), mirrorRoot: path.join(campaignRoot, 'mirror') }
  const ledgerPath = path.join(roots.primaryRoot, 'ledger', 'calls.jsonl')
  const storeVerification = await verifyContentStore(roots, ledgerPath)
  if (!storeVerification.ok) throw new Error(`Private content store failed verification: ${storeVerification.errors.join('; ')}`)
  const records = await readLedger(ledgerPath)
  const terminalKeys = new Set(records.filter(({ status }) => ['COMPLETED', 'FAILED'].includes(status)).map(({ requestFingerprint, attemptNumber }) => `${requestFingerprint}:${attemptNumber}`))
  if (records.some(({ status, requestFingerprint, attemptNumber }) => status === 'IN_PROGRESS' && !terminalKeys.has(`${requestFingerprint}:${attemptNumber}`))) throw new Error('Ledger contains an unresolved issued attempt')

  const candidates = await readJson<CandidateConfigFile>('src/acquisition/config/g4a-candidates.json')
  const endpoints = await readJson<EndpointConfigFile>('src/acquisition/config/nansen-endpoints.json')
  const euler = candidates.candidates.find(({ id }) => id === 'EULER_2023_INITIAL_EXPLOIT')
  if (!euler) throw new Error('Euler candidate configuration is missing')
  const items: AcquiredItem[] = []
  for (const planned of candidateRequestPlan(euler, endpoints)) {
    const requestFingerprint = fingerprintRequest(planned.request)
    const terminal = findCompletedRequest(records, requestFingerprint)
    if (terminal === null || terminal.status !== 'COMPLETED' || terminal.rawStorageLocations === null || terminal.rawSha256 === null || terminal.normalizedSha256 === null || terminal.completedAtUtc === null) throw new Error(`Durable Euler response is missing: ${planned.purpose}`)
    if (terminal.candidateId !== euler.id || terminal.purposeId !== planned.purpose || terminal.endpoint !== planned.policy.endpoint) throw new Error(`Durable Euler request identity mismatch: ${planned.purpose}`)
    const rawBody = gunzipSync(await readFile(terminal.rawStorageLocations.primary))
    if (sha256Hex(rawBody) !== terminal.rawSha256) throw new Error(`Durable Euler raw hash mismatch: ${planned.purpose}`)
    const attempts = records.filter(({ status, requestFingerprint: fingerprint }) => status === 'IN_PROGRESS' && fingerprint === requestFingerprint)
    items.push({
      purpose: planned.purpose,
      endpoint: planned.policy.endpoint,
      requestBody: planned.body,
      status: terminal.httpStatus ?? 200,
      rawSha256: terminal.rawSha256,
      normalizedSha256: terminal.normalizedSha256,
      body: JSON.parse(rawBody.toString('utf8')) as unknown,
      attemptsIssued: attempts.length,
      projectedCredits: attempts.reduce((sum, attempt) => sum + attempt.plannedCreditEstimate, 0),
      creditMetadata: terminal.returnedCreditMetadata,
      retrievedAtUtc: terminal.completedAtUtc,
    })
  }

  const candidateReport = buildCandidateReport(euler, candidates.threshold, items, endpoints)
  await writeJson('artifacts/g4a/EULER_2023_INITIAL_EXPLOIT_CANDIDATE_REPORT.json', candidateReport)
  const score = candidateReport.score as unknown as { eligible: boolean; total: number; fatalDefects: string[] }
  const starts = records.filter(({ status }) => status === 'IN_PROGRESS')
  const terminals = records.filter(({ status }) => ['COMPLETED', 'FAILED'].includes(status))
  const account = await readJson<{ remainingCredits: number }>('artifacts/g4a/ACCOUNT_PREFLIGHT_REDACTED.json')
  const endingRemaining = [...terminals].reverse().map((record) => metadataNumber(record, 'x-nansen-credits-remaining')).find((value) => value !== null) ?? account.remainingCredits
  const actualCreditsUsed = terminals.reduce((sum, record) => sum + (metadataNumber(record, 'x-nansen-credits-used') ?? record.plannedCreditEstimate), 0)
  const accountCreditDelta = account.remainingCredits - endingRemaining
  const actualUse = {
    httpAttemptsIssued: starts.length,
    projectedCredits: starts.reduce((sum, record) => sum + record.plannedCreditEstimate, 0),
    actualCreditsUsed,
    accountCreditDelta,
    firstReportedRemaining: account.remainingCredits,
    lastReportedRemaining: endingRemaining,
    countTowardBuildathon1000: false,
    returnedCreditMetadataRecords: terminals.filter(({ returnedCreditMetadata }) => returnedCreditMetadata !== null).length,
  }
  if (actualUse.httpAttemptsIssued > 64 || actualUse.projectedCredits > 200 || actualCreditsUsed > 200 || accountCreditDelta < 0 || accountCreditDelta > 200 || accountCreditDelta !== actualCreditsUsed) throw new Error('Offline call/credit reconciliation failed')
  const eulerPassed = score.eligible && score.total >= candidates.threshold && score.fatalDefects.length === 0
  const runReport: JsonObject = {
    schemaVersion: '1.0.0',
    status: eulerPassed ? 'COMPLETED_PENDING_LEAD_REVIEW' : 'BLOCKED_WITH_EVIDENCE',
    authorizationId: precall.authorizationId,
    heroSelected: false,
    reconstructionMode: 'DURABLE_STORE_ONLY_NO_PROVIDER_CALLS',
    originalStoppedReason: 'DUPLICATE_NORMALIZED_EVIDENCE_ID',
    storeVerification: storeVerification as unknown as JsonObject,
    actualUse,
    candidatesAudited: [euler.id],
    eulerThresholdStopApplied: eulerPassed,
    bybitIssued: false,
    ...(eulerPassed ? {} : { reason: 'EULER_DID_NOT_CLEAR_THRESHOLD_AND_NEW_PROVIDER_CALLS_REQUIRE_FRESH_LEAD_AUTHORIZATION' }),
  }
  await writeJson('artifacts/g4a/G4A_AUDITION_RUN_REPORT.json', runReport)
  await writeJson('artifacts/g4a/OFFLINE_RECONSTRUCTION_REPORT.json', { schemaVersion: '1.0.0', status: 'PASS', providerCalls: 0, credentialReads: 0, reviewedPrecallCommit: precall.reviewedCommit, currentCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), candidateId: euler.id, scoreTotal: score.total, fatalDefects: score.fatalDefects, eulerThresholdStopApplied: eulerPassed })
  printReport(runReport)
  if (!eulerPassed) process.exitCode = 1
}

main().catch(fail)
