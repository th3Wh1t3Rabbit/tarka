import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '../..')
const parent = '34a9406014cc5d14e6201840e9bf2ef187bf9a59'
const parentTree = 'dc25c14fb0e7b8c65e680c992b5beff532b5a637'
const refsDigest = '1258272628289f456aa15f02e77d5fa929c7d4a7ffdbac6aa3164e94044f1105'
const stashDigest = '1e8577a8511e35ea3b28d51151688469bed6d5be5194ecad2620a1f969dcfffa'
const name = 'TRACE_ESCAPE_CODEX_TO_MAIN_S16_R3_PERSISTENCE_AUDIO_LIFECYCLE_AND_RECORD_ACTION_CLOSEOUT_v1.0.0_2026-09-26'
const output = `/path/to/local-user/Downloads/${name}.zip`
const authority = '/tmp/trace-escape-s16-r3.fEwvZC'
const original = {
  filename: 'TRACE_ESCAPE_MAIN_TO_CODEX_S16_R3_PERSISTENCE_AUDIO_LIFECYCLE_AND_RECORD_ACTION_CLOSEOUT_v1.0.0_2026-09-26.zip',
  sha256: 'a1d0c45288260b2a0fefbac11d627a5b864f4dde4d813e84bb863f900fc60b70',
  bytes: 83068,
  regularFiles: 29,
  standaloneVerification: 'PASS_S16_R3_TRANSMISSION 28',
  repoAdmission: 'PASS_S16_R3_EXACT_BASE_ADMISSION 34a9406014cc5d14e6201840e9bf2ef187bf9a59 dc25c14fb0e7b8c65e680c992b5beff532b5a637',
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const runResult = (command, args, options = {}) => spawnSync(command, args, { cwd: options.cwd ?? root, encoding: options.binary ? undefined : 'utf8', maxBuffer: 512_000_000, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } })
const run = (command, args, options = {}) => { const result = runResult(command, args, options); if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}\n${result.stdout ?? ''}${result.stderr ?? ''}`); return result.stdout }
const git = (...args) => String(run('git', args)).trim()
const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)])
const digestRefs = () => sha256(Buffer.from(git('for-each-ref', '--format=%(refname) %(objectname)').split('\n').sort().join('\n') + '\n'))

const commit = git('rev-parse', 'HEAD')
const tree = git('rev-parse', 'HEAD^{tree}')
const parents = git('rev-list', '--parents', '-n', '1', 'HEAD').split(/\s+/).slice(1)
if (parents.length !== 1 || parents[0] !== parent) throw new Error('Candidate is not one direct non-merge child of the reviewed R2 commit')
if (git('rev-parse', `${parent}^{tree}`) !== parentTree) throw new Error('Reviewed R2 parent tree mismatch')
if (runResult('git', ['symbolic-ref', '-q', 'HEAD']).status !== 1) throw new Error('Candidate HEAD is not detached')
if (git('status', '--short', '--untracked-files=no')) throw new Error('Tracked worktree is not clean')
if (digestRefs() !== refsDigest) throw new Error('Protected refs changed')
if (sha256(Buffer.from(run('git', ['stash', 'list', '--format=%gd %H %gs']))) !== stashDigest) throw new Error('Protected stash changed')

const qualification = JSON.parse(readFileSync(join(root, 'docs/review/s16-r3/QUALIFICATION.json'), 'utf8'))
const mutations = JSON.parse(readFileSync(join(root, 'review/s16-r3/MUTATIONS/MUTATION_RESULTS.json'), 'utf8'))
const audio = JSON.parse(readFileSync(join(root, 'review/s16-r3/audio/actual-loop-media.json'), 'utf8'))
const semantic = JSON.parse(readFileSync(join(root, 'review/s16-r3/PROBES/candidate/independent-semantic.json'), 'utf8'))
if (qualification.status !== 'PASS' || qualification.currentProductionUnit.testsPassed !== 383 || qualification.currentProductionUnit.testsSkipped !== 1 || qualification.currentProductionBrowser.testsPassed !== 94) throw new Error('Qualification receipt is incomplete')
if (mutations.total !== 11 || mutations.semanticKills !== 11 || mutations.invalidOrSurvived !== 0 || mutations.results.some(item => !item.intendedAssertionObserved || !item.originalBytesRestored)) throw new Error('Semantic mutation qualification is incomplete')
if (audio.evidenceClass !== 'ACTUAL_BROWSER_MEDIAELEMENT_WEBAUDIO_OUTPUT_CAPTURE' || audio.wrapsObserved !== 2 || audio.captures.length !== 2 || audio.maximumSimultaneousEffectVoices > 1 || audio.automaticVisualActivations !== 0 || !audio.sourceHashesUnchangedAfterCapture) throw new Error('Actual loop-media evidence is incomplete')
if (semantic.longHistory.runs !== 212 || semantic.nativeTwoReloads.complete !== true || semantic.supportingAdd.added !== true || semantic.v2.validPartial.secondReload.assembly.AMOUNT !== 'EXACT_CONVERGENCE' || semantic.v2.postdatedImport.secondReload.access !== false || semantic.forgedV4.access !== false) throw new Error('Independent semantic probe receipt is incomplete')

const scratch = mkdtempSync(join(tmpdir(), 'trace-escape-s16-r3-return.'))
const stage = join(scratch, name)
const put = (path, value) => { const target = join(stage, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, value) }
try {
  mkdirSync(stage)
  cpSync(join(root, 'review/s16-r3'), join(stage, 'EVIDENCE'), { recursive: true })
  cpSync(join(root, 'docs/review/s16-r3'), join(stage, 'REVIEW'), { recursive: true })
  cpSync(join(authority, 'RESERVED'), join(stage, 'RESERVED'), { recursive: true })
  put('START_HERE.md', `# TRACE//ESCAPE S16-R3 return\n\nStatus: **S16_R3_COMPLETE_PENDING_MAIN_REVIEW**. Run \`python3 VERIFY_S16_R3_RETURN.py\` from this extracted directory.\n\nThis is one direct child of reviewed R2 commit \`${parent}\`. The persistence, pending-audio lifecycle and record-action/layout corrections are complete, and two actual browser-output loop wraps are retained as bounded technical evidence. Subjective listening, device-specific acoustic latency, rights, Principal acceptance, Playtest 2 and public release remain separate gates.\n\nAll ten reserved S17 room/script/pacing items—including the Principal's five directly reported room defects and conditional Skip Intro—are retained, not implemented. S17 was not started, no protected ref was promoted, nothing was published, and port 4174 remained untouched.\n`)
  put('ORIGINAL_TRANSMISSION.json', `${JSON.stringify({ ...original, startHereReadFirst: true, readOrderCompleted: true, s17Started: false, principalPlaytest2Authorized: false, protectedRefsPromoted: false, published: false }, null, 2)}\n`)
  const changed = git('diff-tree', '--no-commit-id', '--name-status', '-r', 'HEAD').split('\n').filter(Boolean)
  put('CHANGED_PATHS.txt', `${changed.join('\n')}\n`)
  put('RECOVERY.md', `# Recovery\n\nClone \`GIT/s16-r3-complete.bundle\`, or apply \`GIT/s16-r3-full-index-binary.patch\` with \`--index\` at exact parent \`${parent}\` and verify resulting tree \`${tree}\`. No protected ref or stash was changed.\n`)
  mkdirSync(join(stage, 'GIT'), { recursive: true })
  run('git', ['bundle', 'create', join(stage, 'GIT/s16-r3-complete.bundle'), 'HEAD'])
  put('GIT/s16-r3-full-index-binary.patch', run('git', ['diff', '--binary', '--full-index', parent, 'HEAD'], { binary: true }))
  const summary = {
    schema: 'trace-escape.s16-r3.return-summary.v1',
    status: 'S16_R3_COMPLETE_PENDING_MAIN_REVIEW', commit, tree, parent, parentTree,
    soleParent: true, detachedHead: true, trackedState: 'CLEAN', changedPathCount: changed.length,
    bundle: 'GIT/s16-r3-complete.bundle', patch: 'GIT/s16-r3-full-index-binary.patch',
    qualification: { unitPassed: 383, unitSkipped: 1, browserPassed: 94, semanticMutations: '11/11' },
    persistence: { oracle: 'exact cdafe847 original-v2 reducer', longHistoryRuns: 212, twoReloadContinuedPlay: true },
    audio: { evidenceClass: audio.evidenceClass, actualWraps: 2, boundedCaptures: 2, subjectiveListening: 'NOT_PERFORMED', deviceLatency: 'NOT_CLAIMED' },
    principalHandoff: { reportedRoomIssuesRetained: 5, completeS17ReservationRetained: 10, skipIntro: 'CONDITIONAL_RESERVED_NOT_IMPLEMENTED' },
    protectedState: { refsDigest, stashDigest, port4174: 'UNTOUCHED', taskPortsClosed: [4175, 4176] },
    gates: { s17Started: false, principalPlaytest2Authorized: false, protectedRefsPromoted: false, published: false, publicReleaseReady: false },
  }
  put('RETURN_SUMMARY.json', `${JSON.stringify(summary, null, 2)}\n`)

  const manifestFiles = files(stage).sort().map(path => ({ path: relative(stage, path), sha256: sha256(readFileSync(path)), bytes: statSync(path).size }))
  put('MANIFEST.sha256', `${manifestFiles.map(item => `${item.sha256}  ${item.path}`).join('\n')}\n`)
  const manifestSha256 = sha256(readFileSync(join(stage, 'MANIFEST.sha256')))
  put('VERIFY_S16_R3_RETURN.py', `#!/usr/bin/env python3
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
if actual != set(listed)|{'MANIFEST.sha256','VERIFY_S16_R3_RETURN.py'}: raise SystemExit('FAIL_MEMBER_SET')
for p,h in listed.items():
 if hashlib.sha256((root/p).read_bytes()).hexdigest()!=h: raise SystemExit('FAIL_HASH '+p)
s=json.loads((root/'RETURN_SUMMARY.json').read_text())
if s['status']!='S16_R3_COMPLETE_PENDING_MAIN_REVIEW' or s['commit']!='${commit}' or s['tree']!='${tree}' or s['parent']!='${parent}': raise SystemExit('FAIL_SUMMARY')
q=json.loads((root/'REVIEW/QUALIFICATION.json').read_text());m=json.loads((root/'EVIDENCE/MUTATIONS/MUTATION_RESULTS.json').read_text());a=json.loads((root/'EVIDENCE/audio/actual-loop-media.json').read_text());p=json.loads((root/'EVIDENCE/PROBES/candidate/independent-semantic.json').read_text())
if q['currentProductionUnit']['testsPassed']!=383 or q['currentProductionUnit']['testsSkipped']!=1 or q['currentProductionBrowser']['testsPassed']!=94: raise SystemExit('FAIL_QUALIFICATION')
if m['semanticKills']!=11 or m['total']!=11 or m['invalidOrSurvived']!=0 or any(not x['intendedAssertionObserved'] or not x['originalBytesRestored'] for x in m['results']): raise SystemExit('FAIL_MUTATIONS')
if a['evidenceClass']!='ACTUAL_BROWSER_MEDIAELEMENT_WEBAUDIO_OUTPUT_CAPTURE' or a['wrapsObserved']!=2 or len(a['captures'])!=2 or a['maximumSimultaneousEffectVoices']>1 or a['automaticVisualActivations']!=0 or not a['sourceHashesUnchangedAfterCapture']: raise SystemExit('FAIL_ACTUAL_MEDIA')
if p['longHistory']['runs']!=212 or not p['nativeTwoReloads']['complete'] or not p['supportingAdd']['added'] or p['v2']['validPartial']['secondReload']['assembly'].get('AMOUNT')!='EXACT_CONVERGENCE' or p['v2']['postdatedImport']['secondReload']['access'] or p['forgedV4']['access']: raise SystemExit('FAIL_PROBES')
if len(list((root/'RESERVED').glob('*'))) != 3: raise SystemExit('FAIL_RESERVED_AUTHORITY')
tmp=pathlib.Path(tempfile.mkdtemp(prefix='s16-r3-verify-'))
try:
 bare=tmp/'verify.git';subprocess.run(['git','init','--bare','-q',str(bare)],check=True)
 subprocess.run(['git','-C',str(bare),'bundle','verify',str(root/'GIT/s16-r3-complete.bundle')],check=True,stdout=subprocess.DEVNULL)
 clone=tmp/'clone';subprocess.run(['git','clone','-q',str(root/'GIT/s16-r3-complete.bundle'),str(clone)],check=True)
 def g(*args): return subprocess.check_output(['git','-C',str(clone),*args],text=True).strip()
 if g('rev-parse','HEAD')!='${commit}' or g('rev-parse','HEAD^{tree}')!='${tree}' or g('rev-parse','HEAD^')!='${parent}' or g('rev-parse','${parent}^{tree}')!='${parentTree}' or len(g('rev-list','--parents','-n','1','HEAD').split())!=2: raise SystemExit('FAIL_GIT_IDENTITY')
 subprocess.run(['git','-C',str(clone),'fsck','--full','--strict'],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['git','-C',str(clone),'checkout','-q','${parent}'],check=True)
 subprocess.run(['git','-C',str(clone),'apply','--index','--binary',str(root/'GIT/s16-r3-full-index-binary.patch')],check=True)
 if g('write-tree')!='${tree}': raise SystemExit('FAIL_PATCH_TREE')
finally: shutil.rmtree(tmp)
print('PASS_S16_R3_RETURN',len(actual),'${commit}','${tree}','${parent}')
`)

  rmSync(output, { force: true })
  const zip = runResult('zip', ['-X', '-q', '-r', output, name], { cwd: scratch })
  if (zip.status !== 0) throw new Error(zip.stderr)
  const members = Number(run('python3', ['-c', "import sys,zipfile,pathlib;z=zipfile.ZipFile(sys.argv[1]);n=z.namelist();assert len(n)==len(set(n));assert all(not pathlib.PurePosixPath(x).is_absolute() and '..' not in pathlib.PurePosixPath(x).parts and '\\\\' not in x for x in n);print(len(n))", output]).trim())
  const extracted = join(scratch, 'fresh')
  mkdirSync(extracted)
  run('unzip', ['-q', output, '-d', extracted])
  const verification = run('python3', [join(extracted, name, 'VERIFY_S16_R3_RETURN.py')], extracted).trim()
  console.log(JSON.stringify({ status: 'PASS', output, sha256: sha256(readFileSync(output)), bytes: statSync(output).size, members, commit, tree, parent, changedPaths: changed.length, verification }))
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
