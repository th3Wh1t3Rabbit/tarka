import { expect, test, type Page } from '@playwright/test'
import { setup, tabTo } from '../fixtures/s2/browser-helpers'
import { violatesFrozenBrowserPolicy } from '../fixtures/browser-policy'

test.use({ hasTouch: true })
test.setTimeout(120_000)

async function office(page: Page) {
  await page.goto('/?skipIntro=1')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
}

const verb = (page: Page, name: 'OPEN' | 'LOOK AT' | 'USE' | 'PULL') => page.getByRole('button', { name: new RegExp(`^${name}\\b`) })

async function watchReplacements(page: Page) {
  await page.evaluate(() => {
    const host = window as unknown as { __repl: { id: string; text: string }[] }
    host.__repl = []
    new MutationObserver(() => {
      const el = document.querySelector('[data-testid="intent-announcement"]')
      if (!el) return
      const id = el.getAttribute('data-replacement-id') || ''
      const text = el.textContent || ''
      const last = host.__repl[host.__repl.length - 1]
      if (id && (!last || last.id !== id)) host.__repl.push({ id, text })
    }).observe(document.body, { childList: true, subtree: true, attributes: true })
  })
}

async function sawReplacement(page: Page, id: string, text: string) {
  await expect.poll(async () => page.evaluate(() => (window as unknown as { __repl: { id: string; text: string }[] }).__repl)).toEqual(expect.arrayContaining([expect.objectContaining({ id })]))
  const seen = await page.evaluate(() => (window as unknown as { __repl: { id: string; text: string }[] }).__repl)
  expect(seen.find((entry) => entry.id === id)?.text).toContain(text)
  await expect(page.getByTestId('intent-announcement')).toHaveCount(0)
}

async function closed(page: Page) {
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'CLOSED')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-misc-drawer', 'CLOSED')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
}

test.describe('S10-P2 control foundation', () => {
  test('S10-P2 floor click replaces a pending drawer walk and the drawer never commits', async ({ page }) => {
    const data = await setup(page, 171)
    await office(page)
    await watchReplacements(page)
    data.freeze()
    await verb(page, 'OPEN').click()
    await page.getByRole('button', { name: 'Official case-file cabinet', exact: true }).click()
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
    await page.getByTestId('records-office').click({ position: { x: 24, y: 180 }, force: true })
    await sawReplacement(page, '1', 'Prior action replaced')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-control-class', 'WALK_PENDING_REPLACEABLE')
    await expect(page.getByTestId('rook-sprite')).not.toHaveAttribute('data-animation', 'walkEast', { timeout: 8000 })
    await closed(page)
    expect(data.requests.filter((request) => request.forbidden)).toEqual([])
  })

  test('S10-P2 mouse touch and keyboard replacement agree', async ({ page }) => {
    const data = await setup(page, 172)
    await office(page)
    await watchReplacements(page)
    data.freeze()
    await page.keyboard.press('4')
    await tabTo(page, page.getByRole('button', { name: 'Official case-file cabinet', exact: true }))
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
    await page.keyboard.press('5')
    await tabTo(page, page.getByRole('button', { name: 'Office globe, optional placeholder hotspot', exact: true }))
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('nonblocking-speech')).toBeVisible()
    await closed(page)
    await verb(page, 'USE').tap()
    await page.getByRole('button', { name: 'Miscellaneous drawer cabinet', exact: true }).tap()
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
    await page.getByTestId('records-office').tap({ position: { x: 24, y: 180 }, force: true })
    await sawReplacement(page, '1', 'Prior action replaced')
    await closed(page)
    expect(data.requests.filter((request) => request.forbidden)).toEqual([])
  })

  test('S10-P2 plain-list announces replacement through the same reducer', async ({ page }) => {
    const external: string[] = []
    page.on('request', (request) => { if (violatesFrozenBrowserPolicy(request.url())) external.push(request.url()) })
    const data = await setup(page, 173)
    await office(page)
    await watchReplacements(page)
    await page.getByLabel('Dialogue presentation').selectOption('PLAIN_LIST')
    data.freeze()
    await verb(page, 'PULL').click()
    await page.getByRole('button', { name: 'Miscellaneous drawer cabinet', exact: true }).click()
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
    await page.getByTestId('records-office').click({ position: { x: 24, y: 180 }, force: true })
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-control-class', 'WALK_PENDING_REPLACEABLE')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-interface-treatment', 'ACTIVE')
    await expect(page.getByLabel('Dialogue presentation')).toHaveValue('PLAIN_LIST')
    await sawReplacement(page, '1', 'PLACEHOLDER')
    await closed(page)
    expect(external).toEqual([])
  })

  test('S10-P2 staged cutscene blacks the 480 by 90 band and restores focus', async ({ page }) => {
    const data = await setup(page, 174)
    await page.goto('/')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-control-class', 'BLOCKING_CUTSCENE')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-interface-treatment', 'BLACKOUT')
    await expect(page.getByTestId('control-unavailable')).toContainText('Player control is temporarily unavailable')
    const frame = await page.locator('.a0-frame').boundingBox()
    const band = await page.getByTestId('adventure-interface-band').boundingBox()
    expect(frame && band).toBeTruthy()
    expect(Math.abs(band!.height - frame!.height / 3)).toBeLessThan(1)
    expect(Math.abs((band!.y - frame!.y) - frame!.height * 180 / 270)).toBeLessThan(1)
    await expect(page.getByTestId('command-sentence')).toBeHidden()
    await expect(page.getByTestId('adventure-interface-band')).toHaveAttribute('inert', '')
    await expect(page.getByTestId('speech-panel')).toBeVisible()
    data.freeze()
    for (let i = 0; i < 40 && await page.getByTestId('speech-panel').count(); i++) await page.getByTestId('speech-panel').click()
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-intro-complete', 'true')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-interface-treatment', 'ACTIVE')
    await expect(page.getByTestId('verb-give')).toBeFocused()
    expect(data.requests.filter((request) => request.forbidden)).toEqual([])
  })

  test('S10-P2 Rook talk performance stays active while locomotion walks', async ({ page }) => {
    const data = await setup(page, 175)
    await office(page)
    data.freeze()
    await verb(page, 'LOOK AT').click()
    await page.getByRole('button', { name: 'Official case-file cabinet', exact: true }).click()
    await expect(page.getByTestId('nonblocking-speech')).toBeVisible()
    await page.getByTestId('records-office').click({ position: { x: 24, y: 180 }, force: true })
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-talking', 'true')
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-performance', /FACE:TALK/)
    await expect(page.getByTestId('nonblocking-speech')).toBeVisible()
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-interface-treatment', 'ACTIVE')
    expect(data.requests.filter((request) => request.forbidden)).toEqual([])
  })

  test('S10-P2 reload reset and review jump cannot resurrect a superseded intent', async ({ page }) => {
    const data = await setup(page, 176)
    await office(page)
    await verb(page, 'OPEN').click()
    await page.getByRole('button', { name: 'Official case-file cabinet', exact: true }).click()
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
    await page.reload()
    await expect(page.getByTestId('a0-shell')).toBeVisible()
    await closed(page)
    await expect(page.getByTestId('active-sequence')).toHaveCount(0)
    expect(data.requests.filter((request) => request.forbidden)).toEqual([])
  })
})
