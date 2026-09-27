import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { progressionChain } from '../fixtures/s2/domain-helpers'

const evidenceDir = resolve('artifacts/s14-r1/SCREENSHOTS')
mkdirSync(evidenceDir, { recursive: true })

async function blockExternalNetwork(page: Page) {
  const external: string[] = []
  await page.context().route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1') return route.continue()
    external.push(route.request().url())
    return route.abort('blockedbyclient')
  })
  await page.context().routeWebSocket('**/*', socket => socket.close())
  return external
}

async function drainExactSpeech(page: Page) {
  let quiet = 0
  for (let guard = 0; guard < 300 && quiet < 3; guard++) {
    const panel = page.getByTestId('speech-panel')
    if (await panel.count()) {
      await panel.click()
      quiet = 0
    } else if (await page.getByTestId('active-sequence').count() || await page.getByTestId('rook-sprite').getAttribute('data-animation') === 'walkEast') {
      quiet = 0
    } else quiet++
    await page.waitForTimeout(100)
  }
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
  await expect(page.getByTestId('active-sequence')).toHaveCount(0)
}

async function waitForSpeech(page: Page, exact: RegExp) {
  await expect(page.getByTestId('speech-panel')).toHaveAttribute('aria-label', exact, { timeout: 20_000 })
}

async function advanceToSpeech(page: Page, exact: RegExp) {
  for (let guard = 0; guard < 80; guard++) {
    const panel = page.getByTestId('speech-panel')
    if (await panel.count() && exact.test((await panel.getAttribute('aria-label')) ?? '')) return
    if (await panel.count()) await panel.click()
    await page.waitForTimeout(100)
  }
  await waitForSpeech(page, exact)
}

async function startProduction(page: Page) {
  await page.goto('/?skipIntro=1')
  const play = page.getByRole('button', { name: 'PLAY', exact: true })
  const shell = page.getByTestId('a0-shell')
  await expect(play.or(shell)).toBeVisible()
  if (await play.isVisible()) await play.click()
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-intro-complete', 'true')
}

async function authorize(page: Page) {
  for (const [verb, hotspot, item, item2, , phase] of progressionChain) {
    await page.getByTestId(`verb-${String(verb).toLowerCase().replace('_', '-')}`).click()
    if (item) await page.getByTestId(`inventory-${item}`).click()
    if (hotspot) await page.getByTestId(`hotspot-${hotspot}`).click()
    else if (item2) await page.getByTestId(`inventory-${item2}`).click()
    if (phase === 'COMPLETE') {
      await advanceToSpeech(page, /Arthur: But just for TODAY\.$/)
      await page.screenshot({ path: resolve(evidenceDir, '03-exact-stamp-authorization.png') })
      await drainExactSpeech(page)
      await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', String(phase), { timeout: 20_000 })
    } else {
      await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', String(phase), { timeout: 20_000 })
    }
    if (phase === 'FORM_COMPLETED') {
      await waitForSpeech(page, /Rook: Role:$/)
      await page.screenshot({ path: resolve(evidenceDir, '02-exact-form-completion.png') })
    }
    if (phase !== 'COMPLETE') await drainExactSpeech(page)
  }
}

async function interact(page: Page, verb: string, target: string) {
  await page.getByTestId(`verb-${verb}`).click()
  await page.getByTestId(target).click()
}

