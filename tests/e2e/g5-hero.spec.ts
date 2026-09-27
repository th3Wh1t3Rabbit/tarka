import { expect, test, type Locator, type Page } from '@playwright/test'

const heroCaptureDirectory = process.env.TRACE_CAPTURE_DIRECTORY ?? 'artifacts/screenshots/g6-hero'

async function clickReady(locator: Locator, timeout = 12_000) {
  await expect(locator).toBeVisible({ timeout })
  await expect(locator).toBeEnabled({ timeout })
  await locator.click()
}

function runtimeEvidence(page: Page) {
  const errors: string[] = []
  const nonlocalRequests: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => { const url = new URL(request.url()); if (!['localhost', '127.0.0.1'].includes(url.hostname)) nonlocalRequests.push(request.url()) })
  return { errors, nonlocalRequests }
}

async function openToIndex(page: Page, query = '') {
  await page.goto(`/${query}`)
  await expect(page.getByTestId('prelaunch')).not.toContainText('THE FALSE EXIT')
  await clickReady(page.getByTestId('enter-vault'))
  await expect(page.getByTestId('case-frame')).toContainText(/DID THE FIRST TRAIL STOP—\s*OR JOIN THE SECOND ROUTE\?/, { timeout: 8_000 })
  await expect(page.getByTestId('case-frame')).not.toContainText(/8\.88M|8,877,507/)
  await clickReady(page.getByTestId('follow-first-trail'))
  await expect(page.getByTestId('guided-travel')).toBeVisible()
  await clickReady(page.getByTestId('route-scan'))
  await expect(page.getByTestId('nansen-marker')).toContainText('NANSEN RECORD LOCKED')
  const beforeIndex = await page.evaluate(() => window.__TRACE_ESCAPE__?.getEvidenceState())
  expect(beforeIndex?.discovered).toEqual([])
  await clickReady(page.getByTestId('open-case-index'))
  await expect(page.getByTestId('twin-breach-index')).toBeVisible({ timeout: 12_000 })
}

async function investigate(page: Page, index: 1 | 2) {
  await clickReady(page.getByTestId(`branch-${index}`))
  await expect(page.getByTestId('branch-record')).toBeVisible({ timeout: 12_000 })
  const before = await page.evaluate(() => window.__TRACE_ESCAPE__?.getEvidenceState())
  await clickReady(page.getByTestId('analyze-branch'))
  const after = await page.evaluate(() => window.__TRACE_ESCAPE__?.getEvidenceState())
  expect(after!.discovered.length).toBeGreaterThan(before!.discovered.length)
  await clickReady(page.getByTestId('complete-branch'))
  if (index === 1) {
    await expect(page.getByTestId('unwind-chamber')).toBeVisible({ timeout: 12_000 })
    await clickReady(page.getByTestId('leave-unwind'))
  }
  await clickReady(page.getByTestId('rewind'))
  const explored = await page.evaluate(() => window.__TRACE_ESCAPE__?.getState().exploredBranches.length ?? 0)
  await expect(page.getByTestId(explored === 2 ? 'records-together' : 'twin-breach-index')).toBeVisible({ timeout: 12_000 })
}

async function reachAssembly(page: Page, hypothesis: 'FIRST_TRAIL_STOPS_AT_FIRST_ENGINE' | 'FIRST_TRAIL_JOINS_SECOND_ROUTE', order: readonly [1 | 2, 1 | 2] = [1, 2]) {
  await investigate(page, order[0])
  await investigate(page, order[1])
  await clickReady(page.getByTestId('bring-records'))
  await page.locator(`input[value="${hypothesis}"]`).check()
  await clickReady(page.getByTestId('sweep-forward'))
  await expect(page.getByTestId(hypothesis.includes('STOPS') ? 'counter-reconstruction' : 'hypothesis-confirmed')).toBeVisible({ timeout: 15_000 })
  await clickReady(page.getByTestId('continue-after-hypothesis'))
  await expect(page.getByTestId('receiving-vault')).toBeVisible({ timeout: 12_000 })
  await clickReady(page.getByTestId('build-case'))
  await expect(page.getByTestId('case-assembly')).toBeVisible()
}

