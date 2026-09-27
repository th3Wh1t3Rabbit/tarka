import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import catalog from '../../../content/parallel/narrative/S7_R2B_CONTENT_CATALOG.json'
import lineReport from '../../../content/parallel/narrative/S7_R2B_LINE_LENGTH_REPORT.json'
import { GameDialoguePresentation, type DialoguePresentationMode } from '../../../src/app/GameDialoguePresentation'
import type { SpeechLine } from '../../../src/adventure/types'
import '../../../src/styles/a0.css'
import './review.css'

const byKey = new Map(catalog.entries.map((entry) => [entry.key, entry]))
const bind = (text: string) => text.replaceAll('{EXACT_CONVERGENCE_TIME}', '11:38:11').replaceAll('{EXACT_MAIN_RECEIVER_DISPLAY}', 'Receiving Vault')
const lines: SpeechLine[] = lineReport.lines.filter((line) => line.risk === 'REVIEW_LONG_OR_RISKY').map(({ key }) => {
  const entry = byKey.get(key)!
  return { copyKey: key, speaker: entry.speaker === 'ROOK' ? 'ROOK' : entry.speaker === 'SYSTEM' ? 'SYSTEM' : 'MR_INDEX', text: bind(entry.text) }
})

export function App() {
  const [mode, setMode] = useState<DialoguePresentationMode>('FULLSCREEN_CRT')
  const [reduced, setReduced] = useState(false)
  return <main data-testid="actual-game-renderer" data-mode={mode} data-reduced={reduced}>
    <header><p>REVIEW ONLY · SHARED GAME COMPONENT</p><h1>Actual game dialogue renderer</h1><label>Presentation <select aria-label="Presentation" value={mode} onChange={(event) => setMode(event.target.value as DialoguePresentationMode)}><option>FULLSCREEN_CRT</option><option>DOCKED_OVERLAY</option><option>PLAIN_LIST</option></select></label><label><input aria-label="Reduced motion" type="checkbox" checked={reduced} onChange={(event) => setReduced(event.target.checked)}/> Reduced motion</label></header>
    <section className="actual-renderer-lines" data-mode={mode} data-reduced={reduced}>
      {lines.map((line, index) => <div className="actual-renderer-stage" key={line.copyKey}><GameDialoguePresentation line={line} visibleCharacters={line.text.length} mode={mode} reducedMotion={reduced} lineIndex={index} testId={`actual-renderer-line-${index + 1}`}/></div>)}
    </section>
  </main>
}

createRoot(document.getElementById('root')!).render(<App/>)
