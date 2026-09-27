import { useState } from 'react'
import type { S13Record, S13Runtime } from '../investigation/s13'
import { S13_QUERY_GROUPS, s13RecordLabel, s13VisibleRecords } from '../investigation/s13'
import type { Command, SideLeadState } from '../investigation/state'
import { ExactIdentifier } from './ExactIdentifier'
import { R55_BRCG } from '../story/r55/production'
import { selectBrcgTerminalSpeech, selectHeroTerminalSpeech } from './productionCopySelectors'

type Send = React.Dispatch<Command>

const text = (value: unknown) => value === null || value === undefined || value === '' ? 'not present in this accepted view' : String(value)

export function S13Prebrief({ runtime }: { runtime: S13Runtime }) {
  const { prebrief } = runtime
  return <section aria-label="Accepted corpus prebrief" data-testid="s13-prebrief">
    <h2>ACCEPTED CORPUS · PRE-CASE BRIEF</h2>
    <blockquote data-testid="r55-hero-prebrief">{selectHeroTerminalSpeech('PREBRIEF_INITIAL').map(line => <p key={line.copyKey}>{line.text}</p>)}</blockquote>
    <p>This overview exposes aggregate coverage only. Collect and read the official case file to unlock individual evidence.</p>
    <dl>
      <div><dt>Accepted acquisition receipts</dt><dd>{prebrief.callAtlasReceiptCount}</dd></div>
      <div><dt>Semantic records</dt><dd>{prebrief.semanticRecordCount}</dd></div>
      <div><dt>Provider response rows</dt><dd>{prebrief.providerResponseRowCount}</dd></div>
    </dl>
    <details><summary>Browse aggregate categories</summary>
      <h3>Source families</h3><ul>{Object.entries(prebrief.sourceFamilyCounts).map(([name, count]) => <li key={name}>{name}: {count}</li>)}</ul>
      <h3>Record categories</h3><ul>{Object.entries(prebrief.recordCategoryCounts).map(([name, count]) => <li key={name}>{name}: {count}</li>)}</ul>
      <p>{prebrief.attribution}. Individual records, hashes, addresses, filter predicates, proof fields, and the exact survivor remain locked.</p>
    </details>
  </section>
}

function S13RecordList({ runtime, stage, verifiedRecordId, comparison, send }: { runtime: S13Runtime; stage: number; verifiedRecordId: string | null; comparison: string[]; send: Send }) {
  const records = s13VisibleRecords(runtime, stage)
  const [shown, setShown] = useState(12)
  return records.length > 0 && <><p role="status">{records.length} matching records · {Math.min(shown, records.length)} shown</p><ol>{records.slice(0, shown).map(record => <li key={record.recordId}><article className="candidate-folder">
    <h3>{s13RecordLabel(record, runtime.caseCorpus.indexOf(record), verifiedRecordId === record.recordId)}</h3><p>Accepted record inside the current bounded result. Inspect SOURCE for provenance and claim limits.</p>
    <button onClick={() => send({ type: 'S13_SELECT_RECORD', recordId: record.recordId })}>INSPECT SOURCE · {s13RecordLabel(record, runtime.caseCorpus.indexOf(record), verifiedRecordId === record.recordId)}</button>
    {stage >= 4 && records.length > 1 && <button aria-pressed={comparison.includes(record.recordId)} onClick={() => send({ type: 'S13_COMPARE', recordId: record.recordId })}>COMPARE CANDIDATE</button>}
  </article></li>)}</ol>{shown < records.length && <button onClick={() => setShown(Math.min(records.length, shown + 12))}>SHOW MORE RECORDS</button>}</>
}

