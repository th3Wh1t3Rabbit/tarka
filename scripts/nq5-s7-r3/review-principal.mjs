import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const output = path.join(root, 'artifacts/principal-review')
const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), 'utf8'))
const sha = (value) => createHash('sha256').update(value).digest('hex')

const catalog = await readJson('content/parallel/narrative/S7_R2B_CONTENT_CATALOG.json')
const matrix = await readJson('content/parallel/narrative/S7_R2B_INTERACTION_MATRIX.json')
const runtime = await readJson('content/parallel/narrative/S7_R2B_RUNTIME_SELECTION_MAP.json')
const lineReport = await readJson('content/parallel/narrative/S7_R2B_LINE_LENGTH_REPORT.json')
const claimAudit = await readJson('content/parallel/narrative/S7_R2B_CLAIM_BOUNDARY_AUDIT.json')
const fixture = await readJson('public/scenarios/euler-2023-false-exit/scenario.json')
const byKey = new Map(catalog.entries.map((entry) => [entry.key, entry]))
const bindText = (text = '') => text.replaceAll('{EXACT_CONVERGENCE_TIME}', '11:38:11').replaceAll('{EXACT_MAIN_RECEIVER_DISPLAY}', 'Receiving Vault')
const lines = (keys) => keys.map((key) => ({ key, speaker: byKey.get(key)?.speaker, text: bindText(byKey.get(key)?.text) }))

const acts = [
  { id: 'ACT-0', label: 'Misfiled', objective: 'Retrieve the opening case record.', entry: 'Player arrival', exit: 'Opening exchange complete', approval: 'UNREVIEWED' },
  { id: 'ACT-1', label: 'Request procedure', objective: 'Complete, stamp, dispatch, and retrieve the request.', entry: 'Opening complete', exit: 'Terminal authorization earned', approval: 'UNREVIEWED' },
  { id: 'ACT-2', label: 'Evidence sea', objective: 'Turn a broad accepted record set into bounded questions.', entry: 'Terminal access', exit: 'Useful candidate results', approval: 'UNREVIEWED' },
  { id: 'ACT-3', label: 'Candidate comparison', objective: 'Compare routes and file or defer a working theory.', entry: 'Candidates available', exit: 'Exact receipt question', approval: 'UNREVIEWED' },
  { id: 'ACT-4', label: 'Exact proof', objective: 'File AMOUNT and RECEIVER in either order, then LINK.', entry: 'Exact receipt available', exit: 'Bounded conclusion complete', approval: 'UNREVIEWED' },
  { id: 'ACT-5', label: 'Return', objective: 'Return to the Records Office for the closing exchange.', entry: 'Explicit office return', exit: 'Required return exchange and optional neutral tag', approval: 'UNREVIEWED' },
]
const puzzle = [
  ['NODE.REQUEST', 'Pull / complete / stamp request', 'Blank request and pen', 'Stamped request at CONTACT.REQUEST_RETURN'],
  ['NODE.TUBE', 'Load / close / dispatch tube', 'Stamped request', 'Returned canister'],
  ['NODE.ACCESS', 'Open canister / take strip / authorize terminal', 'Returned canister', 'Terminal access'],
  ['NODE.SEA', 'Ask bounded questions', 'Starting facts', 'Candidate folders'],
  ['NODE.THEORY', 'Compare and select or defer theory', 'At least two plausible candidates', 'Exact-link question'],
  ['NODE.PROOF', 'AMOUNT + RECEIVER → LINK', 'Exact accepted records', fixture.truthConclusion[0]],
  ['NODE.RETURN', 'Explicitly return to office', 'Proof complete', 'Required return exchange'],
].map(([id, goal, prerequisite, unlock]) => ({ id, goal, prerequisite, unlock, hint: 'METHOD → CASE → DIRECT', recoverable: true }))
const timeline = [
  ['START', [], 'Request dispenser; Arthur; office props'],
  ['TICKET_PULLED', ['blank-request'], 'Pen stand; Arthur'],
  ['REQUEST_COMPLETED', ['completed-request'], 'Arthur stamp handoff'],
  ['REQUEST_STAMPED', ['stamped-request'], 'Pneumatic tube'],
  ['REQUEST_IN_TUBE', [], 'Tube latch; plunger'],
  ['DISPATCHED', [], 'Returned canister'],
  ['STRIP_TAKEN', ['first-breach-strip'], 'Nansen terminal'],
  ['TERMINAL_UNLOCKED', ['first-breach-strip'], '25 accepted views + 7 bounded no-match views'],
  ['PROOF_COMPLETE', ['first-breach-strip'], 'Explicit return to office'],
].map(([id, inventory, available]) => ({ id, inventory, available }))

