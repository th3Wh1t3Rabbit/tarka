import { createHash } from 'node:crypto'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const prerequisite = '03064cf2581898f601d1d40745cce48c17bf5188'
const prerequisiteTree = '9c816c4e0c2efaa5eccf5ad0990a53e423ab385a'
const expectedMain = 'f57ecf3d5accabb14416e14a127efb7cdd1fc275'
const expectedProtected = '0f52131c9f56f49128e7a413396331917e687a1f'
const expectedStash = '0a7d1c1df04bdd32ee435881a05fef169451e0ba'
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', ...options })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`)
  return result.stdout.trim()
}

const commit = run('git', ['rev-parse', 'HEAD'])
const tree = run('git', ['rev-parse', 'HEAD^{tree}'])
const parent = run('git', ['rev-parse', 'HEAD^'])
const parents = run('git', ['rev-list', '--parents', '-n', '1', 'HEAD']).split(/\s+/)
if (parent !== prerequisite || parents.length !== 2) throw new Error('S14-R2 must be exactly one direct non-merge child of accepted S14-R1')
if (run('git', ['rev-parse', `${prerequisite}^{tree}`]) !== prerequisiteTree) throw new Error('S14-R1 prerequisite tree changed')
const symbolicHead = spawnSync('git', ['symbolic-ref', '-q', 'HEAD'], { cwd: root, encoding: 'utf8' })
if (symbolicHead.status !== 1) throw new Error('S14-R2 HEAD must remain detached')
if (run('git', ['rev-parse', 'refs/heads/main']) !== expectedMain) throw new Error('Main ref moved')
if (run('git', ['rev-parse', 'refs/heads/g6p-a0-point-click']) !== expectedProtected) throw new Error('Protected ref moved')
if (run('git', ['rev-parse', 'refs/stash']) !== expectedStash) throw new Error('Accepted stash changed')

const name = 'TRACE_ESCAPE_CURSOR_TO_MAIN_S14_R2_EXECUTABLE_CONSUMER_REGISTRY_AND_STATE_CLOSURE_v1.0.0_2026-09-24'
const temporary = mkdtempSync(join(tmpdir(), 's14-r2-return-'))
const stage = join(temporary, name)
mkdirSync(stage)
const put = (path, value) => {
  const target = join(stage, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, value)
}
const copy = (from, to) => {
  const target = join(stage, to)
  mkdirSync(dirname(target), { recursive: true })
  cpSync(resolve(root, from), target, { recursive: true })
}

const projectionBytes = readFileSync(resolve(root, 'src/story/r55/generated/r55-production.json'))
const projection = JSON.parse(projectionBytes)
if (projection.events.length !== 163 || projection.events.flatMap(event => event.lines).length !== 590) throw new Error('R55 projection totals changed')
if (projection.consumerMap.filter(row => !row.sharedAlias).length !== 153 || projection.consumerMap.filter(row => row.sharedAlias).length !== 10) throw new Error('Executable consumer accounting changed')
const changedPaths = run('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']).split('\n').filter(Boolean)
const preflight = {
  schemaVersion: 's14-r2-preflight.v1', expected: { worktree: '/tmp/trace-escape-s10-p1', head: prerequisite, tree: prerequisiteTree, soleParent: '603892b78357a7c1751caba73f60bce3ca4647ac', detached: true },
  observedBeforeMutation: { worktree: '/tmp/trace-escape-s10-p1', head: prerequisite, tree: prerequisiteTree, soleParent: '603892b78357a7c1751caba73f60bce3ca4647ac', detached: true, trackedStagedConflicted: 'CLEAN', untracked: 'PREVIOUSLY_ACCEPTED_EVIDENCE_ONLY' },
  protected: { main: expectedMain, g6pA0PointClick: expectedProtected, stash: expectedStash }, status: 'PASS',
}
const receipt = {
  schemaVersion: 's14-r2-return.v1', disposition: 'CANDIDATE_PENDING_CHATGPT_MAIN_LEAD_REVIEW', taskId: 'TRACE_ESCAPE-CURSOR-OPUS5-S14-R2-EXECUTABLE-CONSUMER-REGISTRY-AND-STATE-CLOSURE',
  commit, tree, parent, changedPaths, preflight: 'PASS',
  preservation: { validS14R1Work: 'PRESERVED', s13FunnelTruthDispatchProof: 'UNCHANGED', endingCompletionNavigationReset: 'PRESERVED', authority: projection.authority, protectedRefs: 'UNMOVED', acceptedStash: 'UNTOUCHED' },
  executableContract: { schemaVersion: projection.schemaVersion, projectionFileSha256: sha256(projectionBytes), projectionPayloadSha256: projection.projectionSha256, consumerMapSha256: projection.consumerMapSha256, sourceNodes: 590, eventGroups: 163, canonicalExecutableConsumers: 153, authenticatedSharedAliases: 10, uniqueActiveGroupsWithoutExecutableConsumer: 0, undeclaredFreeFormLookups: 0 },
  stateFamiliesClosed: ['A1 object/verb/item', 'A2.1/A2.2 and Euler recitation', 'toolbox/hammer/nails/piggy/note', 'inventory progress and invalid pairs', 'Arthur item and investigation milestones', 'background object-specific physical responses', 'repeat and re-entry progress', 'BRCG unread/untested/resolved'],
  globe: { finiteStates: ['speed 1', 'speed 2', 'maximum speed', 'maximum repeat', 'reversal'], nonexistentSpeed3Lookup: false, exactNodeCoverage: 'PASS', mouseKeyboardRealTouchBrowser: 'PASS' },
  qualification: { deterministicProjection: 'PASS', executableVerifier: 'PASS', focusedUnit: '74 passed, 1 pre-existing skip', focusedBrowser: '5 passed across authorization/inventory/BRCG, globe, opening/default ending, and real-touch BRCG/reset journeys', semanticNegativeProbes: '32/32 intended-reason rejections', typecheck: 'PASS', changedScopeLint: 'PASS_ZERO_ERRORS_ZERO_WARNINGS', productionBuild: 'PASS', builtScan: 'PASS', blockedNetworkExternalRequests: 0 },
  notRun: ['full fresh Vitest suite — S15-owned; no unbounded shared-owner failure class exposed', 'full integrated browser matrix — S15-owned; bounded focused mouse/keyboard/real-touch journeys were decision-complete'],
  nextGate: 'S15_READY_NOT_STARTED',
  excludedEffects: { music: 0, audio: 0, sfx: 0, artBinaries: 0, dependenciesOrLockfile: 0, providerAccountCredentialCodeOrData: 0, mission02Scope: 0, deploymentOrPublication: 0 },
}

