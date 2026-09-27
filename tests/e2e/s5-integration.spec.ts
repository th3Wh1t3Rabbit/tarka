import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {buildFrozenFixture} from '../../src/investigation/fixture'
import {dispatchQuery} from '../../src/investigation/query'
import {createInvestigationState} from '../../src/investigation/state'
import {office,finish,activate,button,ask,resolveCandidateRoute,drainBrowserSpeech,enterTerminalFromWorld} from '../fixtures/s2/browser-helpers'
import { classifyBrowserRequest, forbiddenRequest } from '../fixtures/s2/network-classification'
test.setTimeout(180_000)
const scenario=JSON.parse(readFileSync('public/scenarios/euler-2023-false-exit/scenario.json','utf8')) as Parameters<typeof buildFrozenFixture>[0]
const graph=JSON.parse(readFileSync('public/scenarios/euler-2023-false-exit/evidence-graph.json','utf8')) as Parameters<typeof buildFrozenFixture>[1]
const fixture=buildFrozenFixture(scenario,graph)
const data={scenario,graph,fixture}
test.beforeEach(async({page})=>{
 const origin='http://127.0.0.1:4173'
 await page.context().route('**/*',route=>{const u=new URL(route.request().url());if(forbiddenRequest(u,route.request().method(),origin))return route.abort('blockedbyclient');return route.continue()})
 await page.context().routeWebSocket('**/*',ws=>ws.close())
 await page.goto('/');await expect(page.getByTestId('a0-shell')).toBeVisible();await page.waitForFunction(()=>[...document.images].every(i=>i.complete))
})
test('S5 foreground stays at most three through cyclic paging; exact slot remains unearned',async({page})=>{
 await office(page,'KEYBOARD','DIRECT_SOLVER')
 await activate(page,button(page,'ASK A QUESTION'),'KEYBOARD');await activate(page,button(page,'DISPATCH'),'KEYBOARD')
 const folders=page.locator('.candidate-folder');await expect(folders).toHaveCount(3)
 const first=await folders.locator('h3').allTextContents()
 const expected=dispatchQuery(fixture,createInvestigationState(fixture).query,null).folders
 const pages=Math.ceil(expected.length/3)
 for(let i=1;i<=pages;i++){
  await activate(page,page.getByRole('button',{name:/^SHOW MORE ·/}),'KEYBOARD')
  const rows=expected.slice((i%pages)*3,(i%pages)*3+3)
  await expect(folders).toHaveCount(rows.length)
  expect(await folders.locator('h3').allTextContents()).toEqual(rows.map(row=>row.summary))
  expect(rows.length).toBeLessThanOrEqual(3)
 }
 expect(await folders.locator('h3').allTextContents()).toEqual(first)
 await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-proof-events','0')
 await resolveCandidateRoute(page,fixture,'KEYBOARD')
 await activate(page,button(page,'EXPLORE'),'KEYBOARD')
 const sea=page.getByTestId('semantic-evidence-sea');await expect(sea.locator('article')).toHaveCount(25)
 await sea.getByRole('heading',{level:1}).scrollIntoViewIfNeeded()
 await page.screenshot({path:'artifacts/g6p-s5/SCREENSHOTS/evidence-sea-placeholder.png'})
})
for(const journey of ['DIRECT_SOLVER','CURIOUS_EXPLORER','MISTAKEN_INVESTIGATOR'] as const)test('S5 accepted '+journey+' keyboard: office, sea, exact falsifier, bounded proof and return',async({page})=>{
 const requests:string[]=[];page.on('request',r=>{const url=new URL(r.url());if(classifyBrowserRequest(url,r.method(),'http://127.0.0.1:4173')!=='static')requests.push(r.url())})
 await office(page,'KEYBOARD',journey)
 await expect(page.getByTestId('terminal-viewport')).toHaveAttribute('data-integer-scale','2')
 await expect(page.getByTestId('a0-shell')).toHaveCount(0)
 await ask(page,'KEYBOARD')
 await activate(page,button(page,'DISPATCH'),'KEYBOARD')
 await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section','RESULTS')
 await resolveCandidateRoute(page,fixture,'KEYBOARD')
 await activate(page,button(page,'EXPLORE'),'KEYBOARD')
  const sea=page.getByTestId('semantic-evidence-sea');await expect(sea.locator('article')).toHaveCount(25)
 await sea.getByLabel('Question Lens',{exact:true}).selectOption('ACTIVITY');await expect(sea.getByRole('status')).toContainText('10 of 25')
 await expect(page.getByLabel('Terminal presentation')).toHaveCount(0)
 await sea.getByLabel('Result status',{exact:true}).selectOption('bounded-no-match')
 await activate(page,sea.getByRole('button',{name:'Reset local filters',exact:true}),'KEYBOARD');await expect(sea.locator('article')).toHaveCount(25)
 await activate(page,button(page,'CASE'),'KEYBOARD')
 await finish(page,data as Parameters<typeof finish>[1],'KEYBOARD',journey)
 await expect(page.getByTestId('bounded-case-complete')).toContainText('THE FIRST TRAIL JOINED THE SECOND ROUTE.')
 await activate(page,button(page,'RETURN TO RECORDS OFFICE'),'KEYBOARD')
 await expect(page.getByTestId('speech-panel')).toContainText('Case closed.')
 await drainBrowserSpeech(page,'KEYBOARD')
 await expect(page.getByTestId('hotspot-nansen-terminal')).toBeFocused()
 await enterTerminalFromWorld(page,'KEYBOARD')
 await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-proof-events','1')
 expect(requests).toEqual([])
})
test('S5 CRT exact 2x/4x rectangles align to the accepted frame opening',async({page})=>{
 await page.setViewportSize({width:960,height:540});await office(page,'KEYBOARD','DIRECT_SOLVER')
 await expect(page.getByTestId('terminal-viewport')).toHaveAttribute('data-integer-scale','2')
 const safe=page.getByTestId('terminal-dom-safe');expect(await safe.evaluate(e=>({width:Math.round(e.getBoundingClientRect().width),height:Math.round(e.getBoundingClientRect().height)}))).toEqual({width:790,height:442})
 await page.setViewportSize({width:1920,height:1080});await expect(page.getByTestId('terminal-viewport')).toHaveAttribute('data-integer-scale','4')
 expect(await safe.evaluate(e=>({width:Math.round(e.getBoundingClientRect().width),height:Math.round(e.getBoundingClientRect().height)}))).toEqual({width:1580,height:884})
 await page.screenshot({path:'artifacts/g6p-s5/SCREENSHOTS/terminal-4x.png'})
 await ask(page,'KEYBOARD')
 await activate(page,button(page,'DISPATCH'),'KEYBOARD')
 await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section','RESULTS')
 await resolveCandidateRoute(page,fixture,'KEYBOARD')
 await activate(page,button(page,'EXPLORE'),'KEYBOARD');const sea=page.getByTestId('semantic-evidence-sea');await expect(sea.locator('article')).toHaveCount(25)
 await sea.getByLabel('Search accepted display text').fill('not-in-frozen-corpus-xyz');await expect(sea.locator('article')).toHaveCount(0)
 await activate(page,sea.getByRole('button',{name:'Reset local filters'}),'KEYBOARD');await expect(sea.locator('article')).toHaveCount(25)
 await page.setViewportSize({width:640,height:900});await page.evaluate(()=>{document.body.style.zoom='2'})
 await expect(sea.getByRole('button',{name:'Reset local filters'})).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true)
 await page.screenshot({path:'artifacts/g6p-s5/SCREENSHOTS/plain-200pct-forced.png'})
 await activate(page,page.getByText('ASK THE ARCHIVIST · explanations and recovery',{exact:true}),'KEYBOARD');await activate(page,button(page,'RESET TO CASE START'),'KEYBOARD')
 await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-proof-events','0')
})
