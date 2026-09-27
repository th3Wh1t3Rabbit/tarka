import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { buildFrozenFixture, syntheticFixture } from '../../src/investigation/fixture'
import { violatesFrozenBrowserPolicy } from '../fixtures/browser-policy'
import { drainBrowserSpeech, drainTerminalDialogue } from '../fixtures/s2/browser-helpers'
test.setTimeout(180_000)

const base = 'public/scenarios/euler-2023-false-exit/'
const fixture = buildFrozenFixture(JSON.parse(readFileSync(base + 'scenario.json', 'utf8')), JSON.parse(readFileSync(base + 'evidence-graph.json', 'utf8')))
const link = fixture.records.find(({ id }) => id === fixture.proof.slots.LINK)!
async function open(page: Page, synthetic = false) {
  await page.goto(`/?review=1${synthetic ? '&caseFixture=synthetic' : ''}`)
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await page.getByRole('button', { name: 'OPEN CASE TERMINAL' }).click()
  await expect(page.getByTestId('case-terminal')).toBeVisible()
}
async function dispatchBroad(page: Page) {
  await page.getByRole('button', { name: 'ASK A QUESTION', exact: true }).click()
  await page.getByRole('button', { name: 'DISPATCH', exact: true }).click()
}
async function showLink(page: Page) {
  const folder = page.locator('.candidate-folder').filter({ hasText: '11:38:11' }).filter({ hasText: 'EVIDENCE GRADE: EXACT' })
  for (let i = 0; i < 4 && !(await folder.count()); i++) await page.getByRole('button', { name: /SHOW MORE ·/ }).click()
  await expect(folder).toHaveCount(1)
  return folder
}
const synthetic = syntheticFixture(fixture)
async function showOpening(page: Page, openingSummary: string) {
  const folder = page.locator('.candidate-folder').filter({ hasText: openingSummary.slice(0, 40) })
  for (let i = 0; i < 4 && !(await folder.count()); i++) await page.getByRole('button', { name: /SHOW MORE ·/ }).click()
  await expect(folder).toHaveCount(1)
  return folder
}
async function resolveMilestoneViaOpening(page: Page, openingSummary = fixture.records.find((r) => r.id === fixture.openingRecordId)!.summary) {
  // Milestone via the opening follow (comparison is post-milestone tooling).
  const folder = await showOpening(page, openingSummary)
  await folder.getByRole('button', { name: 'SOURCE FOR THIS RESULT' }).click()
  await page.getByRole('button', { name: 'BACK TO CASE' }).click()
  await page.getByRole('button', { name: 'ASK A QUESTION', exact: true }).click()
  const all = page.getByText('All discovered Question Cards and four lenses', { exact: true })
  if (!(await all.evaluate((element) => element.parentElement?.hasAttribute('open')))) await all.click()
  await page.getByRole('button', { name: 'RELATIONSHIPS: FOLLOW THIS CANDIDATE FORWARD', exact: true }).click()
  await page.getByRole('button', { name: 'DISPATCH', exact: true }).click()
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-terminal-stage', '5')
}
async function rebroadcast(page: Page) {
  await page.getByRole('button', { name: 'BACK TO CASE' }).click()
  await page.getByRole('button', { name: 'ASK A QUESTION', exact: true }).click()
  const qr = page.getByText('Query recovery and saved local query', { exact: true })
  if (!(await qr.evaluate((element) => element.parentElement?.hasAttribute('open')))) await qr.click()
  await page.getByRole('button', { name: 'REMOVE ALL CHIPS', exact: true }).click()
  await page.getByRole('button', { name: 'DISPATCH', exact: true }).click()
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section', 'RESULTS')
}
async function exactLink(page: Page, openingSummary?: string) {
  await rebroadcast(page)
  await resolveMilestoneViaOpening(page, openingSummary)
  // Rebroadcast broad results so LINK renders, then take its exact receipt.
  await rebroadcast(page)
  const folder = await showLink(page)
  await folder.getByRole('button', { name: 'ASK FOR THIS EXACT RECEIPT' }).click()
  await expect(page.getByLabel('Query Receipt')).toContainText('RESULT DERIVED')
  await page.getByRole('button', { name: 'DISPATCH', exact: true }).click()
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-proof-events', '1')
  await expect(page.getByLabel('Archived proof receipt')).toContainText('11:38:11')
}

