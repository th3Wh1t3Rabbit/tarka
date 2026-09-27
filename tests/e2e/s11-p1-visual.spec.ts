import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { setup } from '../fixtures/s2/browser-helpers'

const out = '/tmp/s11-p1-shots'
mkdirSync(out, { recursive: true })

async function frame(page: import('@playwright/test').Page, name: string) {
  await expect(page.getByTestId('a0-shell')).toBeVisible()
  await page.locator('.a0-frame').screenshot({ path: `${out}/${name}` })
}

test.describe('S11-P1 visual review', () => {
  test('S11-P1 office native 2x 4x and blackout', async ({ page }) => {
    await setup(page, 301)
    await page.setViewportSize({ width: 480, height: 270 })
    await page.goto('/?skipIntro=1')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-art-pack', 'production')
    await frame(page, 'office_native.png')
    await page.setViewportSize({ width: 960, height: 540 })
    await frame(page, 'office_2x.png')
    await page.setViewportSize({ width: 1920, height: 1080 })
    await frame(page, 'office_4x.png')
    await page.setViewportSize({ width: 480, height: 270 })
    await page.evaluate(() => { document.documentElement.style.zoom = '2' })
    await frame(page, 'office_zoom.png')
    await page.evaluate(() => { document.documentElement.style.zoom = '1' })
    await page.goto('/')
    await expect(page.getByTestId('speech-panel')).toBeVisible()
    await frame(page, 'blackout.png')
  })

  test('S11-P1 authorization cabinet actors terminal and ambience', async ({ page }) => {
    await setup(page, 302)
    await page.setViewportSize({ width: 960, height: 540 })
    await page.goto('/?skipIntro=1&review=1')
    await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
    await expect(page.getByTestId('hotspot-nansen-terminal')).toBeVisible()
    await frame(page, 'authorization.png')
    await frame(page, 'actors.png')
    await page.getByTestId('verb-open').click()
    await page.getByRole('button', { name: 'Official case-file cabinet', exact: true }).click()
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'OPEN', { timeout: 15000 })
    for (let i = 0; i < 12 && await page.getByTestId('speech-panel').count(); i++) await page.getByTestId('speech-panel').click()
    await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0))
    await frame(page, 'cabinet_states.png')
    await page.getByTestId('verb-push').click()
    await page.getByRole('button', { name: 'Office globe, optional placeholder hotspot', exact: true }).click()
    await expect(page.getByTestId('rook-sprite')).not.toHaveAttribute('data-animation', 'walkEast', { timeout: 15000 })
    for (let i = 0; i < 12 && await page.getByTestId('nonblocking-speech').count(); i++) {
      const reveal = page.getByRole('button', { name: 'REVEAL OPTIONAL LINE' })
      if (await reveal.count()) await reveal.click()
      else await page.getByRole('button', { name: 'NEXT OPTIONAL LINE' }).click()
    }
    await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0))
    await frame(page, 'ambience.png')
    await page.getByTestId('verb-use').click()
    await page.getByTestId('hotspot-nansen-terminal').click()
    await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 15000 })
    await page.screenshot({ path: `${out}/terminal.png` })
    await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
    await frame(page, 'toolbox_piggy_note.png')
  })
})
