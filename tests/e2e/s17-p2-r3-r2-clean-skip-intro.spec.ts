import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const evidenceDirectory = process.env.S17_R2_EVIDENCE_DIR ? resolve(process.env.S17_R2_EVIDENCE_DIR) : null

async function capture(page: Page, name: string) {
  if (!evidenceDirectory) return
  mkdirSync(evidenceDirectory, { recursive: true })
  await page.screenshot({ path: resolve(evidenceDirectory, `${name}.png`) })
}

const INSTRUCTION_TAIL = [
  ['OPEN-077', 'OPEN-077', 'Take a blank terminal authorization form from the dispenser.'],
  ['OPEN-078', 'OPEN-078', 'Fill it out COMPLETELY, then bring it back to me.'],
  ['OPEN-079', 'OPEN-079', 'Until you submit it...'],
  ['OPEN-079::2', 'OPEN-079', 'and unless management renders you a favorable response...'],
  ['OPEN-079::3', 'OPEN-079', 'do not use the terminal or access the case files.'],
  ['OPEN-080', 'OPEN-080', 'And DO NOT touch anything else!'],
] as const

async function selectManualFull(page: Page) {
  await page.getByTestId('text-speed-menu').click()
  await page.getByTestId('dialogue-mode-manual').click()
  const full = page.getByRole('button', { name: /Text display is (full|typed)/ })
  if ((await full.getAttribute('aria-pressed')) !== 'true') await full.click()
}

async function drainRoom(page: Page) {
  for (let guard = 0; guard < 300; guard += 1) {
    if (await page.getByTestId('speech-panel').count()) {
      await page.getByTestId('talk-advance-catch').click()
      await page.waitForTimeout(20)
      continue
    }
    if (await page.getByTestId('nonblocking-speech').count()) {
      await page.getByTestId('nonblocking-speech').getByRole('button').click()
      await page.waitForTimeout(20)
      continue
    }
    if (await page.getByTestId('active-sequence').count()) {
      await page.waitForTimeout(120)
      continue
    }
    if (await page.getByTestId('rook-sprite').evaluate((node) => node.classList.contains('walking'))) {
      await page.waitForTimeout(120)
      continue
    }
    return
  }
  throw new Error('ROOM_DRAIN_GUARD_EXHAUSTED')
}

async function worldAction(page: Page, verb: string, hotspot: string, item?: string) {
  await page.getByTestId(`verb-${verb}`).click()
  if (item) await page.getByTestId(`inventory-${item}`).click()
  await page.getByTestId(`hotspot-${hotspot}`).click({ force: true })
}

async function advanceOpeningTo(page: Page, deliveryKey: string) {
  const panel = page.getByTestId('speech-panel')
  await expect(panel).toBeVisible({ timeout: 20_000 })
  for (let guard = 0; guard < 120; guard += 1) {
    if (await panel.getAttribute('data-delivery-key') === deliveryKey) return
    await expect(page.getByTestId('intro-skip-button')).toHaveText('SKIP INTRO >>>')
    await page.getByTestId('talk-advance-catch').click()
    await page.waitForTimeout(20)
  }
  throw new Error(`OPENING_DELIVERY_NOT_REACHED:${deliveryKey}`)
}

