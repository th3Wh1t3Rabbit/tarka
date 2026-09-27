#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const repository = new URL('..', import.meta.url)
const logDirectory = new URL('../artifacts/g6p-a1-r2/verification/', import.meta.url)
mkdirSync(logDirectory, { recursive: true })

const commands = [
  { label: 'R2 exact-byte fingerprint and retained R1 adversarial unit diagnostics', command: 'npx', args: ['vitest', 'run', 'tests/unit/art-pack-integrity.test.ts'] },
  { label: 'R2 duplicate-content, false-success, and 1280/1920 browser regressions', command: 'npx', args: ['playwright', 'test', 'tests/e2e/art-pack-integrity.spec.ts'] },
  { label: 'typecheck/lint', command: 'npm', args: ['run', 'check'] },
  { label: 'all unit/domain/acquisition tests', command: 'npm', args: ['run', 'test'] },
  { label: 'accepted Euler public-pack integrity', command: 'npm', args: ['run', 'g6:pack:verify'] },
  { label: 'A1-R2 content identity, art integrity, narrative, portability, and truth boundaries', command: 'npm', args: ['run', 'g6p:a1:boundary:verify'] },
  { label: 'fixture acquisition no-network proof', command: 'npm', args: ['run', 'acquisition:prove-no-network'] },
  { label: 'production build without legacy 3D output', command: 'npm', args: ['run', 'build'] },
  { label: 'browser/acquisition separation', command: 'npm', args: ['run', 'browser-boundary:verify'] },
  { label: 'pointer, keyboard, opening, animation, puzzle, evidence, and Art Lab journeys', command: 'npm', args: ['run', 'test:e2e'] },
  { label: '1280 and 1920 Principal Preview captures', command: 'npm', args: ['run', 'artifacts:capture'] },
  { label: 'Principal Preview synchronization', command: 'npm', args: ['run', 'g6p:preview:sync'] },
  { label: 'A1-R2 presentation health, duplicate-content rejection, fingerprints, overlap, and font floor', command: 'npm', args: ['run', 'g6p:presentation-health'] },
  { label: 'repository secret scan', command: 'npm', args: ['run', 'secret:scan'] },
  { label: 'Git-history secret scan', command: 'npm', args: ['run', 'secret:scan-history'] },
  { label: 'project clock', command: 'npm', args: ['run', 'project:clock'] },
  { label: 'project status', command: 'npm', args: ['run', 'project:status'] },
]

const startedAtUtc = new Date().toISOString()
const dirty = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=normal'], { cwd: repository, encoding: 'utf8' }).trim()
if (dirty !== '') {
  process.stderr.write(`Refusing to verify a dirty repository:\n${dirty}\n`)
  process.exit(1)
}
const candidateCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim()
const candidateTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: repository, encoding: 'utf8' }).trim()
const repositoryPath = fileURLToPath(repository).replace(/[\\/]$/, '')
const privateLinuxPath = ['', 'home', 'al', ''].join('/')
const sanitize = (value) => value.split(repositoryPath).join('<REPOSITORY>').replaceAll(privateLinuxPath, '<PRIVATE_HOME>/')
const results = []
let failed = false

for (const item of commands) {
  const result = spawnSync(item.command, item.args, {
    cwd: repository,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  process.stdout.write(`\n=== ${item.label} ===\n${output}`)
  results.push({ label: item.label, exitCode: result.status ?? 1, output: sanitize(output) })
  if (result.status !== 0) {
    failed = true
    break
  }
}

const report = {
  schemaVersion: '1.0.0',
  gate: 'G6P_A1_R2',
  candidateCommit,
  candidateTree,
  startedAtUtc,
  completedAtUtc: new Date().toISOString(),
  result: failed ? 'FAILED' : 'PASSED',
  providerCallsDuringVerification: { nansen: 0, alchemy: 0 },
  commands: results,
}

writeFileSync(new URL('FINAL_VERIFICATION.json', logDirectory), `${JSON.stringify(report, null, 2)}\n`)
if (failed) process.exitCode = 1
