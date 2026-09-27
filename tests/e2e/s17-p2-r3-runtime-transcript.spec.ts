import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { runtimeTranscriptRoute, type RuntimeTranscriptDelivery } from '../../src/adventure/runtimeTranscriptAuthority'

interface ObservedDelivery {
  deliveryId: string | null
  sourceDeliveryId: string | null
  speaker: string | null
  text: string
}

const evidenceRoot = resolve('review/s17-p2-r3/RUNTIME_TRANSCRIPT')

async function useManualFullText(page: Page) {
  await page.getByTestId('text-speed-menu').click()
  await page.getByTestId('dialogue-mode-manual').click()
  const full = page.getByRole('button', { name: /Text display is (full|typed)/ })
  if ((await full.getAttribute('aria-pressed')) !== 'true') await full.click()
}

async function observeExactRoute(page: Page, expected: readonly RuntimeTranscriptDelivery[]) {
  const observed: ObservedDelivery[] = []
  for (const delivery of expected) {
    const panel = page.getByTestId('speech-panel')
    await expect(panel, `waiting for ${delivery.deliveryId}`).toBeVisible({ timeout: 20_000 })
    await expect(panel).toHaveAttribute('data-revealing', 'false', { timeout: 10_000 })
    const row = await panel.evaluate(node => ({
      deliveryId: node.getAttribute('data-delivery-key'),
      sourceDeliveryId: node.getAttribute('data-copy-key'),
      speaker: node.getAttribute('data-speaker'),
      text: node.querySelector('.full-delivery-measure')?.textContent ?? '',
    }))
    observed.push(row)
    expect(row, `browser delivery ${delivery.deliveryOrder}`).toEqual({
      deliveryId: delivery.deliveryId,
      sourceDeliveryId: delivery.sourceDeliveryId,
      speaker: delivery.speaker,
      text: delivery.text,
    })
    await page.getByTestId('talk-advance-catch').click()
  }
  return observed
}

test('ordinary opening browser transcript is the exact runtime authority with no duplicate replay', async ({ page }) => {
  const authority = runtimeTranscriptRoute('opening.principal')!
  await page.goto('/')
  await page.getByRole('button', { name: 'PLAY', exact: true }).click()
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await useManualFullText(page)
  const observed = await observeExactRoute(page, authority.deliveries)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-intro-complete', 'true', { timeout: 20_000 })
  expect(observed.some((row, index) => index > 0 && row.deliveryId === observed[index - 1]!.deliveryId && row.speaker === observed[index - 1]!.speaker && row.text === observed[index - 1]!.text)).toBe(false)

  if (process.env.S17_P2_R3_EVIDENCE === '1') {
    mkdirSync(evidenceRoot, { recursive: true })
    writeFileSync(resolve(evidenceRoot, 'OPENING_BROWSER_TRANSCRIPT.json'), `${JSON.stringify({
      schema: 'tarka.s17-p2-r3.browser-transcript.v1',
      routeId: authority.routeId,
      sourceAuthorityCount: authority.deliveries.length,
      observed,
      result: 'EXACT_ORDER_SPEAKER_TEXT_IDENTITY_MATCH',
    }, null, 2)}\n`)
  }
})

test('form review and authorization browser transcript is the exact useful-route authority', async ({ page }) => {
  const authority = runtimeTranscriptRoute('useful.give-form')!
  await page.goto('/?skipIntro=1&review=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await page.getByLabel('Jump to puzzle state').selectOption('FORM_COMPLETED')
  await useManualFullText(page)
  await page.getByTestId('verb-give').click()
  await page.getByTestId('inventory-signed-terminal-authorization-form-with-doodles').click()
  await page.getByTestId('hotspot-mr-index').click({ force: true })
  const observed = await observeExactRoute(page, authority.deliveries)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'COMPLETE', { timeout: 20_000 })
  expect(observed.some((row, index) => index > 0 && row.deliveryId === observed[index - 1]!.deliveryId && row.speaker === observed[index - 1]!.speaker && row.text === observed[index - 1]!.text)).toBe(false)

  if (process.env.S17_P2_R3_EVIDENCE === '1') {
    mkdirSync(evidenceRoot, { recursive: true })
    writeFileSync(resolve(evidenceRoot, 'FORM_BROWSER_TRANSCRIPT.json'), `${JSON.stringify({
      schema: 'tarka.s17-p2-r3.browser-transcript.v1',
      routeId: authority.routeId,
      sourceAuthorityCount: authority.deliveries.length,
      observed,
      result: 'EXACT_ORDER_SPEAKER_TEXT_IDENTITY_MATCH',
    }, null, 2)}\n`)
  }
})

test('large fullscreen room text and terminal cursor retain the same integer-scaled presentation', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 })
  await page.goto('/?skipIntro=1&review=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await expect(page.locator('.a0-frame')).toHaveAttribute('data-integer-scale', '5')

  const roomTypography = await page.evaluate(() => ({
    frame: getComputedStyle(document.querySelector<HTMLElement>('.a0-frame')!).fontSize,
    command: getComputedStyle(document.querySelector<HTMLElement>('.command-sentence')!).fontSize,
    inventory: getComputedStyle(document.querySelector<HTMLElement>('.inventory-panel header')!).fontSize,
    objective: getComputedStyle(document.querySelector<HTMLElement>('.objective-card strong')!).fontSize,
  }))
  expect(roomTypography).toEqual({ frame: '40px', command: '40px', inventory: '32px', objective: '32.8px' })

  await page.getByTestId('verb-talk-to').click()
  await page.getByTestId('hotspot-mr-index').click({ force: true })
  await expect(page.getByRole('button', { name: 'WHAT SHOULD I BE DOING RIGHT NOW?' })).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => page.getByRole('button', { name: 'WHAT SHOULD I BE DOING RIGHT NOW?' }).evaluate(node => getComputedStyle(node).fontSize)).toBe('36.8px')
  await page.getByRole('button', { name: 'WHAT SHOULD I BE DOING RIGHT NOW?' }).click()
  await expect(page.getByTestId('speech-panel')).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => page.getByTestId('speech-panel').evaluate(node => getComputedStyle(node).fontSize)).toBe('40px')

  await page.goto('/?skipIntro=1&review=1')
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await page.getByTestId('verb-use').click()
  await page.getByTestId('hotspot-nansen-terminal').click({ force: true })
  const viewport = page.getByTestId('terminal-viewport')
  await expect(viewport).toHaveAttribute('data-integer-scale', '5')
  await expect(viewport).toHaveAttribute('data-cursor-size', '65', { timeout: 20_000 })
  const cursorCoverage = await page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>('[data-testid="terminal-viewport"]')!
    const terminal = document.querySelector<HTMLElement>('.s5-native-terminal')!
    const rect = terminal.getBoundingClientRect()
    const bezel = document.elementFromPoint(rect.left + 5, rect.top + 5) as HTMLElement
    const screen = document.elementFromPoint(rect.left + (100 * Number(viewport.dataset.integerScale)), rect.top + (100 * Number(viewport.dataset.integerScale))) as HTMLElement
    return {
      viewport: getComputedStyle(viewport).cursor,
      bezel: getComputedStyle(bezel).cursor,
      screen: getComputedStyle(screen).cursor,
    }
  })
  expect(cursorCoverage.viewport).toMatch(/^url\(/)
  expect(cursorCoverage.bezel).toBe(cursorCoverage.viewport)
  expect(cursorCoverage.screen).toBe(cursorCoverage.viewport)
})
