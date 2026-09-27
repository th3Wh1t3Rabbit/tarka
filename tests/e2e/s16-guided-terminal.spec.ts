import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { inflateSync } from 'node:zlib'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { progressionChain } from '../fixtures/s2/domain-helpers'

const evidenceDir = resolve('review/s17-p1/PHASE_A/SCREENSHOTS')
mkdirSync(evidenceDir, { recursive: true })

async function drainWorld(page: Page) {
  let quiet = 0
  for (let guard = 0; guard < 240 && quiet < 3; guard += 1) {
    const speech = page.getByTestId('speech-panel')
    if (await speech.count()) {
      const catchSurface = page.getByTestId('talk-advance-catch')
      const pointerTarget = await catchSurface.count() ? catchSurface : speech
      await pointerTarget.click()
      quiet = 0
    }
    else if (await page.getByTestId('active-sequence').count() || await page.getByTestId('rook-sprite').getAttribute('data-animation') === 'walkEast') quiet = 0
    else quiet += 1
    await page.waitForTimeout(100)
  }
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
  await expect(page.getByTestId('active-sequence')).toHaveCount(0)
}

async function authorize(page: Page) {
  for (const [verb, hotspot, item, item2, , phase] of progressionChain) {
    await page.getByTestId(`verb-${String(verb).toLowerCase().replace('_', '-')}`).click()
    if (item) await page.getByTestId(`inventory-${item}`).click()
    if (hotspot) await page.getByTestId(`hotspot-${hotspot}`).click({ force: true })
    else if (item2) await page.getByTestId(`inventory-${item2}`).click()
    if (phase !== 'COMPLETE') await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', String(phase), { timeout: 20_000 })
    await drainWorld(page)
  }
}

async function openTerminal(page: Page) {
  await page.getByTestId('verb-use').click()
  await page.getByTestId('hotspot-nansen-terminal').click({ force: true })
  await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 20_000 })
}

async function quickStart(page: Page) {
  await page.goto('/?skipIntro=1&review=1')
  const hadCaseSave = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('trace-case-v1:'))
    for (const key of keys) localStorage.removeItem(key)
    return keys.length > 0
  })
  if (hadCaseSave) await page.reload()
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await page.getByTestId('review-mode').evaluate(element => { element.style.display = 'none' })
  await openTerminal(page)
}

async function collectCaseFile(page: Page) {
  await page.getByTestId('verb-open').click()
  await page.getByTestId('hotspot-official-case-file-cabinet').click({ force: true })
  await drainWorld(page)
  await page.getByTestId('verb-pick-up').click()
  await page.getByTestId('hotspot-disorderly-stack-of-confidential-files').click({ force: true })
  await drainWorld(page)
  await expect(page.getByTestId('inventory-euler-case-file')).toBeVisible()
}

async function expectTerminalContentFits(page: Page) {
  const overflow = await page.getByTestId('terminal-dom-safe').evaluate(safe => {
    const bounds = safe.getBoundingClientRect()
    const outside = (rect: DOMRect) => rect.width > 0 && rect.height > 0 && (rect.left < bounds.left - 1 || rect.top < bounds.top - 1 || rect.right > bounds.right + 1 || rect.bottom > bounds.bottom + 1)
    const failures: string[] = []
    for (const element of safe.querySelectorAll<HTMLElement>('.case-terminal *')) {
      // Prototype CRT paint intentionally begins outside the logical screen
      // and is clipped by the stationary aperture; it is not content overflow.
      if (element.closest('.s16-crt-effects')) continue
      const style = getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      const rect = element.getBoundingClientRect()
      if (outside(rect)) failures.push(`${element.tagName}.${element.className}[${element.textContent?.trim().slice(0, 24)}](${rect.left.toFixed(2)},${rect.top.toFixed(2)},${rect.right.toFixed(2)},${rect.bottom.toFixed(2)})/SAFE(${bounds.left.toFixed(2)},${bounds.top.toFixed(2)},${bounds.right.toFixed(2)},${bounds.bottom.toFixed(2)})`)
    }
    const walker = document.createTreeWalker(safe.querySelector('.case-terminal')!, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue
      const range = document.createRange(); range.selectNodeContents(node)
      for (const rect of range.getClientRects()) if (outside(rect)) failures.push(`TEXT:${node.textContent.trim().slice(0, 32)}`)
    }
    return [...new Set(failures)]
  })
  expect(overflow).toEqual([])
}

function decodePng(bytes: Buffer) {
  if (bytes.subarray(1, 4).toString() !== 'PNG') throw new Error('Expected a PNG screenshot')
  let offset = 8, width = 0, height = 0, colorType = 0
  const compressed: Buffer[] = []
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset); const type = bytes.subarray(offset + 4, offset + 8).toString(); const data = bytes.subarray(offset + 8, offset + 8 + length); offset += 12 + length
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]! }
    if (type === 'IDAT') compressed.push(data)
    if (type === 'IEND') break
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0
  if (!width || !height || !channels) throw new Error(`Unsupported PNG format ${width}×${height}, color ${colorType}`)
  const raw = inflateSync(Buffer.concat(compressed)); const stride = width * channels; const pixels = Buffer.alloc(stride * height)
  const paeth = (a: number, b: number, c: number) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
  for (let y = 0, source = 0; y < height; y += 1) {
    const filter = raw[source++]!
    for (let x = 0; x < stride; x += 1) {
      const value = raw[source++]!, left = x >= channels ? pixels[y * stride + x - channels]! : 0, up = y ? pixels[(y - 1) * stride + x]! : 0, upperLeft = y && x >= channels ? pixels[(y - 1) * stride + x - channels]! : 0
      pixels[y * stride + x] = (value + (filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : paeth(left, up, upperLeft))) & 255
    }
  }
  return { width, height, channels, pixels }
}

function changedOutsideAperture(baselineBytes: Buffer, activeBytes: Buffer, terminal: { x: number; y: number; width: number; height: number }, aperture: { x: number; y: number; width: number; height: number }, excluded: { x: number; y: number; width: number; height: number } | null) {
  const baseline = decodePng(baselineBytes), active = decodePng(activeBytes)
  expect({ width: active.width, height: active.height, channels: active.channels }).toEqual({ width: baseline.width, height: baseline.height, channels: baseline.channels })
  let changed = 0
  for (let y = Math.floor(terminal.y); y < Math.ceil(terminal.y + terminal.height); y += 1) for (let x = Math.floor(terminal.x); x < Math.ceil(terminal.x + terminal.width); x += 1) {
    const insideAperture = x >= Math.floor(aperture.x) && x < Math.ceil(aperture.x + aperture.width) && y >= Math.floor(aperture.y) && y < Math.ceil(aperture.y + aperture.height)
    const insideExcluded = excluded && x >= Math.floor(excluded.x) && x < Math.ceil(excluded.x + excluded.width) && y >= Math.floor(excluded.y) && y < Math.ceil(excluded.y + excluded.height)
    if (insideAperture || insideExcluded) continue
    const index = (y * baseline.width + x) * baseline.channels
    if (Array.from({ length: Math.min(3, baseline.channels) }).some((_, channel) => Math.abs(baseline.pixels[index + channel]! - active.pixels[index + channel]!) > 8)) changed += 1
  }
  return changed
}

