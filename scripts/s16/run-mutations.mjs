import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outputDir = join(repo, 'review/s16/MUTATIONS')
const tempRoot = mkdtempSync(join(tmpdir(), 'trace-escape-s16-mutations.'))
const checkout = join(tempRoot, 'checkout')
const testPath = 'tests/unit/s16-guided-terminal.test.ts'
const copiedPaths = [
  'src/app/CaseTerminalWorkbench.tsx',
  'src/app/ExactIdentifier.tsx',
  'src/app/S13IntegratedCorpus.tsx',
  'src/app/S16Terminal.tsx',
  'src/app/TerminalViewport.tsx',
  'src/app/terminal-viewport.css',
  'src/investigation/s16.ts',
  testPath,
]

const mutations = [
  { id: 'POOL_DROPS_ACCEPTED_RECORD', file: 'src/investigation/s16.ts', from: "  return records\n}\n\nexport function s16ExploreResults", to: "  return records.slice(0, -1)\n}\n\nexport function s16ExploreResults" },
  { id: 'QUERY_SEARCH_COUNT_OFF_BY_ONE', file: 'src/investigation/s16.ts', from: 'searchCount: summary.inputCount,', to: 'searchCount: summary.inputCount + 1,' },
  { id: 'QUERY_NARROWING_DUPLICATES_INPUT', file: 'src/investigation/s16.ts', from: 'stageCounts[0] === summary.inputCount', to: 'stageCounts[0] !== summary.inputCount' },
  { id: 'QUERY_ONE_HIDES_CONDITION', file: 'src/investigation/s16.ts', from: "conditions: ['Accepted transfer pool', 'Accepted incident window'],", to: "conditions: ['Accepted transfer pool']," },
  { id: 'QUERY_TWO_HIDES_CONDITION', file: 'src/investigation/s16.ts', from: "conditions: ['Asset is DAI', 'Amount is between 8.0M and 9.5M DAI'],", to: "conditions: ['Asset is DAI']," },
  { id: 'QUERY_THREE_HIDES_CONDITION', file: 'src/investigation/s16.ts', from: "conditions: ['First Engine to Receiving Vault', 'Exact accepted receipt identity'],", to: "conditions: ['Exact accepted receipt identity']," },
  { id: 'APPROACH_LOSES_QUESTION_GRAMMAR', file: 'src/investigation/s16.ts', from: "ACTIVITY: 'WHAT HAPPENED?',", to: "ACTIVITY: 'WHAT HAPPENED'," },
  { id: 'QUESTION_LOSES_QUESTION_GRAMMAR', file: 'src/investigation/s16.ts', from: "title: 'Which accepted records fall inside the incident window?',", to: "title: 'Accepted records inside the incident window'," },
  { id: 'EXPLORE_APPROACH_HAS_TWO_QUESTIONS', file: 'src/investigation/s16.ts', from: "    { id: 'ACTIVITY_AFTER', title: 'What activity occurs after 11:38:11 UTC?', description: 'Browse a later slice of the frozen corpus.', filter: 'AFTER' },\n", to: '' },
  { id: 'ASK_QUESTION_RETURNS_TO_FOREGROUND', file: 'src/investigation/s16.ts', from: "ASK_QUESTION: 'REDUCER_ONLY',", to: "ASK_QUESTION: 'FOREGROUND'," },
  { id: 'UNDO_RETURNS_TO_FOREGROUND', file: 'src/investigation/s16.ts', from: "UNDO: 'REDUCER_ONLY',", to: "UNDO: 'FOREGROUND'," },
  { id: 'RUNTIME_PROVIDER_COUNT_NONZERO', file: 'src/investigation/s16.ts', from: 'runtimeProviderCalls: runtime.productionBoundary.runtimeProviderCalls,', to: 'runtimeProviderCalls: 1,' },
  { id: 'WINDOW_FILTER_DROPS_RECORD', file: 'src/investigation/s16.ts', from: "if (filter === 'WINDOW') return records", to: "if (filter === 'WINDOW') return records.slice(0, -1)" },
  { id: 'AFTER_FILTER_IGNORES_TIME', file: 'src/investigation/s16.ts', from: "if (filter === 'AFTER') return records.filter(record => (record.block_timestamp ?? '') > convergence)", to: "if (filter === 'AFTER') return records" },
  { id: 'DIRECT_FILTER_REVERSES_DESTINATION', file: 'src/investigation/s16.ts', from: "if (filter === 'DIRECT') return records.filter(record => record.from_address?.toLowerCase() === first && record.to_address?.toLowerCase() === vault)", to: "if (filter === 'DIRECT') return records.filter(record => record.from_address?.toLowerCase() === first && record.to_address?.toLowerCase() !== vault)" },
  { id: 'AMOUNT_FILTER_USES_WRONG_STAGE', file: 'src/investigation/s16.ts', from: "runtime.evidenceDelta.stages[3] ? records.filter(record => runtime.evidenceDelta.stages[3]!.survivingRecordIds", to: "runtime.evidenceDelta.stages[2] ? records.filter(record => runtime.evidenceDelta.stages[2]!.survivingRecordIds" },
  { id: 'PREFILE_PAGES_FOUR_ROWS', file: 'src/app/S16Terminal.tsx', from: 'const pageSize = 5', to: 'const pageSize = 4' },
  { id: 'EXPLORE_HIDES_ONE_QUESTION', file: 'src/app/S16Terminal.tsx', from: 'S16_EXPLORE_QUESTIONS[approach].map', to: 'S16_EXPLORE_QUESTIONS[approach].slice(0, 2).map' },
  { id: 'EXPLORE_APPROACH_BUTTON_IS_DEAD', file: 'src/app/S16Terminal.tsx', from: "onClick={() => { setApproach(item); setView('QUESTIONS') }}", to: 'onClick={() => setApproach(item)}' },
  { id: 'PREFILE_SOURCE_LEAKS_GRADE', file: 'src/app/S16Terminal.tsx', from: 'No evidence grade, semantic role, route recommendation, or proof eligibility is assigned here.', to: 'Evidence grade and proof eligibility are shown here.' },
  { id: 'SOURCE_HIDES_TRANSACTION_HASH', file: 'src/app/S16Terminal.tsx', from: 'label="Transaction hash"', to: 'label="Receipt"' },
  { id: 'DENSE_UNDO_CONTROL_RETURNS', file: 'src/app/S16Terminal.tsx', from: '<span>POWERED BY NANSEN API</span>', to: '<span>UNDO</span>' },
  { id: 'LEDGER_CONFLATES_RECEIPTS_WITH_RECORDS', file: 'src/app/S16Terminal.tsx', from: 'runtime.metrics.callAtlasReceipts', to: 'runtime.metrics.filterSequence[0]' },
  { id: 'CRITICAL_BODY_SCROLLS', file: 'src/app/terminal-viewport.css', from: '.s16-body { position:relative; min-width:0; padding:4px 1px 17px; overflow:hidden; }', to: '.s16-body { position:relative; min-width:0; padding:4px 1px 17px; overflow:auto; }' },
  { id: 'RECORD_ROWS_EXCEED_FIT', file: 'src/app/terminal-viewport.css', from: 'height:14px; min-height:14px', to: 'height:17px; min-height:17px' },
  { id: 'QUERY_RECEIPT_EXCEEDS_FIT', file: 'src/app/terminal-viewport.css', from: '.s16-query-receipt { height:92px', to: '.s16-query-receipt { height:96px' },
  { id: 'SCANLINES_BECOME_DOMINANT', file: 'src/app/terminal-viewport.css', from: 'rgba(210,255,240,.018) 0,rgba(210,255,240,.018) 1px', to: 'rgba(210,255,240,.18) 0,rgba(210,255,240,.18) 1px' },
  { id: 'CRT_FLICKER_BECOMES_RAPID', file: 'src/app/terminal-viewport.css', from: 's16-crt-flicker 17s', to: 's16-crt-flicker 1s' },
  { id: 'DEGAUSS_EXCEEDS_THREE_SECONDS', file: 'src/app/TerminalViewport.tsx', from: '}, 1800)', to: '}, 18000)' },
  { id: 'DEGAUSS_FOCUS_NOT_FRAME_RESTORED', file: 'src/app/TerminalViewport.tsx', from: 'window.requestAnimationFrame', to: 'window.setTimeout' },
  { id: 'DEGAUSS_ALLOWS_REENTRY', file: 'src/app/TerminalViewport.tsx', from: 'if (degaussing) return', to: 'if (false) return' },
  { id: 'DEGAUSS_NEVER_ENTERS_ACTIVE_STATE', file: 'src/app/TerminalViewport.tsx', from: 'setDegaussing(true)', to: 'setDegaussing(false)' },
  { id: 'DEGAUSS_MUTATES_PERSISTENCE', file: 'src/app/TerminalViewport.tsx', from: 'setDegaussing(true)', to: "setDegaussing(true)\n    window.localStorage.setItem('degauss', '1')" },
  { id: 'DEGAUSS_REGRESSES_TO_PROVIDER_NETWORK', file: 'src/app/TerminalViewport.tsx', from: 'setDegaussing(true)', to: "setDegaussing(true)\n    void fetch('/provider')" },
]

