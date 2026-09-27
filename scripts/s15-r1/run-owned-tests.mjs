import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const mode = process.argv[2]
const manifest = JSON.parse(readFileSync(new URL('./test-ownership.json', import.meta.url), 'utf8'))
const e2e = mode === 'e2e' || mode === 'historical-e2e'
const historical = mode === 'historical-unit' || mode === 'historical-e2e'
if (!['unit', 'e2e', 'historical-unit', 'historical-e2e'].includes(mode)) throw new Error(`Unknown owned-test mode: ${mode}`)

const paths = manifest.classifications
  .filter(entry => entry.path.startsWith(e2e ? 'tests/e2e/' : 'tests/unit/') || (!e2e && entry.path.startsWith('tests/acquisition/')))
  .filter(entry => historical ? entry.classification !== 'CURRENT_PRODUCTION_REQUIRED' : entry.classification === 'CURRENT_PRODUCTION_REQUIRED')
  .map(entry => entry.path)

if (!paths.length) throw new Error(`No tests selected for ${mode}`)
const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const args = e2e
  ? ['playwright', 'test', '--workers=1', ...paths]
  : ['vitest', 'run', '--config', 'scripts/s15-r1/current-vitest.config.mjs', ...paths]
const result = spawnSync(executable, args, { stdio: 'inherit', env: { ...process.env, S15_R1_TEST_OWNERSHIP: mode } })
if (result.error) throw result.error
process.exit(result.status ?? 1)