function unexplainedRasterPixels(actual: ReturnType<typeof decodePng>, expected: ReturnType<typeof decodePng>, radius = 2, channelTolerance = 60) {
  let unexplained = 0
  for (let y = 0; y < actual.height; y += 1) for (let x = 0; x < actual.width; x += 1) {
    const actualIndex = (y * actual.width + x) * actual.channels
    let locallyExplained = false
    for (let dy = -radius; dy <= radius && !locallyExplained; dy += 1) for (let dx = -radius; dx <= radius && !locallyExplained; dx += 1) {
      const expectedX = x + dx, expectedY = y + dy
      if (expectedX < 0 || expectedY < 0 || expectedX >= expected.width || expectedY >= expected.height) continue
      const expectedIndex = (expectedY * expected.width + expectedX) * expected.channels
      locallyExplained = Array.from({ length: Math.min(3, actual.channels) }).every((_, channel) => Math.abs(actual.pixels[actualIndex + channel]! - expected.pixels[expectedIndex + channel]!) <= channelTolerance)
    }
    if (!locallyExplained) unexplained += 1
  }
  return unexplained
}

async function runQuery(page: Page, button = 'BUILD QUERY') {
  await page.getByRole('button', { name: button, exact: true }).click()
  await expect(page.getByTestId('pre-dispatch-query-receipt')).toBeVisible()
  await page.getByRole('button', { name: 'RUN QUERY', exact: true }).click()
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section', 'RESULTS')
}

async function solveToVerified(page: Page) {
  await runQuery(page)
  await expect(page.getByText(/The three records describe two steps/)).toBeVisible()
  await page.getByRole('button', { name: 'VIEW 3 MATCHES' }).click()
  await page.getByRole('button', { name: 'OPEN EARLIEST TRANSFER' }).click()
  await page.getByRole('button', { name: 'SAVE TO CASE' }).click()
  await page.getByRole('button', { name: 'NEXT', exact: true }).click()
  await page.getByRole('button', { name: 'SAVE TO CASE' }).click()
  await page.getByTestId('terminal-section-case').click()
  await runQuery(page, 'BUILD CONNECTION QUERY')
  await expect(page.getByTestId('s16-taskbar')).toContainText('CONNECTION SEARCH COMPLETE')
  await page.getByRole('button', { name: 'OPEN TRANSACTION' }).click()
  await page.getByRole('button', { name: 'CONFIRM CONNECTION' }).click()
  await expect(page.getByRole('button', { name: 'SAVE CASE' })).toBeVisible()
}

test('actual room gating blocks unauthorized entry and file contact alone reveals case questions', async ({ page }) => {
  await page.addInitScript(() => {
    for (const key of Object.keys(localStorage)) if (key.startsWith('trace-case-v1:')) localStorage.removeItem(key)
  })
  await page.goto('/?skipIntro=1&review=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await drainWorld(page)
  await page.getByTestId('verb-use').click()
  await page.getByTestId('hotspot-nansen-terminal').click({ force: true })
  await drainWorld(page)
  await expect(page.getByTestId('case-terminal')).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await drainWorld(page)
  await page.getByLabel('Jump to puzzle state').selectOption('FORM_COMPLETED')
  await page.getByTestId('verb-give').click()
  await page.getByTestId('inventory-signed-terminal-authorization-form-with-doodles').click()
  await page.getByTestId('hotspot-mr-index').click({ force: true })
  await drainWorld(page)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'COMPLETE')
  await page.getByTestId('review-mode').evaluate(element => { element.style.display = 'none' })
  await openTerminal(page)
  await page.getByTestId('terminal-section-explore').click()
  const questionTypes = page.getByRole('button', { name: /QUESTION TYPES/ })
  await expect(questionTypes).toBeVisible()
  await expect(questionTypes).toBeDisabled()
  await expect(page.getByText(/Collect the Euler file to unlock case questions/)).toBeVisible()
  await page.getByRole('button', { name: 'RETURN TO OFFICE' }).click()
  await collectCaseFile(page)
  await openTerminal(page)
  await page.getByTestId('terminal-section-case').click()
  await expect(page.getByRole('button', { name: 'BUILD QUERY', exact: true })).toBeVisible()
})

test('native investigation has two real guided runs, complete pagination, contextual source, and atomic filing', async ({ page, context }) => {
  const external: string[] = []
  await context.route('**/*', async route => { const url = new URL(route.request().url()); if (url.hostname === '127.0.0.1') return route.continue(); external.push(route.request().url()); return route.abort('blockedbyclient') })
  await quickStart(page)
  await expect(page.locator('.s16-nav button')).toHaveText(['CASE', 'EXPLORE'])
  await page.getByTestId('terminal-section-explore').click()
  await page.getByRole('button', { name: /ALL RECORDS/ }).click()
  await expect(page.locator('.s16-record-row')).toHaveCount(8)
  await expect(page.getByText(/1–8 of 98 · 1\/13/)).toBeVisible()
  for (let index = 0; index < 12; index += 1) await page.getByRole('button', { name: 'NEXT', exact: true }).click()
  await expect(page.locator('.s16-record-row')).toHaveCount(2)
  await expect(page.getByText(/97–98 of 98 · 13\/13/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'NEXT', exact: true })).toBeDisabled()
  await page.locator('.s16-record-row').last().click()
  await expect(page.getByText(/WHAT IT SHOWS/)).toBeVisible()
  const meaningHeights = await page.locator('.s16-meaning section p').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height))
  const terminalScale = Number(await page.getByTestId('terminal-viewport').getAttribute('data-integer-scale'))
  expect(meaningHeights).toHaveLength(2)
  for (const height of meaningHeights) expect(height / terminalScale).toBeGreaterThanOrEqual(26.8)
  await page.getByRole('button', { name: 'MORE DETAILS' }).click()
  await expect(page.getByText('TRANSACTION DETAILS', { exact: true })).toBeVisible()
  await expect(page.getByText(/E03|PUBLIC-SAFE|GATE|TASK ID/i)).toHaveCount(0)
  await page.getByRole('button', { name: '← SUMMARY' }).click()
  await page.getByRole('button', { name: '← ALL RECORDS' }).click()
  await expect(page.getByText(/97–98 of 98 · 13\/13/)).toBeVisible()

  await page.getByTestId('terminal-section-case').click()
  await solveToVerified(page)
  await expect(page.getByTestId('s16-screen-body')).toContainText('11:38:11 UTC transaction')
  await page.getByRole('button', { name: 'SAVE CASE' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'KEEP INVESTIGATING' }).click()
  await expect(page.getByRole('button', { name: 'CLOSE CASE', exact: true })).toBeFocused()
  await page.getByTestId('terminal-section-history').click()
  const history = page.getByTestId('s16-screen-body').locator('.s16-choice')
  await expect(history).toHaveCount(2)
  await expect(page.getByTestId('s16-screen-body')).not.toContainText('98 → 98')
  await expect(history.nth(0)).toContainText('Exact connection')
  await expect(history.nth(0)).toContainText('1 matching record (of 3 searched)')
  await expect(history.nth(1)).toContainText('DAI + amount')
  await expect(history.nth(1)).toContainText('3 matching records (of 98 searched)')
  await history.nth(1).click()
  await page.getByRole('button', { name: 'VIEW 3 MATCHES' }).click()
  await expect(page.locator('.s16-record-row')).toHaveCount(3)
  await page.getByTestId('terminal-section-case').click()
  await expect(page.getByTestId('bounded-case-complete')).toBeVisible()
  await page.screenshot({ path: resolve(evidenceDir, '01-findings-filed-routes-retained.png') })
  expect(external).toEqual([])
})

