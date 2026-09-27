import { test, expect } from '@playwright/test'
import { MODES, SURFACES, NO_MATCH_COPY, LOCAL_EMPTY_COPY } from '../../../src/investigation/semantic-ux/model'
const url = '/src/app/corpus-presentation/harness.html'
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin !== 'http://127.0.0.1:4187') throw Error('C1_EXTERNAL_REQUEST_BLOCKED')
    return route.continue()
  })
})
test('25 records / seven no-matches preserve complete DOM meaning in all nine surface/mode pairs; zero interaction transport', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto(url); await expect(page.locator('article')).toHaveCount(25)
  const baseline = await page.locator('article').allTextContents()
  await page.waitForLoadState('networkidle')
  const requests: string[] = []; page.on('request', r => requests.push(r.url()))
  const sockets: string[] = []; page.on('websocket', socket => sockets.push(socket.url()))
  await page.evaluate(() => {
    const guarded = window as unknown as Record<string, unknown>
    guarded.__c1TransportAttempts = []
    for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker']) {
      const original = guarded[name]
      const trap = () => { (guarded.__c1TransportAttempts as string[]).push(name); throw Error('C1_BROWSER_TRANSPORT_FORBIDDEN') }
      if (typeof original === 'function') guarded[name] = new Proxy(original, { apply: trap, construct: trap })
    }
    navigator.sendBeacon = new Proxy(navigator.sendBeacon, { apply() {
      (guarded.__c1TransportAttempts as string[]).push('sendBeacon'); throw Error('C1_BROWSER_TRANSPORT_FORBIDDEN')
    } })
  })
  for (const surface of SURFACES) for (const mode of MODES) {
    await page.getByLabel('Display surface', { exact: true }).selectOption(surface)
    await page.getByLabel('Presentation mode', { exact: true }).selectOption(mode)
    expect(await page.locator('article').allTextContents()).toEqual(baseline)
    await expect(page.getByText(NO_MATCH_COPY, { exact: true })).toHaveCount(7)
    await expect(page.getByRole('status')).toContainText('25 of 25')
    await expect(page.getByText(/SOURCE \/ LEDGER audit provenance/)).toBeVisible()
    await page.screenshot({ path: `docs/parallel/lane-c/evidence/screenshots/${surface}-${mode}.png` })
  }
  await page.locator('article').first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'docs/parallel/lane-c/evidence/screenshots/record-context.png' })
  await page.getByLabel('Result status', { exact: true }).selectOption('bounded-no-match')
  await expect(page.locator('article')).toHaveCount(7)
  await page.locator('article').first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'docs/parallel/lane-c/evidence/screenshots/record-bounded-no-match.png' })
  await page.getByLabel('Presentation mode', { exact: true }).selectOption('PLAIN_LIST')
  await expect(page.locator('article')).toHaveCount(7)
  await page.getByLabel('Search accepted display text', { exact: true }).fill('not-present-xyz')
  await expect(page.locator('article')).toHaveCount(0)
  await expect(page.getByText(LOCAL_EMPTY_COPY, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reset local filters' }).click()
  await expect(page.locator('article')).toHaveCount(25)
  expect(requests).toEqual([]); expect(sockets).toEqual([]); expect(errors).toEqual([])
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__c1TransportAttempts)).toEqual([])
})
test('keyboard controls, skip link, live result count, search/filter equivalence and regrouping', async ({ page }) => {
  await page.goto(url); await expect(page.locator('article')).toHaveCount(25)
  await page.keyboard.press('Tab'); await expect(page.getByLabel('Presentation mode', { exact: true })).toBeFocused()
  await page.keyboard.press('Tab'); await expect(page.getByLabel('Display surface', { exact: true })).toBeFocused()
  await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: 'Skip filters to display records' })).toBeFocused()
  await page.keyboard.press('Enter'); await expect(page.getByRole('region', { name: 'Display records', exact: true })).toBeFocused()
  await page.getByLabel('Search accepted display text', { exact: true }).focus()
  await page.keyboard.type('relationships')
  const searched = await page.locator('article').evaluateAll(xs => xs.map(x => x.getAttribute('data-display-id')))
  await page.getByRole('button', { name: 'Reset local filters' }).focus(); await page.keyboard.press('Enter')
  await page.getByLabel('Question Lens', { exact: true }).focus(); await page.keyboard.press('End'); await page.keyboard.press('Enter')
  await expect(page.getByLabel('Question Lens', { exact: true })).toHaveValue('RELATIONSHIPS')
  expect(await page.locator('article').evaluateAll(xs => xs.map(x => x.getAttribute('data-display-id')))).toEqual(searched)
  await expect(page.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  await page.getByRole('button', { name: 'Reset local filters' }).click()
  for (const group of ['lens', 'role', 'storyUse', 'subject', 'timeWindow', 'coverage']) {
    await page.getByLabel('Group records by', { exact: true }).selectOption(group)
    const unique = await page.locator('article').evaluateAll(xs => new Set(xs.map(x => x.getAttribute('data-display-id'))).size)
    expect(unique).toBe(25)
  }
})
test('200% layout, narrow reflow, forced colors and reduced motion in every mode', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' })
  await page.goto(url); await expect(page.locator('article')).toHaveCount(25)
  for (const mode of MODES) {
    await page.getByLabel('Presentation mode', { exact: true }).selectOption(mode)
    // Chromium CSS zoom exercises 200% layout sizing; separate 640px viewport
    // additionally models half-width reflow. Not OS/browser AT certification.
    await page.evaluate(() => { document.body.style.zoom = '2' })
    await expect(page.getByRole('button', { name: 'Reset local filters' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: `docs/parallel/lane-c/evidence/screenshots/200pct-forced-${mode}.png` })
    await page.evaluate(() => { document.body.style.zoom = '1' })
    await page.setViewportSize({ width: 640, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
    await page.getByLabel('Search accepted display text', { exact: true }).focus()
    expect(await page.getByLabel('Search accepted display text', { exact: true }).evaluate(e => getComputedStyle(e).outlineStyle)).not.toBe('none')
    expect(await page.locator('article').first().evaluate(e => getComputedStyle(e).animationName)).toBe('none')
    await page.setViewportSize({ width: 1280, height: 900 })
  }
})
test('admitted empty subsets remain local emptiness in every mode', async ({ page }) => {
  await page.goto(`${url}?empty`); await expect(page.getByRole('status')).toContainText('0 of 0')
  for (const mode of MODES) for (const surface of SURFACES) {
    await page.getByLabel('Presentation mode', { exact: true }).selectOption(mode)
    await page.getByLabel('Display surface', { exact: true }).selectOption(surface)
    await expect(page.getByText(LOCAL_EMPTY_COPY, { exact: true })).toBeVisible()
    await expect(page.getByText(NO_MATCH_COPY, { exact: true })).toHaveCount(0)
  }
})
test('synthetic harness is visibly separate across all modes and surfaces', async ({ page }) => {
  await page.goto(`${url}?fixture=synthetic`); await expect(page.locator('article')).toHaveCount(9)
  for (const mode of MODES) for (const surface of SURFACES) {
    await page.getByLabel('Presentation mode', { exact: true }).selectOption(mode)
    await page.getByLabel('Display surface', { exact: true }).selectOption(surface)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Synthetic examples — NOT canonical')
    await expect(page.getByText('Synthetic, nonhistorical, noncanonical, nonproof example.', { exact: true })).toHaveCount(9)
  }
})
