import { expect,test } from '@playwright/test'
import { setup,office,activate,button,selectMode,ask,stage,finish,drainTerminalDialogue,resolveCandidateRoute } from '../fixtures/s2/browser-helpers'
import type { CaseFixture } from '../../src/investigation/contracts'
import { restoreInvestigation } from '../../src/investigation/state'
test.setTimeout(180_000)

async function saved(page: import('@playwright/test').Page, fixture: CaseFixture) {
  const text = await page.evaluate(() => Object.values(localStorage).find((v) => { try { return !!JSON.parse(v).fixtureId } catch { return false } }) ?? null)
  return restoreInvestigation(fixture,text)
}
test('B-A01 one semantic state across modes; no pointer setup; focus and live regions',async ({page}) => {
  const data = await setup(page,41); data.freeze()
  await office(page,'KEYBOARD','DIRECT_SOLVER')
  await ask(page,'KEYBOARD')
  await activate(page,button(page,'DISPATCH'),'KEYBOARD')
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section','RESULTS')
  await activate(page,button(page,'CASE'),'KEYBOARD')
  await ask(page,'KEYBOARD')
  await stage(page,data.fixture,'CARD.ASSET_OUT','KEYBOARD')
  await activate(page,button(page,'DISPATCH'),'KEYBOARD')
  const before = await saved(page,data.fixture)
  const snapshots = []
  for (const mode of ['PLAIN_LIST','DOCKED_OVERLAY','FULLSCREEN_CRT']) {
    await activate(page,page.getByText('Presentation and accessibility',{exact:true}),'KEYBOARD')
    await selectMode(page,mode,'KEYBOARD')
    const after = await saved(page,data.fixture)
    for (const key of ['query','discoveredClues','discoveredRecords','pinned','savedLeads','comparison','exactEventIds','assembly','workingTheory','rejectedTheory','result'] as const) expect(after[key]).toEqual(before[key])
    await expect(page.locator('.terminal-live')).toHaveAttribute('role','status')
    await expect(page.locator('.terminal-live')).toHaveAttribute('aria-live','polite')
    await expect(page.locator('.terminal-live')).toHaveAttribute('aria-atomic','true')
    await expect(page.getByRole('navigation',{name:'Terminal sections'})).toHaveCount(1)
    snapshots.push({mode,aria:await page.getByTestId('case-terminal').ariaSnapshot()})
    // Close the local disclosure so the next mode uses the same interaction sequence.
    await activate(page,page.getByText('Presentation and accessibility',{exact:true}),'KEYBOARD')
  }
  await activate(page,button(page,'CASE'),'KEYBOARD')
  await expect(page.getByRole('heading',{name:'CASE TERMINAL · CASE',exact:true})).toBeFocused()
  await finish(page,data,'KEYBOARD','DIRECT_SOLVER')
})


test('B-A04 terminal no-match dead-end cannot become proof; reset and complete',async ({page}) => {
  const data = await setup(page,23);data.freeze();await office(page,'KEYBOARD','MISTAKEN_INVESTIGATOR')
  await ask(page,'KEYBOARD')
  await activate(page,button(page,'DISPATCH'),'KEYBOARD')
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section','RESULTS')
  await resolveCandidateRoute(page, data.fixture, 'KEYBOARD')
  await activate(page,button(page,'CASE'),'KEYBOARD')
  await activate(page,page.getByText('OPEN PERSISTENT CASEBOARD',{exact:true}),'KEYBOARD')
  await activate(page,page.getByText('WORKING THEORY — optional and revisable',{exact:true}),'KEYBOARD')
  await activate(page,button(page,'IT STOPPED AT THE FIRST ENGINE'),'KEYBOARD')
  await drainTerminalDialogue(page)
  await ask(page,'KEYBOARD');await stage(page,data.fixture,'CARD.ASSET_OUT','KEYBOARD')
  await activate(page,page.getByText('Reusable Query Tray — optional categories',{exact:true}),'KEYBOARD')
  await activate(page,button(page,'USE First Breach amount WITH TERMINAL'),'KEYBOARD')
  await activate(page,button(page,'DISPATCH'),'KEYBOARD')
  await expect(page.getByRole('heading',{name:'NO_MATCH_IN_ACCEPTED_CORPUS',exact:true})).toBeVisible()
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-proof-events','0')
  const deadEnd = await saved(page,data.fixture)
  expect(deadEnd.exactEventIds).toEqual([]);expect(deadEnd.assembly).toEqual({});expect(deadEnd.rejectedTheory).toBeNull();expect(deadEnd.workingTheory).toBe('FIRST_TRAIL_STOPS_AT_FIRST_ENGINE')
  await activate(page,button(page,'CASE'),'KEYBOARD');await ask(page,'KEYBOARD')
  await activate(page,page.getByText('Query recovery and saved local query',{exact:true}),'KEYBOARD')
  await activate(page,button(page,'REMOVE ALL CHIPS'),'KEYBOARD')
  expect((await saved(page,data.fixture)).discoveredClues).toEqual(deadEnd.discoveredClues)
  await finish(page,data,'KEYBOARD','MISTAKEN_INVESTIGATOR')
})
