import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const base = '1dc996dc536ffffc500f0adba8283de19a520538'
const run = (cmd, args, cwd = root) => {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`)
  return result.stdout.trim()
}
const candidate = run('git', ['rev-parse', 'HEAD'])
const tree = run('git', ['rev-parse', 'HEAD^{tree}'])
const parent = run('git', ['rev-parse', 'HEAD^'])
if (parent !== base) throw new Error(`candidate parent ${parent} is not required base ${base}`)
if (run('git', ['rev-list', '--parents', '-n', '1', 'HEAD']).split(/\s+/).length !== 2) throw new Error('candidate is not a direct non-merge child')
const symbolic = spawnSync('git', ['symbolic-ref', '-q', 'HEAD'], { cwd: root, encoding: 'utf8' })
if (symbolic.status === 0 || symbolic.status !== 1) throw new Error('HEAD is not detached or detached-state check failed')

const scratch = mkdtempSync(join(tmpdir(), 's15-r4-return-'))
const name = `TRACE_ESCAPE_MAIN_TO_CURSOR_S15_R4_RETURN_${candidate.slice(0, 12)}`
const pack = join(scratch, name)
mkdirSync(pack, { recursive: true })
cpSync(resolve('review/s15-r4'), join(pack, 'EVIDENCE'), { recursive: true })
mkdirSync(join(pack, 'FONT'), { recursive: true })
cpSync(resolve('public/fonts/Probly8.woff2'), join(pack, 'FONT/Probly8.woff2'))
cpSync(resolve('public/fonts/Probly8_License.txt'), join(pack, 'FONT/Probly8_License.txt'))
mkdirSync(join(pack, 'GIT'), { recursive: true })
run('git', ['bundle', 'create', join(pack, 'GIT/CANDIDATE.bundle'), 'HEAD'])
writeFileSync(join(pack, 'GIT/FULL_INDEX_BINARY.patch'), run('git', ['diff', '--binary', '--full-index', base, candidate]) + '\n')
writeFileSync(join(pack, 'GIT/CHANGED_PATHS.txt'), run('git', ['diff', '--name-only', base, candidate]) + '\n')

const posture = {
  candidate, tree, parent,
  detachedHead: true,
  directNonMergeChild: true,
  protectedRefs: {
    main: run('git', ['rev-parse', 'refs/heads/main']),
    g6pA0PointClick: run('git', ['rev-parse', 'refs/heads/g6p-a0-point-click']),
    stash: run('git', ['rev-parse', 'refs/stash']),
  },
  userAuthorizedAlternatePort: 4176,
  existingPortsPreserved: [4174, 4175],
  reviewStatus: 'PENDING_CHATGPT_MAIN_LEAD_REVIEW',
  s16: 'READ_ONLY_READY_NOT_STARTED',
  principalPlaytest2: 'NOT_AUTHORIZED',
}
writeFileSync(join(pack, 'PRE_POSTFLIGHT.json'), JSON.stringify(posture, null, 2) + '\n')
writeFileSync(join(pack, 'START_HERE.md'), `# S15-R4 MAIN review return\n\nCandidate: \`${candidate}\`  \nTree: \`${tree}\`  \nParent: \`${parent}\`\n\nThis is one detached, direct, non-merge child of the required S15-R3 parent. Start with \`EVIDENCE/PRINCIPAL_FEEDBACK_2_MATRIX.md\`, then inspect the script export, mutation receipts, screenshots, raw logs, font pending receipt, Bugbot unavailability receipt, and terminal-audit preservation receipt.\n\nThe user explicitly authorized continuing on a different local port; qualification used 4176 while the existing 4174 and 4175 servers were preserved. Probly8 was acquired under SIL OFL 1.1 but lacks six required glyphs, so production truthfully retains its local monospace fallback and reports \`FONT_ASSET_PENDING\`.\n\nREVIEW_STATUS=PENDING_CHATGPT_MAIN_LEAD_REVIEW\nS16_READ_ONLY_READY_NOT_STARTED\nPRINCIPAL_PLAYTEST_2_NOT_AUTHORIZED\n`)
writeFileSync(join(pack, 'VERIFY.py'), `#!/usr/bin/env python3\nfrom hashlib import sha256\nfrom pathlib import Path\nimport subprocess, tempfile\nroot=Path(__file__).resolve().parent\nerrors=[]\nfor line in (root/'MANIFEST.sha256').read_text().splitlines():\n    digest, rel=line.split('  ',1)\n    path=root/rel\n    if not path.is_file(): errors.append('missing '+rel); continue\n    if sha256(path.read_bytes()).hexdigest()!=digest: errors.append('hash '+rel)\nwith tempfile.TemporaryDirectory() as td:\n    subprocess.run(['git','init','-q',td],check=True)\n    check=subprocess.run(['git','-C',td,'bundle','verify',str(root/'GIT/CANDIDATE.bundle')],capture_output=True,text=True)\n    if check.returncode: errors.append('bundle '+check.stderr.strip())\nif errors:\n    print('FAIL'); print('\\n'.join(errors)); raise SystemExit(1)\nprint('PASS S15-R4 return manifest and Git bundle')\n`)

const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const path = join(dir, entry.name)
  return entry.isDirectory() ? walk(path) : [path]
})
const files = walk(pack).filter(path => basename(path) !== 'MANIFEST.sha256').sort()
const manifest = files.map(path => `${createHash('sha256').update(readFileSync(path)).digest('hex')}  ${relative(pack, path)}`).join('\n') + '\n'
writeFileSync(join(pack, 'MANIFEST.sha256'), manifest)
run('python3', ['VERIFY.py'], pack)
const zipPath = `/path/to/local-user/Downloads/${name}.zip`
if (existsSync(zipPath)) unlinkSync(zipPath)
run('zip', ['-q', '-r', zipPath, name], scratch)
console.log(JSON.stringify({ zipPath, candidate, tree, parent, bytes: readFileSync(zipPath).length }))
rmSync(scratch, { recursive: true, force: true })
