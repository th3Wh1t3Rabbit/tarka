import https from 'node:https'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { identity, sha, freeze } from '../nq5/schema.mjs'
import { extractDocumentFacts, resolveLocalSchema } from '../nq5/official.mjs'
import { assertAccepted, ACCEPTED_COMMIT } from './authority.mjs'

export const PAGES=Object.freeze({
  'rate-limits':'/getting-started/rate-limits.md',pricing:'/getting-started/credits.md',transactions:'/api/profiler/address-transactions.md','historical-balances':'/api/profiler/address-historical-balances.md',coverage:'/api/data-coverage.md',redistribution:'/guides/redistribution-guide.md'})
const snapshots=new WeakSet()
const codeRoot=fileURLToPath(new URL('../..',import.meta.url))
const gitEnvironment=Object.fromEntries(['PATH','HOME','USER','LOGNAME','LANG','LC_ALL'].flatMap(n=>process.env[n]===undefined?[]:[[n,process.env[n]]]))
export function validateDocs(bound,index,bodies){
  assertAccepted(bound)
  if(index.snapshots.length!==6||identity(index.snapshots.map(s=>s.name).sort())!==identity(Object.keys(PAGES).sort()))throw new Error('B1_DOC_INVENTORY')
  const docs=Object.fromEntries(index.snapshots.map(row=>{
    const bytes=bodies[row.name],body=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
    if(row.url!=='https://docs.nansen.ai'+PAGES[row.name]||row.httpStatus!==200||row.status!=='FETCHED'||sha(bytes)!==row.bodySha256||row.bytes!==bytes.length||Date.now()-Date.parse(row.retrievedAtUtc)>3600000||Date.parse(row.retrievedAtUtc)>Date.now()||!Number.isFinite(Date.parse(row.retrievedAtUtc))||body.startsWith('# Page Not Found'))throw new Error('B1_DOC_PROVENANCE')
    return [row.name,{body,facts:extractDocumentFacts(row.name,body)}]
  }))
  const match=docs['rate-limits'].body.match(/^\| Pro \(all paid plans\)\s*\|\s*([\d,]+) requests\s*\|\s*([\d,]+) requests/m)
  if(!match||Number(match[1].replaceAll(',',''))<75||Number(match[2].replaceAll(',',''))<1500)throw new Error('B1_DOC_RATE_INCOMPATIBLE')
  if(!docs.coverage.facts.ethereumFromUtc||!docs.coverage.facts.historicalRevisionsPossible||docs.redistribution.facts.attribution!=='Powered by Nansen API')throw new Error('B1_DOC_COVERAGE_REDISTRIBUTION')
  for(const contract of bound.admission.contracts){
    const name=contract.family.endsWith('transactions')?'transactions':'historical-balances'
    const documents=[...docs[name].body.matchAll(/```json\s*\n([\s\S]*?)\n```/g)].map(m=>JSON.parse(m[1]))
    const document=documents.find(d=>d.paths?.[contract.path]?.post),operation=document?.paths[contract.path]?.post
    if(!operation||operation.requestBody?.content?.['application/json']?.schema===undefined||operation.responses?.['200']?.content?.['application/json']?.schema===undefined)throw new Error('B1_DOC_ENDPOINT_MISSING')
    const request=resolveLocalSchema(document,operation.requestBody.content['application/json'].schema),response=resolveLocalSchema(document,operation.responses['200'].content['application/json'].schema)
    if(identity(request)!==identity(contract.requestSchema)||identity(response)!==identity(contract.responseSchema))throw new Error('B1_DOC_SCHEMA_CHANGED')
    const originalBytes=execFileSync('git',['show',ACCEPTED_COMMIT+':docs/official/r3/'+name+'.md'],{cwd:codeRoot,env:gitEnvironment,maxBuffer:8000000})
    if(sha(originalBytes)!==contract.snapshotDocuments.endpoint.bodySha256)throw new Error('B1_ACCEPTED_DOC_BYTES')
    const original=[...originalBytes.toString().matchAll(/```json\s*\n([\s\S]*?)\n```/g)].map(m=>JSON.parse(m[1])).find(d=>d.paths?.[contract.path]?.post)
    for(const [header,component]of [['X-Nansen-Credits-Cost','XNansenCreditsCost'],['X-Nansen-Credits-Used','XNansenCreditsUsed'],['X-Nansen-Credits-Remaining','XNansenCreditsRemaining']]){
      if(!document.components?.headers?.[component]||identity(document.components.headers[component])!==identity(original.components.headers[component])||identity(operation.responses['200'].headers?.[header])!==identity(original.paths[contract.path].post.responses['200'].headers[header]))throw new Error('B1_DOC_CREDIT_HEADER_SEMANTICS_CHANGED')
    }
    const old=contract.snapshotDocuments
    const rule=docs.redistribution.facts.rules.find(r=>r.family===contract.family)
    if(docs.pricing.facts.endpointCosts[contract.family]?.PRO!==1||identity(rule)!==identity(old.redistribution.sourceRule)||Date.parse(docs.coverage.facts.ethereumFromUtc)>Date.parse(old.coverage.fromUtc)||docs['rate-limits'].body.includes('`POST '+contract.path+'`'))throw new Error('B1_DOC_ADMISSION_CHANGED')
  }
  const result=freeze({index,indexSha256:identity(index),officialSecond:Number(match[1].replaceAll(',','')),officialMinute:Number(match[2].replaceAll(',','')),envelopeHash:bound.envelope.hash})
  snapshots.add(result);return result
}
export function assertDocs(value,bound){if(!snapshots.has(value)||value.envelopeHash!==bound.envelope.hash||value.index.snapshots.some(s=>Date.now()-Date.parse(s.retrievedAtUtc)>3600000))throw new Error('B1_CURRENT_DOC_PROOF_REQUIRED')}
function getPage(name){
  const url='https://docs.nansen.ai'+PAGES[name]
  return new Promise((resolve,reject)=>{
    let settled=false,connectTimer,totalTimer
    const fail=()=>{if(settled)return;settled=true;clearTimeout(connectTimer);clearTimeout(totalTimer);request.destroy();reject(new Error('B1_DOCUMENT_RETRIEVAL_FAILED'))}
    const request=https.request(url,{method:'GET',agent:false,headers:{accept:'text/markdown'}},response=>{
      clearTimeout(connectTimer);const chunks=[];let bytes=0
      response.on('data',chunk=>{bytes+=chunk.length;if(bytes>8000000)return fail();chunks.push(chunk)})
      response.on('error',fail);response.on('aborted',fail)
      response.on('end',()=>{if(settled)return;settled=true;clearTimeout(totalTimer);resolve({name,url,retrievedAtUtc:new Date().toISOString(),httpStatus:response.statusCode,body:Buffer.concat(chunks)})})
    })
    request.on('socket',socket=>socket.once('secureConnect',()=>clearTimeout(connectTimer)))
    request.on('error',fail);connectTimer=setTimeout(fail,5000);totalTimer=setTimeout(fail,30000);request.end()
  })
}
// Fixed, unauthenticated GET inventory. Never follow redirects, suggestions,
// query parameters, source instructions, or the lookup section's endpoint.
export async function refreshDocs(bound){
  assertAccepted(bound);const bodies={},rows=[]
  for(const name of Object.keys(PAGES)){
    const result=await getPage(name).catch(()=>({name,url:'https://docs.nansen.ai'+PAGES[name],retrievedAtUtc:new Date().toISOString(),httpStatus:0,body:Buffer.alloc(0),retrievalError:'BOUNDED_DOCUMENT_TRANSPORT_FAILURE_NO_RESPONSE'}))
    const {body,...row}=result;bodies[name]=body
    rows.push({...row,file:name+'.md',bytes:body.length,bodySha256:sha(body),status:row.httpStatus===200?'FETCHED':'UNAVAILABLE'})
  }
  const index={schemaVersion:'1.0.0',scope:'SIX_FIXED_UNAUTHENTICATED_DOCUMENTATION_GETS',providerCalls:0,credentialResolution:false,redirectsFollowed:false,snapshots:rows}
  return {index,bodies}
}
