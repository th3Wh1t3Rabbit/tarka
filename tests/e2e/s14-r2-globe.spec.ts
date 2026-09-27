import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const evidenceDir = resolve('artifacts/s14-r2/SCREENSHOTS')
mkdirSync(evidenceDir, { recursive: true })

async function blockExternalNetwork(page: Page) {
  const external: string[] = []
  await page.context().route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1') return route.continue()
    external.push(route.request().url())
    return route.abort('blockedbyclient')
  })
  await page.context().routeWebSocket('**/*', socket => socket.close())
  return external
}

async function dismissOptional(page: Page) {
  const panel = page.getByTestId('nonblocking-speech')
  await page.keyboard.press('Space')
  await page.keyboard.press('Space')
  await expect(panel).toHaveCount(0)
}

async function expectSpin(page: Page, nodeId: string, level: string, pose: string) {
  await expect(page.getByTestId('nonblocking-speech')).toHaveAttribute('data-copy-key', nodeId, { timeout: 20_000 })
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-globe-level', level)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-globe-pose', pose)
}

test('globe finite mapping survives mouse, keyboard, and real-touch paths through maximum, repeat, and reversal', async ({ browser }) => {
  test.setTimeout(120_000)
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  await page.addInitScript(() => localStorage.setItem('trace-escape.accessibility.v1', JSON.stringify({ schema: 'trace-escape.accessibility.v1', instantText: true, highContrastHotspots: false, dialoguePresentation: 'FULLSCREEN_CRT', reducedAnimation: true })))
  const external = await blockExternalNetwork(page)
  await page.goto('/?skipIntro=1')
  const play = page.getByRole('button', { name: 'PLAY', exact: true })
  const shell = page.getByTestId('a0-shell')
  await expect(play.or(shell)).toBeVisible()
  if (await play.isVisible()) await play.click()
  await expect(shell).toBeVisible()

  await page.getByTestId('verb-push').click()
  await page.getByTestId('hotspot-office-globe').click()
  await expectSpin(page, 'r55-3eebf664be6d0c78009c', '1', 'PUSH')
  await dismissOptional(page)

  await page.keyboard.press('6')
  await page.getByTestId('hotspot-office-globe').focus()
  await page.keyboard.press('Enter')
  await expectSpin(page, 'r55-163ff107d34e448fbca9', '2', 'PUSH')
  await dismissOptional(page)

  await page.getByTestId('verb-push').tap()
  await page.getByTestId('hotspot-office-globe').tap()
  await expectSpin(page, 'r55-06f7c85f1a47a3c7bf5f', '3', 'PUSH')
  await dismissOptional(page)

  await page.getByTestId('verb-push').click()
  await page.getByTestId('hotspot-office-globe').click()
  await expectSpin(page, 'r55-638e390985f479a2ba54', '3', 'PUSH')
  await page.screenshot({ path: resolve(evidenceDir, '01-globe-maximum-speed.png') })
  await dismissOptional(page)

  await page.getByTestId('verb-pull').click()
  await page.getByTestId('hotspot-office-globe').click()
  await expectSpin(page, 'r55-3562a493e8a45d6b3d20', '1', 'PULL')
  await page.screenshot({ path: resolve(evidenceDir, '02-globe-reversal.png') })
  expect(external).toEqual([])
  await context.close()
})
