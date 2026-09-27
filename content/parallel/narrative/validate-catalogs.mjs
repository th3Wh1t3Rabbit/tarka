import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {BASE,INTERFACE_HASH,BEATS,PHASES,VERBS,HOTSPOTS,ITEMS,RULES,CARDS,SECTIONS,LENSES,GRADES,FOLDER_STATES,CLUE_STATES,THREAD_STATES,CHECKS,COVERAGE_STATES,DEAD_ARCHETYPES,ZERO,TOKENS,REQUIRED,schemas,validateSchema,tokenNames} from './catalog-contract.mjs'
import {outputs} from './emit-catalogs.mjs'

export function parseUniqueJSON(text) {
  const value=JSON.parse(text)
  const tokens=[];const re=/"(?:[^"\\]|\\.)*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\],:]/g
  let last=0
  for(const match of text.matchAll(re)) {
    if(text.slice(last,match.index).trim()) throw new Error('Invalid JSON token')
    tokens.push(match[0]);last=match.index+match[0].length
  }
  if(text.slice(last).trim()) throw new Error('Invalid JSON tail')
  let i=0
  function visit() {
    const token=tokens[i++]
    if(token==='{') {
      const seen=new Set()
      if(tokens[i]==='}') {i++;return}
      while(true) {
        const key=JSON.parse(tokens[i++])
        if(seen.has(key)) throw new Error(`Duplicate JSON member ${key}`)
        seen.add(key)
        if(tokens[i++]!==':') throw new Error('Invalid JSON object')
        visit()
        const end=tokens[i++];if(end==='}')return
        if(end!==',')throw new Error('Invalid JSON object delimiter')
      }
    }
    if(token==='[') {
      if(tokens[i]===']') {i++;return}
      while(true) {visit();const end=tokens[i++];if(end===']')return;if(end!==',')throw new Error('Invalid JSON array delimiter')}
    }
  }
  visit();if(i!==tokens.length)throw new Error('JSON trailing tokens')
  return value
}
export const contentDigest=entries=>createHash('sha256').update(JSON.stringify(entries,null,2)+'\n').digest('hex')

