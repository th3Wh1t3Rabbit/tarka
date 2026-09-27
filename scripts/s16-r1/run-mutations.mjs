import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outputDir = join(repo, 'review/s16-r1/MUTATIONS')
const tempRoot = mkdtempSync(join(tmpdir(), 'trace-escape-s16-r1-mutations.'))
const checkout = join(tempRoot, 'checkout')
const tests = [
  'tests/unit/s16-guided-terminal.test.ts',
  'tests/unit/s15-background-music.test.ts',
  'tests/unit/s13-corpus-integration.test.ts',
]
const copiedPaths = [
  'src/app/App.tsx',
  'src/app/S16Terminal.tsx',
  'src/app/TerminalViewport.tsx',
  'src/app/backgroundMusic.ts',
  'src/app/terminal-viewport.css',
  'src/investigation/s16.ts',
  'src/investigation/s16Queries.ts',
  'src/investigation/state.ts',
  ...tests,
]

const one = (file, from, to) => ({ file, changes: [{ from, to }] })
const mutations = [
  { id: 'HIDDEN_OPTIONAL_RESULT', ...one('src/investigation/s16Queries.ts', 'const matching = input.filter(predicate[planId])', 'const matching = input.filter(predicate[planId]).slice(0, -1)') },
  { id: 'GUIDED_DAI_COUNT_DRIFT', ...one('src/investigation/s16Queries.ts', 'const tokenMatches = input.filter(dai)', 'const tokenMatches = input.filter(dai).slice(0, -1)') },
  { id: 'GUIDED_EXACT_RESULT_HIDDEN', ...one('src/investigation/s16Queries.ts', 'const matching = routeMatches.filter(record => record.recordId === exact.recordId)', 'const matching = routeMatches.filter(record => record.recordId === exact.recordId).slice(1)') },
  { id: 'TOKEN_GENERICIFICATION', ...one('src/investigation/s16Queries.ts', "'0x6b175474e89094c44da98b954eedeac495271d0f': 'DAI',", "'0x6b175474e89094c44da98b954eedeac495271d0f': 'TOKEN',") },
  { id: 'WRONG_SELECTED_HISTORY', ...one('src/investigation/state.ts', 's16SelectedRunId: command.runId, section:', 's16SelectedRunId: state.s16Runs.at(-1)!.id, section:') },
  { id: 'NAVIGATION_CHANGES_PROGRESS', ...one('src/investigation/state.ts', "{ ...state, section: command.section, broadSeaSeen:", "{ ...state, section: command.section, s13FilterStage: 6, broadSeaSeen:") },
  { id: 'MANDATORY_QUERY_NOOP', ...one('src/investigation/state.ts', "command.planId === 'Q2' ? 4", "command.planId === 'Q2' ? state.s13FilterStage") },
  { id: 'MIGRATION_LOSES_EXACT_RUN', ...one('src/investigation/state.ts', "if (pending === 'RECEIPT_ROUTE_VERIFICATION') migrated.push({ type: 'S16_RUN_QUERY', planId: 'Q3' })", "if (pending === 'RECEIPT_ROUTE_VERIFICATION') migrated.push({ type: 'S16_ADD_ROUTE' })") },
  {
    id: 'CONTEXTUAL_PROOF_PROMOTION',
    file: 'src/investigation/state.ts',
    changes: [
      { from: "if (fixture.s13 && command.recordId === fixture.s13.proof.contextualCorroboration.recordId) return", to: "if (false) return" },
      { from: "if (command.recordId === contextual.recordId || command.recordId !== exactS13.recordId || exactS13.evidenceGradeCeiling !== 'EXACT' || JSON.stringify(exactS13.fillsProofSlots) !== JSON.stringify(['AMOUNT', 'RECEIVER', 'LINK'])) return", to: "if (false) return" },
    ],
  },
  { id: 'ATOMIC_FINDINGS_DROPS_LINK', ...one('src/investigation/state.ts', 'const assembly = { AMOUNT: fixture.proof.slots.AMOUNT, RECEIVER: fixture.proof.slots.RECEIVER, LINK: fixture.proof.slots.LINK }', 'const assembly = { AMOUNT: fixture.proof.slots.AMOUNT, RECEIVER: fixture.proof.slots.RECEIVER }') },
  { id: 'BRCG_COMPLETES_EULER', ...one('src/investigation/state.ts', 'return { ...state, sideLead, error: null, announcement: sideLead.resolved', 'return { ...state, sideLead, complete: sideLead.resolved, error: null, announcement: sideLead.resolved') },
  { id: 'SEVENTH_RESULT_HIDDEN_BY_PAGE_SIZE', ...one('src/app/S16Terminal.tsx', 'const PAGE_SIZE = 8', 'const PAGE_SIZE = 7') },
  { id: 'SOURCE_FABRICATES_METHOD', ...one('src/app/S16Terminal.tsx', '<div><b>NETWORK</b><br/>Ethereum</div><div><b>WHEN</b>', '<div><b>NETWORK</b><br/>Ethereum</div><div><b>METHOD</b><br/>POST</div><div><b>WHEN</b>') },
  { id: 'DEGAUSS_EARLY_REARM', ...one('src/app/TerminalViewport.tsx', '}, 2100)', '}, 1800)') },
  { id: 'DEGAUSS_DUPLICATE_ACTIVATION', ...one('src/app/TerminalViewport.tsx', 'if (locked.current) return', 'if (false) return') },
  { id: 'DEGAUSS_GAIN_CHANGED', ...one('src/app/TerminalViewport.tsx', 'audio.volume = 0.75', 'audio.volume = 0.5') },
  { id: 'DEGAUSS_MASK_REMOVED', ...one('src/app/terminal-viewport.css', '.s5-native-terminal.is-degaussing .s5-dom-safe { overflow:hidden;', '.s5-native-terminal.is-degaussing .s5-dom-safe { overflow:visible;') },
  { id: 'DEGAUSS_BOUNCE_RESTORED', ...one('src/app/terminal-viewport.css', 'transform:scaleX(1.34) scaleY(.68) skewX(12deg)', 'transform:scaleX(1.34) scaleY(.68) translateY(2px) skewX(12deg)') },
  { id: 'STALE_AUDIO_PROMISE_REVIVES_TRACK', ...one('src/app/backgroundMusic.ts', 'if (generation !== this.generation || scene !== this.scene || !this.started || this.muted || document.hidden)', 'if (!this.started || this.muted || document.hidden)') },
  {
    id: 'OFFICE_TERMINAL_MUSIC_OVERLAP',
    file: 'src/app/backgroundMusic.ts',
    changes: [
      { from: 'if (outgoing) outgoing.pause()', to: 'if (outgoing) void outgoing' },
      { from: 'for (const [key, other] of Object.entries(this.audios) as [BackgroundMusicScene, HTMLAudioElement][]) if (key !== scene) other.pause()', to: 'for (const [key, other] of Object.entries(this.audios) as [BackgroundMusicScene, HTMLAudioElement][]) if (key !== scene) void other' },
    ],
  },
  { id: 'WRONG_TRACK_RESTARTS_AT_ZERO', ...one('src/app/backgroundMusic.ts', 'incoming.muted = this.muted\n    await this.playCurrent', 'incoming.muted = this.muted\n    incoming.currentTime = 0\n    await this.playCurrent') },
  { id: 'MUTE_LOST_ON_SCENE_CHANGE', ...one('src/app/backgroundMusic.ts', 'async setScene(scene: BackgroundMusicScene): Promise<void> {\n    if (scene === this.scene) return', 'async setScene(scene: BackgroundMusicScene): Promise<void> {\n    if (scene === this.scene) return\n    this.muted = false') },
]

