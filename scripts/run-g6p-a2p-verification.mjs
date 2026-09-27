#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const output = path.join(repository, 'artifacts/g6p-a2p/verification')
mkdirSync(output, { recursive: true })
const git = (...args) => execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim()
const deliveryInputs = ['src', 'tests', 'public', 'docs', 'scripts', 'package.json', 'artifacts/g6p-a2p/reviews']
const dirtyDeliveryInputs = git('status', '--porcelain=v1', '--untracked-files=all', '--', ...deliveryInputs)
if (dirtyDeliveryInputs) throw new Error(`Refusing to verify dirty delivery inputs:\n${dirtyDeliveryInputs}`)

const checks = [
  ['complete-accepted-a1-r2', 'node', ['scripts/run-g6p-a1-clean-regression.mjs']],
  ['check', 'npm', ['run', 'check']],
  ['unit', 'npm', ['test']],
  ['accepted-and-a2p-e2e', 'npm', ['run', 'test:e2e']],
  ['build', 'npm', ['run', 'build']],
  ['g6p-a1-boundaries', 'npm', ['run', 'g6p:a1:boundary:verify']],
  ['browser-boundary', 'npm', ['run', 'browser-boundary:verify']],
  ['secret-scan', 'npm', ['run', 'secret:scan']],
  ['secret-history', 'npm', ['run', 'secret:scan-history']],
]

const results = []
let passed = true
for (const [id, command, args] of checks) {
  const result = spawnSync(command, args, { cwd: repository, encoding: 'utf8', env: process.env })
  const log = `${result.stdout ?? ''}${result.stderr ?? ''}`
  writeFileSync(path.join(output, `${id}.log`), log)
  const status = result.status === 0 ? 'PASSED' : 'FAILED'
  results.push({ id, command: [command, ...args].join(' '), status, exitCode: result.status })
  if (result.status !== 0) passed = false
}

const report = {
  schemaVersion: '1.0.0',
  gate: 'G6P-A2P',
  result: passed ? 'PASSED' : 'FAILED',
  status: passed ? 'DELIVERED_PENDING_LEAD_REVIEW' : 'BLOCKED_WITH_EVIDENCE',
  candidateCommit: git('rev-parse', 'HEAD'),
  candidateTree: git('rev-parse', 'HEAD^{tree}'),
  reviewedBase: '8cb53c91e2dcaae81e9b84dfe848c19e27e96d9e',
  checks: results,
  providerCallsDuringOrdinaryPlay: 0,
  credentialResolutionAttempted: false,
  finalArtAcceptanceClaimed: false,
  finalNarrativeAcceptanceClaimed: false,
  fullMissionAcceptanceClaimed: false,
}
writeFileSync(path.join(output, 'FINAL_VERIFICATION.json'), `${JSON.stringify(report, null, 2)}\n`)
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (!passed) process.exitCode = 1
