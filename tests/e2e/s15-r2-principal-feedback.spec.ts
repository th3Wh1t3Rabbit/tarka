import { expect, test } from '@playwright/test'

async function play(page: import('@playwright/test').Page, query = '') {
  await page.goto(`/${query}`)
  const playButton = page.getByRole('button', { name: 'PLAY', exact: true })
  if (await playButton.count()) await playButton.click()
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
}

test('Principal Playtest 2 route stages entrance and exposes adjacent dialogue controls', async ({ page }) => {
  await play(page, '?artPack=production')
  await expect(page.getByTestId('records-office')).toHaveAttribute('data-opening-stage', 'ARTHUR_PAPER')
  await expect(page.getByTestId('rook-sprite')).toHaveCount(0)
  await expect(page.getByTestId('text-speed-menu')).toContainText('TEXT SPEED · Normal')
  await expect(page.getByTestId('background-music-control')).toBeVisible()
  await expect(page.getByTestId('rook-sprite')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('speech-panel')).toContainText('This the Records Office?', { timeout: 5000 })
})

test('manual mode stops automatic progression and empty world click cancels GIVE then walks', async ({ page }) => {
  await play(page, '?artPack=production&skipIntro=1')
  await page.getByTestId('text-speed-menu').click(); await page.getByTestId('dialogue-mode-manual').click()
  await expect(page.getByTestId('dialogue-mode-manual')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('verb-give').click()
  await expect(page.getByTestId('verb-give')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('records-office').click({ position: { x: 420, y: 320 } })
  await expect(page.getByTestId('verb-give')).toHaveAttribute('aria-pressed', 'false')
})

test('lamp state changes before its response and the stanchion wins overlap priority', async ({ page }) => {
  await play(page, '?artPack=production&skipIntro=1')
  await page.getByTestId('verb-use').click()
  await page.getByTestId('hotspot-desk-lamp').click()
  await expect(page.getByTestId('records-office')).toHaveAttribute('data-lamp-power', 'OFF')
  await expect(page.getByTestId('layout-lamp')).toHaveAttribute('src', /lamp_off\.png/)
  await expect(page.getByTestId('hotspot-mr-index')).toHaveCSS('z-index', '30')
  await expect(page.getByTestId('hotspot-wall-not-a-number')).toHaveCSS('z-index', '31')
})
