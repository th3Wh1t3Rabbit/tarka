import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '../..')
const parent = 'cdafe84712087933612b55da53b4029e99605358'
const parentTree = 'aba0503b7fb0f2a9a0bc5c8bf5ccedf5d3a995fb'
const protectedRefsSha256 = 'd7a93d7ef473d2358c1a1a348536f63da0acc9dcd992144f7e95c058c41ee13b'
const protectedStashSha256 = '1e8577a8511e35ea3b28d51151688469bed6d5be5194ecad2620a1f969dcfffa'
const original = {
  filename: 'TRACE_ESCAPE_MAIN_TO_CODEX_S16_R1_TERMINAL_RECONCILIATION_SOURCE_AUDIT_AND_CONTEXT_AUDIO_v1.0.0_2026-09-25.zip',
  sha256: '1dfb63f75d20f570c56512c0be1127fe4c3ff2ce71fc72554596e7aed4f3725d',
  bytes: 2384703,
  verifiedDeep: 'PASS_TARKA_S16_R1_TRANSMISSION 23 cdafe84712087933612b55da53b4029e99605358 aba0503b7fb0f2a9a0bc5c8bf5ccedf5d3a995fb',
}
const name = 'TRACE_ESCAPE_CODEX_TO_MAIN_S16_R1_TERMINAL_RECONCILIATION_SOURCE_AUDIT_AND_CONTEXT_AUDIO_v1.0.0_2026-09-25'
const output = `/path/to/local-user/Downloads/${name}.zip`
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const runResult = (command, args, options = {}) => spawnSync(command, args, { cwd: options.cwd ?? root, encoding: options.binary ? undefined : 'utf8', maxBuffer: 512_000_000, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } })
const run = (command, args, options = {}) => {
  const result = runResult(command, args, options)
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}\n${result.stdout ?? ''}${result.stderr ?? ''}`)
  return result.stdout
}
const git = (...args) => String(run('git', args)).trim()
const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)])

const commit = git('rev-parse', 'HEAD')
const tree = git('rev-parse', 'HEAD^{tree}')
const parents = git('rev-list', '--parents', '-n', '1', 'HEAD').split(/\s+/).slice(1)
if (parents.length !== 1 || parents[0] !== parent) throw new Error('Candidate is not one direct non-merge child of the sealed S16 commit')
if (git('rev-parse', `${parent}^{tree}`) !== parentTree) throw new Error('Sealed S16 parent tree mismatch')
if (runResult('git', ['symbolic-ref', '-q', 'HEAD']).status !== 1) throw new Error('Candidate HEAD is not detached')
if (git('status', '--short', '--untracked-files=no')) throw new Error('Tracked worktree is not clean')
if (sha256(run('git', ['show-ref'])) !== protectedRefsSha256) throw new Error('Protected refs changed')
if (sha256(run('git', ['stash', 'list', '--format=%gd %H %gs'])) !== protectedStashSha256) throw new Error('Protected stash changed')

const qualification = JSON.parse(readFileSync(join(root, 'review/s16-r1/QUALIFICATION.json'), 'utf8'))
const mutation = JSON.parse(readFileSync(join(root, 'review/s16-r1/MUTATIONS/MUTATION_RESULTS.json'), 'utf8'))
const audio = JSON.parse(readFileSync(join(root, 'review/s16-r1/AUDIO_ASSET_RECEIPT.json'), 'utf8'))
const reservation = JSON.parse(readFileSync(join(root, 'review/s16-r1/S17_RESERVATION.json'), 'utf8'))
if (qualification.status !== 'PASS' || !qualification.gates.every(gate => gate.status === 'PASS')) throw new Error('Qualification is incomplete')
if (mutation.survived !== 0 || mutation.killed !== mutation.total) throw new Error('Mutation qualification is incomplete')
if (audio.status !== 'PASS' || audio.audioAssetCount !== 3 || !audio.publicDeploymentBlocked) throw new Error('Audio receipt is incomplete')
if (reservation.status !== 'S17_READ_ONLY_READY_NOT_STARTED' || reservation.principalReview.principalPlaytest2 !== 'NOT_AUTHORIZED') throw new Error('S17 reservation posture changed')

const scratch = mkdtempSync(join(tmpdir(), 'trace-escape-s16-r1-return.'))
const stage = join(scratch, name)
const put = (path, value) => { const target = join(stage, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, value) }
try {
  mkdirSync(stage)
  cpSync(join(root, 'review/s16-r1'), join(stage, 'EVIDENCE'), { recursive: true })
  put('START_HERE.md', `# Tarka S16-R1 return\n\nStatus: **S16_R1_COMPLETE_PENDING_MAIN_REVIEW**. S17 is read-only ready and was not started. Principal Playtest 2 was not launched or authorized. Public deployment remains blocked pending exact audio redistribution/attribution clearance and Principal review.\n\nRun \`python3 VERIFY_S16_R1_RETURN.py\` from this extracted directory.\n\nThe Principal explicitly approved an alternate qualification port. Free loopback ports 4175 and 4176 were used for task-owned browser checks; protected port 4174 and its existing service were not touched. Task-owned preview servers were stopped after their runs.\n`)
  put('ORIGINAL_TRANSMISSION.json', `${JSON.stringify({ ...original, readOrderFollowed: true, supersededAmendmentApplied: false, s17Started: false }, null, 2)}\n`)
  const protectedState = { schemaVersion: 's16-r1.protected-state.v1', status: 'UNCHANGED', before: { refsSha256: protectedRefsSha256, stashSha256: protectedStashSha256 }, after: { refsSha256: protectedRefsSha256, stashSha256: protectedStashSha256 } }
  put('PROTECTED_STATE.json', `${JSON.stringify(protectedState, null, 2)}\n`)
  const changed = git('diff-tree', '--no-commit-id', '--name-status', '-r', 'HEAD').split('\n').filter(Boolean)
  put('CHANGED_PATHS.txt', `${changed.join('\n')}\n`)
  put('RECOVERY.md', `# Recovery\n\nClone \`GIT/s16-r1-complete.bundle\`, or apply \`GIT/s16-r1-full-index-binary.patch\` with \`--index\` at exact parent \`${parent}\` and verify resulting tree \`${tree}\`. No protected ref, stash, deployment, publication, tag, release, Principal server, or Playtest 2 state was changed.\n`)
  mkdirSync(join(stage, 'GIT'), { recursive: true })
  run('git', ['bundle', 'create', join(stage, 'GIT/s16-r1-complete.bundle'), 'HEAD'])
  put('GIT/s16-r1-full-index-binary.patch', run('git', ['diff', '--binary', '--full-index', parent, 'HEAD'], { binary: true }))
  const summary = {
    schemaVersion: 's16-r1.return-summary.v1',
    status: 'S16_R1_COMPLETE_PENDING_MAIN_REVIEW',
    commit,
    tree,
    parent,
    parentTree,
    soleParent: true,
    detachedHead: true,
    trackedState: 'CLEAN',
    changedPathCount: changed.length,
    gitBundle: 'GIT/s16-r1-complete.bundle',
    fullIndexBinaryPatch: 'GIT/s16-r1-full-index-binary.patch',
    protectedState,
    originalTransmission: original,
    qualificationStatus: qualification.status,
    mutationScore: `${mutation.killed}/${mutation.total}`,
    s17Status: reservation.status,
    principalPlaytest2: 'NOT_AUTHORIZED',
    publicReleaseReady: false,
  }
  put('RETURN_SUMMARY.json', `${JSON.stringify(summary, null, 2)}\n`)

  const manifestFiles = files(stage).sort().map(path => ({ path: relative(stage, path), sha256: sha256(readFileSync(path)), bytes: statSync(path).size }))
  put('MANIFEST.sha256', `${manifestFiles.map(item => `${item.sha256}  ${item.path}`).join('\n')}\n`)
  const manifestSha256 = sha256(readFileSync(join(stage, 'MANIFEST.sha256')))
  put('VERIFY_S16_R1_RETURN.py', `#!/usr/bin/env python3
import hashlib,json,pathlib,shutil,subprocess,tempfile
root=pathlib.Path(__file__).resolve().parent
manifest=root/'MANIFEST.sha256'
if hashlib.sha256(manifest.read_bytes()).hexdigest()!='${manifestSha256}': raise SystemExit('FAIL_MANIFEST_IDENTITY')
listed={}
for row in manifest.read_text().splitlines():
 h,p=row.split('  ',1)
 q=pathlib.PurePosixPath(p)
 if p in listed or q.is_absolute() or '..' in q.parts or '\\\\' in p: raise SystemExit('FAIL_UNSAFE_OR_DUPLICATE_MEMBER '+p)
 listed[p]=h
actual=set()
for p in root.rglob('*'):
 if p.is_symlink(): raise SystemExit('FAIL_SYMLINK '+str(p))
 if p.is_file(): actual.add(p.relative_to(root).as_posix())
if actual != set(listed)|{'MANIFEST.sha256','VERIFY_S16_R1_RETURN.py'}: raise SystemExit('FAIL_MEMBER_SET')
for p,h in listed.items():
 if hashlib.sha256((root/p).read_bytes()).hexdigest()!=h: raise SystemExit('FAIL_HASH '+p)
summary=json.loads((root/'RETURN_SUMMARY.json').read_text())
if summary['status']!='S16_R1_COMPLETE_PENDING_MAIN_REVIEW' or summary['parent']!='${parent}' or summary['tree']!='${tree}': raise SystemExit('FAIL_SUMMARY')
audio=json.loads((root/'EVIDENCE/AUDIO_ASSET_RECEIPT.json').read_text())
mut=json.loads((root/'EVIDENCE/MUTATIONS/MUTATION_RESULTS.json').read_text())
reservation=json.loads((root/'EVIDENCE/S17_RESERVATION.json').read_text())
if audio['status']!='PASS' or audio['audioAssetCount']!=3 or not audio['publicDeploymentBlocked']: raise SystemExit('FAIL_AUDIO')
if mut['survived']!=0 or mut['killed']!=mut['total']: raise SystemExit('FAIL_MUTATIONS')
if reservation['status']!='S17_READ_ONLY_READY_NOT_STARTED': raise SystemExit('FAIL_S17_POSTURE')
tmp=pathlib.Path(tempfile.mkdtemp(prefix='s16-r1-verify-'))
try:
 bare=tmp/'verify.git';subprocess.run(['git','init','--bare','-q',str(bare)],check=True)
 subprocess.run(['git','-C',str(bare),'bundle','verify',str(root/'GIT/s16-r1-complete.bundle')],check=True,stdout=subprocess.DEVNULL)
 clone=tmp/'clone';subprocess.run(['git','clone','-q',str(root/'GIT/s16-r1-complete.bundle'),str(clone)],check=True)
 def g(*args): return subprocess.check_output(['git','-C',str(clone),*args],text=True).strip()
 if g('rev-parse','HEAD')!='${commit}' or g('rev-parse','HEAD^{tree}')!='${tree}' or g('rev-parse','HEAD^')!='${parent}' or g('rev-parse','${parent}^{tree}')!='${parentTree}' or len(g('rev-list','--parents','-n','1','HEAD').split())!=2: raise SystemExit('FAIL_GIT_IDENTITY')
 subprocess.run(['git','-C',str(clone),'fsck','--full','--strict'],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['git','-C',str(clone),'checkout','-q','${parent}'],check=True)
 subprocess.run(['git','-C',str(clone),'apply','--index','--binary',str(root/'GIT/s16-r1-full-index-binary.patch')],check=True)
 if g('write-tree')!='${tree}': raise SystemExit('FAIL_PATCH_TREE')
finally: shutil.rmtree(tmp)
print('PASS_S16_R1_RETURN',len(actual),'${commit}','${tree}','${parent}')
`)

  rmSync(output, { force: true })
  const zip = runResult('zip', ['-X', '-q', '-r', output, name], { cwd: scratch })
  if (zip.status !== 0) throw new Error(zip.stderr)
  const zipAudit = run('python3', ['-c', "import sys,zipfile,pathlib; z=zipfile.ZipFile(sys.argv[1]); n=z.namelist(); assert len(n)==len(set(n)); assert all(not pathlib.PurePosixPath(x).is_absolute() and '..' not in pathlib.PurePosixPath(x).parts and '\\\\' not in x for x in n); print(len(n))", output]).trim()
  const extracted = join(scratch, 'verify-extracted')
  mkdirSync(extracted)
  run('unzip', ['-q', output, '-d', extracted])
  const verification = run('python3', [join(extracted, name, 'VERIFY_S16_R1_RETURN.py')], extracted).trim()
  console.log(JSON.stringify({ status: 'PASS', output, sha256: sha256(readFileSync(output)), bytes: statSync(output).size, members: Number(zipAudit), commit, tree, parent, changedPaths: changed.length, verification }))
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
