import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'

const shots = resolve('review/s15-r5/SCREENSHOTS')
mkdirSync(shots, { recursive: true })

async function start(page: Page) {
  await page.goto('/?skipIntro=1&review=1')
  const play = page.getByRole('button', { name: 'PLAY', exact: true })
  if (await play.isVisible()) await play.click()
  await expect(page.getByTestId('a0-shell')).toBeVisible()
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
}
async function act(page: Page, verb: string, target: string) {
  await page.getByTestId(`verb-${verb.toLowerCase().replace('_', '-')}`).click()
  await page.getByTestId(`hotspot-${target}`).click({ force: true })
}
async function bubbleBox(panel: Locator) {
  return panel.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const visible = [...element.querySelectorAll('span')].find(node => !node.classList.contains('full-delivery-measure') && !node.classList.contains('sr-only'))?.textContent?.length ?? 0
    return { left: rect.left, right: rect.right, width: rect.width, visible, fullWidth: Number((element as HTMLElement).dataset.fullDeliveryWidth ?? 0) }
  })
}

test('s15-r5:drawer-contact-silence captures truthful miscellaneous open and case close', async ({ page }) => {
  await start(page)
  await act(page, 'OPEN', 'miscellaneous-drawer-cabinet')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-misc-drawer', 'OPEN')
  await expect(page.getByTestId('layout-misc-cabinet')).toHaveAttribute('data-frame-src', /drawer_04_open\.png/)
  await expect(page.getByText(/nothing\s+to open/i)).toHaveCount(0)
  await page.screenshot({ path: resolve(shots, 'misc-drawer-open-silent.png') })
  // OPEN mutates at semantic contact, before the reach sequence releases.
  // Wait for that release so the next cabinet click is a real player action,
  // not an intentionally ignored input during a reserved sequence.
  await expect(page.getByTestId('active-sequence')).toHaveCount(0, { timeout: 15_000 })

  await act(page, 'OPEN', 'official-case-file-cabinet')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'OPEN')
  await expect(page.getByTestId('active-sequence')).toHaveCount(0, { timeout: 15_000 })
  await act(page, 'CLOSE', 'official-case-file-cabinet')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'CLOSED')
  await expect(page.getByText(/nothing\s+to close/i)).toHaveCount(0)
  await page.screenshot({ path: resolve(shots, 'case-drawer-close-silent.png') })
})

test('s15-r5:physical-contact-registry captures lamp contact before post-contact feedback', async ({ page }) => {
  await start(page)
  await act(page, 'USE', 'desk-lamp')
  const sequence = page.getByTestId('active-sequence')
  await expect(sequence).toHaveAttribute('data-contact', 'CONTACT.LAMP.TOGGLE', { timeout: 10_000 })
  await expect(page.getByTestId('records-office')).toHaveAttribute('data-lamp-power', 'OFF')
  await page.screenshot({ path: resolve(shots, 'lamp-contact-state.png') })
  await expect(page.getByTestId('nonblocking-speech')).toBeVisible({ timeout: 10_000 })
})

test('s15-r5:window-relational-boundaries verifies lower, right, and stanchion-overlap click ownership', async ({ page }) => {
  await start(page)
  await page.getByRole('button', { name: /HOTSPOTS OFF/ }).click()
  const windowTarget = page.getByTestId('hotspot-window')
  const stanchion = page.getByTestId('hotspot-wall-not-a-number')
  const result = await page.evaluate(() => {
    const windowNode = document.querySelector<HTMLElement>('[data-testid="hotspot-window"]')!
    const stanchionNode = document.querySelector<HTMLElement>('[data-testid="hotspot-wall-not-a-number"]')!
    const frame = document.querySelector<HTMLElement>('.a0-frame')!
    const w = windowNode.getBoundingClientRect(), s = stanchionNode.getBoundingClientRect()
    return {
      scale: Number(frame.dataset.integerScale),
      logical: { left: windowNode.offsetLeft / Number(frame.dataset.integerScale), top: windowNode.offsetTop / Number(frame.dataset.integerScale), width: windowNode.offsetWidth / Number(frame.dataset.integerScale), height: windowNode.offsetHeight / Number(frame.dataset.integerScale) },
      lower: { x: w.left + 4, y: w.bottom - 4 }, right: { x: w.right - 4, y: w.top + 8 },
      overlap: { x: Math.max(w.left, s.left) + 2, y: Math.max(w.top, s.top) + 2 },
      overlapOwner: document.elementFromPoint(Math.max(w.left, s.left) + 2, Math.max(w.top, s.top) + 2)?.getAttribute('data-testid'),
    }
  })
  expect(result.logical).toEqual({ left: 424, top: 14, width: 49, height: 106 })
  expect(result.overlapOwner).toBe('hotspot-wall-not-a-number')
  await page.evaluate(() => { (window as Window & { __r5Clicks?: string[] }).__r5Clicks = []; document.addEventListener('pointerdown', event => { const target = event.target as HTMLElement; (window as Window & { __r5Clicks?: string[] }).__r5Clicks!.push(target.closest<HTMLElement>('[data-testid]')?.dataset.testid ?? '') }, { capture: true }) })
  await page.mouse.click(result.lower.x, result.lower.y)
  await page.mouse.click(result.right.x, result.right.y)
  await page.mouse.click(result.overlap.x, result.overlap.y)
  expect(await page.evaluate(() => (window as Window & { __r5Clicks?: string[] }).__r5Clicks)).toEqual(['hotspot-window', 'hotspot-window', 'hotspot-wall-not-a-number'])
  await windowTarget.hover(); await stanchion.hover()
  await page.screenshot({ path: resolve(shots, 'window-hotspot-boundaries.png') })
})

