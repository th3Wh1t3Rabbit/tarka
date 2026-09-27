import { mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const logDir = resolve(root, 'review/s16/LOGS')
mkdirSync(logDir, { recursive: true })
const changedLintPaths = [
  'scripts/s15-r1/test-ownership.json',
  'scripts/s16/run-mutations.mjs',
  'scripts/s16/run-final-qualification.mjs',
  'scripts/s16/verify-built-output.mjs',
  'scripts/s16/verify-static-assets.mjs',
  'scripts/s16/write-evidence.mjs',
  'scripts/s16/verify-return.mjs',
  'scripts/s16/package-return.mjs',
  'src/app/CaseTerminalWorkbench.tsx',
  'src/app/ExactIdentifier.tsx',
  'src/app/S13IntegratedCorpus.tsx',
  'src/app/S16Terminal.tsx',
  'src/app/TerminalViewport.tsx',
  'src/investigation/s16.ts',
  'tests/unit/s16-guided-terminal.test.ts',
  'tests/e2e/s16-guided-terminal.spec.ts',
  'tests/e2e/s12-p4-launch.spec.ts',
  'tests/e2e/s14-r1-runtime-consumers.spec.ts',
  'tests/e2e/s14-r55-production.spec.ts',
  'tests/e2e/s15-r1-production-journeys.spec.ts',
  'tests/e2e/s15-r3-runtime-closure.spec.ts',
]
const gates = [
  ['01-ownership', 'node', ['scripts/s15-r1/validate-test-ownership.mjs']],
  ['02-focused-unit', 'npx', ['vitest', 'run', 'tests/unit/s16-guided-terminal.test.ts']],
  ['03-focused-browser', 'npx', ['playwright', 'test', 'tests/e2e/s16-guided-terminal.spec.ts', '--workers=1']],
  ['04-isolated-mutations', 'node', ['scripts/s16/run-mutations.mjs']],
  ['05-canonical-unit', 'npm', ['test']],
  ['06-canonical-browser', 'npm', ['run', 'test:e2e']],
  ['07-typecheck', 'npm', ['run', 'typecheck']],
  ['08-changed-scope-lint', 'npx', ['eslint', ...changedLintPaths]],
  ['09-full-lint', 'npm', ['run', 'lint']],
  ['10-production-build', 'npm', ['run', 'build']],
  ['11-browser-boundary', 'node', ['scripts/verify-browser-boundary.mjs']],
  ['12-built-output-scan', 'node', ['scripts/s16/verify-built-output.mjs']],
  ['13-secret-private-scan', 'npm', ['run', 'secret:scan']],
  ['14-secret-history-scan', 'npm', ['run', 'secret:scan-history']],
  ['15-static-asset-scan', 'node', ['scripts/s16/verify-static-assets.mjs']],
  ['16-blocked-network-journeys', 'npx', ['playwright', 'test', 'tests/e2e/s16-guided-terminal.spec.ts', '--workers=1', '--grep', 'B27|B28|B29|B30']],
]
const results = []
for (const [id, command, args] of gates) {
  const startedAt = new Date().toISOString()
  const started = Date.now()
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', env: { ...process.env, CI: '1' }, maxBuffer: 64 * 1024 * 1024 })
  const durationMs = Date.now() - started
  const log = [`COMMAND: ${command} ${args.join(' ')}`, `STARTED: ${startedAt}`, `DURATION_MS: ${durationMs}`, `EXIT_CODE: ${result.status}`, '', result.stdout ?? '', result.stderr ?? ''].join('\n')
  writeFileSync(resolve(logDir, `${id}.log`), log)
  const gate = { id, command: `${command} ${args.join(' ')}`, status: result.status === 0 ? 'PASS' : 'FAIL', exitCode: result.status, durationMs }
  results.push(gate)
  console.log(JSON.stringify(gate))
  if (result.status !== 0) {
    writeFileSync(resolve(root, 'review/s16/FINAL_GATE_RESULTS.json'), `${JSON.stringify({ schemaVersion: 's16-final-gates.v1', status: 'FAIL', results }, null, 2)}\n`)
    process.exit(1)
  }
}
writeFileSync(resolve(root, 'review/s16/FINAL_GATE_RESULTS.json'), `${JSON.stringify({ schemaVersion: 's16-final-gates.v1', status: 'PASS', results }, null, 2)}\n`)
console.log(JSON.stringify({ status: 'PASS', gates: results.length }))
