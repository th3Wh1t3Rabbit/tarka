import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const registryPath = resolve(root, 'src/story/r55/generated/r55-registry.json')
const ledgerPath = resolve(root, 'src/story/r55/generated/r55-source-ledger.json')
const provenancePath = resolve(root, 'src/story/r55/generated/r55-provenance.json')
const outputPath = resolve(root, 'src/story/r55/generated/r55-production.json')

const sha256 = value => createHash('sha256').update(value).digest('hex')
const bytes = path => readFileSync(path)
const parse = path => JSON.parse(readFileSync(path, 'utf8'))
const stable = value => JSON.stringify(value, Object.keys(value).sort())
const slug = value => value.normalize('NFKD').replace(/[^\p{Letter}\p{Number}]+/gu, '.').replace(/^\.+|\.+$/g, '').toLowerCase()

const registryBytes = bytes(registryPath)
const ledgerBytes = bytes(ledgerPath)
const provenanceBytes = bytes(provenancePath)
const registry = JSON.parse(registryBytes)
const ledger = JSON.parse(ledgerBytes)
const provenance = JSON.parse(provenanceBytes)

const expected = {
  registry: 'afb12dd571a083f577a341cf209150a0302152843171c1e7f996976843702052',
  archive: '8613c16b6f7df8fcae312b71237729b34eb4fd01619085c3ed0d28d336b01771',
  a1: 'c665ad8150efb170452d177aba9cfa63be79ee3b9774dc15d1c2ecff850cfca5',
}

if (sha256(registryBytes) !== expected.registry) throw new Error('R55 registry identity mismatch')
if (registry.archiveSha256 !== expected.archive || provenance.archiveSha256 !== expected.archive) throw new Error('R55 archive identity mismatch')
if (registry.a1.sha256 !== expected.a1 || provenance.a1Sha256 !== expected.a1) throw new Error('R55 A1 identity mismatch')
if (provenance.sourceLedgerSha256 !== sha256(ledgerBytes)) throw new Error('R55 source-ledger identity mismatch')

const ledgerById = new Map(ledger.entries.map(entry => [entry.id, entry]))
if (ledgerById.size !== ledger.entries.length) throw new Error('Duplicate R55 source-ledger id')

const nodes = registry.graph.nodes.filter(node => node.owner !== 'STATE_MACHINE')
const seenNodes = new Set()
for (const node of nodes) {
  if (seenNodes.has(node.id)) throw new Error(`Duplicate R55 node ${node.id}`)
  seenNodes.add(node.id)
  const source = ledgerById.get(node.ledgerId)
  if (!source) throw new Error(`Missing source-ledger row for ${node.id}`)
  for (const key of ['path', 'byteStart', 'byteEnd', 'lineStart', 'lineEnd']) {
    if (source[key] !== node.source[key]) throw new Error(`Source ${key} mismatch for ${node.id}`)
  }
  if (source.owner !== node.owner || source.anchor !== node.anchor || (node.kind === 'dialogueLine' && source.speaker !== node.speaker)) throw new Error(`Semantic owner mismatch for ${node.id}`)
  if (sha256(source.displayText) !== source.displaySha256) throw new Error(`Display hash mismatch for ${node.id}`)
  if (node.kind === 'dialogueLine' && source.displayText !== node.text) throw new Error(`Dialogue copy mismatch for ${node.id}`)
  if (sha256(source.rawText) !== source.rawSha256) throw new Error(`Raw source hash mismatch for ${node.id}`)
  if (!Array.isArray(node.cues) || node.cues.some(cue => cue.changesStoryMeaning !== false)) throw new Error(`Unsafe cue metadata for ${node.id}`)
  if (node.playableMission02) throw new Error(`Playable Mission 02 node ${node.id}`)
}

const eventKey = (owner, anchor) => `${owner}:${anchor}`
const events = []
const eventIndex = new Map()
for (const node of nodes) {
  const key = eventKey(node.owner, node.anchor)
  let event = eventIndex.get(key)
  if (!event) {
    event = { key, owner: node.owner, anchor: node.anchor, lines: [] }
    eventIndex.set(key, event)
    events.push(event)
  }
  const source = ledgerById.get(node.ledgerId)
  event.lines.push({
    nodeId: node.id,
    ledgerId: node.ledgerId,
    kind: node.kind,
    speaker: node.speaker,
    text: node.kind === 'dialogueLine' ? node.text : source.displayText,
    source: node.source,
    sourceHashes: { memberSha256: source.memberSha256, rawSha256: source.rawSha256, displaySha256: source.displaySha256 },
    cues: node.cues,
    hotspotIds: node.hotspotIds,
    inventoryIds: node.inventoryIds,
    entrypoint: node.entrypoint,
  })
}

