import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { progressionChain } from '../fixtures/s2/domain-helpers'

const evidenceDir = resolve('review/s17-p1/PHASE_C/AUDIO')

async function drainWorld(page: Page) {
  let quiet = 0
  for (let guard = 0; guard < 900 && quiet < 4; guard += 1) {
    const speech = page.getByTestId('speech-panel')
    const nonblocking = page.getByTestId('nonblocking-speech')
    if (await speech.count() || await nonblocking.count()) {
      await page.keyboard.press('Space')
      quiet = 0
    } else if (await page.getByTestId('active-sequence').count() || (await page.getByTestId('rook-sprite').getAttribute('data-animation'))?.startsWith('walk')) {
      quiet = 0
    } else quiet += 1
    await page.waitForTimeout(70)
  }
  await expect(page.getByTestId('speech-panel')).toHaveCount(0)
  await expect(page.getByTestId('nonblocking-speech')).toHaveCount(0)
  await expect(page.getByTestId('active-sequence')).toHaveCount(0)
}

async function authorizeThroughProductionActions(page: Page) {
  for (const [verb, hotspot, item, item2, , phase] of progressionChain) {
    await page.getByTestId(`verb-${String(verb).toLowerCase().replace('_', '-')}`).click()
    if (item) await page.getByTestId(`inventory-${item}`).click()
    if (hotspot) await page.getByTestId(`hotspot-${hotspot}`).click()
    else if (item2) await page.getByTestId(`inventory-${item2}`).click()
    if (phase !== 'COMPLETE') await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', String(phase), { timeout: 20_000 })
    await drainWorld(page)
  }
  await expect(page.getByTestId('a0-shell')).toHaveAttribute('data-phase', 'COMPLETE')
}

