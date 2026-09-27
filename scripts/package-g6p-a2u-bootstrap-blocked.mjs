#!/usr/bin/env node
// Preservation-only blocked handoff. Never invokes the old current-report writer,
// a credential resolver, a provider transport, or an authorization/campaign runner.
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { constants, copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertCleanA2uSourceCut } from './g6p-a2u-cut.mjs'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const archiveName = 'TRACE_ESCAPE_G6P_A2U_UNIFIED_INVESTIGATION_LOOP_AND_NANSEN_QUESTION_LENSES_DELIVERY_v1.0.1.zip'
const output = path.resolve(root, '..', archiveName)
if (process.argv.slice(2).some((argument) => argument !== '--verify-only')) throw new Error('Unsupported argument.')
const verifyOnly = process.argv.includes('--verify-only')
if (!verifyOnly && existsSync(output)) throw new Error('Preserve the existing delivery; output already exists.')
const temp = mkdtempSync(path.join(os.tmpdir(), 'trace-a2u-bootstrap-blocked-'))
const delivery = path.join(temp, archiveName.replace(/\.zip$/, ''))
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const run = (command, args, cwd = root) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env, CI: '1' }, maxBuffer: 64_000_000 })
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`)
  return result.stdout
}
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
function files(directory) {
  return readdirSync(directory).sort().flatMap((name) => {
    const file = path.join(directory, name)
    const stat = lstatSync(file)
    if (stat.isSymbolicLink()) throw new Error('Symlink in governed evidence or output.')
    return stat.isDirectory() ? files(file) : [file]
  })
}
const evidenceRoot = path.join(root, 'artifacts/g6p-a2u')
const preserved = [
  [path.resolve(root, '..', archiveName.replace('v1.0.1.zip', 'v1.0.0.zip')), 'f0840693e7a751a9b58f0dc4b9872e54c43012bea961239eb7e5417fc7865598'],
  [path.join(evidenceRoot, 'precall/NQ5_PRECALL_AUTHORIZATION_REPORT.json'), '127a54a809717dd9ffadddfce70b2126fa680c7e0078ee477cddac0d5e6067d6'],
  [path.join(evidenceRoot, 'current/precall/NQ5_PRECALL_AUTHORIZATION_REPORT.json'), 'bace5c9735cadac844177cdef73d461fea345e12c8f5eee6d1321182e3dbb26f'],
]
const assertPreserved = () => { for (const [file, expected] of preserved) if (hash(file) !== expected) throw new Error('Prior blocked delivery/report changed.') }
const snapshotEvidence = () => Object.fromEntries(files(evidenceRoot).map((file) => [path.relative(evidenceRoot, file), hash(file)]))
try {
  const cut = assertCleanA2uSourceCut(root)
  run('git', ['merge-base', '--is-ancestor', 'c47d904450fcca1fe92ed8a02c540302e64151c7', cut.commit])
  assertPreserved()
  const oldEvidence = snapshotEvidence()
  // Inspect tracked path metadata before reading/exporting blobs, not the private art lane.
  const sourcePaths = git('ls-tree', '-r', '--name-only', 'HEAD').split('\n')
  if (sourcePaths.some((name) => /^(?:ART_PRODUCTION|\.cursor)(?:\/|$)/.test(name))) throw new Error('Separate art lane is tracked; do not export.')
  mkdirSync(path.join(delivery, 'RESUME_EVIDENCE/verification'), { recursive: true })
  const verification = []
  const steps = [
    ['supplied-bootstrap-validator', 'python3', ['10_VALIDATE_EXCEPTION_OVERLAY.py', '.'], path.join(root, 'docs/overlays/g6p-a2u-bootstrap-v1.0.0')],
    ['failure-state-schema-probes', 'python3', ['scripts/validate-g6p-a2u-bootstrap-failure-paths.py']],
    ['check', 'npm', ['run', 'check']], ['unit', 'npm', ['test']],
    ['legacy-acquisition-regression', 'npm', ['run', 'test:acquisition']],
    ['browser', 'npm', ['run', 'test:e2e']], ['build', 'npm', ['run', 'build']],
    ['browser-boundary', 'npm', ['run', 'browser-boundary:verify']],
  ]
  for (const [id, command, args, cwd] of steps) {
    process.stdout.write(`VERIFY ${id}\n`)
    const log = run(command, args, cwd)
    const relative = `RESUME_EVIDENCE/verification/${id}.log`
    writeFileSync(path.join(delivery, relative), log)
    verification.push({ id, status: 'PASS', log: relative, sha256: hash(path.join(delivery, relative)) })
    if (id === 'failure-state-schema-probes') {
      const diagnostic = JSON.parse(log)
      if (diagnostic.probe_execution !== 'PASS' || diagnostic.source_admission !== 'BLOCKED_FAILURE_REPORT_CONTRACT' || diagnostic.is_authorization_report !== false || diagnostic.AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT !== false || diagnostic.AUTHORIZED_TO_ISSUE !== false) throw new Error('Unexpected source diagnostic; this packager is blocked-only.')
      writeFileSync(path.join(delivery, 'RESUME_EVIDENCE/BOOTSTRAP_SOURCE_FAILURE_DIAGNOSTIC.json'), log)
    }
    process.stdout.write(`${id}: PASS\n`)
  }
  const finalCut = assertCleanA2uSourceCut(root)
  if (JSON.stringify(finalCut) !== JSON.stringify(cut)) throw new Error('Source cut changed during verification.')
  assertPreserved()
  if (JSON.stringify(snapshotEvidence()) !== JSON.stringify(oldEvidence)) throw new Error('Prior evidence tree changed during verification.')
  if (verifyOnly) {
    const evidenceDestination = mkdtempSync(path.resolve(root, '..', 'g6p-a2u-bootstrap-verification-'))
    cpSync(path.join(delivery, 'RESUME_EVIDENCE'), evidenceDestination, { recursive: true })
    process.stdout.write(`${JSON.stringify({ status: 'BLOCKED_WITH_EVIDENCE', localRegression: 'PASS_NOT_ALL_OFFLINE_GATES', ...cut, evidenceDestination, verification, priorEvidencePreserved: true }, null, 2)}\n`)
  } else {
  mkdirSync(path.join(delivery, 'SOURCE_SNAPSHOT'))
  const tar = path.join(temp, 'source.tar')
  run('git', ['archive', '--format=tar', '-o', tar, 'HEAD'])
  run('tar', ['-xf', tar, '-C', path.join(delivery, 'SOURCE_SNAPSHOT')])
  cpSync(evidenceRoot, path.join(delivery, 'PRESERVED_PRIOR_EVIDENCE'), { recursive: true })
  for (const [name, expected] of Object.entries(oldEvidence)) if (hash(path.join(delivery, 'PRESERVED_PRIOR_EVIDENCE', name)) !== expected) throw new Error('Copied historical evidence differs.')
  cpSync(path.join(root, 'dist'), path.join(delivery, 'PRINCIPAL_PREVIEW/site'), { recursive: true })
  writeFileSync(path.join(delivery, 'PRINCIPAL_PREVIEW/README.md'), '# Provisional static fixture preview\n\nRun python3 -m http.server 8080 --directory site here. Earn the First Breach through the ordinary office puzzle and open the case terminal. Optional explicit review fixture: ?review=1&caseFixture=synthetic. No provider requests occur during play. This is not full A2U acceptance or qualification proof.\n')
  mkdirSync(path.join(delivery, 'GIT'))
  const bundle = path.join(delivery, 'GIT/trace-escape-complete.bundle')
  run('git', ['-c', 'pack.threads=1', 'bundle', 'create', bundle, 'HEAD'])
  run('git', ['bundle', 'verify', bundle])
  const clone = path.join(temp, 'clone-proof')
  run('git', ['clone', '--quiet', bundle, clone])
  if (run('git', ['rev-parse', 'HEAD'], clone).trim() !== cut.commit || run('git', ['rev-parse', 'HEAD^{tree}'], clone).trim() !== cut.tree) throw new Error('Clone source identity mismatch.')
  run('git', ['fsck', '--full'], clone)
  const historyScan = run('node', ['scripts/verify-git-secret-history.mjs'], clone)
  writeFileSync(path.join(delivery, 'RESUME_EVIDENCE/verification/candidate-history-secret-scan.log'), historyScan)
  verification.push({ id: 'candidate-history-secret-scan', status: 'PASS', log: 'RESUME_EVIDENCE/verification/candidate-history-secret-scan.log' })
  const manifest = {
    schemaVersion: '1.0.1', status: 'BLOCKED_WITH_EVIDENCE', archiveName,
    candidateCommit: cut.commit, candidateTree: cut.tree,
    resumedFromCommit: 'c47d904450fcca1fe92ed8a02c540302e64151c7',
    resumedFromTree: '94ab472e09742dbd1dd3448b7e861bb6ec26b11d',
    exceptionId: 'LEAD-NQ5-ACCOUNT-PREFLIGHT-BOOTSTRAP-001',
    orderingCycle: 'RESOLVED_BY_STAGED_EXCEPTION', sourceAdmission: 'BLOCKED_FAILURE_REPORT_CONTRACT',
    localRegression: 'PASS_NOT_ALL_OFFLINE_GATES', verification,
    AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT: false, AUTHORIZED_TO_ISSUE: false,
    credentialResolutionAttempted: false, providerCallsIssued: 0, qualificationCounted: 0,
    accountAttempt: 'NOT_ISSUED', accountBalance: null, accountRawBytesPackaged: false,
    completeClonableGitBundle: true, leadAcceptanceClaimed: false, completeA2uAcceptanceClaimed: false,
    finalArtClaimed: false, mission02Admitted: false, qualificationCompletionClaimed: false,
    blockerDocument: 'SOURCE_SNAPSHOT/docs/G6P_A2U_BOOTSTRAP_RESUME_BLOCKER.md',
    reviewEvidence: 'SOURCE_SNAPSHOT/docs/G6P_A2U_BOOTSTRAP_REVIEW.md',
    priorArchiveSha256: preserved[0][1], priorBlockerSha256: preserved[1][1], priorCurrentBlockerSha256: preserved[2][1],
    preservedPriorEvidenceHashes: oldEvidence,
  }
  if (!existsSync(path.join(delivery, manifest.reviewEvidence))) throw new Error('Missing committed review evidence.')
  writeFileSync(path.join(delivery, 'DELIVERY_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  writeFileSync(path.join(delivery, 'README.md'), '# A2U bootstrap resume — BLOCKED_WITH_EVIDENCE\n\nThe staged exception resolves the old ordering cycle. Its validator passes, but supplied report schemas cannot truthfully represent mandatory failed-gate, storage-mismatch and privacy-failure outcomes. Independent synthetic controls reproduce the defect. Corrected Lead-supplied schemas are required; all other pending offline gates remain pending.\n\nSee RESUME_EVIDENCE/BOOTSTRAP_SOURCE_FAILURE_DIAGNOSTIC.json and SOURCE_SNAPSHOT/docs/G6P_A2U_BOOTSTRAP_RESUME_BLOCKER.md. These are source diagnostics, NOT offline/account/final authorization reports. No credentials or provider calls occurred. Account balance is unknown and qualification count remains zero. PRESERVED_PRIOR_EVIDENCE contains byte-identical historical evidence, including historical descriptions of the now-resolved cycle. The old delivery itself remains untouched outside this archive; its exact hash is bound in the manifest. The separate art lane and user AGENTS append are excluded.\n')
  const scan = run('node', ['scripts/scan-prohibitions.mjs', delivery])
  writeFileSync(path.join(delivery, 'PACKAGE_VERIFICATION.json'), `${JSON.stringify({ status: 'PASS_FOR_BLOCKED_HANDOFF_ONLY', cleanSourceCut: cut, candidateBundleClonedAndFsckPassed: true, priorArchiveAndAllEvidencePreserved: true, scopedSecretScan: scan, candidateHistorySecretScan: historyScan, excludedArtLane: true, noAuthorizationInferred: true }, null, 2)}\n`)
  writeFileSync(path.join(delivery, 'DELIVERY_CONTENTS.sha256'), `${files(delivery).map((file) => `${hash(file)}  ${path.relative(delivery, file).split(path.sep).join('/')}`).sort().join('\n')}\n`)
  const fixed = new Date('2000-01-01T00:00:00Z')
  const entries = files(delivery).sort().map((file) => { utimesSync(file, fixed, fixed); return path.relative(temp, file) })
  const zip = path.join(temp, 'delivery.zip'); const duplicate = path.join(temp, 'rebuild.zip')
  run('zip', ['-X', '-q', zip, ...entries], temp)
  run('zip', ['-X', '-q', duplicate, ...entries], temp)
  if (hash(zip) !== hash(duplicate)) throw new Error('Archive rebuild mismatch.')
  run('unzip', ['-t', zip])
  const extracted = path.join(temp, 'extracted-proof')
  mkdirSync(extracted)
  run('unzip', ['-q', zip, '-d', extracted])
  run('sha256sum', ['-c', 'DELIVERY_CONTENTS.sha256'], path.join(extracted, path.basename(delivery)))
  assertPreserved()
  if (JSON.stringify(snapshotEvidence()) !== JSON.stringify(oldEvidence)) throw new Error('Historical evidence changed during packaging.')
  if (JSON.stringify(assertCleanA2uSourceCut(root)) !== JSON.stringify(cut)) throw new Error('Final source identity changed.')
  copyFileSync(zip, output, constants.COPYFILE_EXCL)
  process.stdout.write(`${JSON.stringify({ status: manifest.status, archive: output, sha256: hash(output), ...cut, zipAndGovernedHashesVerified: true, identicalRebuildVerified: true, priorEvidencePreserved: true }, null, 2)}\n`)
  }
} finally {
  // Only the explicit temporary directory created by this script is removed.
  rmSync(temp, { recursive: true, force: true })
}
