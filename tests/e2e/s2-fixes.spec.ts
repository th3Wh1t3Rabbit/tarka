import {expect,test} from '@playwright/test'
import {reachSourceByKeyboard} from '../fixtures/s2/keyboard-source-copy'
import {activate,selectMode,tabTo} from '../fixtures/s2/browser-helpers'
const modes=['FULLSCREEN_CRT','DOCKED_OVERLAY','PLAIN_LIST']
test('B-F02 nine exact clipboard checks use native Tab/Enter, shared feedback and predictable focus',async({page})=>{
 const data=await reachSourceByKeyboard(page),record=data.fixture.records.find(r=>r.id===data.fixture.openingRecordId)!,values=[['Full transaction hash',record.transactionHash],['Source address',record.source],['Destination address',record.destination]],results=[]
 for(const mode of modes){
  await activate(page,page.getByText('Presentation and accessibility',{exact:true}),'KEYBOARD');await selectMode(page,mode,'KEYBOARD');await activate(page,page.getByText('Presentation and accessibility',{exact:true}),'KEYBOARD')
  for(const[label,value]of values){
   const field=page.locator('dl div').filter({has:page.locator('dt').getByText(label!,{exact:true})}),copy=field.getByRole('button',{name:'Copy '+label,exact:true})
   await expect(field.locator('.exact-identifier')).toHaveText(value!);await tabTo(page,copy);await page.keyboard.press('Enter')
   await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe(value);await expect(field.getByRole('status')).toContainText('Copied');await expect(field.getByRole('status')).toHaveAttribute('aria-live','polite');await expect(copy).toBeFocused()
   await expect(page.getByTestId('case-terminal')).toHaveClass(new RegExp('mode-'+mode.toLowerCase()));results.push({mode,label,exactClipboard:true,keyboardOnly:true,politeFeedback:true,focusPreserved:true})
  }
 }
 expect(results).toHaveLength(9);expect(data.requests.filter(r=>r.forbidden)).toEqual([]);console.log(JSON.stringify({test:'B-F02',phase:'POST_FIX',results,externalRequests:0,actualAssistiveTechnologyExecuted:false}))
})
test('B-F02 clipboard failure preserves full selectable value and keyboard recovery in all modes',async({page})=>{
 const data=await reachSourceByKeyboard(page),record=data.fixture.records.find(r=>r.id===data.fixture.openingRecordId)!
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('SYNTHETIC_DENIED')}}})})
 for(const mode of modes){
  await activate(page,page.getByText('Presentation and accessibility',{exact:true}),'KEYBOARD');await selectMode(page,mode,'KEYBOARD');await activate(page,page.getByText('Presentation and accessibility',{exact:true}),'KEYBOARD')
  const field=page.locator('dl div').filter({has:page.locator('dt').getByText('Full transaction hash',{exact:true})}),copy=field.getByRole('button',{name:'Copy Full transaction hash',exact:true})
  await activate(page,copy,'KEYBOARD');await expect(copy).toBeFocused();await expect(field.getByRole('status')).toContainText('Could not copy');await expect(field.locator('.exact-identifier')).toHaveText(record.transactionHash)
  const summary=field.getByText('Selectable exact full transaction hash',{exact:true});if(!await summary.evaluate(e=>e.parentElement!.hasAttribute('open')))await activate(page,summary,'KEYBOARD');const fallback=field.getByRole('textbox',{name:'Selectable exact full transaction hash',exact:true});await tabTo(page,fallback);await expect(fallback).toHaveValue(record.transactionHash);await expect(fallback).toHaveAttribute('readonly','')
  expect(await fallback.evaluate(e=>(e as HTMLInputElement).selectionEnd!-(e as HTMLInputElement).selectionStart!)).toBe(record.transactionHash.length)
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section','SOURCE')
 }
 expect(data.requests.filter(r=>r.forbidden)).toEqual([])
})
test('B-F01 invalid dispatch feedback is accessible, preserves every chip, and recovers without hidden filters',async({page})=>{
 const data=await reachSourceByKeyboard(page)
 await activate(page,page.getByRole('button',{name:'BACK TO CASE',exact:true}),'KEYBOARD')
 await activate(page,page.getByRole('button',{name:'ASK A QUESTION',exact:true}),'KEYBOARD')
 await activate(page,page.getByText('All discovered Question Cards and four lenses',{exact:true}),'KEYBOARD')
 await activate(page,page.getByRole('button',{name:'ACTIVITY: SHOW HIGH-VALUE ACTIVITY',exact:true}),'KEYBOARD')
 const receipt=page.getByLabel('Query Receipt'),asset=receipt.getByRole('button',{name:/Remove ASSET filter/});await activate(page,asset,'KEYBOARD')
 const before=await receipt.locator('ul').innerText();await expect(receipt.getByRole('alert')).toContainText('exactly one distinct ASSET')
 await activate(page,page.getByRole('button',{name:'DISPATCH',exact:true}),'KEYBOARD');await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section','CASE');await expect(receipt.locator('ul')).toHaveText(before,{useInnerText:true})
 await expect(page.getByRole('alert').filter({hasText:'exactly one distinct ASSET'})).toHaveCount(2)
 await activate(page,receipt.getByRole('button',{name:/Remove MIN_AMOUNT filter/}),'KEYBOARD');await expect(receipt.getByRole('alert')).toHaveCount(0)
 await activate(page,page.getByRole('button',{name:'DISPATCH',exact:true}),'KEYBOARD');await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section','RESULTS');expect(data.requests.filter(r=>r.forbidden)).toEqual([])
})
