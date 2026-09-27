import {it,expect} from 'vitest'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import compiled from '../../src/controller/content/runtime-content.json'
import {publicSpeaker,ARCHIVIST_SEMANTIC_ID,contentText,officeLines,officeDeadEnd,negativeScopeAccepted,zeroResultCopy,recoveryCopy} from '../../src/controller/content/adapter'
import {PROVISIONAL_OPENING,usefulRules,deadEndResponse,dialogueTopics} from '../../src/adventure/content'
import {RECORDS_OFFICE_NARRATIVE,RECORDS_OFFICE_BEAT_IDS,advanceDialogueInput} from '../../src/adventure/narrative'
import {createInitialAdventureState,adventureReducer} from '../../src/adventure/reducer'
import {buildFrozenFixture} from '../../src/investigation/fixture'
import {createInvestigationState,investigationReducer} from '../../src/investigation/state'
import {dispatchQuery} from '../../src/investigation/query'
import {admitFrozenCorpusCandidate,validateDisplayRecord,displayForMode} from '../../src/investigation/corpus-seam/contracts'
const read=(n:string)=>JSON.parse(fs.readFileSync(n,'utf8')),base='public/scenarios/euler-2023-false-exit/'
const fixture=()=>buildFrozenFixture(read(base+'scenario.json'),read(base+'evidence-graph.json'))
it('maps Arthur only at public display; every internal/art alias remains unchanged',()=>{
 expect(ARCHIVIST_SEMANTIC_ID).toBe('archivist')
 for(const alias of ['archivist','ARCHIVIST','MR_INDEX','mr-index','mrIndex','Mr. Index']){expect(publicSpeaker(alias)).toBe('Arthur');expect(publicSpeaker(alias,true)).toBe('Arthur the Archivist')}
 expect(PROVISIONAL_OPENING[1]?.speaker).toBe('MR_INDEX');expect(usefulRules.find(r=>r.id==='give-form')?.targetId).toBe('mr-index');expect(compiled.alias.runtime_rename_authorized).toBe(false)
})
it('actually consumes accepted mandatory opening and beat copy without changing player-paced effects',()=>{
 expect(PROVISIONAL_OPENING).toHaveLength(8)
 for(let i=0;i<8;i++)expect(PROVISIONAL_OPENING[i]?.text).toBe(compiled.entries[`lane_a.opening.${i+1}` as keyof typeof compiled.entries].text)
 expect(RECORDS_OFFICE_NARRATIVE.map(c=>c.beatId)).toEqual([...RECORDS_OFFICE_BEAT_IDS])
 for(const cue of RECORDS_OFFICE_NARRATIVE){expect(cue.provisionalText).toBe(contentText('lane_a.beat.'+cue.beatId,''));expect(cue.advance).toBe('PLAYER_PACED')}
 const playback={cueIndex:0,visibleCharacters:0,complete:false},revealed=advanceDialogueInput(playback,RECORDS_OFFICE_NARRATIVE)
 expect(revealed.cueIndex).toBe(0);expect(advanceDialogueInput(revealed,RECORDS_OFFICE_NARRATIVE).cueIndex).toBe(1)
})
it('removes all optional Lane A entries without removing mandatory core/method/system copy',()=>{
 expect(Object.values(compiled.entries).some(e=>e.optional)).toBe(false)
 for(const lineClass of ['CORE','METHOD','SYSTEM'])expect(Object.values(compiled.entries).some(e=>e.lineClass===lineClass)).toBe(true)
 expect(contentText('lane_a.banter.mr_a.rook','NO OPTIONAL INSERT')).toBe('NO OPTIONAL INSERT')
 expect(dialogueTopics.find(t=>t.id==='leave')?.closes).toBe(true)
})
it('guarded useful rule consumption preserves phase/item precedence; dead ends cannot advance progress',()=>{
 const state={...createInitialAdventureState({skipIntro:true}),reducedAnimation:true}
 const next=adventureReducer(state,{type:'INTERACT',targetId:'request-dispenser'})
 expect(next.phase).toBe('START')
 const machine=adventureReducer({...state,selectedVerb:'PULL'},{type:'INTERACT',targetId:'request-dispenser'})
 expect(machine.phase).toBe('START');expect(machine.inventory).toEqual([])
 const pulling=adventureReducer({...state,selectedVerb:'PICK_UP'},{type:'INTERACT',targetId:'blank-authorization-form'})
 expect(pulling.phase).toBe('FORM_HELD');expect(pulling.speech?.lines[0]?.text).toBe('Blank authorization form. [PLACEHOLDER — Story binds final copy]')
 expect(deadEndResponse('LOOK_AT','filing-drawers',null)).toBe(contentText('lane_a.dead.look.filing-drawers',''))
 expect(officeDeadEnd('PUSH','filing-drawers',null,'')).toBe('It has seniority.')
 expect(officeLines('lane_a.puzzle.pull-ticket',[{speaker:'ROOK',text:'legacy'}],'COMPLETE')[0]?.text).not.toBe(compiled.entries['lane_a.puzzle.pull-ticket.1'].text)
})
it('bounded no-match, incomplete coverage and forged classification cannot render negative proof',()=>{
 const f=fixture()
 const access=investigationReducer(f,createInvestigationState(f),{type:'EARN_ACCESS'})
 const collected=investigationReducer(f,access,{type:'COLLECT_CASE_FILE'})
 const state={...collected,discoveredRecords:[f.openingRecordId]}
 const cell=f.coverage.find(c=>c.subject===f.records[0]?.destination&&c.lens==='ACTIVITY')!
 const query={questionId:'S4.TEST',lens:'ACTIVITY' as const,filters:[{field:'SUBJECT' as const,value:cell.subject,origin:'PLAYER_FILTER' as const,sourceId:'TEST'},{field:'FROM' as const,value:'2023-03-13T12:00:00Z',origin:'PLAYER_FILTER' as const,sourceId:'TEST'},{field:'TO' as const,value:f.cutoffUtc,origin:'PLAYER_FILTER' as const,sourceId:'TEST'}]}
 const result=dispatchQuery(f,query,null),s={...state,result}
 expect(result.zeroClass).toBe('NO_MATCH_IN_ACCEPTED_CORPUS');expect(negativeScopeAccepted(f,s)).toBe(false)
 expect(zeroResultCopy(f,s)).toContain('not proof that no event occurred')
 result.zeroClass='NEGATIVE_EVIDENCE_SUPPORTED';expect(zeroResultCopy(f,s)).toContain('No absence is established')
 cell.status='COMPLETE';cell.supportsNegative=true;s.result=dispatchQuery(f,query,null)
 expect(negativeScopeAccepted(f,s)).toBe(true);expect(zeroResultCopy(f,s)).toContain('not chain-wide absence')
 s.result.coverageIds=['FABRICATED'];expect(negativeScopeAccepted(f,s)).toBe(false)
})
it('unseen exact authoring copy is absent from client map; wrong theory and proof guards remain central',()=>{
 const f=fixture()
 let s=investigationReducer(f,createInvestigationState(f),{type:'EARN_ACCESS'})
 s=investigationReducer(f,s,{type:'COLLECT_CASE_FILE'})
 s=investigationReducer(f,investigationReducer(f,s,{type:'REVIEW_RECEIPT'}),{type:'DISPATCH',path:'TERMINAL'})
 s=investigationReducer(f,s,{type:'SELECT_RESULT',recordId:f.openingRecordId})
 s=investigationReducer(f,s,{type:'STAGE_CARD',cardId:'CARD.FOLLOW_FORWARD'})
 s=investigationReducer(f,investigationReducer(f,s,{type:'REVIEW_RECEIPT'}),{type:'DISPATCH',path:'TERMINAL'})
 const pair=s.discoveredRecords.filter((id)=>id!==f.openingRecordId).slice(0,2)
 s=investigationReducer(f,s,{type:'COMPARE',recordId:pair[0]!})
 s=investigationReducer(f,s,{type:'COMPARE',recordId:pair[1]!})
 expect(contentText('lane_a.proof.repeat','NOT DISCOVERED')).toBe('NOT DISCOVERED')
 expect(Object.values(compiled.entries).some(e=>e.claimClass==='ACCEPTED_EXACT'||/0x[a-f0-9]{40}/i.test(e.text))).toBe(false)
 const wrong=investigationReducer(f,s,{type:'THEORY',theory:'FIRST_TRAIL_STOPS_AT_FIRST_ENGINE'})
 expect(wrong.workingTheory).toBe('FIRST_TRAIL_STOPS_AT_FIRST_ENGINE');expect(wrong.complete).toBe(false)
 expect(investigationReducer(f,wrong,{type:'ASSEMBLE',slot:'LINK',recordId:f.proof.slots.LINK}).complete).toBe(false)
 expect(f.proof.boundary).toContain('No common human identity')
})
it('recovery uses successful outcomes, not attempted actions; plain text cannot invoke transport',()=>{
 expect(recoveryCopy('Local query saved.')).toBe(compiled.entries['lane_a.recovery.save_query'].text)
 expect(recoveryCopy('Query not dispatched. INVALID_QUERY')).toBe('Query not dispatched. INVALID_QUERY')
 const source=fs.readFileSync('src/controller/content/adapter.ts','utf8');expect(source).not.toMatch(/\b(fetch|XMLHttpRequest|WebSocket)\s*\(|dangerouslySetInnerHTML/)
 expect(source).not.toContain('CPP');expect(source).not.toContain('corpus-seam')
})
it('exact conclusion is recompiled/resealed while history and frozen corpus identities stay intact',async()=>{
 const scenario=read(base+'scenario.json'),crosswalk=read('artifacts/g6p-s4/REPORTS/TRUTH_HASH_CROSSWALK.json')
 expect(scenario.truthConclusion[0]).toBe('THE FIRST TRAIL JOINED THE SECOND ROUTE.')
 expect(crosswalk.graphWorldOmissionsByteIdentical).toBe(true);expect(crosswalk.files.filter((x:{changed:boolean})=>x.changed)).toHaveLength(4)
 for(const x of crosswalk.files)expect(createHash('sha256').update(fs.readFileSync(x.file)).digest('hex')).toBe(x.afterSha256)
 const corpus=read('artifacts/g6p-s3/REPORTS/TE_IFACE_CORPUS_FINAL_CANDIDATE.json'),token=await admitFrozenCorpusCandidate(corpus)
 expect(corpus.interfaceFrozen).toBe(false)
 expect(await validateDisplayRecord(corpus.displayRecords[0],token)).toEqual(corpus.displayRecords[0])
 await expect(Reflect.apply(validateDisplayRecord,null,[corpus.displayRecords[0]])).rejects.toThrow('NOT_ADMITTED')
 expect(await displayForMode(token,'PLAIN_LIST')).toHaveLength(25)
})