const performance = [
  ['PERF.OPEN.ROOK.CONFIDENCE', 'lane_a.s7r2b.opening.3', 'ROOK', 'BEFORE_LINE', '', 'FACE', 'FALSE_CONFIDENCE'],
  ['PERF.OPEN.RIGHT.BEAT', 'lane_a.s7r2b.opening.3', 'ROOK', 'AFTER_SUBSTRING', 'Right.', 'TIME', 'BEAT_MICRO'],
  ['PERF.OPEN.RIGHT.GAZE', 'lane_a.s7r2b.opening.3', 'ROOK', 'AFTER_SUBSTRING', 'Right.', 'GAZE', 'LOOK_TO_ARTHUR'],
  ['PERF.OPEN.NICKNAME.LEAN', 'lane_a.s7r2b.opening.3', 'ROOK', 'BEFORE_SUBSTRING', 'Mr. A—', 'BODY', 'LEAN_CHARMINGLY'],
  ['PERF.OPEN.INTERRUPT', 'lane_a.s7r2b.opening.4', 'ARTHUR', 'BEFORE_LINE', '', 'VOICE_TEXT', 'INTERRUPT_CLEAN'],
  ['PERF.OPEN.IRRITATION', 'lane_a.s7r2b.opening.4', 'ARTHUR', 'BEFORE_LINE', '', 'FACE', 'RESTRAINED_IRRITATION'],
  ['PERF.OPEN.COMIC_HOLD', 'lane_a.s7r2b.opening.4', 'ARTHUR', 'AFTER_LINE', '', 'TIME', 'BEAT_COMIC'],
  ['PERF.OPEN.RECOVERY', 'lane_a.s7r2b.opening.5', 'ROOK', 'BEFORE_LINE', '', 'FACE', 'RECOVERING_CONFIDENCE'],
  ['PERF.OPEN.DRY_LOOK', 'lane_a.s7r2b.opening.6', 'ARTHUR', 'BEFORE_LINE', '', 'GAZE', 'STILL_DRY_LOOK'],
  ['PERF.WRONG.PLEASED', 'lane_a.s7r2b.wrong_theory.1', 'ROOK', 'BEFORE_LINE', '', 'FACE', 'PLEASED_REASONING'],
  ['PERF.WRONG.VALIDATE', 'lane_a.s7r2b.wrong_theory.2', 'ARTHUR', 'BEFORE_LINE', '', 'BODY', 'PROCEDURAL_VALIDATION'],
  ['PERF.WRONG.WITHHOLD', 'lane_a.s7r2b.wrong_theory.4', 'ARTHUR', 'BEFORE_LINE', '', 'FACE', 'WITHHELD_WARMTH'],
  ['PERF.WRONG.HOLD', 'lane_a.s7r2b.wrong_theory.4', 'ARTHUR', 'BEFORE_LINE', '', 'TIME', 'HOLD_REACTION'],
  ['PERF.EXACT.CONCENTRATION', 'lane_a.s7r2b.exact_correction.1', 'ROOK', 'BEFORE_LINE', '', 'FACE', 'CONCENTRATION'],
  ['PERF.EXACT.RECOGNITION', 'lane_a.s7r2b.exact_correction.1', 'ROOK', 'AFTER_SUBSTRING', '11:38:11.', 'FACE', 'RECOGNITION'],
  ['PERF.EXACT.SATISFACTION', 'lane_a.s7r2b.exact_correction.1', 'ROOK', 'AFTER_LINE', '', 'FACE', 'QUIET_SATISFACTION'],
  ['PERF.EXACT.GOOD', 'lane_a.s7r2b.exact_correction.4', 'ARTHUR', 'BEFORE_LINE', '', 'VOICE_TEXT', 'SMALL_DELIVERY'],
  ['PERF.EXACT.WAIT', 'lane_a.s7r2b.exact_correction.5', 'ROOK', 'BEFORE_LINE', '', 'TIME', 'LOOK_BEFORE_REPLY'],
  ['PERF.EXACT.SILENCE', 'lane_a.s7r2b.exact_correction.6', 'ARTHUR', 'BEFORE_LINE', '', 'TIME', 'SILENCE_AWKWARD'],
  ['PERF.GLOBE.1.DISCOVERY', 'lane_a.s7r2b.globe.push.1.1', 'ROOK', 'BEFORE_LINE', '', 'BODY', 'PERFORM_DISCOVERY'],
  ['PERF.GLOBE.1.SPIN', 'lane_a.s7r2b.globe.push.1.1', 'ROOK', 'BEFORE_LINE', '', 'PROP', 'GLOBE_SPIN'],
  ['PERF.GLOBE.2.JUSTIFY', 'lane_a.s7r2b.globe.push.2.1', 'ROOK', 'BEFORE_LINE', '', 'VOICE_TEXT', 'JUSTIFY_BEHAVIOR'],
  ['PERF.GLOBE.3.INTERRUPT', 'lane_a.s7r2b.globe.push.3.2', 'ARTHUR', 'BEFORE_LINE', '', 'VOICE_TEXT', 'INTERRUPT_CLEAN'],
  ['PERF.GLOBE.LOOP.CONCISE', 'lane_a.s7r2b.globe.push.loop.1', 'ARTHUR', 'BEFORE_LINE', '', 'BODY', 'STABLE_CONCISE_LOOP'],
  ['PERF.RETURN.RHYTHM.1', 'lane_a.s7r2b.return.1', 'ROOK', 'BEFORE_LINE', '', 'TIME', 'BEAT_CONVERSATIONAL'],
  ['PERF.RETURN.RHYTHM.2', 'lane_a.s7r2b.return.2', 'ARTHUR', 'BEFORE_LINE', '', 'VOICE_TEXT', 'DRY_EXACT'],
  ['PERF.RETURN.RHYTHM.3', 'lane_a.s7r2b.return.3', 'ROOK', 'BEFORE_LINE', '', 'VOICE_TEXT', 'EARNED_CALLBACK'],
  ['PERF.RETURN.RHYTHM.4', 'lane_a.s7r2b.return.4', 'ARTHUR', 'BEFORE_LINE', '', 'TIME', 'BEAT_COMIC'],
].map(([id, copyKey, actor, trigger, anchor, track, intention]) => ({ id, copyKey, text: bindText(byKey.get(copyKey)?.text), actor, trigger, anchor, track, intention, fallback: 'GENERIC_SILHOUETTE', reducedMotion: 'STATIC_TEXT_OR_PLAYER_PACED_SEPARATION' }))