const sourceSlices = events.flatMap(event => {
  const starts = event.lines.map((line, index) => line.entrypoint ? index : -1).filter(index => index >= 0)
  if (starts[0] !== 0) throw new Error(`R55 event does not begin at an entrypoint: ${event.key}`)
  return starts.map((startIndex, sliceIndex) => {
    const endIndex = starts[sliceIndex + 1] ?? event.lines.length
    const lines = event.lines.slice(startIndex, endIndex)
    return {
      routeId: `r55.slice.${lines[0].nodeId}`,
      eventKey: event.key,
      owner: event.owner,
      anchor: event.anchor,
      entryNodeId: lines[0].nodeId,
      startIndex,
      endIndex,
      nodeIds: lines.map(line => line.nodeId),
    }
  })
})
const entrypointNodes = nodes.filter(node => node.entrypoint).length
const continuationNodes = nodes.length - entrypointNodes
if (sourceSlices.length !== entrypointNodes || entrypointNodes !== 220 || continuationNodes !== 370) throw new Error('R55 source-slice boundary totals changed')
if (new Set(sourceSlices.flatMap(slice => slice.nodeIds)).size !== nodes.length) throw new Error('R55 source slices do not partition every executable node')

const aliases = {
  'opening.a1_1': ['COPY.A1', 'A1.1 — Arrival'],
  'opening.a1_2': ['COPY.A1', 'A1.2 — Arthur / Mr. A'],
  'opening.a1_3': ['COPY.A1', 'A1.3 — Forgotten brief'],
  'opening.a1_4': ['COPY.A1', 'A1.4 — Euler, blockchain, Nansen'],
  'opening.a1_5': ['COPY.A1', 'A1.5 — Authorization instructions'],
  'hero.prebrief': ['COPY.HERO', 'Prebrief entry — authorized, no Euler file, no BRCG lead'],
  'hero.delta_1': ['COPY.HERO', 'Evidence Delta 1'],
  'hero.delta_2': ['COPY.HERO', 'Evidence Delta 2'],
  'hero.theory_resolution': ['COPY.HERO', 'Theory resolution'],
  'brcg.note': ['COPY.BRCG', 'Unread Note — LOOK AT'],
  'brcg.payoff': ['COPY.BRCG', 'One-Time World-Side Payoff'],
  'brcg.untested': ['COPY.BRCG', 'Read, BRCG untested'],
  'brcg.resolved': ['COPY.BRCG', 'BRCG resolved'],
  'ending.universal': ['COPY.END', 'Exact copy'],
  'ending.friendship': ['COPY.END', '3. Friendship and pizza continuation'],
  'ending.default': ['COPY.END', '4.1 Default ending — BRCG not completed'],
  'ending.brcg': ['COPY.END', '4.2 BRCG-completed ending'],
}
const resolvedAliases = {}
for (const [alias, pair] of Object.entries(aliases)) {
  const key = eventKey(...pair)
  if (!eventIndex.has(key)) throw new Error(`Missing required R55 binding ${alias}`)
  if (resolvedAliases[alias]) throw new Error(`Duplicate R55 binding ${alias}`)
  resolvedAliases[alias] = key
}

const countSlots = Object.fromEntries(registry.countSlots.map(slot => [slot.token, slot.value]))
const requiredSlots = {
  '{{E03_Q1_PRIOR_ACCEPTED_COUNT}}': 98,
  '{{E03_Q2_PRIOR_ACCEPTED_COUNT}}': 3,
  '{{E03_Q2_CURRENT_ACCEPTED_COUNT}}': 2,
}
for (const [token, value] of Object.entries(requiredSlots)) if (countSlots[token] !== value) throw new Error(`Unresolved exact-copy token ${token}`)

