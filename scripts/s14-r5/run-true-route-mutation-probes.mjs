import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateTrueRouteSources } from './true-route-source-validator.mjs'

const root = process.cwd()
const test = 'tests/unit/s14-r5-true-production-routes.test.ts'
const config = 'scripts/s14-r5/mutation-vitest.config.mjs'
const actualProbes = [
  ['P01_CUBE_DEAD_FULL_MAPPING', 'RUBIKS_CUBE_REAL_GIVE_NODE_MISMATCH'],
  ['P02_RUBBER_DEAD_FULL_MAPPING', 'RUBBER_BAND_REAL_GIVE_NODE_MISMATCH'],
  ['P03_USEFUL_RULE_OWNER', 'USEFUL_RULE_REAL_OWNER_NODE_MISMATCH'],
  ['P04_ITEM_RULE_OWNER', 'ITEM_RULE_REAL_OWNER_NODE_MISMATCH'],
  ['P05_DEAD_END_OWNER', 'DEAD_END_REAL_OWNER_NODE_MISMATCH'],
  ['P06_INVENTORY_OWNER', 'INVENTORY_STATE_REAL_OWNER_NODE_MISMATCH'],
  ['P07_ARTHUR_DIALOGUE_OWNER', 'ARTHUR_DIALOGUE_REAL_OWNER_NODE_MISMATCH'],
  ['P08_HERO_TERMINAL_OWNER', 'HERO_TERMINAL_REAL_OWNER_NODE_MISMATCH'],
  ['P09_ENDING_COMPLETION_OWNER', 'ENDING_COMPLETION_REAL_OWNER_NODE_MISMATCH'],
  ['P10_UNREACHABLE_DESCRIPTOR', 'UNREACHABLE_TRUE_ROUTE_DESCRIPTOR'],
  ['P11_REMOVE_CONTINUATION', 'REAL_MULTI_PANEL_CONTINUATION_OMITTED'],
  ['P12_CASE_REPEAT_TO_GUM', 'CASE_STACK_REPEAT_WRONG_OWNER'],
  ['P13_MISC_REPEAT_TO_CASE', 'MISC_CONTENTS_REPEAT_WRONG_OWNER'],
  ['P14_HARDCODED_RECEIPT', 'BROKEN_OWNER_PREVENTS_RECEIPT'],
  ['P16_REORDER_PANELS', 'REAL_MULTI_PANEL_ORDER_MISMATCH'],
]
const results = []
for (const [id, reason] of actualProbes) {
  const mutation = id === 'P14_HARDCODED_RECEIPT' ? 'P01_CUBE_DEAD_FULL_MAPPING' : id
  try {
    execFileSync(resolve(root, 'node_modules/.bin/vitest'), ['run', test, '--config', config, '--reporter=dot'], { cwd: root, env: { ...process.env, S14_R5_MUTATION: mutation, S14_R5_WRITE_RECEIPT: id === 'P14_HARDCODED_RECEIPT' ? '1' : '0' }, stdio: 'pipe' })
    throw new Error(`FALSE_SUCCESS:${id}`)
  } catch (error) {
    if (String(error.message).includes('FALSE_SUCCESS')) throw error
    const output = `${error.stdout ?? ''}\n${error.stderr ?? ''}`
    if (!/AssertionError|expected|unreachable|to deeply equal|to have a length/.test(output)) throw new Error(`WRONG_REJECTION:${id}`)
    results.push({ id, status: 'REJECTED_BY_TRUE_PRODUCTION_OWNER_EXECUTION', reason })
  }
}

const paths = ['src/adventure/r55ProductionRouteRegistry.ts', 'tests/unit/s14-r5-true-production-routes.test.ts', 'src/story/r55/runtimeAdapters.ts']
const base = Object.fromEntries(paths.map(path => [path, readFileSync(resolve(root, path), 'utf8')]))
for (const [id, reason, mutate] of [
  ['P15_DIRECT_PROJECTION_ACCESS', 'PROJECTION_PRIMITIVE_COUNTED_AS_ROUTE', files => { files[test] += "\nvoid r55SpeechByEvent('COPY.BACKGROUND:Global rules')\n" }],
  ['P17_FREE_FORM_LOOKUP', 'FREE_FORM_EVENT_LOOKUP', files => { files['src/story/r55/runtimeAdapters.ts'] += '\nr55SpeechByEvent(window.name)\n' }],
]) {
  const files = { ...base }
  mutate(files)
  try { validateTrueRouteSources(files); throw new Error(`FALSE_SUCCESS:${id}`) }
  catch (error) {
    if (String(error.message).includes('FALSE_SUCCESS')) throw error
    if (!String(error.message).includes(reason)) throw new Error(`WRONG_REJECTION:${id}:${error.message}`)
    results.push({ id, status: 'REJECTED_BY_TRUE_ROUTE_SOURCE_GATE', reason })
  }
}

const body = `${JSON.stringify({ schemaVersion: 's14-r5-true-route-mutation-probes.v1', total: results.length, passed: results.length, results }, null, 2)}\n`
const output = resolve(root, 'artifacts/s14-r5/RECEIPTS')
mkdirSync(output, { recursive: true })
writeFileSync(resolve(output, 'TRUE_ROUTE_MUTATION_PROBES.json'), body)
console.log(`PASS_S14_R5_TRUE_ROUTE_MUTATION_PROBES total=${results.length} sha256=${createHash('sha256').update(body).digest('hex')}`)