test('earned opening access, initial no-leak, and no browser provider requests', async ({ page }) => {
  const external: string[] = []
  page.on('request', (request) => { if (violatesFrozenBrowserPolicy(request.url())) external.push(request.url()) })
  await page.goto('/?review=1')
  await expect(page.getByRole('button', { name: 'OPEN CASE TERMINAL' })).toHaveCount(0)
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await page.getByRole('button', { name: 'OPEN CASE TERMINAL' }).click()
  const terminal = page.getByTestId('case-terminal')
  expect(await terminal.innerText()).not.toContain(link.transactionHash)
  expect(await terminal.innerText()).not.toContain(link.destination)
  expect(await terminal.ariaSnapshot()).not.toContain('11:38:11')
  await expect(page.locator('.question-cards > article')).toHaveCount(1)
  await dispatchBroad(page)
  await exactLink(page)
  expect(external).toEqual([])
})

test('direct exact journey files bounded Amount, Receiver, and Link', async ({ page }, testInfo) => {
  await open(page); await dispatchBroad(page); await exactLink(page)
  await drainTerminalDialogue(page)
  await expect(page.locator('.candidate-folder')).toBeFocused()
  await page.getByRole('button', { name: 'BUILD THE CASE' }).click()
  await page.getByText('OPEN PERSISTENT CASEBOARD', { exact: true }).click()
  await page.getByRole('button', { name: 'READ SECOND BREACH MEMORY' }).click()
  for (const slot of ['AMOUNT', 'RECEIVER', 'LINK']) await page.getByRole('button', { name: `FILE ${slot}`, exact: true }).click()
  await expect(page.getByTestId('bounded-case-complete')).toContainText(fixture.proof.conclusion)
  await expect(page.getByTestId('bounded-case-complete')).toContainText('No common human identity')
  await page.screenshot({ path: testInfo.outputPath('bounded-case.png'), fullPage: true })
})

test('ordinary form authorization journey preserves the office puzzle and reusable stamped form', async ({ page }, testInfo) => {
  const violations: string[] = []
  page.on('request', (request) => { if (violatesFrozenBrowserPolicy(request.url())) violations.push(request.url()) })
  await page.goto('/?skipIntro=1')
  await page.getByRole('button', { name: 'TEXT PACED', exact: true }).click()
  const action = async (verb: string, hotspot: string, phase: string, item?: string) => {
    await page.getByTestId(`verb-${verb.toLowerCase().replace('_', '-')}`).click()
    if (item) await page.getByTestId(`inventory-${item}`).click()
    await page.getByTestId(`hotspot-${hotspot}`).click()
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', phase)
    await drainBrowserSpeech(page, 'KEYBOARD')
  }
  await expect(page.getByTestId('case-terminal')).toHaveCount(0)
  await action('PULL', 'request-dispenser', 'FORM_HELD')
  await action('PICK_UP', 'pen-stand', 'FORM_AND_PEN')
  await page.getByTestId('verb-use').click()
  await page.getByTestId('inventory-blank-terminal-authorization-form').click()
  await page.getByTestId('inventory-loose-feather-pen').click()
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'FORM_COMPLETED')
  await drainBrowserSpeech(page, 'KEYBOARD')
  await action('GIVE', 'mr-index', 'COMPLETE', 'signed-terminal-authorization-form-with-doodles')
  await page.getByTestId('verb-open').click()
  await page.getByTestId('hotspot-official-case-file-cabinet').click()
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'OPEN')
  await drainBrowserSpeech(page, 'KEYBOARD')
  await page.getByTestId('verb-pick-up').click()
  await page.getByTestId('hotspot-disorderly-stack-of-confidential-files').click()
  await expect(page.getByTestId('inventory-euler-case-file')).toBeVisible({ timeout: 15000 })
  await drainBrowserSpeech(page, 'KEYBOARD')
  await page.getByRole('button', { name: 'OPEN CASE TERMINAL', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('frozen-case.png'), fullPage: true })
  await dispatchBroad(page); await exactLink(page)
  await drainTerminalDialogue(page)
  await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
  await expect(page.getByTestId('inventory-approved-stamped-terminal-authorization-form')).toBeVisible()
  expect(violations).toEqual([])
})

