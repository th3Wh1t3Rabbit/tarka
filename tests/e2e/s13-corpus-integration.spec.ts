import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { activate, drainBrowserSpeech } from '../fixtures/s2/browser-helpers'
import { progressionChain } from '../fixtures/s2/domain-helpers'

type Input = 'mouse' | 'keyboard' | 'touch'
const s14R1EvidenceDir = resolve('artifacts/s14-r1/SCREENSHOTS')
mkdirSync(s14R1EvidenceDir, { recursive: true })

async function act(page: Page, locator: Locator, input: Input) {
  if (input === 'keyboard') await activate(page, locator, 'KEYBOARD')
  else if (input === 'touch') await locator.tap()
  else await locator.click()
}

async function blockExternalNetwork(page: Page) {
  const external: string[] = []
  await page.context().route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin === 'http://127.0.0.1:4173') return route.continue()
    external.push(route.request().url())
    return route.abort('blockedbyclient')
  })
  await page.context().routeWebSocket('**/*', socket => socket.close())
  return external
}

async function authorizedReview(page: Page) {
  await page.goto('/?skipIntro=1&review=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible()
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'COMPLETE')
}

async function authorizeWithoutCaseFile(page: Page) {
  await page.goto('/?skipIntro=1')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
  for (const [verb, hotspot, item, item2, , phase] of progressionChain) {
    await page.getByTestId(`verb-${String(verb).toLowerCase().replace('_', '-')}`).click()
    if (item) await page.getByTestId(`inventory-${item}`).click()
    if (hotspot) await page.getByTestId(`hotspot-${hotspot}`).click()
    else if (item2) await page.getByTestId(`inventory-${item2}`).click()
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', String(phase))
    await drainBrowserSpeech(page, 'KEYBOARD')
  }
}

async function enterTerminal(page: Page, input: Input) {
  await act(page, page.getByTestId('verb-use'), input)
  await act(page, page.getByTestId('hotspot-nansen-terminal'), input)
  await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 15_000 })
}

async function gotoTerminalSection(page: Page, section: 'CASE' | 'RESULTS' | 'EXPLORE' | 'SOURCE' | 'LEDGER', input: Input) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await page.getByTestId('case-terminal').getAttribute('data-section') === section) return
    await act(page, page.getByTestId(`terminal-section-${section.toLowerCase()}`), input)
    await page.waitForTimeout(100)
  }
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section', section)
}

async function collectCaseFile(page: Page, input: Input) {
  await act(page, page.getByTestId('verb-open'), input)
  await act(page, page.getByTestId('hotspot-official-case-file-cabinet'), input)
  await drainBrowserSpeech(page, input === 'touch' ? 'MOUSE_TOUCH' : 'KEYBOARD')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'OPEN')
  await act(page, page.getByTestId('verb-pick-up'), input)
  await act(page, page.getByTestId('hotspot-disorderly-stack-of-confidential-files'), input)
  await drainBrowserSpeech(page, input === 'touch' ? 'MOUSE_TOUCH' : 'KEYBOARD')
  await expect(page.getByTestId('inventory-euler-case-file')).toBeVisible({ timeout: 15_000 })
}

async function collectOptionalDrawer(page: Page, input: Input) {
  await act(page, page.getByTestId('verb-open'), input)
  await act(page, page.getByTestId('hotspot-miscellaneous-drawer-cabinet'), input)
  await drainBrowserSpeech(page, input === 'touch' ? 'MOUSE_TOUCH' : 'KEYBOARD')
  await act(page, page.getByTestId('verb-pick-up'), input)
  await act(page, page.getByTestId('hotspot-miscellaneous-catch-all-contents'), input)
  await drainBrowserSpeech(page, input === 'touch' ? 'MOUSE_TOUCH' : 'KEYBOARD')
  await expect(page.getByTestId('inventory-small-toolbox-closed')).toBeVisible()
}