test('Skip Intro freezes safely, lands on exact identities, completes authorization, and enters the real terminal', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await expect(page.getByTestId('intro-skip-button')).toHaveCount(0)
  await page.getByRole('button', { name: 'PLAY', exact: true }).click()
  const shell = page.getByTestId('a0-shell')
  await expect(shell).toBeVisible({ timeout: 20_000 })
  await selectManualFull(page)

  const skip = page.getByTestId('intro-skip-button')
  await expect(skip).toHaveText('SKIP INTRO >>>')
  await capture(page, '01-skip-button')
  await skip.click()

  const confirmation = page.getByTestId('intro-skip-confirmation')
  await expect(confirmation).toBeVisible()
  const cursor = page.locator('.cross-cursor')
  await page.locator('.a0-frame').hover({ position: { x: 120, y: 100 } })
  await expect(cursor).toBeVisible()
  const stacking = await page.evaluate(() => {
    const cursorNode = document.querySelector<HTMLElement>('.cross-cursor')
    const shieldNode = document.querySelector<HTMLElement>('.intro-skip-shield')
    if (!cursorNode || !shieldNode) throw new Error('SKIP_CURSOR_STACKING_NODES_MISSING')
    return {
      cursorZ: Number.parseInt(getComputedStyle(cursorNode).zIndex, 10),
      shieldZ: Number.parseInt(getComputedStyle(shieldNode).zIndex, 10),
      pointerEvents: getComputedStyle(cursorNode).pointerEvents,
    }
  })
  expect(stacking.cursorZ).toBeGreaterThan(stacking.shieldZ)
  expect(stacking.pointerEvents).toBe('none')
  await expect(page.getByText('SKIP THE INTRO?', { exact: true })).toBeVisible()
  await expect(confirmation).toContainText("Jump to Arthur's final instructions? You will still need to complete the authorization puzzle.")
  const no = page.getByRole('button', { name: "No, I'm fully engaged" })
  const yes = page.getByRole('button', { name: "Yes, I'm super bored" })
  await expect(no).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(yes).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(no).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(yes).toBeFocused()
  await page.keyboard.press('Tab')
  await capture(page, '02-confirmation')

  const openingStage = await page.getByTestId('records-office').getAttribute('data-opening-stage')
  const openingPanel = page.getByTestId('speech-panel')
  const openingDelivery = await openingPanel.count() ? await openingPanel.getAttribute('data-delivery-key') : null
  await page.waitForTimeout(2_200)
  await expect(page.getByTestId('records-office')).toHaveAttribute('data-opening-stage', openingStage!)
  if (openingDelivery) await expect(page.getByTestId('speech-panel')).toHaveAttribute('data-delivery-key', openingDelivery)
  await page.keyboard.press('Escape')
  await expect(confirmation).toHaveCount(0)
  await expect(skip).toBeFocused()
  await capture(page, '03-cancel-resume')

  await skip.click()
  await yes.click()
  await expect(page.getByTestId('intro-skip-announcement')).toHaveText("Intro skipped. Arthur's final instructions begin.")
  for (const [deliveryId, sourceId, text] of INSTRUCTION_TAIL) {
    const panel = page.getByTestId('speech-panel')
    await expect(panel).toHaveAttribute('data-delivery-key', deliveryId)
    await expect(panel).toHaveAttribute('data-copy-key', sourceId)
    await expect(panel.locator('.full-delivery-measure')).toHaveText(text)
    if (deliveryId === 'OPEN-077') await capture(page, '04-exact-landing')
    await page.getByTestId('talk-advance-catch').click()
  }
  await expect(shell).toHaveAttribute('data-intro-complete', 'true')
  await expect(skip).toHaveCount(0)
  await expect(shell).toHaveAttribute('data-phase', 'START')
  await capture(page, '05-puzzle-ui')

  await worldAction(page, 'pick-up', 'blank-authorization-form')
  await expect(shell).toHaveAttribute('data-phase', 'FORM_HELD', { timeout: 20_000 })
  await drainRoom(page)
  await worldAction(page, 'pick-up', 'pen-stand')
  await expect(shell).toHaveAttribute('data-phase', 'FORM_AND_PEN', { timeout: 20_000 })
  await drainRoom(page)
  await page.getByTestId('verb-use').click()
  await page.getByTestId('inventory-blank-terminal-authorization-form').click()
  await page.getByTestId('inventory-loose-feather-pen').click()
  await expect(shell).toHaveAttribute('data-phase', 'FORM_COMPLETED')
  await drainRoom(page)
  await worldAction(page, 'give', 'mr-index', 'signed-terminal-authorization-form-with-doodles')
  await drainRoom(page)
  await expect(shell).toHaveAttribute('data-phase', 'COMPLETE', { timeout: 30_000 })
  await expect(page.getByTestId('inventory-approved-stamped-terminal-authorization-form')).toBeVisible()
  await expect(page.getByTestId('records-office')).toHaveAttribute('data-terminal-can-open', 'true')
  await worldAction(page, 'use', 'nansen-terminal')
  await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('intro-skip-button')).toHaveCount(0)
  await capture(page, '06-terminal-entry')
})