const sharedAliases = {
  'COPY.A1:GIVE to Arthur or attempt to return/use with inkwell': 'COPY.INVENTORY:GIVE to Arthur / return to inkwell',
  'COPY.INVENTORY:USE with Arthur': 'COPY.INVENTORY:GIVE to Arthur',
  'COPY.INVENTORY:USE HAMMER WITH PIGGY BANK': 'COPY.BRCG:Hammer + Piggy Bank',
  'COPY.INVENTORY:Read, BRCG untested — LOOK AT': 'COPY.BRCG:Read, BRCG untested',
  'COPY.INVENTORY:BRCG resolved — LOOK AT': 'COPY.BRCG:BRCG resolved',
  'COPY.REPEAT:After Question 1, before Question 2 completes': 'COPY.HERO:Evidence Delta 1',
  'COPY.REPEAT:After Question 2, before Question 3 completes': 'COPY.HERO:Evidence Delta 2',
  'COPY.REPEAT:After Question 3, before proof assembly completes': 'COPY.HERO:Theory resolution',
  'COPY.ARTHUR:Approved Authorization Form with Doodles': 'COPY.INVENTORY:GIVE to Arthur',
  'COPY.ARTHUR:Poorly Mishandled Broken Feather Pen': 'COPY.INVENTORY:GIVE to Arthur / return to inkwell',
}
const eventByKey = new Map(events.map(event => [event.key, event]))
for (const [aliasKey, canonicalKey] of Object.entries(sharedAliases)) {
  const aliasEvent = eventByKey.get(aliasKey)
  const canonicalEvent = eventByKey.get(canonicalKey)
  if (!aliasEvent || !canonicalEvent) throw new Error(`Missing shared-alias endpoint ${aliasKey} -> ${canonicalKey}`)
  const semantic = lines => lines.map(line => [line.speaker, line.text])
  if (JSON.stringify(semantic(aliasEvent.lines)) !== JSON.stringify(semantic(canonicalEvent.lines))) throw new Error(`Shared alias differs semantically: ${aliasKey}`)
}
const sharedEventAliases = Object.entries(sharedAliases).map(([eventKey, targetEventKey]) => ({
  eventKey,
  targetEventKey,
  aliasSourceNodeIds: eventByKey.get(eventKey).lines.map(line => line.nodeId),
  semanticReceiptSha256: sha256(JSON.stringify(eventByKey.get(eventKey).lines.map(line => [line.speaker, line.text]))),
}))

const receipt = row => ({
  nodeId: row.id,
  owner: row.owner,
  anchor: row.anchor,
  source: { path: row.path, byteStart: row.byteStart, byteEnd: row.byteEnd, lineStart: row.lineStart, lineEnd: row.lineEnd },
  sourceHashes: { memberSha256: row.memberSha256, rawSha256: row.rawSha256, displaySha256: row.displaySha256 },
})
const exactLedger = (owner, text, anchor = null) => {
  const matches = ledger.entries.filter(row => row.owner === owner && row.displayText === text && (!anchor || row.anchor === anchor))
  if (matches.length !== 1) throw new Error(`Expected one source-bound value for ${owner}:${anchor ?? '*'}:${text}; found ${matches.length}`)
  return matches[0]
}
const sourceValue = (owner, value, anchor = null) => ({ value, receipt: receipt(exactLedger(owner, value, anchor)) })
const truthMember = ledger.entries.find(row => row.path === 'MAIN_INTEGRATION/07_TRUTH_DATA_AND_PROVENANCE_CONTRACT.md' && row.anchor === 'member')
if (!truthMember) throw new Error('Missing R55 structured truth authority')
const truth = truthMember.displayText
const truthValue = (label, pattern, expectedValue) => {
  const match = truth.match(pattern)
  if (!match || match[1] !== expectedValue) throw new Error(`R55 structured fact mismatch: ${label}`)
  return { value: match[1], receipt: receipt(truthMember), derivation: `regex:${label}` }
}
const structured = {
  brcg: {
    symbol: { value: 'BRCG', receipt: receipt(truthMember), derivation: 'truth-contract:symbol' },
    name: sourceValue('COPY.BRCG', 'BITCOIN ROLLER COASTER GUY', 'Token Result'),
    contract: truthValue('contract', /contract=(0x[0-9a-f]{40})/, '0xd4c4407f3afb48d7d4ad954572f155f9237ae335'),
    quantity: { ...sourceValue('COPY.BRCG', '888,888,888 BRCG', 'Token Result'), value: '888,888,888', derivation: 'strip trailing symbol' },
    snapshot: sourceValue('COPY.BRCG', '2026-09-19T22:55:18Z'),
    unitPrice: sourceValue('COPY.BRCG', '$0.00000000798334585596466'),
    theoreticalValue: sourceValue('COPY.BRCG', '$7.09630742042783479469808'),
    summaryValue: sourceValue('COPY.BRCG', 'ABOUT $7.10', 'Token Result'),
    liquidity: sourceValue('COPY.BRCG', 'ABOUT $5,166'),
    exactLiquidity: truthValue('liquidity', /liquidity=(\$[0-9,.]+)/, '$5,166.34'),
    buyers7d: { ...sourceValue('COPY.BRCG', 'BUYERS...................... 0'), value: '0', derivation: 'strip metric label' },
    sellers7d: { ...sourceValue('COPY.BRCG', 'SELLERS.................... 22'), value: '22', derivation: 'strip metric label' },
    volume7d: { ...sourceValue('COPY.BRCG', 'TRADING VOLUME......... $13.16'), value: '$13.16', derivation: 'strip metric label' },
    netflow7d: { ...sourceValue('COPY.BRCG', 'NET FLOW............... $13.16 OUT'), value: '$13.16 OUT', derivation: 'strip metric label' },
  },
  completion: {
    title: { value: registry.title.displayWordmark, receipt: { registrySha256: expected.registry, field: 'title.displayWordmark' } },
    recordLabel: sourceValue('COPY.END', 'CASE RECORD'),
    closedLabel: sourceValue('COPY.END', 'CASE CLOSED'),
    caseName: sourceValue('COPY.END', 'THE FALSE EXIT'),
    caseSolved: sourceValue('COPY.END', 'EULER CASE....................... SOLVED'),
    exactReceipt: sourceValue('COPY.END', 'EXACT RECEIPT.................... FOUND'),
    findingLine1: sourceValue('COPY.END', 'FINDING.......................... THE FIRST TRAIL'),
    findingLine2: sourceValue('COPY.END', 'JOINED THE SECOND ROUTE.'),
    sideLead: {
      RESOLVED: sourceValue('COPY.END', 'BITCOIN ROLLER COASTER GUY....... RESOLVED'),
      BRCG_UNRESOLVED: sourceValue('COPY.END', 'BITCOIN ROLLER COASTER GUY....... UNRESOLVED'),
      NOTE_UNRESOLVED: sourceValue('COPY.END', 'MYSTERIOUS NOTE.................. UNRESOLVED'),
      UNDISCOVERED: sourceValue('COPY.END', 'UNDISCOVERED'),
    },
    unresolvedPrompt: [sourceValue('COPY.END', 'A DIFFERENT INVESTIGATION'), sourceValue('COPY.END', 'MAY REVEAL MORE.')],
    competition: [sourceValue('COPY.END', 'CREATED FOR THE'), sourceValue('COPY.END', 'NANSEN MERIDIAN BUILDATHON'), sourceValue('COPY.END', 'SEPTEMBER 14–27, 2026')],
    attribution: sourceValue('COPY.END', 'POWERED BY NANSEN API'),
    thanks: sourceValue('COPY.END', 'THANKS FOR PLAYING'),
    stinger: [sourceValue('COPY.END', 'CASE FILE 02...................... SEALED'), sourceValue('COPY.END', 'FUTURE ACCESS..................... PENDING')],
    resetTitle: sourceValue('COPY.END', 'START A NEW INVESTIGATION?'),
    resetConfirm: sourceValue('COPY.END', '[ START OVER ]'),
    resetCancel: sourceValue('COPY.END', '[ CANCEL ]'),
  },
  e03: Object.fromEntries(Object.entries(requiredSlots).map(([token, value]) => [token, { value, receipt: { registrySha256: expected.registry, field: `countSlots:${token}` } }])),
}

