import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)))
const manifest = readFileSync(join(root, 'MANIFEST.sha256'), 'utf8').trim().split('\n').filter(Boolean)
const failures = []
for (const line of manifest) {
  const match = line.match(/^([a-f0-9]{64})  (.+)$/)
  if (!match) { failures.push(`Malformed manifest line: ${line}`); continue }
  const path = join(root, match[2])
  if (!existsSync(path)) { failures.push(`Missing: ${match[2]}`); continue }
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex')
  if (actual !== match[1]) failures.push(`Hash mismatch: ${match[2]}`)
}
const summary = JSON.parse(readFileSync(join(root, 'RETURN_SUMMARY.json'), 'utf8'))
const bundle = join(root, summary.bundle)
const scratch = mkdtempSync(join(tmpdir(), 'trace-escape-s16-verify.'))
const run = (command, args, cwd = scratch) => spawnSync(command, args, { cwd, encoding: 'utf8' })
try {
  if (run('git', ['init', '-q']).status !== 0) failures.push('Unable to initialize verification repository')
  const verify = run('git', ['bundle', 'verify', bundle])
  if (verify.status !== 0) failures.push(`Bundle verification failed: ${verify.stderr}`)
  const fetch = run('git', ['fetch', '-q', bundle, 'HEAD'])
  if (fetch.status !== 0) failures.push(`Bundle fetch failed: ${fetch.stderr}`)
  const revision = run('git', ['rev-parse', 'FETCH_HEAD']).stdout.trim()
  const tree = run('git', ['rev-parse', 'FETCH_HEAD^{tree}']).stdout.trim()
  const parents = run('git', ['rev-list', '--parents', '-n1', 'FETCH_HEAD']).stdout.trim().split(/\s+/).slice(1)
  if (revision !== summary.commit) failures.push(`Commit mismatch: ${revision}`)
  if (tree !== summary.tree) failures.push(`Tree mismatch: ${tree}`)
  if (parents.length !== 1 || parents[0] !== summary.parent) failures.push(`Sole parent mismatch: ${parents.join(',')}`)
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
const readiness = JSON.parse(readFileSync(join(root, 'evidence/S17_READINESS.json'), 'utf8'))
if (readiness.status !== 'S17_READ_ONLY_READY_NOT_STARTED' || readiness.principalPlaytest2 !== 'PRINCIPAL_PLAYTEST_2_NOT_AUTHORIZED') failures.push('S17 readiness seal mismatch')
if (failures.length) throw new Error(failures.join('\n'))
console.log(JSON.stringify({ status: 'PASS', package: basename(root), files: manifest.length, commit: summary.commit, tree: summary.tree, parent: summary.parent }))