test('title, credits, fresh runs, and one ordinary opening keep Skip Intro correctly bounded', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await expect(page.getByTestId('tarka-title-screen')).toBeVisible()
  await expect(page.getByTestId('intro-skip-button')).toHaveCount(0)
  await page.getByRole('button', { name: 'CREDITS', exact: true }).click()
  await expect(page.getByTestId('tarka-credits-screen')).toBeVisible()
  await expect(page.getByTestId('intro-skip-button')).toHaveCount(0)
  await page.getByRole('button', { name: '[ RETURN ]', exact: true }).click()
  await page.getByRole('button', { name: 'PLAY', exact: true }).click()
  const shell = page.getByTestId('a0-shell')
  await expect(shell).toBeVisible({ timeout: 20_000 })
  await selectManualFull(page)

  for (let guard = 0; guard < 300; guard += 1) {
    if (await shell.getAttribute('data-intro-complete') === 'true') break
    if (await page.getByTestId('speech-panel').count()) {
      await page.getByTestId('talk-advance-catch').click()
      await page.waitForTimeout(40)
    } else {
      await page.waitForTimeout(100)
    }
  }
  await expect(shell).toHaveAttribute('data-intro-complete', 'true')
  await expect(page.getByTestId('intro-skip-button')).toHaveCount(0)

  await page.reload()
  await expect(page.getByTestId('tarka-title-screen')).toBeVisible()
  await expect(page.getByTestId('intro-skip-button')).toHaveCount(0)
  await page.getByRole('button', { name: 'PLAY', exact: true }).click()
  await expect(page.getByTestId('intro-skip-button')).toHaveText('SKIP INTRO >>>', { timeout: 20_000 })
})

test('ordinary title route keeps Skip Intro on both effective OPEN-019 deliveries and lands exactly', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await page.getByRole('button', { name: 'PLAY', exact: true }).click()
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await selectManualFull(page)

  const panel = page.getByTestId('speech-panel')
  const skip = page.getByTestId('intro-skip-button')
  await advanceOpeningTo(page, 'OPEN-019.delivery-1')
  await expect(panel).toHaveAttribute('data-copy-key', 'OPEN-019')
  await expect(skip).toHaveText('SKIP INTRO >>>')
  await skip.click()
  await page.keyboard.press('Escape')
  await expect(panel).toHaveAttribute('data-delivery-key', 'OPEN-019.delivery-1')
  await expect(skip).toHaveText('SKIP INTRO >>>')

  await page.getByTestId('talk-advance-catch').click()
  await expect(panel).toHaveAttribute('data-delivery-key', 'OPEN-019.delivery-2')
  await expect(panel).toHaveAttribute('data-copy-key', 'OPEN-019')
  await expect(skip).toHaveText('SKIP INTRO >>>')

  await page.getByTestId('talk-advance-catch').click()
  await expect(panel).toHaveAttribute('data-delivery-key', 'OPEN-020')
  await expect(skip).toHaveText('SKIP INTRO >>>')

  await page.reload()
  await page.getByRole('button', { name: 'PLAY', exact: true }).click()
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await selectManualFull(page)
  await advanceOpeningTo(page, 'OPEN-019.delivery-2')
  await expect(skip).toHaveText('SKIP INTRO >>>')
  await skip.click()
  await page.getByRole('button', { name: "Yes, I'm super bored" }).click()
  await expect(panel).toHaveAttribute('data-delivery-key', 'OPEN-077')
  await expect(panel).toHaveAttribute('data-copy-key', 'OPEN-077')
  await expect(page.getByTestId('intro-skip-announcement')).toHaveText("Intro skipped. Arthur's final instructions begin.")
})
