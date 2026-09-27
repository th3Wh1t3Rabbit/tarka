import { expect, test, type Page } from '@playwright/test'
import { setup } from '../fixtures/s2/browser-helpers'
import { violatesFrozenBrowserPolicy } from '../fixtures/browser-policy'

test.setTimeout(90_000)

async function ready(page: Page) {
  await page.goto('/?skipIntro=1')
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
  await page.evaluate(() => {
    const host = window as unknown as { __repl: { id: string; text: string }[] }
    host.__repl = []
    new MutationObserver(() => {
      const el = document.querySelector('[data-testid="intent-announcement"]')
      if (!el) return
      const id = el.getAttribute('data-replacement-id') || ''
      const text = el.textContent || ''
      const last = host.__repl[host.__repl.length - 1]
      if (id && (!last || last.id !== id)) host.__repl.push({ id, text })
    }).observe(document.body, { childList: true, subtree: true, attributes: true })
  })
}

async function seen(page: Page) {
  return page.evaluate(() => (window as unknown as { __repl: { id: string; text: string }[] }).__repl)
}

test.describe('S10-P2-R2 accessible replacement events', () => {
  test('S10-P2-R2 drawer to floor event mounts and clears by matching acknowledgement', async ({ page }) => {
    const data = await setup(page, 191)
    await ready(page)
    data.freeze()
    await page.getByRole('button', { name: /^OPEN\b/ }).click()
    await page.getByRole('button', { name: 'Official case-file cabinet', exact: true }).click()
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
    await page.getByTestId('records-office').click({ position: { x: 24, y: 180 }, force: true })
    await expect.poll(async () => (await seen(page)).map((entry) => entry.id)).toContain('1')
    expect((await seen(page)).find((entry) => entry.id === '1')?.text).toContain('PLACEHOLDER')
    await expect(page.getByTestId('intent-announcement')).toHaveCount(0)
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'CLOSED')
    expect(data.requests.filter((request) => request.forbidden)).toEqual([])
  })

  test('S10-P2-R2 drawer to globe event stays mounted beside the globe result until acknowledgement', async ({ page }) => {
    const data = await setup(page, 192)
    await ready(page)
    data.freeze()
    await page.getByRole('button', { name: /^OPEN\b/ }).click()
    await page.getByRole('button', { name: 'Official case-file cabinet', exact: true }).click()
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
    await page.getByRole('button', { name: /^LOOK AT\b/ }).click()
    await page.getByRole('button', { name: 'Office globe, optional placeholder hotspot', exact: true }).click()
    await expect(page.getByTestId('nonblocking-speech')).toBeVisible()
    await expect.poll(async () => (await seen(page)).map((entry) => entry.id)).toContain('1')
    await expect(page.getByTestId('intent-announcement')).toHaveCount(0)
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'CLOSED')
  })

  test('S10-P2-R2 drawer to Arthur event clears without remaining through the dialogue', async ({ page }) => {
    const data = await setup(page, 193)
    await ready(page)
    data.freeze()
    await page.getByRole('button', { name: /^OPEN\b/ }).click()
    await page.getByRole('button', { name: 'Miscellaneous drawer cabinet', exact: true }).click()
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
    await page.getByRole('button', { name: /^TALK TO\b/ }).click()
    await page.getByRole('button', { name: 'Arthur, Records Office archivist', exact: true }).click()
    await expect(page.getByTestId('dialogue-panel')).toBeVisible()
    await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-facing', 'LEFT')
    await expect.poll(async () => (await seen(page)).map((entry) => entry.id)).toContain('1')
    await expect(page.getByTestId('intent-announcement')).toHaveCount(0)
    await page.getByTestId('dialogue-leave').click()
    await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-facing', 'RIGHT')
    await expect(page.getByTestId('intent-announcement')).toHaveCount(0)
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-misc-drawer', 'CLOSED')
  })

  test('S10-P2-R2 two same-text remote LOOK replacement events both announce', async ({ page }) => {
    const data = await setup(page, 196)
    await ready(page)
    data.freeze()
    const once = async (verb: 'OPEN' | 'LOOK AT', target: string) => {
      await page.getByRole('button', { name: new RegExp(`^${verb}\\b`) }).click()
      await page.getByRole('button', { name: target, exact: true }).click()
    }
    await once('OPEN', 'Official case-file cabinet')
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
    await once('LOOK AT', 'Office globe, optional placeholder hotspot')
    await expect.poll(async () => (await seen(page)).map((entry) => entry.id)).toContain('1')
    await expect(page.getByTestId('nonblocking-speech')).toBeVisible()
    await once('OPEN', 'Miscellaneous drawer cabinet')
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
    await once('LOOK AT', 'Historical clock')
    await expect.poll(async () => (await seen(page)).map((entry) => entry.id)).toEqual(['1', '2'])
    expect((await seen(page)).every((entry) => entry.text.includes('PLACEHOLDER'))).toBe(true)
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'CLOSED')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-misc-drawer', 'CLOSED')
  })

  test('S10-P2-R2 plain-list observes the same event ids and outcomes', async ({ page }) => {
    const external: string[] = []
    page.on('request', (request) => { if (violatesFrozenBrowserPolicy(request.url())) external.push(request.url()) })
    const data = await setup(page, 194)
    await ready(page)
    await page.getByLabel('Dialogue presentation').selectOption('PLAIN_LIST')
    data.freeze()
    await page.getByRole('button', { name: /^PULL\b/ }).click()
    await page.getByRole('button', { name: 'Official case-file cabinet', exact: true }).click()
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
    await page.getByTestId('records-office').click({ position: { x: 24, y: 180 }, force: true })
    await expect.poll(async () => (await seen(page)).map((entry) => entry.id)).toEqual(['1'])
    await expect(page.getByTestId('intent-announcement')).toHaveCount(0)
    await expect(page.getByLabel('Dialogue presentation')).toHaveValue('PLAIN_LIST')
    expect(external).toEqual([])
  })

  test('S10-P2-R2 reload with a mounted event clears and cannot resurrect the old intent', async ({ page }) => {
    const data = await setup(page, 195)
    await page.goto('/?skipIntro=1')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
    await page.evaluate(() => {
      sessionStorage.removeItem('r2-reload')
      new MutationObserver(() => {
        const el = document.querySelector('[data-testid="intent-announcement"]')
        if (!el || sessionStorage.getItem('r2-reload')) return
        sessionStorage.setItem('r2-reload', el.getAttribute('data-replacement-id') || '')
        location.reload()
      }).observe(document.body, { childList: true, subtree: true, attributes: true })
    })
    const loaded = page.waitForEvent('load')
    await page.getByRole('button', { name: /^OPEN\b/ }).click()
    await page.getByRole('button', { name: 'Official case-file cabinet', exact: true }).click()
    await expect(page.getByTestId('rook-sprite')).toHaveAttribute('data-animation', 'walkEast')
    await page.getByTestId('records-office').click({ position: { x: 24, y: 180 }, force: true })
    await loaded
    await expect(page.getByTestId('a0-shell')).toBeVisible()
    expect(await page.evaluate(() => sessionStorage.getItem('r2-reload'))).toBe('1')
    await expect(page.getByTestId('intent-announcement')).toHaveCount(0)
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-case-drawer', 'CLOSED')
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
    expect(data.requests.filter((request) => request.forbidden)).toEqual([])
  })
})