async function assembleCase(page: Page) {
  await page.locator('fieldset').filter({ hasText: 'THE AMOUNT' }).locator('input[value="EXACT_EARLY_NET"]').check()
  await page.locator('fieldset').filter({ hasText: 'THE RECEIVER' }).locator('input[value="EXACT_MAIN_RECEIVER"]').check()
  await page.locator('fieldset').filter({ hasText: 'THE LINK' }).locator('input[value="EXACT_CONVERGENCE"]').check()
  await clickReady(page.getByTestId('verify-case'))
}

async function finishTruth(page: Page) {
  for (let index = 0; index < 6; index += 1) await clickReady(page.getByTestId('truth-continue'))
  await expect(page.getByTestId('truth-complete')).toBeVisible()
}

test.describe('G6 Euler P0 journeys', () => {
  test('Direct Solver completes the confirmed normal-motion click path with manual Truth records', async ({ page }) => {
    const runtime = runtimeEvidence(page)
    await openToIndex(page)
    await reachAssembly(page, 'FIRST_TRAIL_JOINS_SECOND_ROUTE')
    const state = await page.evaluate(() => window.__TRACE_ESCAPE__?.getState())
    expect(state?.contradictionCollected).toBe(false)
    await assembleCase(page)
    await page.waitForTimeout(1_400)
    expect((await page.evaluate(() => window.__TRACE_ESCAPE__?.getState()))?.truthStep).toBe(0)
    await finishTruth(page)
    await expect(page.getByTestId('solved-title')).toHaveText('THE FALSE EXIT')
    await expect(page.getByTestId('truth-complete')).toContainText('THE FIRST TRAIL JOINED THE SECOND ROUTE.')
    expect(runtime.errors).toEqual([])
    expect(runtime.nonlocalRequests).toEqual([])
  })

  test('Curious Explorer uses the opposite branch order and learns that context cannot close the case', async ({ page }) => {
    const runtime = runtimeEvidence(page)
    await openToIndex(page, '?review=1')
    await reachAssembly(page, 'FIRST_TRAIL_JOINS_SECOND_ROUTE', [2, 1])
    const contextual = page.locator('fieldset').filter({ hasText: 'THE LINK' }).locator('input[value="CONTEXT_SECONDARY"]')
    await contextual.click()
    await expect(page.getByRole('alert')).toHaveText("THAT RECORD DOESN'T CLOSE THE TRAIL.")
    const state = await page.evaluate(() => window.__TRACE_ESCAPE__?.getState())
    expect(state?.branchOrder).toEqual(['second-breach', 'first-breach'])
    expect(state?.caseAssembly.LINK).toBeNull()
    expect(runtime.errors).toEqual([])
    expect(runtime.nonlocalRequests).toEqual([])
  })

  test('Mistaken Investigator receives Counter-Reconstruction only after the falsified hypothesis', async ({ page }) => {
    const runtime = runtimeEvidence(page)
    await page.goto('/?review=1')
    await clickReady(page.getByRole('button', { name: /MOTION FULL/ }))
    await openToIndex(page, '?review=1')
    await reachAssembly(page, 'FIRST_TRAIL_STOPS_AT_FIRST_ENGINE')
    const state = await page.evaluate(() => window.__TRACE_ESCAPE__?.getState())
    expect(state?.hypothesisOutcome).toBe('FALSIFIED')
    expect(state?.contradictionCollected).toBe(true)
    expect(state?.discoveredEvidence).toContain('EXACT_CONVERGENCE')
    expect(runtime.errors).toEqual([])
    expect(runtime.nonlocalRequests).toEqual([])
  })

  test('reduced-motion keyboard journey exposes every mandatory action', async ({ page }) => {
    const runtime = runtimeEvidence(page)
    await page.goto('/?review=1')
    await clickReady(page.getByRole('button', { name: /MOTION FULL/ }))
    await page.getByTestId('enter-vault').focus(); await page.keyboard.press('Enter')
    await expect(page.getByTestId('follow-first-trail')).toBeEnabled({ timeout: 3_000 })
    await page.keyboard.down('w'); await expect(page.getByTestId('guided-travel')).toBeVisible()
    await page.waitForTimeout(60); await page.keyboard.up('w'); await page.waitForTimeout(60)
    const paused = (await page.evaluate(() => window.__TRACE_ESCAPE__?.getState().navigation.travelProgress)) ?? 0
    await page.waitForTimeout(180)
    expect(await page.evaluate(() => window.__TRACE_ESCAPE__?.getState().navigation.travelProgress)).toBeCloseTo(paused, 2)
    await page.keyboard.down('w'); await expect(page.getByTestId('route-scan')).toBeEnabled({ timeout: 3_000 }); await page.keyboard.up('w')
    await page.keyboard.press('e'); await expect(page.getByTestId('open-case-index')).toBeEnabled()
    await page.keyboard.press('e'); await expect(page.getByTestId('branch-1')).toBeEnabled({ timeout: 3_000 })
    await page.keyboard.press('a'); await expect(page.getByTestId('analyze-branch')).toBeEnabled({ timeout: 3_000 })
    await page.keyboard.press('e'); await expect(page.getByTestId('complete-branch')).toBeEnabled()
    await page.keyboard.press('e'); await expect(page.getByTestId('leave-unwind')).toBeEnabled({ timeout: 3_000 })
    await page.keyboard.press('e'); await expect(page.getByTestId('rewind')).toBeEnabled()
    await page.keyboard.press('r'); await expect(page.getByTestId('branch-2')).toBeEnabled({ timeout: 3_000 })
    await page.keyboard.press('d'); await expect(page.getByTestId('analyze-branch')).toBeEnabled({ timeout: 3_000 })
    await page.keyboard.press('e'); await expect(page.getByTestId('complete-branch')).toBeEnabled()
    await page.keyboard.press('e'); await expect(page.getByTestId('rewind')).toBeEnabled({ timeout: 3_000 })
    await page.keyboard.press('r'); await expect(page.getByTestId('bring-records')).toBeEnabled({ timeout: 3_000 })
    await page.keyboard.press('e'); await expect(page.getByTestId('working-hypothesis')).toBeVisible()
    const hypothesis = page.locator('input[value="FIRST_TRAIL_JOINS_SECOND_ROUTE"]'); await hypothesis.focus(); await page.keyboard.press('Space')
    const sweep = page.getByTestId('sweep-forward'); await expect(sweep).toBeEnabled(); await sweep.focus(); await page.keyboard.press('Enter'); await expect(page.getByTestId('hypothesis-confirmed')).toBeVisible({ timeout: 3_000 })
    const continueButton = page.getByTestId('continue-after-hypothesis'); await expect(continueButton).toBeEnabled(); await continueButton.focus(); await page.keyboard.press('Enter'); await expect(page.getByTestId('receiving-vault')).toBeVisible({ timeout: 3_000 })
    const build = page.getByTestId('build-case'); await expect(build).toBeEnabled(); await build.focus(); await page.keyboard.press('Enter'); await expect(page.getByTestId('case-assembly')).toBeVisible()
    for (const [slot, evidenceId] of [['THE AMOUNT', 'EXACT_EARLY_NET'], ['THE RECEIVER', 'EXACT_MAIN_RECEIVER'], ['THE LINK', 'EXACT_CONVERGENCE']] as const) {
      const option = page.locator('fieldset').filter({ hasText: slot }).locator(`input[value="${evidenceId}"]`); await option.focus(); await page.keyboard.press('Space')
    }
    await page.getByTestId('verify-case').focus(); await page.keyboard.press('Enter')
    for (let index = 0; index < 6; index += 1) { const advance = page.getByTestId('truth-continue'); await expect(advance).toBeEnabled(); await advance.focus(); await page.keyboard.press('Enter') }
    await expect(page.getByTestId('truth-complete')).toBeVisible()
    expect(runtime.errors).toEqual([])
    expect(runtime.nonlocalRequests).toEqual([])
  })

  test('ordinary play hides review controls while review mode exposes only the documented primary profile', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('review-mode')).toHaveCount(0)
    await page.goto('/?review=1')
    await expect(page.getByTestId('review-mode')).toContainText('GUIDED_PROBE_3D')
    await expect(page.getByTestId('review-mode')).toContainText('FIRST_PERSON_RAIL_3D')
    await expect(page.getByTestId('review-mode')).toContainText('ORTHOGRAPHIC_2_5D')
    await expect(page.getByTestId('review-mode')).toContainText('TOP_DOWN_VECTOR_2D')
  })

  test('critical proof text remains legible and unclipped at 1080p', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await openToIndex(page, '?review=1')
    await reachAssembly(page, 'FIRST_TRAIL_JOINS_SECOND_ROUTE')
    for (const locator of [page.getByTestId('case-assembly'), page.getByText('BUILD THE CASE', { exact: true }), page.getByTestId('verify-case'), ...await page.getByTestId('case-assembly').locator('legend, label > span').all()]) {
      await expect(locator).toBeInViewport({ ratio: 0.8 })
      expect(await locator.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(11)
    }
  })

  test('@capture captures the Principal Hero beat set', async ({ page }) => {
    const { mkdir } = await import('node:fs/promises')
    await mkdir(heroCaptureDirectory, { recursive: true })
    await page.setViewportSize({ width: 1920, height: 1080 })
    const capture = async (name: string) => page.screenshot({ path: `${heroCaptureDirectory}/${name}.png`, fullPage: false })
    await page.goto('/?review=1'); await capture('01-prelaunch-no-spoiler')
    await clickReady(page.getByTestId('enter-vault')); await capture('02-opening-camera-response')
    await expect(page.getByTestId('case-frame')).toBeVisible({ timeout: 8_000 }); await capture('03-case-frame-no-amount')
    await clickReady(page.getByTestId('follow-first-trail')); await clickReady(page.getByTestId('route-scan')); await capture('04-nansen-record')
    await clickReady(page.getByTestId('open-case-index')); await capture('05-twin-breach-index')
    await clickReady(page.getByTestId('branch-1')); await capture('06-first-engine-before-echo'); await clickReady(page.getByTestId('analyze-branch')); await capture('07-first-engine-after-echo')
    await clickReady(page.getByTestId('complete-branch')); await expect(page.getByTestId('unwind-chamber')).toBeVisible({ timeout: 12_000 }); await capture('08-unwind-chamber'); await clickReady(page.getByTestId('leave-unwind')); await clickReady(page.getByTestId('rewind')); await capture('09-rewind')
    await investigate(page, 2); await capture('10-both-breach-records')
    await clickReady(page.getByTestId('bring-records')); await capture('11-working-hypothesis')
    await page.locator('input[value="FIRST_TRAIL_STOPS_AT_FIRST_ENGINE"]').check(); await clickReady(page.getByTestId('sweep-forward')); await expect(page.getByTestId('counter-reconstruction')).toBeVisible({ timeout: 12_000 }); await capture('12-counter-reconstruction')
    await clickReady(page.getByTestId('continue-after-hypothesis')); await expect(page.getByTestId('receiving-vault')).toBeVisible({ timeout: 12_000 }); await capture('13-receiving-vault'); await clickReady(page.getByTestId('build-case')); await capture('14-build-the-case')
    await assembleCase(page); await capture('15-truth-isolate'); await clickReady(page.getByTestId('truth-continue')); await clickReady(page.getByTestId('truth-continue')); await capture('16-truth-reveal'); await clickReady(page.getByTestId('truth-continue')); await clickReady(page.getByTestId('truth-continue')); await capture('17-truth-verify'); await clickReady(page.getByTestId('truth-continue')); await clickReady(page.getByTestId('truth-continue')); await capture('18-solved-title')
  })
})
