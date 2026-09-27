import { expect, test, type TestInfo } from '@playwright/test'
import { activate } from '../fixtures/s2/browser-helpers'

const shot = (name: string) => `/tmp/s12-r4r1-shots/${name}.png`

async function attachState(page: import('@playwright/test').Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: shot(name) })
  await testInfo.attach(name, { path: shot(name), contentType: 'image/png' })
}

test.describe('S12-P2-R4 form and dispenser owners', () => {
  test('mouse, touch, and keyboard cannot take I01 from the dispenser', async ({ page }, testInfo) => {
    await page.goto('/?skipIntro=1')
    await page.getByTestId('verb-pull').click()
    await page.getByTestId('hotspot-request-dispenser').click({ position: { x: 12, y: 12 } })
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START', { timeout: 15000 })
    await expect(page.getByTestId('inventory-blank-terminal-authorization-form')).toHaveCount(0)
    await expect(page.getByTestId('hotspot-request-dispenser')).toBeVisible()
    await expect(page.getByTestId('hotspot-blank-authorization-form')).toBeVisible()
    await attachState(page, testInfo, 'w03-mouse-dispenser-remains')
  })

  test('keyboard pull on the dispenser does not grant the form', async ({ page }, testInfo) => {
    await page.goto('/?skipIntro=1')
    await activate(page, page.getByTestId('verb-pull'), 'KEYBOARD')
    await activate(page, page.getByTestId('hotspot-request-dispenser'), 'KEYBOARD')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
    await expect(page.getByTestId('inventory-blank-terminal-authorization-form')).toHaveCount(0)
    await attachState(page, testInfo, 'w03-keyboard-dispenser-remains')
  })
})

test.describe('S12-P2-R4 touch dispenser', () => {
  test.use({ hasTouch: true })
  test('touch pull on the dispenser does not grant the form', async ({ page }, testInfo) => {
    await page.goto('/?skipIntro=1')
    await page.getByTestId('verb-pull').tap()
    await page.getByTestId('hotspot-request-dispenser').tap({ position: { x: 12, y: 12 } })
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START', { timeout: 15000 })
    await expect(page.getByTestId('inventory-blank-terminal-authorization-form')).toHaveCount(0)
    await page.getByTestId('verb-pick-up').tap()
    await page.getByTestId('hotspot-blank-authorization-form').tap()
    await expect(page.getByTestId('inventory-blank-terminal-authorization-form')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('hotspot-request-dispenser')).toBeVisible()
    await expect(page.getByTestId('hotspot-blank-authorization-form')).toHaveCount(0)
    await attachState(page, testInfo, 'w04-touch-form-taken-dispenser-remains')
  })
})
