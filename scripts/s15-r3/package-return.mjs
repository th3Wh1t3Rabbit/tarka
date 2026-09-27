import { createHash } from 'node:crypto'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const parent = '4adc9a21c99bf17bc069b4b1bb0a8fa08fdcf05a'
const parentTree = '7d08507da304186986cd2ef9880366809e7ffc7d'
const protectedState = { main: 'f57ecf3d5accabb14416e14a127efb7cdd1fc275', g6pA0PointClick: '0f52131c9f56f49128e7a413396331917e687a1f', stash: '0a7d1c1df04bdd32ee435881a05fef169451e0ba' }
const musicSha256 = '0682b1b00dc4d5a0c694ed46860580cee027e765f3f7b6eb1f1cc03c951abf38'
const name = 'TRACE_ESCAPE_CURSOR_TO_MAIN_S15_R3_TRUE_PRINCIPAL_FEEDBACK_RUNTIME_CLOSURE_AND_TERMINAL_GAP_AUDIT_v1.0.0_2026-09-24'
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: root, encoding: options.binary ? undefined : 'utf8', maxBuffer: 512_000_000, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}\n${result.stdout ?? ''}${result.stderr ?? ''}`)
  return result.stdout
}
const git = (...args) => String(run('git', args)).trim()
const commit = git('rev-parse', 'HEAD')
const tree = git('rev-parse', 'HEAD^{tree}')
if (git('rev-parse', 'HEAD^') !== parent || git('rev-list', '--parents', '-n', '1', 'HEAD').split(/\s+/).length !== 2) throw new Error('Not one direct non-merge child')
if (git('rev-parse', `${parent}^{tree}`) !== parentTree) throw new Error('Parent tree mismatch')
if (spawnSync('git', ['symbolic-ref', '-q', 'HEAD'], { cwd: root }).status !== 1) throw new Error('HEAD is not detached')
if (git('rev-parse', 'refs/heads/main') !== protectedState.main || git('rev-parse', 'refs/heads/g6p-a0-point-click') !== protectedState.g6pA0PointClick || git('rev-parse', 'refs/stash') !== protectedState.stash) throw new Error('Protected state moved')
if (git('status', '--short', '--untracked-files=no')) throw new Error('Tracked worktree is not clean')
if (sha256(readFileSync('public/audio/background-64k.ogg')) !== musicSha256) throw new Error('Music bytes changed')

const closure = JSON.parse(readFileSync('review/s15-r3/PRINCIPAL_FEEDBACK_CLOSURE.json', 'utf8'))
const qualification = JSON.parse(readFileSync('review/s15-r3/QUALIFICATION.json', 'utf8'))
const ownership = JSON.parse(readFileSync('review/s15-r3/EVIDENCE_OWNERSHIP.json', 'utf8'))
const mutation = JSON.parse(readFileSync('review/s15-r3/RECEIPTS/REAL_MUTATION_PROBES.json', 'utf8'))
const terminalAudit = JSON.parse(readFileSync('review/s15-r3/TERMINAL_PRODUCTION_GAP_AUDIT.json', 'utf8'))
if (closure.overallStatus !== 'PASS' || closure.rows.length !== 57 || !closure.rows.every((row) => row.status === 'PASS')) throw new Error('PF1 closure incomplete')
if (qualification.status !== 'PASS' || !qualification.gates.every((gate) => gate.passed)) throw new Error('Qualification incomplete')
if (!mutation.allPassed || mutation.passed !== 29) throw new Error('Mutation evidence incomplete')
if (terminalAudit.status !== 'READ_ONLY_AUDIT_NOT_PRODUCTION_READY') throw new Error('Terminal audit posture changed')
if (!ownership.cleanBeforeCapture || !ownership.allOwned || !ownership.candidateBound || ownership.artifacts.length < 23) throw new Error('Evidence ownership incomplete')
if (new Set(ownership.artifacts.map((entry) => entry.artifactPath)).size !== ownership.artifacts.length) throw new Error('Duplicate evidence ownership path')
for (const entry of ownership.artifacts) {
  if (entry.candidateCommit !== commit || entry.candidateTree !== tree || entry.ordinaryUrlAndQuery !== '/' || !entry.exists || entry.byteSize <= 1000) throw new Error(`Invalid evidence owner: ${entry.artifactPath}`)
}
for (const prefix of terminalAudit.ordinaryCaptureRequirement.requiredArtifactPrefixes) {
  if (!ownership.artifacts.some((entry) => entry.artifactPath === `SCREENSHOTS/${prefix}.png`)) throw new Error(`Missing terminal capture: ${prefix}`)
}

const temporary = mkdtempSync(join(tmpdir(), 's15-r3-return-'))
const stage = join(temporary, name)
mkdirSync(stage)
const put = (path, value) => { const target = join(stage, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, value) }
const copy = (from, to) => { const target = join(stage, to); mkdirSync(dirname(target), { recursive: true }); cpSync(resolve(root, from), target, { recursive: true }) }
const changed = git('diff-tree', '--no-commit-id', '--name-status', '-r', 'HEAD').split('\n').filter(Boolean)
put('START_HERE.md', `# Tarka S15-R3 return\n\nStatus: true PF1 runtime closure complete; independent MAIN review pending. The terminal audit is read-only and explicitly does not classify the terminal as production-ready. S16 is not started, and Principal Playtest 2 was not launched or authorized.\n\nRun \`python3 VERIFY_S15_R3_RETURN.py\` from this extracted directory.\n\nCanonical gates: 223 unit checks passed with one intentional skip; 40 browser checks passed, including Direct, Curious, and Mistaken ordinary journeys. All 29 real isolated-worktree mutations were rejected. No provider credential was resolved or accessed.\n\nThe Principal explicitly approved an alternate port. Port 4176 was used only for qualification and evidence capture; the existing 4174 and 4175 previews were left untouched and were not used as acceptance evidence.\n`)
put('PREFLIGHT_POSTFLIGHT.json', `${JSON.stringify({ schemaVersion: 's15-r3.preflight-postflight.v1', status: 'PASS', preflight: { head: parent, tree: parentTree, detached: true, protectedState, musicSha256, providerCredentialAccess: 'NONE', existingPreviews: [{ port: 4174, pid: 370872 }, { port: 4175, pid: 630065 }], existingPreviewsAcceptanceEvidence: false }, postflight: { commit, tree, soleParent: parent, parentCount: 1, detached: true, trackedState: 'CLEAN', protectedState, userApprovedAlternatePort: 4176, principalPlaytest2Launched: false, reviewStatus: 'PENDING_CHATGPT_MAIN_LEAD_REVIEW' } }, null, 2)}\n`)
put('CHANGED_PATHS.txt', `${changed.join('\n')}\n`)
put('RECOVERY.md', `# Recovery\n\nVerify and clone \`GIT/s15-r3-complete.bundle\`, or apply \`GIT/s15-r3-full-index-binary.patch\` at exact parent \`${parent}\` and verify tree \`${tree}\`. No protected ref, stash, deployment, publication, tag, release, preview, or Principal Playtest 2 state was changed.\n`)
for (const path of ['PRINCIPAL_FEEDBACK_CLOSURE.json', 'QUALIFICATION.json', 'EVIDENCE_OWNERSHIP.json', 'TERMINAL_PRODUCTION_GAP_AUDIT.json', 'TERMINAL_PRODUCTION_GAP_AUDIT.md']) copy(`review/s15-r3/${path}`, path)
for (const directory of ['OBSERVATIONS', 'RECEIPTS', 'SCREENSHOTS', 'LOGS']) copy(`review/s15-r3/${directory}`, directory)
put('DIFFS/source.diff', run('git', ['diff', `${parent}..HEAD`, '--', 'src', 'scripts', 'playwright.config.ts']))
put('DIFFS/tests.diff', run('git', ['diff', `${parent}..HEAD`, '--', 'tests']))
mkdirSync(join(stage, 'GIT'), { recursive: true })
run('git', ['bundle', 'create', join(stage, 'GIT/s15-r3-complete.bundle'), 'HEAD'])
put('GIT/s15-r3-full-index-binary.patch', run('git', ['diff', '--binary', '--full-index', `${parent}..HEAD`], { binary: true }))
const files = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)])
const payload = files(stage).map((path) => ({ path: relative(stage, path), sha256: sha256(readFileSync(path)), bytes: statSync(path).size })).sort((a, b) => a.path.localeCompare(b.path))
put('MANIFEST.sha256', `${payload.map((item) => `${item.sha256}  ${item.path}`).join('\n')}\n`)
const manifestSha = sha256(readFileSync(join(stage, 'MANIFEST.sha256')))
put('VERIFY_S15_R3_RETURN.py', `#!/usr/bin/env python3
import hashlib,pathlib,subprocess,tempfile,shutil,json
root=pathlib.Path(__file__).resolve().parent; manifest=root/'MANIFEST.sha256'
if hashlib.sha256(manifest.read_bytes()).hexdigest()!='${manifestSha}': raise SystemExit('FAIL_MANIFEST_IDENTITY')
listed={}
for row in manifest.read_text().splitlines(): h,p=row.split('  ',1);listed[p]=h
actual={str(p.relative_to(root)) for p in root.rglob('*') if p.is_file()}
if actual != set(listed)|{'MANIFEST.sha256','VERIFY_S15_R3_RETURN.py'}: raise SystemExit('FAIL_MEMBER_SET')
for p,h in listed.items():
 if hashlib.sha256((root/p).read_bytes()).hexdigest()!=h: raise SystemExit('FAIL_HASH '+p)
closure=json.loads((root/'PRINCIPAL_FEEDBACK_CLOSURE.json').read_text()); ownership=json.loads((root/'EVIDENCE_OWNERSHIP.json').read_text()); qualification=json.loads((root/'QUALIFICATION.json').read_text()); audit=json.loads((root/'TERMINAL_PRODUCTION_GAP_AUDIT.json').read_text())
if closure['overallStatus']!='PASS' or len(closure['rows'])!=57 or not all(r['status']=='PASS' for r in closure['rows']): raise SystemExit('FAIL_CLOSURE')
if qualification['status']!='PASS' or not all(g['passed'] for g in qualification['gates']): raise SystemExit('FAIL_QUALIFICATION')
if not ownership['allOwned'] or not ownership['candidateBound'] or len(ownership['artifacts'])<23: raise SystemExit('FAIL_EVIDENCE_OWNERSHIP')
if audit['status']!='READ_ONLY_AUDIT_NOT_PRODUCTION_READY': raise SystemExit('FAIL_TERMINAL_POSTURE')
tmp=pathlib.Path(tempfile.mkdtemp(prefix='s15-r3-verify-'))
try:
 bare=tmp/'verify.git';subprocess.run(['git','init','--bare',str(bare)],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['git','-C',str(bare),'bundle','verify',str(root/'GIT/s15-r3-complete.bundle')],check=True,stdout=subprocess.DEVNULL)
 clone=tmp/'clone';subprocess.run(['git','clone','-q',str(root/'GIT/s15-r3-complete.bundle'),str(clone)],check=True)
 def g(*args): return subprocess.check_output(['git','-C',str(clone),*args],text=True).strip()
 if g('rev-parse','HEAD')!='${commit}' or g('rev-parse','HEAD^{tree}')!='${tree}' or g('rev-parse','HEAD^')!='${parent}' or len(g('rev-list','--parents','-n','1','HEAD').split())!=2: raise SystemExit('FAIL_GIT_IDENTITY')
 subprocess.run(['git','-C',str(clone),'fsck','--full','--strict'],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['git','-C',str(clone),'checkout','-q','${parent}'],check=True)
 subprocess.run(['git','-C',str(clone),'apply','--index',str(root/'GIT/s15-r3-full-index-binary.patch')],check=True)
 if g('write-tree')!='${tree}': raise SystemExit('FAIL_PATCH_TREE')
finally: shutil.rmtree(tmp)
print('PASS_S15_R3_RETURN',len(actual),'${commit}','${tree}','${parent}')
`)
const output = `/path/to/local-user/Downloads/${name}.zip`
rmSync(output, { force: true })
const zipped = spawnSync('zip', ['-X', '-q', '-r', output, name], { cwd: temporary, encoding: 'utf8' })
if (zipped.status !== 0) throw new Error(zipped.stderr)
const members = Number(run('python3', ['-c', `import zipfile;print(len(zipfile.ZipFile('${output}').infolist()))`]).trim())
console.log(JSON.stringify({ output, sha256: sha256(readFileSync(output)), bytes: statSync(output).size, members, commit, tree, parent, changedPaths: changed.length, evidenceArtifacts: ownership.artifacts.length }))
