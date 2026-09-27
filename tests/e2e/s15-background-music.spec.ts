import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const evidenceDir = resolve('artifacts/s15/SCREENSHOTS')
mkdirSync(evidenceDir, { recursive: true })

type AudioProbe = { instances: Array<{ src: string; loop: boolean; volume: number; muted: boolean; currentTime: number; playCalls: number; pauseCalls: number }> }

async function installAudioProbe(page: Page) {
  await page.addInitScript(() => {
    const probe: AudioProbe = { instances: [] }
    class ProbedAudio extends EventTarget {
      src: string
      loop = false
      volume = 1
      muted = false
      preload = ''
      currentTime = 0
      playCalls = 0
      pauseCalls = 0
      constructor(src = '') { super(); this.src = src; probe.instances.push(this) }
      async play() { this.playCalls += 1; this.dispatchEvent(new Event('play')) }
      pause() { this.pauseCalls += 1; this.dispatchEvent(new Event('pause')) }
    }
    Object.defineProperty(window, '__S15_AUDIO_PROBE__', { value: probe })
    Object.defineProperty(window, 'Audio', { value: ProbedAudio, configurable: true })
  })
}

const probe = (page: Page) => page.evaluate(() => (window as typeof window & { __S15_AUDIO_PROBE__: AudioProbe }).__S15_AUDIO_PROBE__)

test('title and title Credits are silent; PLAY creates one deterministic looping controller', async ({ page }) => {
  await installAudioProbe(page)
  await page.goto('/')
  expect((await probe(page)).instances).toHaveLength(0)
  await expect(page.getByTestId('tarka-title-screen').getByRole('button')).toHaveCount(2)
  await page.getByRole('button', { name: 'CREDITS' }).click()
  expect((await probe(page)).instances).toHaveLength(0)
  await page.getByRole('button', { name: 'RETURN' }).click()
  await page.getByRole('button', { name: 'PLAY', exact: true }).click()
  await expect(page.getByTestId('background-music-control')).toHaveAttribute('aria-label', 'Turn background music off')
  const started = await probe(page)
  expect(started.instances).toHaveLength(1)
  expect(started.instances[0]).toMatchObject({ src: '/audio/background-main.ogg', loop: true, volume: 0.22, currentTime: 0, playCalls: 1 })
  await page.screenshot({ path: resolve(evidenceDir, '01-music-control.png') })

  await page.getByTestId('background-music-control').click()
  await expect(page.getByTestId('background-music-control')).toHaveText('MUSIC OFF')
  await expect(page.getByTestId('background-music-control')).toHaveAttribute('aria-pressed', 'false')
  await page.getByTestId('background-music-control').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('background-music-control')).toHaveText('MUSIC ON')
  expect((await probe(page)).instances).toHaveLength(1)
  const asset = await page.request.get('/audio/background-main.ogg')
  expect(asset.ok()).toBe(true)
  expect(asset.headers()['content-type']).toContain('audio/ogg')
  const terminalAsset = await page.request.get('/audio/background-terminal.ogg')
  expect(terminalAsset.ok()).toBe(true)
})

test.describe('real touch music control', () => {
  test.use({ hasTouch: true })
  test('touch PLAY and MUSIC OFF/ON retain the single instance', async ({ page }) => {
    await installAudioProbe(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'PLAY', exact: true }).tap()
    await page.getByTestId('mobile-playback-toggle').tap()
    const control = page.getByTestId('background-music-control')
    await control.tap()
    await expect(control).toHaveAttribute('aria-label', 'Turn background music on')
    await control.tap()
    await expect(control).toHaveAttribute('aria-label', 'Turn background music off')
    expect((await probe(page)).instances).toHaveLength(1)
  })
})

test('reload never autoplays and persisted mute preference is not progression state', async ({ page }) => {
  await installAudioProbe(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'PLAY', exact: true }).click()
  await page.getByTestId('background-music-control').click()
  expect(await page.evaluate(() => localStorage.getItem('tarka.background-music-muted.v1'))).toBe('true')
  await page.reload()
  expect((await probe(page)).instances).toHaveLength(0)
  await expect(page.getByTestId('tarka-title-screen')).toBeVisible()
  await expect(page.getByTestId('background-music-control')).toHaveCount(0)
})
