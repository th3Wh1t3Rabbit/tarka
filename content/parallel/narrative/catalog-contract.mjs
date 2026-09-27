// Lane-local contract; no production runtime imports or changes.
export const BASE = 'a1bf6689b9ba6a3c7077869ee03be1926b2e1c41'
export const INTERFACE_HASH = '7d682d883fc55b80ed3c5ea752ea942d94000942257dd93a3eddc22a66c36903'
export const BEATS = ['no_ordinary_witnesses','rook_assumes_no_leads','event_was_onchain','rook_misses_implication','public_but_hard_to_read','rook_premature_confidence','archivist_corrects_scope','authorized_case_access','nansen_structures_not_solves','learn_together'].map(id => `records.${id}`)
export const CLASSES = ['CORE','METHOD','CASE','OPTIONAL_BANTER','REACTION','DEAD_END','SYSTEM']
export const INTENTIONS = ['IDLE','SPEAK','LISTEN','EXPLAIN','PRESENT','SKEPTICAL','CONFUSED','PROUD','IRRITATED','FRUSTRATED','AMUSED','ATTENTIVE']
export const LENSES = ['ACTIVITY','RELATIONSHIPS','STATE','RECEIPT']
export const SECTIONS = ['CASE','RESULTS','EXPLORE','SOURCE','LEDGER']
export const PHASES = ['START','TICKET_PULLED','REQUEST_COMPLETED','REQUEST_STAMPED','REQUEST_IN_TUBE','TUBE_CLOSED','DISPATCHED','CANISTER_OPEN','STRIP_TAKEN','TERMINAL_UNLOCKED','COMPLETE']
export const VERBS = ['GIVE','PICK_UP','USE','OPEN','LOOK_AT','PUSH','CLOSE','TALK_TO','PULL']
export const HOTSPOTS = ['filing-drawers','historical-clock','request-dispenser','pen-stand','mr-index','pneumatic-tube','dispatch-plunger','record-canister','nansen-terminal','rotunda-exit']
export const ITEMS = ['blank-request','completed-request','stamped-request','first-breach-strip']
export const RULES = ['pull-ticket','complete-request','stamp-request','load-tube','close-tube','dispatch-request','open-canister','take-strip','unlock-terminal','read-record','reread-record']
export const CARDS = ['WHAT_LEFT','INCIDENT','ASSET_OUT','HIGH_VALUE','INTERACTIONS','STATE_CHANGE','WHAT_ARRIVED','FOLLOW_FORWARD','EXACT_RECEIPT','COMPARE_ROUTES']
export const ZERO = ['NO_MATCH_IN_ACCEPTED_CORPUS','NEGATIVE_EVIDENCE_SUPPORTED','QUERY_OUTSIDE_COVERAGE']
export const GRADES = ['EXACT','CORROBORATING','CONTEXTUAL']
export const FOLDER_STATES = ['UNTESTED','SAVED','CORROBORATING','CONTRADICTED','EXACT']
export const CLUE_STATES = ['LOCKED','DISCOVERED','AVAILABLE','APPLIED','RELATED','PINNED','ARCHIVED']
export const THREAD_STATES = ['OPEN','CANDIDATE_FITS','NEEDS_EXACT_LINK','CORROBORATED_NOT_PROVEN','CONTRADICTED','PROVED']
export const CHECKS = ['CHRONOLOGY','SOURCE_DESTINATION','ASSET_OR_PROVEN_TRANSFORMATION','AMOUNT_RELATIONSHIP','EXACT_RELATIONSHIP','CUTOFF']
export const COVERAGE_STATES = ['PLANNED','COMPLETE','PARTIAL','EMPTY_COMPLETE','FAILED','NOT_IN_SCOPE']
export const DEAD_ARCHETYPES = ['LOUD_ROOM','RIGHT_ASSET_WRONG_TIME','RIGHT_TIME_WRONG_DIRECTION','FAMILIAR_COUNTERPARTY','BALANCE_MIRAGE','FALSE_TERMINAL']
export const GATES = ['ACCESS_EARNED','CANDIDATE_DISCOVERED','TWO_CANDIDATES_SELECTED','EXACT_EARLY_DISCOVERED','EXACT_MAIN_DISCOVERED','EXACT_CONVERGENCE_VERIFIED','CASE_COMPLETE','NEGATIVE_SCOPE_ACCEPTED','RESULT_CLASSIFIED','RESTORE_VALID','QUERY_REPLAY_AVAILABLE','SLOT.AMOUNT_FILED','SLOT.RECEIVER_FILED','SLOT.LINK_FILED']
export const TOKENS = {
  QUESTION_LENS: {type:'enum', values:LENSES},
  SUBJECT_ROLE: {type:'enum', values:['Early Trigger','First Engine','Main Trigger','Extraction Engine','Receiving Vault','Secondary Receiver Context']},
  NARRATIVE_PHASE: {type:'enum', values:['BREACH_OPEN','ROUTE_DEVELOPMENT','POST_FALSIFIER_TO_CUTOFF']},
  RESULT_COUNT: {type:'count'}, PREVIOUS_COUNT: {type:'count'},
  FILTER_EFFECT: {type:'enum', values:['asset filter','time-window filter','outgoing-direction filter','incoming-direction filter','amount filter','receipt filter','comparison selection']},
  EVIDENCE_GRADE: {type:'enum', values:GRADES},
  COVERAGE_SCOPE: {type:'enum', values:['accepted frozen records within the incident window','the accepted subject, lens and time window shown in SOURCE','the accepted complete coverage cell shown in LEDGER']},
  CANDIDATE_ROLE: {type:'enum', values:['a candidate continuation','a contextual lead','a corroborating view','a control','a bounded dead end']},
  PUBLIC_CALL_ID: {type:'public_call_id'},
  EXACT_TIME_IF_ACCEPTED: {type:'exact_time', values:['2023-03-13T08:50:59Z','2023-03-13T09:12:23Z','2023-03-13T11:38:11Z']}
}
export const REQUIRED = ['DIALOGUE_BEAT_CATALOG.json','COPY_CATALOG.json','HINT_LADDER.json','DEAD_END_RESPONSE_CATALOG.json','DATA_DEPENDENT_COPY_TEMPLATES.json','ARTHUR_RUNTIME_ALIAS_MAP.json','CLAIM_BOUNDARY_COPY_AUDIT.json','COPY_COVERAGE_REPORT.json']
export const s = {type:'string',minLength:1}
const a = items => ({type:'array',items})
const unique = items => ({...a(items),uniqueItems:true})
const en = values => ({type:'string',enum:values})
const obj = properties => ({type:'object',additionalProperties:false,required:Object.keys(properties),properties})
const key = {type:'string',pattern:'^lane_a\\.[a-z0-9_.-]+$'}
export const entrySchema = obj({
  key, text:s, fallback:s, speaker:en(['ROOK','ARCHIVIST','SYSTEM']), line_class:en(CLASSES),
  intention:en(INTENTIONS), performance_fallback:{const:'TEXT_ONLY'},
  claim_class:en(['FICTIONAL_FRAMING','METHOD_ONLY','BOUNDED_CONTEXT','SCOPED_NEGATIVE','ACCEPTED_EXACT','BOUNDARY_ONLY']),
  requires:unique(en([...GATES,...PHASES.map(p=>`PHASE.${p}`)])),
  evidence_ids:unique(en(['EXACT_EARLY_NET','EXACT_MAIN_RECEIVER','EXACT_CONVERGENCE','STATE_EARLY_ENGINE','CONTEXT_FIRST_ENGINE_ACTIVITY','CONTEXT_SECONDARY'])),
  surfaces:{...unique(s),minItems:1}, tokens:unique(en(Object.keys(TOKENS))),
  optional:{type:'boolean'}, source_refs:{...unique(s),minItems:1}
})
const header = {
  schema_version:{const:'1.1.0'}, interface:{const:'TE-IFACE-CONTENT@1.1.0'},
  base_commit:{const:BASE}, interface_sha256:{const:INTERFACE_HASH}
}
export const schemas = {
  'COPY_CATALOG.json':obj({...header,entries:{...a(entrySchema),minItems:1}}),
  'DIALOGUE_BEAT_CATALOG.json':obj({...header,beats:a(obj({beat_id:en(BEATS),cue_id:s,legacy_copy_key:s,copy_key:key,speaker:en(['ROOK','ARCHIVIST','SYSTEM']),advance:{const:'PLAYER_PACED'},runtime_effects_preserved:{const:true}})),opening_keys:a(key),optional_exchanges:a(obj({id:s,copy_keys:a(key),selection:{const:'EXPLICIT_OPTIONAL'},max_per_interaction:{const:1},progression_role:{const:false}}))}),
  'HINT_LADDER.json':obj({...header,ladders:a(obj({id:s,selector:s,tiers:obj({METHOD_HINT:key,CASE_HINT:key,DIRECT_HINT:key}),no_undiscovered_value:{const:true}})),unavailable_fallback:key}),
  'DEAD_END_RESPONSE_CATALOG.json':obj({...header,precedence:a(s),verb_fallbacks:a(obj({verb:en(VERBS),copy_key:key})),looks:a(obj({target_id:en(HOTSPOTS),copy_key:key})),alternates:a(obj({selector:s,copy_key:key})),overrides:a(obj({selector:s,copy_key:key})),archetypes:a(obj({archetype:en(DEAD_ARCHETYPES),copy_key:key,activation:{const:'EXISTING_ACCEPTED_CLASSIFICATION_ONLY'}})),zero_results:a(obj({classification:en(ZERO),copy_key:key,changes_theory:{type:'boolean'}})),repeat_keys:a(key)}),
  'DATA_DEPENDENT_COPY_TEMPLATES.json':obj({...header,token_contract:{type:'object'},template_keys:unique(key),fallback_policy:{const:'WHOLE_LINE_IF_ANY_BINDING_INVALID'},input_policy:{const:'ACCEPTED_PUBLIC_SAFE_DISCOVERED_BOUNDINGS_ONLY'},output:{const:'PLAIN_TEXT'}}),
  'ARTHUR_RUNTIME_ALIAS_MAP.json':obj({schema_version:{const:'1.1.0'},interface:{const:'TE-IFACE-CONTENT@1.1.0'},public_name:{const:'Arthur'},public_styling:{const:'Arthur the Archivist'},semantic_id:{const:'archivist'},semantic_speaker:{const:'ARCHIVIST'},legacy:obj({speaker:{const:'MR_INDEX'},hotspot:{const:'mr-index'},art_manifest_key:{const:'mrIndex'},historical_display:{const:'Mr. Index'}}),rook_primary_nickname:{const:'Mr. A'},runtime_rename_authorized:{const:false},integration_rule:s}),
  'CLAIM_BOUNDARY_COPY_AUDIT.json':obj({...header,content_sha256:s,entries:a(obj({copy_key:key,claim_class:entrySchema.properties.claim_class,requires:entrySchema.properties.requires,evidence_ids:entrySchema.properties.evidence_ids,disposition:{const:'AUDITED_BOUNDED_CANDIDATE'},rationale:s})),forbidden_inferences:unique(s),unresolved_p0_p1:{const:0},manual_review_required:{const:true}}),
  'COPY_COVERAGE_REPORT.json':obj({...header,content_sha256:s,mappings:a(obj({surface:s,copy_keys:{...unique(key),minItems:1},status:{const:'MAPPED_ADDITIVE_CANDIDATE'}})),late_bound:a(obj({id:s,reason:s,fallback_keys:{...unique(key),minItems:1},owner:{const:'MAIN_CONTROLLER'}})),excluded:a(obj({surface:s,reason:s})),runtime_integrated:{const:false}})
}

