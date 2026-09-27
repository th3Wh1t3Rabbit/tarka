import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'

const projection = JSON.parse(readFileSync('src/story/r55/generated/r55-production.json', 'utf8'))
const sourcePaths = ['src/adventure/content.ts', 'src/adventure/reducer.ts', 'src/story/r55/production.ts', 'src/controller/content/adapter.ts', 'src/app/App.tsx', 'src/app/CaseTerminalWorkbench.tsx', 'src/app/S13IntegratedCorpus.tsx', 'src/app/S14Ending.tsx']
const sources = Object.fromEntries(sourcePaths.map(path => [path, readFileSync(path, 'utf8')]))
const distText = readFileSync('dist/index.html', 'utf8') + readdirSync('dist/assets').filter(name => /\.js(?:\.map)?$/.test(name)).map(name => readFileSync(`dist/assets/${name}`, 'utf8')).join('\n')
const clone = value => structuredClone(value)
const fail = reason => { throw new Error(reason) }
const requireIt = (condition, reason) => { if (!condition) fail(reason) }

function validate(model, files, output) {
  const nodes = model.events.flatMap(event => event.lines.map(line => ({ event, line })))
  requireIt(nodes.length === 590, 'NODE_TOTAL')
  requireIt(model.events.length === 163, 'EVENT_TOTAL')
  requireIt(model.consumerMap.length === 163, 'CONSUMER_TOTAL')
  const consumers = new Map(model.consumerMap.map(row => [row.eventKey, row]))
  requireIt(consumers.size === 163, 'DUPLICATE_SEMANTIC_CONSUMER')
  for (const { event, line } of nodes) requireIt(consumers.get(event.key)?.nodeIds.includes(line.nodeId), `UNCONSUMED_NODE:${line.nodeId}`)
  requireIt(model.consumerMap.every(row => row.runtimeOwner && row.routeStatePrecondition && row.exhaustiveTestRow), 'INERT_ALIAS_NO_RUNTIME_OWNER')
  const source = Object.values(files).join('\n')
  requireIt(!/const\s+PH\s*=\s*['"]{2}/.test(source), 'PLACEHOLDER_LAUNDERING_PH')
  requireIt(!source.includes("replace(' [PLACEHOLDER — Story binds final copy]', '')"), 'PLACEHOLDER_SUFFIX_STRIPPING')
  requireIt(!source.includes('s9-placeholders') && !source.includes('controller/content/lead-shell') && !source.includes('controller/interaction/spec'), 'NONFINAL_PRODUCTION_IMPORT')
  requireIt(!source.includes('Not yet, Rook. Authorization first.'), 'GENERIC_TERMINAL_REPRIMAND')
  requireIt(!source.includes('Rummaging the stack for the Euler file.'), 'GENERIC_CASE_SEARCH')
  requireIt(!source.includes('The piggy bank is open. There is a note inside.'), 'GENERIC_PIGGY_SMASH')
  requireIt(!source.includes('A placeholder-only office globe.'), 'GENERIC_BACKGROUND_LABEL')
  requireIt(!source.includes('The official case-file cabinet. The Euler file. Then the terminal.'), 'GENERIC_ARTHUR_GUIDANCE')
  for (const key of ['COPY.HERO:Prebrief entry — authorized, no Euler file, no BRCG lead', 'COPY.HERO:Evidence Delta 1', 'COPY.HERO:Evidence Delta 2', 'COPY.HERO:Theory resolution']) requireIt(source.includes(key), `HERO_EVENT_NOT_CONSUMED:${key}`)
  for (const key of ['COPY.BRCG:Read, BRCG untested', 'COPY.BRCG:BRCG resolved']) requireIt(source.includes(key), `BRCG_EVENT_NOT_CONSUMED:${key}`)
  for (const fact of ['0xd4c4407f3afb48d7d4ad954572f155f9237ae335', '$5,166.34']) requireIt(!Object.entries(files).filter(([path]) => !path.endsWith('/production.ts')).some(([, value]) => value.includes(fact)), `MAGIC_BRCG_FACT:${fact}`)
  requireIt(!Object.entries(files).filter(([path]) => !path.endsWith('/production.ts')).some(([, value]) => value.includes('BITCOIN ROLLER COASTER GUY....... RESOLVED')), 'MAGIC_COMPLETION_SUMMARY')
  requireIt(model.events.every(event => event.lines.every(line => Array.isArray(line.cues))), 'CUE_METADATA_DROPPED')
  requireIt(files['src/story/r55/production.ts'].includes('performanceCues: line.cues.map') && files['src/adventure/reducer.ts'].includes('line.performanceCues'), 'CUE_BOUNDARY_DROPPED')
  requireIt(new Set(nodes.map(({ line }) => line.nodeId)).size === 590, 'DUPLICATE_NODE_ASSIGNMENT')
  requireIt(!output.match(/TODO\.STORY|PLACEHOLDER — Story binds final copy|pneumatic tube|record canister|access strip/i), 'BUILT_PROHIBITED_STRING')
  requireIt(nodes.every(({ line }) => /^[0-9a-f]{64}$/.test(line.sourceHashes.displaySha256)), 'SOURCE_RECEIPT_CHANGED')
  requireIt(!source.includes("speaker: 'ROOK', text: 'Generic required route fallback.'"), 'GENERIC_REQUIRED_FALLBACK')
}

const probes = []
const modelProbe = (id, expected, mutate) => probes.push({ id, expected, run() { const model = clone(projection); mutate(model); validate(model, sources, distText) } })
const sourceProbe = (id, expected, path, mutate) => probes.push({ id, expected, run() { const files = { ...sources, [path]: mutate(sources[path]) }; validate(projection, files, distText) } })
const outputProbe = (id, expected, marker) => probes.push({ id, expected, run() { validate(projection, sources, `${distText}\n${marker}`) } })

modelProbe('P01', 'CONSUMER_TOTAL', model => model.consumerMap.pop())
modelProbe('P02', 'INERT_ALIAS_NO_RUNTIME_OWNER', model => { model.consumerMap[0].runtimeOwner = '' })
sourceProbe('P03', 'PLACEHOLDER_LAUNDERING_PH', 'src/adventure/content.ts', value => `${value}\nconst PH = ''\n`)
sourceProbe('P04', 'PLACEHOLDER_SUFFIX_STRIPPING', 'src/adventure/content.ts', value => `${value}\n'copy'.replace(' [PLACEHOLDER — Story binds final copy]', '')\n`)
sourceProbe('P05', 'NONFINAL_PRODUCTION_IMPORT', 'src/adventure/content.ts', value => `${value}\n// import s9-placeholders\n`)
sourceProbe('P06', 'GENERIC_TERMINAL_REPRIMAND', 'src/adventure/reducer.ts', value => `${value}\n// Not yet, Rook. Authorization first.\n`)
sourceProbe('P07', 'GENERIC_CASE_SEARCH', 'src/adventure/content.ts', value => `${value}\n// Rummaging the stack for the Euler file.\n`)
sourceProbe('P08', 'GENERIC_PIGGY_SMASH', 'src/adventure/content.ts', value => `${value}\n// The piggy bank is open. There is a note inside.\n`)
sourceProbe('P09', 'GENERIC_BACKGROUND_LABEL', 'src/adventure/content.ts', value => `${value}\n// A placeholder-only office globe.\n`)
sourceProbe('P10', 'GENERIC_ARTHUR_GUIDANCE', 'src/adventure/content.ts', value => `${value}\n// The official case-file cabinet. The Euler file. Then the terminal.\n`)
probes.push({ id: 'P11', expected: 'HERO_EVENT_NOT_CONSUMED', run() { const files = Object.fromEntries(Object.entries(sources).map(([path, value]) => [path, value.replaceAll('COPY.HERO:Prebrief entry — authorized, no Euler file, no BRCG lead', 'HERO_PREBRIEF_ALIAS_ONLY')])); validate(projection, files, distText) } })
sourceProbe('P12', 'BRCG_EVENT_NOT_CONSUMED', 'src/app/S13IntegratedCorpus.tsx', value => value.replaceAll('COPY.BRCG:Read, BRCG untested', 'BRCG_UNTESTED_ALIAS_ONLY'))
sourceProbe('P13', 'MAGIC_BRCG_FACT', 'src/app/S13IntegratedCorpus.tsx', value => `${value}\n// 0xd4c4407f3afb48d7d4ad954572f155f9237ae335\n`)
sourceProbe('P14', 'MAGIC_COMPLETION_SUMMARY', 'src/app/S14Ending.tsx', value => `${value}\n// BITCOIN ROLLER COASTER GUY....... RESOLVED\n`)
modelProbe('P15', 'CUE_METADATA_DROPPED', model => { delete model.events.find(event => event.lines.some(line => line.cues.length))?.lines.find(line => line.cues.length)?.cues })
modelProbe('P16', 'NODE_TOTAL', model => model.events[0].lines.pop())
modelProbe('P17', 'DUPLICATE_NODE_ASSIGNMENT', model => { model.events[0].lines[0].nodeId = model.events[0].lines[1].nodeId })
outputProbe('P18', 'BUILT_PROHIBITED_STRING', 'TODO.STORY.REINTRODUCED')
modelProbe('P19', 'SOURCE_RECEIPT_CHANGED', model => { model.events[0].lines[0].text += ' paraphrase'; model.events[0].lines[0].sourceHashes.displaySha256 = 'unchanged' })
sourceProbe('P20', 'GENERIC_REQUIRED_FALLBACK', 'src/adventure/content.ts', value => `${value}\nconst x = { speaker: 'ROOK', text: 'Generic required route fallback.' }\n`)
sourceProbe('P21', 'CUE_BOUNDARY_DROPPED', 'src/adventure/reducer.ts', value => value.replaceAll('line.performanceCues', 'undefined'))
modelProbe('P22', 'UNCONSUMED_NODE', model => { model.consumerMap[0].nodeIds.pop() })

const results = []
for (const probe of probes) {
  try { probe.run(); fail(`FALSE_SUCCESS:${probe.id}`) }
  catch (error) {
    const reason = String(error.message)
    requireIt(reason.includes(probe.expected), `WRONG_REJECTION:${probe.id}:${reason}`)
    results.push({ id: probe.id, status: 'REJECTED_FOR_INTENDED_SEMANTIC_REASON', reason: probe.expected })
  }
}
const receipt = JSON.stringify({ schemaVersion: 's14-r1-semantic-negative-probes.v1', total: results.length, passed: results.length, results })
console.log(receipt)
console.log(`PASS_S14_R1_NEGATIVE_PROBES total=${results.length} receiptSha256=${createHash('sha256').update(receipt).digest('hex')}`)