test('curious comparison, mistaken theory, and first exact falsifier stay persistent', async ({ page }) => {
  await open(page)
  await dispatchBroad(page)
  await resolveMilestoneViaOpening(page)
  const folders = page.locator('.candidate-folder')
  await folders.nth(0).getByRole('button', { name: 'COMPARE CANDIDATE' }).click()
  await folders.nth(1).getByRole('button', { name: 'COMPARE CANDIDATE' }).click()
  await expect(page.getByRole('table', { name: 'Factual comparison — no confidence scores' })).toBeVisible()
  await page.getByRole('button', { name: 'BACK TO CASE' }).click()
  await page.getByText('OPEN PERSISTENT CASEBOARD', { exact: true }).click()
  await page.getByText('WORKING THEORY — optional and revisable', { exact: true }).click()
  await page.getByRole('button', { name: 'IT STOPPED AT THE FIRST ENGINE', exact: true }).click()
  await drainTerminalDialogue(page)
  await page.getByTestId('terminal-section-results').click()
  await exactLink(page)
  await drainTerminalDialogue(page)
  await page.getByRole('button', { name: 'BUILD THE CASE' }).click()
  await page.getByText('OPEN PERSISTENT CASEBOARD', { exact: true }).click()
  await expect(page.getByLabel('Rejected theory')).toContainText('First discovered contradiction')
  await expect(page.getByLabel('Rejected theory')).toContainText('11:38:11')
})

test('plain-list, keyboard, high contrast, reduced motion, and 200% text preserve one tree', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page)
  await page.getByText('Presentation and accessibility', { exact: true }).click()
  await page.getByLabel('Terminal presentation').selectOption('PLAIN_LIST')
  await page.getByRole('button', { name: 'HIGH CONTRAST', exact: true }).click()
  await page.evaluate(() => { document.body.style.zoom = '2' })
  await expect(page.getByTestId('case-terminal')).toHaveClass(/mode-plain_list.*motion-reduced.*high-contrast/)
  await page.getByRole('button', { name: 'ASK A QUESTION', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'CASE TERMINAL · CASE', exact: true })).toBeFocused()
  await expect(page.getByTestId('case-terminal')).toHaveCount(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2)).toBe(true)
  await page.getByRole('button', { name: 'DISPATCH', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section', 'RESULTS')
  await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
  await expect(page.getByRole('button', { name: 'OPEN CASE TERMINAL' })).toBeFocused()
})

test('query recovery shares state across terminal reopen', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'ASK A QUESTION', exact: true }).click()
  await page.getByText('All discovered Question Cards and four lenses', { exact: true }).click()
  await page.getByRole('button', { name: 'ACTIVITY: Which DAI movements match the incident window?', exact: true }).click()
  const before = await page.getByTestId('case-sentence').innerText()
  await page.getByText('Query recovery and saved local query', { exact: true }).click()
  await page.getByRole('button', { name: 'SAVE LOCAL QUERY', exact: true }).click()
  await page.getByRole('button', { name: 'REMOVE ALL CHIPS', exact: true }).click()
  await page.getByRole('button', { name: 'UNDO', exact: true }).click()
  await expect(page.getByTestId('case-sentence')).toHaveText(before)
  await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
  await page.getByRole('button', { name: 'OPEN CASE TERMINAL' }).click()
  await page.getByRole('button', { name: 'ASK A QUESTION', exact: true }).click()
  await expect(page.getByTestId('case-sentence')).toHaveText(before)
})

