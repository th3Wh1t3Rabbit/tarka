#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertCleanA2uSourceCut } from './g6p-a2u-cut.mjs'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const archiveName = 'TRACE_ESCAPE_G6P_A2U_UNIFIED_INVESTIGATION_LOOP_AND_NANSEN_QUESTION_LENSES_DELIVERY_v1.0.0.zip'
const output = path.resolve(root, '..', archiveName)
if (existsSync(output)) throw new Error('Delivery path already exists; preserve it and choose a new authorized output rather than overwriting.')
const temporary = mkdtempSync(path.join(os.tmpdir(), 'trace-a2u-blocked-package-'))
const delivery = path.join(temporary, archiveName.replace(/\.zip$/, ''))
const run = (command, args, cwd = root) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 30_000_000 })
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`)
  return result.stdout.trim()
}
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const files = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)])
try {
  const initialCut = assertCleanA2uSourceCut(root)
  run('npm', ['run', 'g6p:a2u:verify'])
  const verifiedCut = assertCleanA2uSourceCut(root)
  if (verifiedCut.commit !== initialCut.commit || verifiedCut.tree !== initialCut.tree) throw new Error('Source identity changed during package verification.')
  const verification = JSON.parse(readFileSync(path.join(root, 'artifacts/g6p-a2u/current/verification/LOCAL_VERIFICATION.json'), 'utf8'))
  const precall = JSON.parse(readFileSync(path.join(root, 'artifacts/g6p-a2u/current/precall/NQ5_PRECALL_AUTHORIZATION_REPORT.json'), 'utf8'))
  const head = git('rev-parse', 'HEAD'); const tree = git('rev-parse', 'HEAD^{tree}')
  if (verification.localVerification !== 'PASS' || verification.candidateCommit !== head || verification.candidateTree !== tree) throw new Error('Current exact HEAD/tree lacks passing local verification.')
  if (precall.AUTHORIZED_TO_ISSUE !== false || precall.providerCallsIssued !== 0 || precall.credentialResolutionAttempted !== false) throw new Error('This blocked package supports only zero-call, zero-credential continuation.')
  const historical = 'artifacts/g6p-a2u/precall/NQ5_PRECALL_AUTHORIZATION_REPORT.json'
  if (hash(path.join(root, historical)) !== precall.historicalBlockerSha256) throw new Error('Historical blocker hash mismatch.')
  mkdirSync(path.join(delivery, 'SOURCE_SNAPSHOT'), { recursive: true })
  const sourceTar = path.join(temporary, 'source.tar')
  run('git', ['archive', '--format=tar', '-o', sourceTar, 'HEAD'])
  run('tar', ['-xf', sourceTar, '-C', path.join(delivery, 'SOURCE_SNAPSHOT')])
  if (existsSync(path.join(delivery, 'SOURCE_SNAPSHOT/ART_PRODUCTION')) || existsSync(path.join(delivery, 'SOURCE_SNAPSHOT/.cursor'))) throw new Error('Separate art lane entered the source snapshot.')
  cpSync(path.join(root, 'artifacts/g6p-a2u'), path.join(delivery, 'EVIDENCE'), { recursive: true })
  cpSync(path.join(root, 'dist'), path.join(delivery, 'PRINCIPAL_PREVIEW/site'), { recursive: true })
  writeFileSync(path.join(delivery, 'PRINCIPAL_PREVIEW/README.md'), '# Provisional blocked fixture preview\n\nRun python3 -m http.server 8080 --directory site from this directory. Open http://127.0.0.1:8080/ and earn the First Breach record through the ordinary puzzle, then OPEN CASE TERMINAL. Review shortcut: ?review=1, select COMPLETE, and open the terminal. Nonhistorical test fixture: ?review=1&caseFixture=synthetic. No live provider call occurs during play.\n')
  mkdirSync(path.join(delivery, 'PRIVATE_ANNEX'), { recursive: true })
  cpSync(path.join(root, 'artifacts/g6p-a2u/current/precall/NQ5_PRECALL_AUTHORIZATION_REPORT.json'), path.join(delivery, 'PRIVATE_ANNEX/NQ5_PRECALL_AUTHORIZATION_REPORT.json'))
  writeFileSync(path.join(delivery, 'PRIVATE_ANNEX/README.md'), '# No authenticated NQ5 annex exists\n\nNo credential was resolved, account preflight obtained, or NQ5 provider campaign issued. Account tier/balance remain unknown. No private response, credential, qualification ledger, or invented proof root is supplied. Historical accepted evidence in the source is not counted as a new qualification campaign.\n')
  mkdirSync(path.join(delivery, 'GIT'), { recursive: true })
  const bundle = path.join(delivery, 'GIT/trace-escape-complete.bundle')
  // Complete candidate ancestry, without exporting unrelated user branches.
  run('git', ['-c', 'pack.threads=1', 'bundle', 'create', bundle, 'HEAD'])
  run('git', ['bundle', 'verify', bundle])
  const clone = path.join(temporary, 'clone-proof')
  run('git', ['clone', '--quiet', bundle, clone])
  if (run('git', ['rev-parse', 'HEAD'], clone) !== head) throw new Error('Bundle clone identity mismatch')
  const manifest = { schemaVersion: '1.0.0', status: 'BLOCKED_WITH_EVIDENCE', archiveName, candidateCommit: head, candidateTree: tree, qualifiedA2pBase: 'c911e8f6ce433fa8de94a90a9d4a0e8c4bcd2eee', sourceVersion: '1.0.1', sourceAdmission: 'PASS', completeClonableGitBundle: true, sourceSnapshotIncluded: true, localVerification: 'PASS', AUTHORIZED_TO_ISSUE: false, credentialResolutionAttempted: false, providerCallsIssued: 0, qualificationCounted: 0, leadAcceptanceClaimed: false, fullA2uAcceptanceClaimed: false, finalArtClaimed: false, mission02Admitted: false, blockerAndPendingRequirements: 'SOURCE_SNAPSHOT/docs/G6P_A2U_IMPLEMENTATION_AND_BLOCKERS.md', historicalBlockerSha256: precall.historicalBlockerSha256 }
  writeFileSync(path.join(delivery, 'DELIVERY_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  writeFileSync(path.join(delivery, 'README.md'), '# A2U — BLOCKED_WITH_EVIDENCE\n\nCorrected source admission passes. A provisional fixture investigation loop and intention capability seam are included, with local test evidence and a runnable preview. This is NOT a completed A2U qualification delivery or Lead acceptance.\n\nThe allowance requires authenticated account/credit preflight before all pre-call gates pass, while the resume forbids credentials and every provider call until that pass. A narrowly scoped bootstrap rule or current user-supplied redacted account/credit evidence is required. Other pending schema/archive/performance/acquisition gates remain explicitly unverified.\n\nNo A2U credential resolution or provider call occurred. The historical blocker is preserved. See DELIVERY_MANIFEST.json, PRIVATE_ANNEX/NQ5_PRECALL_AUTHORIZATION_REPORT.json, EVIDENCE/current/verification, and SOURCE_SNAPSHOT/docs/G6P_A2U_IMPLEMENTATION_AND_BLOCKERS.md. The separate art-production lane and its uncommitted AGENTS.md append are excluded.\n')
  // Scope is this generated, validated delivery tree only; never walk the user's art lane.
  const scan = run('node', ['scripts/scan-prohibitions.mjs', delivery])
  const packageProof = { status: 'PASS_FOR_BLOCKED_PACKAGE', gitBundleCloned: true, clonedHead: head, localVerifiedHeadAndTreeMatch: true, scopedSecretScan: scan, historicalBlockerPreserved: true, sourceArtLaneExcluded: true, userArtAppendNotStaged: true, noCredentialOrProviderCalls: true }
  writeFileSync(path.join(delivery, 'PACKAGE_VERIFICATION.json'), `${JSON.stringify(packageProof, null, 2)}\n`)
  writeFileSync(path.join(delivery, 'DELIVERY_CONTENTS.sha256'), `${files(delivery).map((file) => `${hash(file)}  ${path.relative(delivery, file).split(path.sep).join('/')}`).sort().join('\n')}\n`)
  const fixed = new Date('2000-01-01T00:00:00Z')
  const entries = files(delivery).sort().map((file) => { utimesSync(file, fixed, fixed); return path.relative(temporary, file) })
  const second = path.join(temporary, 'determinism.zip')
  run('zip', ['-X', '-q', output, ...entries], temporary)
  run('zip', ['-X', '-q', second, ...entries], temporary)
  if (hash(output) !== hash(second)) throw new Error('Deterministic archive mismatch')
  run('unzip', ['-t', output])
  const extracted = path.join(temporary, 'archive-verification')
  mkdirSync(extracted)
  run('unzip', ['-q', output, '-d', extracted])
  run('sha256sum', ['-c', 'DELIVERY_CONTENTS.sha256'], path.join(extracted, path.basename(delivery)))
  process.stdout.write(`${JSON.stringify({ status: manifest.status, archiveName, sha256: hash(output), candidateCommit: head, candidateTree: tree, zipAndContentHashesVerified: true, deterministicRebuildVerified: true }, null, 2)}\n`)
} finally {
  // Only this script's explicitly created temporary directory is removed.
  rmSync(temporary, { recursive: true, force: true })
}
