import { expect, test, type Locator, type Page } from '@playwright/test'

async function clickReady(locator: Locator) {
  await expect(locator).toBeEnabled({ timeout: 8_000 })
  await locator.click()
}

function observeRuntime(page: Page) {
  const errors: string[] = []
  const nonlocalRequests: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('request', (request) => {
    const hostname = new URL(request.url()).hostname
    if (!['localhost', '127.0.0.1'].includes(hostname)) nonlocalRequests.push(request.url())
  })
  return { errors, nonlocalRequests }
}

async function openSyntheticIndex(page: Page) {
  await page.goto('/?scenario=synthetic&review=1')
  await clickReady(page.getByTestId('enter-vault'))
  await clickReady(page.getByTestId('follow-first-trail'))
  await clickReady(page.getByTestId('route-scan'))
  await clickReady(page.getByTestId('open-case-index'))
  await expect(page.getByTestId('twin-breach-index')).toBeVisible({ timeout: 8_000 })
}

async function investigateSynthetic(page: Page, branch: 1 | 2) {
  await clickReady(page.getByTestId(`branch-${branch}`))
  await clickReady(page.getByTestId('analyze-branch'))
  await clickReady(page.getByTestId('complete-branch'))
  if (branch === 1) await clickReady(page.getByTestId('leave-unwind'))
  await clickReady(page.getByTestId('rewind'))
}

test('synthetic calibration preserves the complete keyless investigation loop', async ({ page }) => {
  const runtime = observeRuntime(page)
  await openSyntheticIndex(page)
  await investigateSynthetic(page, 2)
  await investigateSynthetic(page, 1)
  await clickReady(page.getByTestId('bring-records'))
  await page.locator('input[value="SYNTHETIC_STOPPED"]').check()
  await clickReady(page.getByTestId('sweep-forward'))
  await expect(page.getByTestId('counter-reconstruction')).toBeVisible({ timeout: 8_000 })
  await clickReady(page.getByTestId('continue-after-hypothesis'))
  await clickReady(page.getByTestId('build-case'))
  await page.locator('fieldset').filter({ hasText: 'THE AMOUNT' }).locator('input[value="quiet-transformation-gap"]').check()
  await page.locator('fieldset').filter({ hasText: 'THE RECEIVER' }).locator('input[value="archive-successor-delta"]').check()
  await page.locator('fieldset').filter({ hasText: 'THE LINK' }).locator('input[value="conversion-event"]').check()
  await clickReady(page.getByTestId('verify-case'))
  for (let index = 0; index < 7; index += 1) await clickReady(page.getByTestId('truth-continue'))
  await expect(page.getByTestId('truth-complete')).toContainText('SYNTHETIC CALIBRATION ONLY')
  const state = await page.evaluate(() => window.__TRACE_ESCAPE__?.getState())
  expect(state?.branchOrder).toEqual(['branch-b', 'branch-a'])
  expect(state?.contradictionCollected).toBe(true)
  expect(state?.complete).toBe(true)
  expect(runtime.errors).toEqual([])
  expect(runtime.nonlocalRequests).toEqual([])
})

test('accessibility controls remain keyboard-operable in calibration', async ({ page }) => {
  await page.goto('/?scenario=synthetic')
  const motion = page.getByRole('button', { name: /MOTION FULL/ })
  await motion.focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: /MOTION REDUCED/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: /CC ON/ }).click()
  await page.getByRole('button', { name: /^AUDIO/ }).click()
  await page.getByRole('button', { name: /EFFECTS HIGH/ }).click()
  await expect(page.getByRole('button', { name: /CC OFF/ })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: /MUTED/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /EFFECTS LOW/ })).toHaveAttribute('aria-pressed', 'true')
})
