#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repository = new URL('..', import.meta.url)
const logDirectory = new URL('../artifacts/g5/verification/', import.meta.url)
mkdirSync(logDirectory, { recursive: true })

const commands = [
  { label: 'typecheck/lint', command: 'npm', args: ['run', 'check'] },
  { label: 'unit/domain/acquisition tests', command: 'npm', args: ['run', 'test'] },
  { label: 'deterministic Hero pack generation', command: 'npm', args: ['run', 'g5:pack'] },
  { label: 'Hero pack verification', command: 'npm', args: ['run', 'g5:pack:verify'] },
  { label: 'generic implementation boundary', command: 'npm', args: ['run', 'g5:boundary:verify'] },
  { label: 'fixture acquisition no-network proof', command: 'npm', args: ['run', 'acquisition:prove-no-network'] },
  { label: 'production build', command: 'npm', args: ['run', 'build'] },
  { label: 'browser/acquisition separation', command: 'npm', args: ['run', 'browser-boundary:verify'] },
  { label: 'normal/reduced/click/keyboard/persona browser journeys', command: 'npm', args: ['run', 'test:e2e'] },
  { label: 'Hero and synthetic artifact capture', command: 'node', args: ['scripts/capture-g5-final-artifacts.mjs'] },
  { label: 'repository secret scan', command: 'npm', args: ['run', 'secret:scan'] },
  { label: 'Git-history secret scan', command: 'npm', args: ['run', 'secret:scan-history'] },
  { label: 'project clock', command: 'npm', args: ['run', 'project:clock'] },
  { label: 'project status', command: 'npm', args: ['run', 'project:status'] },
]

const startedAtUtc = new Date().toISOString()
const candidateCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim()
const candidateTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: repository, encoding: 'utf8' }).trim()
const results = []
let failed = false
const repositoryPath = fileURLToPath(repository).replace(/[\\/]$/, '')
const sanitizeOutput = (value) => value.split(repositoryPath).join('<REPOSITORY>')
for (const item of commands) {
  const result = spawnSync(item.command, item.args, { cwd: repository, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' } })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  process.stdout.write(`\n=== ${item.label} ===\n${output}`)
  results.push({ label: item.label, exitCode: result.status ?? 1, output: sanitizeOutput(output) })
  if (result.status !== 0) {
    failed = true
    break
  }
}
const report = { schemaVersion: '1.0.0', gate: 'G5', candidateCommit, candidateTree, startedAtUtc, completedAtUtc: new Date().toISOString(), result: failed ? 'FAILED' : 'PASSED', commands: results }
writeFileSync(new URL('FINAL_VERIFICATION.json', logDirectory), `${JSON.stringify(report, null, 2)}\n`)
if (failed) process.exitCode = 1