const concepts = [
  ['E-01', 'Piggy bank recovery-note vignette', 'REVIEW_ONLY · fictional local data · no proof role'],
  ['E-02', 'Cold-storage drawer joke', 'REVIEW_ONLY · optional prop'],
  ['E-03', 'Off-file question boundary', 'REVIEW_ONLY · claim-boundary reinforcement'],
  ['E-04', 'Show me everything terminal exchange', 'REVIEW_ONLY · evidence-sea teaching beat'],
].map(([id, title, boundary]) => ({ id, title, boundary, runtime: false }))

const model = {
  schemaVersion: '1.0.0', revision: 'S7-R3@6be0515e-parent', contentIdentity: { interface: catalog.interface, sha256: catalog.content_sha256, entries: catalog.entry_count },
  acts, puzzle, timeline, interactions: matrix.cells, dialogues: Object.fromEntries(Object.entries(runtime.sequences).map(([key, keys]) => [key, lines(keys)])),
  performance, evidence: { conclusion: fixture.truthConclusion[0], boundary: fixture.truthConclusion[1], records: fixture.evidence.length, exactBindings: claimAudit.exact_bindings, proofSlots: claimAudit.proof_slots },
  journeys: [
    { id: 'DIRECT', label: 'Direct Solver', interactions: 12, result: 'COMPLETE', route: ['NODE.REQUEST', 'NODE.TUBE', 'NODE.ACCESS', 'NODE.SEA', 'NODE.PROOF', 'NODE.RETURN'] },
    { id: 'CURIOUS', label: 'Curious Explorer', interactions: 24, result: 'COMPLETE', route: ['NODE.REQUEST', 'NODE.TUBE', 'NODE.ACCESS', 'NODE.SEA', 'optional object desk', 'bounded no-match', 'NODE.PROOF', 'NODE.RETURN'] },
    { id: 'MISTAKEN', label: 'Mistaken Investigator', interactions: 19, result: 'COMPLETE_RECOVERED', route: ['NODE.REQUEST', 'NODE.TUBE', 'NODE.ACCESS', 'NODE.SEA', 'NODE.THEORY', 'wrong theory', 'exact correction', 'NODE.PROOF', 'NODE.RETURN'] },
  ],
  artIntentions: [...new Set(performance.map((cue) => cue.intention))].map((intention) => ({ intention, generic: 'GENERIC_FALLBACK_AVAILABLE', production: 'PRODUCTION_CAPABILITY_UNKNOWN' })),
  concepts, rendererRisk: lineReport.lines.filter((line) => line.risk === 'REVIEW_LONG_OR_RISKY').map((line) => ({ ...line, text: bindText(byKey.get(line.key)?.text) })),
  commentContract: { categories: ['KEEP', 'COPY', 'TIMING', 'EXPRESSION', 'STAGING', 'PUZZLE', 'INVENTORY', 'ART_REQUEST', 'SOUND', 'FACT', 'ACCESSIBILITY', 'CUT_OPTIONAL', 'QUESTION'], states: ['UNREVIEWED', 'APPROVE', 'APPROVE_WITH_NOTE', 'REVISE', 'CUT', 'DEFER'], anchors: ['act', 'scene', 'puzzle node', 'copy key', 'dialogue choice', 'hotspot + verb', 'sequence action', 'performance cue', 'evidence record', 'art intention'] },
}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TRACE//ESCAPE Principal Review Workbench</title><link rel="stylesheet" href="workbench.css"></head><body><header><p>INTERNAL · REVIEW ONLY · S7-R3</p><h1>Principal Review Workbench</h1><p>Exact content ${model.contentIdentity.interface} · production art remains late-bound.</p><nav id="nav"></nav></header><main id="app"></main><footer>No backend · no external requests · no game-save mutation · comments remain browser-local until export.</footer><script>window.__WORKBENCH_MODEL__=${JSON.stringify(model).replaceAll('<','\\u003c')}</script><script src="workbench.js"></script></body></html>`

