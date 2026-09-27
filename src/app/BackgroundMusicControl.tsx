import { useEffect, useState } from 'react'
import { backgroundMusic, type BackgroundMusicState } from './backgroundMusic'
import type { AdventureAction, AdventureState } from '../adventure/types'

export function BackgroundMusicControl() {
  const [state, setState] = useState<BackgroundMusicState>(() => backgroundMusic.snapshot())
  useEffect(() => backgroundMusic.subscribe(setState), [])
  const label = state.muted ? 'Turn background music on' : 'Turn background music off'
  return <button
    type="button"
    className="background-music-control"
    data-testid="background-music-control"
    aria-label={label}
    aria-pressed={!state.muted}
    onClick={() => { void backgroundMusic.setMuted(!state.muted) }}
  >MUSIC {state.muted ? 'OFF' : 'ON'}</button>
}

export function DialogueDeliveryControls({ state, dispatch }: { state: Pick<AdventureState, 'dialogueMode' | 'dialoguePace' | 'dialogueDisplay'>; dispatch: (action: AdventureAction) => void }) {
  const selected = state.dialogueMode === 'MANUAL' ? 'Manual' : state.dialoguePace[0] + state.dialoguePace.slice(1).toLowerCase()
  const choose = (value: 'MANUAL' | 'SLOW' | 'NORMAL' | 'FAST') => {
    if (value === 'MANUAL') dispatch({ type: 'SET_DIALOGUE_MODE', mode: 'MANUAL' })
    else { dispatch({ type: 'SET_DIALOGUE_MODE', mode: 'AUTO' }); dispatch({ type: 'SET_DIALOGUE_PACE', pace: value }) }
  }
  const nextDisplay = state.dialogueDisplay === 'FULL' ? 'TYPED' : 'FULL'
  return <div className="dialogue-delivery-group">
    <details className="dialogue-delivery-controls" data-testid="dialogue-delivery-controls">
      <summary data-testid="text-speed-menu">TEXT SPEED · {selected}</summary>
      <div role="group" aria-label="Text Speed">{(['MANUAL', 'SLOW', 'NORMAL', 'FAST'] as const).map((value) => <button key={value} type="button" data-testid={value === 'MANUAL' ? 'dialogue-mode-manual' : `dialogue-pace-${value.toLowerCase()}`} aria-pressed={selected.toUpperCase() === value} onClick={(event) => { choose(value); event.currentTarget.closest('details')?.removeAttribute('open') }}>{value[0]}{value.slice(1).toLowerCase()}</button>)}</div>
    </details>
    <button
      type="button"
      className="dialogue-display-toggle"
      data-testid="dialogue-display-toggle"
      aria-label={`Text display is ${state.dialogueDisplay.toLowerCase()}. Switch to ${nextDisplay.toLowerCase()}.`}
      aria-pressed={state.dialogueDisplay === 'FULL'}
      onClick={() => dispatch({ type: 'SET_DIALOGUE_DISPLAY', display: nextDisplay })}
    >TEXT · {state.dialogueDisplay}</button>
  </div>
}

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>
  unlock?: () => void
}

function fullscreenPresentationTarget() {
  return document.querySelector<HTMLElement>('.s5-scaled-space')
    ?? document.querySelector<HTMLElement>('.a0-frame')
}

function updateFullscreenFit() {
  const target = fullscreenPresentationTarget()
  if (!target) return
  const width = target.offsetWidth
  const height = target.offsetHeight
  if (width <= 0 || height <= 0) return
  const fit = Math.min(window.innerWidth / width, window.innerHeight / height)
  document.documentElement.style.setProperty('--tarka-fullscreen-fit', String(fit))
}

function FullscreenControl({ onPresentationChange, shortcut = false }: { onPresentationChange?: () => void; shortcut?: boolean }) {
  const [fullscreen, setFullscreen] = useState(() => Boolean(document.fullscreenElement))
  const supported = typeof document.documentElement.requestFullscreen === 'function'
  useEffect(() => {
    const orientation = screen.orientation as LockableScreenOrientation
    const sync = () => {
      const active = Boolean(document.fullscreenElement)
      setFullscreen(active)
      document.documentElement.classList.toggle('tarka-mobile-fullscreen', active)
      if (active) window.requestAnimationFrame(updateFullscreenFit)
      else {
        document.documentElement.style.removeProperty('--tarka-fullscreen-fit')
        try { orientation.unlock?.() } catch { /* Orientation was not locked by this browser. */ }
      }
    }
    const refit = () => {
      if (document.fullscreenElement) window.requestAnimationFrame(updateFullscreenFit)
    }
    document.addEventListener('fullscreenchange', sync)
    window.addEventListener('resize', refit)
    orientation.addEventListener?.('change', refit)
    sync()
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      window.removeEventListener('resize', refit)
      orientation.removeEventListener?.('change', refit)
      document.documentElement.classList.remove('tarka-mobile-fullscreen')
      document.documentElement.style.removeProperty('--tarka-fullscreen-fit')
    }
  }, [])
  if (!supported) return null
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        onPresentationChange?.()
        await document.exitFullscreen()
        return
      }
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      onPresentationChange?.()
      const orientation = screen.orientation as LockableScreenOrientation
      if (window.innerHeight > window.innerWidth && typeof orientation.lock === 'function') {
        try { await orientation.lock('landscape') } catch { /* Portrait fit remains usable when locking is unavailable. */ }
      }
      window.requestAnimationFrame(updateFullscreenFit)
    } catch {
      document.documentElement.classList.remove('tarka-mobile-fullscreen')
      document.documentElement.style.removeProperty('--tarka-fullscreen-fit')
    }
  }
  return <button
    type="button"
    className={shortcut ? 'mobile-fullscreen-shortcut' : 'mobile-fullscreen-control'}
    data-testid={shortcut ? 'mobile-fullscreen-shortcut' : 'mobile-fullscreen-control'}
    aria-label={fullscreen ? 'Exit full screen' : 'Enter full screen'}
    aria-pressed={fullscreen}
    onClick={() => { void toggleFullscreen() }}
  >{shortcut
    ? <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5"/></svg>
    : fullscreen ? 'EXIT FULL SCREEN' : 'FULL SCREEN'}</button>
}

export function PlaybackControls({ state, dispatch }: { state: Pick<AdventureState, 'dialogueMode' | 'dialoguePace' | 'dialogueDisplay'>; dispatch: (action: AdventureAction) => void }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  return <div className={`playback-controls${mobileOpen ? ' mobile-open' : ''}`}>
    <div className="mobile-playback-buttons">
      <FullscreenControl shortcut onPresentationChange={() => setMobileOpen(false)}/>
      <button
        type="button"
        className="mobile-playback-toggle"
        data-testid="mobile-playback-toggle"
        aria-label={mobileOpen ? 'Close display and audio settings' : 'Open display and audio settings'}
        aria-expanded={mobileOpen}
        aria-controls="playback-controls-panel"
        onClick={() => setMobileOpen((open) => !open)}
      ><span aria-hidden="true">☰</span></button>
    </div>
    <div className="playback-controls-panel" id="playback-controls-panel">
      <DialogueDeliveryControls state={state} dispatch={dispatch}/>
      <BackgroundMusicControl/>
      <FullscreenControl onPresentationChange={() => setMobileOpen(false)}/>
    </div>
  </div>
}