test('every terminal entry returns to the main case page without erasing progress', async ({ page }) => {
  await open(page)
  await page.getByTestId('terminal-section-explore').click()
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section', 'EXPLORE')
  await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
  await page.getByRole('button', { name: 'OPEN CASE TERMINAL', exact: true }).click()
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section', 'CASE')
})

test('synthetic second fixture changes real rendered amounts, addresses, and proof reaction', async ({ page }, testInfo) => {
  const syntheticOpening = synthetic.records.find((r) => r.id === synthetic.openingRecordId)!.summary
  await open(page, true); await dispatchBroad(page); await exactLink(page, syntheticOpening)
  await expect(page.getByLabel('Archived proof receipt')).toContainText('1234.5 TEST')
  expect(await page.getByTestId('case-terminal').innerText()).not.toContain(link.destination)
  await page.screenshot({ path: testInfo.outputPath('synthetic-terminal.png'), fullPage: true })
})

test('12,288-record synthetic corpus stays bounded and keyboard-accessible at both reference viewports', async ({ page }, testInfo) => {
  test.setTimeout(90000)
  const scenario = JSON.parse(readFileSync(base + 'scenario.json', 'utf8'))
  const original = scenario.evidence
  scenario.evidence = Array.from({ length: 12288 }, (_, index) => index < original.length ? original[index] : { ...original[index % original.length], id: `SYNTHETIC.LARGE.${index}`, transactionHash: `0x${(index + 100000).toString(16).padStart(64, '0')}` })
  await page.route('**/scenarios/euler-2023-false-exit/scenario.json', (route) => route.fulfill({ json: scenario }))
  const violations: string[] = []
  page.on('request', (request) => { if (violatesFrozenBrowserPolicy(request.url())) violations.push(request.url()) })
  const measurements: { width: number; loadMs: number; dispatchMs: number }[] = []
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/?review=1&caseFixture=synthetic')
    await page.evaluate(() => localStorage.clear())
    const start = Date.now()
    await open(page, true)
    const loadMs = Date.now() - start
    await page.getByText('Presentation and accessibility', { exact: true }).click()
    await page.getByLabel('Terminal presentation').selectOption('PLAIN_LIST')
    await page.getByRole('button', { name: 'HIGH CONTRAST', exact: true }).click()
      await page.evaluate(() => { document.body.style.zoom = '2' })
    await page.getByRole('button', { name: 'ASK A QUESTION', exact: true }).focus()
    await page.keyboard.press('Enter')
    const dispatchStart = Date.now()
    await page.getByRole('button', { name: 'DISPATCH', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section', 'RESULTS')
    const dispatchMs = Date.now() - dispatchStart
    await expect(page.locator('.candidate-folder')).toHaveCount(3)
    await expect(page.getByTestId('case-terminal')).toContainText('12288')
    await expect(page.getByTestId('case-terminal')).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2)).toBe(true)
    expect(loadMs).toBeLessThan(15000)
    expect(dispatchMs).toBeLessThan(5000)
    const archiveStart = Date.now()
    await page.getByRole('button', { name: 'LEDGER', exact: true }).focus(); await page.keyboard.press('Enter')
    await expect(page.getByRole('table', { name: 'Known source calls and consumers', exact: true }).locator('tbody tr')).toHaveCount(20)
    await expect(page.getByRole('table', { name: 'Discovered routes in chronological order', exact: true }).locator('tbody tr')).toHaveCount(20)
    expect(Date.now() - archiveStart).toBeLessThan(5000)
    await page.getByRole('button', { name: 'SHOW MORE ATLAS / ROUTE RELATIONS', exact: true }).focus(); await page.keyboard.press('Enter')
    await expect(page.getByRole('table', { name: 'Discovered routes in chronological order', exact: true }).locator('tbody tr')).toHaveCount(40)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2)).toBe(true)
    measurements.push({ width: viewport.width, loadMs, dispatchMs })
  }
  expect(violations).toEqual([])
  await testInfo.attach('synthetic-large-corpus-measurements.json', { body: JSON.stringify({ syntheticTestOnly: true, records: 12288, measurements, qualificationCounted: 0 }), contentType: 'application/json' })
})