test('optional query creates truthful history without changing case progress', async ({ page }) => {
  await quickStart(page)
  await page.getByTestId('terminal-section-explore').click()
  await page.getByRole('button', { name: 'QUESTION TYPES' }).click()
  await page.getByRole('button', { name: /WHAT MOVED/ }).click()
  await page.getByRole('button', { name: /Which transfers moved DAI/ }).click()
  await page.getByRole('button', { name: 'RUN QUERY' }).click()
  await expect(page.getByText('74 matching records (of 98 searched)', { exact: true })).toBeVisible()
  await page.getByTestId('terminal-section-case').click()
  await expect(page.getByRole('button', { name: 'BUILD QUERY' })).toBeVisible()
  await page.getByTestId('terminal-section-history').click()
  await expect(page.getByTestId('s16-screen-body').locator('.s16-choice')).toHaveCount(1)
  await expect(page.getByTestId('s16-screen-body').locator('.s16-choice')).toContainText('DAI transfers')
})

test('source origin stays exact and same-hash context cannot verify', async ({ page }) => {
  await quickStart(page)
  await runQuery(page)
  await page.getByRole('button', { name: 'VIEW 3 MATCHES' }).click()
  await page.getByRole('button', { name: /Later transfer · supporting entry/ }).click()
  await expect(page.getByRole('button', { name: 'VERIFY RECEIPT' })).toHaveCount(0)
  await page.getByRole('button', { name: 'MORE DETAILS' }).click()
  await page.getByRole('button', { name: 'NEXT', exact: true }).click()
  await expect(page.getByText('NANSEN TRANSFER RECORD')).toBeVisible()
  await expect(page.getByText('tgm/transfers')).toBeVisible()
  await expect(page.getByText(/REQUEST BODY|ISSUED|COMPLETED/i)).toHaveCount(0)
  await page.getByRole('button', { name: '← SUMMARY' }).click()
  await page.getByRole('button', { name: '← MATCHES' }).click()
  await page.getByRole('button', { name: 'OPEN EARLIEST TRANSFER' }).click()
  await page.getByRole('button', { name: 'SAVE TO CASE' }).click()
  await page.getByRole('button', { name: 'NEXT', exact: true }).click()
  await page.getByRole('button', { name: 'SAVE TO CASE' }).click()
  await page.getByTestId('terminal-section-case').click()
  await runQuery(page, 'BUILD CONNECTION QUERY')
  await page.getByRole('button', { name: 'OPEN TRANSACTION' }).click()
  await page.getByRole('button', { name: 'MORE DETAILS' }).click()
  await page.getByRole('button', { name: 'NEXT', exact: true }).click()
  await expect(page.getByText('CASE TRANSACTION')).toBeVisible()
  await expect(page.locator('.s16-source-fields dt')).toHaveText(['NETWORK', 'TOKEN', 'CONTRACT', 'WHEN'])
  await expect(page.getByText(/Related entries are separate views, not additional transactions/)).toBeVisible()
  await expect(page.getByText('tgm/transfers')).toHaveCount(0)
  await page.screenshot({ path: resolve(evidenceDir, '02-exact-case-source-origin.png') })
})

test('either admitted Q2 later view adds the route and old Q2 history leads to the real Q3 result', async ({ page }) => {
  await quickStart(page)
  await runQuery(page)
  await page.getByRole('button', { name: 'VIEW 3 MATCHES' }).click()
  await page.getByRole('button', { name: 'OPEN EARLIEST TRANSFER' }).click()
  await page.getByRole('button', { name: 'SAVE TO CASE' }).click()
  await page.getByRole('button', { name: 'NEXT', exact: true }).click()
  await page.getByRole('button', { name: 'NEXT', exact: true }).click()
  await expect(page.getByRole('button', { name: 'SAVE TO CASE' })).toBeVisible()
  await page.getByRole('button', { name: 'SAVE TO CASE' }).click()
  await page.getByTestId('terminal-section-case').click()
  await runQuery(page, 'BUILD CONNECTION QUERY')

  await page.getByTestId('terminal-section-history').click()
  await page.getByTestId('s16-screen-body').locator('.s16-choice').filter({ hasText: 'DAI + amount' }).click()
  await expect(page.getByRole('button', { name: 'BUILD CONNECTION QUERY' })).toHaveCount(0)
  await page.getByRole('button', { name: 'VIEW 3 MATCHES' }).click()
  await expect(page.getByRole('button', { name: 'OPEN TRANSACTION' })).toBeVisible()
  await page.getByRole('button', { name: /Later transfer · transaction/ }).click()
  await expect(page.getByRole('button', { name: 'CONFIRM CONNECTION' })).toHaveCount(0)
  await page.getByRole('button', { name: 'OPEN TRANSACTION' }).click()
  await expect(page.getByRole('button', { name: 'CONFIRM CONNECTION' })).toBeVisible()
})

