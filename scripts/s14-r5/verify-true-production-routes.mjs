import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateTrueRouteSources } from './true-route-source-validator.mjs'

const root = process.cwd()
const sourcePaths = ['src/adventure/r55ProductionRouteRegistry.ts', 'tests/unit/s14-r5-true-production-routes.test.ts', 'src/story/r55/runtimeAdapters.ts']
validateTrueRouteSources(Object.fromEntries(sourcePaths.map(path => [path, readFileSync(resolve(root, path), 'utf8')])))
execFileSync(resolve(root, 'node_modules/.bin/vitest'), ['run', 'tests/unit/s14-r5-true-production-routes.test.ts', '--reporter=dot'], { cwd: root, env: { ...process.env, S14_R5_WRITE_RECEIPT: '1' }, stdio: 'inherit' })
const receiptBytes = readFileSync(resolve(root, 'artifacts/s14-r5/RECEIPTS/TRUE_PRODUCTION_ROUTE_OBSERVATION_RECEIPT.json'))
const receipt = JSON.parse(receiptBytes)
const source = JSON.parse(readFileSync(resolve(root, 'artifacts/s14-r5/RECEIPTS/SOURCE_COMPLETENESS_RECEIPT.json')))
const csv = readFileSync(resolve(root, 'artifacts/s14-r5/RECEIPTS/TRUE_PRODUCTION_ROUTE_OBSERVATIONS.csv'), 'utf8')
const rows = csv.trimEnd().split('\n')
if (source.executableCopyNodes !== 590 || source.eventGroups !== 163 || source.sourceSlices !== 220 || source.entrypointNodes !== 220 || source.continuationNodes !== 370) throw new Error('SOURCE_COMPLETENESS_TOTALS')
if (receipt.registryRouteTotal !== rows.length - 1 || receipt.canonicalEventGroups !== 153 || receipt.canonicalObservedNodes !== 566 || receipt.canonicalUniqueObservedNodes !== 566 || receipt.authenticatedSharedAliasEvents !== 10 || receipt.authenticatedSharedAliasNodes !== 24 || receipt.accountedEventGroups !== 163 || receipt.accountedNodes !== 590 || !receipt.expectedEqualsActual) throw new Error('TRUE_ROUTE_RECEIPT_TOTALS')
for (const column of ['routeId', 'ownerFamily', 'ownerId', 'exactActionInput', 'exactStateFixture', 'expectedSourceSlices', 'expectedOrderedNodeIds', 'actualOrderedNodeIds', 'executingTestId']) if (!rows[0].includes(`"${column}"`)) throw new Error(`TRUE_ROUTE_CSV_COLUMN:${column}`)
console.log(`PASS_S14_R5_TRUE_PRODUCTION_ROUTES routes=${receipt.registryRouteTotal} canonicalNodes=${receipt.canonicalObservedNodes} aliases=${receipt.authenticatedSharedAliasEvents}/${receipt.authenticatedSharedAliasNodes} accounted=${receipt.accountedNodes} receipt=${createHash('sha256').update(receiptBytes).digest('hex')}`)
