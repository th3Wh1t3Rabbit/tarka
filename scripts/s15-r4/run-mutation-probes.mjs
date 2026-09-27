import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const out = resolve('review/s15-r4/MUTATIONS')
mkdirSync(out, { recursive: true })
const temp = mkdtempSync(join(tmpdir(), 's15-r4-mutations-'))
const worktree = join(temp, 'candidate')
const run = (cmd, args, cwd = root, input) => spawnSync(cmd, args, {
  cwd,
  input,
  encoding: 'utf8',
  env: { ...process.env, NO_COLOR: '1' },
  maxBuffer: 100 * 1024 * 1024,
})
const checked = (cmd, args, cwd = root, input) => { const result = run(cmd, args, cwd, input); if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`); return result }
const baselineArgs = ['vitest', 'run', 'tests/unit/s15-r4-room-presentation.test.ts']
const mutations = [
  { id: 'PF2-M01-point-hold-release', file: 'src/adventure/reducer.ts', from: "arthurPointHold: state.arthurPointHold || scripted.contact === 'CONTACT.CABINET_POLICY_BLOCK'", to: 'arthurPointHold: false', signature: 'holds Arthur point through cabinet response' },
  { id: 'PF2-M02-wrong-facing-reprimand', file: 'src/adventure/reducer.ts', from: '...state, ...arthurFacesRook(state), selectedVerb: null', to: "...state, mrIndexFacing: arthurFacesRook(state).mrIndexFacing === 'LEFT' ? 'RIGHT' : 'LEFT', selectedVerb: null", signature: 'holds Arthur point through cabinet response' },
  { id: 'PF2-M03-generic-paper-reach', file: 'src/adventure/reducer.ts', from: "rookPose: rule.verb === 'LOOK_AT' ? 'INSPECT' : rule.verb === 'USE' || rule.verb === 'GIVE' ? 'USE_GIVE' : 'IDLE'", to: "rookPose: rule.verb === 'LOOK_AT' ? 'INSPECT' : 'USE_GIVE'", signature: 'keeps ordinary successful drawer actions' },
  { id: 'PF2-M04-missing-empty-reach', file: 'src/adventure/reducer.ts', from: "rookPose: scripted.actor === 'ROOK' ? 'REACH' : state.rookPose", to: "rookPose: scripted.actor === 'ROOK' ? 'USE_GIVE' : state.rookPose", signature: 'holds Arthur point through cabinet response' },
  { id: 'PF2-M05-speech-clamp-removal', file: 'src/app/GameDialoguePresentation.tsx', from: 'Math.max(margin + half', to: 'Math.max(-999 + half', signature: 'retains clamp' },
  { id: 'PF2-M06-css-wrap-enabled', file: 'src/styles/a0.css', from: '.speech-panel span { display: inline; min-height: 0; font-size: 1em; font-weight: 700; line-height: 1; white-space: nowrap; }', to: '.speech-panel span { display: inline; min-height: 0; font-size: 1em; font-weight: 700; line-height: 1; white-space: normal; }', signature: 'retains clamp' },
  { id: 'PF2-M07-topic-scrollbar', file: 'src/styles/a0.css', from: 'padding: 1.4% 2.4%; overflow: hidden;', to: 'padding: 1.4% 2.4%; overflow: auto;', signature: 'retains clamp' },
  { id: 'PF2-M08-font-token-divergence', file: 'src/styles/a0.css', from: '--a0-dialogue-font', to: '--broken-dialogue-font', all: true, signature: 'retains clamp' },
  { id: 'PF2-M09-medium-breakpoint-drift', file: 'src/styles/a0.css', append: '\n@media (max-width: 700px), (max-height: 520px) { .a0-frame { font-size: 7px; } }\n', signature: 'retains clamp' },
  { id: 'PF2-M10-third-to-first-drawer', file: 'src/adventure/layout7.production.json', from: 'cabinet.misc.drawer-03', to: 'cabinet.misc.drawer-01', signature: 'binds the third miscellaneous drawer' },
  { id: 'PF2-M11-drawer-fallback-leak', file: 'src/adventure/reducer.ts', from: 'lastInteractionId: `INTERACTION.REQUIRED.${rule.id}`', to: 'lastInteractionId: `INTERACTION.DEAD_END.${rule.id}`', signature: 'keeps ordinary successful drawer actions' },
  { id: 'PF2-M12-missing-transition-frame', file: 'src/app/App.tsx', from: 'Array.from({ length: 6 }', to: 'Array.from({ length: 0 }', all: true, signature: 'retains clamp' },
  { id: 'PF2-M13-form-label-regression', file: 'src/adventure/content.ts', from: 'scribbled authorization form', to: 'authorization form with scribbles', signature: 'corrected public labels' },
  { id: 'PF2-M14-window-geometry-priority', file: 'src/adventure/interactionGeometry.ts', from: 'room: { x: 371, y: 14, width: 102, height: 88 }', to: 'room: { x: 404, y: 16, width: 40, height: 72 }', signature: 'visible window plate' },
  { id: 'PF2-M15-frame-preload-removal', file: 'src/app/App.tsx', from: 'image.decode()', to: "image['decode']()", all: true, signature: 'retains clamp' },
  { id: 'PF2-M16-exporter-omits-opening', file: 'scripts/s15-r4/export-script-review.mjs', from: "add('PRINCIPAL_OPENING'", to: "add('OMITTED_PRINCIPAL_OPENING'", signature: 'retains clamp' },
]

try {
  checked('git', ['worktree', 'add', '--detach', worktree, 'HEAD'])
  const patch = checked('git', ['diff', '--cached', '--binary']).stdout
  checked('git', ['apply', '--index', '--binary', '-'], worktree, patch)
  symlinkSync(resolve(root, 'node_modules'), join(worktree, 'node_modules'), 'dir')
  const results = []
  for (const mutation of mutations) {
    const baseline = run('npx', baselineArgs, worktree)
    if (baseline.status !== 0) throw new Error(`baseline failed before ${mutation.id}\n${baseline.stdout}\n${baseline.stderr}`)
    const path = join(worktree, mutation.file)
    const original = readFileSync(path, 'utf8')
    let mutated
    if (mutation.append) mutated = original + mutation.append
    else {
      if (!original.includes(mutation.from)) throw new Error(`${mutation.id}: source token missing`)
      mutated = mutation.all ? original.split(mutation.from).join(mutation.to) : original.replace(mutation.from, mutation.to)
    }
    writeFileSync(path, mutated)
    const observed = run('npx', baselineArgs, worktree)
    const output = `${observed.stdout}\n${observed.stderr}`
    results.push({ id: mutation.id, file: mutation.file, baselineCommand: `npx ${baselineArgs.join(' ')}`, baselineExit: baseline.status, mutationExit: observed.status, expectedFailureSignature: mutation.signature, observedFailureSignature: output.split('\n').filter(line => line.includes('FAIL') || line.includes('×') || line.includes('AssertionError')).slice(0, 8), killedIntendedBehavior: observed.status !== 0 && output.toLowerCase().includes(mutation.signature.toLowerCase().split(' ')[0]), status: observed.status !== 0 ? 'KILLED' : 'SURVIVED' })
    writeFileSync(path, original)
  }
  const receipt = { schemaVersion: 's15-r4.real-mutations.v1', isolatedWorktree: true, candidateSource: 'HEAD plus exact staged binary patch', targetedBaseline: baselineArgs.join(' '), allKilled: results.every(row => row.status === 'KILLED'), results }
  writeFileSync(join(out, 'MUTATION_RESULTS.json'), `${JSON.stringify(receipt, null, 2)}\n`)
  writeFileSync(join(out, 'MUTATION_RESULTS.md'), `# S15-R4 real mutation results\n\n${results.map(row => `- ${row.id}: **${row.status}** (baseline ${row.baselineExit}; mutation ${row.mutationExit}) — ${row.file}`).join('\n')}\n`)
  console.log(JSON.stringify({ allKilled: receipt.allKilled, count: results.length, out }))
} finally {
  run('git', ['worktree', 'remove', '--force', worktree])
  rmSync(temp, { recursive: true, force: true })
}
