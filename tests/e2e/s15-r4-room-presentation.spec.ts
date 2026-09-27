import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const shots = resolve('review/s15-r4/SCREENSHOTS')
mkdirSync(shots, { recursive: true })

async function start(page: Page, query = '?skipIntro=1') {
  await page.goto(`/${query}`)
  const play = page.getByRole('button', { name: 'PLAY', exact: true })
  if (await play.isVisible()) await play.click()
  await expect(page.getByTestId('a0-shell')).toBeVisible()
}

test('fixed 480×270 composition preserves typography and geometry at small, mid, and large viewports', async ({ page }) => {
  const samples = [{ width: 640, height: 480, name: 'small' }, { width: 1280, height: 720, name: 'mid' }, { width: 1920, height: 1080, name: 'large' }]
  for (const sample of samples) {
    await page.setViewportSize(sample); await start(page)
    const result = await page.evaluate(() => {
      const frame = document.querySelector<HTMLElement>('.a0-frame')!
      const command = document.querySelector<HTMLElement>('.command-sentence')!
      const windowTarget = document.querySelector<HTMLElement>('[data-testid="hotspot-window"]')!
      return { scale: Number(frame.dataset.integerScale), ratio: frame.clientWidth / frame.clientHeight, commandFamily: getComputedStyle(command).fontFamily, commandSize: Number.parseFloat(getComputedStyle(command).fontSize), windowRect: { left: windowTarget.offsetLeft, top: windowTarget.offsetTop, width: windowTarget.offsetWidth, height: windowTarget.offsetHeight } }
    })
    expect(result.ratio).toBeCloseTo(16 / 9, 4)
    expect(result.commandFamily).toContain('monospace')
    expect(result.commandSize).toBe(8 * result.scale)
    expect(result.windowRect).toEqual({ left: 424 * result.scale, top: 14 * result.scale, width: 49 * result.scale, height: 106 * result.scale })
    await page.screenshot({ path: resolve(shots, `viewport-${sample.name}.png`) })
  }
})

test('real unauthorized routes hold Arthur point through Rook replies and release after completion', async ({ page }) => {
  await start(page)
  await page.getByTestId('verb-open').click(); await page.getByTestId('hotspot-official-case-file-cabinet').click()
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-cue', 'arthur.point', { timeout: 10_000 })
  await expect(page.getByTestId('speech-panel')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('mr-index-sprite')).toHaveAttribute('data-cue', 'arthur.point')
  await page.screenshot({ path: resolve(shots, 'cabinet-point-hold-rook-reply.png') })
  for (let guard = 0; guard < 50 && await page.getByTestId('speech-panel').count(); guard += 1) { await page.getByTestId('talk-advance-catch').click(); await page.waitForTimeout(20) }
  await expect(page.getByTestId('mr-index-sprite')).not.toHaveAttribute('data-cue', 'arthur.point')
})

test('bottom drawer transition settles on the matching open front without decode errors or fallback flashes', async ({ page }) => {
  const errors: string[] = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await start(page, '?skipIntro=1&review=1')
  await page.getByLabel('Jump to puzzle state').selectOption('COMPLETE')
  await page.evaluate(() => {
    const scope = window as unknown as { __s15r4DrawerFrames?: string[]; __s15r4DrawerObserver?: MutationObserver }
    scope.__s15r4DrawerObserver?.disconnect()
    scope.__s15r4DrawerFrames = []
    const capture = () => {
      const src = document.querySelector<HTMLElement>('[data-testid="layout-misc-cabinet"]')?.dataset.frameSrc
      if (src && !scope.__s15r4DrawerFrames?.includes(src)) scope.__s15r4DrawerFrames?.push(src)
    }
    const observer = new MutationObserver(capture)
    observer.observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ['data-frame-src'] })
    scope.__s15r4DrawerObserver = observer
    capture()
  })
  await page.getByTestId('verb-open').click(); await page.getByTestId('hotspot-miscellaneous-drawer-cabinet').click()
  const cabinet = page.getByTestId('layout-misc-cabinet')
  await expect.poll(() => page.evaluate(() => ((window as unknown as { __s15r4DrawerFrames?: string[] }).__s15r4DrawerFrames ?? []).some(src => /drawer_04_phase_0[1-6]\.png/.test(src)))).toBe(true)
  await expect(cabinet).toHaveAttribute('data-frame-src', /drawer_04_open\.png/, { timeout: 10_000 })
  await expect(page.locator('.asset-fallback')).toHaveCount(0)
  await page.screenshot({ path: resolve(shots, 'misc-bottom-drawer-open.png') })
  expect(errors).toEqual([])
})
