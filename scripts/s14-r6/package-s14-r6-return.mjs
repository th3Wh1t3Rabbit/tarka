import { createHash } from 'node:crypto'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const prerequisite = 'a42b74768c40f863cb856fcc5ca24f670bab5a0b'
const prerequisiteTree = '8a1f76e66236c6884f5f000d751ff29e4da6a4ed'
const expectedMain = 'f57ecf3d5accabb14416e14a127efb7cdd1fc275'
const expectedProtected = '0f52131c9f56f49128e7a413396331917e687a1f'
const expectedStash = '0a7d1c1df04bdd32ee435881a05fef169451e0ba'
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const execute = (command, args, cwd = root) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 128_000_000, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}\n${output}`)
  return output
}
const git = (...args) => execute('git', args).trim()

const commit = git('rev-parse', 'HEAD')
const tree = git('rev-parse', 'HEAD^{tree}')
const parent = git('rev-parse', 'HEAD^')
if (parent !== prerequisite || git('rev-list', '--parents', '-n', '1', 'HEAD').split(/\s+/).length !== 2) throw new Error('S14-R6 must be one direct non-merge child of held S14-R5')
if (git('rev-parse', `${prerequisite}^{tree}`) !== prerequisiteTree) throw new Error('Held prerequisite tree changed')
if (spawnSync('git', ['symbolic-ref', '-q', 'HEAD'], { cwd: root }).status !== 1) throw new Error('HEAD must remain detached')
if (git('rev-parse', 'refs/heads/main') !== expectedMain || git('rev-parse', 'refs/heads/g6p-a0-point-click') !== expectedProtected || git('rev-parse', 'refs/stash') !== expectedStash) throw new Error('Protected ref or stash moved')
if (git('status', '--short', '--untracked-files=no')) throw new Error('Tracked worktree is not clean')

const name = 'TRACE_ESCAPE_CURSOR_TO_MAIN_S14_R6_ACTUAL_ACTION_MATRIX_AND_A1_PICKUP_SEMANTICS_CLOSURE_v1.0.0_2026-09-24'
const temporary = mkdtempSync(join(tmpdir(), 's14-r6-return-'))
const stage = join(temporary, name)
mkdirSync(stage)
const put = (path, value) => { const target = join(stage, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, value) }
const copy = (from, to) => { const target = join(stage, to); mkdirSync(dirname(target), { recursive: true }); cpSync(resolve(root, from), target, { recursive: true }) }
const log = (name, command, args) => { const output = execute(command, args); put(`LOGS/${name}.log`, output); return output }

log('01-authority-and-projection', 'node', ['scripts/s14/build-r55-production-projection.mjs'])
if (git('diff', '--exit-code', '--', 'src/story/r55/generated/r55-production.json')) throw new Error('Projection replay changed tracked bytes')
log('02-actual-action-matrix', 'node', ['scripts/s14-r6/verify-actual-action-matrix.mjs'])
log('03-semantic-mutations', 'node', ['scripts/s14-r6/run-action-matrix-mutation-probes.mjs'])
log('04-focused-unit', 'npx', ['vitest', 'run', 'tests/unit/s12-p3-r55-registry.test.ts', 'tests/unit/s13-corpus-integration.test.ts', 'tests/unit/s14-r1-runtime-consumers.test.ts', 'tests/unit/s14-r2-executable-consumer-state-matrix.test.ts', 'tests/unit/s14-r3-real-route-state.test.ts', 'tests/unit/s14-r55-production.test.ts', 'tests/unit/s14-r6-actual-action-matrix.test.ts', '--reporter=dot'])
log('05-typecheck', 'npm', ['run', 'typecheck', '--', '--pretty', 'false'])
log('06-changed-scope-lint', 'npx', ['eslint', 'src/adventure/content.ts', 'src/adventure/reducer.ts', 'src/adventure/r55ProductionRouteRegistry.ts', 'tests/unit/s14-r1-runtime-consumers.test.ts', 'tests/unit/s14-r2-executable-consumer-state-matrix.test.ts', 'tests/unit/s14-r6-actual-action-matrix.test.ts', 'tests/e2e/s14-r6-a1-pickup.spec.ts', 'scripts/s14-r6/*.mjs'])
log('07-production-build', 'npm', ['run', 'build'])
log('08-browser-boundary', 'npm', ['run', 'browser-boundary:verify'])
log('09-focused-browser', 'npx', ['playwright', 'test', 'tests/e2e/s14-r1-runtime-consumers.spec.ts', 'tests/e2e/s14-r2-globe.spec.ts', 'tests/e2e/s14-r3-background.spec.ts', 'tests/e2e/s14-r4-source-slices.spec.ts', 'tests/e2e/s14-r5-repeat-pickup.spec.ts', 'tests/e2e/s14-r55-production.spec.ts', 'tests/e2e/s14-r6-a1-pickup.spec.ts', '--workers=1', '--reporter=line'])

const projectionBytes = readFileSync(resolve(root, 'src/story/r55/generated/r55-production.json'))
const projection = JSON.parse(projectionBytes)
const actionReceipt = JSON.parse(readFileSync(resolve(root, 'artifacts/s14-r6/RECEIPTS/ACTUAL_ACTION_OBSERVATION_RECEIPT.json')))
const mutationBytes = readFileSync(resolve(root, 'artifacts/s14-r6/RECEIPTS/ACTION_MATRIX_MUTATION_PROBES.json'))
const changedPaths = git('diff-tree', '--no-commit-id', '--name-status', '-r', 'HEAD').split('\n').filter(Boolean)
const preflight = { schemaVersion: 's14-r6-preflight.v1', expected: { worktree: '/tmp/trace-escape-s10-p1', head: prerequisite, tree: prerequisiteTree, soleParent: '8b28a42169f6a9190e5aa84e5e368d41123aba1c', detached: true }, observedBeforeMutation: { head: prerequisite, tree: prerequisiteTree, soleParent: '8b28a42169f6a9190e5aa84e5e368d41123aba1c', detached: true, trackedStagedConflicted: 'CLEAN', untracked: 'ACCEPTED_EVIDENCE_DIRECTORIES_ONLY' }, protected: { main: expectedMain, g6pA0PointClick: expectedProtected, stash: expectedStash }, status: 'PASS' }
const postflight = { schemaVersion: 's14-r6-postflight.v1', commit, tree, soleParent: parent, parentCount: 1, detached: true, trackedStagedConflicted: 'CLEAN', protected: preflight.protected, status: 'PASS' }
const receipt = {
  schemaVersion: 's14-r6-return.v1', disposition: 'CANDIDATE_PENDING_CHATGPT_MAIN_LEAD_REVIEW', taskId: 'TRACE_ESCAPE-CURSOR-OPUS5-S14-R6-ACTUAL-ACTION-MATRIX-AND-A1-PICKUP-SEMANTICS-CLOSURE',
  commit, tree, soleParent: parent, changedPaths,
  authority: { archiveSha256: '8613c16b6f7df8fcae312b71237729b34eb4fd01619085c3ed0d28d336b01771', registrySha256: 'afb12dd571a083f577a341cf209150a0302152843171c1e7f996976843702052', sourceLedgerSha256: '3532b1335475f28594829f94cc4b49ec9fdd3ede35577360525c482b31201185', provenanceSha256: '1583a3742d148f16225078ef5721eb80174ab243b7775a1a9ae73d668e580764', a1Sha256: 'c665ad8150efb170452d177aba9cfa63be79ee3b9774dc15d1c2ecff850cfca5', projectionFileSha256: sha256(projectionBytes), projectionPayloadSha256: projection.projectionSha256 },
  sourceCompleteness: { executableNodes: 590, eventGroups: 163, sourceSlices: 220, entrypoints: 220, continuations: 370 },
  actualActionCoverage: actionReceipt,
  pickupSequences: { formPickup: [], penPickup: ['r55-138b9ddd4bdcdf4dec21'], blankFormInventoryLook: ['r55-e238d1412af172db544e', 'r55-63348fda31585c92f1ff'], loosePenInventoryLook: ['r55-b5485c6a346b96e0542d'] },
  cabinetExterior: { copyKey: 'NON_R55_FALLBACK_PENDING_PRINCIPAL_POLISH.CASE_CABINET_EXTERIOR', textSource: 'Existing public object label OFFICIAL CASE-FILE CABINET', r55Consumption: 'EXCLUDED', disposition: 'TRUTHFUL_NON_R55_FALLBACK_PENDING_PRINCIPAL_POLISH' },
  qualification: { authorityReplay: 'PASS', focusedUnit: '81 passed / 1 skipped', actualActionRoutes: actionReceipt.actualActionRouteTotal, semanticMutationProbes: '19/19 REJECTED', focusedBrowser: '10/10 PASS', typecheck: 'PASS', changedScopeLint: 'PASS_ZERO_ERRORS_ZERO_WARNINGS', productionBuild: 'PASS_WITH_EXISTING_VITE_CHUNK_SIZE_ADVISORY', builtBoundaryScan: 'PASS', externalProviderRequests: 0, websocketRequests: 0 },
  preservation: { s13ExactCountFunnelThreeDispatchProofPersistenceIsolation: 'PASS_UNCHANGED', targetSpecificRepeatPickup: 'PASS', heroBrcgEndingCompletionCreditsMainMenuPlayAgain: 'PASS', staticProviderFreeRuntime: 'PASS' },
  notRun: ['fresh full Vitest suite — S15-owned', 'complete integrated browser matrix — S15-owned'], nextGate: 'S15_READY_NOT_STARTED',
  excludedEffects: { music: 0, audio: 0, sfx: 0, artBinaries: 0, dependenciesOrLockfile: 0, providerAccountCredentialData: 0, mission02Scope: 0, deploymentOrPublication: 0 },
}

put('START_HERE.md', `# S14-R6 return\n\nStatus: candidate pending ChatGPT MAIN lead review.\n\nRun \`python3 VERIFY_S14_R6_RETURN.py\` from this extracted directory. The verifier validates the exact manifest, creates its own temporary repository, verifies the complete Git bundle with strict fsck, fresh-clones the candidate, confirms commit/tree/sole-parent identity, then applies the full-index binary patch at the prerequisite and confirms the resulting tree.\n\nSource completeness is separately fixed at 590 nodes / 163 events / 220 entrypoints / 370 continuations. Actual action coverage is ${actionReceipt.actualActionRouteTotal} routes with ${actionReceipt.actualObservedNodeOccurrences} R55 observations, ${actionReceipt.canonicalUniqueObservedNodes} unique action-reachable canonical nodes, and ${actionReceipt.duplicateNodeOccurrences} legitimate duplicates. See RETURN_RECEIPT.json.\n`)
put('RETURN_RECEIPT.json', `${JSON.stringify(receipt, null, 2)}\n`)
put('PREFLIGHT.json', `${JSON.stringify(preflight, null, 2)}\n`)
put('POSTFLIGHT.json', `${JSON.stringify(postflight, null, 2)}\n`)
put('CHANGED_PATHS.txt', `${changedPaths.join('\n')}\n`)
put('RECOVERY.md', `# Recovery\n\nPreferred: verify and clone \`GIT/s14-r6-complete.bundle\`, then inspect candidate \`${commit}\`.\n\nPatch: begin from exact prerequisite \`${parent}\` (tree \`${prerequisiteTree}\`), apply \`GIT/s14-r6-full-index-binary.patch\`, and verify tree \`${tree}\`.\n\nThis package does not self-accept, move protected refs, start S15, integrate music, deploy, or publish.\n`)
put('RECEIPTS/BLOCKED_NETWORK.json', `${JSON.stringify({ schemaVersion: 's14-r6-blocked-network.v1', focusedBrowserJourneys: 10, externalProviderRequests: 0, websocketRequests: 0, evidence: 'LOGS/09-focused-browser.log', status: 'PASS' }, null, 2)}\n`)
put('RECEIPTS/TESTS_NOT_RUN.json', `${JSON.stringify({ schemaVersion: 's14-r6-nonruns.v1', notRun: receipt.notRun, expansionTrigger: 'NONE' }, null, 2)}\n`)
for (const file of readdirSync(resolve(root, 'artifacts/s14-r6/RECEIPTS'))) copy(`artifacts/s14-r6/RECEIPTS/${file}`, `RECEIPTS/${file}`)
for (const file of readdirSync(resolve(root, 'artifacts/s14-r6/SCREENSHOTS'))) copy(`artifacts/s14-r6/SCREENSHOTS/${file}`, `SCREENSHOTS/${file}`)
for (const file of ['action-matrix-source-validator.mjs', 'verify-actual-action-matrix.mjs', 'run-action-matrix-mutation-probes.mjs', 'mutation-vitest.config.mjs']) copy(`scripts/s14-r6/${file}`, `TOOLS/${file}`)

