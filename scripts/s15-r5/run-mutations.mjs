import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve('.')
const unit = pattern => ({ command: 'npx', args: ['vitest', 'run', '--config', 'scripts/s15-r1/current-vitest.config.mjs', 'tests/unit/s15-r5-truthful-closure.test.ts', '-t', pattern] })
const browser = pattern => ({ command: 'npx', args: ['playwright', 'test', '--workers=1', 'tests/e2e/s15-r5-truthful-closure.spec.ts', '--grep', pattern], browser: true })
const probes = [
  { id: 'MUT-R5-01', file: 'src/adventure/content.ts', from: "{ id: 'open-misc-drawer', verb: 'OPEN', targetId: 'miscellaneous-drawer-cabinet', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'miscDrawer', is: 'CLOSED' }, setMiscDrawer: 'OPEN', speech: [] }", to: "{ id: 'open-misc-drawer', verb: 'OPEN', targetId: 'miscellaneous-drawer-cabinet', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'miscDrawer', is: 'CLOSED' }, setMiscDrawer: 'OPEN', speech: event('COPY.BACKGROUND:OPEN', 1) }", test: unit('R5-01a') },
  { id: 'MUT-R5-02', file: 'src/adventure/content.ts', from: "{ id: 'close-case-drawer', verb: 'CLOSE', targetId: 'official-case-file-cabinet', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'caseFileDrawer', is: 'OPEN' }, setCaseFileDrawer: 'CLOSED', speech: [] }", to: "{ id: 'close-case-drawer', verb: 'CLOSE', targetId: 'official-case-file-cabinet', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'caseFileDrawer', is: 'OPEN' }, setCaseFileDrawer: 'CLOSED', speech: event('COPY.BACKGROUND:CLOSE', 0) }", test: unit('R5-01b') },
  { id: 'MUT-R5-03', file: 'src/adventure/physicalChoreography.ts', from: "contactId: 'CONTACT.LAMP.TOGGLE'", to: 'contactId: null', test: unit('R5-02a') },
  { id: 'MUT-R5-04', file: 'src/adventure/reducer.ts', from: "const atContact = !active.stateChangeOccurred && semanticContact === route.contactId", to: 'const atContact = !active.stateChangeOccurred', test: unit('R5-01a') },
  { id: 'MUT-R5-05', file: 'src/adventure/physicalChoreography.ts', from: "if (classification === 'EMPTY_HAND_CONTACT') return 'EMPTY_HAND_REACH'", to: "if (classification === 'EMPTY_HAND_CONTACT') return 'PAPER_REACH'", test: unit('R5-01c') },
  { id: 'MUT-R5-06', file: 'src/adventure/interactionGeometry.ts', from: '+ CABINET_GAP', to: '- 20', test: browser('window-relational-boundaries') },
  { id: 'MUT-R5-07', file: 'src/styles/a0.css', from: "hotspot-wall-not-a-number'] { z-index: 31 !important", to: "hotspot-wall-not-a-number'] { z-index: 1 !important", test: browser('window-relational-boundaries') },
  { id: 'MUT-R5-08', file: 'src/app/useFullDeliveryClamp.ts', from: 'const width = fullDelivery.getBoundingClientRect().width', to: 'const width = element.getBoundingClientRect().width', test: browser('full-delivery-clamp') },
  { id: 'MUT-R5-09', file: 'src/app/useFullDeliveryClamp.ts', from: "    observer.observe(parent)\n    observer.observe(fullDelivery)\n    const fonts = document.fonts\n    void fonts.ready.then(recompute)\n    fonts.addEventListener?.('loadingdone', recompute)", to: "    const fonts = document.fonts", test: browser('full-delivery-clamp') },
  { id: 'MUT-R5-10', file: 'scripts/s15-r5/export-script-review.mjs', from: 'for (const descriptor of routes.R55_ACTUAL_ACTION_MATRIX) {', to: 'for (const descriptor of routes.R55_ACTUAL_ACTION_MATRIX.slice(2)) {', test: { command: 'node', args: ['scripts/s15-r5/export-script-review.mjs'] } },
  { id: 'MUT-R5-11', file: 'scripts/s15-r5/export-script-review.mjs', from: "? 'ACTIVE_COMPONENT_COPY' : 'ACTIVE_RUNTIME_SPLIT'", to: "? 'ACTIVE_COMPONENT_COPY' : 'AUTHENTICATED_DORMANT'", test: { command: 'node', args: ['scripts/s15-r5/export-script-review.mjs'] } },
  { id: 'MUT-R5-12', file: 'scripts/s15-r5/requirements.json', from: 's15-r5:bound-evidence-contract', to: 'broad-suite-boolean', test: unit('R5-05') },
]

