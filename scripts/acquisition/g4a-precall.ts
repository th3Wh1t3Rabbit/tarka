import { execFileSync, spawnSync } from 'node:child_process'
import { mkdir, open, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { JsonObject, RequestAllowance } from '../../src/acquisition/contracts.js'
import { hashCanonicalObject, sha256Hex } from '../../src/acquisition/integrity/identity.js'
import { readLedger } from '../../src/acquisition/integrity/ledger.js'
import { precallSigningPayload, type PrecallAuthorizationReport } from '../../src/acquisition/live/precall.js'
import { fail, getArgument, printReport, resolvePrivateStoreRoot, resolveRepositoryPath, writeJson } from './common.js'

interface EndpointSnapshot {
  schemaVersion: string
  baseUrl: string
  authenticationHeader: string
  officialSources: string[]
  responseHeaders: string[]
  endpoints: Array<{ endpoint: string; method: string; planningCreditCost: number; creditCostByPlan: Record<string, number>; transport: string; requestSchema: JsonObject; responseSchema: JsonObject }>
}

function run(command: string, args: string[]): { ok: boolean; output: string } {
  const result = spawnSync(command, args, { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, TRACE_G4A_PRECALL_NO_CREDENTIAL: '1', TRACE_CAPTURE_DIRECTORY: 'artifacts/g4a/precall-capture' } })
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` }
}

async function main() {
  if (process.argv.includes('--output')) throw new Error('The G4A pre-call report path is fixed and cannot be overridden')
  const output = resolveRepositoryPath('artifacts/g4a/PRECALL_AUTHORIZATION_REPORT.json')
  try {
    await readFile(output)
    throw new Error('Successful pre-call authorization is write-once; the existing report cannot be regenerated')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const credentialInputMode = process.argv.includes('--credential-file') || process.argv.includes('--credential-env') ? 'INVALID_ARGUMENT' as const : 'NONE' as const
  const reviewPath = resolveRepositoryPath(getArgument('--review', true) as string)
  const reviewBytes = await readFile(reviewPath)
  const review = JSON.parse(reviewBytes.toString('utf8')) as { status: string; acceptedP0P1Open: number; reviewedCommit: string }
  const allowanceBytes = await readFile('src/acquisition/config/g4a-allowance.json')
  const candidatesBytes = await readFile('src/acquisition/config/g4a-candidates.json')
  const endpointsBytes = await readFile('src/acquisition/config/nansen-endpoints.json')
  const agentsBytes = await readFile('AGENTS.md')
  const allowance = JSON.parse(allowanceBytes.toString('utf8')) as RequestAllowance
  const endpoints = JSON.parse(endpointsBytes.toString('utf8')) as EndpointSnapshot
  const currentCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const currentTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim()
  const gitRoot = path.resolve(execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim())
  if (gitRoot !== path.resolve(process.cwd())) throw new Error('G4A must run from the canonical repository root')
  const campaignRoot = resolvePrivateStoreRoot()
  const campaignLedgerPath = path.join(campaignRoot, 'primary', 'ledger', 'calls.jsonl')
  const campaignLedger = await readLedger(campaignLedgerPath)
  const providerCallsBeforeReport = campaignLedger.filter(({ status }) => status === 'IN_PROGRESS').length
  const campaignRootBindingSha256 = sha256Hex(campaignRoot)

  const commands = [
    ['check', 'npm', ['run', 'check']],
    ['allTests', 'npm', ['run', 'test']],
    ['allBrowserJourneys', 'npm', ['run', 'test:e2e']],
    ['productionBuild', 'npm', ['run', 'build']],
    ['artifactCapture', 'npm', ['run', 'artifacts:capture']],
    ['noNetworkProof', 'npm', ['run', 'acquisition:prove-no-network']],
    ['browserBoundary', 'npm', ['run', 'browser-boundary:verify']],
    ['focusedG2Regression', 'npm', ['run', 'test:g2:focused']],
    ['secretScan', 'npm', ['run', 'secret:scan']],
  ] as const
  const logRoot = path.join(path.dirname(output), 'precall-logs')
  await mkdir(logRoot, { recursive: true })
  const results: Record<string, { ok: boolean; outputSha256: string }> = {}
  for (const [name, executable, args] of commands) {
    const result = run(executable, [...args])
    const logPath = path.join(logRoot, `${name}.log`)
    await writeFile(logPath, result.output, 'utf8')
    results[name] = { ok: result.ok, outputSha256: sha256Hex(result.output) }
  }
  const trackedTreeClean = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim() === ''

  const allowed = new Set(allowance.approvedEndpoints)
  const expectedEndpointMetadata: Record<string, { method: string; cost: number }> = {
    '/api/v1/account': { method: 'GET', cost: 0 },
    '/api/v1/profiler/address/transactions': { method: 'POST', cost: 1 },
    '/api/v1/transaction-with-token-transfer-lookup': { method: 'POST', cost: 1 },
    '/api/v1/profiler/address/historical-balances': { method: 'POST', cost: 1 },
  }
  const endpointPolicyValid = endpoints.schemaVersion === '1.0.0'
    && endpoints.baseUrl === 'https://api.nansen.ai'
    && endpoints.authenticationHeader === 'apikey'
    && endpoints.officialSources.length >= 4
    && endpoints.endpoints.length === 4
    && endpoints.endpoints.every((entry) => allowed.has(entry.endpoint)
      && expectedEndpointMetadata[entry.endpoint]?.method === entry.method
      && expectedEndpointMetadata[entry.endpoint]?.cost === entry.planningCreditCost
      && entry.transport === 'NANSEN_BUILD_TIME_G4A'
      && entry.planningCreditCost === entry.creditCostByPlan.FREE
      && entry.planningCreditCost === entry.creditCostByPlan.PRO
      && typeof entry.requestSchema === 'object'
      && typeof entry.responseSchema === 'object')
  const checks = {
    H1_finalProvenanceConsistency: results.allTests?.ok === true,
    H2_conservativeLedgerTailRecovery: results.allTests?.ok === true,
    H3_liveRetryErrorRateAllowancePolicy: results.allTests?.ok === true,
    H4_endpointSpecificPublicPolicy: endpointPolicyValid && results.allTests?.ok === true,
    H5_transportHeaderAndActualCreditAccounting: endpointPolicyValid && results.allTests?.ok === true,
    noNetworkHardeningProof: results.noNetworkProof?.ok === true,
    secretScan: results.secretScan?.ok === true,
    typecheckLint: results.check?.ok === true,
    allUnitDomainTests: results.allTests?.ok === true,
    allBrowserJourneys: results.allBrowserJourneys?.ok === true,
    productionBuild: results.productionBuild?.ok === true,
    artifactCapture: results.artifactCapture?.ok === true,
    focusedG2Regression: results.focusedG2Regression?.ok === true,
    browserNetworkSeparation: results.browserBoundary?.ok === true,
    dedicatedPrecallReview: review.status === 'PASS' && review.acceptedP0P1Open === 0 && review.reviewedCommit === currentCommit,
    installedRepositoryAuthority: agentsBytes.toString('utf8').includes('G4A'),
    trackedTreeClean,
    fixedCampaignLedgerEmpty: campaignLedger.length === 0 && providerCallsBeforeReport === 0,
    credentialUnresolvedByPrecall: credentialInputMode === 'NONE',
  }
  const snapshots = {
    allowance: sha256Hex(allowanceBytes),
    candidates: sha256Hex(candidatesBytes),
    endpoints: sha256Hex(endpointsBytes),
    agents: sha256Hex(agentsBytes),
    review: sha256Hex(reviewBytes),
    ...Object.fromEntries(Object.entries(results).map(([name, result]) => [`log:${name}`, result.outputSha256])),
  }
  const authorized = Object.values(checks).every(Boolean)
    && allowance.leadAuthorizationId === 'LEAD-G4A-NANSEN-DISCOVERY-001'
    && allowance.maximumRequests === 64
    && allowance.maximumProjectedCredits === 200
  const unsigned: Omit<PrecallAuthorizationReport, 'verificationSha256'> = {
    schemaVersion: '1.0.0', generatedAtUtc: new Date().toISOString(), authorizationId: allowance.leadAuthorizationId,
    reviewedCommit: currentCommit, reviewedTree: currentTree, campaignRootBindingSha256, campaignLedgerRecordCount: campaignLedger.length,
    trackedTreeClean, credentialInputMode, credentialStatus: 'NOT_RESOLVED_BY_SEQUENCE', checks, snapshots, commandResults: results,
    plannedUse: {
      accountPreflight: { identities: 1, maximumHttpAttempts: 1, maximumProjectedCredits: 0, reusable: false },
      euler: { identities: 12, maximumHttpAttempts: 36, maximumProjectedCredits: 36 },
      bybitFallback: { identities: 9, maximumHttpAttempts: 27, maximumProjectedCredits: 27, conditional: true },
      globalCeilings: { maximumHttpAttempts: 64, maximumProjectedCredits: 200, maximumActualCreditDelta: 200 },
    },
    providerCallsBeforeReport, AUTHORIZED_TO_ISSUE: authorized,
  }
  const report: PrecallAuthorizationReport = { ...unsigned, verificationSha256: hashCanonicalObject(precallSigningPayload(unsigned)) }
  await writeJson(path.relative(process.cwd(), path.join(path.dirname(output), 'PRECALL_COMMAND_RESULTS.json')), results)
  if (authorized) {
    await mkdir(path.dirname(output), { recursive: true })
    const handle = await open(output, 'wx')
    try {
      await handle.writeFile(`${JSON.stringify(report, null, 2)}\n`, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
  } else {
    await writeJson(path.relative(process.cwd(), path.join(path.dirname(output), 'PRECALL_AUTHORIZATION_FAILURE_REPORT.json')), report)
  }
  printReport(report)
  if (!authorized) process.exitCode = 1
}

main().catch(fail)