test('later-first save remains selected and survives reload before the separate earlier clue', async ({ page }) => {
  await quickStart(page)
  await runQuery(page)
  await page.getByRole('button', { name: 'VIEW 3 MATCHES' }).click()
  await page.getByRole('button', { name: /Later transfer · supporting entry/ }).click()
  await page.getByRole('button', { name: 'SAVE TO CASE' }).click()
  await expect(page.locator('.s16-task-title')).toHaveText('SAME TRANSACTION · SUPPORTING ENTRY')
  await expect(page.getByRole('button', { name: 'SAVE TO CASE' })).toHaveCount(0)
  await page.getByRole('button', { name: '← MATCHES' }).click()
  await expect(page.locator('.s16-record-row[data-case-state="SAVED"]')).toContainText('supporting entry')
  await expect(page.locator('.s16-record-row[data-case-state="RELATED"]')).toContainText('transaction')
  await page.getByTestId('terminal-section-case').click()
  await expect(page.getByText('NOW SAVE THE EARLIER TRANSFER.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'BUILD CONNECTION QUERY' })).toHaveCount(0)
  await page.waitForTimeout(100)
  await page.reload()
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await page.getByTestId('review-mode').evaluate(element => { element.style.display = 'none' })
  await openTerminal(page)
  await expect(page.getByText('NOW SAVE THE EARLIER TRANSFER.')).toBeVisible()
  await page.getByRole('button', { name: 'OPEN EARLIEST TRANSFER' }).click()
  await page.getByRole('button', { name: 'SAVE TO CASE' }).click()
  await expect(page.locator('.s16-task-title')).toHaveText('EARLIER TRANSFER')
  await page.getByTestId('terminal-section-case').click()
  await expect(page.getByRole('button', { name: 'BUILD CONNECTION QUERY' })).toBeVisible()
})

test('record and source navigation stay inside the selected origin until exit; re-entry starts on CASE', async ({ page }) => {
  await quickStart(page)
  await runQuery(page)
  await page.getByRole('button', { name: 'VIEW 3 MATCHES' }).click()
  await page.getByRole('button', { name: 'OPEN EARLIEST TRANSFER' }).click()
  const footer = page.locator('.s16-record-nav')
  await expect(footer.getByRole('button', { name: 'PREV', exact: true })).toBeDisabled()
  await expect(footer).toContainText('1 / 3 records')
  await footer.getByRole('button', { name: 'NEXT', exact: true }).click()
  await expect(page.locator('.s16-task-title')).toHaveText('LATER TRANSFER')
  await expect(footer).toContainText('2 / 3 records')
  await footer.getByRole('button', { name: 'NEXT', exact: true }).click()
  await expect(footer).toContainText('3 / 3 records')
  await expect(footer.getByRole('button', { name: 'NEXT', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'MORE DETAILS' }).click()
  const pageFooter = page.locator('.s16-page-nav')
  await pageFooter.getByRole('button', { name: 'NEXT', exact: true }).click()
  await pageFooter.getByRole('button', { name: 'NEXT', exact: true }).click()
  await expect(pageFooter).toContainText('3 / 3 pages')
  await page.waitForTimeout(100)
  await page.reload()
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await page.getByTestId('review-mode').evaluate(element => { element.style.display = 'none' })
  await openTerminal(page)
  await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-section', 'CASE')
  await expect(page.getByText('FOLLOW THE MATCHING TRANSFERS')).toBeVisible()
  await expect(page.getByRole('button', { name: 'VIEW 3 MATCHES' })).toBeVisible()
  await expect(page.getByText('SAVED TRANSACTION FIELDS')).toHaveCount(0)
})

test('eight-row terminal content remains inside the accepted 393×219 opening at integer scales', async ({ page }) => {
  for (const viewport of [{ width: 480, height: 270 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport)
    await quickStart(page)
    await page.getByTestId('terminal-section-explore').click()
    await page.getByRole('button', { name: /ALL RECORDS/ }).click()
    await expect(page.locator('.s16-record-row')).toHaveCount(8)
    await expectTerminalContentFits(page)
  }
})

test('EXPLORE, ALL RECORDS, and full source preserve the approved v0.13 terminal structure', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await quickStart(page)
  const terminal = page.getByTestId('case-terminal')
  const taskbar = page.getByTestId('s16-taskbar')
  const body = page.getByTestId('s16-screen-body')
  const footer = terminal.locator('.s16-footer')

  await page.getByTestId('terminal-section-explore').click()
  await expect(taskbar).toContainText('EXPLORE')
  await expect(taskbar).toContainText('Browse records or ask another question.')
  await expect(body.locator('.s16-choice')).toHaveCount(2)
  await expect(body.getByRole('button', { name: /QUESTION TYPES/ })).toContainText('Choose what to look for.')
  await expect(footer).toHaveText('POWERED BY NANSEN API')

  await body.getByRole('button', { name: /ALL RECORDS/ }).click()
  await expect(taskbar).toContainText('UNFILTERED RECORDS')
  await expect(taskbar).toContainText('No active filter · no ranking')
  await expect(body.locator('.s16-table-head span')).toHaveText(['TIME', 'TOKEN', 'SENDER → RECEIVER'])
  await expect(body.locator('.s16-record-row')).toHaveCount(8)
  await expect(body.locator('.s16-record-row .s16-asset').first()).toHaveText(/^(DAI|stETH|wstETH|USDC|WBTC|UNIDENTIFIED)$/)
  await expect(body).not.toContainText('Earlier transfer')
  await expect(footer).toContainText('1–8 of 98 · 1/13')
  await expect(footer).not.toContainText('ACCESS APPROVED')

  const listGeometry = await terminal.evaluate((node) => {
    const header = node.querySelector<HTMLElement>('.s16-table-head')!
    const row = node.querySelector<HTMLElement>('.s16-record-row')!
    const footer = node.querySelector<HTMLElement>('.s16-footer')!
    const attribution = node.querySelector<HTMLElement>('.s16-attribution')!.getBoundingClientRect()
    const pager = node.querySelector<HTMLElement>('.s16-page-nav')!.getBoundingClientRect()
    return {
      headerColumns: getComputedStyle(header).gridTemplateColumns,
      rowColumns: getComputedStyle(row).gridTemplateColumns,
      rowHeight: getComputedStyle(row).height,
      footerDisplay: getComputedStyle(footer).display,
      footerSeparated: attribution.right <= pager.left,
    }
  })
  expect(listGeometry).toEqual({ headerColumns: '43px 34px 286px', rowColumns: '43px 34px 284px', rowHeight: '12px', footerDisplay: 'flex', footerSeparated: true })

  await body.locator('.s16-record-row').first().click()
  await page.getByRole('button', { name: 'MORE DETAILS', exact: true }).click()
  await expect(taskbar).toContainText('RECORD DETAILS')
  await expect(taskbar).toContainText('Full fields')
  await expect(body).toContainText('TRANSACTION DETAILS')
  await expect(body.locator('.s16-source-fields dt')).toHaveText(['WHEN', 'TOKEN', 'AMOUNT', 'FROM', 'TO', 'TX HASH'])
  await expect(body.getByRole('button', { name: /Copy/i })).toHaveCount(0)
  await expect(body).not.toContainText('COPY')
  await expect(body.locator('.s16-source-fields')).toHaveCSS('grid-template-columns', '49px 325px')
  await expect(footer).toContainText('1 / 3 pages')
  await footer.getByRole('button', { name: 'NEXT', exact: true }).click()
  await expect(body).toContainText(/NANSEN TRANSFER RECORD|CASE TRANSACTION/)
  await expect(body).not.toContainText('COPY')
  await footer.getByRole('button', { name: 'NEXT', exact: true }).click()
  await expect(body).toContainText('SAVED TRANSACTION FIELDS')
  await expect(body).not.toContainText('COPY')
  await expectTerminalContentFits(page)
})

test('production and the exact v0.13 authority match visible tree, controls, and computed presentation in shared states', async ({ page, context }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1280, height: 720 })
  await quickStart(page)
  const prototype = await context.newPage()
  await prototype.setViewportSize({ width: 1280, height: 720 })
  await prototype.goto(pathToFileURL(resolve('/tmp/trace-s17-p2-r3-packet.uDKse7/EVIDENCE/TARKA_S16_TERMINAL_FLOW_PROTOTYPE_v0.13.0.html')).href)
  await prototype.locator('#freshFileBtn').click()
  // Freeze only the prototype's intermittent signal-jitter clock in this
  // presentation comparison. The separate degauss qualification below keeps
  // all production motion and audio live.
  const parityClockFreeze = `
    .s16-terminal, .s16-terminal *, .screen, .screen *, .crt-layer, .crt-layer * {
      animation-play-state: paused !important;
      animation-delay: -420ms !important;
    }
    .signal-jitter { animation: none !important; }
    .signal-jitter .signal-band,
    .signal-jitter .s16-signal-band { animation: none !important; opacity: 0 !important; }
    .crt-layer, .s16-crt-effects { display: none !important; }
    .scanlines, .s16-scanlines { animation: none !important; opacity: 0 !important; transform: none !important; }
    /* The two documents instantiate their procedural noise textures at
       different lifecycle moments. Remove that nondeterministic paint only
       for static parity captures; live CRT motion is tested separately. */
    .noise, .s16-noise { animation: none !important; opacity: 0 !important; transform: none !important; }
  `
  await page.addStyleTag({ content: parityClockFreeze })
  await prototype.addStyleTag({ content: parityClockFreeze })
  // The game is integer-scaled while the standalone authority is vertically
  // centered at a fractional CSS pixel. Align their logical-stage origins so
  // Chromium samples both rasters on the same physical pixel grid.
  const productionOrigin = (await page.locator('.s16-terminal').boundingBox())!
  const prototypeOrigin = (await prototype.locator('.screen').boundingBox())!
  await prototype.locator('.stage').evaluate((stage, delta) => {
    ;(stage as HTMLElement).style.translate = `${delta.x}px ${delta.y}px`
  }, { x: productionOrigin.x - prototypeOrigin.x, y: productionOrigin.y - prototypeOrigin.y })

  const parityEvidence = process.env.S17_P2_R3_EVIDENCE === '1'
  const parityRoot = resolve('review/s17-p2-r3/TERMINAL_PARITY')
  const parityStates: Array<Record<string, unknown>> = []
  if (parityEvidence) mkdirSync(parityRoot, { recursive: true })

  const visibleText = async (target: Page, selector: string) => target.locator(selector).evaluate(root => (root as HTMLElement).innerText.replace(/\s+/g, ' ').trim())
  const controls = async (target: Page, selector: string) => target.locator(selector).evaluate(root => [...root.querySelectorAll<HTMLElement>('button')].filter(node => {
    const style = getComputedStyle(node)
    return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0
  }).map(node => ({ label: node.textContent?.replace(/\s+/g, ' ').trim() ?? '', disabled: (node as HTMLButtonElement).disabled })))
  const style = async (target: Page, selector: string) => target.locator(selector).first().evaluate(node => {
    const value = getComputedStyle(node)
    const rect = node.getBoundingClientRect()
    const parent = node.closest('.screen,.s16-terminal')?.getBoundingClientRect() ?? rect
    return {
      bounds: { x: Math.round((rect.x - parent.x) * 100) / 100, y: Math.round((rect.y - parent.y) * 100) / 100, width: Math.round(rect.width * 100) / 100, height: Math.round(rect.height * 100) / 100 },
      display: value.display, position: value.position, fontFamily: value.fontFamily, fontSize: value.fontSize, fontWeight: value.fontWeight, lineHeight: value.lineHeight,
      gridTemplateRows: value.gridTemplateRows, gridTemplateColumns: value.gridTemplateColumns, padding: value.padding, margin: value.margin, gap: value.gap,
      border: value.border, backgroundColor: value.backgroundColor, color: value.color, overflow: value.overflow,
      animationName: value.animationName, animationDuration: value.animationDuration, animationTimingFunction: value.animationTimingFunction,
    }
  })
  const compareState = async (name: string, extra: Array<[string, string]> = []) => {
    const productionText = await visibleText(page, '.s16-terminal')
    const prototypeText = await visibleText(prototype, '.screen')
    const productionControls = await controls(page, '.s16-terminal')
    const prototypeControls = await controls(prototype, '.screen')
    expect(productionText, `${name}: visible text`).toEqual(prototypeText)
    expect(productionControls, `${name}: control inventory`).toEqual(prototypeControls)
    const selectors: Array<[string, string]> = [
      ['.s16-terminal', '.screen'], ['.s16-topline', '.topline'], ['.s16-nav', '.tabs'], ['.s16-taskbar', '.taskbar'], ['.s16-body', '.body'], ['.s16-footer', '.footer'],
      ...extra,
    ]
    for (const [productionSelector, prototypeSelector] of selectors) expect(await style(page, productionSelector), `${name}: ${productionSelector}`).toEqual(await style(prototype, prototypeSelector))
    if (parityEvidence) {
      // Capture the ordinary resting state rather than whichever control the
      // preceding scripted navigation happened to leave focused or hovered.
      // Focus presentation is asserted independently below on record rows.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      await prototype.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      await page.mouse.move(1270, 710)
      await prototype.mouse.move(1270, 710)
      const productionPath = resolve(parityRoot, `${name}.production.png`)
      const prototypePath = resolve(parityRoot, `${name}.prototype-v0.13.png`)
      const productionBox = (await page.locator('.s16-terminal').boundingBox())!
      const prototypeBox = (await prototype.locator('.screen').boundingBox())!
      // The stage-origin normalization above makes these bounds identical.
      // Capture the actual screens in place: reparenting their surrounding
      // masks changes the prototype's inset containing block and can clip its
      // right-side pager, creating a false difference in the evidence itself.
      expect(productionBox, `${name}: production/prototype screen bounds`).toEqual(prototypeBox)
      const productionPng = await page.locator('.s16-terminal').screenshot({ path: productionPath, animations: 'disabled' })
      const prototypePng = await prototype.locator('.screen').screenshot({ path: prototypePath, animations: 'disabled' })
      const productionRaster = decodePng(productionPng)
      const prototypeRaster = decodePng(prototypePng)
      expect({ width: productionRaster.width, height: productionRaster.height, channels: productionRaster.channels }, `${name}: raster dimensions`).toEqual({ width: prototypeRaster.width, height: prototypeRaster.height, channels: prototypeRaster.channels })
      let pixelMismatchCount = 0
      for (let index = 0; index < productionRaster.pixels.length; index += productionRaster.channels) {
        if (Array.from({ length: productionRaster.channels }).some((_, channel) => productionRaster.pixels[index + channel] !== prototypeRaster.pixels[index + channel])) pixelMismatchCount += 1
      }
      const unexplainedPixelCount = unexplainedRasterPixels(productionRaster, prototypeRaster)
      expect(unexplainedPixelCount, `${name}: unexplained raster pixels after a one-logical-pixel anti-alias allowance; rawMismatch=${pixelMismatchCount}; production=${JSON.stringify(productionBox)} prototype=${JSON.stringify(prototypeBox)}`).toBe(0)
      parityStates.push({ name, visibleTextExact: true, controlsExact: true, computedPresentationExact: true, rawPixelMismatchCount: pixelMismatchCount, rasterAllowance: { radiusPhysicalPixels: 2, radiusLogicalPixels: 1, perChannelTolerance: 60, purpose: 'subpixel text anti-aliasing only; exact text, controls, bounds, font, color, borders, layout, and state are asserted separately' }, unexplainedPixelCount, productionCapture: `TERMINAL_PARITY/${name}.production.png`, prototypeCapture: `TERMINAL_PARITY/${name}.prototype-v0.13.png` })
    }
  }

  await compareState('CASE_WITH_FILE', [['.s16-narrative', '.narrative']])

  await page.getByTestId('terminal-section-explore').click()
  await prototype.locator('[data-action="tab:EXPLORE"]').click()
  await compareState('EXPLORE_HOME', [['.s16-choice', '.choice'], ['.s16-choice small', '.choice small']])

  await page.getByRole('button', { name: /ALL RECORDS/ }).click()
  await prototype.locator('[data-action="all"]').click()
  await compareState('ALL_RECORDS_PAGE_1', [['.s16-table-head', '.table-head'], ['.s16-record-row', '.record-row'], ['.s16-record-row .s16-asset', '.record-row .asset'], ['.s16-page-nav button:last-child', '.page-nav .btn:last-child']])
  await page.locator('.s16-record-row').first().focus()
  await prototype.locator('.record-row').first().focus()
  expect(await style(page, '.s16-record-row')).toEqual(await style(prototype, '.record-row'))

  await page.locator('.s16-record-row').first().click()
  await prototype.locator('.record-row').first().click()
  await page.getByRole('button', { name: 'MORE DETAILS', exact: true }).click()
  await prototype.locator('[data-action="source"]').click()
  await compareState('SOURCE_PAGE_1', [['.s16-source-fields', '.source-fields'], ['.s16-source-fields dt', '.source-fields dt'], ['.s16-source-fields dd', '.source-fields dd']])
  for (const name of ['SOURCE_PAGE_2', 'SOURCE_PAGE_3']) {
    await page.locator('.s16-footer').getByRole('button', { name: 'NEXT', exact: true }).click()
    await prototype.locator('.footer [data-action="next"]').click()
    await compareState(name, [[name === 'SOURCE_PAGE_3' ? '.s16-source-json' : '.s16-source-fields', name === 'SOURCE_PAGE_3' ? '.source-json' : '.source-fields']])
  }

  await page.getByTestId('terminal-section-explore').click()
  await prototype.locator('[data-action="tab:EXPLORE"]').click()
  await page.getByRole('button', { name: /QUESTION TYPES/ }).click()
  await prototype.locator('[data-action="group:ROOT"]').click()
  await compareState('QUESTION_TYPES', [['.s16-lens', '.lens']])

  await page.getByTestId('terminal-section-case').click()
  await prototype.locator('[data-action="tab:CASE"]').click()
  await page.getByRole('button', { name: 'BUILD QUERY', exact: true }).click()
  await prototype.locator('[data-action="build:Q2"]').click()
  await compareState('Q2_BUILD', [['[data-testid="pre-dispatch-query-receipt"]', '.data-stack'], ['.s16-fields', '.fields']])

  await page.getByRole('button', { name: 'RUN QUERY', exact: true }).click()
  await prototype.locator('[data-action="run"]').click()
  await compareState('Q2_RESULT_OVERVIEW', [['.s16-narrative', '.narrative'], ['.s16-small-metrics', '.small-metrics'], ['.s16-metric-cell', '.metric-cell']])

  await page.getByRole('button', { name: 'VIEW 3 MATCHES', exact: true }).click()
  await prototype.locator('[data-action="resultRecords"]').click()
  await compareState('Q2_THREE_MATCH_LIST', [['.s16-match-list-wrap', '.match-list-wrap'], ['.s16-match-row', '.match-row'], ['.s16-match-row b', '.match-row b'], ['.s16-match-row em', '.match-row em'], ['.s16-match-guide', '.match-guide']])

  await page.locator('.s16-body-action button').click()
  await prototype.locator('[data-action="analyze"]').click()
  await compareState('EARLIER_TRANSFER_SUMMARY', [['.s16-record-summary', '.record-summary'], ['.s16-summary-fields', '.summary-fields'], ['.s16-guide p:first-child', '.guide p:first-child'], ['.s16-guide .s16-hint', '.guide .hint'], ['.s16-guide', '.guide']])

  await page.getByRole('button', { name: 'SAVE TO CASE', exact: true }).click()
  await prototype.locator('[data-action="saveSelected"]').click()
  await page.locator('.s16-footer').getByRole('button', { name: 'NEXT', exact: true }).click()
  await prototype.locator('.footer [data-action="recordNext"]').click()
  await compareState('EXACT_LATER_SUMMARY', [['.s16-record-summary', '.record-summary'], ['.s16-summary-fields', '.summary-fields'], ['.s16-guide', '.guide']])

  await page.getByRole('button', { name: 'SAVE TO CASE', exact: true }).click()
  await prototype.locator('[data-action="saveSelected"]').click()
  await page.locator('.s16-footer').getByRole('button', { name: 'NEXT', exact: true }).click()
  await prototype.locator('.footer [data-action="recordNext"]').click()
  await compareState('SUPPORTING_LATER_SUMMARY', [['.s16-record-summary', '.record-summary'], ['.s16-summary-fields', '.summary-fields'], ['.s16-guide', '.guide'], ['.s16-case-save', '.case-save'], ['.s16-saved-state', '.saved-state']])

  await page.getByTestId('terminal-section-case').click()
  await prototype.locator('[data-action="tab:CASE"]').click()
  // Principal correction, 2026-09-26: hunches are outside the MVP. Remove
  // the prototype-only affordance before comparing the retained shared state.
  await prototype.locator('[data-action="hunch"]').evaluate(node => node.remove())
  await compareState('TWO_SAVED_CLUES', [['.s16-narrative', '.narrative']])
  await expect(page.getByText(/hunch/i)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /hunch/i })).toHaveCount(0)

  await page.getByRole('button', { name: 'BUILD CONNECTION QUERY', exact: true }).click()
  await prototype.locator('[data-action="build:Q3"]').click()
  await compareState('Q3_BUILD', [['[data-testid="pre-dispatch-query-receipt"]', '.data-stack'], ['.s16-fields', '.fields']])

  await page.getByRole('button', { name: 'RUN QUERY', exact: true }).click()
  await prototype.locator('[data-action="run"]').click()
  await compareState('Q3_RESULT_OVERVIEW', [['.s16-narrative', '.narrative'], ['.s16-small-metrics', '.small-metrics'], ['.s16-metric-cell', '.metric-cell']])

  await page.getByRole('button', { name: 'OPEN TRANSACTION', exact: true }).click()
  await prototype.locator('[data-action="record:HERO.EXACT_CONVERGENCE"]').click()
  await compareState('Q3_EXACT_TRANSACTION', [['.s16-record-summary', '.record-summary'], ['.s16-summary-fields', '.summary-fields'], ['.s16-guide', '.guide']])

  await page.getByRole('button', { name: 'CONFIRM CONNECTION', exact: true }).click()
  await prototype.locator('[data-action="verify"]').click()
  // The production wording intentionally follows the principal's simplified
  // save-then-confirm flow; normalize the frozen prototype's older label
  // before comparing the otherwise exact shared surface.
  await prototype.locator('[data-action="saveReport"]').evaluate(node => { node.textContent = 'SAVE CASE' })
  await expect(page.getByText(/hunch/i)).toHaveCount(0)
  await compareState('CASE_REPORT_UNSAVED', [['.s16-report', '.report'], ['.s16-proof-grid', '.proof-grid'], ['.s16-proof-line', '.proof-line']])

  await page.getByRole('button', { name: 'SAVE CASE', exact: true }).click()
  await prototype.locator('[data-action="saveReport"]').click()
  await prototype.locator('[data-action="close"]').click()
  await compareState('CLOSE_CONFIRMATION', [['.s16-narrative', '.narrative'], ['.s16-inline-options', '.inline-options']])

  await page.getByRole('button', { name: 'KEEP INVESTIGATING', exact: true }).click()
  await prototype.locator('[data-action="cancelClose"]').click()
  await compareState('CLOSE_CONFIRMATION_RETURN', [['.s16-report', '.report'], ['.s16-proof-grid', '.proof-grid']])

  await page.getByTestId('terminal-section-explore').click()
  await prototype.locator('[data-action="tab:EXPLORE"]').click()
  await page.getByRole('button', { name: /QUESTION TYPES/ }).click()
  await prototype.locator('[data-action="group:ROOT"]').click()
  await page.getByRole('button', { name: /WHAT MOVED/ }).click()
  await prototype.locator('[data-action="group:WHAT"]').click()
  await compareState('OPTIONAL_QUESTION_LIST', [['.s16-choice', '.choice']])

  await page.getByRole('button', { name: /Which transfers moved DAI/ }).click()
  await prototype.locator('[data-action="build:A_DAI"]').click()
  await compareState('OPTIONAL_QUERY_BUILD', [['[data-testid="pre-dispatch-query-receipt"]', '.data-stack'], ['.s16-fields', '.fields']])

  await page.getByRole('button', { name: 'RUN QUERY', exact: true }).click()
  await prototype.locator('[data-action="run"]').click()
  await compareState('OPTIONAL_RESULT_LIST', [['.s16-table-head', '.table-head'], ['.s16-record-row', '.record-row']])

  await page.getByTestId('terminal-section-history').click()
  await prototype.locator('[data-action="tab:LEDGER"]').click()
  await compareState('HISTORY', [['.s16-choice', '.choice']])

  await page.getByRole('button', { name: /DAI \+ amount/ }).click()
  await prototype.locator('[data-action^="history:"]').filter({ hasText: 'DAI + amount' }).click()
  await compareState('HISTORY_REOPEN_Q2', [['.s16-narrative', '.narrative'], ['.s16-small-metrics', '.small-metrics']])
  if (parityEvidence) writeFileSync(resolve(parityRoot, 'EXACT_V013_PARITY_REPORT.json'), `${JSON.stringify({
    schema: 'tarka.s17-p2-r3.exact-terminal-parity.v1',
    authority: 'EVIDENCE/TARKA_S16_TERMINAL_FLOW_PROTOTYPE_v0.13.0.html',
    explicitPrincipalExclusions: ['Prototype hunch/disproval branch is outside the MVP and is not rendered in production.'],
    states: parityStates,
    unexplainedVisibleOrPresentationDifferences: 0,
    result: 'PASS',
  }, null, 2)}\n`)
  await prototype.close()
})

