import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const OUT = resolve('review/s15-r4/SCRIPT_EXPORT/TARKA_SCRIPT_REVIEW_v1.0.0')
const VERBS = ['GIVE', 'PICK_UP', 'USE', 'OPEN', 'LOOK_AT', 'PUSH', 'CLOSE', 'TALK_TO', 'PULL']
const csv = (rows, headers) => [headers.join(','), ...rows.map(row => headers.map(key => `"${String(row[key] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n') + '\n'
const json = value => JSON.stringify(value)
const sha = value => createHash('sha256').update(value).digest('hex')

await mkdir(OUT, { recursive: true })
const vite = await createServer({ logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' })
const [{ PRINCIPAL_OPENING, dialogueAdvanceDelayMs }, content, scenes, production, dialogue] = await Promise.all([
  vite.ssrLoadModule('/src/story/s15r2/principalFeedback.ts'),
  vite.ssrLoadModule('/src/adventure/content.ts'),
  vite.ssrLoadModule('/src/adventure/scenes.ts'),
  vite.ssrLoadModule('/src/story/r55/production.ts'),
  vite.ssrLoadModule('/src/adventure/dialogueDelivery.ts'),
])

const active = []
const add = (owner, route, lines, status = 'ACTIVE', precondition = 'runtime owner predicate') => {
  for (const line of dialogue.normalizeProductionDialogue(lines ?? [])) active.push({ owner, route, line, status, precondition })
}
add('PRINCIPAL_OPENING', 'opening', PRINCIPAL_OPENING, 'OVERRIDE', 'new game; openingStage=DIALOGUE')
for (const rule of content.usefulRules) add(`usefulRules.${rule.id}`, `${rule.verb}:${rule.targetId}`, rule.speech, 'ACTIVE', json({ phase: rule.phase, itemId: rule.itemId ?? null, drawer: rule.requiresDrawer ?? null, stack: rule.requiresStack ?? null, misc: rule.requiresMisc ?? null }))
for (const rule of content.itemRules) add(`itemRules.${rule.id}`, `${rule.verb}:${rule.itemId}:${rule.targetItemId ?? ''}`, rule.speech, 'ACTIVE', json({ phases: rule.phases }))
for (const rule of content.blockedInteractions) add(`blockedInteractions.${rule.copyKey}`, `${rule.verb}:${rule.targetId}:${rule.itemId}`, [{ speaker: 'ROOK', text: rule.text, copyKey: rule.copyKey }], 'ACTIVE', 'exact blocked item-on-target route')
for (const topic of content.dialogueTopics) add(`dialogueTopics.${topic.id}`, `TALK_TO:mr-index:${topic.id}`, topic.lines, 'ACTIVE', json({ closes: topic.closes ?? false }))

const activeNodeCounts = new Map()
for (const entry of active) if (entry.line.copyKey) activeNodeCounts.set(entry.line.copyKey, (activeNodeCounts.get(entry.line.copyKey) ?? 0) + 1)
const deliveries = active.map((entry, index) => {
  const line = entry.line
  const source = line.r55Source
  const status = entry.status === 'ACTIVE' && line.copyKey && (activeNodeCounts.get(line.copyKey) ?? 0) > 1 ? 'SHARED_ALIAS' : entry.status
  return {
    delivery_id: `DEL-${String(index + 1).padStart(4, '0')}`,
    runtime_owner_id: entry.owner,
    speaker: line.speaker,
    exact_text: line.text,
    emphasis_ranges: json(line.emphasis ?? []),
    beat_before_ms: line.beatBeforeMs ?? 0,
    beat_after_ms: line.beatAfterMs ?? 0,
    auto_timing_ms_by_speed: json(Object.fromEntries(['SLOW', 'NORMAL', 'FAST'].map(pace => [pace, dialogueAdvanceDelayMs(line, pace)]))),
    performance_cues: json(line.performanceCues ?? []),
    facing: line.performanceCues?.find(cue => cue.supportedTrack === 'GAZE')?.intent ?? 'runtime-facing-pair',
    pose: line.performanceCues?.map(cue => cue.selectedClip ?? cue.intent).join('|') || 'runtime-semantic-pose',
    route_or_state_precondition: entry.precondition,
    event_key: source?.eventKey ?? (line.authority ? 'PRINCIPAL_PLAYTEST_1_FEEDBACK' : ''),
    node_id: source?.nodeId ?? line.copyKey ?? '',
    hotspot_ids: entry.route.split(':').filter(value => scenes.hotspots.some(hotspot => hotspot.id === value)).join('|'),
    inventory_ids: entry.route.split(':').filter(value => value in content.inventoryItems).join('|'),
    source_path_and_lines: source ? `${source.source.path}:${source.source.lineStart}-${source.source.lineEnd}` : line.authority ? 'src/story/s15r2/principalFeedback.ts' : 'src/adventure/content.ts',
    status,
    one_line_measured_width_px: 0,
    one_line_available_width_px: 464,
    one_line_fit: false,
    principal_note: '',
  }
})

const allSource = JSON.parse(await readFile('src/story/r55/generated/r55-production.json', 'utf8'))
const activeKeys = new Set(deliveries.map(row => row.node_id))
for (const event of allSource.events) for (const line of event.lines) if (!activeKeys.has(line.nodeId)) deliveries.push({
  delivery_id: `DEL-${String(deliveries.length + 1).padStart(4, '0')}`, runtime_owner_id: `r55.source.${event.key}`, speaker: line.speaker ?? 'SYSTEM', exact_text: line.text,
  emphasis_ranges: '[]', beat_before_ms: 0, beat_after_ms: 0, auto_timing_ms_by_speed: json(Object.fromEntries(['SLOW','NORMAL','FAST'].map(pace => [pace, dialogueAdvanceDelayMs(line, pace)]))), performance_cues: json(line.cues ?? []), facing: '', pose: '', route_or_state_precondition: 'not selected by an active runtime consumer', event_key: event.key, node_id: line.nodeId, hotspot_ids: '', inventory_ids: '', source_path_and_lines: `${line.source.path}:${line.source.lineStart}-${line.source.lineEnd}`, status: 'DORMANT_SOURCE', one_line_measured_width_px: 0, one_line_available_width_px: 464, one_line_fit: false, principal_note: '',
})

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
await page.setContent('<main>Production local monospace fallback measurement</main>')
await page.evaluate(async () => { await document.fonts.ready })
const widths = await page.evaluate(texts => { const canvas = document.createElement('canvas'); const context = canvas.getContext('2d'); context.font = "700 8px 'SFMono-Regular', Consolas, monospace"; return texts.map(text => Math.ceil(context.measureText(text).width * 100) / 100) }, deliveries.map(row => row.exact_text))
await browser.close()
deliveries.forEach((row, index) => { row.one_line_measured_width_px = widths[index]; row.one_line_fit = widths[index] <= row.one_line_available_width_px })

const deliveryIds = new Map()
for (const row of deliveries) { const list = deliveryIds.get(row.node_id) ?? []; list.push(row.delivery_id); deliveryIds.set(row.node_id, list) }
const rules = [...content.usefulRules]
const hotspotRows = scenes.hotspots.map(hotspot => {
  const byVerb = Object.fromEntries(VERBS.map(verb => {
    const owners = rules.filter(rule => rule.verb === verb && rule.targetId === hotspot.id)
    return [verb, owners.length ? owners.map(rule => `usefulRules.${rule.id}`) : ['deadEndSpeech(stateful)']]
  }))
  const owned = rules.filter(rule => rule.targetId === hotspot.id)
  const ids = owned.flatMap(rule => rule.speech.flatMap(line => deliveryIds.get(line.copyKey ?? '') ?? []))
  return {
    hotspot_id: hotspot.id,
    current_hover_label: hotspot.name,
    proposed_or_binding_label: hotspot.name,
    logical_polygon_or_rect: hotspot.polygon,
    'walk/contact point': json(hotspot.walkTo),
    'z/priority rule': hotspot.id === 'wall-not-a-number' ? '31; above Arthur overlap' : hotspot.id === 'mr-index' ? '30; below stanchion overlap' : 'layout paint order + hotspot z=10',
    'all nine verbs': json(byVerb),
    'state variants': json(owned.map(rule => ({ id: rule.id, phase: rule.phase, drawer: rule.requiresDrawer ?? null, stack: rule.requiresStack ?? null, misc: rule.requiresMisc ?? null }))),
    'runtime owner IDs': owned.map(rule => `usefulRules.${rule.id}`).join('|') || 'deadEndSpeech',
    'resulting delivery IDs': [...new Set(ids)].join('|'),
    'asset/state mutations': json(owned.map(rule => ({ id: rule.id, phase: rule.nextPhase, caseDrawer: rule.setCaseFileDrawer ?? null, miscDrawer: rule.setMiscDrawer ?? null, add: rule.addItems ?? [], remove: rule.removeItems ?? [] }))),
    principal_note: '',
  }
})

const inventoryRows = Object.values(content.inventoryItems).map(item => {
  const itemRules = content.itemRules.filter(rule => rule.itemId === item.id || rule.targetItemId === item.id)
  const worldRules = rules.filter(rule => rule.itemId === item.id)
  const all = [...itemRules, ...worldRules]
  const byVerb = Object.fromEntries(VERBS.map(verb => [verb, all.filter(rule => rule.verb === verb).map(rule => rule.id).concat(all.some(rule => rule.verb === verb) ? [] : ['inventorySpeechForState(stateful)'])]))
  return {
    item_id: item.id,
    'current/proposed label': item.name,
    'art slot and state variants': json({ artSlot: item.assetSlot, variants: itemRules.map(rule => ({ id: rule.id, add: rule.addItems, remove: rule.removeItems })) }),
    'all nine verbs': json(byVerb),
    'item-item combinations': itemRules.filter(rule => rule.targetItemId).map(rule => `${rule.id}:${rule.itemId}+${rule.targetItemId}`).join('|'),
    'Arthur GIVE/USE reactions': worldRules.filter(rule => rule.targetId === 'mr-index' && (rule.verb === 'GIVE' || rule.verb === 'USE')).map(rule => rule.id).join('|') || 'inventorySpeechForState(stateful)',
    'resulting delivery IDs': [...new Set(all.flatMap(rule => rule.speech.flatMap(line => deliveryIds.get(line.copyKey ?? '') ?? [])))].join('|'),
    'state preconditions and mutations': json(all.map(rule => ({ id: rule.id, phase: rule.phase ?? rule.phases, nextPhase: rule.nextPhase, add: rule.addItems ?? [], remove: rule.removeItems ?? [] }))),
    principal_note: '',
  }
})

const dialogueHeaders = ['delivery_id','runtime_owner_id','speaker','exact_text','emphasis_ranges','beat_before_ms','beat_after_ms','auto_timing_ms_by_speed','performance_cues','facing','pose','route_or_state_precondition','event_key','node_id','hotspot_ids','inventory_ids','source_path_and_lines','status','one_line_measured_width_px','one_line_available_width_px','one_line_fit','principal_note']
const hotspotHeaders = ['hotspot_id','current_hover_label','proposed_or_binding_label','logical_polygon_or_rect','walk/contact point','z/priority rule','all nine verbs','state variants','runtime owner IDs','resulting delivery IDs','asset/state mutations','principal_note']
const inventoryHeaders = ['item_id','current/proposed label','art slot and state variants','all nine verbs','item-item combinations','Arthur GIVE/USE reactions','resulting delivery IDs','state preconditions and mutations','principal_note']
const files = new Map()
files.set('TARKA_DIALOGUE_DELIVERIES.csv', csv(deliveries, dialogueHeaders))
files.set('TARKA_HOTSPOT_REGISTER.csv', csv(hotspotRows, hotspotHeaders))
files.set('TARKA_INVENTORY_REGISTER.csv', csv(inventoryRows, inventoryHeaders))
files.set('START_HERE.md', `# Tarka script review v1.0.0\n\nStart with \`TARKA_FULL_SCRIPT_REVIEW.md\`, then use the offline workbench or CSV registers. This export is generated from the active runtime owners.\n\n- ${deliveries.length} dialogue deliveries (${deliveries.filter(row => row.status !== 'DORMANT_SOURCE').length} active/override/shared)\n- ${hotspotRows.length} hotspots × all nine verbs\n- ${inventoryRows.length} inventory items × all nine verbs\n- Browser width measurement: production local monospace fallback at logical 8 px; available width 464 px\n- All active measured deliveries fit: ${deliveries.filter(row => row.status !== 'DORMANT_SOURCE').every(row => row.one_line_fit)}\n- Dormant source rows remain unsplit for source review and are not player-visible bubbles.\n`)
files.set('TARKA_FULL_SCRIPT_REVIEW.md', `# Tarka full script review\n\nGenerated from \`PRINCIPAL_OPENING\`, \`usefulRules\`, \`itemRules\`, \`blockedInteractions\`, \`dialogueTopics\`, and the authenticated R55 source projection.\n\n${deliveries.map(row => `## ${row.delivery_id} · ${row.status}\n\n- Owner: \`${row.runtime_owner_id}\`\n- Route/state: ${row.route_or_state_precondition}\n- Speaker: **${row.speaker}**\n- Copy key/node: \`${row.node_id}\`\n- Width: ${row.one_line_measured_width_px}/${row.one_line_available_width_px}px — ${row.one_line_fit ? 'FIT' : 'OVERFLOW'}\n\n${row.exact_text}\n\nPrincipal note: ____________________\n`).join('\n')}`)
files.set('TARKA_REVIEW_MARKUP_TEMPLATE.md', `# Principal review markup\n\nUse: KEEP · CUT · REPLACE: “…” · SAME-BUBBLE · NEXT-BUBBLE · EM{words} · BEAT<250> · BEAT>400 · FACE{ARTHUR|ROOK|CAMERA|OBJECT} · POSE{intent-or-clip} · HOLD{segment} · AUTO{MANUAL|SLOW|NORMAL|FAST} · MOVE{target} · CONTACT{target}\n\n| Delivery ID | Direction | Note |\n|---|---|---|\n| DEL-____ | KEEP | |\n`)
const payload = JSON.stringify({ deliveries, hotspots: hotspotRows, inventory: inventoryRows }).replaceAll('</script', '<\\/script')
files.set('TARKA_SCRIPT_REVIEW_WORKBENCH.html', `<!doctype html><html><meta charset="utf-8"><title>Tarka Script Review</title><style>body{font:16px/1.45 system-ui;max-width:1100px;margin:auto;padding:24px;background:#111;color:#eee}input,textarea,select,button{font:inherit}article{border-top:1px solid #555;padding:14px 0}.copy{color:#ffd27a}textarea{width:100%;min-height:5em;background:#222;color:#fff}nav{position:sticky;top:0;background:#111;padding:10px 0}</style><body><h1>Tarka Script Review v1.0.0</h1><nav><input id="q" placeholder="Search"><select id="status"><option value="">All statuses</option><option>ACTIVE</option><option>OVERRIDE</option><option>SHARED_ALIAS</option><option>DORMANT_SOURCE</option><option>SUPERSEDED</option></select> <button id="export">Export JSON notes</button></nav><main id="rows"></main><script>const DATA=${payload};const KEY='tarka-script-review-v1';let notes=JSON.parse(localStorage.getItem(KEY)||'{}');const rows=document.querySelector('#rows');function draw(){const q=document.querySelector('#q').value.toLowerCase(),s=document.querySelector('#status').value;rows.innerHTML='';for(const d of DATA.deliveries){if(s&&d.status!==s)continue;if(q&&!JSON.stringify(d).toLowerCase().includes(q))continue;const a=document.createElement('article');a.innerHTML='<b>'+d.delivery_id+' · '+d.status+'</b><p>'+d.speaker+' · <code>'+d.runtime_owner_id+'</code></p><p class="copy"></p><textarea placeholder="Principal note"></textarea>';a.querySelector('.copy').textContent=d.exact_text;const t=a.querySelector('textarea');t.value=notes[d.delivery_id]||'';t.oninput=()=>{notes[d.delivery_id]=t.value;localStorage.setItem(KEY,JSON.stringify(notes))};rows.append(a)}}q.oninput=status.onchange=draw;export.onclick=()=>{const b=new Blob([JSON.stringify({schema:'tarka.script-review.notes.v1',notes},null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='TARKA_PRINCIPAL_NOTES.json';a.click();URL.revokeObjectURL(u)};draw()</script></body></html>`)
for (const [name, body] of files) await writeFile(resolve(OUT, name), body)
const manifest = [...files.keys()].sort().map(name => `${sha(files.get(name))}  ${name}`).join('\n') + '\n'
await writeFile(resolve(OUT, 'MANIFEST.sha256'), manifest)
await vite.close()
console.log(JSON.stringify({ out: OUT, deliveries: deliveries.length, active: deliveries.filter(row => row.status !== 'DORMANT_SOURCE').length, hotspots: hotspotRows.length, inventory: inventoryRows.length, activeFit: deliveries.filter(row => row.status !== 'DORMANT_SOURCE').every(row => row.one_line_fit) }))