// An independently enumerated coverage floor: this is not derived from authored
// entries, so deleting a surface and its report row cannot make coverage PASS.
export function requiredSurfaces() {
  const surfaces=[...BEATS,...BEATS.map(b=>`TODO.LEAD_COPY.${b}`)]
  for(let i=0;i<8;i++)surfaces.push(`PROVISIONAL_OPENING[${i}]`)
  RULES.forEach(r=>surfaces.push(`rule.${r}`))
  ITEMS.forEach(i=>surfaces.push(`inventory.${i}.name`,`inventory.${i}.description`))
  VERBS.forEach(v=>surfaces.push(`verb.${v}`,`fallback.${v}`))
  HOTSPOTS.forEach(h=>surfaces.push(`hotspot.${h}.name`,`hotspot.${h}.ariaLabel`,`look.${h}`))
  for(const topic of ['record','noise','charge','leave'])surfaces.push(`topic.${topic}.label`,topic==='leave'?'topic.leave.closes':`topic.${topic}.lines`)
  for(const selector of ['PUSH:filing-drawers','PULL:historical-clock','OPEN:request-dispenser','PULL:pen-stand','PULL:mr-index','OPEN:pneumatic-tube','PULL:dispatch-plunger','CLOSE:record-canister','PUSH:nansen-terminal','OPEN:rotunda-exit'])surfaces.push(`alternate.${selector}`)
  for(const selector of ['PUSH:filing-drawers','PULL:historical-clock','GIVE:mr-index:ANY_ITEM','TALK_TO:filing-drawers'])surfaces.push(`override.${selector}`)
  SECTIONS.forEach(s=>surfaces.push(`section.${s}`,`section.${s}.teaching`))
  LENSES.forEach(l=>['question','may_establish','cannot_establish'].forEach(f=>surfaces.push(`lens.${l}.${f}`)))
  CARDS.forEach(c=>['question','why','may_establish','cannot_establish','next'].forEach(f=>surfaces.push(`CARD.${c}.${f}`)))
  for(const c of ['START','WINDOW','ASSET','AMOUNT','OUT','RESULT.*','PROOF.*'])surfaces.push(`CLUE.${c}`)
  for(const [prefix,values] of Object.entries({grade:GRADES,folder:FOLDER_STATES,clue:CLUE_STATES,thread:THREAD_STATES,continuity:CHECKS,coverage:COVERAGE_STATES,dead_archetype:DEAD_ARCHETYPES,zero:ZERO,query:['BROAD','FOCUSED','CANDIDATE','EXACT'],tray:['STARTING_POINT','WHEN','WHAT_MOVED','CHECK']}))values.forEach(v=>surfaces.push(`${prefix}.${v}`))
  for(const slot of ['AMOUNT','RECEIVER','LINK'])['record','label','OPEN','FILED'].forEach(f=>surfaces.push(`proof.${slot}.${f}`))
  for(const selector of [...PHASES.map(p=>`PHASE.${p}`),'ACCESS_EARNED','CANDIDATE_DISCOVERED','EXACT_CONVERGENCE_VERIFIED'])for(const tier of ['METHOD_HINT','CASE_HINT','DIRECT_HINT'])surfaces.push(`hint.${selector}.${tier}`)
  surfaces.push('TODO.LEAD_COPY.FALSE_TERMINAL','TODO.LEAD_COPY.PROOF_01',...['HINT_METHOD','HINT_CASE','HINT_DIRECT','METHOD_HINT','CASE_HINT','DIRECT_HINT'].map(h=>`TODO.LEAD_COPY.${h}`))
  const generic=['terminal.access_locked','terminal.access_earned','terminal.ask','terminal.return','terminal.back_to_case','terminal.frozen','terminal.attribution','tray.optional_categories','receipt.teach','receipt.no_hidden_filter','receipt.dispatch','receipt.review_required','receipt.funnel','delta.teach','delta.no_exclusion','delta.predicate','results.no_dispatch','results.show_more','results.sort','candidate.why_matched','candidate.may_support','candidate.cannot_prove','candidate.next_question','candidate.source','candidate.save','candidate.pin','candidate.compare','candidate.repeat','candidate.saved','candidate.pinned','candidate.context','candidate.control','candidate.corroboration','comparison.teach','comparison.two_only','comparison.empty','caseboard.known','caseboard.open_question','caseboard.trace','caseboard.gap','caseboard.theory_not_fact','caseboard.read_first','caseboard.read_second','proof.context_rejected','proof.insufficient','proof.build_case','source.event_time','source.retrieval_time','source.contextual_time','source.precision','source.raw_digest','source.normalized_digest','source.lineage','source.derived','source.boundary','explore.teach','explore.search','explore.search_no_match','explore.manual','ledger.attempts','ledger.responses','ledger.supplier','ledger.acceptance','ledger.credits','ledger.reuse','ledger.fixture','ledger.unknown','ledger.coverage','ledger.atlas','ledger.why_nansen','recovery.query_changed','recovery.undo','recovery.redo','recovery.last_dispatch','recovery.remove_chips','recovery.save_query','recovery.load_query','recovery.reset_case','recovery.invalid_input','recovery.locked_identifier','recovery.invalid_save','recovery.corpus_load','recovery.storage_unavailable','recovery.reentry','physical.equivalent','physical.canister_returned','physical.canister_empty','accessibility.player_paced','accessibility.plain_list','accessibility.reduced_motion','accessibility.instant_text','accessibility.high_contrast','accessibility.focus','fictional_boundary','proof.repeat','conclusion.heading','conclusion.boundary','theory.falsifier','theory.recovery','theory.FIRST_TRAIL_STOPS_AT_FIRST_ENGINE','theory.FIRST_TRAIL_JOINS_SECOND_ROUTE','hint.unavailable','banter.mr_a.rook','banter.mr_a.arthur','banter.archive_ace.rook','banter.archive_ace.arthur','reaction.exact_rook']
  return [...new Set([...surfaces,...generic])]
}
export function forbiddenClaim(text) {
  return /(?:proves?|establishes?) (?:the )?(?:same human|human identity|offchain coordination|ultimate destination)|same person controls|(?:no|zero) (?:events|transactions) (?:anywhere|on the entire chain)|complete chain history (?:is|has been) (?:searched|proved)|P2 (?:results?|counts?) (?:are|is) accepted|enter (?:your|a|the) (?:API )?key/i.test(text)
}
export function validateCatalogs(catalogs) {
  const errors=[]
  const fail=message=>errors.push(message)
  for(const name of REQUIRED) {
    if(!catalogs[name]) {fail(`Missing ${name}`);continue}
    errors.push(...validateSchema(catalogs[name],schemas[name],name))
  }
  if(errors.length)return errors
  const copy=catalogs['COPY_CATALOG.json'];const entries=copy.entries
  const keys=new Map()
  for(const entry of entries) {
    if(keys.has(entry.key))fail(`Duplicate key ${entry.key}`)
    keys.set(entry.key,entry)
    try {
      const tokens=tokenNames(entry.text)
      if(JSON.stringify(tokens)!==JSON.stringify([...entry.tokens].sort()))fail(`Token list mismatch ${entry.key}`)
      if(tokens.some(t=>!Object.hasOwn(TOKENS,t)))fail(`Forbidden token ${entry.key}`)
      if(tokenNames(entry.fallback).length)fail(`Unresolved fallback token ${entry.key}`)
    } catch(error) {fail(`${entry.key}: ${error.message}`)}
    if(forbiddenClaim(entry.text)||forbiddenClaim(entry.fallback))fail(`Forbidden claim ${entry.key}`)
    if(entry.optional!==['OPTIONAL_BANTER','REACTION'].includes(entry.line_class))fail(`Optionality mismatch ${entry.key}`)
    if(entry.optional && entry.surfaces.some(s=>/^(?:records\.|TODO\.|rule\.|proof\.|conclusion\.|hint\.)/.test(s)))fail(`Critical surface only optional ${entry.key}`)
    if(entry.claim_class==='SCOPED_NEGATIVE' && !entry.requires.includes('NEGATIVE_SCOPE_ACCEPTED'))fail(`Negative scope gate missing ${entry.key}`)
    if(entry.claim_class==='ACCEPTED_EXACT' && !entry.tokens.includes('EXACT_TIME_IF_ACCEPTED') && (!entry.evidence_ids.length || !entry.requires.some(g=>g.startsWith('EXACT_'))))fail(`Exact evidence gate missing ${entry.key}`)
    if(entry.evidence_ids.includes('STATE_EARLY_ENGINE') && entry.claim_class==='ACCEPTED_EXACT')fail(`Derived state promoted ${entry.key}`)
    if(entry.evidence_ids.some(id=>id.startsWith('CONTEXT_')) && entry.claim_class==='ACCEPTED_EXACT')fail(`Context promoted ${entry.key}`)
    if(/Mr\. Index|MR_INDEX|mr-index|mrIndex/.test(entry.text))fail(`Legacy display in player copy ${entry.key}`)
    if(/\[PROVISIONAL\]|TODO\.LEAD_COPY/.test(entry.text))fail(`Placeholder copy ${entry.key}`)
    if(/\d{2}:\d{2}:\d{2}|8,877,507|8\.88M/.test(entry.text) && entry.claim_class!=='ACCEPTED_EXACT')fail(`Literal historical value unclassified ${entry.key}`)
    if(entry.surfaces.some(s=>s.startsWith('hint.')) && /0x[a-f\d]{8}|\d{2}:\d{2}|8,877|8\.88M|Receiving Vault|THE FIRST TRAIL JOINED/i.test(entry.text))fail(`Hint leaks exact value ${entry.key}`)
  }
  const referenced=[]
  function collectKeys(value) {
    if(typeof value==='string' && value.startsWith('lane_a.'))referenced.push(value)
    if(Array.isArray(value))value.forEach(collectKeys)
    else if(value && typeof value==='object')Object.values(value).forEach(collectKeys)
  }
  for(const name of REQUIRED.filter(n=>n!=='COPY_CATALOG.json'))collectKeys(catalogs[name])
  for(const key of referenced)if(!keys.has(key))fail(`Dangling reference ${key}`)
  const digest=contentDigest(entries)
  const audit=catalogs['CLAIM_BOUNDARY_COPY_AUDIT.json']
  const coverage=catalogs['COPY_COVERAGE_REPORT.json']
  if(audit.content_sha256!==digest || coverage.content_sha256!==digest)fail('Stale content digest')
  if(new Set(audit.entries.map(e=>e.copy_key)).size!==entries.length || audit.entries.length!==entries.length)fail('Incomplete or duplicate claim audit')
  for(const row of audit.entries) {
    const entry=keys.get(row.copy_key)
    if(!entry || row.claim_class!==entry.claim_class || JSON.stringify(row.requires)!==JSON.stringify(entry.requires) || JSON.stringify(row.evidence_ids)!==JSON.stringify(entry.evidence_ids))fail(`Audit mismatch ${row.copy_key}`)
  }
  const surfaces=new Map()
  for(const row of coverage.mappings) {
    if(surfaces.has(row.surface))fail(`Duplicate coverage mapping ${row.surface}`)
    surfaces.set(row.surface,row.copy_keys)
    for(const key of row.copy_keys)if(!keys.get(key)?.surfaces.includes(row.surface))fail(`Coverage mapping drift ${row.surface}`)
  }
  for(const entry of entries)for(const surface of entry.surfaces)if(!surfaces.get(surface)?.includes(entry.key))fail(`Unreported surface ${surface}`)
  for(const surface of requiredSurfaces())if(!surfaces.has(surface))fail(`Missing coverage ${surface}`)
  const dialogue=catalogs['DIALOGUE_BEAT_CATALOG.json']
  const linked=(key,surface)=>{
    const entry=keys.get(key)
    if(!entry || !entry.surfaces.includes(surface) || entry.optional)fail(`Selector linkage drift ${surface}`)
  }
  if(JSON.stringify(dialogue.beats.map(b=>b.beat_id))!==JSON.stringify(BEATS))fail('Beat order/identity drift')
  dialogue.beats.forEach((b,i)=>{
    linked(b.copy_key,b.beat_id)
    if(b.cue_id!==`onboarding.${String(i+1).padStart(2,'0')}` || b.legacy_copy_key!==`TODO.LEAD_COPY.${BEATS[i]}` || keys.get(b.copy_key)?.speaker!==b.speaker)fail(`Beat mapping drift ${b.beat_id}`)
  })
  if(dialogue.opening_keys.length!==8 || new Set(dialogue.opening_keys).size!==8)fail('Opening coverage mismatch')
  dialogue.opening_keys.forEach((key,i)=>linked(key,`PROVISIONAL_OPENING[${i}]`))
  if(dialogue.optional_exchanges.length>2 || dialogue.optional_exchanges.some(x=>x.copy_keys.length!==2 || x.copy_keys.some(k=>keys.get(k)?.line_class!=='OPTIONAL_BANTER')))fail('Optional nickname excess/drift')
  if(entries.filter(e=>e.line_class==='OPTIONAL_BANTER').length>8)fail('Optional banter exceeds editorial budget')
  const hint=catalogs['HINT_LADDER.json']
  if(new Set(hint.ladders.map(l=>l.selector)).size!==hint.ladders.length)fail('Duplicate hint selector')
  const hintSelectors=[...PHASES.map(p=>`PHASE.${p}`),'ACCESS_EARNED','CANDIDATE_DISCOVERED','EXACT_CONVERGENCE_VERIFIED'].sort()
  if(JSON.stringify(hint.ladders.map(l=>l.selector).sort())!==JSON.stringify(hintSelectors))fail('Hint selector coverage drift')
  for(const ladder of hint.ladders)for(const [tier,key] of Object.entries(ladder.tiers)) {
    linked(key,`hint.${ladder.selector}.${tier}`)
    if(keys.get(key)?.optional)fail('Optional hint')
    if(!keys.get(key)?.requires.includes(ladder.selector))fail(`Hint prerequisite drift ${ladder.selector}.${tier}`)
  }
  linked(hint.unavailable_fallback,'hint.unavailable')
  const dead=catalogs['DEAD_END_RESPONSE_CATALOG.json']
  if(JSON.stringify(dead.verb_fallbacks.map(r=>r.verb))!==JSON.stringify(VERBS))fail('Verb fallback coverage drift')
  if(JSON.stringify(dead.looks.map(r=>r.target_id))!==JSON.stringify(HOTSPOTS))fail('LOOK coverage drift')
  if(JSON.stringify(dead.zero_results.map(r=>r.classification))!==JSON.stringify(ZERO))fail('Zero classification drift')
  for(const [field,prefix,id] of [['verb_fallbacks','fallback.','verb'],['looks','look.','target_id'],['alternates','alternate.','selector'],['overrides','override.','selector'],['archetypes','dead_archetype.','archetype'],['zero_results','zero.','classification']]) {
    const expected=requiredSurfaces().filter(s=>s.startsWith(prefix)).sort()
    const actual=dead[field].map(r=>prefix+r[id]).sort()
    if(JSON.stringify(actual)!==JSON.stringify(expected))fail(`Dead-end selector coverage drift ${field}`)
    dead[field].forEach(r=>linked(r.copy_key,prefix+r[id]))
  }
  if(dead.zero_results.some(r=>r.changes_theory!==(r.classification==='NEGATIVE_EVIDENCE_SUPPORTED')))fail('Unauthorized zero-result falsifier')
  const templates=catalogs['DATA_DEPENDENT_COPY_TEMPLATES.json']
  if(JSON.stringify(templates.token_contract)!==JSON.stringify(TOKENS))fail('Token contract drift')
  if(JSON.stringify([...templates.template_keys].sort())!==JSON.stringify(entries.filter(e=>e.tokens.length).map(e=>e.key).sort()))fail('Template coverage mismatch')
  if(keys.get('lane_a.conclusion.heading')?.text!=='THE FIRST TRAIL JOINED THE SECOND ROUTE.')fail('Conclusion drift')
  if(!keys.get('lane_a.conclusion.heading')?.requires.includes('CASE_COMPLETE'))fail('Conclusion gate missing')
  if(!keys.get('lane_a.conclusion.boundary')?.text.includes('offchain coordination'))fail('Conclusion boundary missing')
  const proofGates={EXACT_EARLY_NET:'EXACT_EARLY_DISCOVERED',EXACT_MAIN_RECEIVER:'EXACT_MAIN_DISCOVERED',EXACT_CONVERGENCE:'EXACT_CONVERGENCE_VERIFIED'}
  for(const entry of entries.filter(e=>e.claim_class==='ACCEPTED_EXACT' && !e.tokens.length))for(const id of entry.evidence_ids) {
    if(proofGates[id] && !entry.requires.includes(proofGates[id]) && !(entry.key==='lane_a.conclusion.heading' && entry.requires.includes('CASE_COMPLETE')))fail(`Exact prerequisite linkage drift ${entry.key}`)
  }
  return errors
}

