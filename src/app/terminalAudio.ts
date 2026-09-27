export const TERMINAL_EFFECT_SRC = '/audio/degauss-sfx.mp3'
// Manual degauss retains its approved level. The automatic loop-seam accent is
// mixed independently so ambient repetition stays subordinate to the music.
export const TERMINAL_EFFECT_GAIN = 0.375
export const TERMINAL_AUTOMATIC_EFFECT_GAIN = 0.225
export const TERMINAL_EFFECT_PEAK_OFFSET_SECONDS = 0.745
export const TERMINAL_EFFECT_PEAK_BEFORE_LOOP_END_SECONDS = 0.15
// Principal adjustment: the automatic seam accent starts 250 ms later than
// the previous mix. Manual button playback remains immediate and unchanged.
export const TERMINAL_AUTOMATIC_EFFECT_DELAY_SECONDS = 0.25
export const TERMINAL_EFFECT_ONSET_LEAD_SECONDS = TERMINAL_EFFECT_PEAK_OFFSET_SECONDS
  + TERMINAL_EFFECT_PEAK_BEFORE_LOOP_END_SECONDS
  - TERMINAL_AUTOMATIC_EFFECT_DELAY_SECONDS

type VoiceKind = 'AUTO' | 'MANUAL'
type EffectVoice = { kind: VoiceKind; startAt: number; endAt: number; stop: () => void; done: Promise<void> }

/**
 * One terminal effect voice and one loop-seam scheduler. Production uses a
 * MediaElementAudioSourceNode plus AudioBufferSourceNode so both onsets share
 * AudioContext.currentTime. The interval only looks ahead; source.start(when)
 * owns the actual onset. A small HTMLAudio fallback preserves manual gesture
 * playback in environments that cannot attach the media element and never
 * claims automatic seam precision.
 */
class TerminalAudioOwner {
  private context: AudioContext | null = null
  private buffer: AudioBuffer | null = null
  private bufferLoad: Promise<AudioBuffer | null> | null = null
  private terminal: HTMLAudioElement | null = null
  private mounted = false
  private automatic = false
  private generation = 0
  private manualEpoch = 0
  private timer: number | null = null
  private lastPosition = 0
  private cycle = 0
  private scheduledCycle = -1
  private voice: EffectVoice | null = null
  private fallback: HTMLAudioElement | null = null
  private fallbackDone: Promise<void> | null = null
  private fallbackResolve: (() => void) | null = null
  private fallbackOwner = 0
  private attached = new WeakSet<HTMLAudioElement>()
  private clockReady = false

  mount(): void { this.mounted = true }
  unmount(): void { this.mounted = false; this.deactivate() }

  async activate(audio: HTMLAudioElement): Promise<void> {
    const generation = ++this.generation
    this.cancelTimer()
    this.stopVoice()
    this.terminal = audio
    this.automatic = true
    this.lastPosition = Number.isFinite(audio.currentTime) ? audio.currentTime : 0
    this.cycle = 0
    this.scheduledCycle = -1
    this.clockReady = this.attachClock(audio)
    if (!this.clockReady) return
    await this.context?.resume().catch(() => undefined)
    void this.loadBuffer()
    if (generation !== this.generation || !this.automatic || this.terminal !== audio) return
    this.timer = window.setInterval(() => this.tick(generation), 100)
    this.tick(generation)
  }

  deactivate(): void {
    ++this.generation
    this.automatic = false
    this.terminal = null
    this.cancelTimer()
    this.stopVoice()
  }

  async manual(): Promise<void> {
    if (!this.mounted) return
    if (this.clockReady && this.context) {
      const generation = this.generation
      const epoch = ++this.manualEpoch
      const context = this.context
      await context.resume().catch(() => undefined)
      if (!this.manualCurrent(generation, epoch, context)) return
      const buffer = await this.loadBuffer()
      if (!buffer || !this.manualCurrent(generation, epoch, context)) return
      const now = context.currentTime
      if (this.voice && now < this.voice.endAt) {
        if (this.voice.kind === 'AUTO' && now + 0.01 < this.voice.startAt) this.stopVoice()
        else return this.voice.done
      }
      return this.startBufferVoice('MANUAL', now, buffer).done
    }
    return this.manualFallback()
  }

  snapshot() {
    const now = this.context?.currentTime ?? 0
    return { mounted: this.mounted, automatic: this.automatic, clockReady: this.clockReady, cycle: this.cycle, scheduledCycle: this.scheduledCycle, voice: this.voice ? { kind: this.voice.kind, startAt: this.voice.startAt, endAt: this.voice.endAt, active: now < this.voice.endAt } : null }
  }

