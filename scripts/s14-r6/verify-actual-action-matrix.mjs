import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateActionMatrixSources } from './action-matrix-source-validator.mjs'

const root = process.cwd()
const sourcePaths = ['src/adventure/r55ProductionRouteRegistry.ts', 'tests/unit/s14-r6-actual-action-matrix.test.ts', 'src/story/r55/runtimeAdapters.ts', 'src/app/productionCopySelectors.ts']
validateActionMatrixSources(Object.fromEntries(sourcePaths.map(path => [path, readFileSync(resolve(root, path), 'utf8')])))
const s15r1 = process.env.S15_R1_WRITE_RECEIPT === '1'
const receiptDirectory = s15r1 ? 'artifacts/s15-r1/RECEIPTS' : 'artifacts/s15/RECEIPTS'
execFileSync(resolve(root, 'node_modules/.bin/vitest'), ['run', 'tests/unit/s14-r6-actual-action-matrix.test.ts', '--reporter=dot'], { cwd: root, env: { ...process.env, [s15r1 ? 'S15_R1_WRITE_RECEIPT' : 'S15_WRITE_RECEIPT']: '1' }, stdio: 'inherit' })
const receiptBytes = readFileSync(resolve(root, receiptDirectory, 'ACTUAL_ACTION_OBSERVATION_RECEIPT.json'))
const receipt = JSON.parse(receiptBytes)
const source = JSON.parse(readFileSync(resolve(root, receiptDirectory, 'SOURCE_COMPLETENESS_RECEIPT.json')))
const csv = readFileSync(resolve(root, receiptDirectory, 'ACTUAL_ACTION_OBSERVATIONS.csv'), 'utf8')
const rows = csv.trimEnd().split('\n')
if (source.executableCopyNodes !== 590 || source.eventGroups !== 163 || source.sourceSlices !== 220 || source.entrypointNodes !== 220 || source.continuationNodes !== 370) throw new Error('SOURCE_COMPLETENESS_TOTALS')
if (receipt.actualActionRouteTotal !== rows.length - 1 || receipt.usefulRuleIds.length !== 29 || receipt.itemRuleIds.length !== 6 || receipt.blockedInteractions.length !== 2 || receipt.canonicalUniqueObservedNodes !== 551 || receipt.actualObservedNodeOccurrences <= receipt.canonicalUniqueObservedNodes || receipt.accountedNodes !== 590 || !receipt.expectedEqualsActual) throw new Error('ACTUAL_ACTION_RECEIPT_TOTALS')
console.log(`PASS_S14_R6_ACTUAL_ACTION_MATRIX routes=${receipt.actualActionRouteTotal} occurrences=${receipt.actualObservedNodeOccurrences} unique=${receipt.canonicalUniqueObservedNodes} duplicates=${receipt.duplicateNodeOccurrences} accounted=${receipt.accountedNodes} receipt=${createHash('sha256').update(receiptBytes).digest('hex')}`)
