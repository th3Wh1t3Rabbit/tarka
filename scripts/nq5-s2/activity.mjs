import {createHash} from 'node:crypto'
import {privatePathFindings} from '../nq5-s1/privacy.mjs'
import {hasSecretLikeValue} from '../secret-patterns.mjs'
export const canonical=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?'['+x.map(canonical).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}'
export const sha=x=>createHash('sha256').update(x).digest('hex')
export const identity=x=>sha(canonical(x))
export const PROJECTS=['CPP','TRACE_ESCAPE','OTHER_ACCOUNT_ACTIVITY','MIXED_ACCOUNT_ACTIVITY']
export const CLASSES=['VERIFIED_PORTAL_EXPORT','VERIFIED_PROVIDER_ACTIVITY','PRINCIPAL_TRANSCRIBED','PROJECT_LEDGER_SUMMARY','ESTIMATED','UNRESOLVED']
export const WINDOW={from:'2026-09-14T00:00:00Z',through:'2026-09-27T23:59:00Z',boundary:'CONSERVATIVE_SOURCE_SNAPSHOT_UTC_INCLUSIVE_NO_END_OF_DAY_EXTENSION'}
const token=v=>typeof v==='string'&&/^[A-Za-z0-9_.-]{1,120}$/.test(v)&&!/^0x[a-f0-9]{40,}$/i.test(v)
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).every(k=>keys.includes(k))
export function privacyBoundary(x){const text=typeof x==='string'?x:canonical(x);if(privatePathFindings(text).length||hasSecretLikeValue(text)||/(?:\b(?:account_id|account_identity|email|authorization|raw_body|response_body|payload|api_key|credential_value)\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/i.test(text))throw Error('S2_ACCOUNT_INPUT_PRIVACY')}
/** Small RFC-style CSV reader: quoted newlines, doubled quotes, CRLF; no coercion. */
export function parseCSV(text,metadata){
 privacyBoundary(text);const records=[];let row=[],field='',quoted=false,closed=false
 for(let i=0;i<=text.length;i++){const c=text[i];if(quoted){if(c===undefined)throw Error('CSV_UNCLOSED_QUOTE');if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"'){quoted=false;closed=true}else field+=c;continue}
  if(c==='"'){if(field||closed)throw Error('CSV_QUOTE_POSITION');quoted=true;continue}
  if(c===','||c==='\n'||c==='\r'||c===undefined){row.push(field);field='';closed=false;if(c!==','){if(row.some(v=>v!==''))records.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++}continue}
  if(closed)throw Error('CSV_AFTER_QUOTE');field+=c
 }
 const headers=records.shift();if(!headers||new Set(headers).size!==headers.length)throw Error('CSV_HEADERS')
 const rows=records.map(r=>{if(r.length!==headers.length)throw Error('CSV_WIDTH');const o=Object.fromEntries(headers.map((h,i)=>[h,r[i]]));for(const k of ['source_row','displayed_credits','http_status'])if(k in o){if(k==='displayed_credits'&&['','null','UNKNOWN'].includes(o[k])){o[k]=null;continue}if(!/^\d+$/.test(o[k]))throw Error('CSV_INTEGER');o[k]=Number(o[k])}if(o.explicit_overlap_group==='')o.explicit_overlap_group=null;return o})
 return {...metadata,rows}
}
const rowKeys=['observed_at_utc','endpoint','displayed_credits','status','source_fragment','source_row','source_row_id','explicit_overlap_group','project_class','http_status']
function importRequestRows(input,{verificationBindings=[],separateProjectCountingResolved=false,estimatedProjections=null}={}){
 if(typeof separateProjectCountingResolved!=='boolean'||!Array.isArray(verificationBindings))throw Error('S2_PROOF_OPTIONS_SHAPE')
 privacyBoundary(input)
 const sources=Array.isArray(input)?input:[input],quarantined=[],all=[],bindings=[]
 if(!sources.length)throw Error('S2_NO_SOURCES')
 for(const s of sources){
  if(!exact(s,['schema_version','source_id','source_class','project_class','timezone_note','rows_received','rows','deduplication','derived_summary','final_quota_proof_eligible','limitations'])||!token(s.source_id)||!CLASSES.includes(s.source_class)||!PROJECTS.includes(s.project_class)||!Array.isArray(s.rows))throw Error('S2_SOURCE_SHAPE')
  const integer=n=>Number.isSafeInteger(n)&&n>=0,summaryKeys=['unique_successful_requests','displayed_credit_total','polling_cycles','average_requests_per_cycle','five_minute_continuous_projection_requests_per_day','five_minute_continuous_projection_credits_per_day','principal_conservative_planning_floor_requests_per_day','full_window_projection_at_conservative_floor','endpoint_counts']
  if(('schema_version'in s&&s.schema_version!=='1.0.0')||('timezone_note'in s&&typeof s.timezone_note!=='string')||('rows_received'in s&&!integer(s.rows_received))||('final_quota_proof_eligible'in s&&typeof s.final_quota_proof_eligible!=='boolean')||('limitations'in s&&(!Array.isArray(s.limitations)||s.limitations.some(x=>typeof x!=='string')))||('deduplication'in s&&(!exact(s.deduplication,['method','duplicate_rows_removed'])||('method'in s.deduplication&&typeof s.deduplication.method!=='string')||('duplicate_rows_removed'in s.deduplication&&!integer(s.deduplication.duplicate_rows_removed))))||('derived_summary'in s&&(!exact(s.derived_summary,summaryKeys)||Object.entries(s.derived_summary).some(([k,v])=>k==='endpoint_counts'?(!v||typeof v!=='object'||Array.isArray(v)||Object.entries(v).some(([endpoint,n])=>!/^\/api\/v[1-9]\d*\/[a-z0-9/-]+$/.test(endpoint)||!integer(n))):!integer(v)))))throw Error('S2_SOURCE_CONTEXT_SHAPE')
  // Sample narrative/derived summaries are source context only, never proof or output.
  const sourceHash=identity(s),verified=['VERIFIED_PORTAL_EXPORT','VERIFIED_PROVIDER_ACTIVITY'].includes(s.source_class)&&verificationBindings.some(b=>b.sourceIdentity===sourceHash&&b.independentlyVerified===true&&/^[a-f0-9]{64}$/.test(b.reviewIdentity||''))
  bindings.push({sourceId:s.source_id,sourceClass:s.source_class,projectClass:s.project_class,sourceIdentity:sourceHash,verified,receivedRows:s.rows.length})
  s.rows.forEach((r,index)=>{
   const ref={sourceId:s.source_id,inputOrdinal:index+1,rowIdentity:identity(r)},bad=reason=>quarantined.push({...ref,reason})
   if(!exact(r,rowKeys)||!token(r.source_fragment)||!Number.isSafeInteger(r.source_row)||r.source_row<1||('source_row_id'in r&&!token(r.source_row_id))||(r.displayed_credits!==null&&(!Number.isSafeInteger(r.displayed_credits)||r.displayed_credits<0))||!['SUCCESS','FAILURE','UNRESOLVED'].includes(r.status)||!/^\/api\/v[1-9]\d*\/[a-z0-9/-]+$/.test(r.endpoint||'')||r.endpoint.includes('//')||('project_class'in r&&!PROJECTS.includes(r.project_class))||(r.explicit_overlap_group!=null&&!token(r.explicit_overlap_group)))return bad('MALFORMED_OR_AMBIGUOUS_ROW')
   if('http_status'in r&&(!Number.isInteger(r.http_status)||r.http_status<100||r.http_status>599||(r.status==='SUCCESS'&&(r.http_status<200||r.http_status>299))||(r.status==='FAILURE'&&r.http_status>=200&&r.http_status<300)))return bad('STATUS_CONTRADICTION')
   if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(r.observed_at_utc||'')||!Number.isFinite(Date.parse(r.observed_at_utc))||new Date(r.observed_at_utc).toISOString().replace('.000Z','Z')!==r.observed_at_utc.replace('.000Z','Z'))return bad('AMBIGUOUS_OR_INVALID_UTC_TIMESTAMP')
   if(Date.parse(r.observed_at_utc)<Date.parse(WINDOW.from)||Date.parse(r.observed_at_utc)>Date.parse(WINDOW.through))return bad('OUTSIDE_ELIGIBILITY_WINDOW')
   if(r.status==='UNRESOLVED')return bad('UNRESOLVED_REQUEST_STATUS')
   const project=r.project_class||s.project_class
   all.push({...ref,stableId:s.source_id+':'+(r.source_row_id||r.source_fragment+':'+r.source_row),overlap:r.explicit_overlap_group||null,observed:r.observed_at_utc,endpoint:r.endpoint,credits:r.displayed_credits,status:r.status,project,sourceClass:s.source_class,verified})
  })
 }
 const semantic=r=>canonical([r.observed,r.endpoint,r.credits,r.status,r.project])
 // Identity graph closes transitive stable-row / explicit-overlap equivalence.
 // Timestamp/endpoint never create an edge; same-time requests stay independent.
 const parents=new Map(),find=k=>{if(!parents.has(k))parents.set(k,k);let p=k;while(parents.get(p)!==p)p=parents.get(p);return p},join=(a,b)=>{const x=find(a),y=find(b);if(x!==y)parents.set(x<y?y:x,x<y?x:y)}
 for(const r of all){find('STABLE:'+r.stableId);if(r.overlap)join('STABLE:'+r.stableId,'OVERLAP:'+r.overlap)}
 const groups=new Map();for(const r of all){const key=find('STABLE:'+r.stableId);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}
 const rows=[],removed=[]
 for(const[key,g]of [...groups].sort(([a],[b])=>a.localeCompare(b))){if(new Set(g.map(semantic)).size!==1){const trusted=g.filter(r=>r.verified);if(!trusted.length||new Set(trusted.map(semantic)).size!==1){quarantined.push(...g.map(r=>({sourceId:r.sourceId,inputOrdinal:r.inputOrdinal,rowIdentity:r.rowIdentity,reason:'CONFLICTING_STABLE_OR_EXPLICIT_OVERLAP_ID'})));continue}const retained=semantic(trusted[0]),conflicts=g.filter(r=>semantic(r)!==retained);quarantined.push(...conflicts.map(r=>({sourceId:r.sourceId,inputOrdinal:r.inputOrdinal,rowIdentity:r.rowIdentity,reason:'ANCILLARY_CONFLICT_WITH_VERIFIED_PROOF_ROW'})));g.splice(0,g.length,...g.filter(r=>semantic(r)===retained))}
  g.sort((a,b)=>Number(b.verified)-Number(a.verified)||Number(a.sourceClass==='ESTIMATED')-Number(b.sourceClass==='ESTIMATED')||a.stableId.localeCompare(b.stableId)||a.rowIdentity.localeCompare(b.rowIdentity));rows.push(g[0]);for(const r of g.slice(1))removed.push({stableId:r.stableId,reason:g.some(x=>x.overlap)?'EXPLICIT_OVERLAP':'IDENTICAL_STABLE_SOURCE_ROW',retainedStableId:g[0].stableId})
 }
 const admitted=rows.filter(r=>r.sourceClass!=='ESTIMATED'),estimatedRows=rows.filter(r=>r.sourceClass==='ESTIMATED')
 const summary=list=>{const knownCreditTotal=list.filter(r=>r.credits!==null).reduce((n,r)=>n+r.credits,0);if(!Number.isSafeInteger(knownCreditTotal))throw Error('S2_CREDIT_TOTAL_OVERFLOW');return {requests:list.length,successes:list.filter(r=>r.status==='SUCCESS').length,failures:list.filter(r=>r.status==='FAILURE').length,credits:list.some(r=>r.credits===null)?null:knownCreditTotal,knownCreditTotal,knownCreditRows:list.filter(r=>r.credits!==null).length,unknownCreditRows:list.filter(r=>r.credits===null).length}}
 const aggregate=key=>Object.fromEntries([...new Set(admitted.map(key))].sort().map(k=>[k,summary(admitted.filter(r=>key(r)===k))]))
 const verified=admitted.filter(r=>r.verified&&r.status==='SUCCESS'),unverified=admitted.filter(r=>!r.verified)
 const eligible=admitted.length>0&&quarantined.length===0&&unverified.length===0&&admitted.every(r=>r.project==='TRACE_ESCAPE'||separateProjectCountingResolved)&&!admitted.some(r=>['ESTIMATED','UNRESOLVED','PRINCIPAL_TRANSCRIBED','PROJECT_LEDGER_SUMMARY'].includes(r.sourceClass))
 if(estimatedProjections!==null&&(!exact(estimatedProjections,['requestsPerDay','creditsPerDay','days','assumption'])||![estimatedProjections.requestsPerDay,estimatedProjections.creditsPerDay,estimatedProjections.days].every(n=>Number.isFinite(n)&&n>=0)||typeof estimatedProjections.assumption!=='string'))throw Error('S2_ESTIMATE_SHAPE')
 const report={schemaVersion:'1.0.0',kind:'MERIDIAN_ACCOUNT_ACTIVITY_REPORT',eligibilityWindow:WINDOW,officialCallFloor:1000,planningBufferTarget:1024,bufferIsNotCuratedFloor:true,sourceBindings:bindings.sort((a,b)=>a.sourceId.localeCompare(b.sourceId)),observed:summary(admitted),endpointTotals:aggregate(r=>r.endpoint),dailyTotals:aggregate(r=>r.observed.slice(0,10)),projectTotals:aggregate(r=>r.project),sourceClassTotals:aggregate(r=>r.sourceClass),projectClass:new Set(admitted.map(r=>r.project)).size===1?admitted[0]?.project:'MIXED_ACCOUNT_ACTIVITY',removedRows:removed.sort((a,b)=>a.stableId.localeCompare(b.stableId)),quarantined:quarantined.sort((a,b)=>a.sourceId.localeCompare(b.sourceId)||a.rowIdentity.localeCompare(b.rowIdentity)),verifiedSuccessfulLowerBound:verified.length,unverifiedObservedRequests:unverified.length,finalQuotaProofEligible:eligible,quotaMet:eligible&&verified.length>=1000,cppAutomaticallyCounts:false,curatedGameEvidenceRows:0,creditsAreRequests:false,ESTIMATED:estimatedProjections===null&&estimatedRows.length===0?null:{rowBasedEstimates:summary(estimatedRows),...(estimatedProjections===null?{}:{...estimatedProjections,projectedRequests:estimatedProjections.requestsPerDay*estimatedProjections.days,projectedCredits:estimatedProjections.creditsPerDay*estimatedProjections.days}),proofEligible:false},networkRequests:0}
 privacyBoundary(report);return {...report,identity:identity(report)}
}

export const MEASUREMENTS=['PROVIDER_REQUEST_ROW','PROJECT_LOGICAL_OPERATION','AGGREGATE_ONLY']
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const integer=n=>Number.isSafeInteger(n)&&n>=0
const artifact=a=>exact(a,['filename','sha256','bytes'])&&typeof a.filename==='string'&&/^[A-Za-z0-9_.-]{1,240}$/.test(a.filename)&&!/(?:api[_-]?key|credential|secret)/i.test(a.filename)&&hash(a.sha256)&&(a.bytes===null||integer(a.bytes))
const timestamp=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(Date.parse(v)).toISOString().slice(0,19)===v.slice(0,19)
const inWindow=v=>timestamp(v)&&Date.parse(v)>=Date.parse(WINDOW.from)&&Date.parse(v)<=Date.parse(WINDOW.through)
const sourceKeys=['schema_version','source_id','source_class','project_class','measurement_class','source_artifact','review_receipt','upstream_artifact','credit_semantics','planning_commitment','bounded_counts','timezone_note','rows_received','rows','deduplication','derived_summary','final_quota_proof_eligible','limitations']
/** Explicit measurement admission. No row-shaped project ledger can become a request. */
export function importActivity(input,{verificationBindings=[],separateProjectCountingResolved=false,submissionApplicability=null,estimatedProjections=null}={}){
 if(typeof separateProjectCountingResolved!=='boolean'||!Array.isArray(verificationBindings))throw Error('S2_PROOF_OPTIONS_SHAPE')
 privacyBoundary(input);privacyBoundary(verificationBindings);privacyBoundary(submissionApplicability)
 if(submissionApplicability!==null&&(!exact(submissionApplicability,['state','reviewIdentity','independentlyVerified'])||submissionApplicability.state!=='RESOLVED'||!hash(submissionApplicability.reviewIdentity)||submissionApplicability.independentlyVerified!==true))throw Error('S2_SUBMISSION_APPLICABILITY_BINDING')
 const sources=Array.isArray(input)?input:[input],provider=[],proof=[],bindings=[],operations=[],aggregates=[],extraQuarantine=[],operationRemoved=[]
 if(!sources.length)throw Error('S2_NO_SOURCES')
 const operationGroups=new Map()
 for(const s of sources){
  if(!exact(s,sourceKeys)||!token(s.source_id)||!CLASSES.includes(s.source_class)||!PROJECTS.includes(s.project_class)||!MEASUREMENTS.includes(s.measurement_class)||!artifact(s.source_artifact)||!Array.isArray(s.rows)||s.schema_version!=='2.0.0'||!['DISPLAYED_CREDITS','UNKNOWN'].includes(s.credit_semantics))throw Error('S2_SOURCE_SHAPE_MEASUREMENT_REQUIRED')
  if(sources.filter(x=>x.source_id===s.source_id).length!==1)throw Error('S2_DUPLICATE_SOURCE_ID')
  if(s.upstream_artifact!==undefined&&!artifact(s.upstream_artifact))throw Error('S2_UPSTREAM_ARTIFACT_SHAPE')
  if(s.review_receipt!==undefined&&(!exact(s.review_receipt,['identity','disposition'])||!hash(s.review_receipt.identity)||!['VERIFIED','UNVERIFIED'].includes(s.review_receipt.disposition)))throw Error('S2_REVIEW_RECEIPT_SHAPE')
  if(s.limitations!==undefined&&(!Array.isArray(s.limitations)||s.limitations.some(x=>typeof x!=='string')))throw Error('S2_SOURCE_CONTEXT_SHAPE')
  const logicalLimitation=(s.limitations||[]).some(x=>/logical.*(?:not.*HTTP|not.*request)|HTTP.*(?:absent|not retained)/i.test(x))
  if(s.measurement_class==='PROVIDER_REQUEST_ROW'&&(s.source_class==='PROJECT_LEDGER_SUMMARY'||logicalLimitation))throw Error('S2_MEASUREMENT_SOURCE_CONTRADICTION')
  if(s.measurement_class!=='PROVIDER_REQUEST_ROW'&&(s.credit_semantics!=='UNKNOWN'||s.derived_summary!==undefined||s.final_quota_proof_eligible===true))throw Error('S2_MEASUREMENT_CREDIT_OR_PROOF_CONTRADICTION')
  if(s.measurement_class==='PROJECT_LOGICAL_OPERATION'&&s.source_class==='ESTIMATED')throw Error('S2_ESTIMATE_IS_NOT_LOGICAL_OBSERVATION')
  if(s.planning_commitment!==undefined&&(s.measurement_class==='PROVIDER_REQUEST_ROW'||!exact(s.planning_commitment,['completeDaysConservativeCommittedCredits','partialDayConservativeCommittedCredits','metric'])||!integer(s.planning_commitment.completeDaysConservativeCommittedCredits)||!integer(s.planning_commitment.partialDayConservativeCommittedCredits)||s.planning_commitment.metric!=='NON_BILLED_CONSERVATIVE_PLANNING_COMMITMENT'))throw Error('S2_COMMITMENT_NOT_BILLED_CREDITS')
  const transformed=identity(s),matching=verificationBindings.filter(b=>b.sourceId===s.source_id)
  if(matching.length>1)throw Error('S2_AMBIGUOUS_VERIFICATION_BINDING')
  const b=matching[0]
  if(b&&(!exact(b,['sourceId','sourceIdentity','sourceArtifactSha256','sourceArtifactBytes','independentlyVerified','reviewIdentity'])||b.sourceIdentity!==transformed||b.sourceArtifactSha256!==s.source_artifact.sha256||b.sourceArtifactBytes!==s.source_artifact.bytes||typeof b.independentlyVerified!=='boolean'||!hash(b.reviewIdentity)))throw Error('S2_SOURCE_ARTIFACT_VERIFICATION_MISMATCH')
  if(b&&s.review_receipt&&b.reviewIdentity!==s.review_receipt.identity)throw Error('S2_REVIEW_IDENTITY_MISMATCH')
  if(b?.independentlyVerified&&s.review_receipt?.disposition==='UNVERIFIED')throw Error('S2_SOURCE_REVIEW_DISPOSITION_CONTRADICTION')
  const verified=!!b&&b.independentlyVerified&&['VERIFIED_PORTAL_EXPORT','VERIFIED_PROVIDER_ACTIVITY'].includes(s.source_class)&&s.measurement_class==='PROVIDER_REQUEST_ROW'&&s.source_artifact.bytes!==null
  bindings.push({sourceId:s.source_id,sourceClass:s.source_class,projectClass:s.project_class,measurementClass:s.measurement_class,originalArtifact:s.source_artifact,upstreamArtifact:s.upstream_artifact||null,transformedInputIdentity:transformed,sourceIdentity:transformed,reviewIdentity:b?.reviewIdentity||s.review_receipt?.identity||null,reviewDisposition:verified?'VERIFIED_PROVIDER_REQUEST_EVIDENCE':'UNVERIFIED_FOR_PROVIDER_REQUEST_PROOF',suppliedReviewDisposition:s.review_receipt?.disposition||null,verified,receivedRows:s.rows.length,creditSemantics:s.credit_semantics,planningCommitment:s.planning_commitment||null})
  if(s.measurement_class==='AGGREGATE_ONLY'){
   if(s.rows.length||!exact(s.bounded_counts,['measurement','lowerBound','upperBound'])||!['PROVIDER_REQUEST_ROW','PROJECT_LOGICAL_OPERATION'].includes(s.bounded_counts.measurement)||!integer(s.bounded_counts.lowerBound)||(s.bounded_counts.upperBound!==null&&(!integer(s.bounded_counts.upperBound)||s.bounded_counts.upperBound<s.bounded_counts.lowerBound)))throw Error('S2_AGGREGATE_CANNOT_SYNTHESIZE_ROWS')
   aggregates.push({sourceId:s.source_id,boundedCounts:s.bounded_counts,proofEligible:false});continue
  }
  if(s.bounded_counts!==undefined)throw Error('S2_AGGREGATE_FIELDS_ON_ROWS')
  if(s.measurement_class==='PROJECT_LOGICAL_OPERATION'){
   for(const [i,r]of s.rows.entries()){
    const ref={sourceId:s.source_id,inputOrdinal:i+1,rowIdentity:identity(r)},bad=reason=>extraQuarantine.push({...ref,reason})
    if(!exact(r,['measurement_class','scheduled_utc','operation_fingerprint','terminal_results','displayed_credits','observed_terminal_utc','family','asset_symbol','source_message_sha256'])||r.measurement_class!==s.measurement_class||r.displayed_credits!==null||!token(r.operation_fingerprint)||!inWindow(r.scheduled_utc)||!timestamp(r.observed_terminal_utc)||!token(r.family)||!token(r.asset_symbol)||!hash(r.source_message_sha256)||!['live_controlled_success','package_result_authority_conflict','live_controlled_success|provider_start_failed'].includes(r.terminal_results)){bad('LOGICAL_OPERATION_MEASUREMENT_OR_UNKNOWN_CREDIT_CONTRADICTION');continue}
    const m=r.operation_fingerprint.match(/-(\d{8})T(\d{6})Z-/),scheduled=m&&m[1].slice(0,4)+'-'+m[1].slice(4,6)+'-'+m[1].slice(6,8)+'T'+m[2].slice(0,2)+':'+m[2].slice(2,4)+':'+m[2].slice(4,6)+'Z'
    if(scheduled!==r.scheduled_utc){bad('SCHEDULED_FINGERPRINT_UTC_MISMATCH');continue}
    const k=r.operation_fingerprint;if(!operationGroups.has(k))operationGroups.set(k,[]);operationGroups.get(k).push({...ref,...r,projectClass:s.project_class})
   }continue
  }
  const prepared={};for(const k of ['source_id','source_class','project_class','timezone_note','rows_received','deduplication','derived_summary','final_quota_proof_eligible','limitations'])if(k in s)prepared[k]=s[k]
  prepared.schema_version='1.0.0';prepared.rows=[]
  for(const [i,r]of s.rows.entries()){
   if(r.measurement_class!==s.measurement_class||(s.credit_semantics==='UNKNOWN'&&r.displayed_credits!==null))extraQuarantine.push({sourceId:s.source_id,inputOrdinal:i+1,rowIdentity:identity(r),reason:'REQUEST_MEASUREMENT_OR_UNKNOWN_CREDIT_CONTRADICTION'})
   else {const {measurement_class:ignored,...row}=r;prepared.rows.push(row)}
  }
  provider.push(prepared);if(verified)proof.push(prepared)
 }
 if(verificationBindings.some(b=>!sources.some(s=>s.source_id===b.sourceId)))throw Error('S2_ORPHAN_VERIFICATION_BINDING')
 for(const[k,g]of [...operationGroups].sort(([a],[b])=>a.localeCompare(b))){
  const semantics=r=>identity([r.scheduled_utc,r.terminal_results,r.family,r.asset_symbol,r.projectClass])
  if(new Set(g.map(semantics)).size!==1){extraQuarantine.push(...g.map(r=>({sourceId:r.sourceId,inputOrdinal:r.inputOrdinal,rowIdentity:r.rowIdentity,reason:'CONFLICTING_OPERATION_FINGERPRINT'})));continue}
  g.sort((a,b)=>a.sourceId.localeCompare(b.sourceId)||a.rowIdentity.localeCompare(b.rowIdentity));operations.push(g[0]);for(const r of g.slice(1))operationRemoved.push({stableId:k,reason:'IDENTICAL_OPERATION_FINGERPRINT',retainedStableId:k})
 }
 const empty={source_id:'EMPTY_SYNTHETIC_SET',source_class:'UNRESOLVED',project_class:'MIXED_ACCOUNT_ACTIVITY',rows:[]}
 const internalBindings=proof.map(s=>({sourceIdentity:identity(s),independentlyVerified:true,reviewIdentity:bindings.find(b=>b.sourceId===s.source_id).reviewIdentity}))
 const core=importRequestRows(provider.length?provider:empty,{estimatedProjections,verificationBindings:internalBindings}),proofCore=importRequestRows(proof.length?proof:empty,{verificationBindings:internalBindings})
 const {identity:oldSeal,...report}=core,strip=x=>({requests:x.requests,successes:x.successes,failures:x.failures,credits:x.unknownCreditRows?null:x.credits})
 const lower=proofCore.verifiedSuccessfulLowerBound,applicable=submissionApplicability!==null,floor=lower>=1000
 const logical={distinctLogicalOperationLowerBound:operations.length,pureLiveControlledSuccessOperations:operations.filter(r=>r.terminal_results==='live_controlled_success').length,operationsContainingLiveControlledSuccess:operations.filter(r=>r.terminal_results.includes('live_controlled_success')).length,unknownCreditOperations:operations.length,exactHttpAttemptCount:null,exactHttpResponseCount:null,exactBilledCredits:null,verifiedProviderRequestRows:0,measurementClass:'PROJECT_LOGICAL_OPERATION',proofEligible:false,dailyTotals:Object.fromEntries([...new Set(operations.map(r=>r.scheduled_utc.slice(0,10)))].sort().map(d=>[d,{operations:operations.filter(r=>r.scheduled_utc.startsWith(d)).length,pureLiveControlledSuccess:operations.filter(r=>r.scheduled_utc.startsWith(d)&&r.terminal_results==='live_controlled_success').length}]))}
 const result={...report,schemaVersion:'2.0.0',sourceBindings:bindings.sort((a,b)=>a.sourceId.localeCompare(b.sourceId)),observed:{...strip(core.observed),credits:core.observed.requests===0?null:strip(core.observed).credits},displayedCreditAccounting:{knownCreditTotal:core.observed.knownCreditTotal,knownCreditRows:core.observed.knownCreditRows,unknownCreditRows:core.observed.unknownCreditRows,unknownCreditOperations:operations.length,exactBilledCredits:null},projectClass:new Set(sources.map(s=>s.project_class)).size===1?sources[0].project_class:'MIXED_ACCOUNT_ACTIVITY',logicalOperations:logical,aggregateOnlyEvidence:aggregates.sort((a,b)=>a.sourceId.localeCompare(b.sourceId)),removedRows:[...core.removedRows,...operationRemoved],quarantined:[...core.quarantined,...extraQuarantine].sort((a,b)=>a.sourceId.localeCompare(b.sourceId)||a.rowIdentity.localeCompare(b.rowIdentity)),independentlyVerifiedProviderRequests:proofCore.observed.requests,verifiedSuccessfulLowerBound:lower,unverifiedObservedRequests:core.unverifiedObservedRequests,providerRequestFloorEvidenced:floor,sameAccountSubmissionApplicability:applicable?'RESOLVED':'UNRESOLVED',submissionApplicabilityReviewIdentity:submissionApplicability?.reviewIdentity||null,finalQuotaProofEligible:applicable&&lower>0,finalQuotaClaimable:applicable&&floor,quotaMet:applicable&&floor,planningCommitments:bindings.filter(b=>b.planningCommitment!==null).map(b=>({sourceId:b.sourceId,...b.planningCommitment})),networkRequests:0}
 privacyBoundary(result);return {...result,identity:identity(result)}
}

/** Pinned Principal artifact transformation, not generic inference of measurement. */
export function preparePrincipalSample(sample,sourceArtifact){
 return {...sample,schema_version:'2.0.0',measurement_class:'PROVIDER_REQUEST_ROW',source_artifact:sourceArtifact,credit_semantics:'DISPLAYED_CREDITS',rows:sample.rows.map(r=>({...r,measurement_class:'PROVIDER_REQUEST_ROW'}))}
}