put('RETURN_RECEIPT.json', `${JSON.stringify(receipt, null, 2)}\n`)
put('PREFLIGHT.json', `${JSON.stringify(preflight, null, 2)}\n`)
put('CHANGED_PATHS.txt', `${changedPaths.join('\n')}\n`)
put('RECOVERY.md', `# S14-R2 candidate recovery\n\nPrerequisite commit: \`${parent}\` (tree \`${prerequisiteTree}\`).\n\nPreferred recovery: verify and fetch \`GIT/s14-r2-candidate.bundle\`, confirm its sole candidate is \`${commit}\`, and inspect before moving any ref.\n\nPatch recovery: begin from an exact clean checkout at the prerequisite commit, apply \`GIT/s14-r2-candidate.patch\` with binary support, and verify the resulting tree is \`${tree}\`.\n\nThis package is evidence for MAIN review only. It does not move a protected ref, self-accept, start S15, integrate music/audio/SFX, deploy, or publish.\n`)
put('RECEIPTS/BLOCKED_NETWORK.json', `${JSON.stringify({ schemaVersion: 's14-r2-blocked-network.v1', focusedJourneys: 5, externalProviderRequests: 0, websocketRequests: 0, logs: ['LOGS/06a-globe-browser.log', 'LOGS/06b-runtime-consumers-browser.log', 'LOGS/06c-hero-ending-browser.log', 'LOGS/06d-brcg-touch-reset-browser.log'], status: 'PASS' }, null, 2)}\n`)
put('RECEIPTS/TESTS_NOT_RUN.json', `${JSON.stringify({ schemaVersion: 's14-r2-nonruns.v1', notRun: receipt.notRun, expansionTrigger: 'NONE' }, null, 2)}\n`)
put('RECEIPTS/INDEPENDENT_CALLSITE_MUTATION.json', `${JSON.stringify({ schemaVersion: 's14-r2-callsite-mutation.v1', mutations: [{ id: 'P01_REMOVE_REAL_EULER_CALL', projectionNodesRetained: 590, rejectedFor: 'MISSING_EXECUTABLE_CALLSITE' }, { id: 'P02_REDIRECT_REAL_CONSUMER', redirectedToValidR55Event: true, rejectedFor: 'MISSING_EXECUTABLE_CALLSITE' }, { id: 'P12_COMMENT_ONLY_PRESENCE', sourceStringRetainedInComment: true, rejectedFor: 'MISSING_EXECUTABLE_CALLSITE' }], status: 'PASS' }, null, 2)}\n`)

