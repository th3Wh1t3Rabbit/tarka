import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class FakeSource {
  buffer: { duration: number } | null = null
  onended: (() => void) | null = null
  startAt: number | null = null
  stopped = false
  connect() { return this }
  start(when: number) { this.startAt = when }
  stop() { this.stopped = true; this.onended?.() }
}

class FakeContext {
  static current: FakeContext
  currentTime = 10
  destination = {}
  sources: FakeSource[] = []
  gains: Array<{ gain: { value: number } }> = []
  mediaAttachments = 0
  constructor() { FakeContext.current = this }
  createMediaElementSource() { this.mediaAttachments += 1; return { connect: () => this.destination } }
  createBufferSource() { const source = new FakeSource(); this.sources.push(source); return source }
  createGain() { const gain = { gain: { value: 1 }, connect: () => this.destination }; this.gains.push(gain); return gain }
  decodeAudioData() { return Promise.resolve({ duration: 3.144 }) }
  resume() { return Promise.resolve() }
}

class FakeMedia extends EventTarget {
  currentTime = 116.2
  duration = 117.07825
  paused = false
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.stubGlobal('window', { AudioContext: FakeContext, setInterval, clearInterval })
  vi.stubGlobal('document', { hidden: false })
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })))
})

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('S16-R2 terminal shared audio clock', () => {
  it('schedules the measured peak on the actual decoded loop boundary and never starts a visual', async () => {
    const { terminalAudio, TERMINAL_AUTOMATIC_EFFECT_DELAY_SECONDS, TERMINAL_AUTOMATIC_EFFECT_GAIN, TERMINAL_EFFECT_ONSET_LEAD_SECONDS, TERMINAL_EFFECT_PEAK_BEFORE_LOOP_END_SECONDS, TERMINAL_EFFECT_PEAK_OFFSET_SECONDS } = await import('../../src/app/terminalAudio')
    const media = new FakeMedia() as unknown as HTMLAudioElement
    terminalAudio.mount()
    await terminalAudio.activate(media)
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(100)
    const context = FakeContext.current
    expect(context.mediaAttachments).toBe(1)
    expect(context.sources).toHaveLength(1)
    const expectedDelay = media.duration - media.currentTime - TERMINAL_EFFECT_ONSET_LEAD_SECONDS
    expect(context.sources[0]!.startAt).toBeCloseTo(context.currentTime + expectedDelay, 5)
    expect(context.sources[0]!.startAt! + TERMINAL_EFFECT_PEAK_OFFSET_SECONDS).toBeCloseTo(context.currentTime + media.duration - media.currentTime - TERMINAL_EFFECT_PEAK_BEFORE_LOOP_END_SECONDS + TERMINAL_AUTOMATIC_EFFECT_DELAY_SECONDS, 5)
    expect(TERMINAL_AUTOMATIC_EFFECT_DELAY_SECONDS).toBe(0.25)
    expect(TERMINAL_AUTOMATIC_EFFECT_GAIN).toBe(0.225)
    expect(context.gains[0]!.gain.value).toBe(0.225)
    expect(terminalAudio.snapshot().voice?.kind).toBe('AUTO')
    terminalAudio.unmount()
  })

  it('schedules one effect on each of two complete terminal-loop wraps without a backlog', async () => {
    const { terminalAudio } = await import('../../src/app/terminalAudio')
    const fake = new FakeMedia()
    const media = fake as unknown as HTMLAudioElement
    terminalAudio.mount()
    await terminalAudio.activate(media)
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(100)
    const context = FakeContext.current
    expect(context.sources).toHaveLength(1)
    context.sources[0]!.onended?.()
    for (let wrap = 1; wrap <= 2; wrap += 1) {
      fake.currentTime = 0.1; context.currentTime += 1
      await vi.advanceTimersByTimeAsync(100)
      fake.currentTime = 116.2; context.currentTime += 115
      await vi.advanceTimersByTimeAsync(100)
      expect(context.sources).toHaveLength(wrap + 1)
      context.sources[wrap]!.onended?.()
    }
    expect(terminalAudio.snapshot()).toMatchObject({ cycle: 2, scheduledCycle: 2, voice: null })
    terminalAudio.unmount()
  })

  it('skips early and late scheduler ticks and settles a denied manual fallback', async () => {
    const { terminalAudio, TERMINAL_EFFECT_ONSET_LEAD_SECONDS } = await import('../../src/app/terminalAudio')
    const fake = new FakeMedia()
    const media = fake as unknown as HTMLAudioElement
    terminalAudio.mount()
    fake.currentTime = 1
    await terminalAudio.activate(media)
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(100)
    expect(FakeContext.current.sources).toHaveLength(0)
    fake.currentTime = fake.duration - TERMINAL_EFFECT_ONSET_LEAD_SECONDS - 0.04
    await vi.advanceTimersByTimeAsync(100)
    expect(FakeContext.current.sources).toHaveLength(0)
    terminalAudio.unmount()

    vi.resetModules()
    vi.stubGlobal('window', { setInterval, clearInterval })
    class DeniedAudio {
      loop = false; volume = 1; preload = ''; currentTime = 0
      onended: (() => void) | null = null; onerror: (() => void) | null = null; onabort: (() => void) | null = null
      play() { return Promise.reject(new Error('denied')) }
      pause() {}
    }
    vi.stubGlobal('Audio', DeniedAudio)
    const fallbackOwner = (await import('../../src/app/terminalAudio')).terminalAudio
    fallbackOwner.mount()
    await expect(fallbackOwner.manual()).resolves.toBeUndefined()
    expect(fallbackOwner.snapshot()).toMatchObject({ mounted: true, automatic: false, clockReady: false, voice: null })
    fallbackOwner.unmount()
  })

  it('gives manual activation priority over a future automatic cue and reuses an active voice', async () => {
    const { terminalAudio } = await import('../../src/app/terminalAudio')
    const media = new FakeMedia() as unknown as HTMLAudioElement
    terminalAudio.mount()
    await terminalAudio.activate(media)
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(100)
    const context = FakeContext.current
    const automatic = context.sources[0]!
    const manualDone = terminalAudio.manual()
    await vi.advanceTimersByTimeAsync(0)
    expect(automatic.stopped).toBe(true)
    expect(context.sources).toHaveLength(2)
    expect(context.sources[1]!.startAt).toBe(context.currentTime)
    context.currentTime += 0.1
    const reused = terminalAudio.manual()
    await vi.advanceTimersByTimeAsync(0)
    expect(context.sources).toHaveLength(2)
    context.sources[1]!.onended?.()
    await Promise.all([manualDone, reused])
    expect(terminalAudio.snapshot().voice).toBeNull()
    terminalAudio.unmount()
  })

  it('cancels scheduled and active voices on terminal exit without a backlog', async () => {
    const { terminalAudio } = await import('../../src/app/terminalAudio')
    const media = new FakeMedia() as unknown as HTMLAudioElement
    terminalAudio.mount()
    await terminalAudio.activate(media)
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(100)
    const source = FakeContext.current.sources[0]!
    terminalAudio.deactivate()
    expect(source.stopped).toBe(true)
    expect(terminalAudio.snapshot()).toMatchObject({ automatic: false, voice: null })
    terminalAudio.unmount()
  })

  it('never lets a delayed manual decode revive after exit/reentry or hidden cancellation', async () => {
    let resolveFetch: ((value: { ok: true; arrayBuffer: () => Promise<ArrayBuffer> }) => void) | undefined
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { resolveFetch = resolve })))
    const { terminalAudio } = await import('../../src/app/terminalAudio')
    const first = new FakeMedia() as unknown as HTMLAudioElement
    terminalAudio.mount()
    await terminalAudio.activate(first)
    const stale = terminalAudio.manual()
    await Promise.resolve()
    terminalAudio.unmount()
    terminalAudio.mount()
    await terminalAudio.activate(new FakeMedia() as unknown as HTMLAudioElement)
    resolveFetch!({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
    await vi.advanceTimersByTimeAsync(0)
    expect(FakeContext.current.sources).toHaveLength(0)
    await stale

    vi.resetModules()
    let resolveHidden: ((value: { ok: true; arrayBuffer: () => Promise<ArrayBuffer> }) => void) | undefined
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { resolveHidden = resolve })))
    const hiddenOwner = (await import('../../src/app/terminalAudio')).terminalAudio
    hiddenOwner.mount()
    await hiddenOwner.activate(new FakeMedia() as unknown as HTMLAudioElement)
    const hidden = hiddenOwner.manual()
    await Promise.resolve()
    ;(document as { hidden: boolean }).hidden = true
    hiddenOwner.deactivate()
    resolveHidden!({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
    await vi.advanceTimersByTimeAsync(0)
    expect(FakeContext.current.sources).toHaveLength(0)
    await hidden
    hiddenOwner.unmount()
  })

  it('rechecks ownership after a deferred resume and gives a newer pending manual request sole authority', async () => {
    const { terminalAudio } = await import('../../src/app/terminalAudio')
    terminalAudio.mount()
    await terminalAudio.activate(new FakeMedia() as unknown as HTMLAudioElement)
    await vi.advanceTimersByTimeAsync(0)
    const context = FakeContext.current
    let resumeManual: (() => void) | undefined
    context.resume = () => new Promise<void>(resolve => { resumeManual = resolve })
    const staleResume = terminalAudio.manual()
    await Promise.resolve()
    terminalAudio.deactivate()
    resumeManual!()
    await vi.advanceTimersByTimeAsync(0)
    expect(context.sources).toHaveLength(0)
    await staleResume

    vi.resetModules()
    let resolveDecode: ((buffer: { duration: number }) => void) | undefined
    class DeferredDecodeContext extends FakeContext { override decodeAudioData() { return new Promise<{ duration: number }>(resolve => { resolveDecode = resolve }) } }
    vi.stubGlobal('window', { AudioContext: DeferredDecodeContext, setInterval, clearInterval })
    const nextOwner = (await import('../../src/app/terminalAudio')).terminalAudio
    nextOwner.mount()
    await nextOwner.activate(new FakeMedia() as unknown as HTMLAudioElement)
    await vi.advanceTimersByTimeAsync(0)
    const older = nextOwner.manual()
    const newer = nextOwner.manual()
    await vi.advanceTimersByTimeAsync(0)
    resolveDecode!({ duration: 3.144 })
    await vi.advanceTimersByTimeAsync(0)
    expect(FakeContext.current.sources).toHaveLength(1)
    FakeContext.current.sources[0]!.onended?.()
    await Promise.all([older, newer])
    nextOwner.unmount()
  })

  it('keeps a newer fallback owner intact when stale ended and rejection callbacks arrive', async () => {
    vi.resetModules()
    vi.stubGlobal('window', { setInterval, clearInterval })
    class CallbackAudio {
      static instance: CallbackAudio
      loop = false; volume = 1; preload = ''; currentTime = 0; playCalls = 0
      onended: (() => void) | null = null; onerror: (() => void) | null = null; onabort: (() => void) | null = null
      constructor() { CallbackAudio.instance = this }
      play() { this.playCalls += 1; return Promise.resolve() }
      pause() {}
    }
    vi.stubGlobal('Audio', CallbackAudio)
    const { terminalAudio } = await import('../../src/app/terminalAudio')
    terminalAudio.mount()
    const old = terminalAudio.manual()
    const staleEnded = CallbackAudio.instance.onended!
    terminalAudio.deactivate()
    await old
    const current = terminalAudio.manual()
    const currentEnded = CallbackAudio.instance.onended!
    staleEnded()
    const reused = terminalAudio.manual()
    expect(CallbackAudio.instance.playCalls).toBe(2)
    currentEnded()
    await Promise.all([current, reused])
    terminalAudio.unmount()
  })
})
