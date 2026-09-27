import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const outputDir = resolve(root, 'review/s15-r8/MUTATIONS')
mkdirSync(outputDir, { recursive: true })

const unit = pattern => ['npx', ['vitest', 'run', '--config', 'scripts/s15-r1/current-vitest.config.mjs', 'tests/unit/s15-r8-visual-mouth-policy.test.ts', '-t', pattern]]
const r7unit = pattern => ['npx', ['vitest', 'run', '--config', 'scripts/s15-r1/current-vitest.config.mjs', 'tests/unit/s15-r7-opening-dialogue-form-terminal.test.ts', '-t', pattern]]
const browser = pattern => ['npx', ['playwright', 'test', '--workers=1', 'tests/e2e/s15-r8-visual-mouth-ownership.spec.ts', '--grep', pattern]]
const r7browser = pattern => ['npx', ['playwright', 'test', '--workers=1', 'tests/e2e/s15-r7-opening-dialogue-form-terminal.spec.ts', '--grep', pattern]]

const mutations = [
  { id: 'M01', requirement: 'document clip never cycles while Arthur speaks', file: 'src/app/renderedAnimationPolicy.ts', from: 'const loop = talkingPose ? ownsSpeech && frames.length > 1 : input.loop', to: 'const loop = talkingPose ? false : input.loop', command: unit('arthur.document cycles') },
  { id: 'M02', requirement: 'document clip cycles while Rook speaks', file: 'src/app/renderedAnimationPolicy.ts', from: 'const frames = talkingPose && !ownsSpeech ? input.frames.slice(0, 1) : [...input.frames]', to: 'const frames = [...input.frames]', command: unit('arthur.document cycles') },
  { id: 'M03', requirement: 'point clip cycles unconditionally during Rook reply', file: 'src/app/renderedAnimationPolicy.ts', from: 'const loop = talkingPose ? ownsSpeech && frames.length > 1 : input.loop', to: 'const loop = talkingPose ? true : input.loop', command: unit('arthur.point cycles') },
  { id: 'M04', requirement: 'point clip never cycles during Arthur line', file: 'src/app/renderedAnimationPolicy.ts', from: 'const loop = talkingPose ? ownsSpeech && frames.length > 1 : input.loop', to: "const loop = talkingPose ? ownsSpeech && input.clipId !== 'arthur.point' && frames.length > 1 : input.loop", command: unit('arthur.point cycles') },
  { id: 'M05', requirement: 'outgoing posed speaker remains on talk frame after ownership changes', file: 'src/app/renderedAnimationPolicy.ts', from: 'const frames = talkingPose && !ownsSpeech ? input.frames.slice(0, 1) : [...input.frames]', to: 'const frames = talkingPose && !ownsSpeech ? input.frames.slice(-1) : [...input.frames]', command: unit('rebases policy identity') },
  { id: 'M06', requirement: 'frame reset on animation-policy transition is removed', file: 'src/app/renderedAnimationPolicy.ts', from: "const identity = [input.actor, input.speakerOwner, input.clipId, mouthMode, active ? 'active' : 'still', loop ? 'loop' : 'hold', frames.join('|')].join('::')", to: "const identity = [input.actor, input.clipId].join('::')", command: unit('rebases policy identity') },
  { id: 'M07', requirement: 'evidence omits actual frame indices or sources', file: 'src/app/App.tsx', from: 'data-requested-src={rendered.src} data-testid={testId}', to: 'data-testid={testId}', command: browser('document review') },
  { id: 'M08', requirement: 'same-speaker visual activity drops during revealed wait', file: 'src/adventure/reducer.ts', from: "return active?.lines[active.lineIndex]?.speaker ?? 'NONE'", to: "return active && active.visibleCharacters < (active.lines[active.lineIndex]?.text.length ?? 0) ? active.lines[active.lineIndex]?.speaker ?? 'NONE' : 'NONE'", command: r7unit('R7-02') },
  { id: 'M09', requirement: 'ordinary opening talking clip regresses while posed clips pass', file: 'src/app/renderedAnimationPolicy.ts', from: 'const active = talkingPose ? loop : input.active', to: "const active = talkingPose ? loop : input.clipId.endsWith('.talk') ? false : input.active", command: unit('ordinary talk') },
  { id: 'M10', requirement: 'form visual-mouth fix breaks one-paper or stamp ownership', file: 'src/app/App.tsx', from: "if (owner !== 'ROOK_VISIBLE' && owner !== 'ARTHUR_VISIBLE') return null", to: "if (owner !== 'ROOK_VISIBLE') return null", command: r7browser('one form sequence') },
]

const log = []
const results = []
function run(label, command) {
  const [executable, args] = command
  const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', env: { ...process.env, PLAYWRIGHT_PORT: '4178', FORCE_COLOR: '0', NO_COLOR: '1' } })
  const text = [`===== ${label} =====`, `$ ${executable} ${args.join(' ')}`, result.stdout, result.stderr, `EXIT=${result.status ?? -1}`, ''].join('\n')
  log.push(text)
  process.stdout.write(`${label}: exit ${result.status ?? -1}\n`)
  return { status: result.status ?? -1, output: `${result.stdout}\n${result.stderr}` }
}

for (const mutation of mutations) {
  const path = resolve(root, mutation.file)
  const original = readFileSync(path, 'utf8')
  if (!original.includes(mutation.from)) throw new Error(`${mutation.id}: source anchor not found in ${mutation.file}`)
  const baseline = run(`${mutation.id} BASELINE`, mutation.command)
  if (baseline.status !== 0) throw new Error(`${mutation.id}: targeted baseline did not pass`)
  try {
    writeFileSync(path, original.replace(mutation.from, mutation.to))
    const changed = readFileSync(path, 'utf8')
    if (changed === original) throw new Error(`${mutation.id}: mutation was not applied`)
    const mutated = run(`${mutation.id} MUTATED`, mutation.command)
    results.push({ id: mutation.id, requirement: mutation.requirement, file: mutation.file, baselineExit: baseline.status, mutatedExit: mutated.status, caught: mutated.status !== 0 })
  } finally {
    writeFileSync(path, original)
  }
}

const report = { schema: 'tarka.s15-r8.real-mutation-results.v1', minimumRequired: 10, total: results.length, caught: results.filter(result => result.caught).length, allCaught: results.every(result => result.caught), results }
writeFileSync(resolve(outputDir, 'MUTATION_RESULTS.json'), `${JSON.stringify(report, null, 2)}\n`)
writeFileSync(resolve(outputDir, 'RAW_MUTATION_RUN.log'), log.join('\n'))
if (!report.allCaught || report.total < report.minimumRequired) process.exit(1)
