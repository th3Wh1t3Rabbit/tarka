import { expect, test } from '@playwright/test'
import { activate, drainBrowserSpeech, setup } from '../fixtures/s2/browser-helpers'
import { violatesFrozenBrowserPolicy } from '../fixtures/browser-policy'
test.use({ hasTouch: true })
test.setTimeout(120_000)

async function atStart(page: import('@playwright/test').Page) {
  await page.goto('/?skipIntro=1&review=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible()
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
}

test.describe('S10-P1 preauthorization cabinet lock', () => {
  test('keyboard OPEN and pending walk leave the official drawer closed', async ({ page }) => {
    const data = await setup(page, 151)
    await atStart(page)
    data.freeze()
    await activate(page, page.getByTestId('verb-open'), 'KEYBOARD')
    await activate(page, page.getByTestId('hotspot-official-case-file-cabinet'), 'KEYBOARD')
    await drainBrowserSpeech(page, 'KEYBOARD')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'CLOSED')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
    await page.getByText(/TRANSCRIPT/, { exact: false }).click()
    const text = await page.getByTestId('dialogue-transcript').innerText()
    expect(text.indexOf('Cabinet contact blocked')).toBeGreaterThanOrEqual(0)
    expect(text.indexOf('PLACEHOLDER — Story binds final copy')).toBeGreaterThan(text.indexOf('Cabinet contact blocked'))
    expect(data.requests.filter((request) => request.forbidden)).toEqual([])
  })

  test('touch USE and PULL leave the miscellaneous drawer closed with zero provider calls', async ({ page }) => {
    const external: string[] = []
    page.on('request', (request) => { if (violatesFrozenBrowserPolicy(request.url())) external.push(request.url()) })
    const data = await setup(page, 152)
    await atStart(page)
    data.freeze()
    await activate(page, page.getByTestId('verb-use'), 'MOUSE_TOUCH')
    await activate(page, page.getByTestId('hotspot-miscellaneous-drawer-cabinet'), 'MOUSE_TOUCH')
    await drainBrowserSpeech(page, 'MOUSE_TOUCH')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-misc-drawer', 'CLOSED')
    await activate(page, page.getByTestId('verb-pull'), 'MOUSE_TOUCH')
    await activate(page, page.getByTestId('hotspot-miscellaneous-drawer-cabinet'), 'MOUSE_TOUCH')
    await drainBrowserSpeech(page, 'MOUSE_TOUCH')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-misc-drawer', 'CLOSED')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
    expect(external).toEqual([])
    expect(data.requests.filter((request) => request.forbidden)).toEqual([])
  })

  test('LOOK and the globe stay available before authorization', async ({ page }) => {
    const data = await setup(page, 153)
    await atStart(page)
    data.freeze()
    await activate(page, page.getByTestId('verb-look-at'), 'KEYBOARD')
    await activate(page, page.getByTestId('hotspot-official-case-file-cabinet'), 'KEYBOARD')
    await drainBrowserSpeech(page, 'KEYBOARD')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'CLOSED')
    await activate(page, page.getByTestId('verb-push'), 'KEYBOARD')
    await activate(page, page.getByTestId('hotspot-office-globe'), 'KEYBOARD')
    await drainBrowserSpeech(page, 'KEYBOARD')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'CLOSED')
    expect(data.requests.filter((request) => request.forbidden)).toEqual([])
  })
})
