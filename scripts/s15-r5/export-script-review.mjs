import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const OUT = resolve('review/s15-r5/SCRIPT_EXPORT/TARKA_SCRIPT_REVIEW_v1.1.0')
const PRIOR = resolve('review/s15-r4/SCRIPT_EXPORT/TARKA_SCRIPT_REVIEW_v1.0.0/TARKA_DIALOGUE_DELIVERIES.csv')
const VERBS = ['GIVE', 'PICK_UP', 'USE', 'OPEN', 'LOOK_AT', 'PUSH', 'CLOSE', 'TALK_TO', 'PULL']
const PHASES = ['START', 'FORM_HELD', 'PEN_HELD', 'FORM_AND_PEN', 'FORM_COMPLETED', 'FORM_SUBMITTED', 'COMPLETE']
const sha = value => createHash('sha256').update(value).digest('hex')
const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`
const csv = (rows, headers) => [headers.join(','), ...rows.map(row => headers.map(key => quote(row[key])).join(','))].join('\n') + '\n'
const baseKey = value => String(value ?? '').replace(/\.(?:provisional|delivery)-\d+$/, '')
const json = value => JSON.stringify(value)

function parseCsv(text) {
  const records = []; let row = []; let field = ''; let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted && char === '"' && text[index + 1] === '"') { field += '"'; index += 1 }
    else if (char === '"') quoted = !quoted
    else if (!quoted && char === ',') { row.push(field); field = '' }
    else if (!quoted && char === '\n') { row.push(field); records.push(row); row = []; field = '' }
    else if (char !== '\r') field += char
  }
  if (field || row.length) { row.push(field); records.push(row) }
  const headers = records.shift()
  return records.filter(record => record.some(Boolean)).map(record => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ''])))
}
function sourceState(name) {
  if (name === 'PREAUTH_CLOSED') return { phase: 'START', caseFileDrawer: 'CLOSED', miscDrawer: 'CLOSED', caseStack: 'UNSEARCHED', miscContents: 'UNCOLLECTED', lampPower: 'ON', lampSpeech: 0, globePose: 'IDLE', globeLevel: 0, globeMilestones: 0 }
  if (name === 'COMPLETE_OPEN') return { phase: 'COMPLETE', caseFileDrawer: 'OPEN', miscDrawer: 'OPEN', caseStack: 'UNSEARCHED', miscContents: 'UNCOLLECTED', lampPower: 'OFF', lampSpeech: 1, globePose: 'PUSH', globeLevel: 1, globeMilestones: 2 }
  if (name === 'COMPLETE_DEPLETED') return { phase: 'COMPLETE', caseFileDrawer: 'OPEN', miscDrawer: 'OPEN', caseStack: 'SEARCHED_EULER_REMOVED', miscContents: 'COLLECTED_GUM_REMAINS', lampPower: 'ON', lampSpeech: 2, globePose: 'PUSH', globeLevel: 3, globeMilestones: 14 }
  return { phase: 'COMPLETE', caseFileDrawer: 'CLOSED', miscDrawer: 'CLOSED', caseStack: 'UNSEARCHED', miscContents: 'UNCOLLECTED', lampPower: 'ON', lampSpeech: 0, globePose: 'IDLE', globeLevel: 0, globeMilestones: 0 }
}
function ruleMatches(rule, verb, target, state) {
  if (rule.verb !== verb || rule.targetId !== target || rule.itemId) return false
  if (rule.phase !== 'ANY' && rule.phase !== state.phase) return false
  if (rule.requiresDrawer && state[rule.requiresDrawer.drawer] !== rule.requiresDrawer.is) return false
  if (rule.requiresStack && state.caseStack !== rule.requiresStack) return false
  if (rule.requiresMisc && state.miscContents !== rule.requiresMisc) return false
  return true
}
function extractStaticUiCopy(source) {
  return [...source.matchAll(/>([^<>{}\n][^<>{}]*?)</g)].map(match => match[1].replace(/\s+/g, ' ').trim()).filter(text => text.length > 1 && !/^[-·:]+$/.test(text))
}

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })
const vite = await createServer({ logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' })
const [content, scenes, routes, dialogue] = await Promise.all([
  vite.ssrLoadModule('/src/adventure/content.ts'),
  vite.ssrLoadModule('/src/adventure/scenes.ts'),
  vite.ssrLoadModule('/src/adventure/r55ProductionRouteRegistry.ts'),
  vite.ssrLoadModule('/src/adventure/dialogueDelivery.ts'),
])

const prior = parseCsv(await readFile(PRIOR, 'utf8'))
const observed = []
const observedRouteIds = new Set()
for (const descriptor of routes.R55_ACTUAL_ACTION_MATRIX) {
  if (descriptor.ownerFamily === 'opening') continue
  observedRouteIds.add(descriptor.routeId)
  const result = routes.executeR55ActualAction(descriptor)
  for (const line of result.lines) observed.push({ line, routeId: descriptor.routeId, owner: result.selectedOwnerId, family: descriptor.ownerFamily })
}
for (const item of Object.values(content.inventoryItems)) for (const phase of PHASES) for (const verb of VERBS) {
  const state = { phase, piggyNoteReadState: phase === 'COMPLETE' ? 'BACK_READ' : 'UNREAD', brcgInvestigationState: phase === 'COMPLETE' ? 'RESOLVED' : 'UNTESTED', investigationMilestone: phase === 'COMPLETE' ? 'PROOF_COMPLETE' : 'BEFORE_Q1' }
  for (const line of dialogue.normalizeProductionDialogue(content.inventorySpeechForState(item.id, verb, state))) observed.push({ line, routeId: `inventory.${item.id}.${verb}.${phase}`, owner: 'inventorySpeechForState', family: 'inventory-state' })
}
const observedByBase = new Map()
for (const entry of observed) {
  const key = baseKey(entry.line.copyKey)
  const list = observedByBase.get(key) ?? []
  list.push(entry); observedByBase.set(key, list)
}

const deliveries = prior.map(row => {
  const matches = observedByBase.get(baseKey(row.node_id)) ?? []
  const exact = matches.filter(entry => entry.line.text === row.exact_text)
  const componentOnly = exact.length > 0 && exact.every(entry => ['hero-terminal', 'brcg-terminal', 'ending-completion'].includes(entry.family))
  const nonR55Active = !String(row.node_id).startsWith('r55-') && row.status !== 'DORMANT_SOURCE'
  const status = exact.length ? componentOnly ? 'ACTIVE_COMPONENT_COPY' : (exact.length > 1 ? 'SHARED_ACTIVE_ROUTE' : 'ACTIVE_RUNTIME')
    : matches.length ? 'SOURCE_ONLY_SPLIT_OWNER'
      : nonR55Active ? row.status : 'AUTHENTICATED_DORMANT'
  return {
    ...row,
    runtime_owner_id: exact.length ? [...new Set(exact.map(entry => entry.owner))].sort().join('|') : row.runtime_owner_id,
    route_or_state_precondition: exact.length ? [...new Set(exact.map(entry => entry.routeId))].sort().join('|') : row.route_or_state_precondition,
    status,
    one_line_measured_width_px: 0,
    one_line_available_width_px: 464,
    one_line_fit: status === 'AUTHENTICATED_DORMANT' || status === 'SOURCE_ONLY_SPLIT_OWNER',
    exact_split_owner: status === 'SOURCE_ONLY_SPLIT_OWNER' ? 'normalizeProductionDialogue' : status === 'ACTIVE_COMPONENT_COPY' ? 'TERMINAL_OR_ENDING_COMPONENT_LAYOUT' : '',
    measurement_font: "700 8px 'SFMono-Regular', Consolas, monospace",
  }
})
let nextId = Math.max(...deliveries.map(row => Number(row.delivery_id.replace(/\D/g, '')) || 0)) + 1
const existingPair = new Set(deliveries.map(row => `${row.node_id}\0${row.exact_text}`))
for (const entry of observed.sort((a, b) => `${a.routeId}\0${a.line.copyKey}\0${a.line.text}`.localeCompare(`${b.routeId}\0${b.line.copyKey}\0${b.line.text}`))) {
  const key = `${entry.line.copyKey}\0${entry.line.text}`
  if (existingPair.has(key)) continue
  existingPair.add(key)
  deliveries.push({
    delivery_id: `DEL-${String(nextId++).padStart(4, '0')}`,
    runtime_owner_id: entry.owner,
    speaker: entry.line.speaker,
    exact_text: entry.line.text,
    emphasis_ranges: json(entry.line.emphasis ?? []), beat_before_ms: entry.line.beatBeforeMs ?? 0, beat_after_ms: entry.line.beatAfterMs ?? 0,
    auto_timing_ms_by_speed: json(Object.fromEntries(['SLOW', 'NORMAL', 'FAST'].map(pace => [pace, dialogue.dialogueAdvanceDelayMs?.(entry.line, pace) ?? 0]))),
    performance_cues: json(entry.line.performanceCues ?? []), facing: 'runtime-facing-pair', pose: 'runtime-semantic-pose',
    route_or_state_precondition: entry.routeId, event_key: entry.line.r55Source?.eventKey ?? '', node_id: entry.line.copyKey ?? '', hotspot_ids: '', inventory_ids: '',
    source_path_and_lines: entry.line.r55Source ? `${entry.line.r55Source.source.path}:${entry.line.r55Source.source.lineStart}-${entry.line.r55Source.source.lineEnd}` : 'production runtime selector',
    status: ['hero-terminal', 'brcg-terminal', 'ending-completion'].includes(entry.family) ? 'ACTIVE_COMPONENT_COPY' : 'ACTIVE_RUNTIME_SPLIT', one_line_measured_width_px: 0, one_line_available_width_px: 464, one_line_fit: ['hero-terminal', 'brcg-terminal', 'ending-completion'].includes(entry.family), exact_split_owner: ['hero-terminal', 'brcg-terminal', 'ending-completion'].includes(entry.family) ? 'TERMINAL_OR_ENDING_COMPONENT_LAYOUT' : 'normalizeProductionDialogue', measurement_font: "700 8px 'SFMono-Regular', Consolas, monospace", principal_note: '',
  })
}

const uiSources = [
  ['src/app/CaseTerminalWorkbench.tsx', 'TERMINAL_PENDING_S16'],
  ['src/app/S14Ending.tsx', 'ACTIVE_COMPLETION_UI'],
  ['src/app/S13IntegratedCorpus.tsx', 'ACTIVE_HERO_BRCG_UI'],
]
for (const [path, status] of uiSources) {
  const texts = [...new Set(extractStaticUiCopy(await readFile(path, 'utf8')))].sort()
  for (const text of texts) deliveries.push({
    delivery_id: `DEL-${String(nextId++).padStart(4, '0')}`, runtime_owner_id: path, speaker: 'SYSTEM', exact_text: text,
    emphasis_ranges: '[]', beat_before_ms: 0, beat_after_ms: 0, auto_timing_ms_by_speed: '{}', performance_cues: '[]', facing: '', pose: '', route_or_state_precondition: 'rendered foreground UI copy', event_key: '', node_id: `ui-${sha(`${path}\0${text}`).slice(0, 20)}`, hotspot_ids: '', inventory_ids: '', source_path_and_lines: path, status, one_line_measured_width_px: 0, one_line_available_width_px: 464, one_line_fit: true, exact_split_owner: 'NON_DIALOGUE_UI_LAYOUT', measurement_font: "700 8px 'SFMono-Regular', Consolas, monospace", principal_note: '',
  })
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
await page.setContent('<main>exact production fallback measurement</main>')
await page.evaluate(async () => { await document.fonts.ready })
const measured = await page.evaluate(texts => { const canvas = document.createElement('canvas'); const context = canvas.getContext('2d'); context.font = "700 8px 'SFMono-Regular', Consolas, monospace"; return texts.map(text => Math.ceil(context.measureText(text).width * 100) / 100) }, deliveries.map(row => row.exact_text))
await browser.close()
deliveries.forEach((row, index) => {
  row.one_line_measured_width_px = measured[index]
  if (row.status.startsWith('ACTIVE_RUNTIME') || row.status === 'SHARED_ACTIVE_ROUTE' || row.status === 'OVERRIDE') row.one_line_fit = measured[index] <= 464
})
const activeRows = deliveries.filter(row => row.status.startsWith('ACTIVE_RUNTIME') || row.status === 'SHARED_ACTIVE_ROUTE' || row.status === 'OVERRIDE')
if (activeRows.some(row => !row.one_line_fit)) throw Error(`ACTIVE_DELIVERY_OVERFLOW:${activeRows.filter(row => !row.one_line_fit).map(row => row.delivery_id).join(',')}`)
if (observedRouteIds.size !== routes.R55_ACTUAL_ACTION_MATRIX.length - 1) throw Error('DYNAMIC_ROUTE_OWNER_OMITTED')
for (const entry of observed.filter(entry => !['hero-terminal', 'brcg-terminal', 'ending-completion'].includes(entry.family))) {
  const covered = deliveries.some(row => (row.status.startsWith('ACTIVE_RUNTIME') || row.status === 'SHARED_ACTIVE_ROUTE') && baseKey(row.node_id) === baseKey(entry.line.copyKey) && row.exact_text === entry.line.text)
  if (!covered) throw Error(`REACHABLE_ROUTE_MISCLASSIFIED_DORMANT:${entry.routeId}:${entry.line.copyKey}`)
}

const deliveryIds = new Map()
for (const row of deliveries) {
  const key = `${row.node_id}\0${row.exact_text}`
  const list = deliveryIds.get(key) ?? []; list.push(row.delivery_id); deliveryIds.set(key, list)
}
function resultIds(lines) {
  return dialogue.normalizeProductionDialogue(lines ?? []).flatMap(line => deliveryIds.get(`${line.copyKey}\0${line.text}`) ?? deliveryIds.get(`${baseKey(line.copyKey)}\0${line.text}`) ?? [])
}
const stateNames = ['PREAUTH_CLOSED', 'COMPLETE_CLOSED', 'COMPLETE_OPEN', 'COMPLETE_DEPLETED']
const hotspotRows = scenes.hotspots.flatMap(hotspot => VERBS.flatMap(verb => stateNames.map(stateName => {
  const state = sourceState(stateName)
  const locked = state.phase !== 'COMPLETE' && ['official-case-file-cabinet', 'miscellaneous-drawer-cabinet'].includes(hotspot.id) && ['OPEN', 'PULL', 'USE'].includes(verb)
  const rule = content.usefulRules.find(candidate => ruleMatches(candidate, verb, hotspot.id, state))
  const lines = locked ? content.deadEndSpeech(verb, hotspot.id, null, state) : rule ? rule.speech : content.deadEndSpeech(verb, hotspot.id, null, state)
  const ids = resultIds(lines)
  const silent = Boolean(rule && lines.length === 0)
  const unreachable = ['window', 'wall-clock', 'wall-be-the-change', 'wall-think-outside', 'wall-employee', 'wall-city-bridge', 'wall-building', 'wall-preserve', 'wall-records-sign', 'wall-not-a-number'].includes(hotspot.id) && ['PICK_UP', 'USE', 'OPEN', 'CLOSE', 'PUSH', 'PULL'].includes(verb)
  return {
    hotspot_id: hotspot.id, verb, state_predicate: stateName, current_hover_label: hotspot.name, logical_polygon_or_rect: hotspot.id === 'window' ? 'deriveWindowRoom()' : hotspot.polygon,
    route_owner: locked ? 'SEQUENCE.CABINET_POLICY_BLOCK' : rule ? `usefulRules.${rule.id}` : 'deadEndSpeech',
    physical_classification_owner: `physicalChoreographyFor(${verb},${hotspot.id})`,
    result: silent ? 'SILENT_STATE_CHANGE' : ids.length ? ids.join('|') : unreachable ? 'UNREACHABLE_REFUSAL' : lines.length ? 'ACTIVE_DELIVERY_UNMAPPED' : 'NO_ACTION',
    mutation_owner: rule && (rule.setCaseFileDrawer || rule.setMiscDrawer || rule.nextPhase) ? 'advancePhysicalSequence@semantic-contact' : '',
    z_priority: hotspot.id === 'wall-not-a-number' ? '31; wins overlap' : '10; shared hotspot layer', principal_note: '',
  }
})))
if (hotspotRows.some(row => row.result === 'ACTIVE_DELIVERY_UNMAPPED')) throw Error(`HOTSPOT_ACTIVE_OWNER_UNMAPPED:${hotspotRows.filter(row => row.result === 'ACTIVE_DELIVERY_UNMAPPED').map(row => `${row.hotspot_id}:${row.verb}:${row.state_predicate}`).join('|')}`)

const inventoryRows = Object.values(content.inventoryItems).flatMap(item => PHASES.flatMap(phase => VERBS.map(verb => {
  const state = { phase, piggyNoteReadState: phase === 'COMPLETE' ? 'BACK_READ' : 'UNREAD', brcgInvestigationState: phase === 'COMPLETE' ? 'RESOLVED' : 'UNTESTED', investigationMilestone: phase === 'COMPLETE' ? 'PROOF_COMPLETE' : 'BEFORE_Q1' }
  const direct = content.itemRules.find(rule => rule.itemId === item.id && !rule.targetItemId && rule.verb === verb && (rule.phases === 'ANY' || rule.phases === phase || Array.isArray(rule.phases) && rule.phases.includes(phase)))
  const lines = direct ? direct.speech : content.inventorySpeechForState(item.id, verb, state)
  return { item_id: item.id, verb, state_predicate: phase, route_owner: direct ? `itemRules.${direct.id}` : 'inventorySpeechForState', target_context: 'inventory-self', result: resultIds(lines).join('|') || (lines.length ? 'ACTIVE_DELIVERY_UNMAPPED' : 'NO_ACTION'), mutations: direct ? json({ add: direct.addItems, remove: direct.removeItems, nextPhase: direct.nextPhase }) : '', principal_note: '' }
}))).concat(Object.values(content.inventoryItems).flatMap(item => ['GIVE', 'USE'].map(verb => {
  const lines = content.arthurItemSpeech(item.id, { piggyNoteReadState: 'BACK_READ', brcgInvestigationState: 'RESOLVED' })
  return { item_id: item.id, verb, state_predicate: 'target=mr-index;COMPLETE;BRCG_RESOLVED', route_owner: 'arthurItemSpeech', target_context: 'mr-index', result: resultIds(lines).join('|') || (lines.length ? 'ACTIVE_DELIVERY_UNMAPPED' : 'NO_ACTION'), mutations: '', principal_note: '' }
})))
if (inventoryRows.some(row => row.result === 'ACTIVE_DELIVERY_UNMAPPED')) throw Error(`INVENTORY_ACTIVE_OWNER_UNMAPPED:${inventoryRows.filter(row => row.result === 'ACTIVE_DELIVERY_UNMAPPED').map(row => `${row.item_id}:${row.verb}:${row.state_predicate}:${row.target_context}`).join('|')}`)

const compatibility = prior.map(row => ({ prior_delivery_id: row.delivery_id, canonical_node_or_copy_key: baseKey(row.node_id), prior_runtime_owner: row.runtime_owner_id, new_stable_delivery_id: row.delivery_id, disposition: 'ID_RETAINED' }))
const coverage = {
  schema: 'tarka.s15-r5.active-owner-coverage.v1',
  priorDeliveryIds: prior.length, retainedPriorDeliveryIds: compatibility.length, deliveryRows: deliveries.length, activeDialogueRows: activeRows.length,
  observedProductionRoutes: routes.R55_ACTUAL_ACTION_MATRIX.length, observedRuntimeLines: observed.length, hotspotActionStateRows: hotspotRows.length, inventoryActionStateRows: inventoryRows.length,
  terminalPendingS16Rows: deliveries.filter(row => row.status === 'TERMINAL_PENDING_S16').length,
  activeOwnersMissing: 0, activeDeliveriesOverflowing: 0,
}

const dialogueHeaders = [...new Set([...Object.keys(deliveries[0]), 'exact_split_owner', 'measurement_font'])]
const hotspotHeaders = Object.keys(hotspotRows[0])
const inventoryHeaders = Object.keys(inventoryRows[0])
const files = new Map()
files.set('TARKA_DIALOGUE_DELIVERIES.csv', csv(deliveries, dialogueHeaders))
files.set('TARKA_HOTSPOT_ACTION_STATE.csv', csv(hotspotRows, hotspotHeaders))
files.set('TARKA_INVENTORY_ACTION_STATE.csv', csv(inventoryRows, inventoryHeaders))
files.set('TARKA_DELIVERY_ID_COMPATIBILITY.csv', csv(compatibility, Object.keys(compatibility[0])))
files.set('ACTIVE_OWNER_COVERAGE.json', JSON.stringify(coverage, null, 2) + '\n')
files.set('START_HERE.md', `# Tarka script review v1.1.0\n\nThis export retains all ${coverage.retainedPriorDeliveryIds} prior delivery IDs and appends only newly enumerated runtime splits and UI copy.\n\n- ${coverage.activeDialogueRows} active measured dialogue rows\n- ${coverage.observedProductionRoutes} observed production routes\n- ${coverage.hotspotActionStateRows} hotspot/action/state rows\n- ${coverage.inventoryActionStateRows} inventory/action/state rows\n- ${coverage.terminalPendingS16Rows} terminal foreground rows marked TERMINAL_PENDING_S16\n- Active one-line fit: PASS\n`)
files.set('TARKA_FULL_SCRIPT_REVIEW.md', `# Tarka full linear script review v1.1.0\n\n${deliveries.map(row => `## ${row.delivery_id} · ${row.status}\n\n- Owner: \`${row.runtime_owner_id}\`\n- Route/state: ${row.route_or_state_precondition}\n- Node/copy key: \`${row.node_id}\`\n- Full-line width: ${row.one_line_measured_width_px}/${row.one_line_available_width_px}px · ${row.one_line_fit ? 'FIT' : 'NON-ACTIVE-SOURCE'}\n\n**${row.speaker}:** ${row.exact_text}\n\nPrincipal note: ____________________\n`).join('\n')}`)
const payload = JSON.stringify({ deliveries, coverage }).replaceAll('</script', '<\\/script')
files.set('TARKA_SCRIPT_REVIEW_WORKBENCH.html', `<!doctype html><html><meta charset="utf-8"><title>Tarka Script Review v1.1.0</title><style>body{font:16px/1.45 system-ui;max-width:1100px;margin:auto;padding:24px;background:#111;color:#eee}input,textarea,select,button{font:inherit}article{border-top:1px solid #555;padding:14px 0}.copy{color:#ffd27a}textarea{width:100%;min-height:5em;background:#222;color:#fff}nav{position:sticky;top:0;background:#111;padding:10px 0}</style><body><h1>Tarka Script Review v1.1.0</h1><nav><input id="q" placeholder="Search"><select id="status"><option value="">All statuses</option></select> <button id="export">Export JSON notes</button></nav><main id="rows"></main><script>const DATA=${payload};const KEY='tarka-script-review-v1';let notes=JSON.parse(localStorage.getItem(KEY)||'{}');const rows=document.querySelector('#rows'),statuses=[...new Set(DATA.deliveries.map(d=>d.status))];for(const s of statuses){const o=document.createElement('option');o.textContent=s;status.append(o)}function draw(){const query=q.value.toLowerCase(),selected=status.value;rows.innerHTML='';for(const d of DATA.deliveries){if(selected&&d.status!==selected)continue;if(query&&!JSON.stringify(d).toLowerCase().includes(query))continue;const a=document.createElement('article');a.innerHTML='<b>'+d.delivery_id+' · '+d.status+'</b><p><code>'+d.runtime_owner_id+'</code></p><p class="copy"></p><textarea placeholder="Principal note"></textarea>';a.querySelector('.copy').textContent=d.speaker+': '+d.exact_text;const t=a.querySelector('textarea');t.value=notes[d.delivery_id]||'';t.oninput=()=>{notes[d.delivery_id]=t.value;localStorage.setItem(KEY,JSON.stringify(notes))};rows.append(a)}}q.oninput=status.onchange=draw;export.onclick=()=>{const b=new Blob([JSON.stringify({schema:'tarka.script-review.notes.v1',notes},null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='TARKA_PRINCIPAL_NOTES.json';a.click();URL.revokeObjectURL(u)};draw()</script></body></html>`)
for (const [name, body] of files) await writeFile(resolve(OUT, name), body)
const manifest = [...files.keys()].sort().map(name => `${sha(files.get(name))}  ${name}`).join('\n') + '\n'
await writeFile(resolve(OUT, 'MANIFEST.sha256'), manifest)
await vite.close()
console.log(JSON.stringify({ out: OUT, ...coverage }))
