import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test('S12-P2C ordinary play has no floating terminal button or exit overlay', async ({ page }) => {
  await page.goto('/?skipIntro=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible()
  await expect(page.getByTestId('open-case-terminal')).toHaveCount(0)
  await expect(page.locator('.exit-lit')).toHaveCount(0)
  await expect(page.getByTestId('hotspot-rotunda-exit')).toHaveCount(0)
  await page.goto('/?skipIntro=1&review=1')
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await expect(page.getByTestId('open-case-terminal')).toHaveCount(0)
  await expect(page.locator('.exit-lit')).toHaveCount(0)
  await expect(page.getByText('The Breach Rotunda exit is lit')).toHaveCount(0)
  await expect(page.getByTestId('layout-desk')).toBeVisible()
  await expect(page.getByTestId('hotspot-window')).toBeVisible()
  await expect(page.getByTestId('hotspot-nansen-terminal')).toBeVisible()
  await page.screenshot({ path: '/tmp/s12-p2c-office-clean.png' })
  await page.getByTestId('verb-use').click()
  await page.getByTestId('hotspot-nansen-terminal').click()
  await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 20000 })
  await page.screenshot({ path: '/tmp/s12-p2c-terminal.png' })
  await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
  await expect(page.getByTestId('records-office')).toBeVisible()
  await expect(page.getByTestId('open-case-terminal')).toHaveCount(0)
  await expect(page.locator('.exit-lit')).toHaveCount(0)
  await expect(page.getByTestId('hotspot-nansen-terminal')).toBeFocused()
  await page.screenshot({ path: '/tmp/s12-p2c-return-clean.png' })
})

test('S12-P2-R1 preserved Layout6 and the committed composition render the same static room', async ({ browser }) => {
  const fixture = readFileSync('tests/fixtures/s12-p2-layout6-library.json', 'utf8')
  async function room(storage: string | null, file: string) {
    const context = await browser.newContext()
    if (storage) await context.addInitScript((raw) => localStorage.setItem('trace-escape.layout-library.v1', raw), storage)
    const page = await context.newPage()
    await page.goto('/?skipIntro=1')
    await expect(page.getByTestId('layout-desk')).toBeVisible()
    await page.evaluate(() => {
      document.getAnimations().forEach((animation) => animation.pause())
      for (const id of ['mr-index-sprite', 'layout-mug']) {
        const node = document.querySelector(`[data-testid="${id}"]`)
        if (node instanceof HTMLElement) node.style.visibility = 'hidden'
      }
    })
    await page.getByTestId('scene-art').screenshot({ path: file })
    await context.close()
  }
  await room(null, '/tmp/s12-r1-production-room.png')
  await room(fixture, '/tmp/s12-r1-development-room.png')
})
