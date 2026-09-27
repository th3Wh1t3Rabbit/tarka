import { identity, sha } from '../nq5/schema.mjs'
import { resolveLocalSchema } from '../nq5/official.mjs'
import { structuralSchema } from '../nq5-b1-r1/diagnostic.mjs'
import { PAGES, QUESTIONS, FALLBACK, permitted } from './fetch-docs.mjs'

export function openapi(body,endpoint){const specs=[...body.matchAll(/```json\s*\n([\s\S]*?)\n```/g)].map(m=>JSON.parse(m[1]));const document=specs.find(s=>s.paths?.[endpoint]?.post);if(!document)throw new Error('R2_OFFICIAL_ENDPOINT_MISSING');const operation=document.paths[endpoint].post;return {document,operation,requestSchema:resolveLocalSchema(document,operation.requestBody.content['application/json'].schema),responseSchema:resolveLocalSchema(document,operation.responses['200'].content['application/json'].schema)}}
export function verifyCorpus(index,bodies){
  const required=[...Object.keys(PAGES),'questionA','questionB',...Object.keys(FALLBACK)]
  if(index.providerCalls!==0||index.credentialAccess!==false||new Set(index.snapshots.map(s=>s.filename)).size!==index.snapshots.length)throw new Error('R2_DOCUMENTATION_INVENTORY')
  const latest={}
  for(const row of index.snapshots){
    const bytes=bodies[row.filename],expected=PAGES[row.name]??FALLBACK[row.name]??(row.name==='questionA'?PAGES.transactions+'?ask='+encodeURIComponent(QUESTIONS.A):row.name==='questionB'?PAGES.balances+'?ask='+encodeURIComponent(QUESTIONS.B):null)
    if(!expected||row.url!=='https://docs.nansen.ai'+expected||!permitted(row.url)||!Buffer.isBuffer(bytes)||sha(bytes)!==row.sha256||bytes.length!==row.bytes||!Number.isFinite(Date.parse(row.retrievedAtUtc))||!row.retrievedAtUtc.endsWith('Z')||Date.parse(row.retrievedAtUtc)>Date.now()+1000||!/^[-A-Za-z0-9]+\.md$/.test(row.filename))throw new Error('R2_DOCUMENTATION_PROVENANCE')
    if(row.name in latest&&row.name!=='questionA'&&row.name!=='questionB')throw new Error('R2_DUPLICATE_PRIMARY_DOCUMENT')
    latest[row.name]={...row,body:bytes.toString('utf8')}
  }
  if(identity(Object.keys(latest).sort())!==identity(required.sort()))throw new Error('R2_DOCUMENTATION_INVENTORY')
  for(const name of [...Object.keys(PAGES),...Object.keys(FALLBACK)])if(latest[name].httpStatus!==200||!latest[name].bytes||latest[name].body.startsWith('# Page Not Found'))throw new Error('R2_OFFICIAL_DOCUMENT_UNAVAILABLE')
  return latest
}
export function citedSources(body){const section=body.split('# Sources:')[1]??'';return [...new Set([...section.matchAll(/\]\((https:\/\/docs\.nansen\.ai\/[^\s)]+)\)/g)].map(m=>m[1]))].sort()}
export function answerBody(body){return (body.split('## Answer')[1]??'').split('# Suggested Follow-up Questions:')[0].split('# Sources:')[0].trim()}