const css = `:root{font-family:ui-monospace,monospace;color:#eaf7de;background:#101711;line-height:1.45}*{box-sizing:border-box}body{margin:0}header,main,footer{max-width:1200px;margin:auto;padding:1rem}header{background:#101711;border-bottom:2px solid #77c66e}nav,.controls{display:flex;flex-wrap:wrap;gap:.45rem}button,select,input,textarea{font:inherit;color:inherit;background:#172419;border:1px solid #77c66e;padding:.55rem}button:focus-visible,a:focus-visible,textarea:focus-visible{outline:3px solid #ffe66d;outline-offset:2px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:1rem}.card{border:1px solid #577d54;background:#142016;padding:1rem;overflow-wrap:anywhere}.review-only{border-color:#d7a84b}.badge{display:inline-block;padding:.1rem .4rem;border:1px solid currentColor}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid #577d54;padding:.5rem;text-align:left;vertical-align:top}.silhouette{display:inline-grid;place-items:center;width:3rem;height:5rem;background:#77c66e;color:#101711;border-radius:40% 40% 25% 25%}.renderer-lines{margin-top:1rem}.renderer-lines[data-mode="FULLSCREEN_CRT"]{max-width:52rem}.renderer-lines[data-mode="DOCKED_OVERLAY"]{max-width:38rem}.renderer-lines[data-mode="PLAIN_LIST"]{max-width:none}.renderer-line{white-space:normal;overflow-wrap:anywhere}.renderer-lines[data-reduced="true"] .renderer-line{transition:none;animation:none}textarea{width:100%;min-height:7rem}@media(max-width:650px){th,td{min-width:10rem}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important}}`

