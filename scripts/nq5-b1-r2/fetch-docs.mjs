import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { sha } from '../nq5/schema.mjs'
export const PAGES=Object.freeze({transactions:'/api/profiler/address-transactions.md',balances:'/api/profiler/address-historical-balances.md',methodology:'/guides/data-methodology-and-technical-reference.md',coverage:'/api/data-coverage.md',pricing:'/getting-started/credits.md',rates:'/getting-started/rate-limits.md',redistribution:'/guides/redistribution-guide.md',changelog:'/api/changelog.md',llms:'/llms.txt'})
export const QUESTIONS=Object.freeze({A:'For POST /api/v1/profiler/address/transactions, can ProfilerTokenInfo.price_usd and ProfilerTokenInfo.value_usd be present as JSON null on a successful 200 response? If yes, does null mean unavailable or unknown rather than zero, and may a client omit those optional enrichment fields while retaining the transaction and token-transfer facts? Cite the current documentation sections or schema source that establish the answer.',B:'For POST /api/v1/profiler/address/historical-balances, what timezone applies when response block_timestamp values contain no Z or numeric offset; what snapshot or bucket interval is used; does block_timestamp label the bucket start, end, or observation time; and may an intrahour request return a bucket timestamp earlier than date.from? State the correct client validation and request-window rule and cite the current documentation sections or schema source that establish it.'})
export const FALLBACK=Object.freeze({backtestingBalances:'/api/backtesting-data/historical-address-balance.md',backtestingTransactions:'/api/backtesting-data/historical-address-transactions.md'})
export function permitted(url){const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='docs.nansen.ai'||u.port||u.username||u.password||u.hash) return false;const paths=[...Object.values(PAGES),...Object.values(FALLBACK)];if(!paths.includes(u.pathname))return false;if(!u.search)return true;return [...u.searchParams.keys()].join()==='ask'&&((u.pathname===PAGES.transactions&&u.searchParams.get('ask')===QUESTIONS.A)||(u.pathname===PAGES.balances&&u.searchParams.get('ask')===QUESTIONS.B))}
export function get(url){if(!permitted(url))throw new Error('R2_DOCUMENTATION_URL_NOT_AUTHORIZED');return new Promise(resolve=>{let settled=false,timer;const finish=r=>{if(settled)return;settled=true;clearTimeout(timer);resolve({...r,retrievedAtUtc:new Date().toISOString()})};const req=https.get(url,{agent:false,headers:{Accept:'text/markdown,text/plain;q=0.9','User-Agent':'TRACE-ESCAPE-R2-documentation-only'}},res=>{const chunks=[];let bytes=0;res.on('data',b=>{bytes+=b.length;if(bytes>4000000){req.destroy();return}chunks.push(b)});res.on('end',()=>finish({status:res.statusCode,bytes:Buffer.concat(chunks),transport:'UNAUTHENTICATED_HTTPS_GET_NO_REDIRECT'}));res.on('error',()=>finish({status:null,bytes:Buffer.alloc(0),transport:'RETRIEVAL_UNAVAILABLE'}));res.on('aborted',()=>finish({status:null,bytes:Buffer.alloc(0),transport:'RETRIEVAL_UNAVAILABLE'}))});timer=setTimeout(()=>req.destroy(),120000);req.on('error',()=>finish({status:null,bytes:Buffer.alloc(0),transport:'RETRIEVAL_UNAVAILABLE'}))})}
export async function retrieve(root,phase){
  const dir=path.join(root,'artifacts/g6p-b1-r2/docs');fs.mkdirSync(dir,{recursive:true})
  const indexFile=path.join(dir,'INDEX.json')
  const read=()=>fs.existsSync(indexFile)?JSON.parse(fs.readFileSync(indexFile)):{schemaVersion:'1.0.0',snapshots:[],providerCalls:0,credentialAccess:false}
  const targets=phase==='primary'?PAGES:phase==='clarifications'||phase==='clarifications-retry'?Object.fromEntries(Object.entries(QUESTIONS).map(([n,q])=>['question'+n,(n==='A'?PAGES.transactions:PAGES.balances)+'?ask='+encodeURIComponent(q)])):phase==='fallback'||phase==='fallback-retry'?FALLBACK:null
  if(!targets)throw new Error('R2_INVALID_RETRIEVAL_PHASE')
  for(const [name,p]of Object.entries(targets)){
    const before=read(),old=before.snapshots.filter(s=>s.name===name),retry=phase==='clarifications-retry'
    if(old.length&&(!retry||old.length!==1||old[0].httpStatus===200))throw new Error('R2_EXISTING_SNAPSHOT_PRESERVED')
    const url='https://docs.nansen.ai'+p,r=await get(url),attempt=phase==='fallback-retry'?2:old.length+1,filename=name+(attempt>1?'-attempt'+attempt:'')+'.md'
    fs.writeFileSync(path.join(dir,filename),r.bytes,{flag:'wx'})
    const index=read()
    index.snapshots.push({name,attempt,url,retrievedAtUtc:r.retrievedAtUtc,httpStatus:r.status,bytes:r.bytes.length,sha256:sha(r.bytes),filename,transport:r.transport})
    fs.writeFileSync(indexFile,JSON.stringify(index,null,2)+'\n')
    process.stdout.write('DOC '+name+' attempt '+attempt+' status '+r.status+' bytes '+r.bytes.length+' sha256 '+sha(r.bytes)+'\n')
  }
  return read()
}