function run(command, args, cwd = repo) {
  return spawnSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env, CI: '1' } })
}

function replaceExactlyOnce(path, from, to) {
  const source = readFileSync(path, 'utf8')
  const first = source.indexOf(from)
  if (first < 0 || source.indexOf(from, first + from.length) >= 0) throw new Error(`Mutation anchor is not unique: ${relative(checkout, path)} :: ${from}`)
  writeFileSync(path, source.slice(0, first) + to + source.slice(first + from.length))
  return source
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
  const sourceModules = join(repo, 'node_modules')
  const checkoutModules = join(checkout, 'node_modules')
  if (!existsSync(checkoutModules)) symlinkSync(sourceModules, checkoutModules, 'dir')

  const test = () => run(join(checkout, 'node_modules/.bin/vitest'), ['run', testPath], checkout)
  const baseline = test()
  raw.push(`===== BASELINE =====\n${baseline.stdout}${baseline.stderr}`)
  if (baseline.status !== 0) throw new Error('Mutation baseline did not pass')

  for (const mutation of mutations) {
    const target = join(checkout, mutation.file)
    const original = replaceExactlyOnce(target, mutation.from, mutation.to)
    const result = test()
    writeFileSync(target, original)
    const killed = result.status !== 0
    results.push({ id: mutation.id, file: mutation.file, killed, exitCode: result.status })
    raw.push(`===== ${mutation.id} :: ${killed ? 'KILLED' : 'SURVIVED'} =====\n${result.stdout}${result.stderr}`)
  }

  mkdirSync(outputDir, { recursive: true })
  const killed = results.filter(result => result.killed).length
  const report = {
    schemaVersion: 's16-isolated-mutation-report.v1',
    isolation: 'detached-git-worktree',
    baseline: 'PASS',
    total: results.length,
    killed,
    survived: results.length - killed,
    score: killed / results.length,
    results,
  }
  writeFileSync(join(outputDir, 'MUTATION_RESULTS.json'), `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(join(outputDir, 'MUTATION_RESULTS.md'), `# S16 isolated mutation qualification\n\n- Baseline: PASS\n- Isolation: detached Git worktree\n- Mutations: ${results.length}\n- Killed: ${killed}\n- Survived: ${results.length - killed}\n- Score: ${(100 * killed / results.length).toFixed(1)}%\n\n${results.map(result => `- ${result.killed ? 'PASS' : 'FAIL'} — ${result.id} — ${result.file}`).join('\n')}\n`)
  writeFileSync(join(outputDir, 'MUTATION_RAW.log'), `${raw.join('\n')}\n`)
  if (killed !== results.length) process.exitCode = 1
  console.log(JSON.stringify({ status: killed === results.length ? 'PASS' : 'FAIL', total: results.length, killed, survived: results.length - killed }))
} finally {
  if (worktreeAdded) run('git', ['worktree', 'remove', '--force', checkout])
  rmSync(tempRoot, { recursive: true, force: true })
}
