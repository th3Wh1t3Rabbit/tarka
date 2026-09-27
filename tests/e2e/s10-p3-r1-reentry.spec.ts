import { expect, test, type Page } from '@playwright/test'
import { activate, drainBrowserSpeech, office, setup } from '../fixtures/s2/browser-helpers'
import { progressionChain } from '../fixtures/s2/domain-helpers'

test.setTimeout(300_000)

async function ready(page: Page) {
  await page.goto('/?skipIntro=1')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
}

async function authorize(page: Page) {
  for (const [verb, hotspot, item, item2, , phase, inventory] of progressionChain) {
    await activate(page, page.getByTestId(`verb-${String(verb).toLowerCase().replace('_', '-')}`), 'KEYBOARD')
    if (item) await activate(page, page.getByTestId(`inventory-${item}`), 'KEYBOARD')
    if (hotspot) await activate(page, page.getByTestId(`hotspot-${hotspot}`), 'KEYBOARD')
    else if (item2) await activate(page, page.getByTestId(`inventory-${item2}`), 'KEYBOARD')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', String(phase))
    await expect(page.getByTestId('active-sequence')).toHaveCount(0)
    await expect(page.locator('[data-testid^="inventory-"]')).toHaveCount(inventory.length)
    await drainBrowserSpeech(page, 'KEYBOARD')
  }
}

async function commandCounts(page: Page) {
  return page.evaluate(() => Object.values(localStorage).flatMap((value) => {
    try { return JSON.parse(value).commands.entries.map((entry: { type?: string }) => entry.type) } catch { return [] }
  }))
}

