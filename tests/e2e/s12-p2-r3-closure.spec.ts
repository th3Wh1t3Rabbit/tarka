import { expect, test, type TestInfo } from '@playwright/test'
import { activate, drainBrowserSpeech, office, setup } from '../fixtures/s2/browser-helpers'

async function settle(page: import('@playwright/test').Page) {
  for (let i = 0; i < 16; i++) {
    if ((await page.getByTestId('speech-panel').count()) === 0 && (await page.getByTestId('nonblocking-speech').count()) === 0 && (await page.getByTestId('rook-sprite').getAttribute('data-animation')) !== 'walkEast' && (await page.getByTestId('rook-sprite').getAttribute('data-animation')) !== 'walkWest') break
    await page.keyboard.press('Space')
    await page.waitForTimeout(150)
  }
}
const shot = (name: string) => `/tmp/s12-r4r1-shots/${name}.png`
const banned = ['TRANSCRIPT', 'METHOD HINT', 'CASE HINT', 'DIRECT HINT', '[PLACEHOLDER — Story binds final copy]']

async function attachShot(testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { path: shot(name), contentType: 'image/png' })
}

test.setTimeout(300_000)

test('normal production and skipIntro hide review surfaces', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  const preview = process.env.S12_PREVIEW_URL ?? 'http://127.0.0.1:4176'
  await page.goto(`${preview}/?skipIntro=1`)
  await expect(page.getByTestId('layout-desk')).toBeVisible()
  const text = await page.locator('body').innerText()
  for (const label of banned) expect(text).not.toContain(label)
  await expect(page.getByTestId('dialogue-transcript')).toHaveCount(0)
  await expect(page.getByTestId('review-mode')).toHaveCount(0)
  await page.goto(`${preview}/?skipIntro=1&review=1`)
  await expect(page.getByTestId('art-pack-loading')).toHaveCount(0)
  await expect(page.getByTestId('a0-shell')).toBeVisible()
  await expect(page.getByTestId('layout-desk')).toBeVisible()
  await page.waitForFunction(() => {
    const desk = document.querySelector('[data-testid="layout-desk"]') as HTMLImageElement | null
    return !!desk && desk.complete && desk.naturalWidth > 0
  })
  await expect(page.getByTestId('verb-pick-up')).toBeVisible()
  await expect(page.getByText('COMPLETE THE AUTHORIZATION FORM.')).toBeVisible()
  await expect(page.getByTestId('review-mode')).toHaveCount(0)
  await expect(page.getByTestId('dialogue-transcript')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'METHOD HINT' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'CASE HINT' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'DIRECT HINT' })).toHaveCount(0)
  const room = await page.locator('body').innerText()
  for (const label of banned) expect(room).not.toContain(label)
  expect(room).not.toContain('VALIDATING ART PACK')
  await page.screenshot({ path: shot('production_clean_room') })
  await attachShot(testInfo, 'production_clean_room')
})

test('development review still exposes the transcript and hints', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/?skipIntro=1')
  await expect(page.getByTestId('dialogue-transcript')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'METHOD HINT' })).toHaveCount(0)
  expect(await page.locator('body').innerText()).not.toContain('[PLACEHOLDER — Story binds final copy]')
  await page.goto('http://127.0.0.1:4173/?skipIntro=1&review=1')
  await expect(page.getByTestId('dialogue-transcript')).toBeVisible()
  await expect(page.getByRole('button', { name: 'METHOD HINT' })).toBeVisible()
})

