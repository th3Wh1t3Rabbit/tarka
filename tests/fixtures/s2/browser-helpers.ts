import { expect, type Page, type Locator, type TestInfo } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { scenarioFixture } from './contract-fixture'
import { classifyBrowserRequest } from './network-classification'
import { progressionChain } from './domain-helpers'
import { availableCards, restoreInvestigation } from '../../../src/investigation/state'
import type { CaseFixture } from '../../../src/investigation/contracts'
export type Input = 'MOUSE_TOUCH' | 'KEYBOARD' | 'SCREEN_READER'
export type Journey = 'DIRECT_SOLVER' | 'CURIOUS_EXPLORER' | 'MISTAKEN_INVESTIGATOR'
export const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

/** Finds controls using real Tab navigation, including scrolling by native focus. */
export async function tabTo(page: Page, target: Locator) {
  await expect(target).toHaveCount(1)
  for (let i = 0; i < 500; i++) {
    if (await target.evaluate((element) => element === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  throw new Error(`Control unreachable by keyboard: ${await target.getAttribute('aria-label') ?? await target.textContent()}`)
}
export async function activate(page: Page, locator: Locator, input: Input) {
  await expect(locator).toBeVisible()
  if (input === 'MOUSE_TOUCH') await locator.tap()
  else { await tabTo(page, locator); await page.keyboard.press('Enter') }
}
export async function selectMode(page: Page, mode: string, input: Input) {
  const selector = page.getByLabel('Terminal presentation')
  if (input === 'MOUSE_TOUCH') await selector.selectOption(mode)
  else {
    await tabTo(page, selector); await page.keyboard.press('Home')
    const index = ['FULLSCREEN_CRT','DOCKED_OVERLAY','PLAIN_LIST'].indexOf(mode)
    for (let i = 0; i < index; i++) await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
  }
  await expect(selector).toHaveValue(mode)
}
export async function setup(page: Page, seed = 19, size?: number) {
  const data = scenarioFixture(seed, size, true)
  // The browser builds the intercepted payload through loadFrozenFixture(), so
  // its persisted origin is ACCEPTED_FROZEN even though the data is synthetic.
  data.fixture.mode = 'ACCEPTED_FROZEN'
  const requests: { path: string; method: string; blocked: boolean; forbidden: boolean; className: string }[] = []
  let frozen = false
  const origin = 'http://127.0.0.1:4173'
  await page.context().route('**/*', async (route) => {
    const request = route.request(); const url = new URL(request.url())
    const className = classifyBrowserRequest(url, request.method(), origin)
    const forbidden = className !== 'static'
    const blocked = frozen || forbidden
    requests.push({ path: url.origin === origin ? url.pathname : `EXTERNAL:${url.hostname}`, method: request.method(), blocked, forbidden, className })
    if (blocked) return route.abort('blockedbyclient')
    if (url.pathname.endsWith('/scenario.json') && !url.search) return route.fulfill({ json: data.scenario })
    if (url.pathname.endsWith('/evidence-graph.json') && !url.search) return route.fulfill({ json: data.graph })
    return route.continue()
  })
  await page.context().routeWebSocket('**/*', (ws) => { ws.close() })
  await page.goto('/')
  await expect(page.getByTestId('a0-shell')).toBeVisible()
  await page.waitForFunction(() => [...document.images].every((image) => image.complete))
  return { ...data, requests, freeze: () => { frozen = true } }
}
export async function enterTerminalFromWorld(page: Page, input: Input) {
  await activate(page, page.getByTestId('verb-use'), input)
  await activate(page, page.getByTestId('hotspot-nansen-terminal'), input)
}
export async function office(page: Page, input: Input, journey: Journey) {
  for (let i = 0; i < 20 && await page.getByTestId('speech-panel').count(); i++) {
    if (input === 'MOUSE_TOUCH') await page.getByTestId('speech-panel').tap()
    else await page.keyboard.press('Space')
  }
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-intro-complete','true')
  await expect(page.getByRole('button', { name:'OPEN CASE TERMINAL', exact:true })).toHaveCount(0)
  if (journey !== 'DIRECT_SOLVER') {
    await activate(page, page.getByTestId('verb-push'), input)
    await activate(page, page.getByTestId('hotspot-office-globe'), input)
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase','START')
    await drainBrowserSpeech(page,input)
  }
  if (journey === 'CURIOUS_EXPLORER') {
    await activate(page,page.getByTestId('verb-talk-to'),input)
    await activate(page,page.getByTestId('hotspot-mr-index'),input)
    await expect(page.getByRole('dialog')).toBeVisible()
    await activate(page,page.getByTestId('dialogue-form-reminder'),input)
    await drainBrowserSpeech(page,input)
    await activate(page,page.getByTestId('dialogue-leave'),input)
  }
  for (const [verb,hotspot,item,item2,,phase,inventory] of progressionChain) {
    await activate(page,page.getByTestId(`verb-${verb.toLowerCase().replace('_','-')}`),input)
    if (item) await activate(page,page.getByTestId(`inventory-${item}`),input)
    if (hotspot) await activate(page,page.getByTestId(`hotspot-${hotspot}`),input)
    else if (item2) await activate(page,page.getByTestId(`inventory-${item2}`),input)
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase',phase)
    await expect(page.getByTestId('active-sequence')).toHaveCount(0)
    await expect(page.locator('[data-testid^="inventory-"]')).toHaveCount(inventory.length)
    await drainBrowserSpeech(page,input)
  }
  // Case drawer: open the shell (no grant), then rummage the revealed stack.
  await activate(page,page.getByTestId('verb-open'),input)
  await activate(page,page.getByTestId('hotspot-official-case-file-cabinet'),input)
  await drainBrowserSpeech(page,input)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer','OPEN')
  await drainBrowserSpeech(page,input)
  await activate(page,page.getByTestId('verb-pick-up'),input)
  await activate(page,page.getByTestId('hotspot-disorderly-stack-of-confidential-files'),input)
  await drainBrowserSpeech(page,input)
  await expect(page.getByTestId('inventory-euler-case-file')).toBeVisible({ timeout: 15000 })
  await drainBrowserSpeech(page,input)
  // Misc drawer: open the shell, then collect the revealed contents in order.
  await activate(page,page.getByTestId('verb-open'),input)
  await activate(page,page.getByTestId('hotspot-miscellaneous-drawer-cabinet'),input)
  await drainBrowserSpeech(page,input)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-misc-drawer','OPEN')
  await drainBrowserSpeech(page,input)
  await activate(page,page.getByTestId('verb-pick-up'),input)
  await activate(page,page.getByTestId('hotspot-miscellaneous-catch-all-contents'),input)
  await drainBrowserSpeech(page,input)
  for (const slot of ['inventory-rubber-band', 'inventory-rubiks-cube', 'inventory-sharknado-2-vhs', 'inventory-piggy-bank-intact', 'inventory-small-toolbox-closed']) await expect(page.getByTestId(slot)).toBeVisible({ timeout: 15000 })
  await drainBrowserSpeech(page,input)
  await enterTerminalFromWorld(page, input)
  await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 15000 })
  await page.waitForFunction(() => Object.values(localStorage).some((value) => {
    try { return JSON.parse(value).commands.entries.some((entry: { type?: string }) => entry.type === 'EARN_ACCESS') } catch { return false }
  }))
}
export async function drainBrowserSpeech(page: Page, input: Input) {
  // Settle in arrival order: walks first (rule speech lands on arrival and
  // INTERACTs issued mid-walk are silently dropped), then sequences, then
  // panels. Two consecutive quiet rounds are required because arrivals can
  // land just after a check. Never demand hint state here (dialogues and
  // terminal flows manage their own controls).
  await page.waitForTimeout(400)
  let quietRounds = 0
  for (let round = 0; round < 10 && quietRounds < 2; round++) {
    await expect.poll(async () => page.getByTestId('rook-sprite').getAttribute('data-animation'), { timeout: 20000 }).not.toBe('walkEast')
    await expect(page.getByTestId('active-sequence')).toHaveCount(0)
    for (let i = 0; i < 12; i++) {
      if ((await page.getByTestId('speech-panel').count()) === 0) break
      if (input === 'MOUSE_TOUCH') await page.getByTestId('speech-panel').tap()
      else await page.evaluate(() => { (document.querySelector('[data-testid="speech-panel"]') as HTMLElement | null)?.click() })
      await expect(page.getByTestId('speech-panel')).toHaveCount(0, { timeout: 4000 }).catch(() => {})
    }
    await page.waitForTimeout(300)
    const quiet = (await page.getByTestId('speech-panel').count()) === 0
      && (await page.getByTestId('active-sequence').count()) === 0
      && (await page.getByTestId('rook-sprite').getAttribute('data-animation')) !== 'walkEast'
    quietRounds = quiet ? quietRounds + 1 : 0
  }
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
  await expect.poll(async () => page.getByTestId('rook-sprite').getAttribute('data-animation'), { timeout: 20000 }).not.toBe('walkEast')
}
export async function drainTerminalDialogue(page: Page) {
  await page.waitForTimeout(100)
  for (let i = 0; i < 40 && await page.getByTestId('terminal-dialogue').count(); i++) await page.getByTestId('terminal-dialogue').getByRole('button').click()
  await expect(page.getByTestId('terminal-dialogue')).toHaveCount(0)
}
export async function ask(page: Page, input: Input) {
  await gotoSection(page, input, 'CASE')
  await activate(page,button(page,'ASK A QUESTION'),input)
  await expect(page.getByLabel('Query Receipt')).toBeVisible()
}
export async function stage(page: Page, fixture: CaseFixture, cardId: string, input: Input) {
  const saved = await page.evaluate(() => Object.values(localStorage).find((v) => { try { return !!JSON.parse(v).fixtureId } catch { return false } }) ?? null)
  const card = availableCards(fixture, restoreInvestigation(fixture, saved)).find((card) => card.id === cardId)
  if (!card) throw new Error(`Contract card unavailable: ${cardId}`)
  const all = page.getByText('All discovered Question Cards and four lenses',{exact:true})
  if (!(await all.evaluate((element) => element.parentElement?.hasAttribute('open')))) await activate(page,all,input)
  // Accessible name comes from current contract data; no provisional sentence is frozen here.
  const cards = page.getByTestId('case-ask-workflow').locator('details').filter({has:all})
  await activate(page,cards.getByRole('button',{name:`${card.lens}: ${card.question}`,exact:true}),input)
  const after = await page.evaluate(() => Object.values(localStorage).find((v) => { try { return !!JSON.parse(v).fixtureId } catch { return false } }) ?? null)
  const query = restoreInvestigation(fixture, after).query
  expect(query.questionId).toBe(card.questionId)
  expect(query.lens).toBe(card.lens)
}
export async function ensureCompared(page: Page, fixture: CaseFixture, input: Input) {
  // COMPARE toggles: only click folders whose COMPARE button is not pressed.
  // DOM pressed-state gates staging (localStorage saves lag clicks by a beat).
  void fixture
  const pressed = () => page.locator('.candidate-folder button[aria-pressed="true"]')
  const folders = page.locator('.candidate-folder')
  for (let n = 0; n < 3; n++) {
    if (await pressed().count() >= 2) break
    const btn = folders.nth(n).getByRole('button', { name: 'COMPARE CANDIDATE', exact: true })
    if (await btn.getAttribute('aria-pressed') !== 'true') await activate(page, btn, input)
  }
  await expect(pressed()).toHaveCount(2)
  await page.waitForTimeout(300)
}
export async function rebroadcast(page: Page, input: Input) {
  // Restore broad results: reset the staged query and dispatch it. Opening
  // ASK auto-reviews, so the empty query dispatches without extra review.
  await ask(page, input)
  await expandDetails(page, input, 'Query recovery and saved local query')
  await activate(page, button(page, 'REMOVE ALL CHIPS'), input)
  await activate(page, button(page, 'DISPATCH'), input)
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section', 'RESULTS')
}
export async function resolveCandidateRoute(page: Page, fixture: CaseFixture, input: Input) {
  // Milestone via the opening follow: SELECT the opening record, stage its
  // FOLLOW_FORWARD card, and dispatch. Comparison is post-milestone tooling
  // and cannot establish the milestone itself. Rebroadcast first so a stale
  // staged query cannot narrow the opening folder away.
  await rebroadcast(page, input)
  const opening = fixture.records.find((r) => r.id === fixture.openingRecordId)!
  await selectFolder(page, input, opening.summary)
  await ask(page,input)
  await stage(page,fixture,'CARD.FOLLOW_FORWARD',input)
  await activate(page,button(page,'DISPATCH'),input)
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-terminal-stage','5')
}
export async function selectFolder(page: Page, input: Input, summary: string) {
  const folder = page.getByRole('article').filter({has:page.getByRole('heading',{name:summary,exact:true})})
  for (let i = 0; !(await folder.count()) && i < 10; i++) await activate(page,page.getByRole('button',{name:/^SHOW MORE ·/}),input)
  await expect(folder).toHaveCount(1)
  await activate(page,folder.getByRole('button',{name:'SOURCE FOR THIS RESULT',exact:true}),input)
}
export async function gotoSection(page: Page, input: Input, section: 'CASE' | 'RESULTS' | 'SOURCE' | 'LEDGER' | 'EXPLORE') {
  // Section nav can miss when a focus verification races a result mount;
  // retry until the terminal reports the requested section.
  for (let i = 0; i < 4; i++) {
    if ((await page.getByTestId('case-terminal').getAttribute('data-section')) === section) return
    if (section === 'CASE') await activate(page, button(page, 'BACK TO CASE'), input)
    else await activate(page, page.getByTestId(`terminal-section-${section.toLowerCase()}`), input)
    await page.waitForTimeout(300)
  }
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section', section)
}
export async function expandDetails(page: Page, input: Input, name: string) {
  // <summary> toggles can miss when a focus verification races a mount;
  // retry until the parent <details> reports open.
  const summary = page.getByText(name, { exact: true })
  const isOpen = () => summary.evaluate((element) => (element.parentElement?.hasAttribute('open') ?? element.hasAttribute('open')))
  for (let i = 0; i < 4 && !(await isOpen()); i++) {
    await activate(page, summary, input)
    await page.waitForTimeout(300)
  }
  await expect.poll(async () => summary.evaluate((element) => (element.parentElement?.hasAttribute('open') ?? element.hasAttribute('open')))).toBe(true)
}
export async function finish(page: Page, data: ReturnType<typeof scenarioFixture>, input: Input, journey: Journey) {
  await rebroadcast(page, input)
  if (journey === 'MISTAKEN_INVESTIGATOR') {
    await ask(page,input)
    await activate(page,button(page,'DISPATCH'),input)
    await resolveCandidateRoute(page, data.fixture, input)
    await ensureCompared(page, data.fixture, input)
    await gotoSection(page, input, 'CASE')
    await expandDetails(page, input, 'OPEN PERSISTENT CASEBOARD')
    await expandDetails(page, input, 'WORKING THEORY — optional and revisable')
    await activate(page,button(page,'IT STOPPED AT THE FIRST ENGINE'),input)
    await drainTerminalDialogue(page)
  }
  await ask(page,input)
  if (journey === 'DIRECT_SOLVER') await stage(page,data.fixture,'CARD.INCIDENT_DAI',input)
  await activate(page,button(page,'DISPATCH'),input)
  await expect(page.getByLabel('Evidence Delta')).toBeVisible()
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-proof-events','0')
  if (journey === 'DIRECT_SOLVER') {
    const opening = data.fixture.records.find((r) => r.id === data.fixture.openingRecordId)!
    await selectFolder(page,input,opening.summary)
    await ask(page,input)
    await stage(page,data.fixture,'CARD.FOLLOW_FORWARD',input)
    await activate(page,button(page,'DISPATCH'),input)
    await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-terminal-stage','5')
  }
  if (journey === 'CURIOUS_EXPLORER') {
    const folders = page.locator('.candidate-folder')
    await activate(page,folders.nth(0).getByRole('button',{name:'SAVE LEAD',exact:true}),input)
    await activate(page,folders.nth(0).getByRole('button',{name:'PIN RESULT SLIP TO CASEBOARD',exact:true}),input)
    await activate(page,folders.nth(0).getByRole('button',{name:'SOURCE FOR THIS RESULT',exact:true}),input)
    await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section','SOURCE')
    const selected = data.fixture.records.find((r) => r.id === data.fixture.openingRecordId)!
    await expect(page.getByTestId('case-terminal')).toContainText(selected.transactionHash)
    await activate(page,button(page,'LEDGER'),input)
    await expect(page.getByLabel('Research Ledger')).toBeVisible()
    await resolveCandidateRoute(page, data.fixture, input)
    await ensureCompared(page, data.fixture, input)
    const comparison = page.getByRole('table',{name:'Factual comparison — no confidence scores',exact:true})
    await expect(comparison.locator('tbody tr')).toHaveCount(6)
    await expect(comparison.locator('thead th')).toHaveCount(3)
    await activate(page,button(page,'EXPLORE'),input)
    await expect(page.getByTestId('semantic-evidence-sea')).toBeVisible()
    await expect(page.getByLabel('Case Corpus')).toHaveCount(0)
    await activate(page,button(page,'CASE'),input); await ask(page,input)
    await stage(page,data.fixture,'CARD.STATE_CHANGE',input)
    await activate(page,button(page,'DISPATCH'),input)
    await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-proof-events','0')
    await activate(page,button(page,'CASE'),input); await ask(page,input)
    await stage(page,data.fixture,'CARD.INTERACTIONS',input)
    await activate(page,button(page,'DISPATCH'),input)
    await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-proof-events','0')
  }
  if (journey !== 'DIRECT_SOLVER') {
    await activate(page,button(page,'CASE'),input); await ask(page,input)
    await stage(page,data.fixture,'CARD.WHAT_LEFT',input)
    await activate(page,button(page,'DISPATCH'),input)
  }
  const link = data.fixture.records.find((r) => r.id === data.fixture.proof.slots.LINK)!
  const folder = page.getByRole('article').filter({has:page.getByRole('heading',{name:link.summary,exact:true})})
  for (let i = 0; !(await folder.count()) && i < 10; i++) await activate(page,page.getByRole('button',{name:/^SHOW MORE ·/}),input)
  await expect(folder).toHaveCount(1)
  await activate(page,folder.getByRole('button',{name:'ASK FOR THIS EXACT RECEIPT',exact:true}),input)
  await expect(page.getByLabel('Query Receipt')).toContainText(link.transactionHash)
  await activate(page,button(page,'DISPATCH'),input)
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-proof-events','1')
  await drainTerminalDialogue(page)
  await expect(folder).toBeFocused()
  await expect(page.getByLabel('Archived proof receipt')).toContainText(link.destination)
  await expect(page.locator('.terminal-live')).toContainText(link.observedAtUtc)
  await activate(page,button(page,'BUILD THE CASE'),input)
  await activate(page,page.getByText('OPEN PERSISTENT CASEBOARD',{exact:true}),input)
  if (journey === 'MISTAKEN_INVESTIGATOR') {
    await expect(page.getByLabel('Rejected theory')).toContainText(link.summary)
    await expect(page.getByLabel('Rejected theory')).toContainText('FIRST_TRAIL_STOPS_AT_FIRST_ENGINE')
  }
  await activate(page,button(page,'READ SECOND BREACH MEMORY'),input)
  for (const slot of ['AMOUNT','RECEIVER','LINK']) await activate(page,button(page,`FILE ${slot}`),input)
  await drainTerminalDialogue(page)
  await expect(page.getByTestId('bounded-case-complete')).toContainText(data.fixture.proof.conclusion)
  await expect(page.getByTestId('bounded-case-complete')).toContainText(data.fixture.proof.boundary)
}
export async function evidence(page: Page, info: TestInfo, data: Awaited<ReturnType<typeof setup>>, extra = {}) {
  const saves = await page.evaluate(() => Object.values(localStorage).map((v) => { try { return JSON.parse(v) } catch { return null } }).filter((v) => v?.fixtureId))
  const aria = await page.getByTestId('case-terminal').ariaSnapshot()
  const value = { test:info.title,status:'OBSERVED',verifiedBy:'evidence/playwright.json final test result',synthetic:true,requests:data.requests,saves,aria,...extra }
  mkdirSync('docs/parallel/lane-b/evidence/browser',{recursive:true})
  writeFileSync(`docs/parallel/lane-b/evidence/browser/${info.title.replace(/[^a-z0-9-]/gi,'_')}.json`,JSON.stringify(value,null,2)+'\n')
  await info.attach('lane-b-semantic-evidence',{body:JSON.stringify(value),contentType:'application/json'})
  expect(data.requests.filter((r) => r.forbidden)).toEqual([])
}
