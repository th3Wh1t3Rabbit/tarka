import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = process.cwd()
const outputRoot = resolve('review/s15-r9/MUTATIONS')
const sandboxRoot = mkdtempSync(join(tmpdir(), 's15-r9-mutations-'))
const sandbox = join(sandboxRoot, 'checkout')
mkdirSync(sandbox)

function replace(path, before, after) {
  const absolute = join(sandbox, path)
  const source = readFileSync(absolute, 'utf8')
  if (!source.includes(before)) throw new Error(`mutation anchor missing: ${path}: ${before}`)
  writeFileSync(absolute, source.replace(before, after))
}

const mutations = [
  { id: 'M01', title: 'restore 1200 ms level-1 boost window', path: 'src/adventure/reducer.ts', test: 'promotion windows', apply: () => replace('src/adventure/reducer.ts', 'GLOBE_LEVEL_1_PROMOTION_MS = 5000', 'GLOBE_LEVEL_1_PROMOTION_MS = 1200') },
  { id: 'M02', title: 'restore 1200 ms level-2 boost window', path: 'src/adventure/reducer.ts', test: 'promotion windows', apply: () => replace('src/adventure/reducer.ts', 'GLOBE_LEVEL_2_PROMOTION_MS = 4000', 'GLOBE_LEVEL_2_PROMOTION_MS = 1200') },
  { id: 'M03', title: 'truncate globe at 1500 ms', path: 'src/adventure/reducer.ts', test: 'R9-GLOBE-RUNTIME-TOTAL', apply: () => replace('src/adventure/reducer.ts', 'const totalMs = globeTimelineTotalMs(state.globeLevel)', 'const totalMs = 1500') },
  { id: 'M04', title: 'remove gradual slowdown', path: 'src/adventure/globeVisual.ts', test: 'R9-GLOBE-1 owns', apply: () => replace('src/adventure/globeVisual.ts', '...LEVEL_1_TAIL.map((dwellMs, index) => ({ phase: (84 + index) % 24, dwellMs, surface:', '...LEVEL_1_TAIL.map((_dwellMs, index) => ({ phase: (84 + index) % 24, dwellMs: 70, surface:') },
  { id: 'M05', title: 'reset level-3 schedule on same-direction touch', path: 'src/adventure/reducer.ts', test: 'L3 same-direction touch', apply: () => replace('src/adventure/reducer.ts', 'const sameDirectionAtMaximum = !reverse &&', 'const sameDirectionAtMaximum = false && !reverse &&') },
  { id: 'M06', title: 'reverse direction while snapping angular phase', path: 'src/adventure/reducer.ts', test: 'reverse preserves phase', apply: () => replace('src/adventure/reducer.ts', 'const currentPhase = moving ? globeSnapshotAt(state.globePose, state.globeLevel, state.globeElapsedMs, state.globeStartPhase).phase : state.globeStartPhase', 'const currentPhase = moving ? 0 : state.globeStartPhase') },
  { id: 'M07', title: 'dim or inert the verb tray during globe operation', path: 'src/adventure/controlPolicy.ts', test: 'R9-GLOBE-CONTROLS', apply: () => replace('src/adventure/controlPolicy.ts', "if (globeActionAllowsControls(state)) return 'PLAYER_CONTROLLED'", "if (globeActionAllowsControls(state)) return 'BLOCKING_ACTION'") },
  { id: 'M08', title: 'use effort frame for blank-form pickup', path: 'src/adventure/animationCues.ts', test: 'R9-ROUTE-FORM', apply: () => replace('src/adventure/animationCues.ts', 'rook_use_reach.png', 'rook_use_reach_effort.png') },
  { id: 'M09', title: 'use effort frame for cabinet close', path: 'src/adventure/animationCues.ts', test: 'R9-ROUTE-CABINET-CLOSE', apply: () => replace('src/adventure/animationCues.ts', 'rook_use_reach.png', 'rook_use_reach_effort.png') },
  { id: 'M10', title: 'use effort frame for globe', path: 'src/adventure/animationCues.ts', test: 'R9-ROUTE-GLOBE', apply: () => replace('src/adventure/animationCues.ts', 'rook_use_reach.png', 'rook_use_reach_effort.png') },
  { id: 'M11', title: 'show Arthur document-talk frame before Rook enters', path: 'src/app/renderedAnimationPolicy.ts', test: 'R9-OPENING', apply: () => replace('src/app/renderedAnimationPolicy.ts', 'const frames = talkingPose && !ownsSpeech ? input.frames.slice(0, 1) : [...input.frames]', 'const frames = [...input.frames]') },
  { id: 'M12', title: 'leave Arthur unmirrored during right-facing reprimand', path: 'src/app/characterFacingPolicy.ts', test: 'arthur.point toward RIGHT', apply: () => replace('src/app/characterFacingPolicy.ts', "mirrorHorizontal: facing === 'RIGHT'", 'mirrorHorizontal: false') },
  { id: 'M13', title: 'make Rook face away from Arthur during reprimand', path: 'src/adventure/reducer.ts', test: 'R9-POINT', apply: () => replace('src/adventure/reducer.ts', "REPRIMAND_FACING = { rookFacing: 'LEFT'", "REPRIMAND_FACING = { rookFacing: 'RIGHT'") },
  { id: 'M14', title: "release Arthur's point during Rook response", path: 'src/adventure/reducer.ts', test: 'R9-POINT', apply: () => replace('src/adventure/reducer.ts', 'return { ...state, speech: { ...state.speech, lineIndex: nextIndex, visibleCharacters, performance:', "return { ...state, arthurPointHold: nextLine.speaker === 'ROOK' ? false : state.arthurPointHold, speech: { ...state.speech, lineIndex: nextIndex, visibleCharacters, performance:") },
  { id: 'M15', title: 'render terminal ON before approved-form return', path: 'src/adventure/reducer.ts', test: 'R9-TERMINAL is OFF', apply: () => replace('src/adventure/reducer.ts', "return state.inventory.includes('approved-stamped-terminal-authorization-form')", 'return true') },
  { id: 'M16', title: 'leave terminal OFF after approved-form return', path: 'src/adventure/reducer.ts', test: 'R9-TERMINAL turns ON', apply: () => replace('src/adventure/reducer.ts', "return state.inventory.includes('approved-stamped-terminal-authorization-form')", 'return false') },
  { id: 'M17', title: 'classify a currently live capability as staged', path: 'public/art-packs/production/indexes/CLIP_AND_CAPABILITY_INDEX.json', test: 'R9-INDEXES', apply: () => replace('public/art-packs/production/indexes/CLIP_AND_CAPABILITY_INDEX.json', '    "arthur.document"\n', '    "arthur.document.staged"\n') },
  { id: 'M18', title: 'omit one approved production character frame from inventory', path: 'public/art-packs/production/indexes/APPROVED_ANIMATION_CAPABILITY_INVENTORY.json', test: 'R9-INVENTORY contains', apply: () => {
    const path = join(sandbox, 'public/art-packs/production/indexes/APPROVED_ANIMATION_CAPABILITY_INVENTORY.json')
    const data = JSON.parse(readFileSync(path, 'utf8'))
    data.frames.pop()
    writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`)
  } },
]

function runTest(pattern) {
  return spawnSync(join(sandbox, 'node_modules/.bin/vitest'), ['run', 'tests/unit/s15-r9-reconciliation.test.ts', '--config', 'scripts/s15-r1/current-vitest.config.mjs', '-t', pattern, '--reporter=verbose'], { cwd: sandbox, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } })
}

try {
  execFileSync('git', ['checkout-index', '--all', `--prefix=${sandbox}/`], { cwd: root })
  symlinkSync(resolve('node_modules'), join(sandbox, 'node_modules'), 'dir')
  const baseline = runTest('S15-R9')
  if (baseline.status !== 0) throw new Error(`baseline failed\n${baseline.stdout}\n${baseline.stderr}`)
  const results = []
  const log = [`BASELINE status=${baseline.status}`, baseline.stdout, baseline.stderr]
  for (const mutation of mutations) {
    const absolute = join(sandbox, mutation.path)
    const original = readFileSync(absolute)
    mutation.apply()
    const result = runTest(mutation.test)
    writeFileSync(absolute, original)
    const combined = `${result.stdout}\n${result.stderr}`
      .replaceAll(sandbox, '<MUTATION_CHECKOUT>')
      .replaceAll(root, '<REPOSITORY>')
    const killed = result.status !== 0 && combined.includes(mutation.test)
    results.push({ id: mutation.id, mandatoryMutation: mutation.title, changedPath: mutation.path, targetedTestPattern: mutation.test, exitCode: result.status, status: killed ? 'KILLED' : 'SURVIVED' })
    log.push(`\n===== ${mutation.id} ${mutation.title} =====\n`, combined)
  }
  mkdirSync(outputRoot, { recursive: true })
  const report = { schema: 'tarka.s15-r9.mutation-results.v1', baseline: 'PASS', required: 18, killed: results.filter(result => result.status === 'KILLED').length, survived: results.filter(result => result.status === 'SURVIVED').length, results }
  writeFileSync(join(outputRoot, 'MUTATION_RESULTS.json'), `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(join(outputRoot, 'MUTATION_RESULTS.md'), `# S15-R9 mutation results\n\nBaseline: PASS  \nKilled: ${report.killed}/18\n\n${results.map(result => `- ${result.id} — ${result.status} — ${result.mandatoryMutation} — \`${result.targetedTestPattern}\``).join('\n')}\n`)
  writeFileSync(join(outputRoot, 'MUTATION_RAW.log'), log.join('\n'))
  if (report.killed !== 18) throw new Error(`mutation score ${report.killed}/18`)
  process.stdout.write('PASS_S15_R9_MUTATIONS 18/18\n')
} finally {
  rmSync(sandboxRoot, { recursive: true, force: true })
}
