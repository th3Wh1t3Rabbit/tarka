import { expect, test, type Page, type Locator } from '@playwright/test'
import { violatesFrozenBrowserPolicy } from '../fixtures/browser-policy'
import { drainTerminalDialogue, resolveCandidateRoute } from '../fixtures/s2/browser-helpers'
import { readFileSync } from 'node:fs'
import { buildFrozenFixture } from '../../src/investigation/fixture'
const scenario = JSON.parse(readFileSync('public/scenarios/euler-2023-false-exit/scenario.json', 'utf8')) as Parameters<typeof buildFrozenFixture>[0]
const graph = JSON.parse(readFileSync('public/scenarios/euler-2023-false-exit/evidence-graph.json', 'utf8')) as Parameters<typeof buildFrozenFixture>[1]
const fixture = buildFrozenFixture(scenario, graph)

const press = async (page: Page, locator: Locator) => { await locator.focus(); await page.keyboard.press('Enter') }
for (const mode of ['FULLSCREEN_CRT', 'DOCKED_OVERLAY', 'PLAIN_LIST']) for (const accessible of [false, true]) {
  test(`R2 parity ${mode} keyboard=${accessible} contrast/reduced/instant/zoom=${accessible ? 200 : 100}`, async ({ page }) => {
    const violations: string[] = []
    page.on('request', (request) => { if (violatesFrozenBrowserPolicy(request.url())) violations.push(request.url()) })
    const use = async (locator: Locator) => accessible ? press(page, locator) : locator.click()
    const button = (name: string) => page.getByRole('button', { name, exact: true })
    await page.goto('/?review=1'); await page.evaluate(() => localStorage.clear()); await page.reload()
    await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
    await use(button('OPEN CASE TERMINAL'))
    await use(page.getByText('Presentation and accessibility', { exact: true }))
    await page.getByLabel('Terminal presentation').selectOption(mode)
    if (accessible) { await use(button('HIGH CONTRAST')); await page.evaluate(() => { document.body.style.zoom = '2' }) }
    const terminal = page.getByTestId('case-terminal')
    await expect(terminal).toHaveCount(1); await expect(page.getByRole('navigation', { name: 'Terminal sections' }).getByRole('button')).toHaveText(['CASE']); await expect(button('ASK')).toHaveCount(0); await expect(button('ARCHIVE')).toHaveCount(0); await expect(terminal).toContainText('TEXT PACED')
    await use(button('ASK A QUESTION'))
    await use(page.getByText('All discovered Question Cards and four lenses', { exact: true }))
    await expect(button('ACTIVITY: Which DAI movements match the incident window?')).toBeVisible()
    await expect(page.locator('.question-cards article')).toHaveCount(1)
    await use(button('DISPATCH')); await expect(page.getByLabel('Evidence Delta')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Terminal sections' }).getByRole('button')).toHaveText(['CASE', 'RESULTS', 'SOURCE', 'LEDGER'])
    const folders = page.locator('.candidate-folder')
    await resolveCandidateRoute(page, fixture, 'KEYBOARD')
    await use(folders.nth(0).getByRole('button', { name: 'COMPARE CANDIDATE' })); await use(folders.nth(1).getByRole('button', { name: 'COMPARE CANDIDATE' }))
    await expect(page.getByRole('table', { name: 'Factual comparison — no confidence scores' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Terminal sections' }).getByRole('button')).toHaveText(['CASE', 'RESULTS', 'EXPLORE', 'SOURCE', 'LEDGER'])
    await use(button('CASE'))
    await use(page.getByText('OPEN PERSISTENT CASEBOARD', { exact: true }))
    await use(page.getByText('WORKING THEORY — optional and revisable', { exact: true }))
    await use(button('IT STOPPED AT THE FIRST ENGINE'))
    await drainTerminalDialogue(page)
    await use(button('EXPLORE')); await expect(terminal).toHaveAttribute('data-section', 'EXPLORE'); await expect(page.getByTestId('semantic-evidence-sea')).toBeVisible(); await expect(page.getByTestId('case-corpus')).toHaveCount(0); await expect(page.getByLabel('Query Receipt')).toHaveCount(0); await expect(page.getByTestId('research-ledger')).toHaveCount(0); await use(button('CASE')); await use(button('ASK A QUESTION')); await expect(terminal).toHaveAttribute('data-section', 'CASE'); await expect(page.getByTestId('case-ask-workflow')).toBeVisible()
    await use(button('RESULTS'))
    await use(folders.nth(0).getByRole('button', { name: 'SOURCE FOR THIS RESULT' }))
    await expect(terminal).toHaveAttribute('data-section', 'SOURCE'); await expect(terminal).toContainText('Raw response SHA-256')
    await use(button('LEDGER')); await expect(terminal).toHaveAttribute('data-section', 'LEDGER')
    for (const name of ['Known source calls and consumers', 'Discovered routes in chronological order', 'Subject × time window × Question Lens × partition — not all chain history']) await expect(page.getByRole('table', { name, exact: true })).toBeVisible()
    await expect(terminal).toContainText('0 curated evidence calls')
    await expect(terminal).toContainText('Account-level competition quota evidence is tracked separately')
    await use(button('BACK TO CASE'))
    await use(button('ASK A QUESTION'))
    await use(page.getByText('Query recovery and saved local query', { exact: true }))
    await use(button('REMOVE ALL CHIPS'))
    await use(button('DISPATCH'))
    await expect(terminal).toHaveAttribute('data-section', 'RESULTS')
    await use(button('RESULTS'))
    let link = page.locator('.candidate-folder').filter({ hasText: '11:38:11' }).filter({ hasText: 'EVIDENCE GRADE: EXACT' })
    if (!(await link.count())) await use(page.getByRole('button', { name: /SHOW MORE ·/ }))
    link = page.locator('.candidate-folder').filter({ hasText: '11:38:11' }).filter({ hasText: 'EVIDENCE GRADE: EXACT' })
    await use(link.getByRole('button', { name: 'ASK FOR THIS EXACT RECEIPT' }))
    await expect(page.getByLabel('Query Receipt')).toContainText('RECEIPT'); await expect(page.getByLabel('Query Receipt')).toContainText('RESULT DERIVED')
    await use(button('DISPATCH')); await expect(terminal).toHaveAttribute('data-proof-events', '1')
    await drainTerminalDialogue(page)
    await use(button('BUILD THE CASE')); await use(page.getByText('OPEN PERSISTENT CASEBOARD', { exact: true }))
    await expect(page.getByLabel('Rejected theory')).toContainText('11:38:11')
    await use(button('READ SECOND BREACH MEMORY'))
    for (const slot of ['AMOUNT', 'RECEIVER', 'LINK']) await use(button(`FILE ${slot}`))
    await expect(page.getByTestId('bounded-case-complete')).toContainText('THE FIRST TRAIL JOINED THE SECOND ROUTE.')
    await expect(page.getByTestId('bounded-case-complete')).toContainText('No common human identity')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2)).toBe(true)
    await use(button('RETURN TO RECORDS OFFICE'))
    for (let i = 0; i < 12 && !(await page.getByRole('button', { name: 'OPEN CASE TERMINAL', exact: true }).count()); i++) {
      await page.getByTestId('speech-panel').click()
    }
    await expect(button('OPEN CASE TERMINAL')).toBeFocused()
    expect(violations).toEqual([])
  })
}