async function captureClamp(page: Page, edge: 'left' | 'right') {
  const frame = page.locator('.a0-frame')
  const box = await frame.boundingBox(); if (!box) throw Error('frame missing')
  const scale = Number(await frame.getAttribute('data-integer-scale'))
  await page.getByTestId('review-mode').evaluate(element => { element.style.display = 'none' })
  await page.getByTestId('text-speed-menu').click()
  await page.getByTestId('dialogue-mode-manual').click()
  if (await page.getByTestId('dialogue-display-toggle').textContent() !== 'TEXT · TYPED') await page.getByTestId('dialogue-display-toggle').click()
  await page.getByTestId('records-office').evaluate((element, point) => element.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: point.x, clientY: point.y })), { x: edge === 'left' ? box.x + 12 * scale : box.x + 468 * scale, y: box.y + 165 * scale })
  await page.waitForTimeout(1000)
  await act(page, 'TALK_TO', edge === 'left' ? 'wall-be-the-change' : 'wall-clock')
  const panel = page.getByTestId('nonblocking-speech')
  await expect(panel).toBeVisible()
  const beginning = await bubbleBox(panel)
  await page.waitForFunction(() => { const node = document.querySelector<HTMLElement>('[data-testid="nonblocking-speech"]'); if (!node) return false; const visible = [...node.querySelectorAll('span')].find(span => !span.classList.contains('full-delivery-measure') && !span.classList.contains('sr-only'))?.textContent?.length ?? 0; const full = node.getAttribute('aria-label')?.length ?? 0; return visible > Math.max(2, full / 3) })
  const middle = await bubbleBox(panel)
  await expect(panel).toHaveAttribute('data-revealing', 'false')
  const full = await bubbleBox(panel)
  await panel.evaluate(element => { element.style.fontSize = '1.08em' })
  await expect.poll(async () => (await bubbleBox(panel)).fullWidth).toBeGreaterThan(full.fullWidth * 1.05)
  const afterFontScale = await bubbleBox(panel)
  const frameBox = await frame.boundingBox(); if (!frameBox) throw Error('frame missing')
  for (const sample of [beginning, middle, full, afterFontScale]) {
    expect(sample.left).toBeGreaterThanOrEqual(frameBox.x + 8 * scale - 1)
    expect(sample.right).toBeLessThanOrEqual(frameBox.x + frameBox.width - 8 * scale + 1)
    expect(sample.width).toBeCloseTo(sample.fullWidth, 1)
  }
  expect([beginning.left, middle.left, full.left].map(value => Math.round(value))).toEqual([Math.round(beginning.left), Math.round(beginning.left), Math.round(beginning.left)])
  await page.screenshot({ path: resolve(shots, `${edge}-edge-full-delivery.png`) })
}

test('s15-r5:full-delivery-clamp holds full width at left and right through slow reveal', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await start(page)
  await captureClamp(page, 'left')
  await page.reload(); await start(page)
  await captureClamp(page, 'right')
})

test('s15-r5:ordinary-network-journey makes zero external provider or websocket requests', async ({ page }) => {
  const external: string[] = []; const sockets: string[] = []
  page.on('request', request => { const url = new URL(request.url()); if (!['127.0.0.1', 'localhost'].includes(url.hostname)) external.push(request.url()) })
  page.on('websocket', socket => { const url = new URL(socket.url()); if (!['127.0.0.1', 'localhost'].includes(url.hostname)) sockets.push(socket.url()) })
  await start(page)
  await act(page, 'OPEN', 'miscellaneous-drawer-cabinet')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-misc-drawer', 'OPEN')
  expect(external).toEqual([]); expect(sockets).toEqual([])
})
