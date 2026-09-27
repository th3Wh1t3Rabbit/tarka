import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { runtimeTranscriptRoute, type RuntimeTranscriptDelivery } from '../../src/adventure/runtimeTranscriptAuthority'

interface ObservedDelivery {
  deliveryId: string | null
  speaker: string | null
  text: string
}

const evidenceRoot = resolve('review/s17-p2-r3-r1/RUNTIME_TRANSCRIPT')

async function useManualFullText(page: Page) {
  await page.getByTestId('text-speed-menu').click()
  await page.getByTestId('dialogue-mode-manual').click()
  const full = page.getByRole('button', { name: /Text display is (full|typed)/ })
  if ((await full.getAttribute('aria-pressed')) !== 'true') await full.click()
}

async function observeRoute(page: Page, expected: readonly RuntimeTranscriptDelivery[], capturePrefix?: string) {
  const observed: ObservedDelivery[] = []
  for (const delivery of expected) {
    const panel = page.getByTestId('speech-panel')
    await expect(panel, `waiting for ${delivery.deliveryId}`).toBeVisible({ timeout: 20_000 })
    await expect(panel).toHaveAttribute('data-revealing', 'false', { timeout: 10_000 })
    const row = await panel.evaluate(node => ({
      deliveryId: node.getAttribute('data-copy-key'),
      speaker: node.getAttribute('data-speaker'),
      text: node.querySelector('.full-delivery-measure')?.textContent ?? '',
    }))
    observed.push(row)
    expect(row, `browser delivery ${delivery.deliveryOrder}`).toEqual({
      deliveryId: delivery.deliveryId,
      speaker: delivery.speaker,
      text: delivery.text,
    })
    if (capturePrefix && process.env.S17_P2_R3_R1_EVIDENCE === '1') {
      await page.screenshot({ path: resolve(evidenceRoot, `${capturePrefix}-${delivery.deliveryOrder}.png`) })
    }
    await page.getByTestId('talk-advance-catch').click()
  }
  return observed
}

test('fresh authorization flow delivers the sanitized COMPLETE weekend topic', async ({ page }) => {
  const form = runtimeTranscriptRoute('useful.give-form')!
  const weekend = runtimeTranscriptRoute('dialogue.COMPLETE.sports.initial')!
  if (process.env.S17_P2_R3_R1_EVIDENCE === '1') mkdirSync(evidenceRoot, { recursive: true })

  await page.goto('/?skipIntro=1&review=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await page.getByLabel('Jump to puzzle state').selectOption('FORM_COMPLETED')
  await useManualFullText(page)
  await page.getByTestId('verb-give').click()
  await page.getByTestId('inventory-signed-terminal-authorization-form-with-doodles').click()
  await page.getByTestId('hotspot-mr-index').click({ force: true })
  await observeRoute(page, form.deliveries)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'COMPLETE', { timeout: 20_000 })

  await page.getByTestId('verb-talk-to').click()
  await page.getByTestId('hotspot-mr-index').click({ force: true })
  await expect(page.getByTestId('dialogue-panel')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('dialogue-sports').click()
  const observed = await observeRoute(page, weekend.deliveries, 'WEEKEND_TOPIC')

  expect(observed).toEqual([
    { deliveryId: 'r55-a1e82ce440f96c2356cb', speaker: 'ROOK', text: 'Did you catch the game this weekend?' },
    { deliveryId: 'r55-4c490277ab0492dfa563', speaker: 'MR_INDEX', text: 'Which game?' },
    { deliveryId: 'r55-4cc09c6931dff5cb3805', speaker: 'ROOK', text: 'I was hoping you’d know.' },
  ])

  if (process.env.S17_P2_R3_R1_EVIDENCE === '1') {
    writeFileSync(resolve(evidenceRoot, 'WEEKEND_TOPIC_BROWSER_TRANSCRIPT.json'), `${JSON.stringify({
      schema: 'tarka.s17-p2-r3-r1.browser-transcript.v1',
      prerequisiteRouteId: form.routeId,
      routeId: weekend.routeId,
      sourceAuthorityCount: weekend.deliveries.length,
      observed,
      result: 'EXACT_ORDER_SPEAKER_TEXT_IDENTITY_MATCH_WITHOUT_STRUCTURAL_QUOTES',
    }, null, 2)}\n`)
  }
})