export function S13Results({ runtime, stage, verifiedRecordId, comparison, send }: { runtime: S13Runtime; stage: number; verifiedRecordId: string | null; comparison: string[]; send: Send }) {
  const group = S13_QUERY_GROUPS.find(item => item.endStage === stage)
  const compared = comparison.map(id => runtime.caseCorpus.find(record => record.recordId === id)).filter((record): record is S13Record => Boolean(record))
  if (!group) return <section aria-label="S13 query results"><h2>CANDIDATE FOLDERS</h2><p>Stage the next accepted Question Card inside CASE.</p></section>
  const stages = runtime.evidenceDelta.stages.slice(group.startStage, group.endStage)
  const heroRoute = stage <= 2 ? 'DELTA_1' : stage < runtime.evidenceDelta.stages.length ? 'DELTA_2' : 'THEORY_RESOLUTION'
  return <section aria-label="S13 query results" data-testid="s13-results"><h2>CANDIDATE FOLDERS · {group.title}</h2>
    <blockquote data-testid="r55-hero-delta" data-r55-event={heroRoute}>{selectHeroTerminalSpeech(heroRoute).map(line => <p key={line.copyKey}>{line.text}</p>)}</blockquote>
    <section aria-label="Evidence Delta" data-testid="s13-evidence-delta"><h3>EVIDENCE DELTA</h3>{stages.map((item, index) => <article key={item.semanticFilterId}><h4>ACCEPTED SUB-STAGE {group.startStage + index + 1}</h4><p>{item.previousCount === null ? 'Unframed orientation' : `${item.previousCount} previous`} → <strong>{item.newCount} records</strong></p><p>{group.subpredicateLabels[index]}</p><p>{item.includedReason}</p><p>May establish: {item.whatTheStageMayEstablish}</p><p>Cannot establish: {item.whatItCannotEstablish}</p></article>)}</section>
    <S13RecordList runtime={runtime} stage={stage} verifiedRecordId={verifiedRecordId} comparison={comparison} send={send}/>
    {compared.length === 2 && <section aria-label="S13 two-candidate Comparison Tray"><h3>COMPARE THESE TWO ROUTES</h3><table><caption>Factual S13 comparison — no confidence scores</caption><thead><tr><th>Dimension</th>{compared.map(record => <th key={record.recordId}>{s13RecordLabel(record, runtime.caseCorpus.indexOf(record), false)}</th>)}</tr></thead><tbody>{[['UTC', 'block_timestamp'], ['ROUTE', 'semanticRole'], ['EVIDENCE GRADE', 'evidenceGradeCeiling'], ['CLAIM LIMIT', 'limitation']].map(([label, field]) => <tr key={label}><th>{label}</th>{compared.map(record => <td key={record.recordId}>{text(record[field!])}</td>)}</tr>)}</tbody></table></section>}
    {stage === runtime.evidenceDelta.stages.length && <section aria-label="Surviving receipt handoff" data-testid="s13-survivor-handoff"><h2>ONE SURVIVING RECEIPT</h2><p>{verifiedRecordId ? 'The exact receipt is reducer-verified. Open CASE and file all three proof slots in Caseboard.' : 'Inspect the surviving source, then explicitly verify it. No proof slot is filled by reaching this result.'}</p></section>}
    {stage < runtime.evidenceDelta.stages.length && <button className="primary" onClick={() => send({ type: 'SECTION', section: 'CASE' })}>STAGE NEXT QUESTION IN CASE</button>}
  </section>
}

export function S13CorpusExplorer({ runtime, stage, verifiedRecordId, sideLead, comparison, send }: { runtime: S13Runtime; stage: number; verifiedRecordId: string | null; sideLead: SideLeadState; comparison: string[]; send: Send }) {
  const currentGroup = S13_QUERY_GROUPS.find(group => group.endStage === stage)
  return <section aria-label="Semantic evidence sea" data-testid="semantic-evidence-sea">
    <h2>SEMANTIC EVIDENCE SEA</h2>
    <p>EXPLORE is read-only: browse the current CASE-owned result. Stage and dispatch accepted S13 questions only through CASE and its pre-dispatch Query Receipt.</p>
    {sideLead.noteDiscovered && <S13Brcg runtime={runtime} sideLead={sideLead} send={send}/>}
    {currentGroup ? <><p>Latest CASE dispatch: {currentGroup.title} · accepted semantic stage {currentGroup.startStage + 1} through {currentGroup.endStage}.</p><S13RecordList runtime={runtime} stage={stage} verifiedRecordId={verifiedRecordId} comparison={comparison} send={send}/></> : <p>No individual records are shown until the first CASE question is reviewed and dispatched.</p>}
  </section>
}