export function loadCatalogs(root=process.cwd()) {
  return Object.fromEntries(REQUIRED.map(name=>[name,parseUniqueJSON(readFileSync(resolve(root,'content/parallel/narrative',name),'utf8'))]))
}
export function validateFiles(root=process.cwd(),checkGit=true) {
  const catalogs=loadCatalogs(root);const errors=validateCatalogs(catalogs)
  for(const [name,schema] of Object.entries(schemas)) {
    const stored=parseUniqueJSON(readFileSync(resolve(root,'content/parallel/narrative/schemas',name.replace('.json','.schema.json')),'utf8'))
    const expected={$schema:'https://json-schema.org/draft/2020-12/schema',title:`Lane A ${name}`,...schema}
    if(JSON.stringify(stored)!==JSON.stringify(expected))errors.push(`Schema drift ${name}`)
  }
  for(const [name,value] of Object.entries(outputs).filter(([name])=>!name.startsWith('schemas/')))if(JSON.stringify(catalogs[name])!==JSON.stringify(value))errors.push(`Editorial-source reproducibility drift ${name}`)
  const iface=parseUniqueJSON(readFileSync(resolve(root,'docs/parallel/lane-a/TE_IFACE_CONTENT_v1.1.0.json'),'utf8'))
  const claimed=iface.canonical_sha256;delete iface.canonical_sha256
  const sort=value=>Array.isArray(value)?value.map(sort):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,sort(value[k])])):value
  const identity=createHash('sha256').update(JSON.stringify(sort(iface))+'\n').digest('hex')
  if(claimed!==INTERFACE_HASH || identity!==INTERFACE_HASH)errors.push('Frozen interface hash mismatch')
  if(JSON.stringify(iface.copy_token_allowlist)!==JSON.stringify(Object.keys(TOKENS)))errors.push('Frozen token allowlist mismatch')
  if(JSON.stringify(iface.stable_beat_ids)!==JSON.stringify(BEATS))errors.push('Frozen beat contract mismatch')
  if(checkGit) {
    const git=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim()
    if(git('rev-parse',`${BASE}^{tree}`)!=='49041b9b79c5fe594356d7cccc9ffcb7bb085256')errors.push('Base tree mismatch')
    const allowed=/^(?:content\/parallel\/narrative\/|docs\/parallel\/lane-a\/|tests\/unit\/parallel\/narrative-contract\/)/
    const paths=[...git('diff','--name-only',BASE).split('\n'),...git('ls-files','--others','--exclude-standard').split('\n')].filter(Boolean)
    for(const path of paths)if(!allowed.test(path))errors.push(`Forbidden path ${path}`)
    const runtime=readFileSync(resolve(root,'src/adventure/narrative.ts'),'utf8')
    const beats=[...runtime.matchAll(/'records\.([a-z_]+)'/g)].slice(0,10).map(m=>`records.${m[1]}`)
    if(JSON.stringify(beats)!==JSON.stringify(BEATS))errors.push('Runtime beat mapping drift')
    const content=readFileSync(resolve(root,'src/adventure/content.ts'),'utf8')
    const ruleIds=[...content.matchAll(/\{ id: '([^']+)', verb:/g)].map(m=>m[1])
    if(JSON.stringify(ruleIds)!==JSON.stringify(RULES))errors.push('Runtime rule coverage drift')
    const state=readFileSync(resolve(root,'src/investigation/state.ts'),'utf8')
    const cards=[...state.matchAll(/make\('([A-Z_]+)'/g)].map(m=>m[1])
    if(JSON.stringify(cards)!==JSON.stringify(CARDS))errors.push('Runtime card coverage drift')
  }
  return {status:errors.length?'FAIL':'PASS',errors,entries:catalogs['COPY_CATALOG.json'].entries.length,coverage_surfaces:catalogs['COPY_COVERAGE_REPORT.json'].mappings.length,required_surfaces:requiredSurfaces().length,content_sha256:contentDigest(catalogs['COPY_CATALOG.json'].entries),runtime_integrated:false}
}
if(resolve(process.argv[1]??'')===fileURLToPath(import.meta.url)) {
  try {const report=validateFiles();process.stdout.write(JSON.stringify(report,null,2)+'\n');if(report.errors.length)process.exitCode=1}
  catch(error) {process.stderr.write(`Validation failed: ${error.message}\n`);process.exitCode=1}
}
