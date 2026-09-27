import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {BASE,INTERFACE_HASH,TOKENS,schemas} from './catalog-contract.mjs'
import {entries,openingKeys,beatMappings,verbFallbacks,looks,alternates,overrides,archetypes,zeroResults,templateKeys,ladders,unavailableHint,optionalExchanges} from './source-copy.mjs'
const header={schema_version:'1.1.0',interface:'TE-IFACE-CONTENT@1.1.0',base_commit:BASE,interface_sha256:INTERFACE_HASH}
const json=value=>JSON.stringify(value,null,2)+'\n'
const digest=createHash('sha256').update(json(entries)).digest('hex')
const mappings=new Map()
for(const entry of entries) for(const surface of entry.surfaces) {
  if(!mappings.has(surface)) mappings.set(surface,[])
  mappings.get(surface).push(entry.key)
}
const outputs={
  'COPY_CATALOG.json':{...header,entries},
  'DIALOGUE_BEAT_CATALOG.json':{...header,beats:beatMappings,opening_keys:openingKeys,optional_exchanges:optionalExchanges},
  'HINT_LADDER.json':{...header,ladders,unavailable_fallback:unavailableHint},
  'DEAD_END_RESPONSE_CATALOG.json':{...header,precedence:['Existing useful rule and item/phase guards first','PUSH drawers / PULL clock overrides','GIVE Arthur with nonapproved item / TALK drawers overrides','LOOK descriptions','Verb-hotspot alternate','Verb fallback'],verb_fallbacks:verbFallbacks,looks,alternates,overrides,archetypes,zero_results:zeroResults,repeat_keys:['lane_a.puzzle.reread-record.1','lane_a.candidate.repeat','lane_a.proof.repeat']},
  'DATA_DEPENDENT_COPY_TEMPLATES.json':{...header,token_contract:TOKENS,template_keys:templateKeys,fallback_policy:'WHOLE_LINE_IF_ANY_BINDING_INVALID',input_policy:'ACCEPTED_PUBLIC_SAFE_DISCOVERED_BOUNDINGS_ONLY',output:'PLAIN_TEXT'},
  'CLAIM_BOUNDARY_COPY_AUDIT.json':{...header,content_sha256:digest,entries:entries.map(entry=>({copy_key:entry.key,claim_class:entry.claim_class,requires:entry.requires,evidence_ids:entry.evidence_ids,disposition:'AUDITED_BOUNDED_CANDIDATE',rationale:entry.claim_class==='ACCEPTED_EXACT'?'Accepted public-safe Euler facts only, gated by discovered/verified evidence; exact-time token additionally requires independently accepted exact-time binding.':entry.claim_class==='SCOPED_NEGATIVE'?'Existing classification plus sufficient accepted complete coverage required; no global absence and no negative fallback.':entry.claim_class==='FICTIONAL_FRAMING'?'Office fiction supplies access or characterization, never historical proof.':entry.claim_class==='BOUNDED_CONTEXT'?'Candidate or method scope, not exact proof, accepted P2 result or human-identity claim.':entry.claim_class==='BOUNDARY_ONLY'?'Explicit nonclaims; missing data does not establish absence.':'Procedural teaching, labels or recovery; no new historical result or runtime effect.'})),forbidden_inferences:['common human identity','offchain coordination','intent beyond recorded actions','ultimate destination of later value','contextual timestamp as exact UTC','bounded no-match as chain-wide absence','unreviewed P2 as accepted truth'],unresolved_p0_p1:0,manual_review_required:true},
  'COPY_COVERAGE_REPORT.json':{...header,content_sha256:digest,mappings:[...mappings].sort(([a],[b])=>a.localeCompare(b)).map(([surface,copy_keys])=>({surface,copy_keys,status:'MAPPED_ADDITIVE_CANDIDATE'})),late_bound:[
    {id:'P2_NAMES_COUNTS',reason:'No P2 data or acceptance received. Generic role/count templates require accepted public-safe discovered bindings.',fallback_keys:['lane_a.template.candidate','lane_a.template.results'],owner:'MAIN_CONTROLLER'},
    {id:'FOREGROUND_CORPUS',reason:'Final foreground selection is not lane-owned. Existing cards and discovered-record selectors remain controlling.',fallback_keys:['lane_a.explore.teach','lane_a.results.no_dispatch'],owner:'MAIN_CONTROLLER'},
    {id:'ART_CAPABILITIES',reason:'No final asset capability assumed; semantic intention is optional, all words remain plain text.',fallback_keys:['lane_a.accessibility.reduced_motion','lane_a.accessibility.plain_list'],owner:'MAIN_CONTROLLER'},
    {id:'PUBLIC_TITLE',reason:'Public title is unresolved. No player-facing final game title authored; use neutral Case Terminal header.',fallback_keys:['lane_a.terminal.ask'],owner:'MAIN_CONTROLLER'},
    {id:'DIALOGUE_DENSITY',reason:'MAIN binds density after playtest; optional banter/reactions are removable.',fallback_keys:['lane_a.beat.records.learn_together','lane_a.hint.unavailable'],owner:'MAIN_CONTROLLER'}
  ],excluded:[
    {surface:'Art Lab / art integrity / reviewer-only harness copy',reason:'Developer and separate art surfaces are outside player narrative scope. No assets inspected or modified.'},
    {surface:'Provider/raw/qualification execution and release copy',reason:'Outside Lane A ownership; no endpoint permissions or acquisition outcomes authored.'}
  ],runtime_integrated:false}
}
for(const [name,schema] of Object.entries(schemas)) outputs[`schemas/${name.replace('.json','.schema.json')}`]={$schema:'https://json-schema.org/draft/2020-12/schema',title:`Lane A ${name}`, ...schema}

