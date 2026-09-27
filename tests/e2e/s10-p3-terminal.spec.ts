import { expect, test, type Page } from '@playwright/test'
import { setup } from '../fixtures/s2/browser-helpers'

test.setTimeout(90_000)

async function authorized(page: Page) {
  await page.goto('/?skipIntro=1&review=1')
  await expect(page.getByTestId('review-mode')).toBeVisible()
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await expect(page.getByTestId('hotspot-nansen-terminal')).toBeVisible()
  await page.evaluate(() => {
    const host = window as unknown as { __repl: { id: string; beforeTerminal: boolean }[] }
    host.__repl = []
    new MutationObserver(() => {
      const el = document.querySelector('[data-testid="intent-announcement"]')
      if (!el) return
      const id = el.getAttribute('data-replacement-id') || ''
      const beforeTerminal = document.querySelector('[data-testid="case-terminal"]') == null
      const last = host.__repl[host.__repl.length - 1]
      if (id && (!last || last.id !== id)) host.__repl.push({ id, beforeTerminal })
    }).observe(document.body, { childList: true, subtree: true, attributes: true })
  })
}

test.describe('S10-P3 terminal entry browser', () => {
  test('S10-P3 pending official-drawer OPEN is replaced by the terminal hotspot', async ({ page }) => {
    const data = await setup(page, 201)
    await authorized(page)
    data.freeze()
    await page.getByTestId('verb-open').click()
    await page.getByRole('button', { name: 'Official case-file cabinet', exact: true }).click()
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
    await page.getByTestId('verb-use').click()
    await page.getByTestId('hotspot-nansen-terminal').click()
    await expect.poll(async () => page.evaluate(() => (window as unknown as { __repl: { id: string; beforeTerminal: boolean }[] }).__repl)).toEqual([expect.objectContaining({ id: '1', beforeTerminal: true })])
    await expect(page.getByTestId('case-terminal')).toBeVisible()
    await expect(page.getByTestId('records-office')).toHaveCount(0)
  })

  test('S10-P3 world terminal hotspot requests reducer-owned entry by mouse and again by test id', async ({ page }) => {
    const data = await setup(page, 202)
    await authorized(page)
    data.freeze()
    await page.getByRole('button', { name: /^USE\b/ }).click()
    await page.getByRole('button', { name: 'Frozen Nansen terminal', exact: true }).click()
    await expect(page.getByTestId('case-terminal')).toBeVisible()
    await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
    await expect(page.getByTestId('hotspot-nansen-terminal')).toBeVisible()
    await page.getByTestId('verb-use').click()
    await page.getByTestId('hotspot-nansen-terminal').click()
    await expect(page.getByTestId('case-terminal')).toBeVisible()
  })

  test('S10-P3 keyboard terminal entry uses the authored CRT path', async ({ page }) => {
    const data = await setup(page, 203)
    await authorized(page)
    await expect(page.getByLabel('Dialogue presentation')).toHaveCount(0)
    data.freeze()
    await page.getByTestId('verb-use').focus()
    await page.keyboard.press('Enter')
    await page.getByTestId('hotspot-nansen-terminal').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('case-terminal')).toBeVisible()
    await expect(page.getByLabel('Dialogue presentation')).toHaveCount(0)
  })

  test('S10-P3 protected world-state snapshot remains unchanged while terminal is open', async ({ page }) => {
    const data = await setup(page, 204)
    await authorized(page)
    data.freeze()
    await page.getByTestId('verb-use').click()
    await page.getByTestId('hotspot-nansen-terminal').click()
    await expect(page.getByTestId('case-terminal')).toBeVisible()
    await page.waitForTimeout(1200)
    await expect(page.getByTestId('records-office')).toHaveCount(0)
    await expect(page.getByTestId('case-terminal')).toBeVisible()
    await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'CLOSED')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'COMPLETE')
    await expect(page.getByTestId('rook-sprite')).not.toHaveAttribute('data-animation', 'walkEast')
  })

  test('S10-P3 closing terminal does not resurrect the old action', async ({ page }) => {
    const data = await setup(page, 205)
    await authorized(page)
    data.freeze()
    await page.getByTestId('verb-open').click()
    await page.getByRole('button', { name: 'Official case-file cabinet', exact: true }).click()
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
    await page.getByTestId('verb-use').click()
    await page.getByTestId('hotspot-nansen-terminal').click()
    await expect(page.getByTestId('case-terminal')).toBeVisible()
    await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'CLOSED')
    await expect(page.getByTestId('active-sequence')).toHaveCount(0)
    await expect(page.getByTestId('rook-sprite')).not.toHaveAttribute('data-animation', 'walkEast')
  })

  test('S10-P3 close restores focus to the terminal hotspot', async ({ page }) => {
    const data = await setup(page, 206)
    await authorized(page)
    data.freeze()
    await page.getByTestId('verb-use').click()
    await page.getByTestId('hotspot-nansen-terminal').click()
    await expect(page.getByTestId('case-terminal')).toBeVisible()
    await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
    await expect(page.getByTestId('hotspot-nansen-terminal')).toBeFocused()
  })
})
