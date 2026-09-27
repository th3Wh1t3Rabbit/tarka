import { identity, sha } from '../nq5/schema.mjs'
import { diagnose } from '../nq5-b1-r1/diagnostic.mjs'
import { readMirrored } from '../nq5-b1/store.mjs'
import { CONSUMED } from '../nq5-b1-r1/checkpoint.mjs'

export function proposalBound(bound,profile){
  const {hash,...payload}=profile
  const contract=bound.admission.contracts.find(c=>c.family==='profiler/address/transactions')
  if(identity(payload)!==hash||profile.AUTHORIZED_TO_ISSUE!==false||profile.family!==contract.family||profile.responseSchemaIdentity!==identity(contract.responseSchema)||identity(profile.affectedFields)!==identity(['ProfilerTokenInfo.price_usd','ProfilerTokenInfo.value_usd'])||profile.proposal.imputation!==false||profile.proposal.extraNullableFields!==false||profile.proposal.offlineReplayOnly!==true||profile.proposal.nullFieldsOmitted!==true||profile.proposal.labelsStripped!==true||profile.proposal.rawImmutable!==true||profile.proposal.unknownUnsafeFieldsRejected!==true)throw new Error('R2_NARROW_OFFLINE_PROFILE_REQUIRED')
  const copy=structuredClone(bound),c=copy.admission.contracts.find(c=>c.family===contract.family)
  function walk(schema){
    if(!schema||typeof schema!=='object')return
    if(schema.properties)schema.additionalProperties=false
    for(const value of Object.values(schema))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value)
  }
  walk(c.responseSchema)
  const transaction=c.responseSchema.properties?.data?.items
  if(!transaction?.properties)throw new Error('R2_EXACT_TRANSACTION_SCHEMA_REQUIRED')
  for(const field of ['transaction_hash','block_timestamp','chain','source_type','method'])if(!transaction.required.includes(field))throw new Error('R2_CORE_SCHEMA_DRIFT')
  for(const array of ['tokens_sent','tokens_received']){
    const transferArray=transaction.properties[array]
    if(transferArray?.anyOf?.length!==1||transferArray.anyOf[0].type!=='array')throw new Error('R2_EXACT_TWO_TRANSFER_ARRAYS_REQUIRED')
    const token=transferArray.anyOf[0].items
    if(!token?.properties)throw new Error('R2_EXACT_TWO_TRANSFER_ARRAYS_REQUIRED')
    for(const field of ['price_usd','value_usd']){if(!token.properties[field]||token.required.includes(field))throw new Error('R2_ENRICHMENT_SCHEMA_DRIFT');token.properties[field]={anyOf:[token.properties[field],{type:'null'}]}}
    for(const field of ['token_symbol','token_amount','token_address','chain','from_address','to_address'])if(!token.required.includes(field))throw new Error('R2_CORE_SCHEMA_DRIFT')
    token.properties.chain={...token.properties.chain,const:'ethereum'}
  }
  c.snapshotDocuments.endpoint.paths[c.path].post.responseSchema=structuredClone(c.responseSchema)
  c.snapshotDocuments.endpoint.offlineCompatibilityProposal={profileIdentity:hash,publishedResponseSchemaIdentity:profile.responseSchemaIdentity,officialEndpointSha256:profile.endpointSha256,officialAdmission:false,driftNotice:profile.proposal.contractDriftNotice}
  c.snapshots.endpoint=identity(c.snapshotDocuments.endpoint)
  return copy // Unbranded: cannot satisfy Dispatcher/assertAccepted authority.
}
export function replayTransaction(bound,request,raw,row,profile){
  const proposed=proposalBound(bound,profile),result=diagnose(proposed,request,raw,row)
  const object=JSON.parse(raw),transfers=object.data.flatMap(r=>[...(r.tokens_sent??[]),...(r.tokens_received??[])])
  return {logicalId:request.logicalId,originalTerminal:'ISSUED_TERMINAL_NONCOUNTED',originalQualificationCounted:false,AUTHORIZED_TO_ISSUE:false,officialContractDisposition:profile.disposition,proposalOnly:true,profileIdentity:profile.hash,rawBytes:raw.length,rawSha256:sha(raw),nullEnrichmentFieldsObserved:transfers.reduce((n,t)=>n+['price_usd','value_usd'].filter(k=>Object.hasOwn(t,k)&&t[k]===null).length,0),nullImputedAsZero:false,normalizedEnrichmentFieldsExported:0,labelsExported:0,...result,qualificationAdmissionFromReplay:false,publicCallId:null,rawBodyIncluded:false}
}
export function preservedReplay(context,profiles){return {schemaVersion:'1.0.0',AUTHORIZED_TO_ISSUE:false,responses:CONSUMED.map(id=>{const request=context.bound.plan.requests.find(r=>r.logicalId===id),row=context.prior.responses.get(id+'.1'),raw=readMirrored(context.roots,'raw-b1/'+row.rawName);return request.family.endsWith('transactions')?replayTransaction(context.bound,request,raw,row,profiles.transaction):{logicalId:id,originalTerminal:'ISSUED_TERMINAL_NONCOUNTED',originalQualificationCounted:false,AUTHORIZED_TO_ISSUE:false,officialContractDisposition:profiles.historical.disposition,profileIdentity:profiles.historical.hash,rawBytes:raw.length,rawSha256:sha(raw),timezoneInferred:false,bucketInferred:false,requestWindowModified:false,...diagnose(context.bound,request,raw,row),qualificationAdmissionFromReplay:false,publicCallId:null,rawBodyIncluded:false}}),originalTerminalsModified:false,privateStateModified:false}}