test('production binds exact authorization, case search, Arthur, toolbox, and piggy/BRCG world copy', async ({ page }) => {
  test.setTimeout(240_000)
  const external = await blockExternalNetwork(page)
  await startProduction(page)

  await interact(page, 'use', 'hotspot-nansen-terminal')
  await waitForSpeech(page, /Arthur: Don’t touch that!$/)
  await advanceToSpeech(page, /Arthur: YOU ARE NOT AUTHORIZED TO USE THE TERMINAL!$/)
  await advanceToSpeech(page, /Arthur: Submit the signed authorization form first\.$/)
  await page.screenshot({ path: resolve(evidenceDir, '01-exact-terminal-reprimand.png') })
  await drainExactSpeech(page)
  await authorize(page)

  await interact(page, 'talk-to', 'hotspot-mr-index')
  await expect(page.getByTestId('dialogue-panel')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('dialogue-case-file').click()
  await waitForSpeech(page, /Rook: What should I be doing right now\?$/)
  await page.screenshot({ path: resolve(evidenceDir, '06-exact-arthur-guidance.png') })
  await drainExactSpeech(page)
  await page.getByTestId('dialogue-leave').click()
  await drainExactSpeech(page)

  await interact(page, 'open', 'hotspot-official-case-file-cabinet')
  await drainExactSpeech(page)
  await interact(page, 'pick-up', 'hotspot-disorderly-stack-of-confidential-files')
  await advanceToSpeech(page, /Rook: As soon as I find out which one it is\.\.\.$/)
  await page.screenshot({ path: resolve(evidenceDir, '04-exact-case-file-search.png') })
  await drainExactSpeech(page)
  await expect(page.getByTestId('inventory-euler-case-file')).toBeVisible()

  await interact(page, 'open', 'hotspot-miscellaneous-drawer-cabinet')
  await drainExactSpeech(page)
  await interact(page, 'pick-up', 'hotspot-miscellaneous-catch-all-contents')
  await drainExactSpeech(page)
  await page.getByTestId('verb-open').click()
  await page.getByTestId('inventory-small-toolbox-closed').click()
  await advanceToSpeech(page, /Rook: Let’s see what kind of professional-grade responsibility is in here\.$/)
  await drainExactSpeech(page)
  await page.getByTestId('verb-use').click()
  await page.getByTestId('inventory-hammer').click()
  await page.getByTestId('inventory-piggy-bank-intact').click()
  await waitForSpeech(page, /Rook: Sorry, little pig\. This might sting a little\.$/)
  await page.screenshot({ path: resolve(evidenceDir, '05-exact-piggy-brcg-branch.png') })
  await drainExactSpeech(page)
  await expect(page.getByTestId('inventory-fictional-token-note')).toBeVisible()
  await page.getByTestId('verb-look-at').click()
  await page.getByTestId('inventory-fictional-token-note').click()
  await waitForSpeech(page, /Rook: Let’s see\.\.\.$/)
  await drainExactSpeech(page)
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-note-read', 'BACK_READ')
  await interact(page, 'use', 'hotspot-nansen-terminal')
  await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('terminal-section-explore').click()
  await page.getByRole('button', { name: /OFFICE-NOTE TOKEN LEAD/ }).click()
  const brcg = page.getByTestId('s16-screen-body')
  await expect(brcg).toContainText(/BITCOIN ROLLER COASTER GUY/i)
  await expect(brcg).toContainText('0xd4c4407f3afb48d7d4ad954572f155f9237ae335')
  await page.getByRole('button', { name: 'IDENTIFY BRCG' }).click()
  await expect(brcg).toContainText('888,888,888 BRCG')
  await expect(brcg).toContainText('$5,166.34')
  await expect(brcg).toContainText('$13.16 OUT')
  await expect(brcg).toContainText('very little active demand')
  const identifiedBrcgDimensions = await brcg.locator('.s16-brcg-content').evaluate(element => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }))
  expect(identifiedBrcgDimensions.scrollWidth).toBeLessThanOrEqual(identifiedBrcgDimensions.clientWidth + 2)
  expect(identifiedBrcgDimensions.scrollHeight).toBeLessThanOrEqual(identifiedBrcgDimensions.clientHeight + 2)
  await page.getByRole('button', { name: 'WHAT DOES THIS MEAN? →' }).click()
  await page.getByRole('button', { name: 'FILE BRCG FINDING' }).click()
  await expect(brcg).toContainText(/about \$7\.10/i)
  await expect(brcg).toContainText('one cheap lunch...not a fortune')
  await expect(page.getByRole('button', { name: 'FINDING FILED' })).toBeDisabled()
  const resolvedBrcgDimensions = await brcg.locator('.s16-brcg-content').evaluate(element => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }))
  expect(resolvedBrcgDimensions.scrollWidth).toBeLessThanOrEqual(resolvedBrcgDimensions.clientWidth + 2)
  expect(resolvedBrcgDimensions.scrollHeight).toBeLessThanOrEqual(resolvedBrcgDimensions.clientHeight + 2)
  await brcg.screenshot({ path: resolve(evidenceDir, '10-exact-brcg-terminal-branch.png') })
  expect(external).toEqual([])
})
