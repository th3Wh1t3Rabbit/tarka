import { createHash } from 'node:crypto'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const parent = 'cd4d19abbb1bd8dbd5de772013be11c449899dc9'
const parentTree = '8561c20dd7b5e8924ec46228d5f00436bd98d0f2'
const main = 'f57ecf3d5accabb14416e14a127efb7cdd1fc275'
const protectedRef = '0f52131c9f56f49128e7a413396331917e687a1f'
const stash = '0a7d1c1df04bdd32ee435881a05fef169451e0ba'
const name = 'TRACE_ESCAPE_CURSOR_TO_MAIN_S15_R1_CANONICAL_PRODUCTION_QUALIFICATION_AND_PRINCIPAL_PLAYTEST_LAUNCH_v1.0.0_2026-09-24'
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const execute = (command, args, cwd = root) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 256_000_000, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}\n${result.stdout ?? ''}${result.stderr ?? ''}`)
  return `${result.stdout ?? ''}${result.stderr ?? ''}`
}
const git = (...args) => execute('git', args).trim()
const commit = git('rev-parse', 'HEAD')
const tree = git('rev-parse', 'HEAD^{tree}')
if (git('rev-parse', 'HEAD^') !== parent || git('rev-list', '--parents', '-n', '1', 'HEAD').split(/\s+/).length !== 2) throw new Error('S15-R1 must be one direct non-merge child of S15')
if (git('rev-parse', `${parent}^{tree}`) !== parentTree) throw new Error('S15 parent tree changed')
if (spawnSync('git', ['symbolic-ref', '-q', 'HEAD'], { cwd: root }).status !== 1) throw new Error('HEAD must remain detached')
if (git('rev-parse', 'refs/heads/main') !== main || git('rev-parse', 'refs/heads/g6p-a0-point-click') !== protectedRef || git('rev-parse', 'refs/stash') !== stash) throw new Error('Protected refs or stash moved')
if (git('status', '--short', '--untracked-files=no')) throw new Error('Tracked worktree is not clean')
const server = JSON.parse(readFileSync('artifacts/s15-r1/RECEIPTS/SERVER_LAUNCH.json', 'utf8'))
if (server.status !== 'PASS_LIVE') throw new Error('Principal server is not live')

const temporary = mkdtempSync(join(tmpdir(), 's15-r1-return-'))
const stage = join(temporary, name)
mkdirSync(stage)
const put = (path, value) => { const target = join(stage, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, value) }
const copy = (from, to) => { const target = join(stage, to); mkdirSync(dirname(target), { recursive: true }); cpSync(resolve(root, from), target, { recursive: true }) }
const changedPaths = git('diff-tree', '--no-commit-id', '--name-status', '-r', 'HEAD').split('\n').filter(Boolean)
const preflight = { schemaVersion: 's15-r1-preflight.v1', expected: { head: parent, tree: parentTree, detached: true }, protected: { main, g6pA0PointClick: protectedRef, stash }, status: 'PASS' }
const postflight = { schemaVersion: 's15-r1-postflight.v1', commit, tree, soleParent: parent, parentCount: 1, detached: true, trackedState: 'CLEAN', protected: preflight.protected, status: 'PASS' }
put('START_HERE.md', `# Tarka S15-R1 return\n\nStatus: candidate pending ChatGPT MAIN lead and Principal Playtest 1.\n\nRun \`python3 VERIFY_S15_R1_RETURN.py\` from this extracted directory.\n\nCurrent-production canonical gates: 15 unit/acquisition files (159 pass, one accepted skip) and 12 browser files (34 pass), including three ordinary title-to-completion journeys. Historical diagnostics remain preserved and non-gating.\n\nThe local Principal preview was launched at ${server.url} with PID ${server.pid}. Music license metadata remains pending; public deployment/publication is blocked.\n`)
put('PREFLIGHT.json', `${JSON.stringify(preflight, null, 2)}\n`)
put('POSTFLIGHT.json', `${JSON.stringify(postflight, null, 2)}\n`)
put('CHANGED_PATHS.txt', `${changedPaths.join('\n')}\n`)
put('RECOVERY.md', `# Recovery\n\nVerify and clone \`GIT/s15-r1-complete.bundle\`, or apply \`GIT/s15-r1-full-index-binary.patch\` at exact parent \`${parent}\` and verify tree \`${tree}\`.\n\nNo protected ref was moved and no deployment, publication, tag, release, or self-acceptance occurred.\n`)
copy('PRINCIPAL_PLAYTEST_1_GUIDE.md', 'PRINCIPAL_PLAYTEST_1_GUIDE.md')
copy('PRINCIPAL_PLAYTEST_1_NOTES.md', 'PRINCIPAL_PLAYTEST_1_NOTES.md')
copy('scripts/s15-r1/test-ownership.json', 'TEST_OWNERSHIP/test-ownership.json')
copy('scripts/s15-r1/validate-test-ownership.mjs', 'TEST_OWNERSHIP/validate-test-ownership.mjs')
copy('artifacts/s15-r1', 'EVIDENCE')
copy('review/principal-playtest-1/server-launch.json', 'SERVER/server-launch.json')
copy('review/principal-playtest-1/server.log', 'SERVER/server.log')
copy('review/principal-playtest-1/server.pid', 'SERVER/server.pid')
const bundle = join(stage, 'GIT/s15-r1-complete.bundle')
mkdirSync(dirname(bundle), { recursive: true })
execute('git', ['bundle', 'create', bundle, 'HEAD'])
const patch = spawnSync('git', ['diff', '--binary', '--full-index', `${parent}..HEAD`], { cwd: root, maxBuffer: 256_000_000 })
if (patch.status !== 0) throw new Error('Unable to create S15-R1 patch')
put('GIT/s15-r1-full-index-binary.patch', patch.stdout)
const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)])
const payload = files(stage).map(path => ({ path: relative(stage, path), sha256: sha256(readFileSync(path)), bytes: statSync(path).size })).sort((a, b) => a.path.localeCompare(b.path))
put('MANIFEST.sha256', `${payload.map(item => `${item.sha256}  ${item.path}`).join('\n')}\n`)
const manifestSha = sha256(readFileSync(join(stage, 'MANIFEST.sha256')))
put('VERIFY_S15_R1_RETURN.py', `#!/usr/bin/env python3
import hashlib,pathlib,subprocess,tempfile,shutil
root=pathlib.Path(__file__).resolve().parent
manifest=root/'MANIFEST.sha256'
if hashlib.sha256(manifest.read_bytes()).hexdigest()!='${manifestSha}': raise SystemExit('FAIL_MANIFEST_IDENTITY')
listed={}
for row in manifest.read_text().splitlines(): h,p=row.split('  ',1);listed[p]=h
actual={str(p.relative_to(root)) for p in root.rglob('*') if p.is_file()}
if actual != set(listed)|{'MANIFEST.sha256','VERIFY_S15_R1_RETURN.py'}: raise SystemExit('FAIL_MEMBER_SET')
for p,h in listed.items():
 if hashlib.sha256((root/p).read_bytes()).hexdigest()!=h: raise SystemExit('FAIL_HASH '+p)
tmp=pathlib.Path(tempfile.mkdtemp(prefix='s15-r1-verify-'))
try:
 bare=tmp/'verify.git';subprocess.run(['git','init','--bare',str(bare)],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['git','-C',str(bare),'bundle','verify',str(root/'GIT/s15-r1-complete.bundle')],check=True,stdout=subprocess.DEVNULL)
 clone=tmp/'clone';subprocess.run(['git','clone','-q',str(root/'GIT/s15-r1-complete.bundle'),str(clone)],check=True)
 def g(*args): return subprocess.check_output(['git','-C',str(clone),*args],text=True).strip()
 if g('rev-parse','HEAD')!='${commit}' or g('rev-parse','HEAD^{tree}')!='${tree}' or g('rev-parse','HEAD^')!='${parent}' or len(g('rev-list','--parents','-n','1','HEAD').split())!=2: raise SystemExit('FAIL_GIT_IDENTITY')
 subprocess.run(['git','-C',str(clone),'fsck','--full','--strict'],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['git','-C',str(clone),'checkout','-q','${parent}'],check=True)
 subprocess.run(['git','-C',str(clone),'apply','--index',str(root/'GIT/s15-r1-full-index-binary.patch')],check=True)
 if g('write-tree')!='${tree}': raise SystemExit('FAIL_PATCH_TREE')
finally: shutil.rmtree(tmp)
print('PASS_S15_R1_RETURN',len(actual),'${commit}','${tree}','${parent}')
`)
const output = `/path/to/local-user/Downloads/${name}.zip`
rmSync(output, { force: true })
const zipped = spawnSync('zip', ['-X', '-q', '-r', output, name], { cwd: temporary, encoding: 'utf8' })
if (zipped.status !== 0) throw new Error(zipped.stderr)
const members = Number(execute('python3', ['-c', `import zipfile;print(len(zipfile.ZipFile('${output}').infolist()))`]).trim())
console.log(JSON.stringify({ output, sha256: sha256(readFileSync(output)), bytes: statSync(output).size, members, commit, tree, parent, changedPaths: changedPaths.length }))
