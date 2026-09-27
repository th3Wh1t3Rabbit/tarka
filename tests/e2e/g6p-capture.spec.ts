import { mkdirSync, rmSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const output = 'artifacts/screenshots/g6p-a1'

async function ready(page: Page, url = '/') {
  const target = new URL(url, 'http://local.test')
  target.searchParams.set('skipIntro', '1')
  await page.goto(`${target.pathname}${target.search}`)
  await expect(page.getByTestId('a0-shell')).toBeVisible()
}

async function shot(page: Page, name: string, fullPage = false) {
  await page.screenshot({ path: `${output}/${name}.png`, fullPage })
}

test.beforeAll(() => { rmSync(output, { recursive: true, force: true }); mkdirSync(output, { recursive: true }) })

test('Principal preview at 1280×720 @g6p-capture', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/')
  await expect(page.getByTestId('speech-panel')).toBeVisible()
  await page.getByTestId('speech-panel').click()
  await shot(page, '01-1280-opening-dialogue')
  await ready(page)
  await shot(page, '02-1280-records-office')
  await page.goto('/?artLab=1')
  await expect(page.getByTestId('art-lab')).toBeVisible()
  await page.getByTestId('art-pack-diagnostics').evaluate((element) => element.scrollIntoView({ block: 'start' }))
  await shot(page, '03-1280-art-lab-diagnostics', true)
  await page.evaluate(() => { document.querySelector('.art-lab')?.scrollTo(0, 0) })
  await page.getByLabel('Art Lab scene').selectOption('blank-shell')
  await shot(page, '04-1280-blank-scene-fixture')
  await page.goto('/?review=1')
  await expect(page.getByTestId('review-mode')).toBeVisible()
  await page.getByLabel('Jump to puzzle state').selectOption('FORM_SUBMITTED')
  await shot(page, '05-1280-form-submitted')
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await shot(page, '06-1280-authorization-complete')
})

test('Principal preview at 1920×1080 @g6p-capture', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?artLab=1')
  await expect(page.getByTestId('art-pack-diagnostics')).toBeVisible()
  await page.getByTestId('art-pack-diagnostics').evaluate((element) => element.scrollIntoView({ block: 'start' }))
  await shot(page, '07-1920-art-lab-diagnostics', true)
  await page.goto('/?review=1')
  await expect(page.getByTestId('review-mode')).toBeVisible()
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await page.waitForTimeout(300)
  await shot(page, '08-1920-authorization-complete')
})
