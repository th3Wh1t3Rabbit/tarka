import { expect, test } from '@playwright/test'

const preview = process.env.S12_PREVIEW_URL ?? ''

test.describe('S12-P1-R1 production development-tool exclusion', () => {
  test.skip(!preview, 'S12_PREVIEW_URL is required')

  for (const route of ['/?artLayout=1', '/?animDirector=1', '/?detailReview=1']) {
    test(`production stays on the game for ${route}`, async ({ page }) => {
      const keys: string[] = []
      const urls: string[] = []
      await page.addInitScript(() => {
        const seen: string[] = []
        const read = Storage.prototype.getItem
        Storage.prototype.getItem = function (key: string) {
          seen.push(String(key))
          return read.call(this, key)
        }
        Object.defineProperty(window, '__s12SeenKeys', { value: seen })
      })
      page.on('request', (request) => urls.push(request.url()))
      await page.goto(`${preview}${route}`)
      await expect(page.getByTestId('a0-shell')).toBeVisible()
      await expect(page.getByText('ART LAYOUT WORKBENCH')).toHaveCount(0)
      await expect(page.getByText('ANIMATION DIRECTOR')).toHaveCount(0)
      await expect(page.getByTestId('detail-review')).toHaveCount(0)
      const seen = await page.evaluate(() => (window as unknown as { __s12SeenKeys: string[] }).__s12SeenKeys)
      keys.push(...seen)
      expect(keys.some((key) => key.includes('layout-library') || key.includes('animation-cues') || key.includes('layout-draft'))).toBe(false)
      expect(urls.some((url) => url.endsWith('.map') || url.includes('ArtLayout') || url.includes('AnimationDirector') || url.includes('DetailReview'))).toBe(false)
    })
  }
})
