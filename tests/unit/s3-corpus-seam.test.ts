import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {displayForMode,validateDisplayRecord,executableCorpusQuery,admitFrozenCorpusCandidate,admitSyntheticCorpusFixture,syntheticDisplayForMode} from '../../src/investigation/corpus-seam/contracts'
import type {Query,Presentation} from '../../src/investigation/contracts'
const read=(n:string)=>JSON.parse(readFileSync('artifacts/g6p-s3/REPORTS/'+n,'utf8'))
const final=read('TE_IFACE_CORPUS_FINAL_CANDIDATE.json'),fixture=read('SYNTHETIC_SEMANTIC_FIXTURE.json')
const admitted=await admitFrozenCorpusCandidate(final)
const modes:Presentation[]=['FULLSCREEN_CRT','DOCKED_OVERLAY','PLAIN_LIST']
describe('S3 display-only typed seam',()=>{
 it.each(modes)('preserves all 25 and 9 synthetic role values in %s',async mode=>{
  expect(await displayForMode(await admitFrozenCorpusCandidate(final),mode)).toEqual(final.displayRecords)
  expect(await syntheticDisplayForMode(await admitSyntheticCorpusFixture(fixture),mode)).toEqual(fixture.records)
  expect(new Set(fixture.records.map((r:{role:string})=>r.role)).size).toBe(9)
 })
 it('sorting is deterministic; duplicate IDs and concept mappings reject',async()=>{
  const corpus=await admitFrozenCorpusCandidate(final)
  expect(await displayForMode(corpus,'PLAIN_LIST',[...final.displayRecords].reverse().map(r=>r.id))).toEqual(final.displayRecords)
  await expect(displayForMode(corpus,'PLAIN_LIST',[final.displayRecords[0].id,final.displayRecords[0].id])).rejects.toThrow('DUPLICATE')
 })
 it.each(['endpoint','providerRequestId','requestBodySha256','rawProviderBody','provenance','assetAmounts'])('rejects provider/audit field %s',async key=>{
  await expect(validateDisplayRecord({...final.displayRecords[0],[key]:'SYNTHETIC'},admitted)).rejects.toThrow('SCHEMA')
 })
 it.each(['proofEligible','recursiveFrontierAuthority','runtimeProviderCalls'])('rejects %s promotion before hash checks',async key=>{
  await expect(validateDisplayRecord({...final.displayRecords[0],[key]:key==='runtimeProviderCalls'?1:true},admitted)).rejects.toThrow('AUTHORITY')
 })
 it('bounded zeros cannot become global negatives or exact evidence',async()=>{
  const r=final.displayRecords.find((x:{zeroResultClass:string|null})=>x.zeroResultClass)
  await expect(validateDisplayRecord({...r,zeroResultClass:'NEGATIVE_EVIDENCE_SUPPORTED'},admitted)).rejects.toThrow('ZERO')
  await expect(validateDisplayRecord({...r,grade:'EXACT'},admitted)).rejects.toThrow('PROMOTION')
  await expect(validateDisplayRecord({...r,observedResultCount:1},admitted)).rejects.toThrow('ZERO')
 })
 it('corrupted digest, role and audit stripping reject',async()=>{
  await expect(validateDisplayRecord({...final.displayRecords[0],identity:'0'.repeat(64)},admitted)).rejects.toThrow('IDENTITY')
  await expect(validateDisplayRecord({...final.displayRecords[0],role:'UNKNOWN'},admitted)).rejects.toThrow('AUTHORITY')
  const r={...final.displayRecords[0]};delete r.coverage
  await expect(validateDisplayRecord(r,admitted)).rejects.toThrow('SCHEMA')
 })
 it('resealable temporal exactness and synthetic role promotion still reject',async()=>{
  await expect(validateDisplayRecord({...final.displayRecords[0],temporalClass:'EXACT_UTC'},admitted)).rejects.toThrow('PROMOTION')
  await expect(validateDisplayRecord({...fixture.records[0],grade:'EXACT',role:'CONTROL'},admitted)).rejects.toThrow('COVERAGE')
 })
 it('frozen historical hashes stay sealed; only S4 explicit copy/hash crosswalk may differ',()=>{
  const truth=final.compatibility.preservedBytes.filter((x:{file:string})=>x.file.startsWith('public/'))
  expect(truth).toHaveLength(6)
  const crosswalk=JSON.parse(readFileSync('artifacts/g6p-s4/REPORTS/TRUTH_HASH_CROSSWALK.json','utf8'))
  for(const x of truth){
   const current=createHash('sha256').update(readFileSync(x.file)).digest('hex')
   const permitted=crosswalk.files.find((f:{file:string;changed:boolean})=>f.file===x.file&&f.changed)
   if(permitted){expect(permitted.beforeSha256).toBe(x.sha256);expect(current).toBe(permitted.afterSha256)}else expect(current).toBe(x.sha256)
  }
 })
 it('query seam delegates canonical asset guard without rewriting raw chips',()=>{
  const filter=(field:'ASSET'|'MIN_AMOUNT',value:string)=>({field,value,origin:'PLAYER_FILTER' as const,sourceId:'SYNTHETIC'})
  const q:Query={lens:'ACTIVITY',questionId:'SYNTHETIC',filters:[filter('ASSET','TEST'),filter('ASSET','OTHER'),filter('MIN_AMOUNT','50')]}
  const before=structuredClone(q)
  for(const filters of [q.filters,[...q.filters].reverse()])expect(()=>executableCorpusQuery({...q,filters})).toThrow('INVALID_QUERY')
  expect(q).toEqual(before)
  q.filters=[filter('MIN_AMOUNT','50'),filter('ASSET',' test '),filter('ASSET','TEST')]
  expect(executableCorpusQuery(q).filters).toEqual([{field:'ASSET',value:'TEST'},{field:'MIN_AMOUNT',value:'50'}])
 })
 it('browser-safe seam has no transport or gameplay integration imports',()=>{
  const src=readFileSync('src/investigation/corpus-seam/contracts.ts','utf8')
  expect(src).not.toMatch(/\b(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/)
  expect(readFileSync('src/app/App.tsx','utf8')).not.toContain('corpus-seam')
 })
})
