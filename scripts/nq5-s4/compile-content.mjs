import fs from 'node:fs'
import assert from 'node:assert/strict'
import {validateFiles,contentDigest} from '../../content/parallel/narrative/validate-catalogs.mjs'
import {implementationIdentity} from '../../content/parallel/narrative/implementation-digest.mjs'
import {sha} from '../nq5-s2/activity.mjs'
import {consumerManifest,assertClosedClient} from '../nq5-s4-r1/consumers.mjs'
export function compileEntries(catalog,consumers){
 const byKey=new Map(catalog.entries.map(e=>[e.key,e]))
 return Object.fromEntries(Object.keys(consumers).map(key=>{
  const e=byKey.get(key);assert.ok(e,'MISSING_REQUIRED_CONSUMER_KEY_'+key)
  assert.ok(!e.optional&&e.evidence_ids.length===0&&e.tokens.length===0&&e.claim_class!=='ACCEPTED_EXACT'&&!e.requires.some(g=>g.startsWith('EXACT_')||g.startsWith('SLOT.')||g==='CASE_COMPLETE'),'INELIGIBLE_REQUIRED_CONSUMER_KEY_'+key)
  return [key,{text:e.text,fallback:e.fallback,requires:e.requires,lineClass:e.line_class,claimClass:e.claim_class,optional:e.optional}]
 }))
}
export const BASE='299bc67ab65c3f4fdda22d08e76c6c23df89c8f8',TREE='8fa1fcfa3a919fedd70cac1c77ec986e0d7d5986'
export const CONTENT='540623c9e7f973f0f1cfa4bd4aa5b27f5150247004a05b61ab3a8791b87e0a2e',IMPLEMENTATION='84a081161b8b3e147021ad497af0862eaf3d7fe80b92f79de8ebe57e7711b46b'
export function compileContent(){
 const validation=validateFiles(process.cwd(),false);assert.equal(validation.status,'PASS',JSON.stringify(validation.errors));assert.equal(validation.content_sha256,CONTENT);assert.equal(implementationIdentity().sha256,IMPLEMENTATION)
 const read=n=>JSON.parse(fs.readFileSync('content/parallel/narrative/'+n)),catalog=read('COPY_CATALOG.json')
 assert.equal(contentDigest(catalog.entries),CONTENT)
 const deadSource=read('DEAD_END_RESPONSE_CATALOG.json'),dead=Object.fromEntries(['verb_fallbacks','looks','alternates','overrides','zero_results'].map(k=>[k,deadSource[k].filter(e=>k!=='verb_fallbacks'||e.verb!=='LOOK_AT')]))
 const consumers=consumerManifest(dead),entries=compileEntries(catalog,consumers)
 const output={schemaVersion:'1.0.0',interface:'TE-IFACE-CONTENT@1.1.0',interfaceIdentity:catalog.interface_sha256,contentIdentity:CONTENT,implementationIdentity:IMPLEMENTATION,alias:read('ARTHUR_RUNTIME_ALIAS_MAP.json'),dead,entries,optionalIncluded:false,exactLiteralIncluded:false,authoringEntries:409,compiledEntries:Object.keys(entries).length}
 assertClosedClient(output,consumers);return output
}
if(process.argv[1]?.endsWith('compile-content.mjs')){const output=compileContent();fs.mkdirSync('src/controller/content',{recursive:true});const bytes=JSON.stringify(output,null,2)+'\n';fs.writeFileSync('src/controller/content/runtime-content.json',bytes);console.log(JSON.stringify({status:'PASS',compiledEntries:output.compiledEntries,sourceEntries:409,optionalIncluded:false,exactLiteralIncluded:false,sha256:sha(bytes)}))}