export {outputs,digest}
// Print apply_patch input: all file creation/revision goes through apply_patch.
if(process.argv[1]?.endsWith('emit-catalogs.mjs')) {
  const name=process.argv[2]
  if(!Object.hasOwn(outputs,name)) throw new Error('Choose one known output')
  const path=`${process.cwd()}/content/parallel/narrative/${name}`
  const desired=json(outputs[name]);let old=null
  try {old=readFileSync(path,'utf8')} catch(error) {if(error.code!=='ENOENT')throw error}
  if(old===desired) process.stdout.write('UNCHANGED\n')
  else if(process.argv.includes('--incremental') && (old===null || desired.startsWith(old))) {
    const oldLines=old===null?[]:old.trimEnd().split('\n')
    const newLines=desired.trimEnd().split('\n').slice(oldLines.length,oldLines.length+700)
    process.stdout.write('*** Begin Patch\n')
    if(old===null) process.stdout.write(`*** Add File: ${path}\n`)
    else process.stdout.write(`*** Update File: ${path}\n@@\n`+oldLines.slice(-65).map(l=>' '+l).join('\n')+'\n')
    process.stdout.write(newLines.map(l=>'+'+l).join('\n')+'\n*** End Patch\n')
  }
  else {
    process.stdout.write('*** Begin Patch\n')
    if(old===null) process.stdout.write(`*** Add File: ${path}\n`+desired.trimEnd().split('\n').map(l=>'+'+l).join('\n')+'\n')
    else {
      const before=old.trimEnd().split('\n');const after=desired.trimEnd().split('\n')
      let prefix=0;let suffix=0
      while(prefix<Math.min(before.length,after.length) && before[prefix]===after[prefix])prefix++
      while(suffix<Math.min(before.length-prefix,after.length-prefix) && before.at(-suffix-1)===after.at(-suffix-1))suffix++
      process.stdout.write(`*** Update File: ${path}\n@@\n`+before.slice(Math.max(0,prefix-65),prefix).map(l=>' '+l).join('\n')+'\n'+before.slice(prefix,before.length-suffix).map(l=>'-'+l).join('\n')+'\n'+after.slice(prefix,after.length-suffix).map(l=>'+'+l).join('\n')+'\n'+before.slice(before.length-suffix,before.length-suffix+3).map(l=>' '+l).join('\n')+'\n')
    }
    process.stdout.write('*** End Patch\n')
  }
}
