import { expect, test } from '@playwright/test'
import { activate, button, drainBrowserSpeech, office, resolveCandidateRoute, setup } from '../fixtures/s2/browser-helpers'
import { violatesFrozenBrowserPolicy } from '../fixtures/browser-policy'
test.setTimeout(180_000)

// S9-P1-R2: drawer seam, compare gating, and scene-rendering restoration.
test.describe('S9-P1-R2 reconciliation and cabinet seam', () => {
  test('drawer shells toggle without granting; contents appear only when open', async ({ page }) => {
    const data = await setup(page, 111)
    data.freeze()
    await office(page, 'KEYBOARD', 'DIRECT_SOLVER')
    await activate(page, button(page, 'RETURN TO RECORDS OFFICE'), 'KEYBOARD')
    const shell = page.getByTestId('a0-shell')
    // Both drawers were collected by office(); close them and verify hiding.
    await activate(page, page.getByTestId('verb-close'), 'KEYBOARD')
    await activate(page, page.getByTestId('hotspot-official-case-file-cabinet'), 'KEYBOARD')
    await drainBrowserSpeech(page, 'KEYBOARD')
    await expect(shell).toHaveAttribute('data-case-drawer', 'CLOSED')
    await expect(page.getByTestId('hotspot-disorderly-stack-of-confidential-files')).toHaveCount(0)
    expect(await page.locator('body').ariaSnapshot()).not.toContain('Disorderly stack')
    // Reopening grants nothing new; USE toggles.
    await activate(page, page.getByTestId('verb-open'), 'KEYBOARD')
    await activate(page, page.getByTestId('hotspot-official-case-file-cabinet'), 'KEYBOARD')
    await drainBrowserSpeech(page, 'KEYBOARD')
    await expect(shell).toHaveAttribute('data-case-drawer', 'OPEN')
    await expect(page.getByTestId('hotspot-disorderly-stack-of-confidential-files')).toBeVisible()
    await activate(page, page.getByTestId('verb-use'), 'KEYBOARD')
    await activate(page, page.getByTestId('hotspot-official-case-file-cabinet'), 'KEYBOARD')
    await drainBrowserSpeech(page, 'KEYBOARD')
    await expect(shell).toHaveAttribute('data-case-drawer', 'CLOSED')
    // Euler file retained exactly once; clues were collected once.
    await expect(page.getByTestId('inventory-euler-case-file')).toBeVisible()
    expect(data.requests.filter((request) => request.forbidden)).toEqual([])
  })

  test('misc drawer collects five items in fixed order with gum left behind', async ({ page }) => {
    const data = await setup(page, 112)
    data.freeze()
    await office(page, 'KEYBOARD', 'DIRECT_SOLVER')
    await activate(page, button(page, 'RETURN TO RECORDS OFFICE'), 'KEYBOARD')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-misc-contents', 'COLLECTED_GUM_REMAINS')
    const ids = await page.locator('[data-testid^="inventory-"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')))
    const order = ['inventory-rubber-band', 'inventory-rubiks-cube', 'inventory-sharknado-2-vhs', 'inventory-piggy-bank-intact', 'inventory-small-toolbox-closed']
    let last = -1
    for (const id of order) {
      const at = ids.indexOf(id)
      expect(at).toBeGreaterThan(last)
      last = at
    }
    expect(await page.locator('body').innerText()).not.toMatch(/peppermint gum.*inventory|inventory.*peppermint gum/i)
    expect(data.requests.filter((request) => request.forbidden)).toEqual([])
  })

  test('keyboard close recovers focus deterministically on the shell', async ({ page }) => {
    const data = await setup(page, 113)
    data.freeze()
    await office(page, 'KEYBOARD', 'DIRECT_SOLVER')
    await activate(page, button(page, 'RETURN TO RECORDS OFFICE'), 'KEYBOARD')
    await activate(page, page.getByTestId('verb-close'), 'KEYBOARD')
    await activate(page, page.getByTestId('hotspot-miscellaneous-drawer-cabinet'), 'KEYBOARD')
    await drainBrowserSpeech(page, 'KEYBOARD')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-misc-drawer', 'CLOSED')
    await expect(page.getByTestId('hotspot-miscellaneous-drawer-cabinet')).toBeFocused()
    expect(data.requests.filter((request) => request.forbidden)).toEqual([])
  })

  test('comparison appears only after candidate-route resolution', async ({ page }) => {
    const data = await setup(page, 114)
    data.freeze()
    await office(page, 'KEYBOARD', 'DIRECT_SOLVER')
    await activate(page, button(page, 'ASK A QUESTION'), 'KEYBOARD')
    await activate(page, page.locator('.question-cards article button').first(), 'KEYBOARD')
    await activate(page, button(page, 'DISPATCH'), 'KEYBOARD')
    await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-terminal-stage', '4')
    await expect(page.getByRole('button', { name: 'COMPARE CANDIDATE', exact: true })).toHaveCount(0)
    await resolveCandidateRoute(page, data.fixture, 'KEYBOARD')
    const folders = page.locator('.candidate-folder')
    await activate(page, folders.nth(0).getByRole('button', { name: 'COMPARE CANDIDATE', exact: true }), 'KEYBOARD')
    await activate(page, folders.nth(1).getByRole('button', { name: 'COMPARE CANDIDATE', exact: true }), 'KEYBOARD')
    await expect(page.getByRole('table', { name: 'Factual comparison — no confidence scores' })).toBeVisible()
    expect(data.requests.filter((request) => request.forbidden)).toEqual([])
  })

  test('layered scene renders visibly with retired props absent at both zooms', async ({ page }) => {
    const external: string[] = []
    page.on('request', (request) => { if (violatesFrozenBrowserPolicy(request.url())) external.push(request.url()) })
    const data = await setup(page, 115)
    data.freeze()
    await office(page, 'KEYBOARD', 'DIRECT_SOLVER')
    await activate(page, button(page, 'RETURN TO RECORDS OFFICE'), 'KEYBOARD')
    await expect(page.locator('.scene-layer').first()).toBeVisible()
    await expect(page.locator('.manifest-prop').first()).toBeVisible()
    const hidden = await page.locator('.manifest-prop').evaluateAll((nodes) => nodes.filter((node) => getComputedStyle(node as HTMLElement).visibility === 'hidden').length)
    expect(hidden).toBe(0)
    expect(await page.locator('body').innerText()).not.toMatch(/pneumatic|Pneumatic/)
    await expect(page.getByTestId('records-office')).toBeVisible()
    await page.evaluate(() => { document.body.style.zoom = '2' })
    await expect(page.getByTestId('records-office')).toBeVisible()
    await expect(page.locator('.manifest-prop').first()).toBeVisible()
    expect(external).toEqual([])
    expect(data.requests.filter((request) => request.forbidden)).toEqual([])
  })
})
