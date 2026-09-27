#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const logDirectory = new URL('../artifacts/logs/', import.meta.url)
mkdirSync(logDirectory, { recursive: true })

const commands = [
  ['npm', ['run', 'check']],
  ['npm', ['run', 'test']],
  ['npm', ['run', 'acquisition:preflight']],
  ['npm', ['run', 'acquisition:prove-no-network']],
  ['npm', ['run', 'acquisition:status', '--', '--primary-root', 'artifacts/acquisition/g3-network-proof/primary']],
  ['npm', ['run', 'acquisition:verify-store', '--', '--output', 'artifacts/acquisition/g3-network-proof']],
  ['npm', ['run', 'export:lint', '--', '--input', 'artifacts/acquisition/g3-network-proof/reports/public-scenario-draft.json']],
  ['npm', ['run', 'case:score', '--', '--input', 'fixtures/acquisition/scores/passing.json']],
  ['npm', ['run', 'test:e2e']],
  ['npm', ['run', 'build']],
  ['npm', ['run', 'browser-boundary:verify']],
  ['npm', ['run', 'test:g2:focused']],
  ['npm', ['run', 'secret:scan']],
  ['npm', ['run', 'project:clock']],
  ['npm', ['run', 'project:status']],
]

const started = new Date()
const sections = [`TRACE//ESCAPE G3 FINAL VERIFICATION\nStarted UTC: ${started.toISOString()}\n`]
let failed = false

for (const [command, args] of commands) {
  const label = `${command} ${args.join(' ')}`
  process.stdout.write(`\n=== ${label} ===\n`)
  const result = spawnSync(command, args, {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  process.stdout.write(output)
  sections.push(`\n=== ${label} ===\nExit code: ${result.status ?? 1}\n${output}`)
  if (args[1] === 'project:clock') writeFileSync(new URL('PROJECT_CLOCK.txt', logDirectory), output, 'utf8')
  if (args[1] === 'project:status') writeFileSync(new URL('PROJECT_STATUS.txt', logDirectory), output, 'utf8')
  if (result.status !== 0) {
    failed = true
    break
  }
}

sections.push(`\nCompleted UTC: ${new Date().toISOString()}\nResult: ${failed ? 'FAILED' : 'PASSED'}\n`)
writeFileSync(new URL('FINAL_VERIFICATION.log', logDirectory), sections.join(''), 'utf8')

if (failed) process.exitCode = 1