// Admission is an exact source-backed predicate, not permission conveyed by an
// AI answer or caller flag. These deliberately narrow clauses also allow direct
// positive/negative synthetic controls without relaxing actual official bytes.
export const NULL_CLAUSES=Object.freeze(['ProfilerTokenInfo.price_usd and ProfilerTokenInfo.value_usd may be JSON null on a successful 200 response.','Null means unavailable or unknown, never zero.','A client may omit these optional enrichment fields while retaining transaction and token-transfer facts.'])
export const TIME_CLAUSES=Object.freeze(['For POST /api/v1/profiler/address/historical-balances, timezone-less block_timestamp values use UTC.','Snapshots use one-hour buckets; block_timestamp labels the bucket start.','Both date.from and date.to are inclusive; a bucket start earlier than date.from is not returned.','Clients must align both request bounds to whole UTC hours and reject responses outside those bounds.'])
const nullable=s=>!!s&&structuralSchema(null,s).status==='PASS'
const exactType=(s,type)=>!!s&&identity(s)===identity({type})
const nullableNumber=s=>!!s&&[
  {type:['number','null']},{type:['null','number']},
  ...['anyOf','oneOf'].flatMap(k=>[{[k]:[{type:'number'},{type:'null'}]},{[k]:[{type:'null'},{type:'number'}]}])
].some(shape=>identity(shape)===identity(s))&&nullable(s)
const keysOnly=(s,keys)=>!!s&&Object.keys(s).every(k=>keys.includes(k))
export function sourceCertificate(kind,document){
  const clauses=kind==='transactions'?NULL_CLAUSES:kind==='balances'?TIME_CLAUSES:null
  if(!clauses)throw new Error('R2_UNKNOWN_CERTIFICATE_KIND')
  return '# Endpoint Contract\n\n## Contract Clarification\n'+clauses.join('\n')+'\n\n```json\n'+JSON.stringify(document)+'\n```\n'
}
export function clarificationAdmission({kind,answer,endpointBody,endpointUrl,endpointSchema,citations,status}){
  const clauses=kind==='transactions'?NULL_CLAUSES:kind==='balances'?TIME_CLAUSES:null
  const endpoint=kind==='transactions'?'/api/v1/profiler/address/transactions':'/api/v1/profiler/address/historical-balances'
  if(!clauses||status!==200||!Array.isArray(citations)||!citations.includes(endpointUrl)||endpointUrl!=='https://docs.nansen.ai'+(kind==='transactions'?PAGES.transactions:PAGES.balances)||!endpointSchema)return false
  // A deliberately strict future certificate format, never a generic AI prose
  // permission. Negation, quotation, extra conflicting prose and merely echoed
  // questions reject. Canonical schema is embedded in the exact source bytes.
  if(answer!==clauses.join('\n')||endpointBody!==sourceCertificate(kind,endpointSchema))return false
  const operation=endpointSchema.paths?.[endpoint]?.post
  if(!operation||operation.description!==clauses.join('\n'))return false
  // The only permitted semantic description is the exact endpoint certificate.
  // Other source descriptions could contradict it; they require separate review.
  let otherDescription=false
  function descriptions(value){if(!value||typeof value!=='object')return;for(const [key,child]of Object.entries(value)){if(key==='description'&&value!==operation)otherDescription=true;if(child&&typeof child==='object')descriptions(child)}}
  descriptions(endpointSchema)
  if(otherDescription)return false
  if(kind==='transactions'){
    const token=endpointSchema.components?.schemas?.ProfilerTokenInfo
    const response=operation.responses?.['200']?.content?.['application/json']?.schema
    const data=response?.properties?.data,transaction=data?.items,core=['transaction_hash','block_timestamp','chain','source_type','method']
    const linked=['tokens_sent','tokens_received'].every(k=>identity(transaction?.properties?.[k]??null)===identity({type:'array',items:{$ref:'#/components/schemas/ProfilerTokenInfo'}}))
    const layout=keysOnly(response,['type','properties','required','additionalProperties'])&&response.type==='object'&&keysOnly(data,['type','items'])&&data.type==='array'&&keysOnly(transaction,['type','properties','required','additionalProperties'])&&transaction.type==='object'&&Array.isArray(transaction.required)&&core.every(k=>transaction.required.includes(k)&&exactType(transaction.properties?.[k],'string'))&&Object.keys(transaction.properties).every(k=>[...core,'tokens_sent','tokens_received'].includes(k))
    const tokenCore=['token_symbol','token_amount','token_address','chain','from_address','to_address']
    return linked&&layout&&keysOnly(token,['type','properties','required','additionalProperties'])&&token.type==='object'&&Array.isArray(token.required)&&identity([...token.required].sort())===identity([...tokenCore].sort())&&['price_usd','value_usd'].every(k=>nullableNumber(token.properties?.[k])&&!token.required.includes(k))&&tokenCore.every(k=>token.required.includes(k)&&exactType(token.properties?.[k],k==='token_amount'?'number':'string'))&&Object.keys(token.properties).every(k=>[...tokenCore,'price_usd','value_usd'].includes(k))
  }
  return !!operation['x-temporal-profile']&&identity(operation['x-temporal-profile'])===identity({timezone:'UTC',snapshotIntervalSeconds:3600,timestampLabel:'BUCKET_START',bounds:'CLOSED_INCLUSIVE',earlierBucketAllowed:false,requestBounds:'WHOLE_UTC_HOURS'})
}
export function profiles(corpus,bound,index){
  const tx=openapi(corpus.transactions.body,'/api/v1/profiler/address/transactions'),hb=openapi(corpus.balances.body,'/api/v1/profiler/address/historical-balances')
  const state=(kind,spec,page,q)=>clarificationAdmission({kind,answer:answerBody(q.body),endpointBody:page.body,endpointUrl:page.url,endpointSchema:spec.document,citations:citedSources(q.body),status:q.httpStatus})
  const txAdmitted=state('transactions',tx,corpus.transactions,corpus.questionA),timeAdmitted=state('balances',hb,corpus.balances,corpus.questionB)
  const unchanged=(spec,f)=>{const old=bound.admission.contracts.find(c=>c.family.endsWith(f));return identity(spec.requestSchema)===identity(old.requestSchema)&&identity(spec.responseSchema)===identity(old.responseSchema)}
  const bind=(page,q)=>({endpointUrl:page.url,endpointSha256:page.sha256,clarificationUrl:q.url,clarificationSha256:q.sha256,clarificationHttpStatus:q.httpStatus,citedSourcePages:citedSources(q.body),sourceIndexIdentity:identity(index)})
  const token=tx.document.components.schemas.ProfilerTokenInfo
  const strict=['price_usd','value_usd'].every(k=>!nullable(token.properties[k])&&!token.required.includes(k))
  const transaction={schemaVersion:'1.0.0',family:'profiler/address/transactions',disposition:txAdmitted?'OFFICIALLY_CLARIFIED_ADMITTED':strict?'CURRENT_OPENAPI_STRICT_NO_NULL':'BLOCKED_AMBIGUOUS',AUTHORIZED_TO_ISSUE:false,liveReadyContract:txAdmitted,officialSchemasUnchanged:unchanged(tx,'transactions'),requestSchemaIdentity:identity(tx.requestSchema),responseSchemaIdentity:identity(tx.responseSchema),...bind(corpus.transactions,corpus.questionA),clarificationClassification:txAdmitted?'DIRECT_SOURCED_CONSISTENT_ADMISSION':corpus.questionA.httpStatus!==200?'UNAVAILABLE':strict&&/^No\s*[—-]/.test(answerBody(corpus.questionA.body))?'DIRECT_SOURCED_STRICT_NO_NULL':'AMBIGUOUS_NOT_PERMISSION',affectedFields:['ProfilerTokenInfo.price_usd','ProfilerTokenInfo.value_usd'],currentPublishedNullMeaning:'NOT_ESTABLISHED',proposal:{disposition:'OBSERVED_PROVIDER_COMPATIBILITY_PROPOSAL_PENDING_LEAD',offlineReplayOnly:true,nullInterpretation:'UNAVAILABLE_OR_UNKNOWN_PROPOSAL_NOT_OFFICIAL_FACT',nullFieldsOmitted:true,imputation:false,rawImmutable:true,labelsStripped:true,extraNullableFields:false,unknownUnsafeFieldsRejected:true,contractDriftNotice:'OBSERVED_PROVIDER_NULL_ENRICHMENT_CONTRACT_DRIFT_PENDING_LEAD',coreFieldsRequired:['transaction_hash','block_timestamp','chain','source_type','method','token_symbol','token_amount','token_address','from_address','to_address']}}
  const historical={schemaVersion:'1.0.0',family:'profiler/address/historical-balances',disposition:timeAdmitted?'OFFICIALLY_CLARIFIED_ADMITTED':'HELD_TIMEZONE_OR_BUCKET_AMBIGUOUS',AUTHORIZED_TO_ISSUE:false,liveReadyContract:timeAdmitted,officialSchemasUnchanged:unchanged(hb,'historical-balances'),requestSchemaIdentity:identity(hb.requestSchema),responseSchemaIdentity:identity(hb.responseSchema),...bind(corpus.balances,corpus.questionB),clarificationClassification:timeAdmitted?'DIRECT_SOURCED_CONSISTENT_ADMISSION':corpus.questionB.httpStatus!==200?'UNAVAILABLE':'INCOMPLETE_TEMPORAL_SEMANTICS_NOT_PERMISSION',timezone:timeAdmitted?'UTC':null,snapshotIntervalSeconds:timeAdmitted?3600:null,timestampLabel:timeAdmitted?'BUCKET_START':null,bounds:timeAdmitted?'CLOSED_INCLUSIVE':null,requestRule:timeAdmitted?'WHOLE_UTC_HOUR_ALIGNED_WITHIN_CUTOFF':'NO_WINDOW_VALIDATION_OR_REPLACEMENT_FROM_INFERENCE',earlierBucketAllowed:timeAdmitted?false:null,historicalCutoffUtc:'2023-03-13T12:15:00Z',heldDisposition:'HELD_UNISSUED_PENDING_OFFICIAL_TEMPORAL_SEMANTICS',methodologyScopeLimitation:'SMART_MONEY_HISTORICAL_HOLDINGS_DAILY_UTC_RULES_DO_NOT_ESTABLISH_PROFILER_BALANCE_SEMANTICS',methodologySha256:corpus.methodology.sha256}
  for(const profile of [transaction,historical])profile.hash=identity(profile)
  return {transaction,historical,transactionSpec:tx,historicalSpec:hb}
}