const projection = {
  schemaVersion: 's14-r4-authority-projection.v1',
  activation: 'PRODUCTION_ACTIVE_S14',
  authority: {
    archiveSha256: expected.archive,
    registrySha256: expected.registry,
    sourceLedgerSha256: sha256(ledgerBytes),
    provenanceSha256: sha256(provenanceBytes),
    a1Sha256: expected.a1,
  },
  identity: { publicTitle: registry.title.publicTitle, displayWordmark: registry.title.displayWordmark },
  countSlots,
  mission02: { playable: false, stingerText: registry.mission02.stingerText },
  aliases: resolvedAliases,
  events,
  sourceSlices,
  sharedEventAliases,
  structured,
  coverage: {
    sourceGraphNodes: registry.graph.nodes.length,
    executableCopyNodes: nodes.length,
    eventGroups: events.length,
    sourceSlices: sourceSlices.length,
    entrypointNodes,
    continuationNodes,
    missing: 0,
    duplicateNodes: 0,
    unresolvedTokens: 0,
    playerVisibleFallbacks: 0,
    authenticatedSharedAliases: sharedEventAliases.length,
    productionOwnedGenericEnglish: 0,
  },
}
const payload = JSON.stringify(projection)
projection.projectionSha256 = sha256(payload)
writeFileSync(outputPath, `${JSON.stringify(projection, null, 2)}\n`)

const replay = parse(outputPath)
const replayHash = replay.projectionSha256
delete replay.projectionSha256
if (sha256(JSON.stringify(replay)) !== replayHash) throw new Error('Projection replay identity mismatch')
console.log(`PASS_S14_R55_PROJECTION nodes=${nodes.length} events=${events.length} aliases=${sharedEventAliases.length} sha256=${sha256(bytes(outputPath))} payload=${replayHash}`)
