import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '../..')
const parent = '6955ffcfb7c6aa04e7d2c56278997c343e69b1a2'
const output = '/path/to/local-user/Downloads/TRACE_ESCAPE_CURSOR_TO_MAIN_S16_GUIDED_NANSEN_TERMINAL_PRODUCTION_UX_AND_FLOW_BINDING_v1.0.0_2026-09-25.zip'
const authority = '/path/to/local-user/Downloads/TRACE_ESCAPE_MAIN_TO_CURSOR_S16_GUIDED_NANSEN_TERMINAL_PRODUCTION_UX_AND_FLOW_BINDING_v1.0.0_2026-09-25.zip'
const scratch = mkdtempSync(join(tmpdir(), 'trace-escape-s16-return.'))
const stage = join(scratch, 'TRACE_ESCAPE_CURSOR_TO_MAIN_S16')
const run = (command, args, cwd = root) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}\n${result.stderr}`)
  return result.stdout
}
const sha256 = value => createHash('sha256').update(value).digest('hex')
function filesUnder(directory) {
  const files = []
  const walk = current => {
    for (const entry of readdirSync(current).sort()) {
      const path = join(current, entry)
      if (statSync(path).isDirectory()) walk(path)
      else files.push(path)
    }
  }
  walk(directory)
  return files
}

try {
  mkdirSync(stage, { recursive: true })
  const commit = run('git', ['rev-parse', 'HEAD']).trim()
  const tree = run('git', ['rev-parse', 'HEAD^{tree}']).trim()
  const parents = run('git', ['rev-list', '--parents', '-n1', 'HEAD']).trim().split(/\s+/).slice(1)
  if (parents.length !== 1 || parents[0] !== parent) throw new Error(`Candidate is not the required direct child: ${parents.join(',')}`)
  const bundleName = 'TRACE_ESCAPE_S16_COMPLETE.bundle'
  const patchName = 'TRACE_ESCAPE_S16_FULL_INDEX.patch'
  run('git', ['bundle', 'create', join(stage, bundleName), 'HEAD'])
  writeFileSync(join(stage, patchName), run('git', ['diff', '--binary', '--full-index', parent, 'HEAD', '--']))
  cpSync(resolve(root, 'review/s16'), join(stage, 'evidence'), { recursive: true })
  mkdirSync(join(stage, 'authority'), { recursive: true })
  cpSync(authority, join(stage, 'authority', 'MAIN_TO_CURSOR.zip'))
  cpSync(resolve(root, 'scripts/s16/verify-return.mjs'), join(stage, 'VERIFY_RETURN.mjs'))
  writeFileSync(join(stage, 'CHANGED_PATHS.txt'), `${run('git', ['diff', '--name-only', parent, 'HEAD', '--']).trim()}\n`)
  const qualification = JSON.parse(readFileSync(resolve(root, 'review/s16/QUALIFICATION.json'), 'utf8'))
  const bugbot = JSON.parse(readFileSync(resolve(root, 'review/s16/BUGBOT_STATUS.json'), 'utf8'))
  const summary = {
    schemaVersion: 's16-return-summary.v1',
    taskId: 'S16_GUIDED_NANSEN_TERMINAL_PRODUCTION_UX_AND_FLOW_BINDING',
    status: 'PASS',
    commit,
    tree,
    parent,
    soleParent: true,
    bundle: bundleName,
    patch: patchName,
    qualification,
    bugbot: bugbot.status,
    reviewStatus: 'S16_COMPLETE_S17_READ_ONLY_READY_NOT_STARTED',
    principalPlaytest2: 'PRINCIPAL_PLAYTEST_2_NOT_AUTHORIZED',
  }
  writeFileSync(join(stage, 'RETURN_SUMMARY.json'), `${JSON.stringify(summary, null, 2)}\n`)
  const manifestFiles = filesUnder(stage).filter(path => !path.endsWith('MANIFEST.sha256'))
  writeFileSync(join(stage, 'MANIFEST.sha256'), `${manifestFiles.map(path => `${sha256(readFileSync(path))}  ${relative(stage, path)}`).join('\n')}\n`)
  rmSync(output, { force: true })
  run('zip', ['-X', '-q', '-r', output, '.'], stage)
  const verifyDir = join(scratch, 'verify')
  mkdirSync(verifyDir)
  run('unzip', ['-q', output, '-d', verifyDir])
  const verification = run('node', [join(verifyDir, 'VERIFY_RETURN.mjs')], verifyDir).trim()
  console.log(JSON.stringify({ status: 'PASS', output, sha256: sha256(readFileSync(output)), bytes: statSync(output).size, commit, tree, parent, verification }))
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
