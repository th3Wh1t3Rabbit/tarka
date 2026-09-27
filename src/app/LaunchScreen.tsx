import { useEffect, type RefObject } from 'react'
import creditsProvenance from './CREDITS_PROVENANCE.json'

function LogicalLaunchFrame({ scale, children, testId }: { scale: number; children: React.ReactNode; testId: string }) {
  return <main className="tarka-launch-shell" data-testid={testId}>
    <div className="tarka-launch-space" data-logical-size="480x270" data-integer-scale={scale} style={{ width: 480 * scale, height: 270 * scale }}>
      <section className="tarka-launch-native" style={{ transform: `scale(${scale})` }}>{children}</section>
    </div>
  </main>
}

export function TarkaTitleScreen({ scale, playRef, creditsRef, onPlay, onCredits }: {
  scale: number
  playRef: RefObject<HTMLButtonElement | null>
  creditsRef: RefObject<HTMLButtonElement | null>
  onPlay: () => void
  onCredits: () => void
}) {
  return <LogicalLaunchFrame scale={scale} testId="tarka-title-screen">
    <div className="tarka-title-copy">
      <h1>TARKA</h1>
      <p className="tarka-title-subtitle">A PIXEL RETRO<br />NANSEN INVESTIGATION</p>
      <p className="tarka-title-event">CREATED FOR THE<br /><strong>NANSEN MERIDIAN BUILDATHON</strong></p>
      <p className="tarka-title-date">SEPTEMBER 14 TO 27, 2026</p>
      <nav aria-label="Tarka title controls">
        <button ref={playRef} type="button" aria-label="PLAY" onClick={onPlay}>[ PLAY ]</button>
        <button ref={creditsRef} type="button" onClick={onCredits}>CREDITS</button>
      </nav>
      <p className="tarka-powered">POWERED BY NANSEN API</p>
    </div>
  </LogicalLaunchFrame>
}

export function TarkaCreditsScreen({ scale, onReturn }: { scale: number; onReturn: () => void }) {
  useEffect(() => {
    const returnOnBack = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'Backspace' && event.key !== 'BrowserBack') return
      event.preventDefault()
      onReturn()
    }
    window.addEventListener('keydown', returnOnBack, true)
    return () => window.removeEventListener('keydown', returnOnBack, true)
  }, [onReturn])

  return <LogicalLaunchFrame scale={scale} testId="tarka-credits-screen">
    <article className="tarka-credits" aria-labelledby="tarka-credits-title">
      <header><h1 id="tarka-credits-title">TARKA</h1><p>CREDITS</p></header>
      <section className="tarka-credits-created-by" data-testid="credits-created-by">
        <h2>CREATED BY</h2>
        <p>
          <span>{creditsProvenance.createdBy.displayName}</span>
          <span className="tarka-credits-creator-links">
            {creditsProvenance.createdBy.links.map((link, index) => <span key={link.label}>
              {index > 0 && <span aria-hidden="true"> · </span>}
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                aria-label={`${link.label} profile for ${creditsProvenance.createdBy.displayName}`}
              >{link.label}</a>
            </span>)}
          </span>
        </p>
      </section>
      <section><h2>CREATED FOR THE</h2><p>{creditsProvenance.sections.createdFor.map((line) => <span key={line}>{line}<br /></span>)}</p></section>
      <section><h2>POWERED BY NANSEN API</h2></section>
      <section data-testid="credits-contributors"><h2>CONTRIBUTORS</h2>{creditsProvenance.contributors.length > 0 && <p>{creditsProvenance.contributors.join(' · ')}</p>}</section>
      <section data-testid="credits-data-sources"><h2>DATA / SOURCES / ATTRIBUTION</h2><p>{creditsProvenance.sections.dataSources.map((line) => <span key={line}>{line}<br /></span>)}</p></section>
      <section data-testid="credits-about-title"><h2>ABOUT THE TITLE</h2><p>{creditsProvenance.sections.aboutTitle}</p></section>
      <button type="button" autoFocus onClick={onReturn}>[ RETURN ]</button>
    </article>
  </LogicalLaunchFrame>
}
