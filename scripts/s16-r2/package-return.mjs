import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '../..')
const parent = '688606e44dfea9a65134d95533edcb563a41631d'
const parentTree = 'c6b194be816b98542602eef8fd6ef0b664d7f1e0'
const refsDigest = '1258272628289f456aa15f02e77d5fa929c7d4a7ffdbac6aa3164e94044f1105'
const stashDigest = '1e8577a8511e35ea3b28d51151688469bed6d5be5194ecad2620a1f969dcfffa'
const name = 'TRACE_ESCAPE_CODEX_TO_MAIN_S16_R2_RECORD_FLOW_SAVE_INTEGRITY_AND_SEAM_AUDIO_v1.0.0_2026-09-26'
const output = `/path/to/local-user/Downloads/${name}.zip`
const original = {
  filename: 'TRACE_ESCAPE_MAIN_TO_CODEX_S16_R2_RECORD_FLOW_SAVE_INTEGRITY_AND_SEAM_AUDIO_v1.0.0_2026-09-25.zip',
  sha256: 'a36afdeb3f95f37cbe5d3ca426395fd2344349796a389ec26603e36b9c47f88c',
  bytes: 2596787,
  regularFiles: 43,
  standaloneVerification: 'PASS_S16_R2_TRANSMISSION 42',
  repoAdmission: 'PASS_S16_R2_EXACT_BASE_ADMISSION 688606e44dfea9a65134d95533edcb563a41631d c6b194be816b98542602eef8fd6ef0b664d7f1e0',
}
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const runResult = (command, args, options = {}) => spawnSync(command, args, { cwd: options.cwd ?? root, encoding: options.binary ? undefined : 'utf8', maxBuffer: 512_000_000, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } })
const run = (command, args, options = {}) => { const result = runResult(command, args, options); if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}\n${result.stdout ?? ''}${result.stderr ?? ''}`); return result.stdout }
const git = (...args) => String(run('git', args)).trim()
const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)])
const digestRefs = () => sha256(Buffer.from(git('for-each-ref', '--format=%(refname) %(objectname)').split('\n').sort().join('\n') + '\n'))

const commit = git('rev-parse', 'HEAD'), tree = git('rev-parse', 'HEAD^{tree}')
const parents = git('rev-list', '--parents', '-n', '1', 'HEAD').split(/\s+/).slice(1)
if (parents.length !== 1 || parents[0] !== parent) throw new Error('Candidate is not one direct non-merge child of the reviewed R1 commit')
if (git('rev-parse', `${parent}^{tree}`) !== parentTree) throw new Error('Reviewed R1 parent tree mismatch')
if (runResult('git', ['symbolic-ref', '-q', 'HEAD']).status !== 1) throw new Error('Candidate HEAD is not detached')
if (git('status', '--short', '--untracked-files=no')) throw new Error('Tracked worktree is not clean')
if (digestRefs() !== refsDigest) throw new Error('Protected refs changed')
if (sha256(Buffer.from(run('git', ['stash', 'list', '--format=%gd %H %gs']))) !== stashDigest) throw new Error('Protected stash changed')

const qualification = JSON.parse(readFileSync(join(root, 'docs/review/s16-r2/QUALIFICATION.json'), 'utf8'))
const mutations = JSON.parse(readFileSync(join(root, 'review/s16-r2/MUTATIONS/MUTATION_RESULTS.json'), 'utf8'))
const retention = JSON.parse(readFileSync(join(root, 'docs/review/s16-r2/SOURCE_RETENTION_RECEIPT.json'), 'utf8'))
if (!qualification.status.startsWith('PASS') || qualification.currentProductionUnit.testsPassed !== 375 || qualification.currentProductionBrowser.testsPassed !== 92) throw new Error('Qualification receipt is incomplete')
if (mutations.semanticKills !== mutations.total || mutations.invalidOrSurvived !== 0) throw new Error('Semantic mutation qualification is incomplete')
if (retention.runtime.searchableRecords !== 98 || retention.origins.length !== 15 || !retention.runtime.runtimeDigestMatch) throw new Error('Source-retention receipt is incomplete')

const scratch = mkdtempSync(join(tmpdir(), 'trace-escape-s16-r2-return.'))
const stage = join(scratch, name)
const put = (path, value) => { const target = join(stage, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, value) }
try {
  mkdirSync(stage)
  cpSync(join(root, 'review/s16-r2'), join(stage, 'EVIDENCE'), { recursive: true })
  cpSync(join(root, 'docs/review/s16-r2'), join(stage, 'REVIEW'), { recursive: true })
  put('START_HERE.md', `# TRACE//ESCAPE S16-R2 return\n\nStatus: **S16_R2_COMPLETE_PENDING_MAIN_REVIEW**. Run \`python3 VERIFY_S16_R2_RETURN.py\` from this extracted directory.\n\nThis is one direct child of the reviewed R1 commit. S17 was not started, Principal Playtest 2 was not authorized, and nothing was published or promoted. Port 4174 remained untouched; task-owned ports 4175 and 4176 were stopped. Audio rights, subjective listening, private source originals, Principal visual acceptance and the separately reported room issues remain open.\n`)
  put('ORIGINAL_TRANSMISSION.json', `${JSON.stringify({ ...original, startHereReadFirst: true, readOrderCompleted: true, s17Started: false, principalPlaytest2Authorized: false, published: false }, null, 2)}\n`)
  const changed = git('diff-tree', '--no-commit-id', '--name-status', '-r', 'HEAD').split('\n').filter(Boolean)
  put('CHANGED_PATHS.txt', `${changed.join('\n')}\n`)
  put('RECOVERY.md', `# Recovery\n\nClone \`GIT/s16-r2-complete.bundle\`, or apply \`GIT/s16-r2-full-index-binary.patch\` with \`--index\` at exact parent \`${parent}\` and verify resulting tree \`${tree}\`. No protected ref or stash was changed.\n`)
  mkdirSync(join(stage, 'GIT'), { recursive: true })
  run('git', ['bundle', 'create', join(stage, 'GIT/s16-r2-complete.bundle'), 'HEAD'])
  put('GIT/s16-r2-full-index-binary.patch', run('git', ['diff', '--binary', '--full-index', parent, 'HEAD'], { binary: true }))
  const summary = {
    schema: 'trace-escape.s16-r2.return-summary.v1', status: 'S16_R2_COMPLETE_PENDING_MAIN_REVIEW', commit, tree, parent, parentTree,
    soleParent: true, detachedHead: true, trackedState: 'CLEAN', changedPathCount: changed.length,
    bundle: 'GIT/s16-r2-complete.bundle', patch: 'GIT/s16-r2-full-index-binary.patch',
    qualification: { unitPassed: 375, unitSkipped: 1, browserPassed: 92, semanticMutations: '8/8' },
    sourceRetention: { origins: 15, records: 98, originalPairsRecovered: 0, acceptedNormalizationVerified: true },
    protectedState: { refsDigest, stashDigest, port4174: 'UNTOUCHED', taskPortsClosed: [4175, 4176] },
    gates: { s17Started: false, principalPlaytest2Authorized: false, published: false, publicReleaseReady: false },
  }
  put('RETURN_SUMMARY.json', `${JSON.stringify(summary, null, 2)}\n`)

  const manifestFiles = files(stage).sort().map(path => ({ path: relative(stage, path), sha256: sha256(readFileSync(path)), bytes: statSync(path).size }))
  put('MANIFEST.sha256', `${manifestFiles.map(item => `${item.sha256}  ${item.path}`).join('\n')}\n`)
  const manifestSha256 = sha256(readFileSync(join(stage, 'MANIFEST.sha256')))
  put('VERIFY_S16_R2_RETURN.py', `#!/usr/bin/env python3
import hashlib,json,pathlib,shutil,subprocess,tempfile
root=pathlib.Path(__file__).resolve().parent
manifest=root/'MANIFEST.sha256'
if hashlib.sha256(manifest.read_bytes()).hexdigest()!='${manifestSha256}': raise SystemExit('FAIL_MANIFEST_IDENTITY')
listed={}
for row in manifest.read_text().splitlines():
 h,p=row.split('  ',1);q=pathlib.PurePosixPath(p)
 if p in listed or q.is_absolute() or '..' in q.parts or '\\\\' in p: raise SystemExit('FAIL_UNSAFE_OR_DUPLICATE_MEMBER '+p)
 listed[p]=h
actual=set()
for p in root.rglob('*'):
 if p.is_symlink(): raise SystemExit('FAIL_SYMLINK '+str(p))
 if p.is_file(): actual.add(p.relative_to(root).as_posix())
if actual != set(listed)|{'MANIFEST.sha256','VERIFY_S16_R2_RETURN.py'}: raise SystemExit('FAIL_MEMBER_SET')
for p,h in listed.items():
 if hashlib.sha256((root/p).read_bytes()).hexdigest()!=h: raise SystemExit('FAIL_HASH '+p)
s=json.loads((root/'RETURN_SUMMARY.json').read_text())
if s['status']!='S16_R2_COMPLETE_PENDING_MAIN_REVIEW' or s['commit']!='${commit}' or s['tree']!='${tree}' or s['parent']!='${parent}': raise SystemExit('FAIL_SUMMARY')
q=json.loads((root/'REVIEW/QUALIFICATION.json').read_text());m=json.loads((root/'EVIDENCE/MUTATIONS/MUTATION_RESULTS.json').read_text());r=json.loads((root/'REVIEW/SOURCE_RETENTION_RECEIPT.json').read_text())
if q['currentProductionUnit']['testsPassed']!=375 or q['currentProductionBrowser']['testsPassed']!=92: raise SystemExit('FAIL_QUALIFICATION')
if m['semanticKills']!=m['total'] or m['invalidOrSurvived']!=0: raise SystemExit('FAIL_MUTATIONS')
if r['runtime']['searchableRecords']!=98 or len(r['origins'])!=15 or not r['runtime']['runtimeDigestMatch']: raise SystemExit('FAIL_RETENTION')
tmp=pathlib.Path(tempfile.mkdtemp(prefix='s16-r2-verify-'))
try:
 bare=tmp/'verify.git';subprocess.run(['git','init','--bare','-q',str(bare)],check=True)
 subprocess.run(['git','-C',str(bare),'bundle','verify',str(root/'GIT/s16-r2-complete.bundle')],check=True,stdout=subprocess.DEVNULL)
 clone=tmp/'clone';subprocess.run(['git','clone','-q',str(root/'GIT/s16-r2-complete.bundle'),str(clone)],check=True)
 def g(*args): return subprocess.check_output(['git','-C',str(clone),*args],text=True).strip()
 if g('rev-parse','HEAD')!='${commit}' or g('rev-parse','HEAD^{tree}')!='${tree}' or g('rev-parse','HEAD^')!='${parent}' or g('rev-parse','${parent}^{tree}')!='${parentTree}' or len(g('rev-list','--parents','-n','1','HEAD').split())!=2: raise SystemExit('FAIL_GIT_IDENTITY')
 subprocess.run(['git','-C',str(clone),'fsck','--full','--strict'],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['git','-C',str(clone),'checkout','-q','${parent}'],check=True)
 subprocess.run(['git','-C',str(clone),'apply','--index','--binary',str(root/'GIT/s16-r2-full-index-binary.patch')],check=True)
 if g('write-tree')!='${tree}': raise SystemExit('FAIL_PATCH_TREE')
finally: shutil.rmtree(tmp)
print('PASS_S16_R2_RETURN',len(actual),'${commit}','${tree}','${parent}')
`)

  rmSync(output, { force: true })
  const zip = runResult('zip', ['-X', '-q', '-r', output, name], { cwd: scratch })
  if (zip.status !== 0) throw new Error(zip.stderr)
  const members = Number(run('python3', ['-c', "import sys,zipfile,pathlib;z=zipfile.ZipFile(sys.argv[1]);n=z.namelist();assert len(n)==len(set(n));assert all(not pathlib.PurePosixPath(x).is_absolute() and '..' not in pathlib.PurePosixPath(x).parts and '\\\\' not in x for x in n);print(len(n))", output]).trim())
  const extracted = join(scratch, 'fresh'); mkdirSync(extracted)
  run('unzip', ['-q', output, '-d', extracted])
  const verification = run('python3', [join(extracted, name, 'VERIFY_S16_R2_RETURN.py')], extracted).trim()
  console.log(JSON.stringify({ status: 'PASS', output, sha256: sha256(readFileSync(output)), bytes: statSync(output).size, members, commit, tree, parent, changedPaths: changed.length, verification }))
} finally { rmSync(scratch, { recursive: true, force: true }) }
