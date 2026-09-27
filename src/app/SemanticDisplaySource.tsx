import type { SemanticCard } from '../investigation/semantic-ux/model'

/** Display projection only. Never receives or resolves concept/audit bodies or Hero proof. */
export function SemanticDisplaySource({card,onReturn}: {card: SemanticCard; onReturn: () => void}) {
 const d=card.display
 return <section aria-label="Semantic display-safe source" data-testid="semantic-display-source">
  <h2>{d.synthetic ? 'SYNTHETIC EXAMPLE' : 'ACCEPTED SEMANTIC DISPLAY'} · SOURCE REFERENCES</h2>
  <h3>{d.question}</h3><p>{card.boundaryLabel}</p><p>{card.statusLabel}</p>
  <p>Contextual display is not an exact Hero receipt. It cannot fill AMOUNT, RECEIVER or LINK. No private audit body is imported or resolved.</p>
  <dl><dt>Display identity</dt><dd>{d.id}</dd><dt>Concept reference</dt><dd>{d.conceptId}</dd>
   <dt>Question reference</dt><dd>{d.questionId}</dd><dt>Question Lens</dt><dd>{d.lens}</dd>
   <dt>Retrieved scope</dt><dd>{d.coverage.scope}</dd><dt>Coverage status</dt><dd>{d.coverage.status}; historical negative support: no</dd>
   <dt>Coverage cells</dt><dd>{d.coverage.cellIds.join(', ')}</dd>
   <dt>Named consumers · references only</dt><dd>{d.consumerIds.join(', ')}</dd>
  </dl><h3>CLAIM LIMITS</h3><ul>{d.claimBoundaries.map(limit=><li key={limit}>{limit}</li>)}</ul>
  <button onClick={onReturn}>BACK TO EVIDENCE SEA</button>
 </section>
}
