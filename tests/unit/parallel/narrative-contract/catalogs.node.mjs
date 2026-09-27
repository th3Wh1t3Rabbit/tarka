import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {TOKENS,PHASES,EXACT_COPY_BINDINGS,renderEntry,validBinding,tokenNames,contextFromState,selectHint,selectZeroEntry,validateSchema,schemas} from '../../../../content/parallel/narrative/catalog-contract.mjs'
import {loadCatalogs,validateCatalogs,validateFiles,parseUniqueJSON,contentDigest,requiredSurfaces,forbiddenClaim} from '../../../../content/parallel/narrative/validate-catalogs.mjs'
import {packagePolicyNegativeTests,assertPackageMembers} from '../../../../docs/parallel/lane-a/package-policy.mjs'

const catalogs=loadCatalogs()
const entries=catalogs['COPY_CATALOG.json'].entries
const lookup=key=>entries.find(e=>e.key===key)
const clone=()=>structuredClone(catalogs)
const binding=value=>({value,accepted:true,publicSafe:true,discovered:true,sourceRef:'TEST.ACCEPTED_PUBLIC_BINDING',grade:'EXACT',exactTimeAccepted:true})
const sample=Object.fromEntries(Object.entries(TOKENS).map(([name,spec])=>[name,binding(spec.type==='count'?0:spec.type==='public_call_id'?'NQ5-000001':spec.values[0])]))
const allowedContext=entry=>Object.fromEntries(entry.requires.map(g=>[g,true]))
const failIncludes=(changed,pattern)=>assert.ok(validateCatalogs(changed).some(e=>pattern.test(e)),`Expected ${pattern}`)

