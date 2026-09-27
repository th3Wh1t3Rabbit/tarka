import { createHash } from 'node:crypto'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const parent = '65ca4bc8eb743883a70ed0a88fc41bd44313ec1e'
const parentTree = 'a24dba89ef1539d9757b02ce3c7ef99c552a18d8'
const expectedMain = 'f57ecf3d5accabb14416e14a127efb7cdd1fc275'
const expectedProtected = '0f52131c9f56f49128e7a413396331917e687a1f'
const expectedStash = '0a7d1c1df04bdd32ee435881a05fef169451e0ba'
const name = 'TRACE_ESCAPE_CURSOR_TO_MAIN_S15_MUSIC_FULL_INTEGRATED_QUALIFICATION_AND_PRINCIPAL_PLAYTEST_1_v1.0.0_2026-09-24'
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const execute = (command, args, cwd = root) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 256_000_000, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}\n${result.stdout ?? ''}${result.stderr ?? ''}`)
  return `${result.stdout ?? ''}${result.stderr ?? ''}`
}
const git = (...args) => execute('git', args).trim()

const commit = git('rev-parse', 'HEAD')
const tree = git('rev-parse', 'HEAD^{tree}')
const soleParent = git('rev-parse', 'HEAD^')
if (soleParent !== parent || git('rev-list', '--parents', '-n', '1', 'HEAD').split(/\s+/).length !== 2) throw new Error('S15 must be exactly one direct non-merge child of accepted S14-R6')
if (git('rev-parse', `${parent}^{tree}`) !== parentTree) throw new Error('Accepted S14-R6 parent tree changed')
if (spawnSync('git', ['symbolic-ref', '-q', 'HEAD'], { cwd: root }).status !== 1) throw new Error('HEAD must remain detached')
if (git('rev-parse', 'refs/heads/main') !== expectedMain || git('rev-parse', 'refs/heads/g6p-a0-point-click') !== expectedProtected || git('rev-parse', 'refs/stash') !== expectedStash) throw new Error('Protected ref or stash moved')
if (git('status', '--short', '--untracked-files=no')) throw new Error('Tracked worktree is not clean')

const temporary = mkdtempSync(join(tmpdir(), 's15-return-'))
const stage = join(temporary, name)
mkdirSync(stage)
const put = (path, value) => { const target = join(stage, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, value) }
const copy = (from, to) => { const target = join(stage, to); mkdirSync(dirname(target), { recursive: true }); cpSync(resolve(root, from), target, { recursive: true }) }

const changedPaths = git('diff-tree', '--no-commit-id', '--name-status', '-r', 'HEAD').split('\n').filter(Boolean)
const projectionBytes = readFileSync(resolve(root, 'src/story/r55/generated/r55-production.json'))
const projection = JSON.parse(projectionBytes)
const actionReceipt = JSON.parse(readFileSync(resolve(root, 'artifacts/s15/RECEIPTS/ACTUAL_ACTION_OBSERVATION_RECEIPT.json')))
const musicReceipt = JSON.parse(readFileSync(resolve(root, 'docs/review/s15/MUSIC_PROVENANCE.json')))
const preflight = {
  schemaVersion: 's15-preflight.v1',
  expected: { worktree: '/tmp/trace-escape-s10-p1', head: parent, tree: parentTree, soleParent: 'a42b74768c40f863cb856fcc5ca24f670bab5a0b', detached: true },
  observedBeforeMutation: { head: parent, tree: parentTree, soleParent: 'a42b74768c40f863cb856fcc5ca24f670bab5a0b', detached: true, trackedStagedConflicted: 'CLEAN', priorEvidenceDirectories: 'UNTRACKED_PRESERVED' },
  protected: { main: expectedMain, g6pA0PointClick: expectedProtected, stash: expectedStash },
  musicInput: musicReceipt.original,
  status: 'PASS',
}
const postflight = { schemaVersion: 's15-postflight.v1', commit, tree, soleParent, parentCount: 1, detached: true, trackedStagedConflicted: 'CLEAN', protected: preflight.protected, status: 'PASS' }
const qualification = {
  schemaVersion: 's15-full-qualification.v1',
  focusedS15Unit: 'PASS', focusedS15Browser: 'PASS', componentSelectorMutationProbes: '19/19_REJECTED',
  typecheck: 'PASS', fullLint: 'PASS_ZERO_ERRORS', productionBuild: 'PASS_WITH_EXISTING_CHUNK_SIZE_ADVISORY', browserBoundary: 'PASS', secretScan: 'PASS', gitHistorySecretScan: 'PASS',
  canonicalFullVitest: 'NOT_PASS_INHERITED_ENVIRONMENT_AND_HISTORICAL_SUITE_FAILURES_THEN_TIMEOUT',
  canonicalIntegratedBrowser: 'NOT_PASS_INHERITED_CONFIGURATION_FAILURES_THEN_TIMEOUT',
  externalProviderRequestsAuthorized: 0, credentialAccessAuthorized: 0, musicAssetCount: 1,
}
const receipt = {
  schemaVersion: 's15-return.v1', disposition: 'CANDIDATE_PENDING_CHATGPT_MAIN_LEAD_AND_PRINCIPAL_PLAYTEST_1_REVIEW',
  taskId: 'TRACE_ESCAPE-CURSOR-OPUS5-S15-MUSIC-FULL-INTEGRATED-QUALIFICATION-AND-PRINCIPAL-PLAYTEST-1', commit, tree, soleParent, changedPaths,
  authority: { archiveSha256: '8613c16b6f7df8fcae312b71237729b34eb4fd01619085c3ed0d28d336b01771', registrySha256: 'afb12dd571a083f577a341cf209150a0302152843171c1e7f996976843702052', sourceLedgerSha256: '3532b1335475f28594829f94cc4b49ec9fdd3ede35577360525c482b31201185', provenanceSha256: '1583a3742d148f16225078ef5721eb80174ab243b7775a1a9ae73d668e580764', a1Sha256: 'c665ad8150efb170452d177aba9cfa63be79ee3b9774dc15d1c2ecff850cfca5', projectionFileSha256: sha256(projectionBytes), projectionPayloadSha256: projection.projectionSha256 },
  sourceCompleteness: { executableNodes: 590, eventGroups: 163, sourceSlices: 220, entrypoints: 220, continuations: 370 },
  actualActionCoverage: { routes: actionReceipt.actualActionRouteTotal, occurrences: actionReceipt.actualObservedNodeOccurrences, uniqueActionNodes: actionReceipt.canonicalUniqueObservedNodes, sourceOnlyNodes: actionReceipt.nonActionSourceOnlyNodeIds.length, accountedNodes: actionReceipt.accountedNodes },
  music: musicReceipt, qualification,
  knownReviewSeams: ['NON_R55_FALLBACK_PENDING_PRINCIPAL_POLISH.CASE_CABINET_EXTERIOR', 'PRINCIPAL_SUPPLIED_LICENSE_METADATA_PENDING'],
  publicDeploymentBlocked: true,
  selfAccepted: false,
}

put('START_HERE.md', `# Tarka S15 return\n\nStatus: candidate pending ChatGPT MAIN lead and Principal Playtest 1 review.\n\nRun \`python3 VERIFY_S15_RETURN.py\` from this extracted directory. The verifier authenticates every manifested byte, verifies the complete bundle in its own temporary bare repository, strict-fscks and fresh-clones the candidate, confirms commit/tree/sole-parent identity, then applies the full-index binary patch at the accepted parent and confirms the reconstructed tree.\n\nThe sole music input is the Principal-supplied Ogg/Opus file with SHA-256 \`${musicReceipt.original.sha256}\`. License metadata was not supplied; local Principal review may proceed, but publication remains blocked.\n`)
put('RETURN_RECEIPT.json', `${JSON.stringify(receipt, null, 2)}\n`)
put('PREFLIGHT.json', `${JSON.stringify(preflight, null, 2)}\n`)
put('POSTFLIGHT.json', `${JSON.stringify(postflight, null, 2)}\n`)
put('CHANGED_PATHS.txt', `${changedPaths.join('\n')}\n`)
put('RECOVERY.md', `# Recovery\n\nPreferred: verify and clone \`GIT/s15-complete.bundle\`, then inspect candidate \`${commit}\`.\n\nPatch: begin from exact accepted parent \`${parent}\` (tree \`${parentTree}\`), apply \`GIT/s15-full-index-binary.patch\`, and verify resulting tree \`${tree}\`.\n\nThis package does not self-accept, move protected refs, deploy, publish, tag, release, or start Principal Playtest 2.\n`)
copy('PRINCIPAL_PLAYTEST_1_GUIDE.md', 'PRINCIPAL_PLAYTEST_1_GUIDE.md')
copy('PRINCIPAL_PLAYTEST_1_NOTES.md', 'PRINCIPAL_PLAYTEST_1_NOTES.md')
for (const directory of ['RECEIPTS', 'SCREENSHOTS', 'LOGS', 'MUSIC_ORIGINAL']) {
  const source = resolve(root, 'artifacts/s15', directory)
  for (const file of readdirSync(source)) copy(relative(root, join(source, file)), `${directory}/${file}`)
}
for (const file of ['action-matrix-source-validator.mjs', 'verify-actual-action-matrix.mjs', 'run-action-matrix-mutation-probes.mjs', 'mutation-vitest.config.mjs']) copy(`scripts/s14-r6/${file}`, `TOOLS/${file}`)

