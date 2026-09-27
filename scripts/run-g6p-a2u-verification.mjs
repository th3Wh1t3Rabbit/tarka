#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertCleanA2uSourceCut } from './g6p-a2u-cut.mjs'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const assertClean = () => assertCleanA2uSourceCut(root)
assertClean()
const candidateCommit = git('rev-parse', 'HEAD')
const candidateTree = git('rev-parse', 'HEAD^{tree}')
const destination = path.join(root, 'artifacts/g6p-a2u/current/verification')
mkdirSync(destination, { recursive: true })
const steps = [
  ['source-admission', 'node', ['scripts/admit-g6p-a2u-source.mjs']],
  ['check', 'npm', ['run', 'check']],
  ['unit', 'npm', ['test']],
  ['legacy-acquisition-regression', 'npm', ['run', 'test:acquisition']],
  ['browser', 'npm', ['run', 'test:e2e']],
  ['build', 'npm', ['run', 'build']],
  ['browser-boundary', 'npm', ['run', 'browser-boundary:verify']],
]
const results = []
for (const [id, command, args] of steps) {
  process.stdout.write(`VERIFY ${id}\n`)
  const result = await new Promise((resolve) => {
    let output = ''
    const child = spawn(command, args, { cwd: root, env: { ...process.env, CI: '1' } })
    child.stdout.on('data', (chunk) => { output += chunk.toString() })
    child.stderr.on('data', (chunk) => { output += chunk.toString() })
    child.on('error', (error) => resolve({ code: 1, output: String(error) }))
    child.on('close', (code) => resolve({ code, output }))
  })
  const file = path.join(destination, `${id}.log`)
  writeFileSync(file, result.output)
  results.push({ id, status: result.code === 0 ? 'PASS' : 'FAIL', exitCode: result.code, log: `artifacts/g6p-a2u/current/verification/${id}.log`, sha256: createHash('sha256').update(result.output).digest('hex') })
  process.stdout.write(`${id}: ${results.at(-1).status}\n`)
  if (result.code !== 0) { process.stdout.write(result.output.slice(-5000)); break }
}
assertClean()
if (git('rev-parse', 'HEAD') !== candidateCommit || git('rev-parse', 'HEAD^{tree}') !== candidateTree) throw new Error('Source identity changed during verification.')
const historical = readFileSync(path.join(root, 'artifacts/g6p-a2u/precall/NQ5_PRECALL_AUTHORIZATION_REPORT.json'))
const historicalHash = createHash('sha256').update(historical).digest('hex')
if (historicalHash !== '127a54a809717dd9ffadddfce70b2126fa680c7e0078ee477cddac0d5e6067d6') throw new Error('Historical blocker changed')
const report = {
  status: 'BLOCKED_WITH_EVIDENCE', localVerification: results.length === steps.length && results.every((step) => step.status === 'PASS') ? 'PASS' : 'FAIL',
  candidateCommit, candidateTree, cleanScopedCutVerified: true, sourceIdentityStableBeforeAndAfter: true, generatedAtUtc: new Date().toISOString(),
  results, historicalBlockerSha256: historicalHash, credentialResolutionAttempted: false, providerCallsIssued: 0,
  qualificationCounted: 0, leadAcceptanceClaimed: false, completeA2UAcceptanceClaimed: false,
}
writeFileSync(path.join(destination, 'LOCAL_VERIFICATION.json'), `${JSON.stringify(report, null, 2)}\n`)
const precall = {
  schemaVersion: '1.0.0', sourceVersion: '1.0.1', status: 'BLOCKED_WITH_EVIDENCE', AUTHORIZED_TO_ISSUE: false,
  authorizationId: 'LEAD-NQ5-UNIFIED-CASEBOARD-UTILITY-001', publicCallPrefix: 'NQ5', generatedAtUtc: report.generatedAtUtc,
  historicalBlockerSha256: historicalHash, credentialResolutionAttempted: false, providerCallsIssued: 0,
  accountPreflight: 'NOT_ISSUED_AUTHORIZATION_CYCLE', accountTier: null, availableCredits: null, protectedReserveCredits: 250,
  campaignAttempts: 0, qualificationCounted: 0, campaignCreditsSpent: 0, campaignProofRoot: null,
  objectiveGates: {
    correctedSourceAdmission: results.find(({ id }) => id === 'source-admission')?.status ?? 'NOT_RUN',
    localFixtureTestsAndBrowserRegressions: report.localVerification,
    currentOfficialPublicDocs: 'REFRESHED_NOT_PLAN_SPECIFIC_ADMISSION',
    fixtureSuppliedSchemaConformance: 'NOT_VERIFIED',
    completeTerminalArchivePerformanceParity: 'NOT_VERIFIED',
    largeCorpusBrowserRendering: 'NOT_VERIFIED',
    dedicatedReview: 'SEE_REVIEW_EVIDENCE_NOT_FULL_ACCEPTANCE',
    authenticatedAccountAndCreditPreflight: 'BLOCKED_REQUIRES_BOOTSTRAP_AUTHORITY',
    frozenT1CoverageUtilityAndReservePlan: 'NOT_FROZEN',
    nq5SchemaBoundLedgerCrashTailAndMirrors: 'NOT_VERIFIED',
    nq5EndpointPolicyAndPublicProjection: 'NOT_VERIFIED',
    scopedSecretScanAndCleanSourcePackage: 'SEE_PACKAGE_VERIFICATION',
  },
  blockers: [{ id: 'NQ5_ACCOUNT_PREFLIGHT_BOOTSTRAP_CYCLE', allowanceLocation: '02_NANSEN_UTILITY_BOUND_QUALIFICATION_ALLOWANCE.yaml:precall_requirements', resumeLocation: '15_RESUME_AFTER_SOURCE_BLOCKER_PROMPT.txt', explanation: 'Authenticated account/credit preflight is required among gates, while credentials and every provider call are forbidden until all gates pass. ADMIN nonqualification is not a pre-call sequencing exemption.', requiredDirection: 'Explicit narrow private-only account preflight bootstrap rule or current user-supplied redacted account/credit evidence. All other gates still must pass.' }],
  partialImplementationAndPendingGates: 'docs/G6P_A2U_IMPLEMENTATION_AND_BLOCKERS.md',
}
const precallDirectory = path.join(root, 'artifacts/g6p-a2u/current/precall')
mkdirSync(precallDirectory, { recursive: true })
writeFileSync(path.join(precallDirectory, 'NQ5_PRECALL_AUTHORIZATION_REPORT.json'), `${JSON.stringify(precall, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ localVerification: report.localVerification, status: report.status, AUTHORIZED_TO_ISSUE: false }, null, 2)}\n`)
if (report.localVerification !== 'PASS') process.exitCode = 1
