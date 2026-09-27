export type AudioEvent =
  | 'vault.enter'
  | 'world.birth'
  | 'signal.move'
  | 'scan.fire'
  | 'echo.compare'
  | 'contradiction.fracture'
  | 'rewind.commit'
  | 'conversion.unlock'
  | 'resonance.form'
  | 'converter.input'
  | 'converter.output'
  | 'theory.commit'
  | 'theory.break'
  | 'truth.engine.start'
  | 'truth.engine.complete'

type Listener = (event: AudioEvent) => void

class AudioBus {
  private listeners = new Set<Listener>()
  private muted = false
  private history: AudioEvent[] = []

  setMuted(muted: boolean) {
    this.muted = muted
  }

  emit(event: AudioEvent) {
    this.history.push(event)
    if (this.muted) return
    this.listeners.forEach((listener) => listener(event))
  }

  getHistory(): readonly AudioEvent[] {
    return [...this.history]
  }

  resetHistory() {
    this.history = []
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

export const audioBus = new AudioBus()
