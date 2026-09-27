import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const EXPECTED_IMPLEMENTATION = '84a081161b8b3e147021ad497af0862eaf3d7fe80b92f79de8ebe57e7711b46b'
const LANE_BASE = 'a1bf6689b9ba6a3c7077869ee03be1926b2e1c41'
const ACCEPTED_LANE_COMMIT = '1bfa9669b01477a6989e65b4b05f49338cfbb46e'
const ACCEPTED_INTEGRATED_V1_1 = '6be0515e141e8ea8761f913c2c8cd59e8cd44033'
const [reportFlag, reportPath] = process.argv.slice(2)
if (reportFlag !== undefined) assert.equal(reportFlag, '--report')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-v1-1-historical-'))
const lane = path.join(temporary, 'lane-a-exact')
const integrated = path.join(temporary, 's4-integrated-exact')
const archive = path.join(temporary, 'integrated.tar')
const laneConfig = path.join(temporary, 'vitest-lane.config.mjs')
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 128_000_000, env: { ...process.env, CI: '1', NO_COLOR: '1' } })
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')

try {
  run('git', ['clone', '--quiet', '--no-hardlinks', '--no-checkout', root, lane])
  run('git', ['checkout', '--quiet', LANE_BASE], lane)
  run('git', ['checkout', '--quiet', ACCEPTED_LANE_COMMIT, '--', 'content/parallel/narrative', 'docs/parallel/lane-a', 'tests/unit/parallel/narrative-contract'], lane)
  const laneStatus = run('git', ['diff', '--name-only', LANE_BASE], lane).trim().split('\n').filter(Boolean)
  assert.ok(laneStatus.length > 0 && laneStatus.every((name) => /^(?:content\/parallel\/narrative\/|docs\/parallel\/lane-a\/|tests\/unit\/parallel\/narrative-contract\/)/.test(name)))
  const laneOutput = run('node', ['--test', 'tests/unit/parallel/narrative-contract/catalogs.node.mjs'], lane)
  assert.match(laneOutput, /# tests 25/)
  assert.match(laneOutput, /# pass 25/)
  assert.match(laneOutput, /# fail 0/)
  fs.writeFileSync(laneConfig, `export default { root: ${JSON.stringify(lane)}, test: { environment: 'node' } }\n`)
  const laneWrapperOutput = run('node', [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', 'tests/unit/parallel/narrative-contract/catalogs.test.mjs', '--config', laneConfig, '--maxWorkers=1'], lane)
  assert.match(laneWrapperOutput, /Test Files\s+1 passed \(1\)/)
  assert.match(laneWrapperOutput, /Tests\s+1 passed \(1\)/)

  run('git', ['archive', '--format=tar', `--output=${archive}`, ACCEPTED_INTEGRATED_V1_1])
  fs.mkdirSync(integrated)
  run('tar', ['-xf', archive, '-C', integrated])
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(integrated, 'node_modules'), 'dir')
  const identityModule = await import(pathToFileURL(path.join(integrated, 'content/parallel/narrative/implementation-digest.mjs')).href)
  const historicalIdentity = identityModule.implementationIdentity(integrated)
  assert.equal(historicalIdentity.sha256, EXPECTED_IMPLEMENTATION)
  const currentV11Files = historicalIdentity.files.map((entry) => ({ ...entry }))
  for (const entry of historicalIdentity.files) assert.equal(sha(fs.readFileSync(path.join(root, entry.path))), entry.sha256, `CURRENT_V1_1_BYTE_DRIFT:${entry.path}`)
  const s4Output = run('node', ['node_modules/vitest/vitest.mjs', 'run', 'tests/unit/s4-r1-remediation.test.ts', '--maxWorkers=1'], integrated)
  assert.match(s4Output, /Test Files\s+1 passed \(1\)/)
  assert.match(s4Output, /Tests\s+3 passed \(3\)/)

  const report = {
    schemaVersion: '1.0.0', status: 'PASS', context: 'EXACT_V1_1_HISTORICAL_CONTEXT',
    laneBase: LANE_BASE, acceptedLaneCommit: ACCEPTED_LANE_COMMIT, acceptedIntegratedV11: ACCEPTED_INTEGRATED_V1_1,
    implementationIdentity: historicalIdentity.sha256, verifiedHistoricalFiles: historicalIdentity.files.length,
    unchangedTests: [
      { path: 'tests/unit/parallel/narrative-contract/catalogs.test.mjs', wrapperTests: 1, underlyingNodeTests: 25, passed: 25, failed: 0 },
      { path: 'tests/unit/s4-r1-remediation.test.ts', tests: 3, passed: 3, failed: 0 },
    ],
    currentV11BytePreservation: { status: 'PASS', files: currentV11Files.length },
    excludedFromCurrentContextOnly: ['tests/unit/parallel/narrative-contract/catalogs.test.mjs', 'tests/unit/s4-r1-remediation.test.ts'],
  }
  if (reportPath) { fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true }); fs.writeFileSync(path.resolve(reportPath), JSON.stringify(report, null, 2) + '\n') }
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
} finally {
  fs.rmSync(temporary, { recursive: true, force: true })
}
