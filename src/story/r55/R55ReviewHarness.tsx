import { useEffect, useState } from 'react'
import { GameDialoguePresentation } from '../../app/GameDialoguePresentation'
import { advanceR55, chooseR55, createR55Session, displayedText, edgesOf, firstMultiCueNode, predicateAllows, predicateReason, r55LedgerEntry, r55Node, r55Registry, resetR55, type R55Input, type R55Session } from './engine'

const starter = firstMultiCueNode().id
const exactStates = Array.from(new Set(r55Registry.graph.nodes.filter((node) => node.kind === 'system').map((node) => node.text)))

export function R55ReviewHarness() {
  const [session, setSession] = useState<R55Session>(() => ({ ...createR55Session(starter), revealed: true }))
  const node = r55Node(session.nodeId)
  const ledger = r55LedgerEntry(node.ledgerId)
  const cue = node.cues[session.cueIndex]
  const currentEdges = edgesOf(session.nodeId)
  const step = (input: R55Input) => setSession((current) => advanceR55(current.revealed ? current : { ...current, revealed: true }, input))
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== ' ' && event.key !== 'Enter') return
      event.preventDefault()
      setSession((current) => advanceR55(current, 'keyboard'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <main data-testid="r55-review" data-production-active="0" style={{ background: '#071014', color: '#ece5cd', minHeight: '100vh', padding: 16 }}>
      <h1>R55 review</h1>
      <p data-testid="r55-entrypoint">{session.startId}</p>
      <p data-testid="r55-node">{session.nodeId}</p>
      <p data-testid="r55-source-id">{node.source.path}:{node.source.byteStart}-{node.source.byteEnd}</p>
      <p data-testid="r55-raw-sha">{ledger.rawSha256}</p>
      <pre data-testid="r55-raw-source">{ledger.rawText}</pre>
      <p data-testid="r55-section">{node.anchor}</p>
      <p data-testid="r55-state">{session.storyState ?? 'none'}</p>
      <p data-testid="r55-cue-index">{session.cueIndex}</p>
      <p data-testid="r55-cue-actor">{cue?.actor ?? 'none'}</p>
      <p data-testid="r55-clip">{cue?.selectedClip ?? ''}</p>
      <p data-testid="r55-catalog-binding">{cue ? `${cue.manifestBlob}:${cue.manifestSha256}:${cue.selectionBlob}:${cue.selectionSha256}` : 'none'}</p>
      <p data-testid="r55-effects">{session.appliedOnceIds.join(',')}</p>
      <p data-testid="r55-outgoing">{currentEdges.map((edge) => edge.kind).join(',')}</p>
      <pre data-testid="r55-selected-edge">{JSON.stringify(session.lastSelectedEdge)}</pre>
      <label>Entrypoint <select data-testid="r55-entrypoint-select" value={session.startId} onChange={(event) => setSession((current) => ({ ...current, startId: event.target.value, nodeId: event.target.value, cueIndex: 0, revealed: true, rejectedEdge: false, lastSelectedEdge: null }))}>{r55Registry.graph.entrypoints.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} [{entry.kind}]</option>)}</select></label>
      <label>Alternate state <select data-testid="r55-alternate-state" value={session.storyState ?? ''} onChange={(event) => setSession((current) => ({ ...current, initialStoryState: event.target.value || null, storyState: event.target.value || null, rejectedEdge: false }))}><option value="">none</option>{exactStates.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
      <GameDialoguePresentation
        testId="r55-text-panel"
        line={{ speaker: node.speaker === 'ARTHUR' ? 'MR_INDEX' : node.speaker === 'ROOK' ? 'ROOK' : 'SYSTEM', text: displayedText(session), copyKey: node.id }}
        visibleCharacters={session.revealed ? displayedText(session).length : 0}
        onAdvance={() => step('pointer')}
      />
      <button type="button" data-testid="r55-touch" onClick={() => step('touch')}>Touch step</button>
      <button type="button" data-testid="r55-return-entry" onClick={() => setSession((current) => ({ ...current, nodeId: current.startId, cueIndex: 0, revealed: true, rejectedEdge: false }))}>Return to entrypoint</button>
      <button type="button" data-testid="r55-reset" onClick={() => setSession({ ...resetR55(session), revealed: true })}>Reset</button>
      <ul>
        {currentEdges.filter((edge) => edge.kind === 'TOPIC_CHOICE' || edge.kind === 'TOPIC_RESPONSE').map((edge) => (
          <li key={`${edge.source}:${edge.target}:${JSON.stringify(edge.predicate)}`}>
            <button type="button" data-testid="r55-choice" disabled={!predicateAllows(session, edge.predicate)} onClick={() => setSession((current) => chooseR55(current, edge))}>
              {r55Node(edge.target).text}
            </button>
            <span data-testid="r55-option-status">{predicateAllows(session, edge.predicate) ? 'valid' : `disabled: ${predicateReason(session, edge.predicate)}`}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
