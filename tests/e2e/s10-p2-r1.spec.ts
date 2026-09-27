import { expect, test, type Page } from '@playwright/test'
import { setup } from '../fixtures/s2/browser-helpers'
import { violatesFrozenBrowserPolicy } from '../fixtures/browser-policy'

test.setTimeout(90_000)

async function expectBand(page: Page, scale: number) {
  await expect(page.locator('.a0-frame')).toHaveAttribute('data-integer-scale', String(scale))
  const box = await page.locator('.a0-frame').evaluate((element) => {
    const frame = element.getBoundingClientRect()
    const band = element.querySelector('[data-testid="adventure-interface-band"]')!.getBoundingClientRect()
    const style = getComputedStyle(element)
    const borderTop = parseFloat(style.borderTopWidth)
    const borderLeft = parseFloat(style.borderLeftWidth)
    const borderRight = parseFloat(style.borderRightWidth)
    const borderBottom = parseFloat(style.borderBottomWidth)
    return {
      contentWidth: frame.width - borderLeft - borderRight,
      contentHeight: frame.height - borderTop - borderBottom,
      bandTop: band.top - frame.top - borderTop,
      bandHeight: band.height,
      bandWidth: band.width,
    }
  })
  expect(box.contentWidth).toBe(480 * scale)
  expect(box.contentHeight).toBe(270 * scale)
  expect(Math.abs(box.contentWidth / box.contentHeight - 480 / 270)).toBeLessThan(0.001)
  expect(Math.abs(box.bandTop - 180 * scale)).toBeLessThan(1)
  expect(Math.abs(box.bandHeight - 90 * scale)).toBeLessThan(1)
  expect(Math.abs(box.bandWidth - 480 * scale)).toBeLessThan(1)
  expect(Math.abs(box.bandHeight - box.contentHeight / 3)).toBeLessThan(1)
  await expect(page.getByTestId('command-sentence')).toBeHidden()
  await expect(page.getByTestId('speech-panel')).toBeVisible()
  const background = await page.getByTestId('adventure-interface-band').evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(background).toBe('rgb(0, 0, 0)')
  const focusable = await page.getByTestId('adventure-interface-band').evaluate((root) => [...root.querySelectorAll<HTMLElement>('button, a, input, select, textarea')].some((node) => !node.closest('[inert]') && getComputedStyle(node).visibility !== 'hidden'))
  expect(focusable).toBe(false)
}

test.describe('S10-P2-R1 blackout and announcement', () => {
  test('S10-P2-R1 blackout covers exact logical 480 by 90 not 78 pixels', async ({ page }) => {
    await setup(page, 181)
    await page.setViewportSize({ width: 480, height: 270 })
    await page.goto('/')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-interface-treatment', 'BLACKOUT')
    await expectBand(page, 1)
    await expect(page.getByTestId('control-unavailable')).toContainText('Player control is temporarily unavailable')
  })

  test('S10-P2-R1 blackout geometry at 2x', async ({ page }) => {
    await setup(page, 182)
    await page.setViewportSize({ width: 960, height: 540 })
    await page.goto('/')
    await expectBand(page, 2)
  })

  test('S10-P2-R1 blackout geometry at 4x', async ({ page }) => {
    await setup(page, 183)
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    await expectBand(page, 4)
  })

  test('S10-P2-R1 plain-list presentation does not change blackout control semantics', async ({ page }) => {
    const external: string[] = []
    page.on('request', (request) => { if (violatesFrozenBrowserPolicy(request.url())) external.push(request.url()) })
    const data = await setup(page, 184)
    await page.setViewportSize({ width: 960, height: 540 })
    await page.goto('/')
    await page.getByLabel('Dialogue presentation').selectOption('PLAIN_LIST')
    data.freeze()
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-interface-treatment', 'BLACKOUT')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-control-class', 'BLOCKING_CUTSCENE')
    await expect(page.getByTestId('speech-panel')).toHaveAttribute('data-presentation-mode', 'PLAIN_LIST')
    await expect(page.getByTestId('command-sentence')).toBeHidden()
    for (let i = 0; i < 40 && await page.getByTestId('speech-panel').count(); i++) await page.getByTestId('speech-panel').click()
    await expect(page.getByTestId('verb-give')).toBeFocused()
    expect(external).toEqual([])
  })

  test('S10-P2-R1 two same-text replacement events both announce', async ({ page }) => {
    const data = await setup(page, 185)
    await page.goto('/?skipIntro=1')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
    await page.evaluate(() => {
      const host = window as unknown as { __repl: string[] }
      host.__repl = []
      new MutationObserver(() => {
        const id = document.querySelector('[data-testid="intent-announcement"]')?.getAttribute('data-replacement-id')
        if (id && host.__repl[host.__repl.length - 1] !== id) host.__repl.push(id)
      }).observe(document.body, { childList: true, subtree: true, attributes: true })
    })
    const replace = async () => {
      await page.getByRole('button', { name: /^OPEN\b/ }).click()
      await page.getByRole('button', { name: 'Official case-file cabinet', exact: true }).click()
      await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
      await page.getByTestId('records-office').click({ position: { x: 24, y: 180 }, force: true })
    }
    await replace()
    await expect.poll(async () => page.evaluate(() => (window as unknown as { __repl: string[] }).__repl)).toContain('1')
    await expect(page.getByTestId('intent-announcement')).toHaveCount(0)
    await replace()
    await expect.poll(async () => page.evaluate(() => (window as unknown as { __repl: string[] }).__repl)).toEqual(['1', '2'])
    await expect(page.getByTestId('intent-announcement')).toHaveCount(0)
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'CLOSED')
    expect(data.requests.filter((request) => request.forbidden)).toEqual([])
  })

  test('S10-P2-R1 Arthur restores idle facing after full dialogue close', async ({ page }) => {
    const data = await setup(page, 186)
    await page.goto('/?skipIntro=1')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
    data.freeze()
    await page.getByRole('button', { name: /^TALK TO\b/ }).click()
    await page.getByRole('button', { name: 'Arthur, Records Office archivist', exact: true }).click()
    await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-facing', 'LEFT')
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-facing', 'RIGHT')
    await page.getByTestId('dialogue-leave').click()
    await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-facing', 'RIGHT')
    await expect(page.getByTestId('dialogue-panel')).toHaveCount(0)
  })
})
