import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = process.cwd()
const outputRoot = resolve('review/s15-r10/MUTATIONS')
const sandboxRoot = mkdtempSync(join(tmpdir(), 's15-r10-mutations-'))
const sandbox = join(sandboxRoot, 'checkout')
mkdirSync(sandbox)

function replace(path, before, after) {
  const absolute = join(sandbox, path)
  const source = readFileSync(absolute, 'utf8')
  if (!source.includes(before)) throw new Error(`mutation anchor missing: ${path}`)
  writeFileSync(absolute, source.replace(before, after))
}
function mutateJson(path, edit) {
  const absolute = join(sandbox, path)
  const data = JSON.parse(readFileSync(absolute, 'utf8')); edit(data)
  writeFileSync(absolute, `${JSON.stringify(data, null, 2)}\n`)
}

const mutations = [
  { id: 'M01', title: 'swallow same-direction input after FINAL_HOLD', path: 'src/adventure/reducer.ts', test: 'R10-U-HOLD', apply: () => replace('src/adventure/reducer.ts', "state.globeMotion === 'SPINNING' && !reverse", '!reverse') },
  { id: 'M02', title: 'restart level 3 while it is still SPINNING', path: 'src/adventure/reducer.ts', test: 'R10-U-CONTINUITY-4', apply: () => replace('src/adventure/reducer.ts', "const sameDirectionAtMaximum = state.globeMotion === 'SPINNING'", 'const sameDirectionAtMaximum = false') },
  { id: 'M03', title: 'restart post-hold level 1 from phase zero', path: 'src/adventure/reducer.ts', test: 'R10-U-HOLD', apply: () => replace('src/adventure/reducer.ts', 'const currentPhase = currentCursor?.angularPhase ?? state.globeStartPhase', 'const currentPhase = 0') },
  { id: 'M04', title: 'fail to restart after a completed level-1 schedule', path: 'src/adventure/reducer.ts', test: 'R10-U-HOLD-0', apply: () => replace('src/adventure/reducer.ts', "if (sameDirectionAtMaximum) return {", "if (sameDirectionAtMaximum || (state.globeMotion === 'FINAL_HOLD' && state.globeLevel === 1)) return {") },
  { id: 'M05', title: 'fail to restart after a completed level-2 schedule', path: 'src/adventure/reducer.ts', test: 'R10-U-HOLD-1', apply: () => replace('src/adventure/reducer.ts', "if (sameDirectionAtMaximum) return {", "if (sameDirectionAtMaximum || (state.globeMotion === 'FINAL_HOLD' && state.globeLevel === 2)) return {") },
  { id: 'M06', title: 'discard fractional dwell progress on promotion', path: 'src/adventure/reducer.ts', test: 'R10-U-CONTINUITY-1', apply: () => replace('src/adventure/reducer.ts', "const preserveDwellProgress = state.globeMotion === 'SPINNING' && currentCursor && !currentCursor.complete", "const preserveDwellProgress = reverse && state.globeMotion === 'SPINNING' && currentCursor && !currentCursor.complete") },
  { id: 'M07', title: 'discard fractional dwell progress on reversal', path: 'src/adventure/reducer.ts', test: 'R10-U-CONTINUITY-3', apply: () => replace('src/adventure/reducer.ts', "const preserveDwellProgress = state.globeMotion === 'SPINNING' && currentCursor && !currentCursor.complete", "const preserveDwellProgress = !reverse && state.globeMotion === 'SPINNING' && currentCursor && !currentCursor.complete") },
  { id: 'M08', title: 'dim or inert the verb tray during globe operation', path: 'src/adventure/controlPolicy.ts', test: 'R9-GLOBE-CONTROLS', apply: () => replace('src/adventure/controlPolicy.ts', "if (globeActionAllowsControls(state)) return 'PLAYER_CONTROLLED'", "if (globeActionAllowsControls(state)) return 'BLOCKING_ACTION'") },
  { id: 'M09', title: 'close a filed official drawer through generic empty phases', path: 'src/app/cabinetTransitionPolicy.ts', test: 'R10-U-DRAWER-2', apply: () => replace('src/app/cabinetTransitionPolicy.ts', "source.includes('drawer_01_filed') || target.includes('drawer_01_filed')", "target.includes('drawer_01_filed')") },
  { id: 'M10', title: 'remove one required filed closing phase', path: 'src/app/cabinetTransitionPolicy.ts', test: 'R10-U-DRAWER-5', apply: () => replace('src/app/cabinetTransitionPolicy.ts', "? { family: 'OFFICIAL_FILED', frames: six(OFFICIAL_ROOT, 'cabinet_open__drawer_01_filed_phase_') }", "? { family: 'OFFICIAL_FILED', frames: six(OFFICIAL_ROOT, 'cabinet_open__drawer_01_filed_phase_').slice(0, 5) }") },
  { id: 'M11', title: 'mark live mug steam optional', path: 'public/art-packs/production/indexes/LIVE_VS_STAGED_CAPABILITIES.json', test: 'R10-U-INDEX-4', apply: () => mutateJson('public/art-packs/production/indexes/LIVE_VS_STAGED_CAPABILITIES.json', data => { data.optionalPostSubmission.push('mug steam sequences') }) },
  { id: 'M12', title: 'mark live drawer transitions optional', path: 'public/art-packs/production/indexes/LIVE_VS_STAGED_CAPABILITIES.json', test: 'R10-U-INDEX-4', apply: () => mutateJson('public/art-packs/production/indexes/LIVE_VS_STAGED_CAPABILITIES.json', data => { data.optionalPostSubmission.push('drawer travel frames') }) },
  { id: 'M13', title: 'restore basename-only live-owner inference', path: 'scripts/s15-r9/build-animation-inventory.mjs', test: 'R10-U-INDEX-6', apply: () => replace('scripts/s15-r9/build-animation-inventory.mjs', 'exactLiveReferences.has(runtimePath)', 'activeSources.includes(name)') },
  { id: 'M14', title: 'allow LIVE_REQUIRED_NOW family with no exact owner or consumer', path: 'public/art-packs/production/indexes/APPROVED_ANIMATION_CAPABILITY_INVENTORY.json', test: 'R10-U-INDEX-7', apply: () => mutateJson('public/art-packs/production/indexes/APPROVED_ANIMATION_CAPABILITY_INVENTORY.json', data => { data.runtimeFamilies[0].owner = null; data.runtimeFamilies[0].consumer = null }) },
]

