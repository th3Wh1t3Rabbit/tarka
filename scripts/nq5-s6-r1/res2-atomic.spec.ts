import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {buildFrozenFixture,syntheticFixture} from '../../src/investigation/fixture'
import {createInvestigationState,investigationReducer,exportLocalSave,fixtureOrigin,restoreInvestigation,type Command} from '../../src/investigation/state'
import type {CaseFixture} from '../../src/investigation/contracts'
import {office} from '../../tests/fixtures/s2/browser-helpers'
const scenario=JSON.parse(readFileSync('public/scenarios/euler-2023-false-exit/scenario.json','utf8')) as Parameters<typeof buildFrozenFixture>[0],graph=JSON.parse(readFileSync('public/scenarios/euler-2023-false-exit/evidence-graph.json','utf8')) as Parameters<typeof buildFrozenFixture>[1]
const hero=buildFrozenFixture(scenario,graph),synthetic=syntheticFixture(hero)
function solve(f:CaseFixture){let s=createInvestigationState(f);const commands:Command[]=[{type:'EARN_ACCESS'},{type:'STAGE_CARD',cardId:'CARD.WHAT_LEFT'},{type:'REVIEW_RECEIPT'},{type:'DISPATCH',path:'TERMINAL'},{type:'SELECT_RESULT',recordId:f.proof.slots.LINK},{type:'STAGE_CARD',cardId:'CARD.EXACT_RECEIPT'},{type:'REVIEW_RECEIPT'},{type:'DISPATCH',path:'TERMINAL'},{type:'READ_BRANCH',branch:'SECOND'},...(['AMOUNT','RECEIVER','LINK'] as const).map(slot=>({type:'ASSEMBLE' as const,slot,recordId:f.proof.slots[slot]}))];for(const c of commands)s=investigationReducer(f,s,c);expect(s.complete).toBe(true);return s}
for(const kind of ['generic-relabel','complete-relabel','mixed-foreign','unknown-after-proof','open-history','Hero-positive','synthetic-positive'] as const)test('RES2 browser atomic persistence '+kind,async({page})=>{
 const target=kind==='synthetic-positive'?synthetic:hero,source=kind.includes('relabel')?synthetic:target
 const state=kind==='generic-relabel'?investigationReducer(source,createInvestigationState(source),{type:'EARN_ACCESS'}):solve(source)
 const save=JSON.parse(exportLocalSave(state))
 Object.assign(save,{fixtureId:target.id,fixtureMode:target.mode,fixtureOrigin:fixtureOrigin(target)})
 if(kind==='mixed-foreign')save.commands.entries=[{type:'EARN_ACCESS'},{type:'SECTION',section:'EXPLORE'},{type:'SELECT_RESULT',recordId:synthetic.proof.slots.LINK}]
 if(kind==='unknown-after-proof')save.commands.entries.push({type:'UNKNOWN'})
 if(kind==='open-history')save.commands.extra={filename:'FOREIGN'}
 const positive=kind.endsWith('positive')
 if(!positive)expect(restoreInvestigation(target,JSON.stringify(save))).toEqual(createInvestigationState(target))
 const key='trace-case-v1:'+target.id+':'+target.records.map(r=>r.provenance.normalizedSha256).join(':')
 await page.context().route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:4283'||route.request().method()!=='GET'||!(u.pathname==='/'||/^\/(assets|art-packs|scenarios)\//.test(u.pathname)))return route.abort('blockedbyclient');return route.continue()})
 await page.context().routeWebSocket('**/*',ws=>ws.close())
 await page.addInitScript(({key,save})=>localStorage.setItem(key,save),{key,save:JSON.stringify(save)})
 await page.goto(target.mode==='SYNTHETIC_TEST'?'/?review=1&caseFixture=synthetic':'/?skipIntro=1')
 await expect(page.getByTestId('a0-shell')).toBeVisible();await page.waitForFunction(()=>[...document.images].every(i=>i.complete));await office(page,'KEYBOARD','DIRECT_SOLVER')
 const expected=investigationReducer(target,positive?state:investigationReducer(target,createInvestigationState(target),{type:'EARN_ACCESS'}),{type:'SECTION',section:'CASE'})
 await expect.poll(async()=>page.evaluate(key=>localStorage.getItem(key),key)).toBe(exportLocalSave(expected))
 expect(restoreInvestigation(target,(await page.evaluate(key=>localStorage.getItem(key),key))!)).toEqual(expected)
 await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-proof-events',positive?'1':'0')
 if(positive)await expect(page.getByTestId('bounded-case-complete')).toContainText(target.proof.conclusion)
 else await expect(page.getByTestId('bounded-case-complete')).toHaveCount(0)
})