test('blank form and pen pick up through an ordinary pointer click', async ({ page }, testInfo) => {
  await page.goto('http://127.0.0.1:4173/?skipIntro=1')
  await expect(page.getByTestId('layout-blank-form')).toBeVisible()
  await page.locator('.adventure-scene').screenshot({ path: shot('form_before') })
  await attachShot(testInfo, 'form_before')
  await page.getByTestId('verb-pick-up').click()
  await expect(page.getByTestId('verb-pick-up')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('hotspot-blank-authorization-form').click()
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'FORM_HELD', { timeout: 15000 })
  await settle(page)
  await expect(page.getByTestId('inventory-blank-terminal-authorization-form')).toBeVisible()
  await expect(page.getByTestId('hotspot-blank-authorization-form')).toHaveCount(0)
  await expect(page.getByTestId('layout-blank-form')).toHaveCount(0)
  await expect(page.getByTestId('hotspot-request-dispenser')).toBeVisible()
  await page.locator('.adventure-scene').screenshot({ path: shot('form_after') })
  await attachShot(testInfo, 'form_after')
  await page.locator('.adventure-scene').screenshot({ path: shot('pen_before') })
  await attachShot(testInfo, 'pen_before')
  await page.getByTestId('verb-pick-up').click()
  await page.getByTestId('hotspot-pen-stand').click()
  await expect(page.getByTestId('inventory-loose-feather-pen')).toBeVisible({ timeout: 15000 })
  await settle(page)
  await expect(page.getByTestId('inventory-loose-feather-pen')).toBeVisible()
  await expect(page.getByTestId('hotspot-pen-stand')).toHaveCount(0)
  await expect(page.getByTestId('layout-penstand')).toBeVisible()
  await page.locator('.adventure-scene').screenshot({ path: shot('pen_after_inkwell') })
  await attachShot(testInfo, 'pen_after_inkwell')
})

test('keyboard picks the blank form once', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/?skipIntro=1')
  await activate(page, page.getByTestId('verb-pick-up'), 'KEYBOARD')
  await activate(page, page.getByTestId('hotspot-blank-authorization-form'), 'KEYBOARD')
  await drainBrowserSpeech(page, 'KEYBOARD')
  await expect(page.getByTestId('inventory-blank-terminal-authorization-form')).toHaveCount(1)
  await activate(page, page.getByTestId('verb-pick-up'), 'KEYBOARD')
  await activate(page, page.getByTestId('hotspot-blank-authorization-form'), 'KEYBOARD').catch(() => {})
  await expect(page.locator('[data-testid="inventory-blank-terminal-authorization-form"]')).toHaveCount(1)
})

test('cursor is the default cross on the room and the green cross on a usable target', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1100, height: 640 })
  await page.goto('http://127.0.0.1:4173/?skipIntro=1')
  await page.getByTestId('layout-desk').waitFor()
  const inert = await page.evaluate(() => {
    const scene = document.querySelector('.adventure-scene')!.getBoundingClientRect()
    for (let y = scene.bottom - 6; y > scene.top; y -= 10) {
      for (let x = scene.left + 8; x < scene.right; x += 16) {
        const hit = document.elementFromPoint(x, y)
        if (hit && !hit.closest('.hotspot-button') && !hit.closest('button')) return { x, y }
      }
    }
    return { x: scene.left + 20, y: scene.bottom - 8 }
  })
  await page.mouse.move(inert.x, inert.y)
  await expect(page.locator('.cross-cursor')).toHaveAttribute('data-cursor', 'cross')
  await page.locator('.cross-cursor').screenshot({ path: shot('cursor_default') })
  await attachShot(testInfo, 'cursor_default')
  await page.getByTestId('hotspot-window').hover()
  await expect(page.locator('.cross-cursor')).toHaveAttribute('data-cursor', 'hotspot')
  await page.locator('.cross-cursor').screenshot({ path: shot('cursor_usable') })
  await attachShot(testInfo, 'cursor_usable')
})

