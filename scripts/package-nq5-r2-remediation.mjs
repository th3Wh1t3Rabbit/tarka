#!/usr/bin/env node
// Offline R2 only. No refresh, account adapter, credential resolver or transport.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'
import { assertCleanA2uSourceCut } from './g6p-a2u-cut.mjs'
import { sha, identity } from './nq5/schema.mjs'
import { validateSourceInstallation, validateActiveSchema, ACTIVE } from './nq5-r2/authority.mjs'
import { proveUnchangedObservationCode, reusePreservedObservation, OBSERVATION_CUT } from './nq5-r2/observation.mjs'
import { frontierPolicy, freezeAcceptedT1 } from './nq5-r2/frontier.mjs'
import { r2ImplementationIdentity, REVIEW_LENSES } from './nq5-r2/review-identity.mjs'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url))), parent = path.dirname(root)
const archiveName = 'TRACE_ESCAPE_G6P_A2U_R2_AUTHORITY_PARITY_AND_T1_PLAN_REMEDIATION_DELIVERY_v1.0.0.zip', output = path.join(parent, archiveName)
const verifyOnly = process.argv.includes('--verify-only')
if (process.argv.slice(2).some(arg => arg !== '--verify-only') || (!verifyOnly && fs.existsSync(output))) throw new Error('Unsupported option or existing delivery; preserve it.')
if (!process.execArgv.some(arg => arg.includes('hold.cjs'))) throw new Error('R2 network hold preload required.')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-nq5-r2-')), delivery = path.join(temporary, 'delivery')
fs.mkdirSync(delivery)
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64000000 }).trim()
const hash = file => sha(fs.readFileSync(file))
const write = (name, value) => { const file = path.join(delivery, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n') }
function files(directory) { return fs.readdirSync(directory).sort().flatMap(name => { const file = path.join(directory, name), stat = fs.lstatSync(file); if (stat.isSymbolicLink()) throw new Error('Unexpected governed symlink.'); return stat.isDirectory() ? files(file) : [file] }) }
const childEnvironment = { ...process.env, PYTHONDONTWRITEBYTECODE: '1', NODE_OPTIONS: `--require ${path.join(root, 'scripts/nq5-r2/hold.cjs')}`, npm_config_update_notifier: 'false' }
function run(command, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: childEnvironment, stdio: ['ignore', 'pipe', 'pipe'] }); let stdout = '', stderr = ''
    child.stdout.on('data', bytes => { stdout += bytes; if (stdout.length > 64000000) child.kill() })
    child.stderr.on('data', bytes => { stderr += bytes; if (stderr.length > 64000000) child.kill() })
    child.on('error', () => reject(new Error('Local verification tool unavailable.')))
    child.on('close', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`Local suite failed: ${command}; no private reuse or delivery publication.\n${stdout}\n${stderr}`)))
  })
}
const historic = [
  ['TRACE_ESCAPE_G6P_A2U_UNIFIED_INVESTIGATION_LOOP_AND_NANSEN_QUESTION_LENSES_DELIVERY_v1.0.0.zip', 'f0840693e7a751a9b58f0dc4b9872e54c43012bea961239eb7e5417fc7865598'],
  ['TRACE_ESCAPE_G6P_A2U_UNIFIED_INVESTIGATION_LOOP_AND_NANSEN_QUESTION_LENSES_DELIVERY_v1.0.1.zip', 'fa80eb43041563e8331743b904fc0e49eb1cdd6470b1d968329cb101a5362b0c'],
  ['TRACE_ESCAPE_G6P_A2U_NQ5_PRECAMPAIGN_CHECKPOINT_DELIVERY_v1.0.2.zip', '7fdf2b7c126d6b2b04b186f9674dd00a8eba7adee312d4b1cec2fc868e405403'],
  ['TRACE_ESCAPE_G6P_A2U_R1_OFFLINE_GATE_COMPLETION_AND_PRECALL_CHECKPOINT_DELIVERY_v1.0.0.zip', 'a182e4a3b6325e5e069cd4c1683d82035d9275046379ee24257558d567bff185'],
]
try {
  const cut = assertCleanA2uSourceCut(root), source = validateSourceInstallation(), codeProof = proveUnchangedObservationCode(root)
  const historicalEvidence = () => Object.fromEntries(['artifacts/g6p-a2u', 'artifacts/g6p-a2p/verification'].flatMap(relative => files(path.join(root, relative))).map(file => [path.relative(root, file), hash(file)]))
  const preserved = identity(historicalEvidence())
  const unchanged = () => {
    if (identity(assertCleanA2uSourceCut(root)) !== identity(cut) || identity(historicalEvidence()) !== preserved) throw new Error('Source or preserved historical evidence changed.')
    for (const [name, expected] of historic) if (hash(path.join(parent, name)) !== expected) throw new Error('Historical delivery changed.')
    proveUnchangedObservationCode(root); validateSourceInstallation()
  }
  unchanged(); await run('git', ['merge-base', '--is-ancestor', OBSERVATION_CUT, cut.commit])
  const review = JSON.parse(fs.readFileSync(path.join(root, 'docs/G6P_A2U_R2_REVIEW.json')))
  if (review.status !== 'PASS_BOUNDED_REMEDIATION' || review.unresolvedAcceptedP0P1 !== 0 || review.implementationSha256 !== r2ImplementationIdentity(root) || review.lenses.map(item => item.name).sort().join() !== [...REVIEW_LENSES].sort().join() || review.lenses.some(item => item.status !== 'PASS_BOUNDED_OFFLINE_SCOPE')) throw new Error('Dedicated review missing, incomplete or stale.')
  write('EVIDENCE/REVIEW_FINDINGS_RESOLUTIONS.json', review)
  write('SOURCE_INSTALL/SOURCE_INSTALLATION_REPORT.json', { ...source, suppliedBaseArchiveSha256: '6801f3a8b90735f40639b5b5caf0fe3440d530c7a19b6c2bd3355d5a94ab9716', suppliedCorrectionArchiveSha256: 'f5be45e5bfcff5ee8177063f59826a98d21b007db3a0d662eeadcd86930b40a1', baseSuppliedManifestSha256: hash(path.join(root, 'docs/source/v1.7.0/MANIFEST.sha256')), correctionSuppliedManifestSha256: hash(path.join(root, 'docs/source/v1.7.1/MANIFEST.sha256')), activeSourceManifestSha256: hash(path.join(root, 'docs/source/ACTIVE_SOURCE_MANIFEST.sha256')), candidate: cut })
  write('SOURCE_INSTALL/ACTIVE_SOURCE_MANIFEST.sha256', fs.readFileSync(path.join(root, 'docs/source/ACTIVE_SOURCE_MANIFEST.sha256')))
  const verification = [], unitCases = [], browserCases = [], reportSchemaCases = []
  const suite = async (name, command, args, cwd = root, format) => {
    process.stdout.write(`VERIFY ${name}\n`)
    const result = await run(command, args, cwd); let log = result.stdout + result.stderr
    if (format === 'schema-probes') {
      const report = JSON.parse(result.stdout)
      if (report.status !== 'PASS' || report.case_count !== 118 || report.results.some(test => !test.expectation_met) || report.credential_resolution_attempted || report.provider_calls_issued) throw new Error('Report schema/semantic controls rejected.')
      reportSchemaCases.push(...report.results.map(test => ({ name: test.name, result: 'PASS', syntheticTestOnly: true })))
      log = `${name}: PASS\n118 schema/semantic/privacy controls; credential resolution:false; provider calls:0; qualification counts:0.\nNamed controls occur once in EVIDENCE/OFFLINE_GATE_MATRIX.json.\n`
    }
    if (format === 'vitest') {
      const report = JSON.parse(result.stdout)
      if (!report.success || report.numFailedTests) throw new Error('Unit result rejected.')
      unitCases.push(...report.testResults.flatMap(file => file.assertionResults.map(test => ({ suite: path.relative(root, file.name), name: test.fullName, result: test.status.toUpperCase() }))))
      log = `${name}: PASS\nTest files:${report.testResults.length}; tests:${report.numPassedTests}; failed:0\nNamed assertions occur once in EVIDENCE/OFFLINE_GATE_MATRIX.json.\n`
    }
    if (format === 'playwright') {
      const report = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')))
      const visit = suites => suites.flatMap(node => [...(node.specs ?? []).map(spec => ({ name: spec.title, result: spec.ok && spec.tests.every(test => test.status === 'expected') ? 'PASS' : 'FAIL' })), ...visit(node.suites ?? [])])
      const cases = visit(report.suites)
      if (cases.some(test => test.result !== 'PASS') || report.stats.unexpected) throw new Error('Browser result rejected.')
      browserCases.push(...cases); log = `${name}: PASS\nTests:${cases.length}; unexpected:0\nNamed journeys occur once in EVIDENCE/OFFLINE_GATE_MATRIX.json.\n`
    }
    write(`VERIFICATION/${name}.log`, log)
    verification.push({ suite: name, status: 'PASS', log: `VERIFICATION/${name}.log`, sha256: hash(path.join(delivery, `VERIFICATION/${name}.log`)) })
    process.stdout.write(`${name}: PASS\n`)
  }
  await suite('active-source-validation', 'python3', ['VALIDATE_SOURCE_SET.py'], path.join(root, 'docs/source/v1.7.0'))
  await suite('report-schema-semantics', 'python3', ['scripts/test-nq5-report-validation.py'], root, 'schema-probes')
  await suite('typecheck-lint', 'npm', ['run', 'check'])
  await suite('acquisition-compile', 'npm', ['run', 'acquisition:compile'])
  await suite('unit-domain-storage-planner-projection', 'npx', ['--no-install', 'vitest', 'run', 'tests/unit', '--reporter=json'], root, 'vitest')
  await suite('acquisition-regression', 'npx', ['--no-install', 'vitest', 'run', 'tests/acquisition', '--reporter=json'], root, 'vitest')
  await suite('browser-accessibility-performance', 'npm', ['run', 'test:e2e', '--', '--reporter=json'], root, 'playwright')
  await suite('production-build', 'npm', ['run', 'build'])
  await suite('browser-boundary', 'npm', ['run', 'browser-boundary:verify'])
  await suite('records-office-art-shell-boundary', 'npm', ['run', 'g6p:a1:boundary:verify'])
  await suite('euler-frozen-public-pack', 'npm', ['run', 'g6:pack:verify'])
  await suite('current-project-clock-status', 'npm', ['run', 'project:status'])
  const bundle = path.join(delivery, 'GIT/trace-escape-complete.bundle'); fs.mkdirSync(path.dirname(bundle), { recursive: true })
  await run('git', ['-c', 'pack.threads=1', 'bundle', 'create', bundle, 'HEAD']); await run('git', ['bundle', 'verify', bundle])
  const clone = path.join(temporary, 'clone'); await run('git', ['clone', '--quiet', bundle, clone])
  if ((await run('git', ['rev-parse', 'HEAD'], clone)).stdout.trim() !== cut.commit || (await run('git', ['rev-parse', 'HEAD^{tree}'], clone)).stdout.trim() !== cut.tree) throw new Error('Fresh cloned cut differs.')
  await suite('bundle-clone-fsck', 'git', ['fsck', '--strict', '--full'], clone)
  await suite('candidate-history-secret-scan', 'node', ['scripts/verify-git-secret-history.mjs'], clone)
  write('SOURCE_DIFF.patch', (await run('git', ['diff', '--binary', OBSERVATION_CUT, cut.commit])).stdout)
  fs.cpSync(path.join(root, 'dist'), path.join(clone, 'dist'), { recursive: true })
  await suite('scoped-source-build-secret-scan', 'node', [path.join(root, 'scripts/scan-prohibitions.mjs'), clone])
  unchanged()
  const r2Tests = unitCases.filter(test => /nq5-r2-remediation/.test(test.suite)), parity = browserCases.filter(test => /^R2 parity/.test(test.name))
  if (r2Tests.length < 33 || parity.length !== 6 || !browserCases.some(test => /12,288/.test(test.name))) throw new Error('Mandatory exact remediation evidence missing.')
  const r1 = path.join(parent, historic.at(-1)[0])
  const originalAccountBytes = execFileSync('unzip', ['-p', r1, 'REPORTS/NQ5_ACCOUNT_PREFLIGHT_REDACTED.json'])
  validateActiveSchema('account', JSON.parse(originalAccountBytes))
  write('REPORTS/NQ5_ACCOUNT_PREFLIGHT_REDACTED.json', originalAccountBytes)
  const refresh = JSON.parse(execFileSync('unzip', ['-p', r1, 'EVIDENCE/OFFICIAL_CONTRACT_REFRESH.json']))
  const { buildFrozenFixture } = await import('../.acquisition-build/src/investigation/fixture.js')
  const scenarioRoot = path.join(root, 'public/scenarios/euler-2023-false-exit')
  const fixture = buildFrozenFixture(JSON.parse(fs.readFileSync(path.join(scenarioRoot, 'scenario.json'))), JSON.parse(fs.readFileSync(path.join(scenarioRoot, 'evidence-graph.json'))))
  const policy = frontierPolicy(fixture); write('PLANS/T1_FRONTIER_POLICY.json', policy)
  let observation = null, frozen = null, reuseReceipt = { schemaVersion: '1.0.0', status: 'NOT_VERIFIED_OFFLINE_ONLY', originalRedactedReportSha256: sha(originalAccountBytes), additionalAttempts: 0, credentialResolutionInGate: false, providerRequestsInGate: 0, localReuseOnly: true, noRelevantPostObservationCodeMutation: true, protectedCodeProof: codeProof, qualificationAttempts: 0, qualificationCounted: 0 }
  if (!verifyOnly) {
    // Only after current source, planner, full local suites, review and scans pass.
    try { observation = reusePreservedObservation(root, originalAccountBytes); reuseReceipt = observation.receipt }
    catch { reuseReceipt = { ...reuseReceipt, status: 'BLOCKED_WITH_EVIDENCE', reason: 'Original report/cache/terminal/dual durable bytes or unchanged-code proof failed; private details withheld and no repair or second attempt permitted.' } }
    if (observation) {
      try { frozen = freezeAcceptedT1(refresh, observation.account, fixture) }
      catch { reuseReceipt = { ...reuseReceipt, planAdmission: 'BLOCKED_EXACT_CONTRACT_OR_OBSERVED_BUDGET', qualificationCallsAllowed: false } }
    }
  }
  write('REPORTS/ACCOUNT_OBSERVATION_REUSE_RECEIPT.json', reuseReceipt)
  write('PLANS/T1_PLAN.json', frozen?.plan ?? { schemaVersion: '2.0.0', status: 'BLOCKED_WITH_EVIDENCE', frozen: false, requests: [], qualificationCallsAllowed: false, reason: verifyOnly ? 'No actual observation reused in offline-only verification.' : 'Local observation or exact contract/budget admission failed.' })
  write('PLANS/T1_RESERVE_PLAN.json', frozen?.reserve ?? { schemaVersion: '2.0.0', requests: [], worstCaseCredits: 0, protectedReserveCredits: 250, speculativeReserveForbidden: true })
  const utilityReport = frozen?.report ?? { schemaVersion: '2.0.0', status: 'BLOCKED_WITH_EVIDENCE', frozenNextBatchRequests: 0, floorReachability: policy.floorReachability, actualQualificationAttempts: 0, actualCountedSuccesses: 0, checkpointHeld: true }
  write('EVIDENCE/T1_UTILITY_AND_ISSUABILITY_REPORT.json', { ...utilityReport, preservedOfficialRefreshIdentity: identity(refresh), preservedOfficialRefreshSha256: sha(execFileSync('unzip', ['-p', r1, 'EVIDENCE/OFFICIAL_CONTRACT_REFRESH.json'])), dynamicRouteTest: r2Tests.find(test => /four bounded batches/.test(test.name)), syntheticRouteIsNotHistoricalQualificationOrFloorGuarantee: true })
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'docs/source/v1.7.0/20_NQ5_OFFLINE_PRECALL_AUTHORIZATION_REPORT.schema.json')))
  const gates = Object.fromEntries(schema.$defs.allPassGates.required.map(gate => [gate, gate === 'current_official_docs_snapshot' ? 'NOT_VERIFIED' : 'PASS']))
  const blockers = [{ id: 'EXACT_REQUIRED_ENDPOINT_CONTRACTS_NOT_ADMITTED', gate: 'current_official_docs_snapshot', summary: 'Preserved official material lacks exact documented redistribution admission for counterparties and exact receipt lookup. No family alias or new fetch is permitted. Conditional frontier expansion is not a guarantee of1024 useful counted successes.', evidence_refs: ['EVIDENCE/T1_UTILITY_AND_ISSUABILITY_REPORT.json', 'PLANS/T1_FRONTIER_POLICY.json'] }]
  if (!observation) blockers.push({ id: verifyOnly ? 'LOCAL_OBSERVATION_NOT_REUSED_OFFLINE_MODE' : 'LOCAL_OBSERVATION_REUSE_PROOF_FAILED', summary: 'No observed-balance plan authorization emitted without actual durable read-only reuse proof.', evidence_refs: ['REPORTS/ACCOUNT_OBSERVATION_REUSE_RECEIPT.json'] })
  if (observation && !frozen) blockers.push({ id: 'T1_EXACT_CONTRACT_OR_OBSERVED_BUDGET_FAILED', summary: 'Next batch failed local plan-specific admission; no request issued.', evidence_refs: ['PLANS/T1_PLAN.json'] })
  if (frozen && !frozen.plan.frozen) blockers.push({ id: 'T1_INITIAL_CAMPAIGN_SNAPSHOT_NOT_VERIFIED', summary: 'No existing verified campaign snapshot establishing initial emptiness was supplied. Omitted history cannot reset accounting to zero. Accepted-seed rows are unfrozen bounded review candidates, not an authorized issuable batch; no private journal was invented or written.', evidence_refs: ['PLANS/T1_PLAN.json', 'EVIDENCE/T1_UTILITY_AND_ISSUABILITY_REPORT.json'] })
  const offline = { schema_version: '1.0.2', status: 'BLOCKED_WITH_EVIDENCE', exception_id: 'LEAD-NQ5-ACCOUNT-PREFLIGHT-BOOTSTRAP-001', parent_authorization_id: 'LEAD-NQ5-UNIFIED-CASEBOARD-UTILITY-001', generated_at_utc: new Date().toISOString(), candidate_commit: cut.commit, candidate_tree: cut.tree, mandatory_offline_gates: gates, blockers, credential_resolution_attempted: false, provider_calls_issued: 0, AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT: false }
  validateActiveSchema('offline', offline); write('REPORTS/NQ5_OFFLINE_PRECALL_AUTHORIZATION_REPORT.json', offline)
  write('REPORTS/NQ5_PRECALL_AUTHORIZATION_REPORT.json', { schema_version: '1.0.2', status: 'BLOCKED_WITH_EVIDENCE', active_gate: ACTIVE.activeGate, candidate_commit: cut.commit, candidate_tree: cut.tree, active_source_identity: identity(ACTIVE), active_source_manifest_sha256: hash(path.join(root, 'docs/source/ACTIVE_SOURCE_MANIFEST.sha256')), corrected_terminal_schema_sha256: hash(path.join(root, ACTIVE.terminalSchema)), allowance_sha256: hash(path.join(root, 'docs/source/v1.7.0/17_NQ5_UTILITY_BOUND_QUALIFICATION_ALLOWANCE.yaml')), AUTHORIZED_TO_ISSUE: false, AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT: false, checkpoint_hold: true, qualification_calls_allowed: false, qualification_attempts: 0, qualification_counted: 0, provider_calls_in_r2: 0, credential_resolution_in_r2: false, historical_attempts_consumed: 1, original_account_report_sha256: sha(originalAccountBytes), reuse_receipt_sha256: hash(path.join(delivery, 'REPORTS/ACCOUNT_OBSERVATION_REUSE_RECEIPT.json')), offline_report_sha256: hash(path.join(delivery, 'REPORTS/NQ5_OFFLINE_PRECALL_AUTHORIZATION_REPORT.json')), frozen_t1_plan_sha256: hash(path.join(delivery, 'PLANS/T1_PLAN.json')), review_sha256: hash(path.join(delivery, 'EVIDENCE/REVIEW_FINDINGS_RESOLUTIONS.json')), protected_reserve_credits: 250, available_credits: observation?.account.account.available_credits ?? null, gates, blockers })
  write('EVIDENCE/TERMINAL_TAXONOMY_AND_PARITY_MATRIX.json', { schemaVersion: '2.0.2', sections: ['CASE', 'RESULTS', 'EXPLORE', 'SOURCE', 'LEDGER'], askLocation: 'CASE', exploreRole: 'CASE_CORPUS_EXPLORATION', ledgerRole: 'RESEARCH_LEDGER_AND_CALL_ATLAS', archiveIsCanonical: false, singleReducer: 'src/investigation/state.ts', singleAccessibilityTree: 'src/app/CaseTerminalWorkbench.tsx', parity, adversarialAssertions: r2Tests.filter(test => /aliases cannot pass/.test(test.name)), schemaAssertions: unitCases.filter(test => /nq5-r1-catalog/.test(test.suite)), manualAssistiveTechnologyCertificationClaimed: false })
  write('EVIDENCE/OFFLINE_GATE_MATRIX.json', { candidate: cut, status: 'BLOCKED_WITH_EVIDENCE', gates, scope: 'LOCAL_REMEDIATION_NOT_ACCOUNT_OR_QUALIFICATION_AUTHORIZATION', assertions: unitCases, reportSchemaCases, browserJourneys: browserCases, actualProviderCalls: 0, actualCredentialResolution: false, qualificationAttempts: 0, qualificationCounted: 0, blockers })
  write('EVIDENCE/KNOWN_LIMITATIONS.md', '# Bounded R2 limits\n\nStatus: BLOCKED_WITH_EVIDENCE. Exact source and canonical semantics are remediated, not Lead accepted. Automated local suites are not real provider/campaign activity or manual assistive-technology certification. The dynamic1024 frontier fixture proves an algorithm conditional on useful durable observations, not historical successes or guaranteed reachability. Missing exact endpoint contracts cannot be repaired by count padding, family aliases or an unauthorized fetch.\n\nThe original one-attempt HTTP200 zero-credit account observation is consumed after rejected R1 ordering; read-only reuse confers no new account or qualification authority. Private paths/raw payload and separate asset lane are excluded. Final art/animation/copy, Mission02, content lock, hosting and release readiness remain unclaimed.\n\n' + blockers.map(item => item.id + ': ' + item.summary).join('\n') + '\n')
  write('README.md', `# A2U-R2 bounded remediation\n\nStatus: BLOCKED_WITH_EVIDENCE. Exact current source, corrected section taxonomy and durable utility-bound frontier are implemented and verified; Lead acceptance is not claimed. Required relationship/exact-receipt contracts remain unadmitted in preserved material. No new provider/account/web-fetch request or credential resolution occurred; qualification attempts/counts remain0. The original account report is byte-identical to reviewed R1.\n\nCandidate ${cut.commit}; tree ${cut.tree}. Restore with GIT/trace-escape-complete.bundle. SOURCE_DIFF.patch is against R1 ${OBSERVATION_CUT}. Source manifests resolve within the restored repository. Reports identify the consumed observation, read-only reuse proof, held authorization and concrete blockers. MANIFEST.sha256 governs every payload except itself. No asset lane, raw observation, private path, preview or duplicated source tree is included.\n`)
  write('DELIVERY_MANIFEST.json', { schemaVersion: '1.0.0', archiveName, status: 'BLOCKED_WITH_EVIDENCE', ...cut, resumedFrom: OBSERVATION_CUT, activeSourceIdentity: identity(ACTIVE), sourceVersions: ['1.7.0', '1.7.1'], originalAccountReportByteIdentical: true, originalAccountReportSha256: sha(originalAccountBytes), accountObservationReuseStatus: reuseReceipt.status, recordedAccountAttemptsConsumed: 1, additionalAccountAttempts: 0, providerCallsInGate: 0, credentialResolutionInGate: false, qualificationAttempts: 0, qualificationCounted: 0, qualificationCallsAllowed: false, checkpointHold: true, completeClonableBundle: true, privatePathsPackaged: false, rawPayloadPackaged: false, separateAssetLanePackaged: false, priorEvidencePreserved: true, leadAcceptanceClaimed: false, finalArtClaimed: false, finalNarrativeClaimed: false, finalAnimationInventoryClaimed: false, mission02Admitted: false, contentLockClaimed: false, hostingClaimed: false, releaseReadinessClaimed: false, blockers })
  await suite('redacted-delivery-secret-scan', 'node', [path.join(root, 'scripts/scan-prohibitions.mjs'), delivery])
  write('EVIDENCE/VERIFICATION_SUMMARY.json', { schemaVersion: '1.0.0', status: 'BLOCKED_WITH_EVIDENCE', localExecutedSuites: 'PASS', candidate: cut, suites: verification, unitAssertions: unitCases.length, browserJourneys: browserCases.length, actualLocalObservationReuse: reuseReceipt.status, relevantCodeUnchanged: true, historicalEvidencePreserved: true, historicalArchivesPreserved: Object.fromEntries(historic), freshCloneIdentityVerified: true, activeSchemaReportsValidated: true, networkHoldPreload: true, externalRequestsIssued: 0, credentialResolutionInGate: false, qualificationAttempts: 0, qualificationCounted: 0, dedicatedReviewIdentity: r2ImplementationIdentity(root), blockers })
  const allowed = /^(?:README\.md|DELIVERY_MANIFEST\.json|MANIFEST\.sha256|SOURCE_DIFF\.patch|GIT\/trace-escape-complete\.bundle|SOURCE_INSTALL\/(?:SOURCE_INSTALLATION_REPORT\.json|ACTIVE_SOURCE_MANIFEST\.sha256)|REPORTS\/(?:NQ5_OFFLINE_PRECALL_AUTHORIZATION_REPORT|NQ5_ACCOUNT_PREFLIGHT_REDACTED|ACCOUNT_OBSERVATION_REUSE_RECEIPT|NQ5_PRECALL_AUTHORIZATION_REPORT)\.json|PLANS\/(?:T1_PLAN|T1_FRONTIER_POLICY|T1_RESERVE_PLAN)\.json|EVIDENCE\/(?:TERMINAL_TAXONOMY_AND_PARITY_MATRIX|T1_UTILITY_AND_ISSUABILITY_REPORT|OFFLINE_GATE_MATRIX|VERIFICATION_SUMMARY|REVIEW_FINDINGS_RESOLUTIONS)\.json|EVIDENCE\/KNOWN_LIMITATIONS\.md|VERIFICATION\/[a-z-]+\.log)$/
  if (files(delivery).some(file => !allowed.test(path.relative(delivery, file)))) throw new Error('Unexpected delivery payload.')
  write('MANIFEST.sha256', files(delivery).map(file => hash(file) + '  ' + path.relative(delivery, file)).sort().join('\n') + '\n')
  unchanged()
  if (verifyOnly) { process.stdout.write(JSON.stringify({ status: 'BLOCKED_WITH_EVIDENCE', localSuites: 'PASS', actualAccountReused: false, privateFilesRead: false, qualificationAttempts: 0, qualificationCounted: 0 }) + '\n') }
  else {
    const fixed = new Date('2000-01-01T00:00:00Z'), entries = files(delivery).map(file => { fs.utimesSync(file, fixed, fixed); return path.relative(delivery, file) }).sort()
    const zip = path.join(temporary, 'delivery.zip'), rebuilt = path.join(temporary, 'rebuilt.zip')
    await run('zip', ['-X', '-q', zip, ...entries], delivery); await run('zip', ['-X', '-q', rebuilt, ...entries], delivery)
    if (hash(zip) !== hash(rebuilt)) throw new Error('Identical rebuild failed.')
    await run('unzip', ['-t', zip]); const extracted = path.join(temporary, 'extracted'); fs.mkdirSync(extracted)
    await run('unzip', ['-q', zip, '-d', extracted]); await run('sha256sum', ['-c', 'MANIFEST.sha256'], extracted)
    if (!fs.readFileSync(path.join(extracted, 'REPORTS/NQ5_ACCOUNT_PREFLIGHT_REDACTED.json')).equals(originalAccountBytes)) throw new Error('Original report bytes changed.')
    unchanged(); fs.copyFileSync(zip, output, fs.constants.COPYFILE_EXCL)
    process.stdout.write(JSON.stringify({ status: 'BLOCKED_WITH_EVIDENCE', archive: output, sha256: hash(output), ...cut, members: entries.length, identicalRebuildVerified: true, governedHashesVerified: true, originalReportByteIdentical: true, actualAccountReuse: reuseReceipt.status, frozenNextBatch: frozen?.report.frozenNextBatchRequests ?? 0, providerCallsInGate: 0, qualificationAttempts: 0, qualificationCounted: 0 }) + '\n')
  }
} finally { fs.rmSync(temporary, { recursive: true, force: true }) }