test('authorized pre-file home is the exact v0.13 shared state', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?skipIntro=1&review=1')
  await page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.startsWith('trace-case-v1:')) localStorage.removeItem(key) })
  await page.reload()
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await page.getByLabel('Jump to puzzle state').selectOption('FORM_COMPLETED')
  await page.getByTestId('verb-give').click()
  await page.getByTestId('inventory-signed-terminal-authorization-form-with-doodles').click()
  await page.getByTestId('hotspot-mr-index').click({ force: true })
  await drainWorld(page)
  await page.getByTestId('review-mode').evaluate(element => { element.style.display = 'none' })
  await openTerminal(page)

  const prototype = await context.newPage()
  await prototype.setViewportSize({ width: 1280, height: 720 })
  await prototype.goto(pathToFileURL(resolve('/tmp/trace-s17-p2-r3-packet.uDKse7/EVIDENCE/TARKA_S16_TERMINAL_FLOW_PROTOTYPE_v0.13.0.html')).href)
  await prototype.locator('#resetBtn').click()
  const normalizedText = async (target: Page, selector: string) => target.locator(selector).evaluate(root => (root as HTMLElement).innerText.replace(/\s+/g, ' ').trim())
  const controls = async (target: Page, selector: string) => target.locator(selector).evaluate(root => [...root.querySelectorAll<HTMLButtonElement>('button')].filter(node => getComputedStyle(node).display !== 'none' && node.getClientRects().length > 0).map(node => ({ label: node.textContent?.replace(/\s+/g, ' ').trim(), disabled: node.disabled })))
  const geometry = async (target: Page, selector: string) => target.locator(selector).evaluate(node => { const style = getComputedStyle(node); const rect = node.getBoundingClientRect(); const parent = node.closest('.screen,.s16-terminal')!.getBoundingClientRect(); return { x: rect.x - parent.x, y: rect.y - parent.y, width: rect.width, height: rect.height, display: style.display, font: style.font, padding: style.padding, gap: style.gap, border: style.border, color: style.color, background: style.backgroundColor } })
  expect(await normalizedText(page, '.s16-terminal')).toEqual(await normalizedText(prototype, '.screen'))
  expect(await controls(page, '.s16-terminal')).toEqual(await controls(prototype, '.screen'))
  expect(await geometry(page, '.s16-body')).toEqual(await geometry(prototype, '.body'))
  expect(await geometry(page, '.s16-welcome')).toEqual(await geometry(prototype, '.welcome'))
  await prototype.close()
})

