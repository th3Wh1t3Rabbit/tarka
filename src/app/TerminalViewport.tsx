import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useIntegerViewportScale } from '../controller/foundation/useIntegerViewportScale'
import type { Presentation } from '../investigation/contracts'
import { terminalAudio } from './terminalAudio'
import './terminal-viewport.css'

export function TerminalViewport({ mode, shellState, chromeSrc = null, cursorSrc = null, degauss = false, children }: { mode: Presentation; shellState: string; chromeSrc?: string | null; cursorSrc?: string | null; degauss?: boolean; children: ReactNode }) {
  const scale = useIntegerViewportScale()
  const fullscreen = mode === 'FULLSCREEN_CRT'
  const chrome = fullscreen && chromeSrc
  const [degaussing, setDegaussing] = useState(false)
  const [degaussBusy, setDegaussBusy] = useState(false)
  const [scaledCursor, setScaledCursor] = useState<{ css: string; size: number } | null>(null)
  const activation = useRef(0)
  const locked = useRef(false)
  const visualTimer = useRef<number | null>(null)
  const watchdogTimer = useRef<number | null>(null)
  useEffect(() => {
    terminalAudio.mount()
    return () => {
      terminalAudio.unmount()
    activation.current += 1
    locked.current = false
    if (visualTimer.current !== null) window.clearTimeout(visualTimer.current)
    if (watchdogTimer.current !== null) window.clearTimeout(watchdogTimer.current)
    }
  }, [])
  useEffect(() => {
    if (!fullscreen || !cursorSrc) return
    let active = true
    const image = new Image()
    image.onload = () => {
      if (!active) return
      const size = 13 * scale
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')
      if (!context) return
      context.imageSmoothingEnabled = false
      context.drawImage(image, 0, 0, size, size)
      setScaledCursor({ css: `url("${canvas.toDataURL('image/png')}") ${Math.floor(size / 2)} ${Math.floor(size / 2)}, none`, size })
    }
    image.src = cursorSrc
    return () => { active = false }
  }, [cursorSrc, fullscreen, scale])
  const runDegauss = () => {
    if (locked.current) return
    locked.current = true
    const id = ++activation.current
    let visualDone = false
    let soundDone = false
    const finish = () => {
      if (activation.current !== id || !visualDone || !soundDone) return
      locked.current = false
      setDegaussBusy(false)
    }
    const finishSound = () => {
      if (activation.current !== id || soundDone) return
      soundDone = true
      if (watchdogTimer.current !== null) { window.clearTimeout(watchdogTimer.current); watchdogTimer.current = null }
      finish()
    }
    setDegaussBusy(true)
    setDegaussing(true)
    visualTimer.current = window.setTimeout(() => {
      if (activation.current !== id) return
      visualDone = true
      setDegaussing(false)
      visualTimer.current = null
      finish()
    }, 2100)
    watchdogTimer.current = window.setTimeout(() => {
      if (activation.current !== id || soundDone) return
      finishSound()
      watchdogTimer.current = null
    }, 6000)
    void terminalAudio.manual().then(finishSound, finishSound)
  }
  return <div className={fullscreen ? 's5-viewport' : 's5-semantic-surface'} data-testid="terminal-viewport" data-logical-size="480x270" data-integer-scale={fullscreen ? scale : 'semantic-reflow'} data-cursor-size={scaledCursor?.size ?? 0} data-shell-state={shellState} data-terminal-chrome={chrome ? 'live' : 'none'} style={fullscreen ? { ['--terminal-cursor' as string]: scaledCursor?.css ?? 'none' } : undefined}>
    <div className={fullscreen ? 's5-scaled-space' : 's5-reflow-space'} style={fullscreen ? { width: 480 * scale, height: 270 * scale } : undefined}>
      <div className={`${fullscreen ? 's5-native-terminal' : 's5-reflow-terminal'}${degaussing ? ' is-degaussing' : ''}`} style={fullscreen ? { transform: `scale(${scale})` } : undefined}>
        {chrome ? <img className="s5-terminal-chrome pixel-art" alt="" src={chromeSrc} width={480} height={270} /> : <><div aria-hidden="true" hidden={!fullscreen} className="s5-shell-back"/><div aria-hidden="true" hidden={!fullscreen} className="s5-screen-mask"/><div aria-hidden="true" hidden={!fullscreen} className="s5-shell-bezel"/></>}
        {fullscreen ? <div className="s5-screen-aperture" data-testid="terminal-screen-aperture"><div className="s5-degauss-surface"><div className="s5-dom-safe" data-testid="terminal-dom-safe">{children}</div></div></div> : <div className="s5-reflow-safe" data-testid="terminal-dom-safe">{children}</div>}
        {fullscreen && degauss && <button type="button" className="s16-degauss" data-testid="s16-degauss" aria-label="Degauss terminal screen with horseshoe magnet" aria-pressed={degaussBusy} disabled={degaussBusy} onClick={runDegauss}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3v8a6 6 0 0 0 12 0V3h-4v8a2 2 0 0 1-4 0V3Z" fill="currentColor"/><path d="M4 6h4M12 6h4" stroke="#d8ceb1" strokeWidth="1.4"/></svg></button>}
      </div>
    </div>
  </div>
}