function run(cwd, spec, port = 0) {
  return spawnSync(spec.command, spec.args, { cwd, encoding: 'utf8', env: { ...process.env, ...(spec.browser ? { PLAYWRIGHT_PORT: String(port) } : {}) }, timeout: spec.browser ? 120_000 : 60_000 })
}
const baselineUnit = run(root, unit('S15-R5 truthful room interaction closure'))
if (baselineUnit.status !== 0) throw Error(`MUTATION_BASELINE_UNIT_FAILED\n${baselineUnit.stdout}\n${baselineUnit.stderr}`)
const baselineBrowser = run(root, browser('window-relational-boundaries|full-delivery-clamp'), 4289)
if (baselineBrowser.status !== 0) throw Error(`MUTATION_BASELINE_BROWSER_FAILED\n${baselineBrowser.stdout}\n${baselineBrowser.stderr}`)

const tree = execFileSync('git', ['write-tree'], { cwd: root, encoding: 'utf8' }).trim()
const parent = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const snapshot = execFileSync('git', ['commit-tree', tree, '-p', parent, '-m', 's15-r5 mutation snapshot'], { cwd: root, encoding: 'utf8' }).trim()
const results = []
for (let index = 0; index < probes.length; index += 1) {
  const probe = probes[index]
  const worktree = mkdtempSync(join(tmpdir(), `s15-r5-${probe.id.toLowerCase()}-`))
  try {
    execFileSync('git', ['worktree', 'add', '--detach', worktree, snapshot], { cwd: root, stdio: 'pipe' })
    symlinkSync(resolve(root, 'node_modules'), resolve(worktree, 'node_modules'), 'dir')
    const path = resolve(worktree, probe.file)
    const before = readFileSync(path, 'utf8')
    if (!before.includes(probe.from)) throw Error(`${probe.id}:MUTATION_TARGET_NOT_FOUND`)
    writeFileSync(path, before.replace(probe.from, probe.to))
    const execution = run(worktree, probe.test, 4290 + index)
    const output = `${execution.stdout ?? ''}\n${execution.stderr ?? ''}`
    const caught = execution.status !== 0
    results.push({ id: probe.id, isolatedWorktree: worktree, productionOwner: probe.file, targetedCommand: [probe.test.command, ...probe.test.args].join(' '), exitCode: execution.status, semanticFailureObserved: caught, outputTail: output.slice(-3000) })
    if (!caught) throw Error(`${probe.id}:MUTATION_SURVIVED`)
  } finally {
    try { execFileSync('git', ['worktree', 'remove', '--force', worktree], { cwd: root, stdio: 'pipe' }) } catch { rmSync(worktree, { recursive: true, force: true }) }
  }
}
const out = resolve(root, 'review/s15-r5/MUTATIONS')
mkdirSync(out, { recursive: true })
writeFileSync(resolve(out, 'MUTATION_RESULTS.json'), `${JSON.stringify({ schema: 'tarka.s15-r5.real-isolated-mutations.v1', baseline: { unit: 'PASS', browser: 'PASS' }, snapshotTree: tree, snapshotCommit: snapshot, total: results.length, caught: results.filter(row => row.semanticFailureObserved).length, cleanTeardown: true, results }, null, 2)}\n`)
writeFileSync(resolve(out, 'MUTATION_RESULTS.md'), `# S15-R5 real isolated mutations\n\nBaseline unit/browser: PASS. ${results.length}/${results.length} production-owner mutations produced the intended nonzero semantic failure; every temporary worktree was removed.\n\n${results.map(row => `- ${row.id}: CAUGHT by \`${row.targetedCommand}\``).join('\n')}\n`)
console.log(JSON.stringify({ total: results.length, caught: results.length, snapshotTree: tree, cleanTeardown: true }))