function run(command, args, cwd = repo) {
  return spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 64_000_000, env: { ...process.env, CI: '1', NO_COLOR: '1', FORCE_COLOR: '0' } })
}

function replaceExactlyOnce(path, from, to) {
  const source = readFileSync(path, 'utf8')
  const first = source.indexOf(from)
  if (first < 0 || source.indexOf(from, first + from.length) >= 0) throw new Error(`Mutation anchor is not unique: ${relative(checkout, path)} :: ${from}`)
  writeFileSync(path, source.slice(0, first) + to + source.slice(first + from.length))
}

const raw = []
const results = []
let worktreeAdded = false
try {
  const add = run('git', ['worktree', 'add', '--detach', checkout, 'HEAD'])
  if (add.status !== 0) throw new Error(`Unable to create isolated worktree:\n${add.stderr}`)
  worktreeAdded = true
  for (const path of copiedPaths) {
    const destination = join(checkout, path)
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(join(repo, path), destination)
  }
  if (!existsSync(join(checkout, 'node_modules'))) symlinkSync(join(repo, 'node_modules'), join(checkout, 'node_modules'), 'dir')

  const test = () => run(join(checkout, 'node_modules/.bin/vitest'), ['run', '--config', 'scripts/s15-r1/current-vitest.config.mjs', ...tests], checkout)
  const baseline = test()
  raw.push(`===== BASELINE =====\n${baseline.stdout}${baseline.stderr}`)
  if (baseline.status !== 0) throw new Error(`Mutation baseline did not pass:\n${baseline.stdout}${baseline.stderr}`)

  for (const mutation of mutations) {
    const target = join(checkout, mutation.file)
    const original = readFileSync(target, 'utf8')
    for (const change of mutation.changes) replaceExactlyOnce(target, change.from, change.to)
    const result = test()
    writeFileSync(target, original)
    const killed = result.status !== 0
    results.push({ id: mutation.id, file: mutation.file, killed, exitCode: result.status })
    raw.push(`===== ${mutation.id} :: ${killed ? 'KILLED' : 'SURVIVED'} =====\n${result.stdout}${result.stderr}`)
  }

  mkdirSync(outputDir, { recursive: true })
  const killed = results.filter(result => result.killed).length
  const report = { schemaVersion: 's16-r1-isolated-mutation-report.v1', isolation: 'detached-git-worktree', baseline: 'PASS', total: results.length, killed, survived: results.length - killed, score: killed / results.length, results }
  writeFileSync(join(outputDir, 'MUTATION_RESULTS.json'), `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(join(outputDir, 'MUTATION_RESULTS.md'), `# S16-R1 isolated mutation qualification\n\n- Baseline: PASS\n- Isolation: detached Git worktree\n- Mutations: ${results.length}\n- Killed: ${killed}\n- Survived: ${results.length - killed}\n- Score: ${(100 * killed / results.length).toFixed(1)}%\n\n${results.map(result => `- ${result.killed ? 'PASS' : 'FAIL'} — ${result.id} — ${result.file}`).join('\n')}\n`)
  writeFileSync(join(outputDir, 'MUTATION_RAW.log'), `${raw.join('\n')}\n`)
  console.log(JSON.stringify({ status: killed === results.length ? 'PASS' : 'FAIL', total: results.length, killed, survived: results.length - killed }))
  if (killed !== results.length) process.exitCode = 1
} finally {
  if (worktreeAdded) run('git', ['worktree', 'remove', '--force', checkout])
  rmSync(tempRoot, { recursive: true, force: true })
}