export function S13Source({ runtime, record, verified, canVerify, send }: { runtime: S13Runtime; record: S13Record; verified: boolean; canVerify: boolean; send: Send }) {
  const receipt = record.sourcePublicCallId ? runtime.callAtlas.find(row => row.publicCallId === record.sourcePublicCallId) : undefined
  const isHero = record.recordId === runtime.proof.exactRecord.recordId
  if (isHero && !verified) return <section aria-label="Public-safe source" data-testid="s13-source">
    <h2>CANDIDATE SOURCE · SURVIVING RECORD</h2>
    <p>The candidate survived the accepted questions, but survival is not proof. Exact identifiers, decisive values, grade, and proof-slot fields remain sealed until the reducer verifies this receipt.</p>
    {receipt && <><h3>BOUND CALL ATLAS RECEIPT</h3><p>{receipt.boundedQuestion}</p><p>{receipt.claimBoundaries.join(' · ')}</p></>}
    {canVerify && <button className="primary" onClick={() => send({ type: 'S13_VERIFY_RECORD', recordId: record.recordId })}>VERIFY SURVIVING RECEIPT</button>}
  </section>
  return <section aria-label="Public-safe source" data-testid="s13-source">
    <h2>PUBLIC-SAFE SOURCE · {record.recordId}</h2>
    <dl>{Object.entries({ 'Record kind': record.recordKind, 'Semantic role': record.semanticRole, 'Evidence grade ceiling': record.evidenceGradeCeiling, 'Exact UTC': record.block_timestamp, 'Transfer amount': record.transfer_amount, 'Token address': record.token_address, 'Source address': record.from_address, 'Destination address': record.to_address, 'Full transaction hash': record.transaction_hash, Attribution: record.attribution }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{['Token address', 'Source address', 'Destination address', 'Full transaction hash'].includes(label) && value ? <ExactIdentifier label={label} value={text(value)}/> : text(value)}</dd></div>)}</dl>
    {receipt && <><h3>BOUND CALL ATLAS RECEIPT · {receipt.publicCallId}</h3><dl>{Object.entries({ 'Source campaign': receipt.sourceCampaign, 'Endpoint family': receipt.endpointFamily, 'Bounded question': receipt.boundedQuestion, Purpose: receipt.purpose, Coverage: Array.isArray(receipt.coverage) ? receipt.coverage.join(', ') : receipt.coverage, 'Evidence grade ceiling': receipt.evidenceGradeCeiling, 'Request body SHA-256': receipt.requestBodySha256, 'Response SHA-256': receipt.responseSha256, 'Normalized SHA-256': receipt.normalizedSha256 }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{text(value)}</dd></div>)}</dl><p>{receipt.claimBoundaries.join(' · ')}</p></>}
    {isHero && <p><strong>Reducer verification accepted.</strong> This receipt alone is eligible for AMOUNT, RECEIVER, and LINK; file those slots in Caseboard.</p>}
    <p>{record.limitation ?? 'Exactness of an event does not establish identity, intent, causation, common control, or ultimate destination.'}</p>
  </section>
}

export function S13CallAtlas({ runtime }: { runtime: S13Runtime }) {
  const [shown, setShown] = useState(20)
  return <section aria-label="Accepted Call Atlas" data-testid="s13-call-atlas"><h2>CALL ATLAS · ALL 101 ACCEPTED RECEIPTS</h2>
    <p>{runtime.metrics.p2r1Receipts} historical-base receipts + {runtime.metrics.e03Receipts} E03 receipts; {runtime.metrics.e03Curated} E03 curated and {runtime.metrics.e03ReceiptOnly} receipt-only. Credits: {runtime.metrics.credits}.</p>
    <ol>{runtime.callAtlas.slice(0, shown).map(receipt => <li key={receipt.publicCallId}><details><summary>{receipt.publicCallId} · {receipt.endpointFamily} · {receipt.curatedEvidenceAcceptanceStatus}</summary><p>{receipt.boundedQuestion}</p><p>Lens {receipt.lens} · purpose {receipt.purpose} · ceiling {receipt.evidenceGradeCeiling}</p><p>Acceptance: {receipt.acceptanceStatus} / {receipt.curatedEvidenceAcceptanceStatus}</p><p>Coverage: {Array.isArray(receipt.coverage) ? receipt.coverage.join(', ') : receipt.coverage}</p><p>Named consumers: {receipt.namedConsumers.join(', ') || 'receipt-only; no Case Corpus consumer'}</p><p>{receipt.claimBoundaries.join(' · ')}</p><p>Request {receipt.requestBodySha256}<br/>Response {receipt.responseSha256}<br/>Normalized {receipt.normalizedSha256}</p><p>{receipt.attribution}</p></details></li>)}</ol>
    {shown < runtime.callAtlas.length && <button onClick={() => setShown(Math.min(runtime.callAtlas.length, shown + 20))}>SHOW MORE RECEIPTS</button>}
  </section>
}

