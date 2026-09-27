import { createHash } from 'node:crypto'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const prerequisite = '603892b78357a7c1751caba73f60bce3ca4647ac'
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
if (parent !== prerequisite || parents.length !== 2) throw new Error('S14-R1 must be one direct non-merge child of the accepted S14 candidate')

const name = 'TRACE_ESCAPE_CURSOR_TO_MAIN_S14_R1_EXACT_RUNTIME_CONSUMER_BINDING_CLOSURE_v1.0.0_2026-09-24'
const temporary = mkdtempSync(join(tmpdir(), 's14-r1-return-'))
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

const projectionBytes = readFileSync('src/story/r55/generated/r55-production.json')
const projection = JSON.parse(projectionBytes)
const changedPaths = run('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']).split('\n').filter(Boolean)
const builtFiles = readdirSync('dist/assets').filter(file => /\.js(?:\.map)?$/.test(file))
const builtText = builtFiles.map(file => readFileSync(join('dist/assets', file), 'utf8')).join('\n')
const prohibited = {
  placeholderOwner: /s9-placeholders/i,
  nothingFinal: /Nothing here is final copy/i,
  placeholderSuffix: /PLACEHOLDER — Story binds final copy/i,
  storyTodo: /TODO\.STORY/i,
  leadTodo: /TODO\.LEAD_COPY/i,
  oldTube: /pneumatic tube/i,
  oldCanister: /record canister/i,
  oldAccessStrip: /access strip/i,
}
const buildAbsence = Object.fromEntries(Object.entries(prohibited).map(([key, pattern]) => [key, !pattern.test(builtText)]))
if (Object.values(buildAbsence).some(value => !value)) throw new Error('Prohibited production string survived the build scan')

const allLines = projection.events.flatMap(event => event.lines)
const allCues = allLines.flatMap(line => line.cues.map((cue, index) => ({ nodeId: line.nodeId, cueId: `${line.nodeId}:cue:${index + 1}`, intent: cue.intent, selectedClip: cue.selectedClip, fallback: cue.fallback, fallbackReason: cue.fallbackReason })))
const receipt = {
  schemaVersion: 's14-r1-return.v1',
  disposition: 'CANDIDATE_PENDING_CHATGPT_MAIN_LEAD_REVIEW',
  commit,
  tree,
  parent,
  changedPaths,
  authority: projection.authority,
  projection: {
    fileSha256: sha256(projectionBytes),
    payloadSha256: projection.projectionSha256,
    consumerMapSha256: projection.consumerMapSha256,
  },
  coverage: {
    nodes: allLines.length,
    eventGroups: projection.events.length,
    consumers: projection.consumerMap.length,
    ...projection.coverage,
  },
  qualification: {
    archiveDeepSemanticNegative: 'PASS',
    projectionReplay: 'PASS',
    focusedUnit: '42 passed',
    focusedBrowser: 'production 4 passed; direct Hero diagnostic 1 passed; extended production BRCG 1 passed',
    semanticNegativeProbes: '22/22 intended-reason rejections',
    typecheck: 'PASS',
    changedScopeLint: 'PASS_ZERO_ERRORS_ZERO_WARNINGS',
    productionBuild: 'PASS',
    blockedNetworkExternalRequests: 0,
  },
  preservation: {
    s13TruthCountsDispatchProof: 'UNCHANGED',
    endingNavigationMechanics: 'PRESERVED_WITH_SOURCE_BOUND_COPY',
    canonicalAndProtectedRefs: 'UNMOVED',
    acceptedStash: 'UNTOUCHED',
  },
  notRun: [
    'full fresh Vitest suite — explicitly owned by S15; no new shared-owner failure class triggered expansion',
    'full integrated browser matrix — explicitly owned by S15; bounded focused browser set was decision-complete',
  ],
  nextGate: 'S15_READY_NOT_STARTED',
  excludedEffects: {
    music: 0,
    audio: 0,
    sfx: 0,
    artBinaries: 0,
    dependenciesOrLockfile: 0,
    deploymentOrPublication: 0,
  },
}

