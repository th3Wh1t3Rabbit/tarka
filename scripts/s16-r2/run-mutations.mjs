import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repo = resolve(import.meta.dirname, '../..')
const tempRoot = mkdtempSync(join(tmpdir(), 'trace-escape-s16-r2-mutations.'))
const checkout = join(tempRoot, 'checkout')
const outputDir = join(repo, 'review/s16-r2/MUTATIONS')
const unitTests = [
  'tests/unit/s16-guided-terminal.test.ts',
  'tests/unit/s16-terminal-audio.test.ts',
  'tests/unit/s15-background-music.test.ts',
  'tests/unit/s13-corpus-integration.test.ts',
]
const copiedPaths = [
  'src/app/S16Terminal.tsx', 'src/app/TerminalViewport.tsx', 'src/app/backgroundMusic.ts', 'src/app/terminal-viewport.css', 'src/app/terminalAudio.ts',
  'src/investigation/s16.ts', 'src/investigation/s16Queries.ts', 'src/investigation/state.ts',
  'tests/e2e/s16-guided-terminal.spec.ts', 'tests/e2e/s14-r55-production.spec.ts', ...unitTests,
]
const one = (file, from, to) => ({ file, changes: [{ from, to }] })
const mutations = [
  { id: 'ORIGINAL_V2_VALIDATION_BYPASSED', testTitle: 'validates original v2 receipt prerequisites before translating any history', kind: 'unit', ...one('src/investigation/state.ts', 'if (!rawEntries.every(c => commandShape(fixture, c)) || !validateOriginalCommands(fixture, rawEntries as Command[])) return initial', 'if (!rawEntries.every(c => commandShape(fixture, c))) return initial') },
  { id: 'OPTIONAL_CAP_RESTARVES_GUIDED', testTitle: 'never lets more than one hundred optional runs starve either guided query across reloads', kind: 'unit', ...one('src/investigation/state.ts', 'if (!fixture.s13 || !s13CaseFileGateSatisfied(fixture, state)) return false', 'if (!fixture.s13 || !s13CaseFileGateSatisfied(fixture, state) || state.s16Runs.length >= 100) return false') },
  { id: 'R2_REPEAT_REUSES_R1_RECORD_COUNT', testTitle: 'preserves R1 query meanings while fresh R2 repeat queries use distinct transactions', kind: 'unit', ...one('src/investigation/s16Queries.ts', "semantics === 'R1' ? samePairCount(record) > 1 : samePairTransactionCount(record) > 1", "semantics === 'R1' ? samePairCount(record) > 1 : samePairCount(record) > 1") },
  { id: 'STALE_REUSED_SCENE_PAUSES_CURRENT_OWNER', testTitle: 'never lets OLD → OTHER → OLD completions pause the reused current owner in either direction', kind: 'unit', ...one('src/app/backgroundMusic.ts', 'if (this.playOwners.get(audio) === generation) audio.pause()', 'audio.pause()') },
  { id: 'RECORD_ACTION_ACCEPTS_WRONG_RUN_ORIGIN', testTitle: 'rejects stale or wrong-origin record actions and requires the explicit hunch update', kind: 'unit', ...one('src/investigation/state.ts', "state.s16RecordContext.origin.kind !== 'RUN' || state.s16RecordContext.origin.runId !== command.runId) return { ...state, error: 'Review the matching first transfer from its saved result before adding it.' }", "false) return { ...state, error: 'Review the matching first transfer from its saved result before adding it.' }") },
  { id: 'HUNCH_UPDATE_BYPASSED_BEFORE_FILE', testTitle: 'rejects stale or wrong-origin record actions and requires the explicit hunch update', kind: 'unit', ...one('src/investigation/state.ts', ' || (state.rejectedTheory && !state.s16HunchUpdated)) return', ') return') },
  { id: 'SHARED_CLOCK_PEAK_DRIFT', testTitle: 'schedules the measured peak on the actual decoded loop boundary and never starts a visual', kind: 'unit', ...one('src/app/terminalAudio.ts', 'TERMINAL_EFFECT_PEAK_OFFSET_SECONDS = 0.745', 'TERMINAL_EFFECT_PEAK_OFFSET_SECONDS = 0.5') },
  { id: 'STATIONARY_APERTURE_MASK_REMOVED', testTitle: 'the production degauss paint remains clipped by one stationary 393×219 aperture at every accepted phase', kind: 'browser', ...one('src/app/terminal-viewport.css', 'overflow:hidden; contain:paint;', 'overflow:visible; contain:none;') },
]

