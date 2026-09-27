import {it,expect} from 'vitest'
import fs from 'node:fs'
import {buildCommandSentence} from '../../src/adventure/sentence'
import {createInitialAdventureState} from '../../src/adventure/reducer'
import {publicObjectName,publicSpeaker,officeDeadEnd} from '../../src/controller/content/adapter'
import {hotspots} from '../../src/adventure/scenes'
import type {VerbId} from '../../src/adventure/types'
// Build-only modules are dynamically imported in Node tests, not production.
const {consumerManifest,assertClosedClient}=await import('../../scripts/nq5-s4-r1/consumers.mjs')
const {compileContent,compileEntries}=await import('../../scripts/nq5-s4/compile-content.mjs')
const read=(n:string)=>JSON.parse(fs.readFileSync(n,'utf8')),map=compileContent(),manifest=consumerManifest(map.dead)
it('every public command object form uses Arthur over unchanged legacy source and target IDs',()=>{
 const state={...createInitialAdventureState({skipIntro:true}),hoveredHotspotId:'mr-index' as const}
 expect(hotspots.find(h=>h.id==='mr-index')?.name).toBe('Mr. Index')
 expect(buildCommandSentence(state)).toBe('Walk to Arthur')
 expect(buildCommandSentence({...state,selectedVerb:'TALK_TO'})).toBe('Talk to Arthur')
 expect(buildCommandSentence({...state,selectedVerb:'GIVE',selectedItemId:'signed-terminal-authorization-form-with-doodles'})).toBe('Give signed form with doodles to Arthur')
 expect(buildCommandSentence({...state,selectedVerb:'USE',selectedItemId:'signed-terminal-authorization-form-with-doodles'})).toBe('Use signed form with doodles with Arthur')
 for(const verb of ['GIVE','PICK_UP','USE','OPEN','LOOK_AT','PUSH','CLOSE','TALK_TO','PULL'] as VerbId[])expect(buildCommandSentence({...state,selectedVerb:verb})).toContain('Arthur')
 expect(publicObjectName({id:'mr-index',name:'Mr. Index'},true)).toBe('Arthur the Archivist')
 expect(publicObjectName({id:'pen-stand',name:'pen stand'})).toBe('pen stand')
 for(const id of ['archivist','MR_INDEX','mr-index','mrIndex'])expect(publicSpeaker(id)).toBe('Arthur')
 expect(officeDeadEnd('PULL','mr-index',null,'fallback')).not.toContain('Mr. Index')
})
it('client JSON is exactly consumer-bound and excludes accepted theory plus deferred/exact/optional content',()=>{
 expect(assertClosedClient(map,manifest)).toBe(true);expect(Object.keys(map.entries).sort()).toEqual(Object.keys(manifest).sort())
 expect(map.compiledEntries).toBe(74);expect(map.entries).not.toHaveProperty('lane_a.theory.accepted')
 expect(JSON.stringify(map)).not.toMatch(/IT JOINED THE SECOND ROUTE|THE FIRST TRAIL JOINED THE SECOND ROUTE|0x[a-f0-9]{40}/i)
 expect(map.dead).not.toHaveProperty('archetypes');expect(map.dead).not.toHaveProperty('repeat_keys')
 expect(read('src/controller/content/runtime-content.json')).toEqual(map)
})
it('missing mandatory consumer keys cannot silently fallback and injected client keys cannot pass',()=>{
 const source=read('content/parallel/narrative/COPY_CATALOG.json'),key='lane_a.opening.1'
 source.entries=source.entries.filter((e:{key:string})=>e.key!==key)
 expect(()=>compileEntries(source,manifest)).toThrow('MISSING_REQUIRED_CONSUMER_KEY_'+key)
 const missing=structuredClone(map);delete missing.entries[key];expect(()=>assertClosedClient(missing,manifest)).toThrow('CLIENT_CONSUMER_KEY_SET')
 const injected=structuredClone(map);injected.entries['lane_a.theory.accepted']=map.entries[key]!;expect(()=>assertClosedClient(injected,manifest)).toThrow('CLIENT_CONSUMER_KEY_SET')
 const answer=structuredClone(map);answer.entries[key]!.text='IT JOINED THE SECOND ROUTE';expect(()=>assertClosedClient(answer,manifest)).toThrow('CLIENT_EXACT_OR_ANSWER_TEXT')
 source.entries=read('content/parallel/narrative/COPY_CATALOG.json').entries;source.entries.find((e:{key:string})=>e.key===key).optional=true
 expect(()=>compileEntries(source,manifest)).toThrow('INELIGIBLE_REQUIRED_CONSUMER_KEY_'+key)
})
