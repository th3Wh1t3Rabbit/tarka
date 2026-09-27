import { expect, test } from '@playwright/test'

const preview = process.env.S12_PREVIEW_URL ?? ''

test.describe('S12-P1-R2 one production game', () => {
  test.skip(!preview, 'S12_PREVIEW_URL is required')

  test('production ignores legacy accessibility and investigation saves', async ({ page }) => {
    const consoleRows: string[] = []
    const networkRows: string[] = []
    page.on('console', (message) => consoleRows.push(`${message.type()}: ${message.text()}`))
    page.on('pageerror', (error) => consoleRows.push(`pageerror: ${error.message}`))
    page.on('request', (request) => networkRows.push(request.url()))
    const keys: string[] = []
    await page.addInitScript(() => {
      localStorage.setItem('trace-escape.accessibility.v1', JSON.stringify({ schema: 'trace-escape.accessibility.v1', instantText: true, dialoguePresentation: 'PLAIN_LIST', highContrastHotspots: true, reducedAnimation: true }))
      localStorage.setItem('trace-case-v1:hostile', JSON.stringify({ saveVersion: 2, commands: { entries: [{ type: 'EARN_ACCESS' }] } }))
      const seen: string[] = []
      const read = Storage.prototype.getItem
      const write = Storage.prototype.setItem
      Storage.prototype.getItem = function (key: string) { seen.push(`read:${key}`); return read.call(this, key) }
      Storage.prototype.setItem = function (key: string, value: string) { seen.push(`write:${key}`); return write.call(this, key, value) }
      Object.defineProperty(window, '__s12SeenKeys', { value: seen })
    })
    await page.goto(`${preview}/?skipIntro=1`)
    await expect(page.getByTestId('a0-shell')).toBeVisible()
    await expect(page.getByLabel('Accessibility settings')).toHaveCount(0)
    await expect(page.getByLabel('Dialogue presentation')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'TEXT PACED' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'HOTSPOT CONTRAST' })).toHaveCount(0)
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
    const seen = await page.evaluate(() => (window as unknown as { __s12SeenKeys: string[] }).__s12SeenKeys)
    keys.push(...seen)
    expect(keys.some((key) => key.includes('trace-escape.accessibility.v1') || key.includes('trace-case-v1'))).toBe(false)
    await page.reload()
    await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'START')
    const remote = networkRows.filter((url) => !url.includes('127.0.0.1') && !url.startsWith('data:'))
    expect(consoleRows.filter((row) => row.startsWith('pageerror:') || row.includes('Warning:'))).toEqual([])
    expect(remote).toEqual([])
    console.log(`STORAGE ${JSON.stringify(keys)}`)
    console.log(`CONSOLE ${JSON.stringify(consoleRows)}`)
    console.log(`NETWORK ${JSON.stringify(networkRows)}`)
  })
})