async function dispatchCorpusQuestions(page: Page, input: Input, callbacks: { onBroad?: () => Promise<void>; onCandidates?: () => Promise<void>; onReceipt?: (index: number, receipt: ReturnType<Page['getByTestId']>) => Promise<void> } = {}) {
  const groups = [
    { stage: 'STAGE Orient within the accepted transfer pool and confirm the accepted incident window.', summary: '98 corpus records → 98 matches', counts: ['98 records', '98 records'], result: '98 matching records' },
    { stage: 'STAGE Which DAI movements match the case-file approximate 8.88M amount band?', summary: '98 corpus records → 3 matches', counts: ['74 records', '3 records'], result: '3 matching records' },
    { stage: 'STAGE Which First Engine route contains the exact surviving receipt?', summary: '3 corpus records → 1 match', counts: ['2 records', '1 records'], result: '1 matching records' },
  ]
  for (const [index, group] of groups.entries()) {
    await gotoTerminalSection(page, 'CASE', input)
    await act(page, page.getByRole('button', { name: group.stage }), input)
    const receipt = page.getByTestId('pre-dispatch-query-receipt')
    await expect(receipt).toContainText('PRE-DISPATCH REVIEW')
    await expect(receipt).toContainText('PLAYER QUESTION')
    await expect(receipt).toContainText('ACTIVE LENS')
    await expect(receipt).toContainText('CASE-FILE CLUE ORIGINS')
    await expect(receipt).toContainText('FILTERS / SUBPREDICATES')
    await expect(receipt).toContainText('NO HIDDEN FILTER WILL BE ADDED')
    await expect(page.getByLabel('Case reasoning')).toContainText(group.summary)
    await expect(receipt).toContainText(group.summary)
    if (callbacks.onReceipt) await callbacks.onReceipt(index, receipt)
    const dispatch = receipt.getByRole('button', { name: 'DISPATCH', exact: true })
    await expect(dispatch).toBeDisabled()
    await act(page, receipt.getByRole('button', { name: 'REVIEW QUERY RECEIPT' }), input)
    await expect(dispatch).toBeEnabled()
    await act(page, dispatch, input)
    await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section', 'RESULTS')
    for (const count of group.counts) await expect(page.getByTestId('s13-evidence-delta')).toContainText(count)
    await expect(page.getByTestId('s13-results')).toContainText(group.result)
    if (index === 0 && callbacks.onBroad) await callbacks.onBroad()
    if (index === 1 && callbacks.onCandidates) await callbacks.onCandidates()
  }
  await expect(page.getByTestId('s13-survivor-handoff')).toContainText('No proof slot is filled')
}

async function verifySurvivor(page: Page, input: Input) {
  await act(page, page.getByRole('button', { name: /^INSPECT SOURCE/ }), input)
  const source = page.getByTestId('s13-source')
  await expect(source).toContainText('survival is not proof')
  await expect(source).not.toContainText('HERO.EXACT_CONVERGENCE')
  await expect(source).not.toContainText('8877507.348306697')
  await act(page, page.getByRole('button', { name: 'VERIFY SURVIVING RECEIPT' }), input)
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-proof-events', '1')
  await expect(page.getByLabel('Archived proof receipt')).toContainText('EXACT · PROOF RECEIPT ARCHIVED')
}

async function openCaseboard(page: Page, input: Input) {
  await gotoTerminalSection(page, 'CASE', input)
  const summary = page.getByText('OPEN PERSISTENT CASEBOARD', { exact: true })
  if (!(await summary.locator('xpath=..').getAttribute('open'))) await act(page, summary, input)
  await expect(page.getByLabel('Persistent Caseboard')).toBeVisible()
}

async function shot(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path })
  await testInfo.attach(name, { path, contentType: 'image/png' })
}

