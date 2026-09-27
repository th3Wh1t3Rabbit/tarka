import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { identity, sha } from '../nq5/schema.mjs'
import { resolveLocalSchema } from '../nq5/official.mjs'
import { PAGES } from '../nq5-b1/docs.mjs'
import { B1_ARCHIVE } from './checkpoint.mjs'

const pins={
  'OFFICIAL_DOCS/INDEX.json':'7daaa7d8a966250c68859f64c186a28fbb1f6f4223e7fed1d9f3e9caacec9560',
  'EVIDENCE/LIVE_REQUEST_IDENTITY_MATRIX.json':'8c0e50be411c65fcf6b89792dfa009fdf21aad8b9bce544c9021e02d0e24505d',
  'EVIDENCE/ATTEMPT_CREDIT_AND_COUNT_RECONCILIATION.json':'8ac52459af89ba87af582e29767437f76688a0f60806b3f2cf23f84c3c08050d',
  'EVIDENCE/RATE_CONCURRENCY_AND_LATENCY_REPORT.json':'18c1165c4773867d6019e9439669c61d9b6cd49829995ff97a2adc64f968ce9f',
  'REPORTS/T1_B1_EXECUTION_REPORT.json':'9763a1873fa2aa48414e71655c44e970335d6cb5d53327ef35e5e4605befb79e',
  'REPORTS/T1_B1_UTILITY_REPORT.json':'c802eef0f03aee243873b6dfac48e8ec5c6a30c89bf0b46c2c15950e1e062f3f',
  'REPORTS/T1_CAMPAIGN_STATE_REDACTED.json':'6c764a4a8358fcd6ff09f9cefd7ec1948e82402a5e4b5b7a7da297ff62ae96ac'}
export function preservedDocs(root,bound){
  const env=Object.fromEntries(['PATH','HOME','LANG','TMPDIR'].flatMap(n=>process.env[n]===undefined?[]:[[n,process.env[n]]])),archive=path.join(path.dirname(root),B1_ARCHIVE)
  const read=name=>execFileSync('unzip',['-p',archive,name],{env,maxBuffer:16000000})
  const members=Object.fromEntries(Object.entries(pins).map(([name,pin])=>{const b=read(name);if(sha(b)!==pin)throw new Error('R1_REVIEWED_DELIVERY_MEMBER_IDENTITY');return [name,b]}))
  const indexBytes=members['OFFICIAL_DOCS/INDEX.json'],index=JSON.parse(indexBytes),bodies={}
  if(index.snapshots.length!==6||identity(index.snapshots.map(s=>s.name).sort())!==identity(Object.keys(PAGES).sort()))throw new Error('R1_PRESERVED_DOC_INVENTORY')
  for(const row of index.snapshots){
    const bytes=read('OFFICIAL_DOCS/'+row.name+'.md')
    if(sha(bytes)!==row.bodySha256||bytes.length!==row.bytes||row.url!=='https://docs.nansen.ai'+PAGES[row.name]||row.httpStatus!==200)throw new Error('R1_PRESERVED_DOC_IDENTITY')
    bodies[row.name]=bytes
  }
  for(const contract of bound.admission.contracts){
    const text=bodies[contract.family.endsWith('transactions')?'transactions':'historical-balances'].toString()
    const doc=[...text.matchAll(/```json\s*\n([\s\S]*?)\n```/g)].map(m=>JSON.parse(m[1])).find(d=>d.paths?.[contract.path]?.post),op=doc?.paths[contract.path].post
    if(!op||identity(resolveLocalSchema(doc,op.responses['200'].content['application/json'].schema))!==identity(contract.responseSchema)||identity(resolveLocalSchema(doc,op.requestBody.content['application/json'].schema))!==identity(contract.requestSchema))throw new Error('R1_PRESERVED_DOC_SCHEMA_IDENTITY')
  }
  return {indexBytes,index,bodies,disposition:'PRESERVED_B1_SNAPSHOTS_NOT_REFRESHED_ROOT_CAUSE_BLOCK',documentationGetsInR1:0,acceptedSchemasUnchanged:true}
}