test('captures the corrected body-flow journey at small, middle, and large viewports', async ({ page }) => {
  test.setTimeout(180_000)
  const viewports = [{ name: 'small', width: 480, height: 270 }, { name: 'middle', width: 1280, height: 720 }, { name: 'large', width: 1920, height: 1080 }]
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await quickStart(page)
    const build = page.getByRole('button', { name: 'BUILD QUERY', exact: true })
    await expect(build).toBeVisible()
    const flowStyle = await build.evaluate(element => ({ actionPosition: getComputedStyle(element.parentElement!).position, bodyOverflow: getComputedStyle(element.closest('.s16-body')!).overflowY }))
    expect(flowStyle).toEqual({ actionPosition: 'static', bodyOverflow: 'hidden' })
    await page.screenshot({ path: resolve(evidenceDir, `${viewport.name}-01-case-guidance-main-action.png`) })

    await runQuery(page)
    await page.screenshot({ path: resolve(evidenceDir, `${viewport.name}-02-three-match-guidance.png`) })
    await page.getByRole('button', { name: 'VIEW 3 MATCHES' }).click()
    await page.screenshot({ path: resolve(evidenceDir, `${viewport.name}-03-three-matches.png`) })
    await page.getByRole('button', { name: 'OPEN EARLIEST TRANSFER' }).click()
    await page.getByRole('button', { name: 'SAVE TO CASE' }).click()
    await page.getByRole('button', { name: 'NEXT', exact: true }).click()
    await expect(page.locator('.s16-guide')).toContainText('The later sender matches the earlier receiver: First Engine.')
    await expect(page.locator('.s16-summary-fields')).toContainText('SENDER')
    await expect(page.locator('.s16-summary-fields')).toContainText('RECEIVER')
    await expectTerminalContentFits(page)
    await expect(page.locator('.s16-record-tools button')).toHaveText(['MORE DETAILS', '← MATCHES'])
    const toolBoxes = await page.locator('.s16-record-tools button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect()))
    const scale = Number(await page.getByTestId('terminal-viewport').getAttribute('data-integer-scale'))
    expect(Math.round((toolBoxes[1]!.left - toolBoxes[0]!.right) / scale)).toBe(7)
    await page.screenshot({ path: resolve(evidenceDir, `${viewport.name}-04-later-transaction-summary.png`) })
    await page.getByRole('button', { name: '← MATCHES' }).click()
    await page.getByRole('button', { name: /Later transfer · supporting entry/ }).click()
    await expect(page.getByText(/another view, not another payment/i)).toBeVisible()
    await expectTerminalContentFits(page)
    await page.screenshot({ path: resolve(evidenceDir, `${viewport.name}-05-later-supporting-summary.png`) })
    await page.getByRole('button', { name: 'SAVE TO CASE' }).click()

    await page.getByTestId('terminal-section-case').click()
    await runQuery(page, 'BUILD CONNECTION QUERY')
    await page.getByRole('button', { name: 'OPEN TRANSACTION' }).click()
    await page.getByRole('button', { name: 'CONFIRM CONNECTION' }).click()
    await expect(page.getByRole('button', { name: 'SAVE CASE' })).toBeVisible()
    await page.screenshot({ path: resolve(evidenceDir, `${viewport.name}-06-findings.png`) })
    await page.getByRole('button', { name: 'SAVE CASE' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.screenshot({ path: resolve(evidenceDir, `${viewport.name}-07-closure-confirmation.png`) })
  }
})

test('the production degauss paint remains clipped by one stationary 393×219 aperture at every accepted phase', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 270 })
  await quickStart(page)
  await page.waitForFunction(() => [...document.images].every(image => image.complete))
  const native = page.locator('.s5-native-terminal'), aperture = page.getByTestId('terminal-screen-aperture'), magnet = page.getByTestId('s16-degauss')
  const [terminalBox, apertureBox, magnetBox] = await Promise.all([native.boundingBox(), aperture.boundingBox(), magnet.boundingBox()])
  expect(terminalBox).not.toBeNull(); expect(apertureBox).not.toBeNull(); expect(magnetBox).not.toBeNull()
  expect({ x: apertureBox!.x - terminalBox!.x, y: apertureBox!.y - terminalBox!.y, width: apertureBox!.width, height: apertureBox!.height }).toEqual({ x: 44, y: 12, width: 393, height: 219 })
  const baseline = await page.screenshot({ path: resolve(evidenceDir, 'mask-probe-0ms.png') })
  for (const phase of [84, 189, 588, 1722, 2100]) {
    await native.evaluate((element, elapsed) => {
      element.classList.add('is-degaussing')
      for (const animated of element.querySelectorAll<HTMLElement>('.s5-degauss-surface,.s16-crt-effects,.s16-crt-effects::after')) {
        animated.style.animationDelay = `-${elapsed}ms`; animated.style.animationPlayState = 'paused'
      }
    }, phase)
    const currentAperture = await aperture.boundingBox()
    expect(currentAperture).toEqual(apertureBox)
    const active = await page.screenshot({ path: resolve(evidenceDir, `mask-probe-${phase}ms.png`) })
    expect(changedOutsideAperture(baseline, active, terminalBox!, apertureBox!, magnetBox!)).toBe(0)
    await native.evaluate(element => {
      element.classList.remove('is-degaussing')
      for (const animated of element.querySelectorAll<HTMLElement>('.s5-degauss-surface,.s16-crt-effects')) { animated.style.animationDelay = ''; animated.style.animationPlayState = '' }
    })
  }
})