const js = String.raw`(()=>{const m=window.__WORKBENCH_MODEL__,app=document.querySelector('#app'),nav=document.querySelector('#nav');const views={acts:'Acts / scenes',puzzle:'Puzzle dependency',timeline:'State / inventory',objects:'Nine-verb desk',dialogue:'Dialogue tree',performance:'Performance score',evidence:'Nansen evidence',journeys:'Journey simulator',art:'Art capability',renderer:'Renderer risk',comments:'Comment book',concepts:'Review-only concepts'};for(const[k,label]of Object.entries(views)){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{location.hash=k};nav.append(b)}const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const cards=(xs,fn)=>'<div class="grid">'+xs.map(fn).join('')+'</div>';const anchor=(type,id)=>type+':'+id;function table(rows,cols){return '<div class="table-wrap"><table><thead><tr>'+cols.map(c=>'<th>'+esc(c[0])+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cols.map(c=>'<td>'+esc(c[1](r))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'}function render(){const v=location.hash.slice(1)||'acts';if(v==='acts')app.innerHTML='<h2>Act and scene navigator</h2>'+cards(m.acts,x=>'<article class="card" id="'+anchor('act',x.id)+'"><h3>'+esc(x.id+' · '+x.label)+'</h3><p>'+esc(x.objective)+'</p><p>Entry: '+esc(x.entry)+'</p><p>Exit: '+esc(x.exit)+'</p><span class="badge">'+esc(x.approval)+'</span></article>');else if(v==='puzzle')app.innerHTML='<h2>Puzzle dependency</h2>'+cards(m.puzzle,x=>'<article class="card" id="'+anchor('puzzle',x.id)+'"><h3>'+esc(x.id)+'</h3><p><b>Goal:</b> '+esc(x.goal)+'</p><p><b>Prerequisite:</b> '+esc(x.prerequisite)+'</p><p><b>Unlock:</b> '+esc(x.unlock)+'</p><p>'+esc(x.hint)+' · recoverable '+esc(x.recoverable)+'</p></article>');else if(v==='timeline')app.innerHTML='<h2>State and inventory timeline</h2>'+table(m.timeline,[['Milestone',x=>x.id],['Inventory',x=>x.inventory.join(', ')||'empty'],['Available / focus',x=>x.available]]);else if(v==='objects')app.innerHTML='<h2>Nine-verb object desk</h2><p>'+m.interactions.length+' exact cells; required progression takes precedence over optional exact response.</p>'+table(m.interactions,[['Hotspot',x=>x.hotspot],['Verb',x=>x.verb],['Exact keys',x=>x.response_keys.join(', ')||x.behavior],['Mutation',x=>x.progression_mutation],['Repeat',x=>x.repeat_behavior]]);else if(v==='dialogue')app.innerHTML='<h2>Dialogue-tree reader</h2>'+Object.entries(m.dialogues).map(([id,ls])=>'<section class="card" id="'+anchor('dialogue',id)+'"><h3>'+esc(id)+'</h3><ol>'+ls.map(l=>'<li><b>'+esc(l.speaker)+':</b> '+esc(l.text)+' <small>'+esc(l.key)+'</small></li>').join('')+'</ol><button onclick="this.previousElementSibling.scrollTop=0">Reset branch</button></section>').join('');else if(v==='performance')app.innerHTML='<h2>Phrase-level performance score</h2><p>Generic silhouette preview; cue notes are visual production metadata and are not announced as dialogue.</p>'+cards(m.performance,x=>'<article class="card" id="'+anchor('performance cue',x.id)+'"><span class="silhouette" aria-hidden="true">'+esc(x.actor[0])+'</span><h3>'+esc(x.id)+'</h3><p>'+esc(x.text)+'</p><p>'+esc(x.trigger+(x.anchor?' · '+x.anchor:''))+'</p><p>'+esc(x.track+' → '+x.intention)+'</p><small>'+esc(x.fallback+' · '+x.reducedMotion)+'</small></article>');else if(v==='evidence')app.innerHTML='<h2>Nansen evidence and claim view</h2><article class="card"><h3>'+esc(m.evidence.conclusion)+'</h3><p>'+esc(m.evidence.boundary)+'</p><p>'+esc(m.evidence.records)+' local records · exact slots '+esc(m.evidence.proofSlots.map(x=>x.slot||x).join(', '))+'</p><p>Sources and Ledger expose accepted local provenance. No new request is issued.</p><pre>'+esc(JSON.stringify(m.evidence.exactBindings,null,2))+'</pre></article>';else if(v==='journeys')app.innerHTML='<h2>Journey simulator</h2>'+cards(m.journeys,x=>'<article class="card"><h3>'+esc(x.label)+'</h3><p>'+esc(x.interactions)+' interactions · '+esc(x.result)+'</p><ol>'+x.route.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol></article>');else if(v==='art')app.innerHTML='<h2>Art capability and missing expressions</h2>'+table(m.artIntentions,[['Intention',x=>x.intention],['Generic',x=>x.generic],['Production',x=>x.production]]);else if(v==='renderer')renderer();else if(v==='concepts')app.innerHTML='<h2>Review-only optional concepts</h2><p>These cards are not runtime, inventory, catalog, state, proof, or normal-build content.</p>'+cards(m.concepts,x=>'<article class="card review-only"><h3>'+esc(x.id+' · '+x.title)+'</h3><p>'+esc(x.boundary)+'</p><span class="badge">NOT IN RUNTIME</span></article>');else comments()}function renderer(){app.innerHTML='<h2>Thirteen-line renderer risk review</h2><p>Exact copy is immutable; only wrapping, paging, and layout may change.</p><div class="controls"><label>Presentation <select id="renderer-mode"><option>FULLSCREEN_CRT</option><option>DOCKED_OVERLAY</option><option>PLAIN_LIST</option></select></label><label><input id="renderer-reduced" type="checkbox"> Reduced motion</label></div><section class="renderer-lines" data-mode="FULLSCREEN_CRT" data-reduced="false">'+m.rendererRisk.map(x=>'<article class="card renderer-line" data-renderer-line="'+esc(x.key)+'"><h3>'+esc(x.key)+'</h3><p>'+esc(x.text)+'</p></article>').join('')+'</section>';const panel=document.querySelector('.renderer-lines');document.querySelector('#renderer-mode').onchange=e=>{panel.dataset.mode=e.target.value};document.querySelector('#renderer-reduced').onchange=e=>{panel.dataset.reduced=String(e.target.checked)}}function comments(){const key='trace-principal-review:'+m.revision;let book=JSON.parse(localStorage.getItem(key)||'[]');const options=(xs)=>xs.map(x=>'<option>'+esc(x)+'</option>').join('');app.innerHTML='<h2>Principal comment book</h2><p>Revision '+esc(m.revision)+' · item-change identity '+esc(m.contentIdentity.sha256)+'</p><label>Stable anchor<input id="anchor" value="act:ACT-0"></label><label>Category<select id="category">'+options(m.commentContract.categories)+'</select></label><label>Approval<select id="approval">'+options(m.commentContract.states)+'</select></label><label>Author<input id="author" value="Principal"></label><label>Comment<textarea id="text"></textarea></label><button id="save">Save locally</button><button id="json">Export JSON</button><button id="md">Export Markdown</button><label>Import review book<input id="import" type="file" accept="application/json"></label><section id="book"></section>';const draw=()=>document.querySelector('#book').innerHTML=cards(book,x=>'<article class="card"><h3>'+esc(x.anchor)+' · '+esc(x.category)+'</h3><p>'+esc(x.text)+'</p><small>'+esc(x.author+' · '+x.timestamp+' · '+x.approval+' · '+x.sourceRevision)+'</small></article>');const download=(name,text,type)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)};document.querySelector('#save').onclick=()=>{book.push({anchor:document.querySelector('#anchor').value,category:document.querySelector('#category').value,approval:document.querySelector('#approval').value,author:document.querySelector('#author').value,timestamp:new Date().toISOString(),sourceRevision:m.revision,itemId:document.querySelector('#anchor').value,text:document.querySelector('#text').value});localStorage.setItem(key,JSON.stringify(book));draw()};document.querySelector('#json').onclick=()=>download('PRINCIPAL_REVIEW_BOOK.json',JSON.stringify({schemaVersion:'1.0.0',revision:m.revision,contentIdentity:m.contentIdentity,comments:book},null,2),'application/json');document.querySelector('#md').onclick=()=>download('PRINCIPAL_REVIEW_BOOK.md','# Principal Review Book\n\n'+book.map(x=>'## '+x.anchor+' — '+x.category+'\n\n'+x.text+'\n\n- '+x.approval+' · '+x.author+' · '+x.timestamp+'\n').join('\n'),'text/markdown');document.querySelector('#import').onchange=async e=>{const value=JSON.parse(await e.target.files[0].text());if(!Array.isArray(value.comments))throw Error('INVALID_REVIEW_BOOK');book=value.comments;localStorage.setItem(key,JSON.stringify(book));draw()};draw()}addEventListener('hashchange',render);render()})();`

