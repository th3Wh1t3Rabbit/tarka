import { useEffect, useRef, useState } from 'react'
import { R55_COMPLETION, type SideLeadCompletion } from '../story/r55/production'

function ResultRow({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return <div className="s14-result-row" data-testid={testId}>
    <span>{label}</span>
    <i aria-hidden="true" />
    <strong>{value}</strong>
  </div>
}

export function S14EndingSequence({ onComplete }: { onComplete: () => void }) {
  // The office exchange already supplies the dramatic release. Move directly
  // to the full completion record instead of interposing a second, sparse
  // CASE RECORD / CASE CLOSED screen.
  const committed = useRef(false)
  useEffect(() => {
    if (committed.current) return
    committed.current = true
    onComplete()
  }, [onComplete])
  return null
}

export function S14CompletionScreen({ status, onPlayAgain, onMainMenu, onCredits }: { status: SideLeadCompletion; onPlayAgain: () => void; onMainMenu: () => void; onCredits: () => void }) {
  const [confirmReset, setConfirmReset] = useState(false)
  const playAgain = useRef<HTMLButtonElement>(null)
  if (confirmReset) return <main className="s14-completion" data-testid="s14-start-over-confirmation"><section role="dialog" aria-modal="true" aria-labelledby="start-over-title"><h1 id="start-over-title">{R55_COMPLETION.resetTitle}</h1><button autoFocus onClick={onPlayAgain}>{R55_COMPLETION.resetConfirm}</button><button onClick={() => { setConfirmReset(false); window.requestAnimationFrame(() => playAgain.current?.focus()) }}>{R55_COMPLETION.resetCancel}</button></section></main>
  return <main className="s14-completion" data-testid="s14-completion-screen"><article>
    <header className="s14-completion-title"><h1>CASE CLOSED</h1></header>
    <section className="s14-result-block" aria-label="Case results">
      <ResultRow label="EULER CASE" value="SOLVED" />
      <ResultRow label="EXACT RECEIPT" value="FOUND" />
      <ResultRow label="ROUTES" value="CONNECTED" />
    </section>
    <section className="s14-result-block s14-side-result" aria-label="Piggy bank result">
      <ResultRow label="PIGGY BANK FORTUNE" value={status === 'UNDISCOVERED' ? 'NOT FOUND' : 'DISAPPOINTING'} testId="s14-side-lead-summary" />
    </section>
    <section className="s14-result-block s14-future-result" aria-label="Future cases" data-testid="s14-mission-02-stinger">
      <ResultRow label="CASE FILE 02" value="COMING SOON???" />
      <ResultRow label="FUTURE ACCESS" value="HIGHLY UNLIKELY" />
    </section>
    <footer className="s14-completion-footer">
      <strong>{R55_COMPLETION.thanks}</strong>
      <div className="s14-completion-credits">
        <span>CREATED FOR THE NANSEN MERIDIAN BUILDATHON</span>
        <span>SEPTEMBER 14–27, 2026</span>
        <span>{R55_COMPLETION.attribution}</span>
      </div>
    </footer>
    <nav aria-label="Completion controls"><button ref={playAgain} onClick={() => setConfirmReset(true)}>[ PLAY AGAIN ]</button><button onClick={onMainMenu}>MAIN MENU</button><button onClick={onCredits}>CREDITS</button></nav>
  </article></main>
}