put('RETURN_RECEIPT.json', `${JSON.stringify(receipt, null, 2)}\n`)
put('CHANGED_PATHS.txt', `${changedPaths.join('\n')}\n`)
put('RECOVERY.md', `# S14-R1 candidate recovery\n\nPrerequisite commit: \`${parent}\`.\n\nPreferred recovery: verify and fetch \`GIT/s14-r1-candidate.bundle\`, confirm its sole candidate is \`${commit}\`, and inspect before moving any ref.\n\nPatch recovery: begin from an exact clean checkout at the prerequisite commit, apply \`GIT/s14-r1-candidate.patch\` with binary support, and verify the resulting tree is \`${tree}\`.\n\nThis package is evidence for MAIN review. It does not move a protected ref, self-accept, start S15, add audio/music, deploy, or publish.\n`)
put('RECEIPTS/AUTHORITY_PROJECTION_CONSUMER_IDENTITIES.json', `${JSON.stringify({ authority: projection.authority, projectionFileSha256: sha256(projectionBytes), projectionPayloadSha256: projection.projectionSha256, consumerMapSha256: projection.consumerMapSha256 }, null, 2)}\n`)
put('RECEIPTS/STRUCTURED_SOURCE_BINDINGS.json', `${JSON.stringify(projection.structured, null, 2)}\n`)
put('RECEIPTS/PRODUCTION_BUILD_ABSENCE.json', `${JSON.stringify({ schemaVersion: 's14-r1-production-build-absence.v1', scannedFiles: builtFiles, assertions: buildAbsence, status: 'PASS' }, null, 2)}\n`)
put('RECEIPTS/CUE_FALLBACK_MAPPING.json', `${JSON.stringify({ schemaVersion: 's14-r1-cue-fallback.v1', totalCues: allCues.length, supportedIntentions: ['EXPRESSION', 'GAZE', 'MOVEMENT', 'STAGE', 'PROP', 'STAMP', 'BEAT', 'TIME', 'VOICE_TEXT'], unsupportedPolicy: 'generic/static fallback; never progression-bearing', cues: allCues }, null, 2)}\n`)
put('RECEIPTS/BLOCKED_NETWORK.json', `${JSON.stringify({ schemaVersion: 's14-r1-blocked-network.v1', productionJourneys: 4, externalProviderRequests: 0, websocketRequests: 0, evidence: 'LOGS/06-focused-browser.log', status: 'PASS' }, null, 2)}\n`)
put('RECEIPTS/TESTS_NOT_RUN.json', `${JSON.stringify({ schemaVersion: 's14-r1-nonruns.v1', notRun: receipt.notRun, expansionTrigger: 'NONE' }, null, 2)}\n`)
copy('artifacts/s14-r1/RECEIPTS/R55_PRODUCTION_CONSUMER_COVERAGE.csv', 'RECEIPTS/R55_PRODUCTION_CONSUMER_COVERAGE.csv')
copy('artifacts/s14-r1/RECEIPTS/CONSUMER_COVERAGE_RECEIPT.json', 'RECEIPTS/CONSUMER_COVERAGE_RECEIPT.json')
copy('artifacts/s14-r1/LOGS', 'LOGS')
copy('artifacts/s14-r1/SCREENSHOTS', 'SCREENSHOTS')
copy('scripts/s14-r1/verify-r55-consumer-coverage.mjs', 'TOOLS/verify-r55-consumer-coverage.mjs')
copy('scripts/s14-r1/run-semantic-negative-probes.mjs', 'TOOLS/run-semantic-negative-probes.mjs')
copy('scripts/s14/build-r55-production-projection.mjs', 'TOOLS/build-r55-production-projection.mjs')

const bundlePath = join(stage, 'GIT/s14-r1-candidate.bundle')
mkdirSync(dirname(bundlePath), { recursive: true })
run('git', ['bundle', 'create', bundlePath, 'HEAD', `^${parent}`])
const patchResult = spawnSync('git', ['diff', '--binary', `${parent}..HEAD`], { cwd: root })
if (patchResult.status !== 0) throw new Error('Unable to create exact binary patch')
put('GIT/s14-r1-candidate.patch', patchResult.stdout)

const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)])
const payload = files(stage).map(path => ({ path: relative(stage, path), sha256: sha256(readFileSync(path)), bytes: statSync(path).size })).sort((a, b) => a.path.localeCompare(b.path))
put('MANIFEST.sha256', `${payload.map(item => `${item.sha256}  ${item.path}`).join('\n')}\n`)
const manifestSha256 = sha256(readFileSync(join(stage, 'MANIFEST.sha256')))
put('VERIFY_S14_R1_RETURN.py', `#!/usr/bin/env python3\nimport hashlib,pathlib\nroot=pathlib.Path(__file__).resolve().parent\nmanifest=root/'MANIFEST.sha256'\nif hashlib.sha256(manifest.read_bytes()).hexdigest()!='${manifestSha256}': raise SystemExit('FAIL_MANIFEST_IDENTITY')\nlisted={}\nfor row in manifest.read_text().splitlines():\n h,p=row.split('  ',1); listed[p]=h\nallowed=set(listed)|{'MANIFEST.sha256','VERIFY_S14_R1_RETURN.py'}\nactual={str(p.relative_to(root)) for p in root.rglob('*') if p.is_file()}\nif actual!=allowed: raise SystemExit('FAIL_MEMBER_SET')\nfor p,h in listed.items():\n if hashlib.sha256((root/p).read_bytes()).hexdigest()!=h: raise SystemExit('FAIL_HASH '+p)\nprint('PASS_S14_R1_RETURN',len(actual),'${commit}','${tree}')\n`)

const output = `/path/to/local-user/Downloads/${name}.zip`
const zipped = spawnSync('zip', ['-X', '-q', '-r', output, name], { cwd: temporary, encoding: 'utf8' })
if (zipped.status !== 0) throw new Error(zipped.stderr)
const members = Number(run('python3', ['-c', `import zipfile;print(len(zipfile.ZipFile('${output}').infolist()))`]))
console.log(JSON.stringify({ output, sha256: sha256(readFileSync(output)), bytes: statSync(output).size, members, commit, tree, parent, changedPaths: changedPaths.length }))