await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })
await writeFile(path.join(output, 'index.html'), html)
await writeFile(path.join(output, 'workbench.css'), css)
await writeFile(path.join(output, 'workbench.js'), js)
await writeFile(path.join(output, 'PRINCIPAL_REVIEW_BOOK.empty.json'), JSON.stringify({ schemaVersion: '1.0.0', revision: model.revision, contentIdentity: model.contentIdentity, comments: [] }, null, 2) + '\n')
await writeFile(path.join(output, 'PRINCIPAL_REVIEW_BOOK.empty.md'), '# Principal Review Book\n\nNo comments recorded.\n')
await writeFile(path.join(output, 'REVIEW_BOOK.schema.json'), JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', required: ['schemaVersion', 'revision', 'contentIdentity', 'comments'], properties: { schemaVersion: { const: '1.0.0' }, revision: { type: 'string' }, contentIdentity: { type: 'object' }, comments: { type: 'array', items: { type: 'object', required: ['anchor', 'category', 'approval', 'author', 'timestamp', 'sourceRevision', 'itemId', 'text'] } } } }, null, 2) + '\n')
await writeFile(path.join(output, 'README.md'), '# Principal Review Workbench\n\nOpen `index.html` in a browser or serve this directory statically. It has no backend and makes no external request. Comments are browser-local until exported. Review-only E-01 through E-04 are not game content.\n')
const manifest = []
for (const name of ['PRINCIPAL_REVIEW_BOOK.empty.json', 'PRINCIPAL_REVIEW_BOOK.empty.md', 'README.md', 'REVIEW_BOOK.schema.json', 'index.html', 'workbench.css', 'workbench.js']) {
  const bytes = await readFile(path.join(output, name)); manifest.push({ path: name, bytes: bytes.length, sha256: sha(bytes) })
}
await writeFile(path.join(output, 'BUILD_IDENTITY.json'), JSON.stringify({ schemaVersion: '1.0.0', sourceRevision: model.revision, contentIdentity: model.contentIdentity, files: manifest }, null, 2) + '\n')
console.log(`Principal Review Workbench emitted ${manifest.length + 1} deterministic files at ${path.relative(root, output)}`)