type AudioProbe = { instances: Array<{ src: string; loop: boolean; volume: number; currentTime: number; paused: boolean; playCalls: number; pauseCalls: number; dispatchEvent(event: Event): boolean }> }
async function installAudioProbe(page: Page) {
  await page.addInitScript(() => {
    const probe: AudioProbe = { instances: [] }
    class ProbedAudio extends EventTarget {
      src: string; loop = false; volume = 1; muted = false; preload = ''; currentTime = 0; paused = true; playCalls = 0; pauseCalls = 0; onended: ((event: Event) => void) | null = null; onerror: ((event: Event) => void) | null = null; onabort: ((event: Event) => void) | null = null
      constructor(src = '') { super(); this.src = src; probe.instances.push(this) }
      async play() { this.playCalls += 1; this.paused = false }
      pause() { this.pauseCalls += 1; this.paused = true }
      override dispatchEvent(event: Event) { const result = super.dispatchEvent(event); if (event.type === 'ended') this.onended?.(event); if (event.type === 'error') this.onerror?.(event); if (event.type === 'abort') this.onabort?.(event); return result }
    }
    Object.defineProperty(window, '__S16_AUDIO_PROBE__', { value: probe })
    Object.defineProperty(window, 'Audio', { value: ProbedAudio, configurable: true })
  })
}
const audioProbe = (page: Page) => page.evaluate(() => (window as typeof window & { __S16_AUDIO_PROBE__: AudioProbe }).__S16_AUDIO_PROBE__)

