#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, execFileSync } from 'node:child_process'
import { assertCleanA2uSourceCut } from './g6p-a2u-cut.mjs'
import { implementationIdentity, assertAuthorityPreserved } from './nq5-review-identity.mjs'
import { assertFinalCheckpointConsistency, createOfflinePassReport, reportBytes, reportHash } from './nq5-checkpoint-reports.mjs'
import { compactRefresh } from './nq5-refresh-public-source.mjs'
import { snapshotCheckpointContracts } from './snapshot-nq5-checkpoint-contracts.mjs'
import { runAccountAdapter, validateCachedAccount, uncertainPriorAccountReport, ACCOUNT_ID } from './nq5/account.mjs'
import { resolveApprovedCredential } from './nq5/credential.mjs'
import { PrivateJournal, persistRaw, publishPrivateCache } from './nq5/journal.mjs'
import { freezeAcceptedT1 } from './nq5/t1.mjs'
import { sha } from './nq5/schema.mjs'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url))), parent = path.dirname(root)
const archiveName = 'TRACE_ESCAPE_G6P_A2U_R1_OFFLINE_GATE_COMPLETION_AND_PRECALL_CHECKPOINT_DELIVERY_v1.0.0.zip'
const output = path.join(parent, archiveName), verifyOnly = process.argv.includes('--verify-only')
if (process.argv.slice(2).some((arg) => arg !== '--verify-only') || (!verifyOnly && fs.existsSync(output))) throw new Error('Unsupported argument or existing archive; preserve it.')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-nq5-r1-')), delivery = path.join(temporary, 'delivery')
fs.mkdirSync(delivery)
const hash = (file) => sha(fs.readFileSync(file))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const write = (name, value) => { const file = path.join(delivery, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'string' ? value : reportBytes(value)) }
function files(directory) {
  return fs.readdirSync(directory).sort().flatMap((name) => { const file = path.join(directory, name), stat = fs.lstatSync(file); if (stat.isSymbolicLink()) throw new Error('Symlink in governed tree.'); return stat.isDirectory() ? files(file) : [file] })
}
function run(command, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }); let stdout = '', stderr = ''
    child.stdout.on('data', (data) => { stdout += data; if (stdout.length > 64000000) child.kill() })
    child.stderr.on('data', (data) => { stderr += data; if (stderr.length > 64000000) child.kill() })
    child.on('error', () => reject(new Error('Verification tool unavailable; no authorization.')))
    child.on('close', (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`Suite failed: ${command}; no credential resolution or archive publication.`)))
  })
}
const evidenceRoot = path.join(root, 'artifacts/g6p-a2u')
const historic = [
  ['TRACE_ESCAPE_G6P_A2U_UNIFIED_INVESTIGATION_LOOP_AND_NANSEN_QUESTION_LENSES_DELIVERY_v1.0.0.zip', 'f0840693e7a751a9b58f0dc4b9872e54c43012bea961239eb7e5417fc7865598'],
  ['TRACE_ESCAPE_G6P_A2U_UNIFIED_INVESTIGATION_LOOP_AND_NANSEN_QUESTION_LENSES_DELIVERY_v1.0.1.zip', 'fa80eb43041563e8331743b904fc0e49eb1cdd6470b1d968329cb101a5362b0c'],
  ['TRACE_ESCAPE_G6P_A2U_NQ5_PRECAMPAIGN_CHECKPOINT_DELIVERY_v1.0.2.zip', '7fdf2b7c126d6b2b04b186f9674dd00a8eba7adee312d4b1cec2fc868e405403'],
]
const snapshot = () => Object.fromEntries(files(evidenceRoot).map((file) => [path.relative(evidenceRoot, file), hash(file)]))
try {
  const cut = assertCleanA2uSourceCut(root), preserved = snapshot()
  assertAuthorityPreserved(root)
  for (const [name, expected] of historic) if (hash(path.join(parent, name)) !== expected) throw new Error('Historical archive changed.')
  for (const ancestor of ['0fec4680efc7bfafc9d2d0497f54b26be733e234', '8cb53c91e2dcaae81e9b84dfe848c19e27e96d9e', 'c911e8f6ce433fa8de94a90a9d4a0e8c4bcd2eee']) await run('git', ['merge-base', '--is-ancestor', ancestor, cut.commit])
  const unchanged = () => { if (JSON.stringify(assertCleanA2uSourceCut(root)) !== JSON.stringify(cut) || JSON.stringify(snapshot()) !== JSON.stringify(preserved)) throw new Error('Source or historical evidence changed.'); for (const [name, expected] of historic) if (hash(path.join(parent, name)) !== expected) throw new Error('Historical archive changed.') }
  const review = JSON.parse(fs.readFileSync(path.join(root, 'docs/G6P_A2U_R1_REVIEW.json')))
  const requiredLenses = ['GAMEPLAY_INVESTIGATION', 'CANONICAL_QUERY_QUESTION_LENSES', 'EVIDENCE_PROOF', 'PROVENANCE_ARCHIVE_ALLOWANCE', 'SAFETY_NO_LEAK_NO_NETWORK', 'ART_PERFORMANCE', 'ACCESSIBILITY', 'EVALUATION_REGRESSION']
  if (review.status !== 'PASS' || review.unresolvedAcceptedP0P1 !== 0 || review.implementationSha256 !== implementationIdentity(root) || review.lenses.map((lens) => lens.name).sort().join() !== requiredLenses.sort().join() || review.lenses.some((lens) => lens.status !== 'PASS_BOUNDED_OFFLINE_SCOPE')) throw new Error('Dedicated review is absent, stale or incomplete.')
  write('EVIDENCE/REVIEW_FINDINGS_RESOLUTIONS.json', review)
  const verification = [], unitTests = [], browserTests = []
  const suite = async (id, command, args, cwd, jsonKind) => {
    process.stdout.write(`VERIFY ${id}\n`)
    const result = await run(command, args, cwd)
    let text = result.stdout
    if (jsonKind === 'vitest') {
      const report = JSON.parse(result.stdout)
      if (!report.success || report.numFailedTests) throw new Error('Unit JSON result failed closed.')
      const names = report.testResults.flatMap((file) => file.assertionResults.map((test) => ({ suite: path.relative(root, file.name), name: test.fullName, result: test.status.toUpperCase() })))
      if (id === 'unit-domain-offline') unitTests.push(...names)
      text = `${id}: PASS\nTest files: ${report.numPassedTestSuites}\nTests: ${report.numPassedTests}; failed:0\nExact R1 cases are named once in EVIDENCE/OFFLINE_GATE_MATRIX.json.\n`
    }
    if (jsonKind === 'playwright') {
      const report = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')))
      const visit = (suites) => suites.flatMap((node) => [...(node.specs ?? []).map((spec) => ({ name: spec.title, result: spec.ok && spec.tests.every((test) => test.status === 'expected') ? 'PASS' : 'FAIL' })), ...visit(node.suites ?? [])])
      const names = visit(report.suites); if (names.some((test) => test.result !== 'PASS') || report.stats.unexpected) throw new Error('Browser JSON result failed closed.')
      browserTests.push(...names); text = `${id}: PASS\nTests: ${names.length}\n${names.map((test) => `${test.result}: ${test.name}`).join('\n')}\n`
    }
    write(`VERIFICATION/${id}.log`, text)
    verification.push({ suite: id, status: 'PASS', log: `VERIFICATION/${id}.log`, sha256: hash(path.join(delivery, `VERIFICATION/${id}.log`)) })
    process.stdout.write(`${id}: PASS\n`)
  }
  const overlay = path.join(root, 'docs/overlays/g6p-a2u-failure-schema-v1.0.2')
  await suite('source-admission', 'sha256sum', ['-c', 'MANIFEST.sha256'], overlay)
  await suite('supplied-schema-probes', 'python3', ['05_VALIDATE_FAILURE_REPORT_SCHEMAS.py'], overlay)
  await suite('report-semantics-privacy', 'python3', ['scripts/test-nq5-report-validation.py'])
  await suite('typecheck-lint', 'npm', ['run', 'check'])
  await suite('acquisition-compile', 'npm', ['run', 'acquisition:compile'])
  await suite('unit-domain-offline', 'npx', ['vitest', 'run', 'tests/unit', '--reporter=json'], root, 'vitest')
  await suite('acquisition-regression', 'npx', ['vitest', 'run', 'tests/acquisition', '--reporter=json'], root, 'vitest')
  await suite('browser-accessibility-performance', 'npm', ['run', 'test:e2e', '--', '--reporter=json'], root, 'playwright')
  await suite('production-build', 'npm', ['run', 'build'])
  await suite('browser-boundary', 'npm', ['run', 'browser-boundary:verify'])
  unchanged()
  const contractDirectory = path.join(temporary, 'contracts')
  let refresh = compactRefresh(await snapshotCheckpointContracts(contractDirectory))
  if (refresh.status !== 'PASS_PUBLIC_DOC_REFRESH_ONLY') throw new Error('Official docs refresh incomplete; no credential resolution.')
  write('EVIDENCE/OFFICIAL_CONTRACT_REFRESH.json', refresh)
  const bundle = path.join(delivery, 'GIT/trace-escape-complete.bundle'); fs.mkdirSync(path.dirname(bundle), { recursive: true })
  await run('git', ['-c', 'pack.threads=1', 'bundle', 'create', bundle, 'HEAD'])
  await run('git', ['bundle', 'verify', bundle])
  const clone = path.join(temporary, 'clone')
  await run('git', ['clone', '--quiet', bundle, clone])
  if ((await run('git', ['rev-parse', 'HEAD'], clone)).stdout.trim() !== cut.commit || (await run('git', ['rev-parse', 'HEAD^{tree}'], clone)).stdout.trim() !== cut.tree) throw new Error('Cloned source identity mismatch.')
  await suite('bundle-clone-fsck', 'git', ['fsck', '--strict', '--full'], clone)
  await suite('candidate-history-secret-scan', 'node', ['scripts/verify-git-secret-history.mjs'], clone)
  write('SOURCE_DIFF.patch', (await run('git', ['diff', '--binary', '0fec4680efc7bfafc9d2d0497f54b26be733e234', cut.commit])).stdout)
  const scanRoot = path.join(temporary, 'scan'); fs.mkdirSync(scanRoot)
  await run('git', ['archive', '--format=tar', '-o', path.join(temporary, 'scan.tar'), 'HEAD'])
  await run('tar', ['-xf', path.join(temporary, 'scan.tar'), '-C', scanRoot])
  fs.cpSync(path.join(root, 'dist'), path.join(scanRoot, 'dist'), { recursive: true })
  await suite('scoped-source-build-secret-scan', 'node', [path.join(root, 'scripts/scan-prohibitions.mjs'), scanRoot])
  const schema = JSON.parse(fs.readFileSync(path.join(overlay, '03_NQ5_OFFLINE_PRECALL_AUTHORIZATION_REPORT.schema.json')))
  const gates = Object.fromEntries(schema.$defs.allPassGates.required.map((gate) => [gate, 'PASS']))
  const names = (pattern) => unitTests.filter((test) => pattern.test(test.suite))
  const matrix = { schemaVersion: '1.0.0', candidate: cut, scope: 'BOUNDED_OFFLINE_COMPLETION_NOT_LEAD_ACCEPTANCE', gates,
    schemaConformance: names(/nq5-r1-catalog/), suppliedSchemas: ['05_CASE_CLUE_QUERY_AND_QUESTION_LENS.schema.json', '06_CASE_TERMINAL_AND_CASEBOARD_CONTRACT.schema.json', '07_EVIDENCE_ROUTE_PUZZLE_AND_PROOF.schema.json', '08_RESULT_CARD_AND_TRACE_THREAD.schema.json', '03_PRIVATE_CALL_LEDGER.schema.json', '04_PUBLIC_CALL_INDEX.schema.json'],
    plannerStorageProjectionAccountTests: names(/nq5-r1-(?:offline|official)/), parity: browserTests.filter((test) => /R1 parity|physical plunger|ordinary earned|12,288|keyboard/.test(test.name)), manualAssistiveTechnologyCertificationClaimed: false, realCredentialsInFixtures: false, realProviderCallsInFixtures: 0, qualificationAttempts: 0, qualificationCounted: 0 }
  if (matrix.schemaConformance.length < 42 || matrix.plannerStorageProjectionAccountTests.length < 101 || matrix.parity.filter((test) => /^R1 parity/.test(test.name)).length !== 6) throw new Error('Missing exact mandatory offline suite evidence.')
  write('EVIDENCE/OFFLINE_GATE_MATRIX.json', matrix)
  write('EVIDENCE/VERIFICATION_SUMMARY.json', { status: 'PASS', candidate: cut, suites: verification, priorEvidencePreserved: true, historicalArchivesPreserved: Object.fromEntries(historic), freshCloneIdentityVerified: true, qualificationHold: true })
  await suite('precredential-generated-output-secret-scan', 'node', [path.join(root, 'scripts/scan-prohibitions.mjs'), delivery])
  unchanged()
  const offline = createOfflinePassReport(cut, gates, new Date().toISOString())
  write('REPORTS/NQ5_OFFLINE_PRECALL_AUTHORIZATION_REPORT.json', offline)
  if (verifyOnly) {
    const destination = fs.mkdtempSync(path.join(parent, 'nq5-r1-offline-verification-'))
    fs.cpSync(delivery, destination, { recursive: true })
    process.stdout.write(`${JSON.stringify({ offlineStatus: 'PASS', candidate: cut, credentialResolutionAttempted: false, providerCallsIssued: 0, qualificationAttempts: 0, evidence: destination })}\n`)
  } else {
    // Only this branch, after all offline checks and report publication, can resolve a key.
    const privateRoot = path.join(os.homedir(), '.local/share/trace-escape/nq5-private/r1-account')
    const primaryRoot = path.join(privateRoot, 'primary'), mirrorRoot = path.join(os.homedir(), '.local/state/trace-escape/nq5-private/r1-account/mirror')
    const journal = new PrivateJournal(path.join(privateRoot, 'account.jsonl'))
    const cache = path.join(privateRoot, 'redacted-checkpoint.json')
    let account, credentialResolutionAttempted = false
    if (fs.existsSync(cache)) {
      try {
        const previous = JSON.parse(fs.readFileSync(cache))
        if (previous.commit !== cut.commit || previous.tree !== cut.tree) throw new Error('Prior source cut; no repeat issue.')
        account = validateCachedAccount(previous.report, journal)
      } catch { account = uncertainPriorAccountReport() }
    } else if (journal.rows.some((row) => row.event === 'START' && row.record.logicalId === ACCOUNT_ID)) {
      account = uncertainPriorAccountReport()
    } else {
      const { createNansenTransport } = await import('../.acquisition-build/src/acquisition/live/transport.js')
      account = await runAccountAdapter({ offline, candidate: cut, journal, resolveCredential: () => { credentialResolutionAttempted = true; return resolveApprovedCredential(offline, cut, path.join(parent, 'sources/NANSEN_API_KEY.txt')) }, transport: createNansenTransport(), persist: (id, bytes) => persistRaw(primaryRoot, mirrorRoot, id, bytes) })
      publishPrivateCache(cache, reportBytes({ ...cut, report: account }))
    }
    write('REPORTS/NQ5_ACCOUNT_PREFLIGHT_REDACTED.json', account)
    let frozen = null, blockers = [...account.blockers]
    if (account.ACCOUNT_PREFLIGHT_PASS) {
      refresh = compactRefresh(await snapshotCheckpointContracts(path.join(temporary, 'post-account-contracts')))
      write('EVIDENCE/OFFICIAL_CONTRACT_REFRESH.json', refresh)
      try {
        // Public-only accepted seed compiler is loaded from the existing build tool.
        const { buildFrozenFixture } = await import('../.acquisition-build/src/investigation/fixture.js')
        const base = path.join(root, 'public/scenarios/euler-2023-false-exit')
        frozen = freezeAcceptedT1(refresh, account, buildFrozenFixture(JSON.parse(fs.readFileSync(path.join(base, 'scenario.json'))), JSON.parse(fs.readFileSync(path.join(base, 'evidence-graph.json')))))
        write('PLANS/T1_PLAN.json', frozen.plan); write('PLANS/T1_RESERVE_PLAN.json', frozen.reserve)
        if (!frozen.completeTargetPlan) blockers.push({ id: 'T1_UTILITY_FRONTIER_INSUFFICIENT', summary: 'The accepted first-page utility frontier does not cover the1024 cumulative target. No count-driven time fragmentation or unsupported subject expansion was admitted.', evidence_refs: ['PLANS/T1_PLAN.json'] })
      } catch { blockers.push({ id: 'T1_CONTRACT_OR_OBSERVED_BUDGET_ADMISSION_FAILED', summary: 'Current exact endpoint/schema/pricing/rate/coverage/redistribution and observed-balance-minus250 admission failed closed; no qualification request occurred.', evidence_refs: ['EVIDENCE/OFFICIAL_CONTRACT_REFRESH.json'] }) }
    }
    const authorized = !!account.ACCOUNT_PREFLIGHT_PASS && !!frozen?.completeTargetPlan && !blockers.length
    const final = { schema_version: '1.0.2', status: authorized ? 'PASS' : 'BLOCKED_WITH_EVIDENCE', AUTHORIZED_TO_ISSUE: authorized, checkpoint_hold: true, qualification_calls_allowed: false, qualification_attempts: 0, qualification_counted: 0, candidate_commit: cut.commit, candidate_tree: cut.tree, generated_at_utc: new Date().toISOString(), objective_gates: gates, offline_report: offline, account_report: account, offline_report_sha256: reportHash(offline), account_report_sha256: reportHash(account), source_manifest_sha256: hash(path.join(overlay, 'MANIFEST.sha256')), allowance_sha256: hash(path.join(root, 'docs/overlays/g6p-a2u-v1.0.1/02_NANSEN_UTILITY_BOUND_QUALIFICATION_ALLOWANCE.yaml')), offline_schema_sha256: hash(path.join(overlay, '03_NQ5_OFFLINE_PRECALL_AUTHORIZATION_REPORT.schema.json')), account_schema_sha256: hash(path.join(overlay, '04_NQ5_ACCOUNT_PREFLIGHT_REDACTED.schema.json')), contracts_sha256: hash(path.join(delivery, 'EVIDENCE/OFFICIAL_CONTRACT_REFRESH.json')), review_sha256: hash(path.join(delivery, 'EVIDENCE/REVIEW_FINDINGS_RESOLUTIONS.json')), frozen_t1: frozen ? { plan_sha256: frozen.plan.hash, reserve_plan_sha256: frozen.reserve.hash, worst_case_credits: frozen.plan.worstCaseCredits + frozen.reserve.worstCaseCredits } : null, available_credits: account.account.available_credits, protected_reserve_credits: 250, blockers }
    assertFinalCheckpointConsistency(final); write('REPORTS/NQ5_PRECALL_AUTHORIZATION_REPORT.json', final)
    const status = authorized ? 'DELIVERED_PENDING_LEAD_REVIEW' : 'BLOCKED_WITH_EVIDENCE'
    write('EVIDENCE/KNOWN_LIMITATIONS.md', '# Known limits\n\nAll thirteen offline gates passed the named automated suites. Fixtures are not real account/campaign activity or manual assistive-technology certification. Final art/copy/inventory, Lead acceptance, qualification completion, Mission02, lock and release readiness remain unclaimed. Qualification is unconditionally held. Native/NFT/unknown facts and undocumented exact-name redistribution rules remain private/rejected.\n\n' + blockers.map((blocker) => `${blocker.id}: ${blocker.summary}`).join('\n') + '\n')
    write('README.md', `# R1 offline completion and pre-call checkpoint\n\nStatus: ${status}. All thirteen offline gates PASS. Account status: ${account.status}; attempts: ${account.request.attempts_issued}. Final pre-call authorization: ${authorized}. Qualification attempts/counts:0; unconditional checkpoint hold. No raw account payload, private storage path, credential or asset lane is packaged.\n\nRestore the exact source from GIT/trace-escape-complete.bundle. Candidate commit ${cut.commit}; tree ${cut.tree}. SOURCE_DIFF.patch is against reviewed0fec4680efc7bfafc9d2d0497f54b26be733e234. Reports and EVIDENCE contain exact gates/tests, contract refresh, review resolutions and concrete blockers. MANIFEST.sha256 governs every payload file except itself. Historical deliveries/reports remain byte-identical in the original workspace, not duplicated here.\n\nLead acceptance, art binding, narrative lock, Mission02 and release readiness are not claimed.\n`)
    write('DELIVERY_MANIFEST.json', { schemaVersion: '1.0.0', archiveName, status, ...cut, resumedFrom: '0fec4680efc7bfafc9d2d0497f54b26be733e234', offlineGates: gates, accountStatus: account.status, credentialResolutionAttempted, accountAttempts: account.request.attempts_issued, providerCallsIssued: account.request.attempts_issued, accountBalance: account.account.available_credits, accountActualCreditDelta: account.response.actual_credit_delta, AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT: true, AUTHORIZED_TO_ISSUE: authorized, qualificationAttempts: 0, qualificationCounted: 0, qualificationCallsAllowed: false, checkpointHold: true, priorEvidencePreserved: true, completeClonableBundle: true, privatePathsPackaged: false, rawAccountPackaged: false, assetLanePackaged: false, leadAcceptanceClaimed: false, finalArtClaimed: false, mission02Admitted: false, blockers })
    const finalScan = await run('node', [path.join(root, 'scripts/scan-prohibitions.mjs'), delivery])
    const scanLog = 'VERIFICATION/precredential-generated-output-secret-scan.log'
    write(scanLog, fs.readFileSync(path.join(delivery, scanLog), 'utf8') + '\nFinal redacted-output phase:\n' + finalScan.stdout)
    verification.find((entry) => entry.log === scanLog).sha256 = hash(path.join(delivery, scanLog))
    write('EVIDENCE/VERIFICATION_SUMMARY.json', { status: 'PASS', candidate: cut, suites: verification, priorEvidencePreserved: true, historicalArchivesPreserved: Object.fromEntries(historic), historicalAuthorityPreserved: true, freshCloneIdentityVerified: true, offlineAndAccountReportValidation: 'PASS', finalCheckpointSemanticValidation: 'PASS', qualificationHold: true })
    const allowed = /^(?:README\.md|DELIVERY_MANIFEST\.json|MANIFEST\.sha256|SOURCE_DIFF\.patch|GIT\/trace-escape-complete\.bundle|REPORTS\/(?:NQ5_OFFLINE_PRECALL_AUTHORIZATION_REPORT|NQ5_ACCOUNT_PREFLIGHT_REDACTED|NQ5_PRECALL_AUTHORIZATION_REPORT)\.json|PLANS\/(?:T1_PLAN|T1_RESERVE_PLAN)\.json|EVIDENCE\/(?:OFFLINE_GATE_MATRIX|OFFICIAL_CONTRACT_REFRESH|VERIFICATION_SUMMARY|REVIEW_FINDINGS_RESOLUTIONS)\.json|EVIDENCE\/KNOWN_LIMITATIONS\.md|VERIFICATION\/[a-z-]+\.log)$/
    if (files(delivery).some((file) => !allowed.test(path.relative(delivery, file)))) throw new Error('Unexpected archive payload.')
    write('MANIFEST.sha256', files(delivery).map((file) => `${hash(file)}  ${path.relative(delivery, file)}`).sort().join('\n') + '\n')
    const fixed = new Date('2000-01-01T00:00:00Z')
    const entries = files(delivery).map((file) => { fs.utimesSync(file, fixed, fixed); return path.relative(delivery, file) }).sort()
    const zip = path.join(temporary, 'delivery.zip'), rebuilt = path.join(temporary, 'rebuilt.zip')
    await run('zip', ['-X', '-q', zip, ...entries], delivery); await run('zip', ['-X', '-q', rebuilt, ...entries], delivery)
    if (hash(zip) !== hash(rebuilt)) throw new Error('Deterministic archive rebuild mismatch.')
    await run('unzip', ['-t', zip]); const extracted = path.join(temporary, 'extracted'); fs.mkdirSync(extracted)
    await run('unzip', ['-q', zip, '-d', extracted]); await run('sha256sum', ['-c', 'MANIFEST.sha256'], extracted)
    unchanged(); fs.copyFileSync(zip, output, fs.constants.COPYFILE_EXCL)
    process.stdout.write(`${JSON.stringify({ status, archive: output, sha256: hash(output), ...cut, offlineGates: gates, accountAttempts: account.request.attempts_issued, qualificationAttempts: 0, qualificationCounted: 0, identicalRebuildVerified: true, governedHashesVerified: true })}\n`)
  }
} finally { fs.rmSync(temporary, { recursive: true, force: true }) }
