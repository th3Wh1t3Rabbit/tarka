import { expect, type Page } from '@playwright/test'
import { activate, ask, button, office, selectMode, setup } from './browser-helpers'

export async function reachSourceByKeyboard(page: Page) {
  const data = await setup(page,19)
  data.freeze()
  await office(page,'KEYBOARD','DIRECT_SOLVER')
  await ask(page,'KEYBOARD')
  await activate(page,button(page,'DISPATCH'),'KEYBOARD')
  await activate(page,page.locator('.candidate-folder').first().getByRole('button',{name:'SOURCE FOR THIS RESULT',exact:true}),'KEYBOARD')
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section','SOURCE')
  await page.context().grantPermissions(['clipboard-read','clipboard-write'])
  return data
}

/** Read-only inspection accompanies native keys; this never constructs selection or sets focus. */
export async function attemptKeyboardSourceCopy(page: Page, data: Awaited<ReturnType<typeof setup>>, mode: string) {
  await activate(page,page.getByText('Presentation and accessibility',{exact:true}),'KEYBOARD')
  await selectMode(page,mode,'KEYBOARD')
  await activate(page,page.getByText('Presentation and accessibility',{exact:true}),'KEYBOARD')
  const record=data.fixture.records.find((r)=>r.id===data.fixture.openingRecordId)!
  const values=[['Full transaction hash',record.transactionHash],['Source address',record.source],['Destination address',record.destination]]
  const results=[]
  for (const [label,value] of values) {
    const field=page.locator('dl div').filter({has:page.locator('dt').getByText(label!,{exact:true})}).locator('dd')
    await expect(field).toHaveText(value!)
    const structure=await field.evaluate((element)=>({tag:element.tagName,tabIndex:(element as HTMLElement).tabIndex,contentEditable:(element as HTMLElement).isContentEditable,focusableDescendants:element.querySelectorAll('button,input,textarea,a[href],[tabindex],[contenteditable=true]').length}))
    const sourceControls=await page.locator('dl').evaluate((element)=>element.querySelectorAll('button,input,textarea,a[href],[tabindex],[contenteditable=true]').length)
    const clipboardEquals=()=>page.evaluate(async (expected)=>(await navigator.clipboard.readText())===expected,value!)
    const awaitExactClipboard=async()=>{const start=performance.now();do{if(await clipboardEquals())return true;await page.waitForTimeout(50)}while(performance.now()-start<1000);return false}
    const attempts=[]
    // Establish a known page selection using ordinary keys, never a clipboard sentinel write.
    await page.keyboard.press('Control+a');await page.keyboard.press('Control+c')
    attempts.push({mechanism:'Native whole-document select/copy (not isolated value)',exactClipboard:await clipboardEquals()})
    await page.keyboard.press('ArrowRight')
    const visited=[]
    const seen=new Set<string>()
    let tabCopy=false
    for(let i=0;i<40;i++) {
      await page.keyboard.press('Tab')
      const focus=await field.evaluate((element)=>{const a=document.activeElement as HTMLElement|null;return {tag:a?.tagName,label:a?.getAttribute('aria-label')??a?.textContent?.trim().slice(0,100),testId:a?.getAttribute('data-testid'),insideValue:!!a&&(a===element||element.contains(a))}})
      const key=JSON.stringify(focus)
      if(seen.has(key))break
      seen.add(key);visited.push(focus)
      if(focus.insideValue) {
        await page.keyboard.press('Home');await page.keyboard.press('Shift+End');await page.keyboard.press('Control+c')
        tabCopy=await awaitExactClipboard()
        if(tabCopy)break
      }
      // Any exposed copy operation must be reached by Tab and activated by ordinary keys.
      if(focus.tag==='BUTTON'&&/copy/i.test(focus.label??'')&&((focus.label??'').includes(label!)||(focus.label??'').includes(value!))) {
        await page.keyboard.press('Enter')
        tabCopy=await awaitExactClipboard()
        if(tabCopy)break
      }
    }
    attempts.push({mechanism:'Bounded complete native Tab cycle, Home/Shift+End/Ctrl+C for a focusable value, Enter for a value-associated copy operation',exactClipboard:tabCopy,visited})
    // Chromium browser find is an ordinary shortcut. Headless support is not assumed.
    await page.keyboard.press('Control+f');await page.keyboard.type(value!);await page.keyboard.press('Escape');await page.keyboard.press('Control+c')
    const visibleSourceSelection=await field.evaluate((element,expected)=>{const selection=window.getSelection();return selection?.toString()===expected&&!!selection.anchorNode&&!!selection.focusNode&&element.contains(selection.anchorNode)&&element.contains(selection.focusNode)},value!)
    const findClipboard=await awaitExactClipboard()
    attempts.push({mechanism:'Native Ctrl+F, visible exact value, Escape, Ctrl+C (bounded 1s clipboard observation)',exactClipboard:findClipboard&&visibleSourceSelection,visibleSourceSelection,clipboardEquality:findClipboard})
    results.push({mode,label,value,structure,sourceControls,attempts,copied:attempts.some((a)=>a.exactClipboard)})
  }
  if(results.some((r)=>!r.copied)) {
    // One bounded caret-browsing trial, with the same value-specific ordinary shortcut.
    await page.keyboard.press('F7')
    for(const result of results.filter((r)=>!r.copied)) {
      await page.keyboard.press('Control+Home');await page.keyboard.press('Control+f');await page.keyboard.type(result.value!);await page.keyboard.press('Escape');await page.keyboard.press('Control+c')
      const start=performance.now();let exactClipboard:boolean
      do{exactClipboard=await page.evaluate(async (expected)=>(await navigator.clipboard.readText())===expected,result.value!);if(exactClipboard)break;await page.waitForTimeout(50)}while(performance.now()-start<1000)
      const field=page.locator('dl div').filter({has:page.locator('dt').getByText(result.label!,{exact:true})}).locator('dd')
      const visibleSourceSelection=await field.evaluate((element,expected)=>{const selection=window.getSelection();return selection?.toString()===expected&&!!selection.anchorNode&&!!selection.focusNode&&element.contains(selection.anchorNode)&&element.contains(selection.focusNode)},result.value!)
      result.attempts.push({mechanism:'One F7 caret-browsing trial, Ctrl+Home, Ctrl+F, visible exact value, Escape, Ctrl+C (bounded 1s clipboard observation)',exactClipboard:exactClipboard&&visibleSourceSelection,visibleSourceSelection,clipboardEquality:exactClipboard})
      result.copied=exactClipboard&&visibleSourceSelection
    }
    await page.keyboard.press('F7')
  }
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section','SOURCE')
  return results
}