test.describe('S10-P3-R1 re-entry browser', () => {
  test('S10-P3-R1 later case-file collection unlocks question 1 on re-entry', async ({ page }) => {
    await ready(page)
    await authorize(page)
    await page.getByTestId('verb-use').click()
    await page.getByTestId('hotspot-nansen-terminal').click()
    await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-terminal-stage', '2')
    await expect(page.getByRole('button', { name: 'Which DAI movements match the incident window?' })).toHaveCount(0)
    await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
    await activate(page, page.getByTestId('verb-open'), 'KEYBOARD')
    await activate(page, page.getByTestId('hotspot-official-case-file-cabinet'), 'KEYBOARD')
    await drainBrowserSpeech(page, 'KEYBOARD')
    await activate(page, page.getByTestId('verb-pick-up'), 'KEYBOARD')
    await activate(page, page.getByTestId('hotspot-disorderly-stack-of-confidential-files'), 'KEYBOARD')
    await expect(page.getByTestId('inventory-euler-case-file')).toBeVisible({ timeout: 15000 })
    await drainBrowserSpeech(page, 'KEYBOARD')
    await page.getByTestId('verb-use').click()
    await page.getByTestId('hotspot-nansen-terminal').click()
    await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-terminal-stage', '3')
    await expect(page.getByRole('button', { name: 'STAGE Which DAI movements match the incident window?' })).toBeVisible()
    await expect(page.getByTestId('case-terminal')).toContainText('DISCOVERED CLUES: Recorded asset; DAI token contract; First Breach amount; Incident window')
    await page.getByRole('button', { name: 'ASK A QUESTION' }).click()
    await expect(page.getByTestId('case-terminal')).toContainText('8877507')
    await expect(page.getByLabel('Terminal presentation')).toHaveCount(0)
    const commands = await commandCounts(page)
    expect(commands.filter((type) => type === 'EARN_ACCESS')).toHaveLength(1)
    expect(commands.filter((type) => type === 'COLLECT_CASE_FILE')).toHaveLength(1)
    await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
    await page.getByTestId('verb-use').click()
    await page.getByTestId('hotspot-nansen-terminal').click()
    await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-terminal-stage', '3')
    expect((await commandCounts(page)).filter((type) => type === 'COLLECT_CASE_FILE')).toHaveLength(1)
  })

  test('S10-P3-R1 BACK_READ later unlocks the BRCG side lead on re-entry', async ({ page }) => {
    await ready(page)
    await office(page, 'KEYBOARD', 'DIRECT_SOLVER')
    await expect(page.getByText('OFFICE-NOTE TOKEN LEAD — OPTIONAL, NOT EULER EVIDENCE')).toHaveCount(0)
    const stage = await page.getByTestId('case-terminal').getAttribute('data-terminal-stage')
    await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
    await activate(page, page.getByTestId('verb-open'), 'KEYBOARD')
    await activate(page, page.getByTestId('inventory-small-toolbox-closed'), 'KEYBOARD')
    await drainBrowserSpeech(page, 'KEYBOARD')
    await activate(page, page.getByTestId('verb-use'), 'KEYBOARD')
    await activate(page, page.getByTestId('inventory-hammer'), 'KEYBOARD')
    await activate(page, page.getByTestId('inventory-piggy-bank-intact'), 'KEYBOARD')
    await drainBrowserSpeech(page, 'KEYBOARD')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-note-read', 'UNREAD')
    await page.getByTestId('verb-use').click()
    await page.getByTestId('hotspot-nansen-terminal').click()
    await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('OFFICE-NOTE TOKEN LEAD — OPTIONAL, NOT EULER EVIDENCE')).toHaveCount(0)
    await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
    await activate(page, page.getByTestId('verb-look-at'), 'KEYBOARD')
    await activate(page, page.getByTestId('inventory-fictional-token-note'), 'KEYBOARD')
    await page.getByTestId('speech-panel').click()
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-note-read', 'UNREAD')
    for (let i = 0; i < 12 && await page.getByTestId('speech-panel').count(); i++) await page.getByTestId('speech-panel').click()
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-note-read', 'BACK_READ')
    await page.getByTestId('verb-use').click()
    await page.getByTestId('hotspot-nansen-terminal').click()
    await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-terminal-stage', stage!)
    await expect(page.getByTestId('case-terminal')).toHaveAttribute('data-proof-events', '0')
    await expect(page.getByText('OFFICE-NOTE TOKEN LEAD — OPTIONAL, NOT EULER EVIDENCE')).toBeAttached()
    await expect(page.locator('button', { hasText: 'LATE-BOUND TOKEN' })).toHaveCount(1)
    await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
    await page.getByTestId('verb-use').click()
    await page.getByTestId('hotspot-nansen-terminal').click()
    await expect(page.locator('button', { hasText: 'LATE-BOUND TOKEN' })).toHaveCount(1)
    expect((await commandCounts(page)).filter((type) => type === 'COLLECT_SIDE_NOTE')).toHaveLength(1)
  })

  test('S10-P3-R1 paced nonblocking self-talk continues during terminal approach', async ({ page }) => {
    const data = await setup(page, 213)
    await page.goto('/?skipIntro=1&review=1')
    await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
    await expect(page.getByTestId('open-case-terminal')).toHaveCount(0)
    await expect(page.getByTestId('hotspot-nansen-terminal')).toBeVisible()
    data.freeze()
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
    await page.getByTestId('verb-look-at').click()
    await page.getByRole('button', { name: 'Office globe, optional placeholder hotspot', exact: true }).click()
    await expect(page.getByTestId('nonblocking-speech')).toBeVisible()
    await page.getByTestId('verb-use').click()
    await page.getByTestId('hotspot-nansen-terminal').click()
    await expect(page.getByTestId('nonblocking-speech')).toBeVisible()
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
    await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('nonblocking-speech')).toHaveCount(0)
    await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
    await expect(page.getByTestId('nonblocking-speech')).toHaveCount(0)
  })

  test('S10-P3-R1 destination-only floor walk replacement mounts and ACKs one event', async ({ page }) => {
    const data = await setup(page, 214)
    await page.goto('/?skipIntro=1&review=1')
    await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
    data.freeze()
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
    await page.getByTestId('records-office').click({ position: { x: 700, y: 180 }, force: true })
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
    await expect(page.getByTestId('open-case-terminal')).toHaveCount(0)
    await page.getByTestId('verb-use').click()
    await page.getByTestId('hotspot-nansen-terminal').click()
    await expect.poll(async () => page.evaluate(() => (window as unknown as { __repl: { id: string; beforeTerminal: boolean }[] }).__repl)).toEqual([expect.objectContaining({ id: '1', beforeTerminal: true })])
    await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'RETURN TO RECORDS OFFICE', exact: true }).click()
    await expect(page.getByTestId('rook-sprite')).not.toHaveAttribute('data-animation', 'walkEast')
    await expect(page.getByTestId('open-case-terminal')).toHaveCount(0)
    await expect(page.getByTestId('hotspot-nansen-terminal')).toBeVisible()
  })

  test('S10-P3-R1 keyboard and plain-list match that in-flight state', async ({ page }) => {
    const data = await setup(page, 215)
    await page.goto('/?skipIntro=1&review=1')
    await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
    await expect(page.getByLabel('Dialogue presentation')).toHaveCount(0)
    data.freeze()
    await page.getByTestId('records-office').click({ position: { x: 700, y: 180 }, force: true })
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
    await page.getByTestId('verb-use').focus()
    await page.keyboard.press('Enter')
    await page.getByTestId('hotspot-nansen-terminal').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Dialogue presentation')).toHaveCount(0)
    await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 15000 })
  })
})
