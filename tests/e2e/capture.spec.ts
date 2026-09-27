import { mkdir } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'

const captureDirectory = process.env.TRACE_CAPTURE_DIRECTORY ?? 'artifacts/screenshots/g6-comparison'
const heroDirectory = 'artifacts/screenshots/g6-hero'

async function clickReady(locator: Locator) {
  await expect(locator).toBeEnabled({ timeout: 10_000 })
  await locator.click()
}

async function reachIndex(page: Page, url: string) {
  await page.goto(url)
  await clickReady(page.getByTestId('enter-vault'))
  await clickReady(page.getByTestId('follow-first-trail'))
  await clickReady(page.getByTestId('route-scan'))
  await clickReady(page.getByTestId('open-case-index'))
  await expect(page.getByTestId('twin-breach-index')).toBeVisible({ timeout: 10_000 })
}

test('@capture records the synthetic and Euler world comparison', async ({ page }) => {
  await mkdir(captureDirectory, { recursive: true })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await reachIndex(page, '/?scenario=synthetic&review=1')
  await page.screenshot({ path: `${captureDirectory}/01-synthetic-case-index.png` })
  await reachIndex(page, '/?review=1')
  await page.screenshot({ path: `${captureDirectory}/02-euler-case-index.png` })
})

test('@capture records guided travel, Extraction Engine, and confirmed Joining Gate', async ({ page }) => {
  await mkdir(heroDirectory, { recursive: true })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?review=1')
  await clickReady(page.getByTestId('enter-vault'))
  await clickReady(page.getByTestId('follow-first-trail'))
  await expect(page.getByTestId('guided-travel')).toBeVisible()
  await page.screenshot({ path: `${heroDirectory}/19-guided-approach.png` })
  await clickReady(page.getByTestId('route-scan'))
  await clickReady(page.getByTestId('open-case-index'))
  await clickReady(page.getByTestId('branch-2'))
  await expect(page.getByTestId('branch-record')).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: `${heroDirectory}/20-extraction-engine-before-map.png` })
  await clickReady(page.getByTestId('analyze-branch'))
  await page.screenshot({ path: `${heroDirectory}/21-extraction-engine-after-map.png` })
  await clickReady(page.getByTestId('complete-branch'))
  await clickReady(page.getByTestId('rewind'))
  await clickReady(page.getByTestId('branch-1'))
  await clickReady(page.getByTestId('analyze-branch'))
  await clickReady(page.getByTestId('complete-branch'))
  await clickReady(page.getByTestId('leave-unwind'))
  await clickReady(page.getByTestId('rewind'))
  await clickReady(page.getByTestId('bring-records'))
  await page.locator('input[value="FIRST_TRAIL_JOINS_SECOND_ROUTE"]').check()
  await clickReady(page.getByTestId('sweep-forward'))
  await expect(page.getByTestId('hypothesis-confirmed')).toBeVisible({ timeout: 12_000 })
  await page.screenshot({ path: `${heroDirectory}/22-confirmed-joining-gate.png` })
})
