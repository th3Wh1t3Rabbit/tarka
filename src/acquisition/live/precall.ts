import type { JsonObject } from '../contracts.js'
import { hashCanonicalObject } from '../integrity/identity.js'

export interface PrecallAuthorizationReport {
  schemaVersion: '1.0.0'
  generatedAtUtc: string
  authorizationId: string
  reviewedCommit: string
  reviewedTree: string
  campaignRootBindingSha256: string
  campaignLedgerRecordCount: number
  trackedTreeClean: boolean
  credentialInputMode: 'NONE' | 'INVALID_ARGUMENT'
  credentialStatus: 'NOT_RESOLVED_BY_SEQUENCE' | 'PRESENT_REDACTED'
  checks: Record<string, boolean>
  snapshots: Record<string, string>
  commandResults: Record<string, { ok: boolean; outputSha256: string }>
  plannedUse: JsonObject
  providerCallsBeforeReport: number
  AUTHORIZED_TO_ISSUE: boolean
  verificationSha256: string
}

export const MANDATORY_PRECALL_CHECKS = [
  'H1_finalProvenanceConsistency', 'H2_conservativeLedgerTailRecovery', 'H3_liveRetryErrorRateAllowancePolicy',
  'H4_endpointSpecificPublicPolicy', 'H5_transportHeaderAndActualCreditAccounting', 'noNetworkHardeningProof',
  'secretScan', 'typecheckLint', 'allUnitDomainTests', 'allBrowserJourneys', 'productionBuild', 'artifactCapture',
  'focusedG2Regression', 'browserNetworkSeparation', 'dedicatedPrecallReview', 'installedRepositoryAuthority', 'trackedTreeClean',
  'fixedCampaignLedgerEmpty', 'credentialUnresolvedByPrecall',
] as const

export const REQUIRED_PRECALL_COMMANDS = [
  'check', 'allTests', 'allBrowserJourneys', 'productionBuild', 'artifactCapture', 'noNetworkProof', 'browserBoundary', 'focusedG2Regression', 'secretScan',
] as const

export function precallSigningPayload(report: Omit<PrecallAuthorizationReport, 'verificationSha256'> | PrecallAuthorizationReport): JsonObject {
  const payload = { ...report } as Partial<PrecallAuthorizationReport>
  delete payload.verificationSha256
  return payload as unknown as JsonObject
}

export function verifyPrecallAuthorization(
  value: unknown,
  expected: { currentCommit: string; currentTree: string; authorizationId: string; campaignRootBindingSha256: string; snapshots: Record<string, string>; commandLogHashes: Record<string, string>; nowUtc: string },
): PrecallAuthorizationReport {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Pre-call authorization report is not an object')
  const report = value as PrecallAuthorizationReport
  if (report.schemaVersion !== '1.0.0' || report.AUTHORIZED_TO_ISSUE !== true) throw new Error('Pre-call authorization report does not authorize provider requests')
  if (report.authorizationId !== expected.authorizationId) throw new Error('Pre-call authorization ID mismatch')
  if (report.reviewedCommit !== expected.currentCommit || !/^[a-f0-9]{40}$/.test(report.reviewedCommit)) throw new Error('Pre-call report is not bound to the current reviewed commit')
  if (report.reviewedTree !== expected.currentTree || !/^[a-f0-9]{40}$/.test(report.reviewedTree)) throw new Error('Pre-call report is not bound to the reviewed source tree')
  if (report.campaignRootBindingSha256 !== expected.campaignRootBindingSha256 || !/^[a-f0-9]{64}$/.test(report.campaignRootBindingSha256)) throw new Error('Pre-call report is not bound to the fixed campaign root')
  if (report.campaignLedgerRecordCount !== 0 || report.trackedTreeClean !== true || report.providerCallsBeforeReport !== 0) throw new Error('Pre-call repository or provider-call state is invalid')
  if (report.credentialInputMode !== 'NONE') throw new Error('Pre-call process accepted a credential input')
  if (report.credentialStatus !== 'NOT_RESOLVED_BY_SEQUENCE') throw new Error('Credential was resolved before independent pre-call verification')
  if (typeof report.checks !== 'object' || report.checks === null) throw new Error('Pre-call mandatory checks are incomplete')
  const checkKeys = Object.keys(report.checks).sort()
  const expectedCheckKeys = [...MANDATORY_PRECALL_CHECKS].sort()
  if (checkKeys.length !== expectedCheckKeys.length || checkKeys.some((key, index) => key !== expectedCheckKeys[index]) || !Object.values(report.checks).every((check) => check === true)) throw new Error('Pre-call mandatory checks are incomplete')
  const commandKeys = Object.keys(report.commandResults ?? {}).sort()
  const expectedCommandKeys = [...REQUIRED_PRECALL_COMMANDS].sort()
  if (commandKeys.length !== expectedCommandKeys.length || commandKeys.some((key, index) => key !== expectedCommandKeys[index])) throw new Error('Pre-call command evidence is incomplete')
  for (const name of REQUIRED_PRECALL_COMMANDS) {
    const command = report.commandResults[name]
    if (command?.ok !== true || command.outputSha256 !== expected.commandLogHashes[name]) throw new Error(`Pre-call command evidence mismatch: ${name}`)
  }
  if (typeof report.snapshots !== 'object' || report.snapshots === null) throw new Error('Pre-call snapshots are missing')
  for (const [name, digest] of Object.entries(expected.snapshots)) if (report.snapshots[name] !== digest) throw new Error(`Pre-call snapshot mismatch: ${name}`)
  const generated = Date.parse(report.generatedAtUtc)
  const now = Date.parse(expected.nowUtc)
  if (!Number.isFinite(generated) || !Number.isFinite(now) || generated > now + 5 * 60_000 || now - generated > 6 * 60 * 60_000) throw new Error('Pre-call authorization report is stale or has an invalid timestamp')
  if (report.verificationSha256 !== hashCanonicalObject(precallSigningPayload(report))) throw new Error('Pre-call authorization report integrity check failed')
  return report
}