const run = (command, args, cwd = repo, extraEnv = {}) => spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 64_000_000, env: { ...process.env, CI: '1', NO_COLOR: '1', FORCE_COLOR: '0', ...extraEnv } })
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex')
function replaceExactlyOnce(path, from, to) {
  const source = readFileSync(path, 'utf8'); const at = source.indexOf(from)
  if (at < 0 || source.indexOf(from, at + from.length) >= 0) throw new Error(`Mutation anchor is not unique: ${relative(checkout, path)} :: ${from}`)
  writeFileSync(path, source.slice(0, at) + to + source.slice(at + from.length))
}
const unit = () => run(join(checkout, 'node_modules/.bin/vitest'), ['run', '--config', 'scripts/s15-r1/current-vitest.config.mjs', ...unitTests, '--reporter=verbose'], checkout)
const browser = () => run(join(checkout, 'node_modules/.bin/playwright'), ['test', 'tests/e2e/s16-guided-terminal.spec.ts', '--project=chromium', '--workers=1', '--grep', 'production degauss paint'], checkout, { PLAYWRIGHT_PORT: '4176' })

const raw = [], results = []
let worktreeAdded = false
try {
  const add = run('git', ['worktree', 'add', '--detach', checkout, 'HEAD'])
  if (add.status !== 0) throw new Error(`Unable to create isolated worktree:\n${add.stderr}`)
  worktreeAdded = true
  for (const path of copiedPaths) { const destination = join(checkout, path); mkdirSync(dirname(destination), { recursive: true }); copyFileSync(join(repo, path), destination) }
  if (!existsSync(join(checkout, 'node_modules'))) symlinkSync(join(repo, 'node_modules'), join(checkout, 'node_modules'), 'dir')
  const baselines = { unit: unit(), browser: browser() }
  for (const [kind, result] of Object.entries(baselines)) {
    raw.push(`===== BASELINE ${kind.toUpperCase()} =====\n${result.stdout}${result.stderr}`)
    if (result.status !== 0) throw new Error(`${kind} mutation baseline failed`)
  }
  for (const mutation of mutations) {
    const target = join(checkout, mutation.file), original = readFileSync(target), originalSha256 = sha(target)
    for (const change of mutation.changes) replaceExactlyOnce(target, change.from, change.to)
    const result = mutation.kind === 'browser' ? browser() : unit()
    const output = `${result.stdout}${result.stderr}`
    copyFileSync(join(repo, mutation.file), target)
    const restoredSha256 = sha(target)
    const assertionObserved = output.includes(mutation.testTitle)
    const semanticKill = result.status !== 0 && assertionObserved && restoredSha256 === originalSha256
    results.push({ id: mutation.id, invariant: mutation.testTitle, file: mutation.file, runner: mutation.kind, semanticKill, exitCode: result.status, intendedAssertionObserved: assertionObserved, originalBytesRestored: restoredSha256 === originalSha256 })
    raw.push(`===== ${mutation.id} :: ${semanticKill ? 'SEMANTIC_KILL' : 'INVALID_OR_SURVIVED'} =====\n${output}`)
    if (!original.equals(readFileSync(target))) throw new Error(`Failed to restore ${mutation.file}`)
  }
  mkdirSync(outputDir, { recursive: true })
  const killed = results.filter(result => result.semanticKill).length
  const report = { schema: 'trace-escape.s16-r2.semantic-mutations.v1', isolation: 'detached worktree; task-owned browser port 4176', baseline: { unit: 'PASS', browserPaint: 'PASS' }, total: results.length, semanticKills: killed, invalidOrSurvived: results.length - killed, results }
  writeFileSync(join(outputDir, 'MUTATION_RESULTS.json'), `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(join(outputDir, 'MUTATION_RAW.log'), `${raw.join('\n')}\n`)
  console.log(JSON.stringify({ status: killed === results.length ? 'PASS' : 'FAIL', total: results.length, semanticKills: killed }))
  if (killed !== results.length) process.exitCode = 1
} finally {
  if (worktreeAdded) run('git', ['worktree', 'remove', '--force', checkout])
  rmSync(tempRoot, { recursive: true, force: true })
}
