import { expect, test } from '@playwright/test'

test('character image nodes remain painted and connected through rapid opening speaker handoffs', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/')
  await page.getByRole('button', { name: 'PLAY', exact: true }).click()
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('text-speed-menu').click()
  await page.getByTestId('dialogue-mode-manual').click()
  await expect(page.getByTestId('speech-panel')).toBeVisible({ timeout: 10_000 })

  const result = await page.evaluate(async () => {
    const rookSprite = document.querySelector<HTMLElement>('[data-testid="rook-sprite"]')!
    const arthurSprite = document.querySelector<HTMLElement>('[data-testid="mr-index-sprite"]')!
    const rookAnimation = document.querySelector<HTMLElement>('[data-testid="rook-animation"]')!
    const arthurAnimation = document.querySelector<HTMLElement>('[data-testid="mr-index-animation"]')!
    const firstRookImage = rookAnimation.querySelector<HTMLImageElement>('img')!
    const firstArthurImage = arthurAnimation.querySelector<HTMLImageElement>('img')!
    const samples: Array<{
      speaker: string | null
      line: string | null
      sameRookSprite: boolean
      sameArthurSprite: boolean
      sameRookAnimation: boolean
      sameArthurAnimation: boolean
      sameRookImage: boolean
      sameArthurImage: boolean
      rookPainted: boolean
      arthurPainted: boolean
      rookRequested: string | null
      rookRendered: string | null
      arthurRequested: string | null
      arthurRendered: string | null
      arthurFrame: number
      arthurFrameCount: number
      arthurCue: string | null
      rendererLine: string | null
      rookLeft: number
      rookRight: number
      arthurLeft: number
      arthurRight: number
    }> = []
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    let cameraLineReached = false
    for (let transition = 0; transition < 70; transition += 1) {
      // Let React commit the line selected by the previous advance before
      // deciding which authored performance is currently on screen.
      await nextFrame()
      const speechPanel = document.querySelector<HTMLElement>('[data-testid="speech-panel"]')
      const line = speechPanel?.textContent ?? ''
      const cameraLine = line.includes('This is going to be a long day.')
      cameraLineReached ||= cameraLine
      for (let frame = 0; frame < (cameraLine ? 480 : 2); frame += 1) {
        await nextFrame()
        const currentRookAnimation = document.querySelector<HTMLElement>('[data-testid="rook-animation"]')!
        const currentArthurAnimation = document.querySelector<HTMLElement>('[data-testid="mr-index-animation"]')!
        const rookImage = currentRookAnimation.querySelector<HTMLImageElement>('img')!
        const arthurImage = currentArthurAnimation.querySelector<HTMLImageElement>('img')!
        samples.push({
          speaker: document.querySelector<HTMLElement>('[data-testid="speech-panel"]')?.dataset.speaker ?? null,
          line,
          sameRookSprite: document.querySelector('[data-testid="rook-sprite"]') === rookSprite,
          sameArthurSprite: document.querySelector('[data-testid="mr-index-sprite"]') === arthurSprite,
          sameRookAnimation: currentRookAnimation === rookAnimation,
          sameArthurAnimation: currentArthurAnimation === arthurAnimation,
          sameRookImage: rookImage === firstRookImage,
          sameArthurImage: arthurImage === firstArthurImage,
          rookPainted: rookImage.isConnected && rookImage.complete && rookImage.naturalWidth > 0 && rookImage.getBoundingClientRect().width > 0,
          arthurPainted: arthurImage.isConnected && arthurImage.complete && arthurImage.naturalWidth > 0 && arthurImage.getBoundingClientRect().width > 0,
          rookRequested: currentRookAnimation.dataset.requestedSrc ?? null,
          rookRendered: rookImage.dataset.renderedSrc ?? null,
          arthurRequested: currentArthurAnimation.dataset.requestedSrc ?? null,
          arthurRendered: arthurImage.dataset.renderedSrc ?? null,
          arthurFrame: Number(currentArthurAnimation.dataset.frameIndex),
          arthurFrameCount: Number(currentArthurAnimation.dataset.animationFrames),
          arthurCue: document.querySelector<HTMLElement>('[data-testid="mr-index-sprite"]')?.dataset.cue ?? null,
          rendererLine: document.querySelector<HTMLElement>('[data-testid="speech-panel"]')?.dataset.rendererLine ?? null,
          rookLeft: rookSprite.getBoundingClientRect().left,
          rookRight: rookSprite.getBoundingClientRect().right,
          arthurLeft: arthurSprite.getBoundingClientRect().left,
          arthurRight: arthurSprite.getBoundingClientRect().right,
        })
      }
      if (cameraLine) break
      document.querySelector<HTMLButtonElement>('[data-testid="talk-advance-catch"]')?.click()
    }
    return { cameraLineReached, samples }
  })

  expect(result.cameraLineReached).toBe(true)
  expect(new Set(result.samples.map((sample) => sample.speaker))).toEqual(new Set(['ROOK', 'MR_INDEX']))
  expect(new Set(result.samples.map((sample) => sample.rookRequested)).size).toBeGreaterThan(1)
  expect(new Set(result.samples.map((sample) => sample.arthurRequested)).size).toBeGreaterThan(1)
  const cameraSamples = result.samples.filter((sample) => sample.line?.includes('This is going to be a long day.'))
  expect(cameraSamples.length).toBeGreaterThan(400)
  const cameraSources = [...new Set(cameraSamples.map((sample) => sample.arthurRequested))]
  const cameraFrames = [...new Set(cameraSamples.map((sample) => sample.arthurFrame))]
  const cameraBlinkStarts = cameraSamples.reduce((count, sample, index) => {
    const blinking = sample.arthurRequested?.includes('blink') ?? false
    const previousBlinking = index > 0 && (cameraSamples[index - 1]?.arthurRequested?.includes('blink') ?? false)
    return count + (blinking && !previousBlinking ? 1 : 0)
  }, 0)
  expect(cameraSources.length, JSON.stringify({ cameraSources, cameraFrames, frameCounts: [...new Set(cameraSamples.map((sample) => sample.arthurFrameCount))], cues: [...new Set(cameraSamples.map((sample) => sample.arthurCue))], rendererLines: [...new Set(cameraSamples.map((sample) => sample.rendererLine))] })).toBeGreaterThanOrEqual(3)
  expect(cameraSamples.some((sample) => sample.arthurRequested?.includes('/continuity-camera-v0.1.0/'))).toBe(true)
  expect(cameraSamples.some((sample) => sample.arthurRequested?.includes('/coherent-core-v1.0.0/'))).toBe(true)
  expect(cameraBlinkStarts).toBeGreaterThanOrEqual(1)
  expect(cameraBlinkStarts).toBeLessThanOrEqual(4)
  expect(result.samples.every((sample) => sample.sameRookSprite && sample.sameArthurSprite && sample.sameRookAnimation && sample.sameArthurAnimation)).toBe(true)
  expect(result.samples.every((sample) => sample.sameRookImage && sample.sameArthurImage)).toBe(true)
  expect(result.samples.every((sample) => sample.rookPainted && sample.arthurPainted)).toBe(true)
  expect(result.samples.every((sample) => sample.rookRendered && sample.arthurRendered)).toBe(true)
  expect(new Set(result.samples.map((sample) => sample.rookLeft)).size).toBe(1)
  expect(new Set(result.samples.map((sample) => sample.arthurLeft)).size).toBe(1)
  expect(result.samples.every((sample) => sample.rookLeft < sample.arthurLeft)).toBe(true)
  expect(result.samples.every((sample) => sample.rookRight <= sample.arthurLeft || sample.arthurRight <= sample.rookLeft)).toBe(true)
})
