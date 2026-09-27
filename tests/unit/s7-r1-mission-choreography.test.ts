import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {describe,it,expect} from 'vitest'
import {RECORDS_OFFICE_STEPS,TERMINAL_FIRST_RUN,MISSION_INVARIANTS} from '../../src/controller/mission/choreography'
import {usefulRules} from '../../src/adventure/content'
import {adventureReducer,createInitialAdventureState,currentSpeechLine} from '../../src/adventure/reducer'
import {S9_OFFICE_HINTS} from '../../src/controller/content/s9-placeholders'
import type {HotspotId, InventoryItemId, PuzzlePhase, VerbId} from '../../src/adventure/types'
import {investigationHintCopy} from '../../src/controller/content/adapter'
import {buildFrozenFixture} from '../../src/investigation/fixture'
import {createInvestigationState,investigationReducer} from '../../src/investigation/state'
const scenario=JSON.parse(readFileSync('public/scenarios/euler-2023-false-exit/scenario.json','utf8'))
const graph=JSON.parse(readFileSync('public/scenarios/euler-2023-false-exit/evidence-graph.json','utf8'))
const fixture=buildFrozenFixture(scenario,graph)
const sha=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex')
const drain=(state:ReturnType<typeof createInitialAdventureState>)=>{let s=state;for(let i=0;i<30&&s.activeSequence;i++)s=adventureReducer(s,{type:'ADVANCE_SEQUENCE'});for(let i=0;i<20&&s.speech;i++){s=adventureReducer(s,{type:'REVEAL_FULL'});s=adventureReducer(s,{type:'ADVANCE_SPEECH'})}return s}
describe('S7-R1 offline mission choreography',()=>{
 it('binds art-independent steps to hotspot rules and item rules with handover parity',()=>{expect(RECORDS_OFFICE_STEPS).toHaveLength(36);expect(RECORDS_OFFICE_STEPS.filter((s)=>s.target).map(x=>x.id)).toEqual(usefulRules.map(x=>x.id));expect(RECORDS_OFFICE_STEPS.filter((s)=>!s.target&&s.verb).map(x=>x.id).sort()).toEqual(['combine-form-pen','open-toolbox','open-toolbox-open','smash-piggy','use-toolbox','use-toolbox-open']);const give=RECORDS_OFFICE_STEPS.find((s)=>s.id==='give-form')!;expect(give.handoverContact).toBe('CONTACT.FORM_HANDOFF');expect([...give.handoverRemove]).toEqual(['signed-terminal-authorization-form-with-doodles']);expect(give.handoverNextPhase).toBe('FORM_SUBMITTED');expect([...give.addItems]).toEqual(['approved-stamped-terminal-authorization-form']);for(const s of RECORDS_OFFICE_STEPS){expect(s.inputModes).toEqual(['MOUSE_TOUCH','KEYBOARD']);expect(s.fallback).toMatch(/no audio.*timing.*typing.*drag/i);expect(s.recovery).toMatch(/preserves phase and inventory/);expect(JSON.stringify(s)).not.toMatch(/filename|clipId|anchor|coordinate|frameCount|mirroring|objectLayer|geometry/i)}})
 it('all office transitions preserve inventory on wrong action and match contract',()=>{
  const cases:{id:string;verb:VerbId;target:HotspotId;phase:PuzzlePhase;item:InventoryItemId|null;inventory:InventoryItemId[];after:PuzzlePhase|null;removed:InventoryItemId[];added:InventoryItemId[]}[]=[
    {id:'take-form',verb:'PICK_UP',target:'blank-authorization-form',phase:'START',item:null,inventory:[],after:'FORM_HELD',removed:[],added:['blank-terminal-authorization-form']},
    {id:'take-pen',verb:'PICK_UP',target:'pen-stand',phase:'START',item:null,inventory:[],after:'PEN_HELD',removed:[],added:['loose-feather-pen']},
    {id:'take-form-2',verb:'PICK_UP',target:'blank-authorization-form',phase:'PEN_HELD',item:null,inventory:['loose-feather-pen'],after:'FORM_AND_PEN',removed:[],added:['blank-terminal-authorization-form']},
    {id:'take-pen-2',verb:'PICK_UP',target:'pen-stand',phase:'FORM_HELD',item:null,inventory:['blank-terminal-authorization-form'],after:'FORM_AND_PEN',removed:[],added:['loose-feather-pen']},
    {id:'give-form',verb:'GIVE',target:'mr-index',phase:'FORM_COMPLETED',item:'signed-terminal-authorization-form-with-doodles',inventory:['signed-terminal-authorization-form-with-doodles','broken-feather-pen'],after:'COMPLETE',removed:['signed-terminal-authorization-form-with-doodles'],added:['approved-stamped-terminal-authorization-form']},
    {id:'reprimand-start',verb:'USE',target:'nansen-terminal',phase:'START',item:null,inventory:[],after:'START',removed:[],added:[]},
    {id:'reprimand-form-held',verb:'USE',target:'nansen-terminal',phase:'FORM_HELD',item:null,inventory:['blank-terminal-authorization-form'],after:'FORM_HELD',removed:[],added:[]},
    {id:'reprimand-pen-held',verb:'USE',target:'nansen-terminal',phase:'PEN_HELD',item:null,inventory:['loose-feather-pen'],after:'PEN_HELD',removed:[],added:[]},
    {id:'reprimand-form-and-pen',verb:'USE',target:'nansen-terminal',phase:'FORM_AND_PEN',item:null,inventory:['blank-terminal-authorization-form','loose-feather-pen'],after:'FORM_AND_PEN',removed:[],added:[]},
    {id:'reprimand-form-completed',verb:'USE',target:'nansen-terminal',phase:'FORM_COMPLETED',item:null,inventory:['signed-terminal-authorization-form-with-doodles','broken-feather-pen'],after:'FORM_COMPLETED',removed:[],added:[]},
    {id:'reprimand-form-submitted',verb:'USE',target:'nansen-terminal',phase:'FORM_SUBMITTED',item:null,inventory:['broken-feather-pen'],after:'FORM_SUBMITTED',removed:[],added:[]},
    {id:'open-case-drawer',verb:'OPEN',target:'official-case-file-cabinet',phase:'START',item:null,inventory:[],after:null,removed:[],added:[]},
    {id:'look-case-cabinet',verb:'LOOK_AT',target:'official-case-file-cabinet',phase:'START',item:null,inventory:[],after:null,removed:[],added:[]},
    {id:'open-misc-drawer',verb:'OPEN',target:'miscellaneous-drawer-cabinet',phase:'START',item:null,inventory:[],after:null,removed:[],added:[]},
    {id:'look-drawer',verb:'LOOK_AT',target:'miscellaneous-drawer-cabinet',phase:'START',item:null,inventory:[],after:null,removed:[],added:[]},
  ]
  for(const c of cases){
    let state={...createInitialAdventureState({skipIntro:true}),reducedAnimation:true,phase:c.phase,inventory:[...c.inventory]}
    const before=structuredClone(state)
    state=adventureReducer(state,{type:'SELECT_VERB',verb:c.verb})
    if(c.item)state=adventureReducer(state,{type:'SELECT_ITEM',itemId:c.item})
    state=adventureReducer(state,{type:'INTERACT',targetId:'historical-clock'})
    expect(state.phase).toBe(before.phase);expect(state.inventory).toEqual(before.inventory)
    state=drain(state)
    state=adventureReducer(state,{type:'SELECT_VERB',verb:c.verb})
    if(c.item)state=adventureReducer(state,{type:'SELECT_ITEM',itemId:c.item})
    state=adventureReducer(state,{type:'INTERACT',targetId:c.target})
    state=drain(state)
    expect(state.phase).toBe(c.after??c.phase)
    for(const id of c.removed)expect(state.inventory.includes(id)).toBe(false)
    for(const id of c.added)expect(state.inventory).toContain(id)
  }
  const complete={...createInitialAdventureState({skipIntro:true}),reducedAnimation:true,phase:'COMPLETE' as PuzzlePhase,inventory:['broken-feather-pen','approved-stamped-terminal-authorization-form'] as InventoryItemId[]}
  let tail=adventureReducer(complete,{type:'SELECT_VERB',verb:'LOOK_AT'})
  tail=adventureReducer(tail,{type:'INTERACT',targetId:'nansen-terminal'})
  tail=drain(tail)
  expect(tail.phase).toBe('COMPLETE');expect(tail.inventory).toEqual(complete.inventory);expect(tail.archivedEvidenceIds).toEqual([])
})
 it('accepted puzzle hints resolve through the office reducer for every phase and tier',()=>{for(const phase of ['START','FORM_HELD','PEN_HELD','FORM_AND_PEN','FORM_COMPLETED','FORM_SUBMITTED','COMPLETE'] as const)for(const tier of ['METHOD_HINT','CASE_HINT','DIRECT_HINT'] as const){const text=S9_OFFICE_HINTS[phase][tier].text;expect(text).not.toMatch(/TODO|PROVISIONAL/);const hinted=adventureReducer({...createInitialAdventureState({skipIntro:true}),phase},{type:'REQUEST_HINT',tier});expect(currentSpeechLine(hinted)?.text).toBe(text)}})
 it('investigation hint tiers adapt without leaking undiscovered values',()=>{let state=investigationReducer(fixture,createInvestigationState(fixture),{type:'EARN_ACCESS'});const sensitive=fixture.records.flatMap(r=>[r.transactionHash,r.source,r.destination,r.observedAtUtc,...r.assetAmounts.map(a=>a.amount)]);for(const tier of ['METHOD_HINT','CASE_HINT','DIRECT_HINT'] as const){const text=investigationHintCopy(state,tier);expect(text).not.toMatch(/TODO|PROVISIONAL/);expect(sensitive.some(value=>text.includes(value))).toBe(false)}state={...state,result:{query:state.query,recordIds:[fixture.openingRecordId],folders:[{id:'FOLDER.TEST',recordId:fixture.openingRecordId,summary:'test',whyMatched:[],grade:'EXACT',status:'UNTESTED',maySupport:'test',cannotProve:'test',nextQuestionIds:[],sortReason:'test'}],zeroClass:null,coverageIds:[],delta:{previousCount:0,newCount:1,includedReason:'test',excluded:[]}}};expect(investigationHintCopy(state,'DIRECT_HINT')).toMatch(/Exact Receipt/);state={...state,exactEventIds:['EXACT.'+fixture.proof.slots.LINK],exactConvergenceVerified:true};expect(investigationHintCopy(state,'DIRECT_HINT')).toMatch(/proof slots/)})
 it('terminal rhythm is bounded and truth remains exact',()=>{const corpus=JSON.parse(readFileSync('artifacts/g6p-s3/REPORTS/TE_IFACE_CORPUS_FINAL_CANDIDATE.json','utf8'));expect(TERMINAL_FIRST_RUN).toHaveLength(8);expect(TERMINAL_FIRST_RUN.filter(x=>x.mandatoryDispatch)).toHaveLength(2);expect(MISSION_INVARIANTS.maxMandatoryFirstRunDispatches).toBe(3);expect(MISSION_INVARIANTS.conclusion).toBe(fixture.proof.conclusion);expect(MISSION_INVARIANTS.firstExactTurningPointUtc).toBe(fixture.proof.linkTimeUtc);expect(corpus.conceptCount).toBe(25);expect(corpus.displayRecords).toHaveLength(25);expect(fixture.records).toHaveLength(6);expect(fixture.proof.slots).toEqual({AMOUNT:fixture.openingRecordId,RECEIVER:fixture.secondRecordId,LINK:fixture.proof.slots.LINK})})
 it('frozen accepted sources and compiled74-key map remain byte-bound',()=>{expect(sha('src/controller/content/runtime-content.json')).toBe('57f27ecfef64f9c149f2f80bdb1efffbc629d79fd5f6a76e21c0e943c5c95bfc');expect(sha('artifacts/g6p-s5/REPORTS/MVP_BLUEPRINT.json')).toBe('397660b78184a697e21925220287fc1087f742d7f0cef572d0dc040f1f46587a');expect(JSON.parse(readFileSync('src/controller/content/runtime-content.json','utf8')).entries).toHaveProperty('lane_a.hint.unavailable')})
})