test('office/terminal music and degauss use exclusive, retained, gesture-bound playback', async ({ browser }) => {
  test.setTimeout(180_000)
  const context: BrowserContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true })
  const mediaPage = await context.newPage()
  await installAudioProbe(mediaPage)
  await mediaPage.goto('/')
  await mediaPage.getByRole('button', { name: 'PLAY', exact: true }).click()
  await drainWorld(mediaPage)
  await authorize(mediaPage)
  let probe = await audioProbe(mediaPage)
  expect(probe.instances).toHaveLength(1)
  expect(probe.instances[0]).toMatchObject({ src: '/audio/background-main.ogg', loop: true, volume: 0.22, paused: false })
  await mediaPage.evaluate(() => { const p = (window as typeof window & { __S16_AUDIO_PROBE__: AudioProbe }).__S16_AUDIO_PROBE__; p.instances[0]!.currentTime = 37 })
  await openTerminal(mediaPage)
  await expect.poll(async () => (await audioProbe(mediaPage)).instances.length).toBe(2)
  probe = await audioProbe(mediaPage)
  expect(probe.instances[0]).toMatchObject({ currentTime: 37, paused: true })
  expect(probe.instances[1]).toMatchObject({ src: '/audio/background-terminal.ogg', loop: true, volume: 0.22, paused: false })

  const degauss = mediaPage.getByTestId('s16-degauss')
  await mediaPage.screenshot({ path: resolve(evidenceDir, '03-degauss-before.png') })
  await degauss.tap()
  await expect(degauss).toBeDisabled()
  await mediaPage.evaluate(() => { const button = document.querySelector<HTMLElement>('[data-testid="s16-degauss"]')!; button.dispatchEvent(new MouseEvent('click', { bubbles: true })); button.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await mediaPage.screenshot({ path: resolve(evidenceDir, '04-degauss-active.png') })
  probe = await audioProbe(mediaPage)
  expect(probe.instances).toHaveLength(3)
  expect(probe.instances[2]).toMatchObject({ src: '/audio/degauss-sfx.mp3', loop: false, volume: 0.375, playCalls: 1 })
  await mediaPage.waitForTimeout(2200)
  await expect(mediaPage.locator('.s5-native-terminal')).not.toHaveClass(/is-degaussing/)
  await expect(degauss).toBeDisabled()
  await mediaPage.screenshot({ path: resolve(evidenceDir, '05-degauss-visual-settled-audio-locked.png') })
  const officeButton = mediaPage.getByRole('button', { name: 'RETURN TO OFFICE' })
  await officeButton.focus()
  await mediaPage.evaluate(() => { const p = (window as typeof window & { __S16_AUDIO_PROBE__: AudioProbe }).__S16_AUDIO_PROBE__; p.instances[2]!.dispatchEvent(new Event('ended')) })
  await expect(degauss).toBeEnabled()
  await expect(officeButton).toBeFocused()
  await degauss.tap()
  expect((await audioProbe(mediaPage)).instances[2]!.playCalls).toBe(2)
  await mediaPage.evaluate(() => { const p = (window as typeof window & { __S16_AUDIO_PROBE__: AudioProbe }).__S16_AUDIO_PROBE__; p.instances[2]!.dispatchEvent(new Event('ended')) })
  await mediaPage.waitForTimeout(2200)
  await expect(degauss).toBeEnabled()
  await mediaPage.screenshot({ path: resolve(evidenceDir, '06-degauss-second-activation-complete.png') })
  await officeButton.click()
  await expect(mediaPage.getByTestId('case-terminal')).toHaveCount(0)
  probe = await audioProbe(mediaPage)
  expect(probe.instances[0]).toMatchObject({ currentTime: 37, paused: false })
  expect(probe.instances[1]!.paused).toBe(true)
  expect(probe.instances.filter(instance => !instance.paused && instance.loop)).toHaveLength(1)
  await context.close()
})