// Deliberately small strict validator for the lane's closed local schema subset.
export function validateSchema(value, schema, path='$') {
  const errors=[]
  const err=message=>errors.push(`${path}: ${message}`)
  if ('const' in schema && JSON.stringify(value)!==JSON.stringify(schema.const)) err('const mismatch')
  if (schema.enum && !schema.enum.includes(value)) err('enum mismatch')
  if (schema.type) {
    const type=Array.isArray(value)?'array':value===null?'null':typeof value
    if (type!==schema.type) {err(`expected ${schema.type}`);return errors}
  }
  if (typeof value==='string') {
    if (schema.minLength && value.length<schema.minLength) err('empty string')
    if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) err('pattern mismatch')
  }
  if (Array.isArray(value)) {
    if (schema.minItems && value.length<schema.minItems) err('too few items')
    if (schema.uniqueItems && new Set(value.map(x=>JSON.stringify(x))).size!==value.length) err('duplicate item')
    if (schema.items) value.forEach((x,i)=>errors.push(...validateSchema(x,schema.items,`${path}[${i}]`)))
  }
  if (value && !Array.isArray(value) && typeof value==='object') {
    for (const p of schema.required??[]) if (!Object.hasOwn(value,p)) err(`missing ${p}`)
    for (const [p,v] of Object.entries(value)) {
      if (schema.properties?.[p]) errors.push(...validateSchema(v,schema.properties[p],`${path}.${p}`))
      else if (schema.additionalProperties===false) err(`unknown ${p}`)
    }
  }
  return errors
}

