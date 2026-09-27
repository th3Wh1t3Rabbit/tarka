import { devices, expect, test } from '@playwright/test'

const WALL_ART = [
  ['bg-painting-city-bridge', 274],
  ['bg-plaque-employee-of-the-month', 111],
  ['bg-plaque-preserve-serve-remember', 100],
  ['bg-poster-be-the-change', 202],
  ['bg-poster-think-outside-the-box', 142],
  ['bg-print-building', 92],
  ['bg-sign-records-office', 254],
  ['bg-sign-you-are-not-a-number', 111],
  ['bg-wall-clock', 134],
] as const

const PIXEL_8 = {
  ...devices['Pixel 7'],
  viewport: { width: 412, height: 915 },
}

test('Pixel 8 keeps native zoomable geometry, paints original detail crops, and spins the globe by touch', async ({ browser }) => {
  test.setTimeout(90_000)
  const context = await browser.newContext(PIXEL_8)
  const page = await context.newPage()
  const globeResponses = new Set<string>()
  page.on('response', (response) => {
    if (response.url().includes('/globe-life/frames/')) globeResponses.add(response.url())
  })

  await page.goto('/?skipIntro=1')
  const shell = page.getByTestId('a0-shell')
  const frame = page.locator('.a0-frame')
  await expect(shell).toBeVisible()
  await expect(frame).toHaveAttribute('data-integer-scale', '1')
  const mobileSettings = page.getByTestId('mobile-playback-toggle')
  const fullscreenShortcut = page.getByTestId('mobile-fullscreen-shortcut')
  await expect(mobileSettings).toBeVisible()
  await expect(fullscreenShortcut).toBeVisible()
  await expect(mobileSettings).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByTestId('background-music-control')).toBeHidden()
  await fullscreenShortcut.tap()
  await expect(page.locator('html')).toHaveClass(/tarka-mobile-fullscreen/)
  await expect(fullscreenShortcut).toBeHidden()
  const fullscreenFrame = await frame.boundingBox()
  expect(fullscreenFrame).not.toBeNull()
  expect(fullscreenFrame!.x).toBeGreaterThanOrEqual(-1)
  expect(fullscreenFrame!.x + fullscreenFrame!.width).toBeLessThanOrEqual(413)
  expect(fullscreenFrame!.width).toBeLessThanOrEqual(413)
  expect(fullscreenFrame!.height).toBeLessThanOrEqual(916)
  await expect(mobileSettings).toHaveAttribute('aria-expanded', 'false')
  await mobileSettings.tap()
  await expect(page.getByTestId('text-speed-menu')).toBeVisible()
  await expect(page.getByTestId('dialogue-display-toggle')).toBeVisible()
  await expect(page.getByTestId('background-music-control')).toBeVisible()
  const fullscreen = page.getByTestId('mobile-fullscreen-control')
  await expect(fullscreen).toHaveAttribute('aria-pressed', 'true')
  await fullscreen.tap()
  await expect(fullscreen).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('html')).not.toHaveClass(/tarka-mobile-fullscreen/)
  await expect(fullscreenShortcut).toBeVisible()
  await expect(page.getByTestId('background-music-control')).toBeHidden()
  const frameBox = await frame.boundingBox()
  expect(frameBox).not.toBeNull()
  expect(frameBox!.width).toBeGreaterThanOrEqual(480)

  const wallAudit = await page.evaluate((art) => art.map(([id, sourceWidth]) => {
    const image = document.querySelector<HTMLImageElement>(`[data-testid="layout-${id}"]`)
    const rect = image?.getBoundingClientRect()
    return {
      id,
      found: Boolean(image),
      loaded: Boolean(image?.complete && image.naturalWidth === sourceWidth && image.naturalHeight > 0),
      visible: Boolean(rect && rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight),
      source: image?.currentSrc ?? image?.src ?? '',
      blur: image?.dataset.blur ?? '',
    }
  }), WALL_ART)
  expect(wallAudit).toEqual(WALL_ART.map(([id]) => expect.objectContaining({ id, found: true, loaded: true, blur: '0' })))
  expect(wallAudit.every(({ source }) => source.includes('/art-review/background-detail/') && !source.startsWith('data:'))).toBe(true)

  const panState = await shell.evaluate(async (element) => {
    const style = getComputedStyle(element)
    const before = { clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, scrollLeft: element.scrollLeft }
    element.scrollLeft = element.scrollWidth
    await new Promise(requestAnimationFrame)
    return { ...before, afterScrollLeft: element.scrollLeft, touchAction: style.touchAction, scrollbarWidth: style.scrollbarWidth }
  })
  expect(panState.scrollWidth).toBeGreaterThan(panState.clientWidth)
  expect(panState.afterScrollLeft).toBeGreaterThan(0)
  expect(['manipulation', 'pan-x pan-y pinch-zoom']).toContain(panState.touchAction)
  expect(panState.scrollbarWidth).toBe('none')
  await expect(page.getByTestId('layout-bg-sign-you-are-not-a-number')).toBeInViewport()
  await shell.evaluate((element) => { element.scrollLeft = 0 })

  await page.getByTestId('verb-push').tap()
  await page.getByTestId('hotspot-office-globe').tap()
  await expect(shell).toHaveAttribute('data-globe-motion', 'SPINNING', { timeout: 20_000 })
  await expect(shell).toHaveAttribute('data-globe-level', '1')
  const phaseBefore = Number(await shell.getAttribute('data-globe-phase'))
  const samples: number[] = []
  for (let index = 0; index < 8; index += 1) {
    await page.waitForTimeout(100)
    samples.push(Number(await shell.getAttribute('data-globe-phase')))
  }
  expect(new Set([phaseBefore, ...samples]).size).toBeGreaterThanOrEqual(6)
  expect(globeResponses.size).toBeGreaterThanOrEqual(70)

  // Exact Pixel 8 regression: the first contact leaves a nonblocking quip.
  // Reusing the globe clears that quip and advances lifecycleEpoch, but the
  // already-running globe must keep moving before Rook's next hand contact.
  await expect(page.getByTestId('active-sequence')).toHaveCount(0, { timeout: 10_000 })
  const elapsedBeforeSecondUse = Number(await shell.getAttribute('data-globe-elapsed'))
  await page.getByTestId('verb-use').tap()
  await page.getByTestId('hotspot-office-globe').tap()
  await expect.poll(async () => Number(await shell.getAttribute('data-globe-elapsed')), {
    message: 'Pixel 8 globe must not stall between the second tap and Rook contact',
    timeout: 450,
  }).toBeGreaterThan(elapsedBeforeSecondUse)
  await expect(shell).toHaveAttribute('data-globe-motion', 'SPINNING')

  const elapsedBeforeStall = Number(await shell.getAttribute('data-globe-elapsed'))
  await page.evaluate(() => {
    const until = performance.now() + 800
    while (performance.now() < until) { /* Simulate a busy mobile browser/UI thread. */ }
  })
  await page.waitForTimeout(120)
  const elapsedAfterStall = Number(await shell.getAttribute('data-globe-elapsed'))
  expect(elapsedAfterStall - elapsedBeforeStall).toBeGreaterThan(0)
  expect(elapsedAfterStall - elapsedBeforeStall).toBeLessThan(500)

  const speech = page.getByTestId('nonblocking-speech')
  await expect(speech).toBeVisible({ timeout: 20_000 })
  const textShadow = await speech.evaluate((element) => getComputedStyle(element).textShadow)
  expect(textShadow).not.toContain('6px')

  await context.close()
})

