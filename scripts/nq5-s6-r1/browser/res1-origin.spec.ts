import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {buildFrozenFixture,syntheticFixture} from '../../../src/investigation/fixture'
import {createInvestigationState,investigationReducer,exportLocalSave,fixtureOrigin,type Command} from '../../../src/investigation/state'
import type {CaseFixture} from '../../../src/investigation/contracts'
import {office} from '../../../tests/fixtures/s2/browser-helpers'
const scenario=JSON.parse(readFileSync('public/scenarios/euler-2023-false-exit/scenario.json','utf8')) as Parameters<typeof buildFrozenFixture>[0],graph=JSON.parse(readFileSync('public/scenarios/euler-2023-false-exit/evidence-graph.json','utf8')) as Parameters<typeof buildFrozenFixture>[1]
const hero=buildFrozenFixture(scenario,graph),synthetic=syntheticFixture(hero)
function solve(f:CaseFixture){let s=createInvestigationState(f);const commands:Command[]=[{type:'EARN_ACCESS'},{type:'STAGE_CARD',cardId:'CARD.WHAT_LEFT'},{type:'REVIEW_RECEIPT'},{type:'DISPATCH',path:'TERMINAL'},{type:'SELECT_RESULT',recordId:f.proof.slots.LINK},{type:'STAGE_CARD',cardId:'CARD.EXACT_RECEIPT'},{type:'REVIEW_RECEIPT'},{type:'DISPATCH',path:'TERMINAL'},{type:'READ_BRANCH',branch:'SECOND'},...(['AMOUNT','RECEIVER','LINK'] as const).map(slot=>({type:'ASSEMBLE' as const,slot,recordId:f.proof.slots[slot]}))];for(const c of commands)s=investigationReducer(f,s,c);expect(s.complete).toBe(true);return s}
for(const kind of ['synthetic-ID-mode-relabel','synthetic-all-origin-relabel','Hero-valid-save','Hero-ID-mode-relabel-to-synthetic'] as const)test('RES1 browser persistence '+kind,async({page})=>{
 const target=kind==='Hero-ID-mode-relabel-to-synthetic'?synthetic:hero,foreign=kind.startsWith('synthetic')?synthetic:hero,save=JSON.parse(exportLocalSave(solve(foreign)))
 save.fixtureId=target.id;save.fixtureMode=target.mode;if(kind==='synthetic-all-origin-relabel')save.fixtureOrigin=fixtureOrigin(target)
 const key=`trace-case-v1:${target.id}:${target.records.map(r=>r.provenance.normalizedSha256).join(':')}`
 await page.context().route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:4283'||route.request().method()!=='GET'||!(u.pathname==='/'||/^\/(assets|art-packs|scenarios)\//.test(u.pathname)))return route.abort('blockedbyclient');return route.continue()})
 await page.context().routeWebSocket('**/*',ws=>ws.close())
 await page.addInitScript(({key,save})=>localStorage.setItem(key,save),{key,save:JSON.stringify(save)})
 await page.goto(target.mode==='SYNTHETIC_TEST'?'/?review=1&caseFixture=synthetic':'/?skipIntro=1')
 await expect(page.getByTestId('a0-shell')).toBeVisible();await page.waitForFunction(()=>[...document.images].every(i=>i.complete))
 await office(page,'KEYBOARD','DIRECT_SOLVER')
 if(kind==='Hero-valid-save'){
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-proof-events','1');await expect(page.getByTestId('bounded-case-complete')).toContainText(hero.proof.conclusion)
  await page.reload();await expect(page.getByTestId('a0-shell')).toBeVisible();await office(page,'KEYBOARD','DIRECT_SOLVER');await expect(page.getByTestId('bounded-case-complete')).toContainText(hero.proof.conclusion)
 }else{
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-proof-events','0');await expect(page.getByTestId('bounded-case-complete')).toHaveCount(0)
 }
 const persisted=JSON.parse((await page.evaluate(key=>localStorage.getItem(key),key))!);expect(persisted.fixtureId).toBe(target.id);expect(persisted.fixtureMode).toBe(target.mode);expect(persisted.fixtureOrigin).toBe(fixtureOrigin(target))
})
