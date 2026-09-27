// Browser-safe local authority boundary. Integrity alone never grants membership.
// Admission of this reviewed candidate is NOT a MAIN freeze or activation receipt.
export const CORPUS_INTERFACE='TE-IFACE-CORPUS@1.0.0'
export const CORPUS_INTERFACE_IDENTITY='4c9d93c8b9b97503df4580ee72f8d19c7515a9ed29dad54d558cb258bd2c3e60'
const corpora=new WeakMap(),synthetics=new WeakMap()
const fail=n=>{throw Error(n)}
const closed=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===k.length&&Object.keys(x).every(n=>k.includes(n))
const equal=(a,b)=>canonicalJSON(a)===canonicalJSON(b)
const list=(v,nonempty=false)=>Array.isArray(v)&&(!nonempty||v.length>0)&&v.every(s=>typeof s==='string'&&s.trim().length>0)&&new Set(v).size===v.length
export function canonicalJSON(x){
 if(x===null||typeof x!=='object')return JSON.stringify(x)
 if(Array.isArray(x))return '['+x.map(canonicalJSON).join(',')+']'
 return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonicalJSON(x[k])).join(',')+'}'
}
// Snapshot the JSON domain synchronously BEFORE any await: no caller mutation race,
// getters, exotic objects, omitted values, sparse arrays, symbols or cycles.
function snapshot(value){
 const stack=new WeakSet();let nodes=0
 const visit=(x,depth)=>{
  if(++nodes>50000||depth>64)fail('S3_JSON_BOUNDS')
  if(x===null||['string','boolean'].includes(typeof x))return x
  if(typeof x==='number'){if(!Number.isFinite(x))fail('S3_JSON_NUMBER');return x}
  if(typeof x!=='object'||stack.has(x)||Object.getOwnPropertySymbols(x).length)fail('S3_JSON_DOMAIN')
  const array=Array.isArray(x),proto=Object.getPrototypeOf(x)
  if(!array&&proto!==Object.prototype&&proto!==null)fail('S3_JSON_PROTOTYPE')
  const keys=Object.getOwnPropertyNames(x)
  if(array&&(keys.length!==x.length+1||keys.some(k=>k!=='length'&&(!/^(0|[1-9][0-9]*)$/.test(k)||Number(k)>=x.length))))fail('S3_JSON_ARRAY')
  const out=array?[]:Object.create(null);stack.add(x)
  for(const k of keys){if(array&&k==='length')continue;const d=Object.getOwnPropertyDescriptor(x,k);if(!d.enumerable||!Object.hasOwn(d,'value'))fail('S3_JSON_ACCESSOR');Object.defineProperty(out,k,{value:visit(d.value,depth+1),enumerable:true,writable:true,configurable:true})}
  stack.delete(x);return out
 }
 return visit(value,0)
}
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x)}return x}
const digest=async x=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalJSON(x)))),n=>n.toString(16).padStart(2,'0')).join('')
async function seal(x,prefix){const {id,identity,...body}=x,hash=await digest(body);if(identity!==hash||(prefix&&id!==prefix+hash))fail('S3_DISPLAY_IDENTITY')}
const displayKeys=['id','identity','conceptId','role','grade','temporalClass','questionId','question','lens','zeroResultClass','coverage','claimBoundaries','consumerIds','observedResultCount','proofEligible','recursiveFrontierAuthority','runtimeProviderCalls','synthetic']
const roles=['EXACT','CONTEXTUAL','CORROBORATING','BOUNDED_NO_MATCH','CONTROL','CANDIDATE','DEAD_END','PROVENANCE','COVERAGE']
const lenses=['ACTIVITY','RELATIONSHIPS','STATE','RECEIPT']
async function integrity(x,synthetic){
 const c=x?.coverage,strings=['id','identity','conceptId','role','grade','temporalClass','questionId','question','lens']
 if(!closed(x,displayKeys)||strings.some(k=>typeof x[k]!=='string'||!x[k])||!closed(c,['scope','cellIds','key','status','supportsHistoricalNegative']))fail('S3_DISPLAY_SCHEMA')
 const k=c.key
 if(!list(x.claimBoundaries,true)||!x.claimBoundaries.includes('NO_CONTEXTUAL_TO_EXACT_PROMOTION')||!list(x.consumerIds,true)||!list(c.cellIds,!synthetic)||typeof c.scope!=='string'||!c.scope.trim()||(!synthetic&&k===null)||(k!==null&&(!closed(k,['subjectId','timeWindowId','lens','partitionId'])||Object.values(k).some(v=>typeof v!=='string'||!v.trim())||!lenses.includes(k.lens)||k.lens!==x.lens))||c.status!=='PARTIAL_ACCEPTED_RETRIEVED_SCOPE'||c.supportsHistoricalNegative!==false)fail('S3_DISPLAY_COVERAGE')
 if(!roles.includes(x.role)||!['EXACT','CONTEXTUAL','CORROBORATING'].includes(x.grade)||!lenses.includes(x.lens)||x.proofEligible!==false||x.recursiveFrontierAuthority!==false||x.runtimeProviderCalls!==0||x.synthetic!==synthetic||!Number.isSafeInteger(x.observedResultCount)||x.observedResultCount<0)fail('S3_DISPLAY_AUTHORITY')
 if(!synthetic&&(x.grade!=='CONTEXTUAL'||!['CONTEXTUAL','BOUNDED_NO_MATCH'].includes(x.role)||!['NANSEN_SERVER_FILTERED_UNZONED_BLOCK_TIME_CONTEXTUAL','SERVER_FILTERED_UNZONED_CONTEXTUAL','BOUNDED_RELATIONSHIP_AGGREGATE_CONTEXTUAL','BOUNDED_QUERY_AGGREGATE_CONTEXTUAL'].includes(x.temporalClass)||!x.claimBoundaries.includes('NO_ACCOUNT_QUOTA_OR_CPP_IN_GAME_CORPUS')||!/^CONCEPT\.[a-f0-9]{64}$/.test(x.conceptId)))fail('S3_DISPLAY_PROMOTION')
 if(synthetic&&(x.temporalClass!=='SYNTHETIC_NONHISTORICAL'||x.grade!==(x.role==='EXACT'?'EXACT':x.role==='CORROBORATING'?'CORROBORATING':'CONTEXTUAL')||!x.claimBoundaries.includes('SYNTHETIC_NOT_CANONICAL_TRUTH')||!/^SYNTHETIC\.CONCEPT\.[0-9]+$/.test(x.conceptId)))fail('S3_DISPLAY_PROMOTION')
 if((x.zeroResultClass!==null&&x.zeroResultClass!=='NO_MATCH_IN_ACCEPTED_CORPUS')||(x.observedResultCount===0)!==(x.zeroResultClass==='NO_MATCH_IN_ACCEPTED_CORPUS')||(x.role==='BOUNDED_NO_MATCH')!==(x.zeroResultClass==='NO_MATCH_IN_ACCEPTED_CORPUS'))fail('S3_DISPLAY_ZERO')
 await seal(x,'SEMANTIC.')
}
const candidateKeys=['schemaVersion','interface','status','parentRCIdentity','inputIdentity','acceptedIndexIdentity','conceptCount','curatedAcceptedCalls','concepts','displayRecords','auditReferences','displaySurfaces','exactTruthSeparation','compatibility','interfaceFrozen','LaneCActive','gameplayIntegrated','newRequests','runtimeProviderCalls','identity']
export async function admitFrozenCorpusCandidate(value){
 const x=snapshot(value)
 if(!closed(x,candidateKeys)||x.schemaVersion!=='1.0.0'||x.interface!==CORPUS_INTERFACE||x.status!=='READY_FOR_MAIN_FREEZE'||x.identity!==CORPUS_INTERFACE_IDENTITY)fail('S3_CANDIDATE_SCHEMA_OR_PIN')
 if(x.interfaceFrozen!==false||x.LaneCActive!==false||x.gameplayIntegrated!==false||x.newRequests!==0||x.runtimeProviderCalls!==0||x.conceptCount!==25||x.curatedAcceptedCalls!==25)fail('S3_CANDIDATE_AUTHORITY')
 for(const k of ['concepts','displayRecords','auditReferences'])if(!Array.isArray(x[k])||x[k].length!==25)fail('S3_CANDIDATE_COUNTS')
 const {identity,...body}=x
 if(await digest(body)!==identity)fail('S3_CANDIDATE_PINNED_IDENTITY')
 if(!equal(x.displaySurfaces,['CASE','RESULTS','EXPLORE'])||!equal(x.exactTruthSeparation,{unchanged:true,truthFiles:'ACCEPTED_EULER_FILES_UNMODIFIED',firstExactFalsifier:'EXACT_CONVERGENCE',firstExactFalsifierUtc:'2023-03-13T11:38:11Z',contextualConceptsMayFillProofSlots:false}))fail('S3_CANDIDATE_TRUTH')
 const concepts=new Map(),records=new Map(),audit=new Map()
 for(const c of x.concepts){if(concepts.has(c.id)||c.evidenceGrade!=='CONTEXTUAL'||c.exactTruthAuthority!==false||c.recursiveFrontierAuthority!==false||c.runtimeProviderCalls!==0||c.gameplayIntegrated!==false||c.coverage.supportsHistoricalNegative!==false)fail('S3_CONCEPT_AUTHORITY_OR_DUPLICATE');await seal(c,'CONCEPT.');concepts.set(c.id,c)}
 for(const a of x.auditReferences){const c=concepts.get(a.conceptId);if(!closed(a,['conceptId','identity','provenance','publicPrivateDispositions','allowedSurfaces','classification'])||!c||audit.has(a.conceptId)||a.identity!==c.identity||!equal(a.provenance,c.provenance)||!equal(a.publicPrivateDispositions,c.publicPrivateDispositions)||!equal(a.allowedSurfaces,['SOURCE','LEDGER'])||a.classification!=='PUBLIC_REDACTED_REFERENCE_ONLY_PRIVATE_BODY_NOT_IMPORTED')fail('S3_AUDIT_MAPPING');audit.set(a.conceptId,a)}
 const mapped=new Set()
 for(const d of x.displayRecords){
  await integrity(d,false);const c=concepts.get(d.conceptId)
  if(!c||records.has(d.id)||mapped.has(d.conceptId)||!audit.has(d.conceptId)||d.grade!==c.evidenceGrade||d.temporalClass!==c.temporalClass||d.questionId!==c.question.id||d.question!==c.question.question||d.lens!==c.question.lens||d.role!==(c.zeroResultClass?'BOUNDED_NO_MATCH':'CONTEXTUAL')||d.zeroResultClass!==c.zeroResultClass||!equal(d.consumerIds,c.namedConsumers)||!equal(d.claimBoundaries,c.claimBoundaries)||!equal(d.coverage.cellIds,c.coverage.cellIds)||d.coverage.scope!==c.coverage.scope||d.observedResultCount!==c.observedResultCount||!equal(d.coverage.key,{subjectId:c.coverage.key.subject_id,timeWindowId:c.coverage.key.time_window_id,lens:c.coverage.key.question_lens,partitionId:c.coverage.key.page_or_partition_id}))fail('S3_DISPLAY_CONCEPT_MAPPING')
  records.set(d.id,d);mapped.add(d.conceptId)
 }
 if(mapped.size!==25||audit.size!==25||x.displayRecords.filter(d=>d.zeroResultClass==='NO_MATCH_IN_ACCEPTED_CORPUS').length!==7)fail('S3_CANDIDATE_MAPPING_COUNTS')
 freeze(x)
 const token=Object.freeze({kind:'PINNED_REVIEWED_CANDIDATE_NOT_MAIN_FROZEN',interface:CORPUS_INTERFACE,identity:CORPUS_INTERFACE_IDENTITY})
 corpora.set(token,records);return token
}
function getCorpus(token){const data=token&&corpora.get(token);if(!data)fail('S3_CORPUS_NOT_ADMITTED');return data}
export async function validateDisplayRecord(value,corpus){
 const x=snapshot(value);await integrity(x,false)
 const records=getCorpus(corpus),member=records.get(x.id)
 if(!member||!equal(x,member))fail('S3_NONCANONICAL_DISPLAY_MEMBER')
 return member
}
function select(records,ids){
 if(ids!==undefined&&(!list(ids)||ids.some(id=>!records.has(id))))fail('S3_SUBSET_UNACCEPTED_OR_DUPLICATE_ID')
 return Object.freeze((ids===undefined?[...records.values()]:ids.map(id=>records.get(id))).sort((a,b)=>a.id.localeCompare(b.id)))
}
function modeCheck(mode){if(!['FULLSCREEN_CRT','DOCKED_OVERLAY','PLAIN_LIST'].includes(mode))fail('S3_DISPLAY_MODE')}
export async function displayForMode(corpus,mode,acceptedDisplayIds){modeCheck(mode);return select(getCorpus(corpus),acceptedDisplayIds)}
export async function admitSyntheticCorpusFixture(value){
 const x=snapshot(value)
 if(!closed(x,['schemaVersion','interface','interfaceIdentity','status','records','proofEligible','runtimeProviderCalls','identity'])||x.schemaVersion!=='1.0.0'||x.interface!==CORPUS_INTERFACE||x.interfaceIdentity!==CORPUS_INTERFACE_IDENTITY||x.status!=='SYNTHETIC_TEST_NOT_GAMEPLAY'||x.proofEligible!==false||x.runtimeProviderCalls!==0||!Array.isArray(x.records)||x.records.length!==9)fail('S3_SYNTHETIC_FIXTURE_SCHEMA')
 await seal(x)
 const records=new Map(),concepts=new Set(),seenRoles=new Set()
 for(const r of x.records){await integrity(r,true);if(records.has(r.id)||concepts.has(r.conceptId)||seenRoles.has(r.role))fail('S3_SYNTHETIC_DUPLICATE');records.set(r.id,r);concepts.add(r.conceptId);seenRoles.add(r.role)}
 if(seenRoles.size!==roles.length)fail('S3_SYNTHETIC_ROLES')
 freeze(x);const token=Object.freeze({kind:'NONCANONICAL_NONHISTORICAL_NONPROOF_SYNTHETIC_ONLY'});synthetics.set(token,records);return token
}
export async function syntheticDisplayForMode(token,mode,ids){
 modeCheck(mode);const records=token&&synthetics.get(token);if(!records)fail('S3_SYNTHETIC_NOT_ADMITTED');return select(records,ids)
}