export function S13Brcg({ runtime, sideLead, send }: { runtime: S13Runtime; sideLead: SideLeadState; send: Send }) {
  return <details open data-testid="s13-brcg"><summary>TOKEN GOD MODE · BRCG</summary>
    <h3>{R55_BRCG.symbol} / {R55_BRCG.name}</h3><p>Token contract: <ExactIdentifier label="BRCG token contract" value={R55_BRCG.contract}/></p><p>Note quantity: {R55_BRCG.quantity} BRCG</p>
    {sideLead.selectedTokenId !== 'BRCG' ? <><blockquote data-testid="r55-brcg-untested">{selectBrcgTerminalSpeech('UNTESTED').map(line => <p key={line.copyKey}>{line.text}</p>)}</blockquote><button onClick={() => send({ type: 'SELECT_SIDE_TOKEN', tokenId: 'BRCG' })}>IDENTIFY BRCG</button></> : <>
      <h3>VALUE · CHECKED</h3><p>SNAPSHOT PRICE<br/>ABOUT $0.000000008 EACH</p><p>VALUE AT SNAPSHOT PRICE<br/>{R55_BRCG.summaryValue}</p><details><summary>EXACT DETAILS</summary><p>TOKEN CONTRACT<br/>{R55_BRCG.contract}</p><p>SNAPSHOT<br/>{R55_BRCG.snapshot}</p><p>EXACT UNIT PRICE<br/>{R55_BRCG.unitPrice}</p><p>THEORETICAL VALUE<br/>{R55_BRCG.theoreticalValue}</p></details>
      <section aria-label="BRCG market context"><h3>MARKET CONTEXT</h3><p>LIQUIDITY<br/>{R55_BRCG.liquidity}</p><p>LAST 7 DAYS<br/>BUYERS...................... {R55_BRCG.buyers7d}<br/>SELLERS.................... {R55_BRCG.sellers7d}<br/>TRADING VOLUME......... {R55_BRCG.volume7d}<br/>NET FLOW............... {R55_BRCG.netflow7d}</p><p>Very little recent trading. This snapshot shows sellers, but no buyers.</p><p>A snapshot price does not guarantee that a large amount can actually be sold at that price.</p><button aria-pressed={sideLead.marketContextReviewed} disabled={sideLead.marketContextReviewed} onClick={() => send({ type: 'REVIEW_BRCG_MARKET' })}>[ MARK REVIEWED ]</button></section>
      <section aria-label="BRCG proof boundary"><h3>WHAT THIS PROVES</h3><p>SUPPORTED<br/>At the snapshot price, {R55_BRCG.quantity} BRCG works out to about $7.10.</p><p>NOT SUPPORTED<br/>the note’s balance exists<br/>the balance belongs to Rook<br/>Rook can access it<br/>the full quantity can be sold for $7.10<br/>BRCG relates to Euler</p><p>THE MATH IS REAL.<br/>THE FORTUNE IS NOT ESTABLISHED.</p><button aria-pressed={sideLead.proofBoundaryReviewed} disabled={sideLead.proofBoundaryReviewed} onClick={() => send({ type: 'REVIEW_BRCG_PROOF' })}>[ MARK REVIEWED ]</button></section>
      {sideLead.resolved && <div role="status" data-testid="r55-brcg-resolved"><strong>SIDE LEAD RESOLVED<br/>{R55_BRCG.name.toUpperCase()}</strong>{selectBrcgTerminalSpeech('RESOLVED').map(line => <p key={line.copyKey}>{line.text}</p>)}</div>}
    </>}
    <p>Accepted snapshot: {runtime.brcg.snapshot.observationUtc}; {runtime.brcg.boundedNoMatch.zeroResultClass}, provider result count {runtime.brcg.boundedNoMatch.providerResultCount}. This does not establish global absence. Held E02 rows included: no.</p>
  </details>
}
