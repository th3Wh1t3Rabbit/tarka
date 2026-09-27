import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const evidenceDir = resolve('artifacts/s14-r3/SCREENSHOTS')
mkdirSync(evidenceDir, { recursive: true })

async function openGame(page: Page) {
  const external: string[] = []
  await page.context().route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1') return route.continue()
    external.push(route.request().url())
    return route.abort('blockedbyclient')
  })
  await page.context().routeWebSocket('**/*', socket => socket.close())
  await page.goto('/?skipIntro=1')
  const play = page.getByRole('button', { name: 'PLAY', exact: true })
  if (await play.isVisible()) await play.click()
  await expect(page.getByTestId('a0-shell')).toBeVisible()
  return external
}

async function dismiss(page: Page) {
  while (await page.getByTestId('nonblocking-speech').count()) {
    await page.keyboard.press('Space')
  }
}

async function act(page: Page, verb: string, target: string, nodeId: string | null) {
  await page.getByTestId(`verb-${verb}`).click()
  await page.getByTestId(`hotspot-${target}`).click()
  if (nodeId) await expect(page.getByTestId('nonblocking-speech')).toHaveAttribute('data-copy-key', nodeId, { timeout: 20_000 })
  else await expect(page.getByTestId('nonblocking-speech')).toHaveCount(0)
}

test('real City, Records, Stanchion, unreachable-wall, lamp, and globe routes expose exact copy', async ({ page }) => {
  test.setTimeout(120_000)
  const external = await openGame(page)

  await act(page, 'pick-up', 'wall-city-bridge', 'r55-e5f2fd62fc2df2c6ab52')
  await dismiss(page)
  await act(page, 'use', 'wall-records-sign', 'r55-694d39a38a52f822a6ec')
  await dismiss(page)
  await act(page, 'pick-up', 'wall-not-a-number', 'r55-a4d6ebda1531b05d73d8')
  await page.screenshot({ path: resolve(evidenceDir, '01-grouped-wall-slices.png') })
  await dismiss(page)

  await act(page, 'push', 'wall-building', 'r55-046294a69f2076f5cdbc')
  await dismiss(page)
  await act(page, 'use', 'desk-lamp', 'r55-0e5909a9d8a348ccc0be')
  await dismiss(page)
  await act(page, 'use', 'desk-lamp', 'r55-9d769832ddf3fa5a8073')
  await dismiss(page)
  await act(page, 'use', 'desk-lamp', null)

  await act(page, 'use', 'office-globe', 'r55-3eebf664be6d0c78009c')
  await page.screenshot({ path: resolve(evidenceDir, '02-use-spins-globe-direction-a.png') })
  expect(external).toEqual([])
})
