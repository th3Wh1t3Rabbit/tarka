import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateActionMatrixSources } from './action-matrix-source-validator.mjs'

const root = process.cwd()
const test = 'tests/unit/s14-r6-actual-action-matrix.test.ts'
const config = 'scripts/s14-r6/mutation-vitest.config.mjs'
const probes = [
  ['P01_TAKE_PEN_2_ONLY', 'TAKE_PEN_2_ACTUAL_NODE_MISMATCH'], ['P02_TAKE_FORM_2_ONLY', 'TAKE_FORM_2_ACTUAL_NODE_MISMATCH'],
  ['P03_NONPRIMARY_REPRIMAND', 'NONPRIMARY_REPRIMAND_ACTUAL_NODE_MISMATCH'], ['P04_PULL_CABINET_ONLY', 'PULL_CABINET_ACTUAL_NODE_MISMATCH'],
  ['P05_LOOK_MISC_ONLY', 'LOOK_MISC_ACTUAL_NODE_MISMATCH'], ['P06_OLD_PICKUP_BUG', 'OLD_PICKUP_ACTUAL_NODE_MISMATCH'],
  ['P07_PEN_LINE_TO_DEAD_END', 'PEN_PICKUP_OWNER_ACTUAL_NODE_MISMATCH'], ['P08_PRIORITY_INTERCEPT', 'PRECEDENCE_SELECTED_OWNER_MISMATCH'],
  ['P09_BREAK_ARTHUR_CANONICALIZATION', 'ARTHUR_USE_REDUCER_CANONICALIZATION_MISMATCH'], ['P10_BREAK_ACT_ON_ITEM', 'INVENTORY_ACT_ON_ITEM_MISMATCH'],
  ['P11_HERO_SELECTOR', 'HERO_COMPONENT_SELECTOR_MISMATCH'], ['P12_ENDING_SELECTOR', 'ENDING_COMPONENT_SELECTOR_MISMATCH'],
  ['P14_CUBE_REAL_ROUTE', 'RUBIKS_CUBE_REAL_ROUTE_MISMATCH'], ['P15_RUBBER_REAL_ROUTE', 'RUBBER_BAND_REAL_ROUTE_MISMATCH'],
  ['P16_REORDER_PANELS', 'ORDERED_PANEL_MISMATCH'], ['P17_OMIT_CONTINUATION', 'CONTINUATION_OMISSION_MISMATCH'],
]
const results = []
for (const [id, reason] of probes) {
  try {
    execFileSync(resolve(root, 'node_modules/.bin/vitest'), ['run', test, '--config', config, '--reporter=dot'], { cwd: root, env: { ...process.env, S14_R6_MUTATION: id }, stdio: 'pipe' })
    throw new Error(`FALSE_SUCCESS:${id}`)
  } catch (error) {
    if (String(error.message).includes('FALSE_SUCCESS')) throw error
    const output = `${error.stdout ?? ''}\n${error.stderr ?? ''}`
    if (!/AssertionError|expected|to deeply equal|to be|OFFICE_CHOREOGRAPHY_CONTRACT_DRIFT/.test(output)) throw new Error(`WRONG_REJECTION:${id}`)
    results.push({ id, status: 'REJECTED_BY_ACTUAL_PRODUCTION_EXECUTION', reason })
  }
}

const paths = ['src/adventure/r55ProductionRouteRegistry.ts', test, 'src/story/r55/runtimeAdapters.ts', 'src/app/productionCopySelectors.ts']
const base = Object.fromEntries(paths.map(path => [path, readFileSync(resolve(root, path), 'utf8')]))
for (const [id, reason, mutate] of [
  ['P18_HARDCODED_RECEIPT', 'HANDWRITTEN_OR_UNOBSERVED_RECEIPT', files => { files[test] = files[test].replace('actualObservedNodeOccurrences', 'hardcodedObservedOccurrences') }],
  ['P19_DIRECT_PROJECTION_ROUTE', 'DIRECT_PROJECTION_AS_ROUTE', files => { files[test] += "\nvoid r55SpeechByEvent('COPY.BACKGROUND:Global rules')\n" }],
  ['P20_FREE_FORM_LOOKUP', 'FREE_FORM_EVENT_LOOKUP', files => { files['src/story/r55/runtimeAdapters.ts'] += '\nr55SpeechByEvent(window.name)\n' }],
]) {
  const files = { ...base }
  mutate(files)
  try { validateActionMatrixSources(files); throw new Error(`FALSE_SUCCESS:${id}`) }
  catch (error) {
    if (String(error.message).includes('FALSE_SUCCESS')) throw error
    if (!String(error.message).includes(reason)) throw new Error(`WRONG_REJECTION:${id}:${error.message}`)
    results.push({ id, status: 'REJECTED_BY_ACTION_MATRIX_SOURCE_GATE', reason })
  }
}

const body = `${JSON.stringify({ schemaVersion: 's15-action-matrix-mutation-probes.v1', total: results.length, passed: results.length, results }, null, 2)}\n`
const output = resolve(root, process.env.S15_R1_WRITE_RECEIPT === '1' ? 'artifacts/s15-r1/RECEIPTS' : 'artifacts/s15/RECEIPTS')
mkdirSync(output, { recursive: true })
writeFileSync(resolve(output, 'ACTION_MATRIX_MUTATION_PROBES.json'), body)
console.log(`PASS_S15_ACTION_MATRIX_MUTATION_PROBES total=${results.length} sha256=${createHash('sha256').update(body).digest('hex')}`)