const bundlePath = join(stage, 'GIT/s15-complete.bundle')
mkdirSync(dirname(bundlePath), { recursive: true })
execute('git', ['bundle', 'create', bundlePath, 'HEAD'])
const patch = spawnSync('git', ['diff', '--binary', '--full-index', `${parent}..HEAD`], { cwd: root, maxBuffer: 256_000_000 })
if (patch.status !== 0) throw new Error('Unable to create full-index binary patch')
put('GIT/s15-full-index-binary.patch', patch.stdout)

const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)])
const payload = files(stage).map(path => ({ path: relative(stage, path), sha256: sha256(readFileSync(path)), bytes: statSync(path).size })).sort((a, b) => a.path.localeCompare(b.path))
put('MANIFEST.sha256', `${payload.map(item => `${item.sha256}  ${item.path}`).join('\n')}\n`)
const manifestSha256 = sha256(readFileSync(join(stage, 'MANIFEST.sha256')))
put('VERIFY_S15_RETURN.py', `#!/usr/bin/env python3
import hashlib,pathlib,subprocess,tempfile,shutil
root=pathlib.Path(__file__).resolve().parent
manifest=root/'MANIFEST.sha256'
if hashlib.sha256(manifest.read_bytes()).hexdigest()!='${manifestSha256}': raise SystemExit('FAIL_MANIFEST_IDENTITY')
listed={}
for row in manifest.read_text().splitlines():
 h,p=row.split('  ',1); listed[p]=h
actual={str(p.relative_to(root)) for p in root.rglob('*') if p.is_file()}
if actual != set(listed)|{'MANIFEST.sha256','VERIFY_S15_RETURN.py'}: raise SystemExit('FAIL_MEMBER_SET')
for p,h in listed.items():
 if hashlib.sha256((root/p).read_bytes()).hexdigest()!=h: raise SystemExit('FAIL_HASH '+p)
tmp=pathlib.Path(tempfile.mkdtemp(prefix='s15-verify-'))
try:
 bare=tmp/'verify.git'; subprocess.run(['git','init','--bare',str(bare)],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['git','-C',str(bare),'bundle','verify',str(root/'GIT/s15-complete.bundle')],check=True,stdout=subprocess.DEVNULL)
 clone=tmp/'clone'; subprocess.run(['git','clone','-q',str(root/'GIT/s15-complete.bundle'),str(clone)],check=True)
 def g(*args): return subprocess.check_output(['git','-C',str(clone),*args],text=True).strip()
 if g('rev-parse','HEAD')!='${commit}' or g('rev-parse','HEAD^{tree}')!='${tree}' or g('rev-parse','HEAD^')!='${parent}' or len(g('rev-list','--parents','-n','1','HEAD').split())!=2: raise SystemExit('FAIL_GIT_IDENTITY')
 subprocess.run(['git','-C',str(clone),'fsck','--full','--strict'],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['git','-C',str(clone),'checkout','-q','${parent}'],check=True)
 subprocess.run(['git','-C',str(clone),'apply','--index',str(root/'GIT/s15-full-index-binary.patch')],check=True)
 if g('write-tree')!='${tree}': raise SystemExit('FAIL_PATCH_TREE')
finally: shutil.rmtree(tmp)
print('PASS_S15_RETURN',len(actual),'${commit}','${tree}','${parent}')
`)

const output = `/path/to/local-user/Downloads/${name}.zip`
rmSync(output, { force: true })
const zipped = spawnSync('zip', ['-X', '-q', '-r', output, name], { cwd: temporary, encoding: 'utf8' })
if (zipped.status !== 0) throw new Error(zipped.stderr)
const members = Number(execute('python3', ['-c', `import zipfile;print(len(zipfile.ZipFile('${output}').infolist()))`]).trim())
console.log(JSON.stringify({ output, sha256: sha256(readFileSync(output)), bytes: statSync(output).size, members, commit, tree, parent, changedPaths: changedPaths.length }))