function runTest(pattern) {
  return spawnSync(join(sandbox, 'node_modules/.bin/vitest'), ['run', 'tests/unit/s15-r10-final-closure.test.ts', 'tests/unit/s15-r9-reconciliation.test.ts', '--config', 'scripts/s15-r1/current-vitest.config.mjs', '-t', pattern, '--reporter=verbose'], { cwd: sandbox, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } })
}

try {
  execFileSync('git', ['checkout-index', '--all', `--prefix=${sandbox}/`], { cwd: root })
  for (const path of ['src/adventure/globeVisual.ts', 'src/adventure/reducer.ts', 'src/adventure/controlPolicy.ts', 'src/app/App.tsx', 'src/app/cabinetTransitionPolicy.ts', 'tests/unit/s15-r10-final-closure.test.ts', 'tests/unit/s15-r9-reconciliation.test.ts', 'scripts/s15-r9/build-animation-inventory.mjs', 'public/art-packs/production/indexes/APPROVED_ANIMATION_CAPABILITY_INVENTORY.json', 'public/art-packs/production/indexes/LIVE_VS_STAGED_CAPABILITIES.json']) {
    const target = join(sandbox, path); mkdirSync(join(target, '..'), { recursive: true }); writeFileSync(target, readFileSync(resolve(path)))
  }
  symlinkSync(resolve('node_modules'), join(sandbox, 'node_modules'), 'dir')
  const baseline = runTest('S15-R10')
  if (baseline.status !== 0) throw new Error(`baseline failed\n${baseline.stdout}\n${baseline.stderr}`)
  const results = []
  const raw = [`BASELINE status=${baseline.status}`, baseline.stdout, baseline.stderr]
  for (const mutation of mutations) {
    const absolute = join(sandbox, mutation.path); const original = readFileSync(absolute)
    mutation.apply(); const result = runTest(mutation.test); writeFileSync(absolute, original)
    const combined = `${result.stdout}\n${result.stderr}`.replaceAll(sandbox, '<MUTATION_CHECKOUT>').replaceAll(root, '<REPOSITORY>')
    const killed = result.status !== 0
    results.push({ id: mutation.id, mandatoryMutation: mutation.title, changedPath: mutation.path, targetedTestPattern: mutation.test, exitCode: result.status, status: killed ? 'KILLED' : 'SURVIVED' })
    raw.push(`\n===== ${mutation.id} ${mutation.title} =====\n`, combined)
  }
  mkdirSync(outputRoot, { recursive: true })
  const report = { schema: 'tarka.s15-r10.mutation-results.v1', baseline: 'PASS', required: 14, killed: results.filter(result => result.status === 'KILLED').length, survived: results.filter(result => result.status === 'SURVIVED').length, results }
  writeFileSync(join(outputRoot, 'MUTATION_RESULTS.json'), `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(join(outputRoot, 'MUTATION_RESULTS.md'), `# S15-R10 mutation results\n\nBaseline: PASS  \nKilled: ${report.killed}/14\n\n${results.map(result => `- ${result.id} — ${result.status} — ${result.mandatoryMutation}`).join('\n')}\n`)
  writeFileSync(join(outputRoot, 'MUTATION_RAW.log'), raw.join('\n'))
  if (report.killed !== 14) throw new Error(`mutation score ${report.killed}/14`)
  console.log('PASS_S15_R10_MUTATIONS 14/14')
} finally {
  rmSync(sandboxRoot, { recursive: true, force: true })
}