async function shotElement(page: Page, locator: Locator, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`)
  const viewport = page.viewportSize()
  await page.setViewportSize({ width: viewport?.width ?? 1280, height: 1600 })
  await locator.evaluate(element => {
    const wrapper = document.createElement('main')
    wrapper.dataset.testid = 's13-screenshot-clone'
    wrapper.className = 'case-terminal'
    wrapper.style.cssText = 'position:fixed;inset:0 auto auto 0;z-index:2147483647;width:1180px;height:auto;min-height:0;overflow:visible;margin:0;background:#101b1b;padding:32px;'
    wrapper.append(element.cloneNode(true))
    document.body.append(wrapper)
  })
  const clone = page.getByTestId('s13-screenshot-clone')
  await clone.screenshot({ path })
  await clone.evaluate(element => element.remove())
  if (viewport) await page.setViewportSize(viewport)
  await testInfo.attach(name, { path, contentType: 'image/png' })
}

async function completeProof(page: Page, input: Input, testInfo?: TestInfo) {
  await verifySurvivor(page, input)
  await openCaseboard(page, input)
  await act(page, page.getByRole('button', { name: 'FILE AMOUNT' }), input)
  await expect(page.getByLabel('Persistent Caseboard')).toContainText('AMOUNT: ◆ EXACT FILED')
  await expect(page.getByLabel('Persistent Caseboard')).toContainText('RECEIVER: ◇ OPEN')
  if (testInfo) await shot(page, testInfo, '02-caseboard-partial-proof')
  await act(page, page.getByRole('button', { name: 'FILE RECEIVER' }), input)
  await act(page, page.getByRole('button', { name: 'FILE LINK' }), input)
  await expect(page.getByTestId('bounded-case-complete')).toContainText('COMPLETION READY')
  await expect(page.getByLabel('Persistent Caseboard')).toContainText('LINK: ◆ EXACT FILED')
  if (testInfo) await shot(page, testInfo, '03-caseboard-completion-ready')
}

test('pre-case prebrief is aggregate-only and blocks every individual evidence path', async ({ page }) => {
  await authorizeWithoutCaseFile(page)
  await enterTerminal(page, 'mouse')
  const terminal = page.getByTestId('case-terminal')
  await expect(page.getByTestId('s13-prebrief')).toContainText('101')
  await expect(page.getByTestId('s13-prebrief')).toContainText('227')
  await expect(page.getByTestId('s13-prebrief')).toContainText('200')
  await expect(page.getByTestId('terminal-section-explore')).toHaveCount(0)
  const text = await terminal.innerText()
  for (const secret of ['HERO.EXACT_CONVERGENCE', '0xdae809', '0x6b1754', '8877507', 'FILTER.UNFRAMED_PLAYER_VIEW']) expect(text).not.toContain(secret)
})

test('mouse path preserves CASE tools, neutral broad pool, explicit proof, static runtime, and sealed narrative', async ({ page }, testInfo) => {
  test.setTimeout(300_000)
  const external = await blockExternalNetwork(page)
  await authorizedReview(page)
  await collectCaseFile(page, 'mouse')
  await enterTerminal(page, 'mouse')
  await expect(page.getByRole('button', { name: 'STAGE Orient within the accepted transfer pool and confirm the accepted incident window.' })).toBeVisible()
  await expect(page.getByText('OPEN PERSISTENT CASEBOARD', { exact: true })).toBeAttached()
  await dispatchCorpusQuestions(page, 'mouse', { onBroad: async () => {
    await expect(page.getByTestId('r55-hero-delta')).toContainText('One exact transaction.')
    await page.getByTestId('r55-hero-delta').screenshot({ path: resolve(s14R1EvidenceDir, '07-exact-hero-delta-1.png') })
    const results = page.getByTestId('s13-results')
    await expect(results).not.toContainText('HERO.EXACT_CONVERGENCE')
    await expect(results).not.toContainText('EXACT_CONVERGENCE')
    await expect(results).not.toContainText('8877507.348306697')
    const cards = results.locator('.candidate-folder')
    await expect(cards).toHaveCount(12)
    await expect(cards.nth(0)).toContainText(/RECORD \d{3}/)
    await expect(cards.nth(1)).toContainText(/RECORD \d{3}/)
    await cards.nth(1).scrollIntoViewIfNeeded()
    await shot(page, testInfo, '01-broad-neutral-corpus')
  }, onCandidates: async () => {
    await expect(page.getByTestId('r55-hero-delta')).toContainText('The terminal')
    await page.getByTestId('r55-hero-delta').screenshot({ path: resolve(s14R1EvidenceDir, '08-exact-hero-delta-2.png') })
    const compare = page.getByRole('button', { name: 'COMPARE CANDIDATE' })
    await compare.nth(0).click()
    await compare.nth(1).click()
    await expect(page.getByLabel('S13 two-candidate Comparison Tray')).toBeVisible()
    await openCaseboard(page, 'mouse')
    await expect(page.getByText('WORKING THEORY — optional and revisable')).toBeAttached()
  }, onReceipt: async (index, receipt) => {
    if (index !== 1) return
    await shotElement(page, receipt, testInfo, '06-exact-count-query-receipt')
  } })
  await expect(page.getByTestId('r55-hero-delta')).toContainText('I found')
  await expect(page.getByTestId('r55-hero-delta')).toContainText('the exact link.')
  await page.getByTestId('r55-hero-delta').screenshot({ path: resolve(s14R1EvidenceDir, '09-exact-hero-theory.png') })
  await expect(page.getByTestId('s13-brcg')).toHaveCount(0)
  await shot(page, testInfo, '04-direct-path-brcg-absent')
  await completeProof(page, 'mouse', testInfo)
  await gotoTerminalSection(page, 'LEDGER', 'mouse')
  await shot(page, testInfo, 'mutation-ledger-control')
  const terminalText = await page.getByTestId('case-terminal').innerText()
  expect(terminalText).not.toMatch(/provider request id|raw body|account field|remaining credits|credential|private path/i)
  await expect(page.getByTestId('terminal-dialogue')).toHaveCount(0)
  await expect(page.getByText(/PLAY AGAIN|CASE FILE 02|FUTURE ACCESS/i)).toHaveCount(0)
  expect(external).toEqual([])
})

test('keyboard reaches explicit verification and all three Caseboard slots', async ({ page }) => {
  await authorizedReview(page)
  await collectCaseFile(page, 'keyboard')
  await enterTerminal(page, 'keyboard')
  await dispatchCorpusQuestions(page, 'keyboard')
  await completeProof(page, 'keyboard')
})

test.describe('real touch proof path', () => {
  test.use({ hasTouch: true })
  test('touch reaches explicit verification and all three Caseboard slots', async ({ page }) => {
    await authorizedReview(page)
    await collectCaseFile(page, 'touch')
    await enterTerminal(page, 'touch')
    await dispatchCorpusQuestions(page, 'touch')
    await completeProof(page, 'touch')
  })
})

test('selected source and partial proof survive reload and terminal re-entry', async ({ page }) => {
  await authorizedReview(page)
  await collectCaseFile(page, 'mouse')
  await enterTerminal(page, 'mouse')
  await dispatchCorpusQuestions(page, 'mouse')
  await page.getByRole('button', { name: /^INSPECT SOURCE/ }).click()
  await expect(page.getByTestId('s13-source')).toContainText('survival is not proof')
  await page.waitForFunction(() => Object.values(localStorage).some(value => value.includes('S13_SELECT_RECORD')))
  await page.reload()
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await enterTerminal(page, 'mouse')
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section', 'SOURCE')
  await expect(page.getByTestId('s13-source')).toContainText('survival is not proof')
  await page.getByRole('button', { name: 'VERIFY SURVIVING RECEIPT' }).click()
  await openCaseboard(page, 'mouse')
  await page.getByRole('button', { name: 'FILE AMOUNT' }).click()
  await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
  await enterTerminal(page, 'mouse')
  await openCaseboard(page, 'mouse')
  await expect(page.getByLabel('Persistent Caseboard')).toContainText('AMOUNT: ◆ EXACT FILED')
  await page.reload()
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await enterTerminal(page, 'mouse')
  await openCaseboard(page, 'mouse')
  await expect(page.getByLabel('Persistent Caseboard')).toContainText('AMOUNT: ◆ EXACT FILED')
  await expect(page.getByLabel('Persistent Caseboard')).toContainText('RECEIVER: ◇ OPEN')
  await page.getByRole('button', { name: 'FILE RECEIVER' }).click()
  await page.getByRole('button', { name: 'FILE LINK' }).click()
  await expect(page.getByTestId('bounded-case-complete')).toContainText('COMPLETION READY')
  await page.reload()
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await enterTerminal(page, 'mouse')
  await openCaseboard(page, 'mouse')
  await expect(page.getByTestId('bounded-case-complete')).toContainText('COMPLETION READY')
  await expect(page.getByLabel('Persistent Caseboard')).toContainText('LINK: ◆ EXACT FILED')
})

test('BRCG is absent directly and visible only after the accepted BACK_READ world unlock', async ({ page }, testInfo) => {
  test.setTimeout(300_000)
  await authorizeWithoutCaseFile(page)
  await collectCaseFile(page, 'mouse')
  await collectOptionalDrawer(page, 'mouse')
  await enterTerminal(page, 'mouse')
  await gotoTerminalSection(page, 'EXPLORE', 'mouse')
  await expect(page.getByRole('button', { name: /DISPATCH QUESTION/ })).toHaveCount(0)
  await expect(page.getByTestId('s13-brcg')).toHaveCount(0)
  await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
  await page.getByTestId('verb-open').click()
  await page.getByTestId('inventory-small-toolbox-closed').click()
  await drainBrowserSpeech(page, 'KEYBOARD')
  await page.getByTestId('verb-use').click()
  await page.getByTestId('inventory-hammer').click()
  await page.getByTestId('inventory-piggy-bank-intact').click()
  await drainBrowserSpeech(page, 'KEYBOARD')
  await page.getByTestId('verb-look-at').click()
  await page.getByTestId('inventory-fictional-token-note').click()
  for (let guard = 0; guard < 16 && await page.getByTestId('speech-panel').count(); guard++) await page.getByTestId('speech-panel').click()
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-note-read', 'BACK_READ')
  await enterTerminal(page, 'mouse')
  await gotoTerminalSection(page, 'EXPLORE', 'mouse')
  await expect(page.getByTestId('s13-brcg')).toBeAttached()
  await expect(page.getByTestId('s13-brcg')).toContainText('NO_MATCH_IN_ACCEPTED_CORPUS')
  await page.getByTestId('s13-brcg').scrollIntoViewIfNeeded()
  await shot(page, testInfo, '05-brcg-unlocked-by-back-read')
})

test('ordinary production controls reach completion-ready and closing does not activate S14 ending content', async ({ page }) => {
  test.setTimeout(300_000)
  const external = await blockExternalNetwork(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'PLAY', exact: true }).click()
  for (let guard = 0; guard < 120; guard++) {
    if (await page.getByTestId('a0-shell').getAttribute('data-intro-complete') === 'true') break
    const panel = page.getByTestId('speech-panel')
    if (await panel.count()) await panel.click()
    await page.waitForTimeout(100)
  }
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-intro-complete', 'true')
  for (const [verb, hotspot, item, item2, , phase] of progressionChain) {
    await page.getByTestId(`verb-${String(verb).toLowerCase().replace('_', '-')}`).click()
    if (item) await page.getByTestId(`inventory-${item}`).click()
    if (hotspot) await page.getByTestId(`hotspot-${hotspot}`).click()
    else if (item2) await page.getByTestId(`inventory-${item2}`).click()
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', String(phase))
    await drainBrowserSpeech(page, 'KEYBOARD')
  }
  await collectCaseFile(page, 'mouse')
  await enterTerminal(page, 'mouse')
  await dispatchCorpusQuestions(page, 'mouse')
  await completeProof(page, 'mouse')
  await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
  await expect(page.getByTestId('case-terminal')).toHaveCount(0)
  await expect(page.getByText(/CASE FILE 02|FUTURE ACCESS|PLAY AGAIN/i)).toHaveCount(0)
  expect(external).toEqual([])
})
