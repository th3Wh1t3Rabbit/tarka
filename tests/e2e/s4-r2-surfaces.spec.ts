import {expect,test,type Page} from '@playwright/test'
import {setup,office,activate,tabTo,button} from '../fixtures/s2/browser-helpers'
import {RECORDS_OFFICE_NARRATIVE} from '../../src/adventure/narrative'
async function noLeak(page:Page){
 for(const text of [await page.locator('body').innerText(),await page.locator('body').ariaSnapshot()]){
  expect(text).not.toMatch(/Mr\. ?Index/)
  expect(text).not.toMatch(/public name\/art unbound|(?:^|\n)\s*(?:- img ")?archivist[^\n"]*provisional animation/i)
  // Only the explicitly qualified internal-ID heading and grammatical role phrases are allowed.
  expect(text.replaceAll('ARCHIVIST // INTERNAL ID','INTERNAL ID')).not.toMatch(/^\s*(?:- (?:strong|text): )?["']?ARCHIVIST["']?\s*$/m)
 }
 for(const alt of await page.locator('img').evaluateAll(images=>images.map(image=>image.getAttribute('alt')??'')))expect(alt).not.toMatch(/^(?:archivist|Mr\.?\s*Index)\b/i)
}
test('S4-R2 ordinary Terminal performance has binding Arthur name; legacy save and reducer IDs survive',async({page})=>{
 const data=await setup(page,81);data.freeze()
 await office(page,'KEYBOARD','DIRECT_SOLVER')
 // office() verifies every original phase and inventory ID before opening Terminal.
 await expect(page.getByTestId('case-terminal')).toBeVisible()
 await activate(page,page.getByText('Optional acting and prop cues — deterministic text fallback',{exact:true}),'KEYBOARD')
 const portrait=page.getByTestId('performance-archivist')
 await expect(portrait.getByRole('img',{name:'Arthur the Archivist placeholder performance',exact:true})).toBeVisible()
 await expect(portrait).toHaveAttribute('data-resolved-clip',/^demo\.archivist\./)
 await expect(portrait).toContainText('production art late-bound')
 await expect(portrait.getByRole('img')).toHaveAttribute('src',/^\/art-packs\/placeholder\//)
 const saves=await page.evaluate(()=>Object.values(localStorage).map(v=>{try{return JSON.parse(v)}catch{return null}}).filter(Boolean))
 expect(JSON.stringify(saves)).not.toContain('Arthur')
 await noLeak(page);expect(data.requests.filter(r=>r.forbidden)).toEqual([])
})
test('S4-R2 Art Lab preview and every performance intention map Arthur with unchanged art keys',async({page})=>{
 const data=await setup(page,82);await page.goto('/?artLab=1')
 await expect(page.getByTestId('art-lab')).toBeVisible();await page.waitForFunction(()=>[...document.images].every(i=>i.complete));data.freeze()
 await expect(page.getByRole('heading',{name:'ARCHIVIST // INTERNAL ID',exact:true})).toBeVisible()
 const preview=page.getByRole('img',{name:'Arthur the Archivist animation preview',exact:true})
 await expect(preview).toHaveAttribute('src',/^\/art-packs\/placeholder\//)
 const selector=page.getByLabel('Performance intention'),portrait=page.getByTestId('performance-archivist')
 await tabTo(page,selector);await page.keyboard.press('Home')
 const intentions=await selector.locator('option').allTextContents()
 for(let i=0;i<intentions.length;i++){
  if(i)await page.keyboard.press('ArrowDown')
  await expect(selector).toHaveValue(intentions[i]!)
  await expect(portrait).toHaveAttribute('data-resolved-clip',new RegExp('^demo\\.archivist\\.'+intentions[i]+'$'))
  await expect(portrait.getByRole('img',{name:'Arthur the Archivist placeholder performance',exact:true})).toBeVisible()
  await noLeak(page)
 }
 expect(data.requests.filter(r=>r.forbidden)).toEqual([])
})
test('S4-R2 Mission Harness maps all archivist speakers and full/reduced semantic alts without changing cues',async({page})=>{
 const data=await setup(page,83);await page.goto('/?mission=1')
 const harness=page.getByTestId('euler-mission-harness'),dialogue=page.getByTestId('mission-dialogue')
 await expect(harness).toBeVisible();await page.waitForFunction(()=>[...document.images].every(i=>i.complete));data.freeze()
 for(const reduced of [true,false]){
  await activate(page,button(page,reduced?'MOTION FULL':'MOTION REDUCED'),'KEYBOARD')
  await expect(dialogue.locator('strong')).toHaveText('Arthur')
  await expect(harness.locator('.semantic-cue-figure').getByRole('img',{name:/^Arthur the Archivist .* provisional animation$/})).toBeVisible()
  await expect(harness.locator('.semantic-cue-figure')).toHaveAttribute('data-semantic-id',RECORDS_OFFICE_NARRATIVE[0]!.animationId)
  await noLeak(page)
 }
 for(const cue of RECORDS_OFFICE_NARRATIVE){
  await expect(dialogue.locator('strong')).toHaveText(cue.speaker==='ARCHIVIST'?'Arthur':'Rook')
  await expect(dialogue).toHaveAttribute('data-animation-id',cue.animationId)
  const figure=harness.locator('.semantic-cue-figure')
  await expect(figure).toHaveAttribute('data-semantic-id',cue.animationId)
  await expect(figure.getByRole('img').first()).toHaveAttribute('alt',new RegExp('^'+(cue.speaker==='ARCHIVIST'?'Arthur the Archivist':'Rook')+' '))
  await expect(figure.getByRole('img').first()).toHaveAttribute('src',/^\/art-packs\/placeholder\//)
  await noLeak(page)
  await activate(page,dialogue,'KEYBOARD');await expect(dialogue.locator('span')).toHaveText(cue.provisionalText)
  await activate(page,dialogue,'KEYBOARD')
 }
 await expect(harness).toHaveAttribute('data-stage','FIRST_RECORD')
 expect(data.requests.filter(r=>r.forbidden)).toEqual([])
})