export function tokenNames(text) {
  const names=[...text.matchAll(/\{([A-Z_]+)\}/g)].map(m=>m[1])
  if (/[{}]/.test(text.replace(/\{([A-Z_]+)\}/g,''))) throw new Error('Malformed token')
  return [...new Set(names)].sort()
}
export function validBinding(name,binding) {
  const spec=TOKENS[name]
  if (!spec || !binding || binding.accepted!==true || binding.publicSafe!==true || binding.discovered!==true || typeof binding.sourceRef!=='string' || !binding.sourceRef.trim()) return false
  const value=binding.value
  if (spec.type==='count') return Number.isSafeInteger(value) && value>=0
  if (spec.type==='enum') return spec.values.includes(value)
  if (spec.type==='public_call_id') return typeof value==='string' && /^NQ5-[0-9]{6}$/.test(value)
  return spec.values.includes(value) && binding.grade==='EXACT' && binding.exactTimeAccepted===true
}
export function renderEntry(entry,bindings={},context={}) {
  if (!entry.requires.every(g=>context[g]===true)) return {text:entry.fallback,usedFallback:true,reason:'PREREQUISITE_NOT_MET'}
  if (entry.tokens.some(t=>!validBinding(t,bindings[t]))) return {text:entry.fallback,usedFallback:true,reason:'TOKEN_NOT_ADMITTED'}
  return {text:entry.text.replace(/\{([A-Z_]+)\}/g,(_,name)=>String(bindings[name].value)),usedFallback:false,reason:'ADMITTED'}
}

