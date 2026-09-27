import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const evidenceDir = resolve('artifacts/s14-r4/SCREENSHOTS')
mkdirSync(evidenceDir, { recursive: true })

async function line(page: Page, nodeId: string) {
  await expect(page.locator(`[data-testid="nonblocking-speech"][data-copy-key="${nodeId}"], [data-testid="nonblocking-speech"][data-delivery-key="${nodeId}"]`)).toBeVisible({ timeout: 20_000 })
}

async function nextPanel(page: Page) {
  // TEXT FULL is already fully revealed, so one acknowledgement advances one
  // delivery. A second Space here skipped the following panel entirely.
  await page.keyboard.press('Space')
}

async function dismiss(page: Page) {
  while (await page.getByTestId('nonblocking-speech').count()) await page.keyboard.press('Space')
}

test('multi-panel source slices and wall fallbacks execute through mouse, keyboard, and touch', async ({ browser }) => {
  test.setTimeout(120_000)
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  const external: string[] = []
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1') return route.continue()
    external.push(route.request().url())
    return route.abort('blockedbyclient')
  })
  await context.routeWebSocket('**/*', socket => socket.close())
  await page.goto('/?skipIntro=1')
  const play = page.getByRole('button', { name: 'PLAY', exact: true })
  if (await play.isVisible()) await play.click()
  await expect(page.getByTestId('a0-shell')).toBeVisible()

  await page.getByTestId('verb-look-at').click()
  await page.getByTestId('hotspot-wall-city-bridge').click()
  await line(page, 'r55-46f86d8fa8302c349aa7')
  await page.screenshot({ path: resolve(evidenceDir, '01-city-look-current-delivery.png') })
  await dismiss(page)

  await page.keyboard.press('8')
  await page.getByTestId('hotspot-wall-clock').focus()
  await page.keyboard.press('Enter')
  await line(page, 'r55-3ab2eb3ad7725c4e3d7b')
  await nextPanel(page)
  await line(page, 'r55-aa13a89d23fff75e7482')
  await dismiss(page)

  await page.getByTestId('verb-look-at').tap()
  await page.getByTestId('hotspot-wall-clock').tap()
  for (const nodeId of ['r55-9e2c7f6a8b3f9a66a4ce', 'r55-62545a6ad665eb64819a', 'r55-516164956515f4e6cc55']) {
    await line(page, nodeId)
    if (nodeId !== 'r55-516164956515f4e6cc55') await nextPanel(page)
  }
  await page.screenshot({ path: resolve(evidenceDir, '02-clock-look-third-panel.png') })
  await dismiss(page)

  await page.getByTestId('verb-open').click()
  await page.getByTestId('hotspot-wall-be-the-change').click()
  await line(page, 'r55-046294a69f2076f5cdbc')
  expect(external).toEqual([])
  await context.close()
})