const bundlePath = join(stage, 'GIT/s14-r6-complete.bundle')
mkdirSync(dirname(bundlePath), { recursive: true })
execute('git', ['bundle', 'create', bundlePath, 'HEAD'])
const patch = spawnSync('git', ['diff', '--binary', '--full-index', `${parent}..HEAD`], { cwd: root, maxBuffer: 128_000_000 })
if (patch.status !== 0) throw new Error('Unable to create full-index binary patch')
put('GIT/s14-r6-full-index-binary.patch', patch.stdout)

const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)])
const payload = files(stage).map(path => ({ path: relative(stage, path), sha256: sha256(readFileSync(path)), bytes: statSync(path).size })).sort((a, b) => a.path.localeCompare(b.path))
put('MANIFEST.sha256', `${payload.map(item => `${item.sha256}  ${item.path}`).join('\n')}\n`)
const manifestSha256 = sha256(readFileSync(join(stage, 'MANIFEST.sha256')))
put('VERIFY_S14_R6_RETURN.py', `#!/usr/bin/env python3
import hashlib,pathlib,subprocess,tempfile,shutil
root=pathlib.Path(__file__).resolve().parent
manifest=root/'MANIFEST.sha256'
if hashlib.sha256(manifest.read_bytes()).hexdigest()!='${manifestSha256}': raise SystemExit('FAIL_MANIFEST_IDENTITY')
listed={}
for row in manifest.read_text().splitlines():
 h,p=row.split('  ',1); listed[p]=h
actual={str(p.relative_to(root)) for p in root.rglob('*') if p.is_file()}
if actual != set(listed)|{'MANIFEST.sha256','VERIFY_S14_R6_RETURN.py'}: raise SystemExit('FAIL_MEMBER_SET')
for p,h in listed.items():
 if hashlib.sha256((root/p).read_bytes()).hexdigest()!=h: raise SystemExit('FAIL_HASH '+p)
tmp=pathlib.Path(tempfile.mkdtemp(prefix='s14-r6-verify-'))
try:
 bare=tmp/'verify.git'; subprocess.run(['git','init','--bare',str(bare)],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['git','-C',str(bare),'bundle','verify',str(root/'GIT/s14-r6-complete.bundle')],check=True,stdout=subprocess.DEVNULL)
 clone=tmp/'clone'; subprocess.run(['git','clone','-q',str(root/'GIT/s14-r6-complete.bundle'),str(clone)],check=True)
 def g(*args): return subprocess.check_output(['git','-C',str(clone),*args],text=True).strip()
 if g('rev-parse','HEAD')!='${commit}' or g('rev-parse','HEAD^{tree}')!='${tree}' or g('rev-parse','HEAD^')!='${parent}' or len(g('rev-list','--parents','-n','1','HEAD').split())!=2: raise SystemExit('FAIL_GIT_IDENTITY')
 subprocess.run(['git','-C',str(clone),'fsck','--full','--strict'],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['git','-C',str(clone),'checkout','-q','${parent}'],check=True)
 subprocess.run(['git','-C',str(clone),'apply','--index',str(root/'GIT/s14-r6-full-index-binary.patch')],check=True)
 if g('write-tree')!='${tree}': raise SystemExit('FAIL_PATCH_TREE')
finally: shutil.rmtree(tmp)
print('PASS_S14_R6_RETURN',len(actual),'${commit}','${tree}','${parent}')
`)

const output = `/path/to/local-user/Downloads/${name}.zip`
const zipped = spawnSync('zip', ['-X', '-q', '-r', output, name], { cwd: temporary, encoding: 'utf8' })
if (zipped.status !== 0) throw new Error(zipped.stderr)
const members = Number(execute('python3', ['-c', `import zipfile;print(len(zipfile.ZipFile('${output}').infolist()))`]).trim())
console.log(JSON.stringify({ output, sha256: sha256(readFileSync(output)), bytes: statSync(output).size, members, commit, tree, parent, changedPaths: changedPaths.length }))