test('S17-C03 actual production owner observes two normal-speed terminal wraps', async ({ page }) => {
  test.setTimeout(360_000)
  const external: string[] = []
  await page.context().route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1') return route.continue()
    external.push(route.request().url())
    return route.abort('blockedbyclient')
  })
  await page.context().routeWebSocket('**/*', socket => socket.close())
  await page.goto('/')
  await page.getByRole('button', { name: 'PLAY', exact: true }).click()
  await expect(page.getByTestId('a0-shell')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('text-speed-menu').click()
  await page.getByTestId('dialogue-mode-manual').click()
  await drainWorld(page)
  await authorizeThroughProductionActions(page)
  await page.getByTestId('verb-use').click()
  await page.getByTestId('hotspot-nansen-terminal').click()
  await expect(page.getByTestId('case-terminal')).toBeVisible({ timeout: 20_000 })

  const observation = await page.evaluate(async () => {
    type OwnerSnapshot = { mounted: boolean; automatic: boolean; clockReady: boolean; cycle: number; scheduledCycle: number; voice: null | { kind: string; startAt: number; endAt: number; active: boolean } }
    type Owner = { snapshot(): OwnerSnapshot; context: AudioContext | null }
    type Music = { audios: Partial<Record<'OFFICE' | 'TERMINAL' | 'CASE_CLOSED', HTMLAudioElement>> }
    const dynamicImport = new Function('path', 'return import(path)') as (path: string) => Promise<Record<string, unknown>>
    const audioModule = await dynamicImport('/src/app/terminalAudio.ts')
    const musicModule = await dynamicImport('/src/app/backgroundMusic.ts')
    const owner = audioModule.terminalAudio as Owner
    const music = musicModule.backgroundMusic as Music
    const started = performance.now()
    while (!music.audios.TERMINAL && performance.now() - started < 15_000) await new Promise(resolveWait => setTimeout(resolveWait, 50))
    const audio = music.audios.TERMINAL
    if (!audio) throw new Error('PRODUCTION_TERMINAL_AUDIO_MISSING')
    while ((!Number.isFinite(audio.duration) || audio.duration <= 0 || audio.paused || !owner.snapshot().clockReady) && performance.now() - started < 15_000) await new Promise(resolveWait => setTimeout(resolveWait, 50))
    if (!Number.isFinite(audio.duration) || audio.duration <= 0 || audio.paused || !owner.snapshot().clockReady) throw new Error('PRODUCTION_TERMINAL_AUDIO_NOT_RUNNING')
    const duration = audio.duration
    const wraps: Array<Record<string, number>> = []
    const voiceSchedules: Array<Record<string, number | string | boolean>> = []
    const timeline: Array<Record<string, number | boolean>> = []
    let lastPosition = audio.currentTime
    let lastWholeSecond = -1
    let lastVoice = ''
    let autoVisualActivations = 0
    await new Promise<void>((resolveWait, reject) => {
      const timeoutAt = performance.now() + duration * 2_000 + 25_000
      const timer = window.setInterval(() => {
        const position = audio.currentTime
        const contextTime = owner.context?.currentTime ?? 0
        const snapshot = owner.snapshot()
        const elapsed = (performance.now() - started) / 1000
        if (document.querySelector('.s5-native-terminal')?.classList.contains('is-degaussing')) autoVisualActivations += 1
        const wholeSecond = Math.floor(elapsed)
        if (wholeSecond !== lastWholeSecond) {
          lastWholeSecond = wholeSecond
          timeline.push({ elapsed, position, contextTime, cycle: snapshot.cycle, scheduledCycle: snapshot.scheduledCycle, paused: audio.paused })
        }
        if (snapshot.voice) {
          const voiceKey = `${snapshot.voice.kind}:${snapshot.voice.startAt.toFixed(6)}`
          if (voiceKey !== lastVoice) {
            lastVoice = voiceKey
            voiceSchedules.push({ kind: snapshot.voice.kind, detectedElapsed: elapsed, detectedPosition: position, detectedContextTime: contextTime, startAt: snapshot.voice.startAt, peakAt: snapshot.voice.startAt + 0.745, endAt: snapshot.voice.endAt, active: snapshot.voice.active })
          }
        }
        if (position + 0.25 < lastPosition) wraps.push({ elapsed, beforePosition: lastPosition, afterPosition: position, contextTime, ownerCycle: snapshot.cycle, scheduledCycle: snapshot.scheduledCycle })
        lastPosition = position
        if (wraps.length >= 2 && snapshot.cycle >= 2) { window.clearInterval(timer); resolveWait() }
        else if (performance.now() > timeoutAt) { window.clearInterval(timer); reject(new Error(`TWO_WRAP_TIMEOUT:${JSON.stringify({ duration, wraps, snapshot })}`)) }
      }, 50)
    })
    return {
      actualOwner: 'TerminalAudioOwner + ProductionBackgroundMusicController',
      actualMedia: audio.currentSrc || audio.src,
      duration,
      playbackRate: audio.playbackRate,
      loop: audio.loop,
      volume: audio.volume,
      effectGain: audioModule.TERMINAL_EFFECT_GAIN,
      automaticEffectGain: audioModule.TERMINAL_AUTOMATIC_EFFECT_GAIN,
      automaticEffectDelaySeconds: audioModule.TERMINAL_AUTOMATIC_EFFECT_DELAY_SECONDS,
      effectPeakOffsetSeconds: audioModule.TERMINAL_EFFECT_PEAK_OFFSET_SECONDS,
      effectPeakBeforeLoopEndSeconds: audioModule.TERMINAL_EFFECT_PEAK_BEFORE_LOOP_END_SECONDS,
      wraps,
      voiceSchedules,
      timeline,
      finalOwner: owner.snapshot(),
      autoVisualActivations,
    }
  })

  expect(observation.actualMedia).toContain('/audio/background-terminal.ogg')
  expect(observation.duration).toBeGreaterThan(117)
  expect(observation.playbackRate).toBe(1)
  expect(observation.loop).toBe(true)
  expect(observation.volume).toBe(0.22)
  expect(observation.effectGain).toBe(0.375)
  expect(observation.automaticEffectGain).toBe(0.225)
  expect(observation.automaticEffectDelaySeconds).toBe(0.25)
  expect(observation.effectPeakBeforeLoopEndSeconds).toBe(0.15)
  expect(observation.wraps).toHaveLength(2)
  expect(observation.voiceSchedules.filter(voice => voice.kind === 'AUTO').length).toBeGreaterThanOrEqual(2)
  expect(observation.finalOwner.cycle).toBeGreaterThanOrEqual(2)
  expect(observation.autoVisualActivations).toBe(0)
  expect(external).toEqual([])
  mkdirSync(evidenceDir, { recursive: true })
  writeFileSync(resolve(evidenceDir, 'actual-owner-two-wraps.json'), `${JSON.stringify({ schema: 'tarka.s17-p1.actual-owner-two-wraps.v1', normalSpeed: true, acceleratedSeek: false, syntheticScheduler: false, externalRequests: external, ...observation }, null, 2)}\n`)
  await page.screenshot({ path: resolve(evidenceDir, 'actual-owner-after-two-wraps.png'), fullPage: true })
})