test('the real ten-item inventory keeps icon identity and shows the item name', async ({ page }, testInfo) => {
  const data = await setup(page, 410)
  await office(page, 'KEYBOARD', 'DIRECT_SOLVER')
  await activate(page, page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }), 'KEYBOARD')
  await activate(page, page.getByTestId('verb-open'), 'KEYBOARD')
  await activate(page, page.getByTestId('inventory-small-toolbox-closed'), 'KEYBOARD')
  await drainBrowserSpeech(page, 'KEYBOARD')
  await expect(page.getByTestId('inventory')).toContainText('10/10')
  const slot = page.getByTestId('inventory-hammer')
  const before = await slot.locator('img').evaluate((image) => ({ src: (image as HTMLImageElement).currentSrc, box: image.getBoundingClientRect().toJSON() }))
  await page.locator('.inventory-panel').screenshot({ path: shot('inventory_ten_rest') })
  await attachShot(testInfo, 'inventory_ten_rest')
  await slot.hover()
  await expect(page.getByTestId('command-sentence')).toContainText('hammer')
  const hovered = await slot.locator('img').evaluate((image) => ({ src: (image as HTMLImageElement).currentSrc, box: image.getBoundingClientRect().toJSON() }))
  expect(hovered).toEqual(before)
  await page.locator('.inventory-panel').screenshot({ path: shot('inventory_ten_hover') })
  await attachShot(testInfo, 'inventory_ten_hover')
  await slot.focus()
  await expect(page.getByTestId('command-sentence')).toContainText('hammer')
  await page.locator('.inventory-panel').screenshot({ path: shot('inventory_ten_focus') })
  await attachShot(testInfo, 'inventory_ten_focus')
  await page.mouse.move(0, 0)
  await slot.blur()
  await expect(page.getByTestId('command-sentence')).not.toContainText('hammer')
  expect(data.requests.filter((request) => request.forbidden)).toEqual([])
})

test('look, window, and a hidden form target use the world', async ({ page }, testInfo) => {
  await page.goto('http://127.0.0.1:4173/?skipIntro=1')
  await page.getByTestId('verb-look-at').click()
  await page.getByTestId('hotspot-window').click()
  await expect(page.getByTestId('nonblocking-speech')).toBeVisible({ timeout: 15000 })
  await settle(page)
  await page.screenshot({ path: shot('window_interaction') })
  await attachShot(testInfo, 'window_interaction')
  await page.getByTestId('verb-look-at').click()
  await page.getByTestId('hotspot-official-case-file-cabinet').click()
  await expect(page.getByTestId('nonblocking-speech')).toBeVisible({ timeout: 15000 })
  await settle(page)
  await page.screenshot({ path: shot('facing_cabinet_approach') })
  await attachShot(testInfo, 'facing_cabinet_approach')
  await page.screenshot({ path: shot('look_matrix') })
  await attachShot(testInfo, 'look_matrix')
  await page.getByTestId('verb-open').click()
  await page.getByTestId('hotspot-official-case-file-cabinet').click()
  await expect(page.getByTestId('speech-panel').or(page.getByTestId('nonblocking-speech'))).toBeVisible({ timeout: 15000 })
  await page.screenshot({ path: shot('arthur_policy_interrupt') })
  await settle(page)
  await page.getByTestId('verb-pick-up').click()
  await page.getByTestId('hotspot-blank-authorization-form').click()
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'FORM_HELD', { timeout: 15000 })
  await settle(page)
  await expect(page.getByTestId('hotspot-blank-authorization-form')).toHaveCount(0)
  await page.screenshot({ path: shot('hidden_target_absence') })
})

test.describe('touch pickup', () => {
  test.use({ hasTouch: true })
  test('touch picks the blank form and the pen', async ({ page }) => {
    await page.goto('http://127.0.0.1:4173/?skipIntro=1')
    await page.getByTestId('verb-pick-up').tap()
    await page.getByTestId('hotspot-blank-authorization-form').tap()
    await expect(page.getByTestId('inventory-blank-terminal-authorization-form')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('verb-pick-up').tap()
    await page.getByTestId('hotspot-pen-stand').tap()
    await expect(page.getByTestId('inventory-loose-feather-pen')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('hotspot-pen-stand')).toHaveCount(0)
    await expect(page.getByTestId('layout-penstand')).toBeVisible()
  })
})