test('touch landscape fullscreen fits the game to the screen height and keeps settings reachable', async ({ browser }) => {
  const context = await browser.newContext({
    ...PIXEL_8,
    viewport: { width: 915, height: 412 },
  })
  const page = await context.newPage()

  await page.goto('/?skipIntro=1')
  const settings = page.getByTestId('mobile-playback-toggle')
  const fullscreenShortcut = page.getByTestId('mobile-fullscreen-shortcut')
  await expect(settings).toBeVisible()
  await expect(fullscreenShortcut).toBeVisible()
  await fullscreenShortcut.tap()
  await expect(page.locator('html')).toHaveClass(/tarka-mobile-fullscreen/)
  const box = await page.locator('.a0-frame').boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(-1)
  expect(box!.x + box!.width).toBeLessThanOrEqual(916)
  expect(box!.width).toBeLessThanOrEqual(916)
  expect(box!.height).toBeGreaterThanOrEqual(410)
  expect(box!.height).toBeLessThanOrEqual(413)
  await expect(settings).toBeVisible()
  await expect(fullscreenShortcut).toBeHidden()

  await settings.tap()
  await page.getByTestId('mobile-fullscreen-control').tap()
  await expect(page.locator('html')).not.toHaveClass(/tarka-mobile-fullscreen/)
  await context.close()
})

test('desktop keeps the approved native integer presentation', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 } })
  const page = await context.newPage()

  await page.goto('/?skipIntro=1')
  const frame = page.locator('.a0-frame')
  await expect(frame).toBeVisible()
  await expect(page.getByTestId('mobile-playback-toggle')).toBeHidden()
  await expect(page.getByTestId('background-music-control')).toBeVisible()
  await expect(frame).toHaveAttribute('data-integer-scale', '2')
  const transform = await frame.evaluate((element) => getComputedStyle(element).transform)
  expect(transform).toBe('none')

  await context.close()
})
