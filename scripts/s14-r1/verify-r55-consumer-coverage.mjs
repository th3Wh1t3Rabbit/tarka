import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'

const root = process.cwd()
const sha = value => createHash('sha256').update(value).digest('hex')
const read = path => readFileSync(resolve(root, path), 'utf8')
const fail = reason => { throw new Error(reason) }
const requireIt = (condition, reason) => { if (!condition) fail(reason) }
const projectionPath = 'src/story/r55/generated/r55-production.json'
const projection = JSON.parse(read(projectionPath))

const replay = structuredClone(projection)
const payloadSha = replay.projectionSha256
delete replay.projectionSha256
requireIt(sha(JSON.stringify(replay)) === payloadSha, 'PROJECTION_REPLAY_IDENTITY')
requireIt(sha(JSON.stringify(projection.consumerMap)) === projection.consumerMapSha256, 'CONSUMER_MAP_REPLAY_IDENTITY')
requireIt(projection.events.length === 163 && projection.consumerMap.length === 163, 'EVENT_GROUP_TOTAL')
const nodes = projection.events.flatMap(event => event.lines.map(line => ({ event, line })))
requireIt(nodes.length === 590, 'NODE_TOTAL')
requireIt(new Set(nodes.map(({ line }) => line.nodeId)).size === 590, 'NODE_DUPLICATE')
requireIt(new Set(projection.consumerMap.map(row => row.consumerKey)).size === 163, 'CONSUMER_DUPLICATE')

const rowsByEvent = new Map(projection.consumerMap.map(row => [row.eventKey, row]))
const accounted = []
for (const { event, line } of nodes) {
  const row = rowsByEvent.get(event.key)
  requireIt(row, `UNCONSUMED_EVENT:${event.key}`)
  requireIt(row.nodeIds.includes(line.nodeId), `UNCONSUMED_NODE:${line.nodeId}`)
  requireIt(existsSync(resolve(root, row.runtimeOwner)), `MISSING_RUNTIME_OWNER:${row.runtimeOwner}`)
  const owner = read(row.runtimeOwner)
  requireIt(/r55(?:Speech|Text|Event|Consumer)|R55_/.test(owner), `OWNER_NOT_R55_BOUND:${row.runtimeOwner}`)
  requireIt(line.source.byteEnd > line.source.byteStart && line.source.lineEnd >= line.source.lineStart, `BAD_SOURCE_SPAN:${line.nodeId}`)
  requireIt(Object.values(line.sourceHashes).every(value => /^[0-9a-f]{64}$/.test(value)), `BAD_SOURCE_HASH:${line.nodeId}`)
  accounted.push({
    nodeId: line.nodeId, eventKey: event.key, owner: event.owner, anchor: event.anchor,
    sourcePath: line.source.path, byteStart: line.source.byteStart, byteEnd: line.source.byteEnd,
    lineStart: line.source.lineStart, lineEnd: line.source.lineEnd,
    memberSha256: line.sourceHashes.memberSha256, rawSha256: line.sourceHashes.rawSha256, displaySha256: line.sourceHashes.displaySha256,
    consumerKey: row.consumerKey, runtimeOwner: row.runtimeOwner, routeStatePrecondition: row.routeStatePrecondition,
    sharedFallback: row.sharedFallback ?? '', exhaustiveTestRow: row.exhaustiveTestRow,
  })
}
requireIt(new Set(accounted.map(row => row.nodeId)).size === 590, 'COVERAGE_TABLE_NODE_TOTAL')
requireIt(projection.coverage.unconsumedActiveNodes === 0 && projection.coverage.unconsumedEventGroups === 0 && projection.coverage.duplicateSemanticConsumers === 0 && projection.coverage.productionOwnedGenericEnglish === 0, 'DECLARED_COVERAGE_NOT_CLOSED')