for (const file of readdirSync(resolve(root, 'artifacts/s14-r2/RECEIPTS'))) copy(`artifacts/s14-r2/RECEIPTS/${file}`, `RECEIPTS/${file}`)
for (const file of ['02-projection.log', '03-executable-consumer-verifier.log', '04-focused-unit.log', '05-typecheck.log', '06a-globe-browser.log', '06b-runtime-consumers-browser.log', '06c-hero-ending-browser.log', '06d-brcg-touch-reset-browser.log', '07-production-build.log', '08-executable-negative-probes.log', '09-changed-scope-lint.log']) copy(`artifacts/s14-r2/LOGS/${file}`, `LOGS/${file}`)
for (const file of readdirSync(resolve(root, 'artifacts/s14-r2/SCREENSHOTS'))) copy(`artifacts/s14-r2/SCREENSHOTS/${file}`, `SCREENSHOTS/${file}`)
for (const file of ['03-exact-stamp-authorization.png', '04-exact-case-file-search.png', '05-exact-piggy-brcg-branch.png', '06-exact-arthur-guidance.png', '07-exact-hero-delta-1.png', '08-exact-hero-delta-2.png', '09-exact-hero-theory.png', '10-exact-brcg-terminal-branch.png', '03-default-ending.png', '04-brcg-ending.png', '05-final-completion-stinger.png']) copy(`artifacts/s14-r1/SCREENSHOTS/${file}`, `SCREENSHOTS/${file}`)
copy('artifacts/s14-r1/LOGS/01-r55-authority.log', 'LOGS/01-r55-authority-preserved.log')
copy('scripts/s14/build-r55-production-projection.mjs', 'TOOLS/build-r55-production-projection.mjs')
copy('scripts/s14-r2/consumer-contract-validator.mjs', 'TOOLS/consumer-contract-validator.mjs')
copy('scripts/s14-r2/verify-executable-consumers.mjs', 'TOOLS/verify-executable-consumers.mjs')
copy('scripts/s14-r2/run-executable-negative-probes.mjs', 'TOOLS/run-executable-negative-probes.mjs')

const bundlePath = join(stage, 'GIT/s14-r2-candidate.bundle')
mkdirSync(dirname(bundlePath), { recursive: true })
run('git', ['bundle', 'create', bundlePath, 'HEAD', `^${parent}`])
const patchResult = spawnSync('git', ['diff', '--binary', `${parent}..HEAD`], { cwd: root })
if (patchResult.status !== 0) throw new Error('Unable to create exact binary patch')
put('GIT/s14-r2-candidate.patch', patchResult.stdout)

const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)])
const payload = files(stage).map(path => ({ path: relative(stage, path), sha256: sha256(readFileSync(path)), bytes: statSync(path).size })).sort((a, b) => a.path.localeCompare(b.path))
put('MANIFEST.sha256', `${payload.map(item => `${item.sha256}  ${item.path}`).join('\n')}\n`)
const manifestSha256 = sha256(readFileSync(join(stage, 'MANIFEST.sha256')))
put('VERIFY_S14_R2_RETURN.py', `#!/usr/bin/env python3\nimport hashlib,pathlib\nroot=pathlib.Path(__file__).resolve().parent\nmanifest=root/'MANIFEST.sha256'\nif hashlib.sha256(manifest.read_bytes()).hexdigest()!='${manifestSha256}': raise SystemExit('FAIL_MANIFEST_IDENTITY')\nlisted={}\nfor row in manifest.read_text().splitlines():\n h,p=row.split('  ',1); listed[p]=h\nallowed=set(listed)|{'MANIFEST.sha256','VERIFY_S14_R2_RETURN.py'}\nactual={str(p.relative_to(root)) for p in root.rglob('*') if p.is_file()}\nif actual!=allowed: raise SystemExit('FAIL_MEMBER_SET')\nfor p,h in listed.items():\n if hashlib.sha256((root/p).read_bytes()).hexdigest()!=h: raise SystemExit('FAIL_HASH '+p)\nprint('PASS_S14_R2_RETURN',len(actual),'${commit}','${tree}')\n`)

const output = `/path/to/local-user/Downloads/${name}.zip`
const zipped = spawnSync('zip', ['-X', '-q', '-r', output, name], { cwd: temporary, encoding: 'utf8' })
if (zipped.status !== 0) throw new Error(zipped.stderr)
const members = Number(run('python3', ['-c', `import zipfile;print(len(zipfile.ZipFile('${output}').infolist()))`]))
console.log(JSON.stringify({ output, sha256: sha256(readFileSync(output)), bytes: statSync(output).size, members, commit, tree, parent, changedPaths: changedPaths.length }))
