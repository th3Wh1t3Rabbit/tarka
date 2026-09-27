import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { identity } from '../nq5/schema.mjs'
import { projectResponse } from '../nq5/projection.mjs'
import { admitResponse } from '../nq5-b1/dispatcher.mjs'

const pending=()=>({status:'NOT_RUN',code:'UPSTREAM_GATE_FAILED'})
export function diagnosticUnavailable(bound,request,stage,code){
  const contract=bound.admission.contracts.find(c=>c.family===request.family)
  const stages=Object.fromEntries(['json','providerSchema','pagination','temporal','normalizationProjection','publicSchema'].map(n=>[n,pending()]))
  stages[stage]={status:'FAIL',code}
  return {schemaIdentity:identity(contract.responseSchema),stages,safelyAdmissible:false,admittedResultCount:null,normalizedIdentity:null,firstFailedStage:stage}
}
export function diagnoseDurable(bound,request,store,row,sequence=1){
  let raw
  try{raw=store.raw(row)}catch{return diagnosticUnavailable(bound,request,'durableStorage','DURABLE_RAW_READ_FAILED')}
  try{return diagnose(bound,request,raw,row,sequence)}catch{return diagnosticUnavailable(bound,request,'diagnostic','UNEXPECTED_DIAGNOSTIC_EXCEPTION')}
}
export function structuralSchema(object,schema){
  const env=Object.fromEntries(['PATH','HOME','LANG','LC_ALL','TMPDIR'].flatMap(n=>process.env[n]===undefined?[]:[[n,process.env[n]]]))
  const result=spawnSync('python3',[fileURLToPath(new URL('./structural.py',import.meta.url))],{input:JSON.stringify({object,schema}),encoding:'utf8',maxBuffer:1000000,env:{...env,PYTHONDONTWRITEBYTECODE:'1'}})
  if(result.status!==0||!result.stdout)return {status:'FAIL',code:'SCHEMA_DIAGNOSTIC_UNAVAILABLE',findings:[]}
  try{return JSON.parse(result.stdout)}catch{return {status:'FAIL',code:'SCHEMA_DIAGNOSTIC_UNAVAILABLE',findings:[]}}
}
export function diagnose(bound,request,raw,row,sequence=1){
  const contract=bound.admission.contracts.find(c=>c.family===request.family)
  const stages={json:pending(),providerSchema:pending(),pagination:pending(),temporal:pending(),normalizationProjection:pending(),publicSchema:pending()}
  const report={schemaIdentity:identity(contract.responseSchema),stages,safelyAdmissible:false,admittedResultCount:null,normalizedIdentity:null,firstFailedStage:null}
  const fail=(stage,code)=>{stages[stage]={...stages[stage],status:'FAIL',code};report.firstFailedStage=stage;return report}
  let response
  try{response=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));stages.json={status:'PASS',code:'JSON_ACCEPTED'}}catch{return fail('json','JSON_UTF8_OR_PARSE_REJECTED')}
  stages.providerSchema=structuralSchema(response,contract.responseSchema)
  if(stages.providerSchema.status!=='PASS')return fail('providerSchema',stages.providerSchema.code)
  const p=response.pagination
  if(p.page!==request.body.pagination.page||p.per_page!==request.body.pagination.per_page||typeof p.is_last_page!=='boolean'||response.data.length>p.per_page||(!p.is_last_page&&!response.data.length))return fail('pagination','PAGINATION_INCOMPATIBLE')
  stages.pagination={status:'PASS',code:'PAGE_METADATA_ACCEPTED',page:p.page,isLastPage:p.is_last_page}
  const valid=response.data.map(r=>r.block_timestamp).filter(v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d(?:[T ]\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)?)?$/.test(v)&&Number.isFinite(Date.parse(v)))
  const explicit=valid.every(t=>/(?:Z|[+-]\d\d:\d\d)$/.test(t))
  valid.sort(explicit?(a,b)=>Date.parse(a)-Date.parse(b):(a,b)=>a.localeCompare(b))
  stages.temporal={status:'PASS',code:'TEMPORAL_ACCEPTED',requestedWindow:request.body.date,minimumTimestamp:valid[0]??null,maximumTimestamp:valid.at(-1)??null,timestampRangeInterpretation:explicit?'EXPLICIT_OFFSET_INSTANTS':'NOMINAL_TIME_WITH_UNSPECIFIED_ZONE',cutoffUtc:'2023-03-13T12:15:00Z'}
  if(valid.some(t=>t.length===10))return fail('temporal','DATE_ONLY_SNAPSHOT_CANNOT_PROVE_INTRADAY_WINDOW')
  if(valid.some(t=>!/(?:Z|[+-]\d\d:\d\d)$/.test(t))){
    stages.temporal.nominalMinimumPrecedesRequestedFrom=valid.some(t=>t.replace(' ','T').slice(0,19)<request.body.date.from.slice(0,19))
    return fail('temporal','TIMESTAMP_WITHOUT_EXPLICIT_TIMEZONE_NOT_ADMITTED')
  }
  if(valid.length!==response.data.length||valid.some(t=>Date.parse(t)<Date.parse(request.body.date.from)||Date.parse(t)>Date.parse(request.body.date.to)||Date.parse(t)>Date.parse(stages.temporal.cutoffUtc)))return fail('temporal','TIMESTAMP_MISSING_INVALID_OR_OUTSIDE_ADMITTED_WINDOW')
  let projected
  try{projected=projectResponse(contract,response,{id:request.coverageCells[0],fromUtc:request.body.date.from,toUtc:request.body.date.to,status:response.data.length?'COMPLETE':'EMPTY_COMPLETE',supportsNegative:false},stages.temporal.cutoffUtc,raw);stages.normalizationProjection={status:'PASS',code:'ALLOWLIST_PROJECTION_ACCEPTED',missingAllowlistedFieldNames:[],rejectedFieldNames:[]}}catch(error){
    // Exact internal literals map to finite stable codes. Never export messages.
    const codes=new Map([
      ['Unknown official response structure.','NORMALIZATION_RESPONSE_STRUCTURE'],
      ['Only admitted Ethereum successful event facts may be public.','NORMALIZATION_CHAIN_OR_RECEIPT_NOT_ADMITTED'],
      ['Unknown official transfer structure.','NORMALIZATION_TRANSFER_STRUCTURE'],
      ['No allowlisted transfer facts; native/NFT/contract facts remain private until separately admitted.','NORMALIZATION_NO_ALLOWLISTED_TRANSFER_FACTS'],
      ['Exact decimal lexeme required.','NORMALIZATION_EXACT_DECIMAL_REQUIRED'],
      ['Decimal exponent bound exceeded.','NORMALIZATION_DECIMAL_EXPONENT_BOUND'],
      ['Unsafe normalized field.','PROJECTION_UNSAFE_FIELD_TYPE_OR_TEXT'],
      ['Invalid public address.','PROJECTION_INVALID_ADDRESS'],
      ['Invalid public receipt identity.','PROJECTION_INVALID_TRANSACTION_HASH'],
      ['Post-cutoff or out-of-window public record.','PROJECTION_OUT_OF_WINDOW_OR_CUTOFF'],
      ['Exact decimal string required.','PROJECTION_UNSIGNED_EXACT_DECIMAL_REQUIRED'],
      ['Missing allowlisted fact; cannot downgrade silently.','PROJECTION_MISSING_ALLOWLISTED_FACT']
    ])
    stages.normalizationProjection={status:'FAIL',code:codes.get(error.message)??'UNEXPECTED_NORMALIZATION_PROJECTION_EXCEPTION',missingAllowlistedFieldNames:[],rejectedFieldNames:[]}
    return fail('normalizationProjection',stages.normalizationProjection.code)
  }
  try{admitResponse(bound,request,raw,row,sequence);stages.publicSchema={status:'PASS',code:'PUBLIC_SCHEMA_ACCEPTED'}}catch{return fail('publicSchema','PUBLIC_SCHEMA_REJECTED')}
  report.safelyAdmissible=true;report.admittedResultCount=projected.rows.length;report.normalizedIdentity=projected.normalizedSha256;return report
}
