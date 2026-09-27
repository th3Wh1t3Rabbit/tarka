import { expect, test, type Page } from '@playwright/test'

async function openRoom(page: Page) {
  await page.goto('/?skipIntro=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('text-speed-menu').click()
  await page.getByTestId('dialogue-mode-manual').click()
}

async function drainOptionalSpeech(page: Page) {
  for (let guard = 0; guard < 20 && await page.getByTestId('nonblocking-speech').count(); guard += 1) {
    await page.getByTestId('nonblocking-speech').getByRole('button').evaluate((button) => (button as HTMLButtonElement).click())
    await page.waitForTimeout(20)
  }
  await expect(page.getByTestId('nonblocking-speech')).toHaveCount(0)
}

async function interactWithWorldTarget(page: Page, targetId: string) {
  await page.getByTestId('verb-use').click()
  await page.getByTestId(`hotspot-${targetId}`).click()
  await expect(page.getByTestId('nonblocking-speech')).toBeVisible({ timeout: 20_000 })
  return page.getByTestId('nonblocking-speech').getAttribute('aria-label')
}

test('world USE routing never borrows VHS copy and the stamp observes the current authorization phase', async ({ page }) => {
  test.setTimeout(60_000)
  await openRoom(page)

  for (const targetId of ['blank-authorization-form', 'pen-stand']) {
    const line = await interactWithWorldTarget(page, targetId)
    expect(line).toContain('I should pick it up first.')
    expect(line).not.toMatch(/VHS|videotape|tape/i)
    await drainOptionalSpeech(page)
  }

  const stampLine = await interactWithWorldTarget(page, 'arthur-stamp')
  expect(stampLine).toContain('Tempting')
  expect(stampLine).not.toContain('already approved')
  await drainOptionalSpeech(page)
})

test('Arthur turns toward Rook for the Arthur-only feather-pen pickup warning', async ({ page }) => {
  test.setTimeout(45_000)
  await openRoom(page)
  await page.getByTestId('verb-pick-up').click()
  await page.getByTestId('hotspot-pen-stand').click()
  await expect(page.getByTestId('speech-panel')).toHaveAttribute('data-speaker', 'MR_INDEX', { timeout: 20_000 })
  await expect(page.getByTestId('speech-panel')).toHaveAttribute('data-delivery-key', 'OVR-PEN-01')
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-facing', 'RIGHT')
  await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-facing', 'LEFT')
})

test('approved fallback bags own inventory TALK and non-VHS terminal USE without world mutation', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/?skipIntro=1&review=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await page.getByTestId('text-speed-menu').click()
  await page.getByTestId('dialogue-mode-manual').click()

  await page.getByTestId('verb-talk-to').click()
  await page.getByTestId('inventory-approved-stamped-terminal-authorization-form').click()
  await expect(page.getByTestId('nonblocking-speech')).toBeVisible()
  const talk = await page.getByTestId('nonblocking-speech').getAttribute('aria-label')
  expect(talk).toMatch(/doesn.t want to hear|focusing on the case|one-sided|not on speaking terms/i)
  expect(talk).not.toMatch(/VHS|videotape/i)
  await drainOptionalSpeech(page)

  const room = page.getByTestId('records-office')
  const lampBefore = await room.getAttribute('data-lamp-power')
  const globeBefore = await page.getByTestId('a0-shell').getAttribute('data-globe-level')
  for (const targetId of ['nansen-terminal', 'desk-lamp', 'office-globe']) {
    await page.getByTestId('verb-use').click()
    await page.getByTestId('inventory-approved-stamped-terminal-authorization-form').click()
    await page.getByTestId(`hotspot-${targetId}`).click()
    await expect(page.getByTestId('nonblocking-speech')).toBeVisible({ timeout: 20_000 })
    const response = await page.getByTestId('nonblocking-speech').getAttribute('aria-label')
    expect(response, targetId).toMatch(/don.t think so|don.t really go together|don.t see how that helps|bad idea|keep those separate/i)
    expect(response, targetId).not.toMatch(/VHS|videotape|doesn.t play them/i)
    await drainOptionalSpeech(page)
  }
  await expect(room).toHaveAttribute('data-lamp-power', lampBefore!)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-globe-level', globeBefore!)
  await expect(page.getByTestId('inventory-approved-stamped-terminal-authorization-form')).toHaveCount(1)
})