  private attachClock(audio: HTMLAudioElement): boolean {
    try {
      const Constructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Constructor) return false
      this.context ??= new Constructor()
      if (!this.attached.has(audio)) {
        this.context.createMediaElementSource(audio).connect(this.context.destination)
        this.attached.add(audio)
      }
      return true
    } catch { return false }
  }

  private async loadBuffer(): Promise<AudioBuffer | null> {
    if (this.buffer) return this.buffer
    if (this.bufferLoad) return this.bufferLoad
    const context = this.context
    if (!context) return null
    this.bufferLoad = fetch(TERMINAL_EFFECT_SRC, { credentials: 'same-origin' })
      .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error('effect unavailable')))
      .then(bytes => context.decodeAudioData(bytes.slice(0)))
      .then(buffer => (this.buffer = buffer), () => null)
    return this.bufferLoad
  }

  private tick(generation: number): void {
    const audio = this.terminal
    const context = this.context
    if (generation !== this.generation || !this.automatic || !audio || !context || audio.paused || document.hidden) return
    const position = audio.currentTime
    const duration = audio.duration
    if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= TERMINAL_EFFECT_ONSET_LEAD_SECONDS) return
    if (position + 0.25 < this.lastPosition) { this.cycle += 1; this.scheduledCycle = -1 }
    this.lastPosition = position
    const onsetDelay = duration - position - TERMINAL_EFFECT_ONSET_LEAD_SECONDS
    // Late cues are skipped. The timer only enters a bounded look-ahead
    // window; AudioContext owns the exact future start.
    if (this.scheduledCycle === this.cycle || onsetDelay < 0.08 || onsetDelay > 0.35 || !this.buffer) return
    this.scheduledCycle = this.cycle
    this.scheduleAutomatic(context.currentTime + onsetDelay, this.buffer)
  }

  private scheduleAutomatic(startAt: number, buffer: AudioBuffer): void {
    const context = this.context
    if (!context) return
    const now = context.currentTime
    if (this.voice && now < this.voice.endAt) return
    this.startBufferVoice('AUTO', startAt, buffer)
  }

  private startBufferVoice(kind: VoiceKind, startAt: number, buffer: AudioBuffer): EffectVoice {
    const context = this.context!
    const source = context.createBufferSource()
    const gain = context.createGain()
    gain.gain.value = kind === 'AUTO' ? TERMINAL_AUTOMATIC_EFFECT_GAIN : TERMINAL_EFFECT_GAIN
    source.buffer = buffer
    source.connect(gain).connect(context.destination)
    let resolveDone: () => void = () => undefined
    const done = new Promise<void>(resolve => { resolveDone = resolve })
    const voice: EffectVoice = { kind, startAt, endAt: startAt + buffer.duration, stop: () => { try { source.stop() } catch { /* already stopped */ } }, done }
    source.onended = () => { if (this.voice === voice) this.voice = null; resolveDone() }
    this.voice = voice
    try { source.start(startAt) } catch { this.voice = null; resolveDone() }
    return voice
  }

  private manualFallback(): Promise<void> {
    if (this.fallbackDone) return this.fallbackDone
    const generation = this.generation
    const epoch = ++this.manualEpoch
    const owner = ++this.fallbackOwner
    const audio = this.fallback ?? new Audio(TERMINAL_EFFECT_SRC)
    this.fallback = audio
    audio.loop = false
    audio.volume = TERMINAL_EFFECT_GAIN
    audio.preload = 'auto'
    audio.currentTime = 0
    let resolveDone: () => void = () => undefined
    this.fallbackDone = new Promise<void>(resolve => { resolveDone = resolve })
    this.fallbackResolve = resolveDone
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      if (this.fallbackOwner === owner && this.manualCurrent(generation, epoch, this.context)) {
        audio.onended = null
        audio.onerror = null
        audio.onabort = null
        this.fallbackDone = null
        this.fallbackResolve = null
      }
      resolveDone()
    }
    audio.onended = finish
    audio.onerror = finish
    audio.onabort = finish
    void audio.play().catch(finish)
    return this.fallbackDone
  }

  private stopVoice(): void {
    ++this.manualEpoch
    ++this.fallbackOwner
    if (this.voice) { const voice = this.voice; this.voice = null; voice.stop() }
    if (this.fallback) { this.fallback.pause(); this.fallback.currentTime = 0; this.fallback.onended = null; this.fallback.onerror = null; this.fallback.onabort = null }
    this.fallbackResolve?.()
    this.fallbackResolve = null
    this.fallbackDone = null
  }

  private manualCurrent(generation: number, epoch: number, context: AudioContext | null): boolean {
    return this.mounted && generation === this.generation && epoch === this.manualEpoch && context === this.context
  }

  private cancelTimer(): void { if (this.timer !== null) { window.clearInterval(this.timer); this.timer = null } }
}

export const terminalAudio = new TerminalAudioOwner()