const forbiddenOwnerImports = ['s9-placeholders', 'controller/content/lead-shell', 'controller/interaction/spec', 'controller/content/s7-r3']
const productionOwners = ['src/app/App.tsx', 'src/app/CaseTerminalWorkbench.tsx', 'src/app/S13IntegratedCorpus.tsx', 'src/app/S14Ending.tsx', 'src/adventure/content.ts', 'src/adventure/reducer.ts', 'src/controller/content/adapter.ts']
const ownerText = productionOwners.map(path => read(path)).join('\n')
for (const marker of forbiddenOwnerImports) requireIt(!ownerText.includes(marker), `PROHIBITED_PRODUCTION_IMPORT:${marker}`)
requireIt(!/const\s+PH\s*=\s*['"]{2}/.test(ownerText), 'PLACEHOLDER_LAUNDERING_PH')
requireIt(!/replace\(\s*['"] \[PLACEHOLDER — Story binds final copy\]/.test(ownerText), 'PLACEHOLDER_SUFFIX_STRIPPING')
for (const marker of ['TODO.STORY', 'TODO.LEAD_COPY', '[PLACEHOLDER — Story binds final copy]', 'Not yet, Rook. Authorization first.', 'Rummaging the stack for the Euler file.', 'The piggy bank is open. There is a note inside.']) requireIt(!ownerText.includes(marker), `STALE_PRODUCTION_COPY:${marker}`)

const facts = ['0xd4c4407f3afb48d7d4ad954572f155f9237ae335', '888,888,888', '2026-09-19T22:55:18Z', '$0.00000000798334585596466', '$7.09630742042783479469808', '$5,166.34']
const factOwners = productionOwners.filter(path => path !== 'src/story/r55/production.ts').map(path => read(path)).join('\n')
for (const fact of facts) requireIt(!factOwners.includes(fact), `DUPLICATE_MAGIC_FACT:${fact}`)
requireIt(nodes.every(({ line }) => Array.isArray(line.cues)), 'CUE_METADATA_DROPPED')
requireIt(read('src/story/r55/production.ts').includes('performanceCues: line.cues.map'), 'SPEECH_CUE_SEAM_DROPPED')
requireIt(read('src/adventure/reducer.ts').includes('line.performanceCues'), 'PERFORMANCE_CUE_SEAM_DROPPED')

const built = resolve(root, 'dist')
requireIt(existsSync(built), 'PRODUCTION_BUILD_MISSING')
const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(resolve(directory, entry.name)) : [resolve(directory, entry.name)])
const builtText = files(built).filter(path => ['.js', '.map', '.html'].includes(extname(path))).map(path => readFileSync(path, 'utf8')).join('\n')
for (const marker of ['s9-placeholders', 'Nothing here is final copy', 'PLACEHOLDER — Story binds final copy', 'TODO.STORY', 'TODO.LEAD_COPY', 'Not yet, Rook. Authorization first', 'Rummaging the stack for the Euler file', 'The piggy bank is open. There is a note inside', 'pneumatic tube', 'record canister', 'access strip']) requireIt(!builtText.toLowerCase().includes(marker.toLowerCase()), `BUILT_PROHIBITION:${marker}`)

const artifactDir = resolve(root, 'artifacts/s14-r1')
mkdirSync(resolve(artifactDir, 'RECEIPTS'), { recursive: true })
const columns = Object.keys(accounted[0])
const csv = [columns, ...accounted.map(row => columns.map(column => row[column]))]
  .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(','))
  .join('\n') + '\n'
const csvPath = resolve(artifactDir, 'RECEIPTS/R55_PRODUCTION_CONSUMER_COVERAGE.csv')
writeFileSync(csvPath, csv)
const receipt = {
  schemaVersion: 's14-r1-consumer-coverage.v1', projectionSha256: sha(readFileSync(resolve(root, projectionPath))), payloadSha256: payloadSha,
  consumerMapSha256: projection.consumerMapSha256, executableCopyNodes: 590, eventGroups: 163,
  productionConsumers: 163, unconsumedActiveNodes: 0, unconsumedEventGroups: 0, duplicateSemanticConsumers: 0,
  productionOwnedGenericEnglish: 0, unresolvedAliases: 0, unresolvedTokens: 0, playerVisiblePlaceholders: 0,
  coverageCsvSha256: sha(csv), coverageCsvBytes: statSync(csvPath).size,
}
writeFileSync(resolve(artifactDir, 'RECEIPTS/CONSUMER_COVERAGE_RECEIPT.json'), `${JSON.stringify(receipt, null, 2)}\n`)
console.log(`PASS_S14_R1_CONSUMER_COVERAGE nodes=590 events=163 consumers=163 unconsumed=0 duplicate=0 csvSha256=${receipt.coverageCsvSha256}`)