// Literal-copy bindings pinned to the accepted public source. These are not a
// route-proof predicate: production exactPredicate is still required below.
export const EXACT_COPY_BINDINGS = {
  EXACT_EARLY_NET:{observedAtUtc:'2023-03-13T08:50:59Z',transactionHash:'0xc310a0affe2169d1f6feec1c63dbc7f7c62a887fa48795d327d4d2da2d6b111d',source:'0x5f259d0b76665c337c6104145894f4d1d2758b8c',destination:'0xebc29199c817dc47ba12e3f86102564d640cbf99',assetAmounts:[{asset:'DAI',amount:'8877507.3483067',unit:'TOKEN'}],rawSha256:'b35f77a345248b804ca6783974d83226f49b5bef9bb42b4ff6e15c03b6593910'},
  EXACT_MAIN_RECEIVER:{observedAtUtc:'2023-03-13T09:12:23Z',transactionHash:'0x298bde3f9e53f7a5d870f7f5d56ee2f5e41fa25e6eb5e74611ac97025405db55',source:'0x036cec1a199234fc02f72d29e596a09440825f1c',destination:'0xb66cd966670d962c227b3eaba30a872dbfb995db',assetAmounts:[{asset:'DAI',amount:'34186225.91950095',unit:'TOKEN'},{asset:'ETH',amount:'88752.69745982855',unit:'NATIVE'}],rawSha256:'ce4b2eb4a87e23b86a73dd40b4795decc68f5136c2eb463fbac58ed005ed40fe'},
  EXACT_CONVERGENCE:{observedAtUtc:'2023-03-13T11:38:11Z',transactionHash:'0xdae809e4a1ddf77c39d44a4acfe6165bedbc19a385c4b241242cc9bd582a80b9',source:'0xebc29199c817dc47ba12e3f86102564d640cbf99',destination:'0xb66cd966670d962c227b3eaba30a872dbfb995db',assetAmounts:[{asset:'DAI',amount:'8877507.348306697',unit:'TOKEN'}],rawSha256:'e5f2d6701598192b560a1f179fedc7450bcf3d00588a2efcd564f80963c32e32'}
}
// Consumption adapter, not a new reducer or historical predicate. MAIN must
// supply the existing production exactPredicate and dispatchQuery functions,
// operating on its admitted public fixture. Missing/throwing checks fail closed.
export function contextFromState(fixture,state,officePhase=null,runtime={}) {
  const context=Object.fromEntries(GATES.map(g=>[g,false]))
  for(const phase of PHASES) context[`PHASE.${phase}`]=officePhase===phase
  if(!fixture || !state || state.fixtureId!==fixture.id) return context
  const known=new Set(state.discoveredRecords??[])
  const accepted=fixture.id==='EULER_2023_FALSE_EXIT' && fixture.mode==='ACCEPTED_FROZEN' && fixture.cutoffUtc==='2023-03-13T12:15:00Z'
  const actualExact=id=>accepted && state.access===true && known.has(id) && (fixture.records??[]).some(r=>{
    const expected=EXACT_COPY_BINDINGS[id]
    return expected && r.id===id && r.grade==='EXACT' && r.exactRelationship===true && Array.isArray(r.derivedFrom) && r.derivedFrom.length===0 &&
      JSON.stringify({observedAtUtc:r.observedAtUtc,transactionHash:r.transactionHash,source:r.source,destination:r.destination,assetAmounts:r.assetAmounts,rawSha256:r.provenance?.rawSha256})===JSON.stringify(expected)
  })
  const checked=fn=>{try{return fn()===true}catch{return false}}
  context.ACCESS_EARNED=state.access===true
  context.CANDIDATE_DISCOVERED=context.ACCESS_EARNED && known.has(state.selectedRecordId)
  context.TWO_CANDIDATES_SELECTED=context.ACCESS_EARNED && state.comparison?.length===2 && new Set(state.comparison).size===2 && state.comparison.every(id=>known.has(id))
  context.EXACT_EARLY_DISCOVERED=actualExact('EXACT_EARLY_NET')
  context.EXACT_MAIN_DISCOVERED=actualExact('EXACT_MAIN_RECEIVER')
  context.EXACT_CONVERGENCE_VERIFIED=actualExact('EXACT_CONVERGENCE') && (state.exactEventIds??[]).includes('EXACT.EXACT_CONVERGENCE') && checked(()=>runtime.exactPredicate(fixture,fixture.records.find(r=>r.id==='EXACT_CONVERGENCE')))
  const slots={AMOUNT:'EXACT_EARLY_NET',RECEIVER:'EXACT_MAIN_RECEIVER',LINK:'EXACT_CONVERGENCE'}
  for(const [slot,id] of Object.entries(slots)) context[`SLOT.${slot}_FILED`]=context.EXACT_CONVERGENCE_VERIFIED && actualExact(id) && state.assembly?.[slot]===id
  context.CASE_COMPLETE=state.complete===true && Object.keys(slots).every(slot=>context[`SLOT.${slot}_FILED`])
  context.RESULT_CLASSIFIED=!!state.result
  context.NEGATIVE_SCOPE_ACCEPTED=accepted && context.ACCESS_EARNED && state.result?.zeroClass==='NEGATIVE_EVIDENCE_SUPPORTED' && Array.isArray(state.result.recordIds) && state.result.recordIds.length===0 && checked(()=>{
    const result=state.result,query=result.query
    const from=query?.filters?.filter(f=>f.field==='FROM'),to=query?.filters?.filter(f=>f.field==='TO')
    if(from?.length!==1 || to?.length!==1 || !Number.isFinite(Date.parse(from[0].value)) || !Number.isFinite(Date.parse(to[0].value)) || Date.parse(from[0].value)>Date.parse(to[0].value))return false
    const replay=runtime.dispatchQuery(fixture,query,null)
    return replay.zeroClass==='NEGATIVE_EVIDENCE_SUPPORTED' && replay.recordIds.length===0 && replay.coverageIds.length>0 && JSON.stringify([...replay.coverageIds].sort())===JSON.stringify([...(result.coverageIds??[])].sort())
  })
  context.QUERY_REPLAY_AVAILABLE=!!state.lastDispatchQuery
  return context
}

export function selectZeroEntry(catalog,result,context) {
  if(!result || !ZERO.includes(result.zeroClass)) return null
  if(result.zeroClass==='NEGATIVE_EVIDENCE_SUPPORTED' && context.NEGATIVE_SCOPE_ACCEPTED!==true) return null
  return catalog.zero_results.find(z=>z.classification===result.zeroClass)?.copy_key??null
}

export function selectHint(ladder,tier,context) {
  if(!['METHOD_HINT','CASE_HINT','DIRECT_HINT'].includes(tier)) return ladder.unavailable_fallback
  const selectors=['EXACT_CONVERGENCE_VERIFIED','CANDIDATE_DISCOVERED',...PHASES.filter(p=>p!=='COMPLETE').map(p=>`PHASE.${p}`),'ACCESS_EARNED','PHASE.COMPLETE']
  const selector=selectors.find(s=>context[s]===true)
  return ladder.ladders.find(l=>l.selector===selector)?.tiers[tier]??ladder.unavailable_fallback
}
