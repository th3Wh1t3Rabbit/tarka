#!/usr/bin/env node
// Offline checkpoint only. No account adapter, credential resolver or campaign
// runner is invoked; incomplete offline gates produce truthful blocked reports.
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { constants, copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertCleanA2uSourceCut } from './g6p-a2u-cut.mjs'
import { assertFinalCheckpointConsistency, createBlockedOfflineReport, createUnissuedAccountReport, reportBytes, reportHash } from './nq5-checkpoint-reports.mjs'
import { snapshotCheckpointContracts } from './snapshot-nq5-checkpoint-contracts.mjs'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const parent = path.dirname(root)
const archiveName = 'TRACE_ESCAPE_G6P_A2U_NQ5_PRECAMPAIGN_CHECKPOINT_DELIVERY_v1.0.2.zip'
const output = path.join(parent, archiveName)
if (process.argv.slice(2).some((argument) => argument !== '--verify-only')) throw new Error('Unsupported argument.')
const verifyOnly = process.argv.includes('--verify-only')
if (!verifyOnly && existsSync(output)) throw new Error('Existing checkpoint output must be preserved.')
const temp = mkdtempSync(path.join(os.tmpdir(), 'trace-nq5-checkpoint-'))
const delivery = path.join(temp, archiveName.replace(/\.zip$/, ''))
const overlay = path.join(root, 'docs/overlays/g6p-a2u-failure-schema-v1.0.2')
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const run = (command, args, cwd = root) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 64_000_000 })
  if (result.status !== 0) throw new Error(`${command} failed; no authorization or checkpoint output is published. ${result.stderr || result.stdout}`)
  return result.stdout
}
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
function files(directory) {
  return readdirSync(directory).sort().flatMap((name) => {
    const file = path.join(directory, name); const stat = lstatSync(file)
    if (stat.isSymbolicLink()) throw new Error('Symlink in governed evidence/output.')
    return stat.isDirectory() ? files(file) : [file]
  })
}
const evidence = path.join(root, 'artifacts/g6p-a2u')
const historical = [
  ['TRACE_ESCAPE_G6P_A2U_UNIFIED_INVESTIGATION_LOOP_AND_NANSEN_QUESTION_LENSES_DELIVERY_v1.0.0.zip', 'f0840693e7a751a9b58f0dc4b9872e54c43012bea961239eb7e5417fc7865598'],
  ['TRACE_ESCAPE_G6P_A2U_UNIFIED_INVESTIGATION_LOOP_AND_NANSEN_QUESTION_LENSES_DELIVERY_v1.0.1.zip', 'fa80eb43041563e8331743b904fc0e49eb1cdd6470b1d968329cb101a5362b0c'],
]
const blockers = [
  ['precall/NQ5_PRECALL_AUTHORIZATION_REPORT.json', '127a54a809717dd9ffadddfce70b2126fa680c7e0078ee477cddac0d5e6067d6'],
  ['current/precall/NQ5_PRECALL_AUTHORIZATION_REPORT.json', 'bace5c9735cadac844177cdef73d461fea345e12c8f5eee6d1321182e3dbb26f'],
]
const preservedSnapshot = () => Object.fromEntries(files(evidence).map((file) => [path.relative(evidence, file), hash(file)]))
const preserve = () => {
  for (const [name, expected] of historical) if (hash(path.join(parent, name)) !== expected) throw new Error('Historical delivery changed.')
  for (const [name, expected] of blockers) if (hash(path.join(evidence, name)) !== expected) throw new Error('Historical blocker changed.')
}
try {
  const cut = assertCleanA2uSourceCut(root)
  run('git', ['merge-base', '--is-ancestor', '8b229bc3a6783006ee5a6d4a92598490e0955c8e', cut.commit])
  preserve(); const priorHashes = preservedSnapshot()
  const unchanged = () => {
    preserve()
    if (JSON.stringify(preservedSnapshot()) !== JSON.stringify(priorHashes) || JSON.stringify(assertCleanA2uSourceCut(root)) !== JSON.stringify(cut)) throw new Error('Source identity or prior evidence changed.')
  }
  const sourcePaths = git('ls-tree', '-r', '--name-only', 'HEAD').split('\n')
  if (sourcePaths.some((name) => /^(?:ART_PRODUCTION|\.cursor)(?:\/|$)/.test(name))) throw new Error('Separate art lane must not be exported.')
  mkdirSync(path.join(delivery, 'CHECKPOINT_EVIDENCE/verification'), { recursive: true })
  const results = []
  const logStep = (id, body) => {
    const log = `CHECKPOINT_EVIDENCE/verification/${id}.log`
    writeFileSync(path.join(delivery, log), body)
    results.push({ id, status: 'PASS', log, sha256: hash(path.join(delivery, log)) })
  }
  const steps = [
    ['corrected-source-manifest', 'sha256sum', ['-c', 'MANIFEST.sha256'], overlay],
    ['supplied-schema-probes', 'python3', ['05_VALIDATE_FAILURE_REPORT_SCHEMAS.py'], overlay],
    ['corrected-semantic-matrix', 'python3', ['scripts/test-nq5-report-validation.py']],
    ['check', 'npm', ['run', 'check']], ['acquisition-compile', 'npm', ['run', 'acquisition:compile']], ['unit', 'npm', ['test']],
    ['legacy-acquisition-regression', 'npm', ['run', 'test:acquisition']],
    ['browser', 'npm', ['run', 'test:e2e']], ['build', 'npm', ['run', 'build']],
    ['browser-boundary', 'npm', ['run', 'browser-boundary:verify']],
  ]
  for (const [id, command, args, cwd] of steps) {
    process.stdout.write(`VERIFY ${id}\n`); logStep(id, run(command, args, cwd)); process.stdout.write(`${id}: PASS\n`)
  }
  unchanged()
  const docs = await snapshotCheckpointContracts(path.join(delivery, 'CHECKPOINT_EVIDENCE/contracts'))
  const source = path.join(delivery, 'SOURCE_SNAPSHOT'); mkdirSync(source)
  const tar = path.join(temp, 'source.tar')
  run('git', ['archive', '--format=tar', '-o', tar, 'HEAD']); run('tar', ['-xf', tar, '-C', source])
  cpSync(evidence, path.join(delivery, 'PRESERVED_PRIOR_EVIDENCE'), { recursive: true })
  for (const [name, expected] of Object.entries(priorHashes)) if (hash(path.join(delivery, 'PRESERVED_PRIOR_EVIDENCE', name)) !== expected) throw new Error('Copied prior evidence mismatch.')
  mkdirSync(path.join(delivery, 'HISTORICAL_DELIVERIES'))
  for (const [name, expected] of historical) {
    copyFileSync(path.join(parent, name), path.join(delivery, 'HISTORICAL_DELIVERIES', name))
    if (hash(path.join(delivery, 'HISTORICAL_DELIVERIES', name)) !== expected) throw new Error('Copied historical delivery mismatch.')
  }
  cpSync(path.join(root, 'dist'), path.join(delivery, 'PRINCIPAL_PREVIEW/site'), { recursive: true })
  // Browser outputs are generated under ignored framework output paths, not old evidence.
  if (existsSync(path.join(root, 'test-results'))) cpSync(path.join(root, 'test-results'), path.join(delivery, 'CHECKPOINT_EVIDENCE/browser-artifacts'), { recursive: true })
  writeFileSync(path.join(delivery, 'PRINCIPAL_PREVIEW/README.md'), '# Static provisional fixture preview\n\nRun python3 -m http.server 8080 --directory site here. Earn the First Breach through the office puzzle, then open the terminal. Explicit nonhistorical test mode: ?review=1&caseFixture=synthetic. No provider request occurs in browser play.\n')
  mkdirSync(path.join(delivery, 'GIT'))
  const bundle = path.join(delivery, 'GIT/trace-escape-complete.bundle')
  run('git', ['-c', 'pack.threads=1', 'bundle', 'create', bundle, 'HEAD']); run('git', ['bundle', 'verify', bundle])
  const clone = path.join(temp, 'clone-proof'); run('git', ['clone', '--quiet', bundle, clone])
  if (run('git', ['rev-parse', 'HEAD'], clone).trim() !== cut.commit || run('git', ['rev-parse', 'HEAD^{tree}'], clone).trim() !== cut.tree) throw new Error('Cloned code identity mismatch.')
  logStep('clone-fsck', run('git', ['fsck', '--strict', '--full'], clone))
  logStep('candidate-history-secret-scan', run('node', ['scripts/verify-git-secret-history.mjs'], clone))
  const review = path.join(source, 'docs/G6P_A2U_V1_0_2_REVIEW.md')
  if (!existsSync(review)) throw new Error('Missing committed dedicated review evidence.')
  // This snapshot supplies bounded correction/performance evidence, not all
  // remaining product/adapter/runtime gates. Never manufacture their PASS.
  const gates = { source_admission: 'PASS', complete_local_regression: 'PASS', current_official_docs_snapshot: docs.status === 'PASS_PUBLIC_DOC_REFRESH_ONLY' ? 'PASS' : 'NOT_VERIFIED', fixture_schema_conformance: 'NOT_VERIFIED', terminal_archive_feature_parity: 'NOT_VERIFIED', large_corpus_browser_performance: 'PASS', dedicated_review: 'PASS', nq5_planner_and_runtime_tests: 'NOT_VERIFIED', ledger_crash_tail_and_dual_root_storage: 'NOT_VERIFIED', endpoint_policy_and_public_projection: 'NOT_VERIFIED', credential_browser_boundary: 'PASS', secret_scans: 'NOT_VERIFIED', account_adapter_fixture_tests: 'NOT_VERIFIED' }
  // Scan all generated source/build/log/browser/evidence content and candidate
  // ancestry, never the user art lane. Historical nested archives are hash-bound.
  logStep('scoped-output-secret-scan', run('node', ['scripts/scan-prohibitions.mjs', delivery])); gates.secret_scans = 'PASS'
  const timestamp = new Date().toISOString()
  const offline = createBlockedOfflineReport(cut, gates, timestamp)
  const account = createUnissuedAccountReport(timestamp)
  const final = { schema_version: '1.0.2', status: 'BLOCKED_WITH_EVIDENCE', AUTHORIZED_TO_ISSUE: false, checkpoint_hold: true, qualification_calls_allowed: false, qualification_attempts: 0, qualification_counted: 0, candidate_commit: cut.commit, candidate_tree: cut.tree, generated_at_utc: timestamp, objective_gates: gates, offline_report: offline, account_report: account, offline_report_sha256: reportHash(offline), account_report_sha256: reportHash(account), source_manifest_sha256: hash(path.join(overlay, 'MANIFEST.sha256')), allowance_sha256: hash(path.join(root, 'docs/overlays/g6p-a2u-v1.0.1/02_NANSEN_UTILITY_BOUND_QUALIFICATION_ALLOWANCE.yaml')), offline_schema_sha256: hash(path.join(overlay, '03_NQ5_OFFLINE_PRECALL_AUTHORIZATION_REPORT.schema.json')), account_schema_sha256: hash(path.join(overlay, '04_NQ5_ACCOUNT_PREFLIGHT_REDACTED.schema.json')), contracts_sha256: hash(path.join(delivery, 'CHECKPOINT_EVIDENCE/contracts/OFFICIAL_CONTRACT_REFRESH.json')), review_sha256: hash(review), frozen_t1: null, available_credits: null, protected_reserve_credits: 250, blockers: offline.blockers }
  assertFinalCheckpointConsistency(final)
  mkdirSync(path.join(delivery, 'CHECKPOINT_REPORTS'))
  for (const [name, report] of [['NQ5_OFFLINE_PRECALL_AUTHORIZATION_REPORT.json', offline], ['NQ5_ACCOUNT_PREFLIGHT_REDACTED.json', account], ['NQ5_PRECALL_AUTHORIZATION_REPORT.json', final]]) writeFileSync(path.join(delivery, 'CHECKPOINT_REPORTS', name), reportBytes(report))
  const manifest = { schemaVersion: '1.0.2', status: 'BLOCKED_WITH_EVIDENCE', archiveName, ...cut, resumedFromCommit: '8b229bc3a6783006ee5a6d4a92598490e0955c8e', resumedFromTree: '333950216fb6a06c7e013756eda5a7a4721644c0', schemaCorrection: 'PASS_SOURCE_AND_PROBE_SCOPE', offlineGates: gates, verification: results, AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT: false, AUTHORIZED_TO_ISSUE: false, checkpointHold: true, qualificationCallsAllowed: false, credentialResolutionAttempted: false, providerCallsIssued: 0, accountAttempts: 0, qualificationAttempts: 0, qualificationCounted: 0, accountBalance: null, accountActualCreditDelta: null, accountRawBytesPackaged: false, completeClonableBundle: true, historicalDeliveries: Object.fromEntries(historical), preservedPriorEvidenceHashes: priorHashes, leadAcceptanceClaimed: false, fullA2uAcceptanceClaimed: false, finalArtClaimed: false, mission02Admitted: false, qualificationCompletionClaimed: false }
  writeFileSync(path.join(delivery, 'DELIVERY_MANIFEST.json'), reportBytes(manifest))
  writeFileSync(path.join(delivery, 'KT_TRANSFER.md'), `# Successor Lead continuity checkpoint\n\nStatus: BLOCKED_WITH_EVIDENCE, not full A2U acceptance. Candidate commit ${cut.commit}; tree ${cut.tree}. Continue this exact candidate, preserving accepted A1-R2 ancestor 8cb53c91e2dcaae81e9b84dfe848c19e27e96d9e and qualified A2P base c911e8f6ce433fa8de94a90a9d4a0e8c4bcd2eee. Both preceding blocked archives are embedded byte-identically in HISTORICAL_DELIVERIES, and all original reports remain in PRESERVED_PRIOR_EVIDENCE.\n\nActive authorities: parent g6p-a2u-v1.0.1; account exception g6p-a2u-bootstrap-v1.0.0; corrected report schemas and unconditional qualification hold g6p-a2u-failure-schema-v1.0.2. Historical report schema defects and ordering cycle are resolved, not erased. The new block is incomplete offline implementation; do not request another schema correction to replace that work.\n\nRead SOURCE_SNAPSHOT/docs/G6P_A2U_V1_0_2_OFFLINE_CHECKPOINT.md, the parent blueprint and each supplied schema, CHECKPOINT_REPORTS and current CHECKPOINT_EVIDENCE. Finish catalog/parity, planner/compiler/allowance, schema-bound ledger/crash-tail/dual-root, public projection and account adapter gates. New report schemas, semantic/privacy matrix, exact request policy, checkpoint hold and 12,288-record browser proxies are implemented. Proxies are not manual assistive-technology certification or final product acceptance.\n\nZero credential resolutions, account attempts, qualification requests/counts, purchases, subscription changes and Alchemy calls occurred. No account ledger or raw account bytes exist. Balance, actual account credit delta and frozen T1 remain unknown/deferred, not zero-cost or sufficient-budget observations. Offline AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT and final AUTHORIZED_TO_ISSUE are both false. Never bootstrap until EVERY mandatory offline gate passes. At most the exact one private GET account request may then occur; no body/query/retry/redirect/fallback/public row. Raw-write-first private dual roots and ADMIN/nonqualification ledger rules remain mandatory. Freeze T1 only after observed balance; protect250 credits. Qualification remains held pending successor Lead checkpoint review even after a later final PASS. Do not automatically create a task/workspace or issue a qualification request from this continuation.\n\nPreserve the accepted office nine-verb puzzle, earned terminal, common reducer/query model, Caseboard, four lenses, three-candidate foreground, Query Receipt, folders/comparison, Trace Thread/falsifier, source/archive count separation and exact Amount/Receiver/Link assembly. Both breach memories remain true. Historical link2023-03-13T11:38:11Z, cutoff2023-03-13T12:15:00Z and conclusion THE FIRST TRAIL JOINED THE SECOND ROUTE remain accepted; infer no common human identity, intent, coordination or ultimate destination. The synthetic fixture is nonhistorical and nonqualification. Browser play remains static/keyless/no-provider-call.\n\nFinal art/dialogue/animation inventory/anchors/props stay late-bound. Do not inspect, change, stage, scan, duplicate or integrate .cursor/ or ART_PRODUCTION/. Preserve the separate user AGENTS append. No Mission02, narrative lock, art binding, content lock or release admission is granted. Lead transfer is a review handoff, not approval inferred by Codex.\n`)
  writeFileSync(path.join(delivery, 'README.md'), '# v1.0.2 pre-campaign checkpoint — BLOCKED_WITH_EVIDENCE\n\nThe source schema defect is resolved. Corrected schemas, semantic/privacy regression matrix and large-corpus browser performance are evidenced. Required offline product, compiler/planner, ledger/projection and account-adapter gates remain NOT_VERIFIED. See SOURCE_SNAPSHOT/docs/G6P_A2U_V1_0_2_OFFLINE_CHECKPOINT.md. This is not a new source authority defect; finish the offline implementation under existing contracts before credential access.\n\nCHECKPOINT_REPORTS contains truthful schema-valid offline/account reports and a semantically checked false final checkpoint. Zero account attempts and qualification calls occurred; no credential was resolved and no private account bytes/ledger exist. Unknown balance/credit use remain null, not inferred zero. Qualification hold is unconditional for this continuation. No purchase, Alchemy, new task/workspace, art binding or acceptance is claimed. Historical archives and all blocker evidence are preserved exactly.\n')
  const finalScan = run('node', ['scripts/scan-prohibitions.mjs', delivery])
  writeFileSync(path.join(delivery, 'PACKAGE_VERIFICATION.json'), reportBytes({ status: 'PASS_FOR_BLOCKED_CHECKPOINT_ONLY', cleanSourceCut: cut, priorEvidencePreserved: true, freshCloneAndStrictFsck: true, fullGeneratedOutputScan: finalScan, accountRawBytesAbsent: true, offlineAndAccountSchemasValidated: true, finalCheckpointSemanticsValidated: true, qualificationHold: true, excludedArtLane: true }))
  writeFileSync(path.join(delivery, 'DELIVERY_CONTENTS.sha256'), `${files(delivery).map((file) => `${hash(file)}  ${path.relative(delivery, file).split(path.sep).join('/')}`).sort().join('\n')}\n`)
  unchanged()
  if (verifyOnly) {
    const destination = mkdtempSync(path.join(parent, 'nq5-precampaign-verification-')); cpSync(delivery, destination, { recursive: true })
    process.stdout.write(`${JSON.stringify({ status: manifest.status, ...cut, evidenceDestination: destination, offlineGates: gates }, null, 2)}\n`)
  } else {
    const fixed = new Date('2000-01-01T00:00:00Z')
    const entries = files(delivery).sort().map((file) => { utimesSync(file, fixed, fixed); return path.relative(temp, file) })
    const zip = path.join(temp, 'delivery.zip'); const rebuilt = path.join(temp, 'rebuilt.zip')
    run('zip', ['-X', '-q', zip, ...entries], temp); run('zip', ['-X', '-q', rebuilt, ...entries], temp)
    if (hash(zip) !== hash(rebuilt)) throw new Error('Identical archive rebuild failed.')
    run('unzip', ['-t', zip]); const extracted = path.join(temp, 'zip-proof'); mkdirSync(extracted)
    run('unzip', ['-q', zip, '-d', extracted]); run('sha256sum', ['-c', 'DELIVERY_CONTENTS.sha256'], path.join(extracted, path.basename(delivery)))
    unchanged(); copyFileSync(zip, output, constants.COPYFILE_EXCL)
    process.stdout.write(`${JSON.stringify({ status: manifest.status, archive: output, sha256: hash(output), ...cut, zipAndGovernedHashesVerified: true, identicalRebuildVerified: true, priorEvidencePreserved: true }, null, 2)}\n`)
  }
} finally {
  // Only this script's explicitly created temporary directory is removed.
  rmSync(temp, { recursive: true, force: true })
}
