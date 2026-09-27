import { terminalAudio } from './terminalAudio'

export const BACKGROUND_MUSIC_MAIN_SRC = '/audio/background-main.ogg'
export const BACKGROUND_MUSIC_TERMINAL_SRC = '/audio/background-terminal.ogg'
export const BACKGROUND_MUSIC_CASE_CLOSED_SRC = '/audio/case-closed.ogg'
export const BACKGROUND_MUSIC_SRC = BACKGROUND_MUSIC_MAIN_SRC
export const BACKGROUND_MUSIC_DEFAULT_VOLUME = 0.22
export const BACKGROUND_MUSIC_PREFERENCE_KEY = 'tarka.background-music-muted.v1'
export type BackgroundMusicScene = 'OFFICE' | 'TERMINAL' | 'CASE_CLOSED'

type MusicListener = (state: BackgroundMusicState) => void
export interface BackgroundMusicState { started: boolean; muted: boolean; playing: boolean; scene: BackgroundMusicScene }

function readMutedPreference(): boolean { try { return localStorage.getItem(BACKGROUND_MUSIC_PREFERENCE_KEY) === 'true' } catch { return false } }
function writeMutedPreference(muted: boolean): void { try { localStorage.setItem(BACKGROUND_MUSIC_PREFERENCE_KEY, String(muted)) } catch { /* Preference persistence is optional. */ } }

class ProductionBackgroundMusicController {
  private audios: Partial<Record<BackgroundMusicScene, HTMLAudioElement>> = {}
  private started = false
  private muted = readMutedPreference()
  private playing = false
  private scene: BackgroundMusicScene = 'OFFICE'
  private listeners = new Set<MusicListener>()
  private visibilityBound = false
  private generation = 0
  private playOwners = new WeakMap<HTMLAudioElement, number>()

  snapshot(): BackgroundMusicState { return { started: this.started, muted: this.muted, playing: this.playing, scene: this.scene } }
  subscribe(listener: MusicListener): () => void { this.listeners.add(listener); listener(this.snapshot()); return () => this.listeners.delete(listener) }

  async startFresh(): Promise<void> {
    const generation = ++this.generation
    terminalAudio.deactivate()
    for (const audio of Object.values(this.audios)) { audio.pause(); audio.currentTime = 0 }
    this.scene = 'OFFICE'
    this.started = true
    this.playing = false
    const audio = this.ensureAudio('OFFICE')
    audio.currentTime = 0
    audio.muted = this.muted
    if (!this.muted && !document.hidden) await this.playCurrent(audio, 'OFFICE', generation)
    else { audio.pause(); this.emit() }
  }

  async setScene(scene: BackgroundMusicScene): Promise<void> {
    if (scene === this.scene) return
    const outgoing = this.audios[this.scene]
    const generation = ++this.generation
    terminalAudio.deactivate()
    if (outgoing) outgoing.pause()
    this.scene = scene
    this.playing = false
    this.emit()
    if (!this.started || this.muted || document.hidden) return
    const incoming = this.ensureAudio(scene)
    incoming.muted = this.muted
    await this.playCurrent(incoming, scene, generation)
  }

  async setMuted(muted: boolean): Promise<void> {
    this.muted = muted
    writeMutedPreference(muted)
    for (const audio of Object.values(this.audios)) audio.muted = muted
    const generation = ++this.generation
    if (muted) { terminalAudio.deactivate(); for (const audio of Object.values(this.audios)) audio.pause(); this.playing = false; this.emit(); return }
    if (this.started && !document.hidden) await this.playCurrent(this.ensureAudio(this.scene), this.scene, generation)
    else this.emit()
  }

  stopAndReset(): void {
    ++this.generation
    terminalAudio.deactivate()
    for (const audio of Object.values(this.audios)) { audio.pause(); audio.currentTime = 0 }
    this.scene = 'OFFICE'
    this.started = false
    this.playing = false
    this.emit()
  }

  private ensureAudio(scene: BackgroundMusicScene): HTMLAudioElement {
    const existing = this.audios[scene]
    if (existing) return existing
    const source = scene === 'OFFICE'
      ? BACKGROUND_MUSIC_MAIN_SRC
      : scene === 'TERMINAL'
        ? BACKGROUND_MUSIC_TERMINAL_SRC
        : BACKGROUND_MUSIC_CASE_CLOSED_SRC
    const audio = new Audio(source)
    audio.loop = true
    audio.volume = BACKGROUND_MUSIC_DEFAULT_VOLUME
    audio.muted = this.muted
    audio.preload = 'auto'
    this.audios[scene] = audio
    if (!this.visibilityBound) { document.addEventListener('visibilitychange', this.onVisibilityChange); this.visibilityBound = true }
    return audio
  }

  private onVisibilityChange = (): void => {
    const generation = ++this.generation
    if (document.hidden) { terminalAudio.deactivate(); for (const audio of Object.values(this.audios)) audio.pause(); this.playing = false; this.emit(); return }
    if (this.started && !this.muted) void this.playCurrent(this.ensureAudio(this.scene), this.scene, generation)
  }

  private async playCurrent(audio: HTMLAudioElement, scene: BackgroundMusicScene, generation: number): Promise<void> {
    for (const [key, other] of Object.entries(this.audios) as [BackgroundMusicScene, HTMLAudioElement][]) if (key !== scene) other.pause()
    this.playOwners.set(audio, generation)
    try {
      await audio.play()
      if (generation !== this.generation || scene !== this.scene || !this.started || this.muted || document.hidden) {
        if (this.playOwners.get(audio) === generation) audio.pause()
        return
      }
      this.playing = true
      if (scene === 'TERMINAL') void terminalAudio.activate(audio)
    } catch {
      if (generation === this.generation && scene === this.scene) this.playing = false
    }
    this.emit()
  }

  private emit(): void { const state = this.snapshot(); for (const listener of this.listeners) listener(state) }
}

export const backgroundMusic = new ProductionBackgroundMusicController()
