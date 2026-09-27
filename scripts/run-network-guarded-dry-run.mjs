#!/usr/bin/env node
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const logDirectory = fileURLToPath(new URL('../artifacts/logs/', import.meta.url))
const outputRoot = fileURLToPath(new URL('../artifacts/acquisition/g3-network-proof/', import.meta.url))
const guard = fileURLToPath(new URL('../tests/acquisition/network-guard.cjs', import.meta.url))
const command = fileURLToPath(new URL('../.acquisition-build/scripts/acquisition/dry-run.js', import.meta.url))
const plan = fileURLToPath(new URL('../fixtures/acquisition/plans/evidence-happy-path.json', import.meta.url))

mkdirSync(logDirectory, { recursive: true })
rmSync(outputRoot, { recursive: true, force: true })

const result = spawnSync(process.execPath, ['--require', guard, command, '--plan', plan, '--output', outputRoot, '--now', '2026-09-15T03:46:18.514Z'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
})
for (const entry of readdirSync(outputRoot, { recursive: true })) {
  const target = `${outputRoot}${entry}`
  if (!statSync(target).isFile() || (!target.endsWith('.json') && !target.endsWith('.jsonl'))) continue
  const redacted = readFileSync(target, 'utf8').split(repositoryRoot.replace(/\/$/, '')).join('<REPOSITORY>')
  writeFileSync(target, redacted, 'utf8')
}
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
const proof = [
  'TRACE//ESCAPE G3 NONLOCAL NETWORK PROOF',
  'The fixture dry-run executed with Node socket prototypes, network, DNS (callback and promise), datagram, TLS, HTTP, HTTPS, HTTP/2, and fetch entry points replaced by throwing guards.',
  `Exit code: ${result.status ?? 1}`,
  output,
].join('\n')

writeFileSync(fileURLToPath(new URL('../artifacts/logs/NO_NONLOCAL_NETWORK_PROOF.txt', import.meta.url)), proof, 'utf8')
process.stdout.write(proof)
if (result.status !== 0) process.exitCode = result.status ?? 1