test('direct file, schema, frozen interface, path and independent coverage checks pass',()=>{
  const report=validateFiles();assert.equal(report.status,'PASS');assert.equal(report.errors.length,0)
  assert.equal(report.entries,409);assert.equal(report.coverage_surfaces,425)
  assert.ok(requiredSurfaces().length>=400)
  const privacy=packagePolicyNegativeTests();assert.equal(privacy.status,'PASS');assert.equal(privacy.negative_checks,privacy.rejected);assert.ok(privacy.rejected>=35)
  assertPackageMembers([['handoff/EXECUTION_LOG.json','{"cwd_role":"LANE_REPO","exit":0,"summary":"PASS"}']])
})
test('JSON rejects duplicate members including escape-equivalent names and nested arrays',()=>{
  for(const text of ['{"a":1,"a":2}','{"a":1,"\\u0061":2}','[{"k":1,"k":0}]'])assert.throws(()=>parseUniqueJSON(text),/Duplicate/)
  assert.deepEqual(parseUniqueJSON('{"a":"{not a member}","b":[{},true,null,1.2e2]}'),{a:'{not a member}',b:[{},true,null,120]})
})
test('closed schema rejects unknown runtime effects, type confusion and empty keys',()=>{
  const value=structuredClone(catalogs['COPY_CATALOG.json'])
  value.entries[0].runtime_effect='CHANGE_PROGRESSION'
  assert.ok(validateSchema(value,schemas['COPY_CATALOG.json']).some(e=>e.includes('unknown')))
  value.entries[0].requires='ACCESS_EARNED';value.entries[0].key=''
  assert.ok(validateSchema(value,schemas['COPY_CATALOG.json']).length>=3)
})
test('duplicate catalog key fails',()=>{
  const value=clone();value['COPY_CATALOG.json'].entries[1].key=value['COPY_CATALOG.json'].entries[0].key
  failIncludes(value,/Duplicate key/)
})
test('deleting both a required line and its report mapping cannot fake coverage',()=>{
  const value=clone();const key='lane_a.ledger.reuse'
  value['COPY_CATALOG.json'].entries=value['COPY_CATALOG.json'].entries.filter(e=>e.key!==key)
  value['COPY_COVERAGE_REPORT.json'].mappings=value['COPY_COVERAGE_REPORT.json'].mappings.filter(r=>!r.copy_keys.includes(key))
  failIncludes(value,/Missing coverage ledger\.reuse/)
})
test('dangling references and stale coverage/audit digest fail',()=>{
  const value=clone();value['HINT_LADDER.json'].unavailable_fallback='lane_a.no_such_key'
  value['COPY_CATALOG.json'].entries[0].text+=' Changed.'
  failIncludes(value,/Dangling/);failIncludes(value,/Stale content digest/)
})
test('beat order, cue ID and speaker aliases cannot drift',()=>{
  const value=clone();value['DIALOGUE_BEAT_CATALOG.json'].beats.reverse()
  failIncludes(value,/Beat order/)
  const other=clone();other['DIALOGUE_BEAT_CATALOG.json'].beats[0].cue_id='new.cue'
  failIncludes(other,/Beat mapping/)
})
test('runtime aliases stay unchanged and public display remains Arthur',()=>{
  const alias=catalogs['ARTHUR_RUNTIME_ALIAS_MAP.json']
  assert.equal(alias.public_name,'Arthur');assert.equal(alias.legacy.speaker,'MR_INDEX')
  assert.equal(alias.legacy.hotspot,'mr-index');assert.equal(alias.legacy.art_manifest_key,'mrIndex')
  const value=clone();value['ARTHUR_RUNTIME_ALIAS_MAP.json'].legacy.speaker='ARTHUR'
  assert.ok(validateCatalogs(value).some(e=>e.includes('const mismatch')))
  for(const e of entries)assert.doesNotMatch(e.text,/Mr\. Index|MR_INDEX|mrIndex|mr-index/)
})
test('exact, derived-state and scoped-negative gates cannot be removed',()=>{
  const exact=clone();exact['COPY_CATALOG.json'].entries.find(e=>e.key==='lane_a.proof.link').requires=[]
  failIncludes(exact,/Exact evidence gate/)
  const state=clone();state['COPY_CATALOG.json'].entries.find(e=>e.key==='lane_a.proof.link').evidence_ids=['STATE_EARLY_ENGINE']
  failIncludes(state,/Derived state promoted/)
  const negative=clone();negative['COPY_CATALOG.json'].entries.find(e=>e.claim_class==='SCOPED_NEGATIVE').requires=['RESULT_CLASSIFIED']
  failIncludes(negative,/Negative scope gate/)
})
test('strong obvious overreach is rejected; nonclaim boundaries remain allowed',()=>{
  for(const claim of ['This proves human identity.','The same person controls both addresses.','No transactions anywhere.','P2 results are accepted.','Enter your API key.'])assert.equal(forbiddenClaim(claim),true)
  assert.equal(forbiddenClaim('Human identity is outside this claim boundary.'),false)
  const value=clone();value['COPY_CATALOG.json'].entries[0].text='This proves human identity.'
  failIncludes(value,/Forbidden claim/)
})
test('unknown, malformed or hidden fallback tokens are rejected',()=>{
  assert.throws(()=>tokenNames('A {result_count} token'),/Malformed/)
  assert.throws(()=>tokenNames('A {{RESULT_COUNT}} token'),/Malformed/)
  const value=clone();value['COPY_CATALOG.json'].entries[0].text='A {PRIVATE_NAME}.';value['COPY_CATALOG.json'].entries[0].tokens=['PRIVATE_NAME']
  assert.ok(validateCatalogs(value).length>0)
  const hidden=clone();hidden['COPY_CATALOG.json'].entries[0].fallback='Still {RESULT_COUNT}.'
  failIncludes(hidden,/Unresolved fallback/)
})
test('all templates render valid typed bindings, including zero',()=>{
  for(const key of catalogs['DATA_DEPENDENT_COPY_TEMPLATES.json'].template_keys) {
    const e=lookup(key);const output=renderEntry(e,sample,allowedContext(e))
    assert.equal(output.usedFallback,false,key);assert.doesNotMatch(output.text,/[{}]/)
  }
  assert.match(renderEntry(lookup('lane_a.template.results'),sample,allowedContext(lookup('lane_a.template.results'))).text,/^0 matching records/)
})
test('missing and unaccepted binding combinations select the whole truthful fallback',()=>{
  for(const e of entries.filter(e=>e.tokens.length))for(const token of e.tokens) {
    for(const bad of [undefined,null,{...sample[token],accepted:false},{...sample[token],publicSafe:false},{...sample[token],discovered:false},{...sample[token],sourceRef:''}]) {
      const values={...sample,[token]:bad};const output=renderEntry(e,values,allowedContext(e))
      assert.equal(output.text,e.fallback);assert.equal(output.usedFallback,true)
      assert.doesNotMatch(output.text,/[{}]/)
    }
  }
})
test('typed tokens reject negative/NaN/fraction/string/null counts and raw unsafe strings',()=>{
  for(const value of [-1,NaN,Infinity,0.5,'0',null,Number.MAX_SAFE_INTEGER+1])assert.equal(validBinding('RESULT_COUNT',binding(value)),false)
  for(const name of ['SUBJECT_ROLE','FILTER_EFFECT','COVERAGE_SCOPE','CANDIDATE_ROLE'])assert.equal(validBinding(name,binding('<script>raw label or all chain history</script>')),false)
  assert.equal(validBinding('PUBLIC_CALL_ID',binding('local-support-1')),false)
  assert.equal(validBinding('NOT_ALLOWED',binding('x')),false)
})
test('contextual secondary time cannot become exact even with a false exact assertion',()=>{
  assert.equal(validBinding('EXACT_TIME_IF_ACCEPTED',binding('2023-03-13T10:33:35Z')),false)
  const exact=binding('2023-03-13T11:38:11Z')
  assert.equal(validBinding('EXACT_TIME_IF_ACCEPTED',exact),true)
  assert.equal(validBinding('EXACT_TIME_IF_ACCEPTED',{...exact,grade:'CONTEXTUAL'}),false)
  assert.equal(validBinding('EXACT_TIME_IF_ACCEPTED',{...exact,exactTimeAccepted:false}),false)
})
test('every guarded line has a safe nonspoiler fallback when prerequisites are absent',()=>{
  for(const e of entries.filter(e=>e.requires.length)) {
    const output=renderEntry(e,sample,{})
    assert.equal(output.text,e.fallback);assert.equal(output.reason,'PREREQUISITE_NOT_MET')
    assert.doesNotMatch(output.text,/8,877|8\.88M|11:38:11|THE FIRST TRAIL JOINED|2023-03-13T/)
  }
})
function fixtureAndState() {
  const fixture={id:'EULER_2023_FALSE_EXIT',mode:'ACCEPTED_FROZEN',cutoffUtc:'2023-03-13T12:15:00Z',records:Object.entries(EXACT_COPY_BINDINGS).map(([id,b])=>({...structuredClone(b),id,grade:'EXACT',exactRelationship:true,derivedFrom:[],provenance:{rawSha256:b.rawSha256}})),coverage:[{id:'partial',status:'PARTIAL',supportsNegative:false}]}
  const state={fixtureId:fixture.id,access:true,discoveredRecords:['EXACT_EARLY_NET'],selectedRecordId:null,comparison:[],exactEventIds:[],assembly:{},complete:false,result:null}
  return {fixture,state}
}
test('state adapter refuses undiscovered records, synthetic history and premature filed slots',()=>{
  const {fixture,state}=fixtureAndState();let context=contextFromState(fixture,state)
  assert.equal(context.EXACT_MAIN_DISCOVERED,false);assert.equal(context.EXACT_CONVERGENCE_VERIFIED,false)
  assert.equal(context['SLOT.AMOUNT_FILED'],false);assert.equal(context.CASE_COMPLETE,false)
  state.complete=true;assert.equal(contextFromState(fixture,state).CASE_COMPLETE,false)
  state.discoveredRecords=fixture.records.map(r=>r.id);state.exactEventIds=['EXACT.EXACT_CONVERGENCE']
  state.assembly={AMOUNT:'EXACT_EARLY_NET',RECEIVER:'EXACT_MAIN_RECEIVER',LINK:'EXACT_CONVERGENCE'}
  context=contextFromState(fixture,state);assert.equal(context.CASE_COMPLETE,false,'No production verifier supplied')
  // Injection wiring only; real production predicates are exercised in Vitest.
  context=contextFromState(fixture,state,null,{exactPredicate:()=>true});assert.equal(context.CASE_COMPLETE,true)
  fixture.mode='SYNTHETIC_TEST';assert.equal(contextFromState(fixture,state).EXACT_CONVERGENCE_VERIFIED,false)
})
test('proof filing text requires its actual filed slot, not just discovered evidence',()=>{
  const {fixture,state}=fixtureAndState();state.discoveredRecords=fixture.records.map(r=>r.id);state.exactEventIds=['EXACT.EXACT_CONVERGENCE']
  assert.equal(renderEntry(lookup('lane_a.proof.amount.filed'),{},contextFromState(fixture,state)).usedFallback,true)
  state.assembly.AMOUNT='EXACT_EARLY_NET'
  assert.equal(renderEntry(lookup('lane_a.proof.amount.filed'),{},contextFromState(fixture,state,null,{exactPredicate:()=>true})).usedFallback,false)
})
test('partial frozen coverage cannot produce scoped negative copy',()=>{
  const {fixture,state}=fixtureAndState();state.result={zeroClass:'NEGATIVE_EVIDENCE_SUPPORTED',recordIds:[],coverageIds:['partial'],query:{lens:'ACTIVITY',filters:[{field:'FROM',value:'2023-03-13T11:40:00Z'},{field:'TO',value:'2023-03-13T12:15:00Z'}]}}
  const dead=catalogs['DEAD_END_RESPONSE_CATALOG.json']
  assert.equal(selectZeroEntry(dead,state.result,contextFromState(fixture,state)),null)
  fixture.coverage[0].status='COMPLETE';fixture.coverage[0].supportsNegative=true
  assert.equal(selectZeroEntry(dead,state.result,contextFromState(fixture,state)),null,'No production replay supplied')
  assert.equal(selectZeroEntry(dead,state.result,contextFromState(fixture,state,null,{dispatchQuery:()=>state.result})),'lane_a.zero.negative_evidence_supported')
  state.result.zeroClass='NO_MATCH_IN_ACCEPTED_CORPUS'
  assert.equal(selectZeroEntry(dead,state.result,contextFromState(fixture,state)),'lane_a.zero.no_match_in_accepted_corpus')
})
test('all hint tiers select the existing phase and do not leak undiscovered exact values',()=>{
  const hint=catalogs['HINT_LADDER.json']
  for(const phase of PHASES)for(const tier of ['METHOD_HINT','CASE_HINT','DIRECT_HINT']) {
    const context=contextFromState(null,null,phase);const key=selectHint(hint,tier,context)
    assert.ok(key.includes(`puzzle.${phase.toLowerCase()}`),key)
    assert.doesNotMatch(renderEntry(lookup(key),{},context).text,/0x[a-f\d]{8}|\d{2}:\d{2}|Receiving Vault|8,877|THE FIRST TRAIL JOINED/i)
  }
  assert.equal(selectHint(hint,'BAD',{}),hint.unavailable_fallback)
  assert.equal(selectHint(hint,'DIRECT_HINT',{}),hint.unavailable_fallback)
})
test('optional layer can be removed without loss of the independently required core coverage',()=>{
  const optional=new Set(entries.filter(e=>e.optional).map(e=>e.key))
  const report=catalogs['COPY_COVERAGE_REPORT.json']
  for(const surface of requiredSurfaces().filter(s=>!s.startsWith('banter.')&&!s.startsWith('reaction.')&&!['topic.noise.lines','topic.charge.lines'].includes(s))) {
    const row=report.mappings.find(r=>r.surface===surface)
    assert.ok(row.copy_keys.some(k=>!optional.has(k)),surface)
  }
  assert.equal(entries.filter(e=>e.line_class==='OPTIONAL_BANTER').length,8)
})
test('final conclusion and decimal precision stay exact and distinct',()=>{
  assert.equal(lookup('lane_a.dead.look.rotunda-exit').text,'The Breach Rotunda exit. This case remains inside the Records Office.')
  assert.equal(lookup('lane_a.dead.alternate.10').text,'That route is outside the current investigation.')
  for(const key of ['lane_a.dead.look.rotunda-exit','lane_a.dead.alternate.10']) {
    const e=lookup(key);assert.equal(e.line_class,'DEAD_END');assert.equal(e.fallback,e.text)
  }
  for(const e of entries)assert.doesNotMatch(e.text,/engine proof/i)
  assert.equal(lookup('lane_a.conclusion.heading').text,'THE FIRST TRAIL JOINED THE SECOND ROUTE.')
  assert.match(lookup('lane_a.proof.first_amount').text,/8,877,507\.3483067 DAI/)
  assert.match(lookup('lane_a.proof.link').text,/8,877,507\.348306697 DAI/)
  assert.notEqual(lookup('lane_a.proof.first_amount').text,lookup('lane_a.proof.link').text)
  const value=clone();value['COPY_CATALOG.json'].entries.find(e=>e.key==='lane_a.conclusion.heading').text='THE CASE IS SOLVED EVERYWHERE.'
  failIncludes(value,/Conclusion drift/)
})
test('all output JSON is unique, schema-valid and audit-bound at the final content digest',()=>{
  for(const [name,value] of Object.entries(catalogs))assert.deepEqual(validateSchema(value,schemas[name]),[],name)
  const digest=contentDigest(entries)
  assert.equal(catalogs['COPY_COVERAGE_REPORT.json'].content_sha256,digest)
  assert.equal(catalogs['CLAIM_BOUNDARY_COPY_AUDIT.json'].content_sha256,digest)
  assert.ok(readFileSync('docs/parallel/lane-a/NARRATIVE_AND_MISSION_CONTENT_BIBLE.md','utf8').includes('MAIN retains integration'))
})
test('selector completeness and surface linkage reject emptied or misdirected catalogs',()=>{
  for(const field of ['alternates','overrides','archetypes']) {
    const value=clone();value['DEAD_END_RESPONSE_CATALOG.json'][field]=[]
    failIncludes(value,/Dead-end selector coverage drift/)
  }
  const empty=clone();empty['HINT_LADDER.json'].ladders=[];failIncludes(empty,/Hint selector coverage drift/)
  const wrong=clone();wrong['HINT_LADDER.json'].ladders[0].tiers.DIRECT_HINT='lane_a.conclusion.heading';failIncludes(wrong,/Selector linkage drift/)
  const beat=clone();beat['DIALOGUE_BEAT_CATALOG.json'].beats[0].copy_key='lane_a.banter.mr_a.arthur';failIncludes(beat,/Selector linkage drift/)
  const opening=clone();opening['DIALOGUE_BEAT_CATALOG.json'].opening_keys=Array(8).fill('lane_a.banter.mr_a.arthur');failIncludes(opening,/Opening coverage mismatch/)
})
test('wrong exact prerequisite cannot pass even with a refreshed matching audit',()=>{
  const value=clone(),entry=value['COPY_CATALOG.json'].entries.find(e=>e.key==='lane_a.proof.link')
  entry.requires=['EXACT_EARLY_DISCOVERED']
  value['CLAIM_BOUNDARY_COPY_AUDIT.json'].entries.find(e=>e.copy_key===entry.key).requires=[...entry.requires]
  for(const name of ['CLAIM_BOUNDARY_COPY_AUDIT.json','COPY_COVERAGE_REPORT.json'])value[name].content_sha256=contentDigest(value['COPY_CATALOG.json'].entries)
  failIncludes(value,/Exact prerequisite linkage drift/)
})
