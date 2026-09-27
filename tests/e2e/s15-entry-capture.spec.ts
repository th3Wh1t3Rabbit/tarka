import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { progressionChain } from '../fixtures/s2/domain-helpers'

const evidenceDir = resolve('artifacts/s15/SCREENSHOTS')
mkdirSync(evidenceDir, { recursive: true })

async function drain(page: Page) {
  let quiet = 0
  for (let guard = 0; guard < 180 && quiet < 3; guard += 1) {
    const speech = page.getByTestId('speech-panel')
    if (await speech.count()) { await speech.click(); quiet = 0 }
    else if (await page.getByTestId('active-sequence').count() || await page.getByTestId('rook-sprite').getAttribute('data-animation') === 'walkEast') quiet = 0
    else quiet += 1
    await page.waitForTimeout(100)
  }
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
}

async function captureSpeech(page: Page, path: string, copyKey: string) {
  const speech = page.getByTestId('speech-panel').or(page.getByTestId('nonblocking-speech'))
  await expect(speech).toHaveAttribute('data-copy-key', copyKey)
  if (await page.getByTestId('speech-panel').count()) await page.getByTestId('speech-panel').click()
  else await page.getByTestId('nonblocking-speech').getByRole('button').evaluate((button) => (button as HTMLButtonElement).click())
  await page.screenshot({ path: resolve(evidenceDir, path) })
}

test('captures the four S15 entry corrections and terminal presentation', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/?skipIntro=1&review=1')
  await expect(page.getByTestId('a0-shell')).toBeVisible()
  await page.getByTestId('review-mode').evaluate((element) => { (element as HTMLElement).style.pointerEvents = 'none' })

  await page.getByTestId('verb-talk-to').click()
  await page.getByTestId('hotspot-mr-index').click({ force: true })
  await expect(page.getByTestId('dialogue-panel')).toBeVisible()
  await page.getByTestId('dialogue-leave').click()
  await captureSpeech(page, '02-preauthorization-exit.png', 'r55-f5c1c3bb790c361dd570')
  await drain(page)

  for (const [verb, hotspot, item, item2, , phase] of progressionChain) {
    await page.getByTestId(`verb-${String(verb).toLowerCase().replace('_', '-')}`).click()
    if (item) await page.getByTestId(`inventory-${item}`).click()
    if (hotspot) await page.getByTestId(`hotspot-${hotspot}`).click({ force: true })
    else if (item2) await page.getByTestId(`inventory-${item2}`).click()
    if (phase === 'COMPLETE') {
      await drain(page)
      await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', String(phase), { timeout: 20_000 })
    } else {
      await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', String(phase), { timeout: 20_000 })
      await drain(page)
    }
  }

  await page.getByTestId('verb-give').click()
  await page.getByTestId('inventory-approved-stamped-terminal-authorization-form').click()
  await page.getByTestId('hotspot-mr-index').click({ force: true })
  await captureSpeech(page, '03-approved-form-response.png', 'r55-55d2c05caee863789835')
  await drain(page)
  await expect(page.getByTestId('inventory-approved-stamped-terminal-authorization-form')).toBeVisible()

  await page.getByTestId('verb-talk-to').click()
  await page.getByTestId('hotspot-mr-index').click({ force: true })
  await expect(page.getByTestId('dialogue-panel')).toBeVisible()
  await page.getByTestId('dialogue-case-file').click()
  await captureSpeech(page, '04-state-aware-arthur-guidance.png', 'r55-daff8449022f321dd2c3')
  await drain(page)
  await page.getByTestId('dialogue-leave').click()
  await captureSpeech(page, '05-postauthorization-exit.png', 'r55-51fd08fa9467b1ae963b')
  await drain(page)

  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await page.getByTestId('verb-use').click()
  await page.getByTestId('hotspot-nansen-terminal').click({ force: true })
  await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: resolve(evidenceDir, '06-terminal.png') })
})
