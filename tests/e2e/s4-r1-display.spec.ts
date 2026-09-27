import {expect,test} from '@playwright/test'
import {setup,activate,tabTo,drainBrowserSpeech,button} from '../fixtures/s2/browser-helpers'
async function ready(page:import('@playwright/test').Page){
 const data=await setup(page,71);data.freeze()
 await activate(page,button(page,'TEXT PACED'),'KEYBOARD')

 await page.keyboard.press('Space')
 await expect(page.getByTestId('speech-panel')).toHaveAttribute('data-speaker','MR_INDEX')
 await expect(page.getByTestId('speech-panel').locator('strong')).toHaveText('Arthur')
 await drainBrowserSpeech(page,'KEYBOARD');return data
}
async function noLegacy(page:import('@playwright/test').Page){
 expect(await page.locator('body').innerText()).not.toContain('Mr. Index')
 expect(await page.locator('body').ariaSnapshot()).not.toContain('Mr. Index')
}
test('S4-R1 native hover/focus commands and character accessibility all map Arthur without alias rename',async({page})=>{
 const data=await ready(page),target=page.getByTestId('hotspot-mr-index'),sentence=page.getByTestId('command-sentence')
 await page.keyboard.press('Escape');await target.hover();await expect(sentence).toHaveText('Walk to Arthur')
 await page.getByTestId('hotspot-pen-stand').hover();await tabTo(page,target);await expect(sentence).toHaveText('Walk to Arthur')
 await expect(target).toHaveAttribute('aria-label',/Arthur/)
 await expect(page.getByTestId('mr-index-animation').getByRole('img',{name:'Arthur the Archivist character',exact:true})).toHaveAttribute('alt','Arthur the Archivist character')
 for(const [verb,text]of [['talk-to','Talk to Arthur'],['look-at','Look at Arthur'],['open','Open Arthur'],['use','Use Arthur'],['give','Give Arthur']] as const){
  await activate(page,page.getByTestId('verb-'+verb),'KEYBOARD');await tabTo(page,target);await expect(sentence).toHaveText(text)
 }
 await activate(page,page.getByTestId('verb-talk-to'),'KEYBOARD');await activate(page,target,'KEYBOARD')
 await expect(page.getByRole('dialog')).toHaveAccessibleName('TALK TO Arthur the Archivist')
 await noLegacy(page);await activate(page,page.getByTestId('dialogue-leave'),'KEYBOARD')
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase','START')
 expect(data.requests.filter(r=>r.forbidden)).toEqual([])
})
test('S4-R1 native GIVE and USE preserve signed form and mr-index reducer identities',async({page})=>{
 const data=await ready(page)
 await activate(page,page.getByTestId('verb-pull'),'KEYBOARD');await activate(page,page.getByTestId('hotspot-request-dispenser'),'KEYBOARD');await drainBrowserSpeech(page,'KEYBOARD')
 await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase','FORM_HELD')
 await activate(page,page.getByTestId('verb-pick-up'),'KEYBOARD');await activate(page,page.getByTestId('hotspot-pen-stand'),'KEYBOARD');await drainBrowserSpeech(page,'KEYBOARD')
 await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase','FORM_AND_PEN')
 await activate(page,page.getByTestId('verb-use'),'KEYBOARD');await activate(page,page.getByTestId('inventory-blank-terminal-authorization-form'),'KEYBOARD');await activate(page,page.getByTestId('inventory-loose-feather-pen'),'KEYBOARD');await drainBrowserSpeech(page,'KEYBOARD')
 await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase','FORM_COMPLETED')
 for(const [verb,text]of [['use','Use signed form with doodles with Arthur'],['give','Give signed form with doodles to Arthur']] as const){
  await activate(page,page.getByTestId('verb-'+verb),'KEYBOARD');await activate(page,page.getByTestId('inventory-signed-terminal-authorization-form-with-doodles'),'KEYBOARD');await tabTo(page,page.getByTestId('hotspot-mr-index'));await expect(page.getByTestId('command-sentence')).toHaveText(text);await noLegacy(page)
 }
 await activate(page,page.getByTestId('hotspot-mr-index'),'KEYBOARD');await drainBrowserSpeech(page,'KEYBOARD')
 await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase','COMPLETE');await expect(page.getByTestId('inventory-approved-stamped-terminal-authorization-form')).toHaveCount(1)
 expect(data.requests.filter(r=>r.forbidden)).toEqual([])
})
test('S4-R1 Art Lab states binding Arthur public name without touching art keys or paths',async({page})=>{
 const data=await setup(page,73);await page.goto('/?artLab=1');await expect(page.getByTestId('art-lab')).toBeVisible();data.freeze()
 await expect(page.getByTestId('art-lab')).toContainText('Arthur the Archivist — binding public name; internal/art IDs unchanged')
 await expect(page.getByTestId('art-lab')).not.toContainText('Public-facing name remains Lead-owned')
 await noLegacy(page);expect(data.requests.filter(r=>r.forbidden)).toEqual([])
})
