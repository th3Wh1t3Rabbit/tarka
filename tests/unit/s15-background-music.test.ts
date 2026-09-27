import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = []
  static deferPlay = false
  static pendingPlay: Array<() => void> = []
  src: string
  loop = false
  volume = 1
  muted = false
  preload = ''
  currentTime = 0
  playCalls = 0
  pauseCalls = 0

  constructor(src: string) {
    super()
    this.src = src
    FakeAudio.instances.push(this)
  }

  play = () => {
    this.playCalls += 1
    this.dispatchEvent(new Event('play'))
    return FakeAudio.deferPlay ? new Promise<void>(resolve => FakeAudio.pendingPlay.push(resolve)) : Promise.resolve()
  }
  pause = () => { this.pauseCalls += 1; this.dispatchEvent(new Event('pause')) }
}

class FakeDocument extends EventTarget {
  hidden = false
}

const preference = new Map<string, string>()

beforeEach(() => {
  vi.resetModules()
  FakeAudio.instances = []
  FakeAudio.deferPlay = false
  FakeAudio.pendingPlay = []
  preference.clear()
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('document', new FakeDocument())
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => preference.get(key) ?? null,
    setItem: (key: string, value: string) => preference.set(key, value),
  })
})

describe('S15 production background music', () => {
  it('binds PLAY, MAIN MENU, PLAY AGAIN, completion, and Credits at the production navigation owner', () => {
    const source = readFileSync('src/app/App.tsx', 'utf8')
    expect(source).toContain('void backgroundMusic.startFresh()')
    expect(source).toContain('backgroundMusic.stopAndReset(); void backgroundMusic.startFresh(); navigate({ type: \'PLAY_AGAIN\' })')
    expect(source).toContain("backgroundMusic.stopAndReset(); navigate({ type: 'MAIN_MENU' })")
    expect(source).toContain("onCredits={() => navigate({ type: 'OPEN_CREDITS', from: 'COMPLETION' })}")
    expect(source).toContain("pendingEndingStatus || endingStatus ? 'CASE_CLOSED' : terminalOpen ? 'TERMINAL' : 'OFFICE'")
    expect(source).not.toMatch(/OPEN_CREDITS[^\n]+backgroundMusic\.(?:stopAndReset|startFresh)/)
  })

  it('stays silent until PLAY and owns exactly one looping audio instance', async () => {
    const { BACKGROUND_MUSIC_DEFAULT_VOLUME, BACKGROUND_MUSIC_SRC, backgroundMusic } = await import('../../src/app/backgroundMusic')
    expect(FakeAudio.instances).toHaveLength(0)
    await backgroundMusic.startFresh()
    await backgroundMusic.startFresh()
    expect(FakeAudio.instances).toHaveLength(1)
    expect(FakeAudio.instances[0]).toMatchObject({ src: BACKGROUND_MUSIC_SRC, loop: true, volume: BACKGROUND_MUSIC_DEFAULT_VOLUME, currentTime: 0, playCalls: 2 })
  })

  it('persists only mute preference and resumes visibility only after a user-started run', async () => {
    const fakeDocument = document as unknown as FakeDocument
    const { BACKGROUND_MUSIC_PREFERENCE_KEY, backgroundMusic } = await import('../../src/app/backgroundMusic')
    await backgroundMusic.setMuted(true)
    expect(preference.get(BACKGROUND_MUSIC_PREFERENCE_KEY)).toBe('true')
    expect(FakeAudio.instances).toHaveLength(0)

    await backgroundMusic.startFresh()
    const audio = FakeAudio.instances[0]!
    expect(audio.playCalls).toBe(0)
    await backgroundMusic.setMuted(false)
    expect(audio.playCalls).toBe(1)
    audio.currentTime = 42
    fakeDocument.hidden = true
    fakeDocument.dispatchEvent(new Event('visibilitychange'))
    expect(audio.pauseCalls).toBeGreaterThan(0)
    expect(audio.currentTime).toBe(42)
    fakeDocument.hidden = false
    fakeDocument.dispatchEvent(new Event('visibilitychange'))
    expect(audio.playCalls).toBe(2)
    backgroundMusic.stopAndReset()
    expect(audio.currentTime).toBe(0)
    expect(backgroundMusic.snapshot().started).toBe(false)
  })

  it('switches office and terminal loops without overlap and retains each position', async () => {
    const { BACKGROUND_MUSIC_MAIN_SRC, BACKGROUND_MUSIC_TERMINAL_SRC, backgroundMusic } = await import('../../src/app/backgroundMusic')
    await backgroundMusic.startFresh()
    const office = FakeAudio.instances[0]!
    expect(office.src).toBe(BACKGROUND_MUSIC_MAIN_SRC)
    office.currentTime = 41
    await backgroundMusic.setScene('TERMINAL')
    const terminal = FakeAudio.instances[1]!
    expect(terminal.src).toBe(BACKGROUND_MUSIC_TERMINAL_SRC)
    expect(office.pauseCalls).toBeGreaterThan(0)
    expect(office.currentTime).toBe(41)
    expect(terminal.playCalls).toBe(1)
    terminal.currentTime = 23
    await backgroundMusic.setScene('OFFICE')
    expect(terminal.pauseCalls).toBeGreaterThan(0)
    expect(terminal.currentTime).toBe(23)
    expect(office.currentTime).toBe(41)
    expect(office.playCalls).toBe(2)
    expect(backgroundMusic.snapshot()).toMatchObject({ scene: 'OFFICE', playing: true })
    backgroundMusic.stopAndReset()
    expect(office.currentTime).toBe(0)
    expect(terminal.currentTime).toBe(0)
  })

  it('uses a dedicated case-closed cue without letting office or terminal music overlap it', async () => {
    const { BACKGROUND_MUSIC_CASE_CLOSED_SRC, backgroundMusic } = await import('../../src/app/backgroundMusic')
    await backgroundMusic.startFresh()
    const office = FakeAudio.instances[0]!
    await backgroundMusic.setScene('TERMINAL')
    const terminal = FakeAudio.instances[1]!
    terminal.currentTime = 29

    await backgroundMusic.setScene('CASE_CLOSED')

    const caseClosed = FakeAudio.instances[2]!
    expect(caseClosed).toMatchObject({ src: BACKGROUND_MUSIC_CASE_CLOSED_SRC, loop: true, playCalls: 1 })
    expect(office.pauseCalls).toBeGreaterThan(0)
    expect(terminal.pauseCalls).toBeGreaterThan(0)
    expect(terminal.currentTime).toBe(29)
    expect(backgroundMusic.snapshot()).toMatchObject({ scene: 'CASE_CLOSED', playing: true })
  })

  it('invalidates stale play completions during rapid scene changes', async () => {
    FakeAudio.deferPlay = true
    const { backgroundMusic } = await import('../../src/app/backgroundMusic')
    const starting = backgroundMusic.startFresh()
    const office = FakeAudio.instances[0]!
    const switching = backgroundMusic.setScene('TERMINAL')
    const terminal = FakeAudio.instances[1]!
    FakeAudio.pendingPlay.shift()!()
    await starting
    expect(office.pauseCalls).toBeGreaterThanOrEqual(2)
    expect(backgroundMusic.snapshot()).toMatchObject({ scene: 'TERMINAL', playing: false })
    FakeAudio.pendingPlay.shift()!()
    await switching
    expect(terminal.playCalls).toBe(1)
    expect(backgroundMusic.snapshot()).toMatchObject({ scene: 'TERMINAL', playing: true })
  })

  it('never lets OLD → OTHER → OLD completions pause the reused current owner in either direction', async () => {
    FakeAudio.deferPlay = true
    const { backgroundMusic } = await import('../../src/app/backgroundMusic')
    const firstOffice = backgroundMusic.startFresh()
    const office = FakeAudio.instances[0]!
    const toTerminal = backgroundMusic.setScene('TERMINAL')
    const terminal = FakeAudio.instances[1]!
    const backToOffice = backgroundMusic.setScene('OFFICE')
    const officePausesBeforeStale = office.pauseCalls
    FakeAudio.pendingPlay.shift()!()
    await firstOffice
    expect(office.pauseCalls).toBe(officePausesBeforeStale)
    FakeAudio.pendingPlay.shift()!()
    await toTerminal
    FakeAudio.pendingPlay.shift()!()
    await backToOffice
    expect(backgroundMusic.snapshot()).toMatchObject({ scene: 'OFFICE', playing: true })

    const terminalAgain = backgroundMusic.setScene('TERMINAL')
    const officeAgain = backgroundMusic.setScene('OFFICE')
    const terminalFinal = backgroundMusic.setScene('TERMINAL')
    const terminalPausesBeforeStale = terminal.pauseCalls
    FakeAudio.pendingPlay.shift()!()
    await terminalAgain
    expect(terminal.pauseCalls).toBe(terminalPausesBeforeStale)
    FakeAudio.pendingPlay.shift()!()
    await officeAgain
    FakeAudio.pendingPlay.shift()!()
    await terminalFinal
    expect(backgroundMusic.snapshot()).toMatchObject({ scene: 'TERMINAL', playing: true })
  })

  it('preserves mute across a scene change and starts only the requested track when unmuted', async () => {
    const { backgroundMusic } = await import('../../src/app/backgroundMusic')
    await backgroundMusic.setMuted(true)
    await backgroundMusic.startFresh()
    const office = FakeAudio.instances[0]!
    await backgroundMusic.setScene('TERMINAL')
    expect(FakeAudio.instances).toHaveLength(1)
    await backgroundMusic.setMuted(false)
    const terminal = FakeAudio.instances[1]!
    expect(office.playCalls).toBe(0)
    expect(terminal).toMatchObject({ muted: false, playCalls: 1 })
  })
})
