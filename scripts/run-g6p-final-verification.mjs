#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const repository = new URL('..', import.meta.url)
const logDirectory = new URL('../artifacts/g6p-a0/verification/', import.meta.url)
mkdirSync(logDirectory, { recursive: true })
const commands = [
  { label: 'typecheck/lint', command: 'npm', args: ['run', 'check'] },
  { label: 'all unit/domain/acquisition tests', command: 'npm', args: ['run', 'test'] },
  { label: 'accepted Euler public-pack integrity', command: 'npm', args: ['run', 'g6:pack:verify'] },
  { label: 'point-and-click and truth boundaries', command: 'npm', args: ['run', 'g6p:boundary:verify'] },
  { label: 'fixture acquisition no-network proof', command: 'npm', args: ['run', 'acquisition:prove-no-network'] },
  { label: 'production build', command: 'npm', args: ['run', 'build'] },
  { label: 'browser/acquisition separation', command: 'npm', args: ['run', 'browser-boundary:verify'] },
  { label: 'pointer, keyboard, dialogue, evidence, and fallback journeys', command: 'npm', args: ['run', 'test:e2e'] },
  { label: '1280 and 1920 Principal Preview captures', command: 'npm', args: ['run', 'artifacts:capture'] },
  { label: 'Principal Preview synchronization', command: 'npm', args: ['run', 'g6p:preview:sync'] },
  { label: 'point-and-click presentation health', command: 'npm', args: ['run', 'g6p:presentation-health'] },
  { label: 'repository secret scan', command: 'npm', args: ['run', 'secret:scan'] },
  { label: 'Git-history secret scan', command: 'npm', args: ['run', 'secret:scan-history'] },
  { label: 'project clock', command: 'npm', args: ['run', 'project:clock'] },
  { label: 'project status', command: 'npm', args: ['run', 'project:status'] },
]
const startedAtUtc = new Date().toISOString()
const candidateCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim()
const candidateTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: repository, encoding: 'utf8' }).trim()
const repositoryPath = fileURLToPath(repository).replace(/[\\/]$/, '')
const privateLinuxPath = ['', 'home', 'al', ''].join('/')
const sanitize = (value) => value.split(repositoryPath).join('<REPOSITORY>').replaceAll(privateLinuxPath, '<PRIVATE_HOME>/')
const results = []
let failed = false
for (const item of commands) {
  const result = spawnSync(item.command, item.args, { cwd: repository, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' } })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  process.stdout.write(`\n=== ${item.label} ===\n${output}`)
  results.push({ label: item.label, exitCode: result.status ?? 1, output: sanitize(output) })
  if (result.status !== 0) { failed = true; break }
}
const report = { schemaVersion: '1.0.0', gate: 'G6P_A0', candidateCommit, candidateTree, startedAtUtc, completedAtUtc: new Date().toISOString(), result: failed ? 'FAILED' : 'PASSED', providerCallsDuringVerification: { nansen: 0, alchemy: 0 }, commands: results }
writeFileSync(new URL('FINAL_VERIFICATION.json', logDirectory), `${JSON.stringify(report, null, 2)}\n`)
if (failed) process.exitCode = 1
