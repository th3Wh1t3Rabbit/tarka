import { useEffect, useMemo, useRef, useState } from 'react'
import type { CaseFixture } from '../investigation/contracts'
import { deriveS16TerminalContract, S16_SECTION_PURPOSES, type S16TerminalSection } from '../investigation/s16'
import { S16_OPTIONAL_QUERY_IDS, S16_QUERY_PLANS, s16AllRecords, s16ExplainRecord, s16RecordsForRun, s16TokenSymbol, type S16QueryGroup, type S16QueryId, type S16QueryPlan } from '../investigation/s16Queries'
import type { S13Record, S13Runtime } from '../investigation/s13'
import { s16RouteRecordAdmitted, type Command, type InvestigationState, type S16RecordContext } from '../investigation/state'
import { terminalHintMilestone } from '../controller/content/adapter'
import { TerminalViewport } from './TerminalViewport'
import { R55_BRCG } from '../story/r55/production'
import { prototypeAmount, prototypeDisplayDate, prototypeExploreCopy, prototypeQueryCopy, prototypeRecordRow, TERMINAL_PROTOTYPE_IDENTITY, TERMINAL_QUERY_GROUP_HINTS, TERMINAL_QUERY_GROUP_LABELS, TERMINAL_QUERY_GROUPS } from './terminalPrototypeAdapter'

type Send = React.Dispatch<Command>
type ExploreView = 'HOME' | 'ALL' | 'GROUPS' | 'QUESTIONS' | 'BRCG'
type RecordOrigin = S16RecordContext['origin']
type RecordSelection = S16RecordContext
const PAGE_SIZE = 8
const HISTORY_PAGE_SIZE = 3

interface S16TerminalProps { fixture: CaseFixture; state: InvestigationState; send: Send; onClose: () => void; onCloseCase: () => void; chromeSrc?: string | null; cursorSrc?: string | null }
const text = (value: unknown) => value === null || value === undefined || value === '' ? 'Not recorded' : String(value)
const middle = (value: unknown, head = 9, tail = 7) => { const whole = text(value); return whole.length <= head + tail + 1 ? whole : `${whole.slice(0, head)}…${whole.slice(-tail)}` }
const amount = (record: S13Record) => prototypeAmount(record)

function SectionHeading({ section }: { section: S16TerminalSection }) { return <p className="s16-section-purpose">{section === 'LEDGER' ? 'HISTORY' : section} · {S16_SECTION_PURPOSES[section]}</p> }
function Actions({ children }: { children?: React.ReactNode }) { return <div className="s16-actions">{children}</div> }
function TerminalNavigation({ sections, active, onSelect }: { sections: readonly S16TerminalSection[]; active: S16TerminalSection; onSelect: (section: S16TerminalSection) => void }) {
  return <nav className="s16-nav" aria-label="Terminal sections">{sections.map(section => <button className={active === section ? 'active' : undefined} key={section} type="button" data-testid={`terminal-section-${section === 'LEDGER' ? 'history' : section.toLowerCase()}`} aria-current={active === section ? 'page' : undefined} onClick={() => onSelect(section)}>{section === 'LEDGER' ? 'HISTORY' : section}</button>)}</nav>
}
function TerminalTaskBar({ task, thread, actions }: { task: string; thread: string; actions?: React.ReactNode }) { return <div className="s16-taskbar" data-testid="s16-taskbar"><div className="s16-task-left"><div className="s16-task-title">{task}</div><div className="s16-task-sub">{thread}</div></div><div className="s16-right-slot">{actions}</div></div> }

function Paginator({ page, count, onPage }: { page: number; count: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const range = count ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, count)} of ${count}` : '0 matches'
  return <div className="s16-page-nav"><button type="button" className="secondary" disabled={page <= 0} onClick={() => onPage(page - 1)}>PREV</button><span className="s16-page-count">{range} · {page + 1}/{pages}</span><button type="button" className="secondary" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>NEXT</button></div>
}

function RecordRows({ records, page, onOpen }: { records: readonly S13Record[]; page: number; onOpen: (record: S13Record) => void }) {
  return <><div className="s16-table-head" aria-hidden="true"><span>TIME</span><span>TOKEN</span><span>SENDER → RECEIVER</span></div><div className="s16-record-list">{records.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(record => {
    const row = prototypeRecordRow(record)
    return <button type="button" className="s16-record-row" data-record-id={row.id} key={row.id} onClick={() => onOpen(record)} aria-label={row.accessibleLabel}><span>{row.time}</span><span className="s16-asset">{row.token}</span><span>{row.route}</span></button>
  })}</div></>
}

function BrcgSurface({ state, send, page, onPage, onBack }: { state: InvestigationState; send: Send; page: number; onPage: (page: number) => void; onBack: () => void }) {
  if (state.sideLead.selectedTokenId !== 'BRCG') return <div className="s16-brcg-screen s16-brcg-intro">
    <div className="s16-brcg-content">
      <p className="s16-kicker">OFFICE-NOTE TOKEN LEAD</p>
      <h2>{R55_BRCG.name}</h2>
      <p className="s16-compact">Identify the token written on the recovered note, then test what its frozen market snapshot actually supports. This lead never changes the Euler proof.</p>
      <dl className="s16-fields s16-brcg-fields">
        <dt>TOKEN</dt><dd>BRCG</dd>
        <dt>CONTRACT</dt><dd className="s16-full-id">{R55_BRCG.contract}</dd>
        <dt>SCOPE</dt><dd>Office exploration · separate from the Euler case</dd>
      </dl>
    </div>
    <div className="s16-brcg-actions"><button type="button" className="secondary" onClick={onBack}>← EXPLORE</button><button type="button" className="primary" onClick={() => send({ type: 'SELECT_SIDE_TOKEN', tokenId: 'BRCG' })}>IDENTIFY BRCG</button></div>
  </div>

  return <div className="s16-brcg-screen" data-brcg-page={page + 1}>
    <p className="s16-kicker">BRCG · TOKEN GOD MODE · PAGE {page + 1}/2</p>
    <div className="s16-brcg-content">
      {page === 0 ? <div className="s16-brcg-detail">
        <div className="s16-brcg-summary">
          <div><b>NOTE BALANCE</b><span>{R55_BRCG.quantity} BRCG</span></div>
          <div><b>SNAPSHOT VALUE</b><span>{R55_BRCG.summaryValue}</span></div>
        </div>
        <dl className="s16-brcg-market">
          <dt>SNAPSHOT</dt><dd>{R55_BRCG.snapshot}</dd>
          <dt>UNIT PRICE</dt><dd>{R55_BRCG.unitPrice}</dd>
          <dt>LIQUIDITY</dt><dd>{R55_BRCG.exactLiquidity}</dd>
          <dt>7-DAY ACTIVITY</dt><dd>{R55_BRCG.buyers7d} buyers · {R55_BRCG.sellers7d} sellers · {R55_BRCG.volume7d} volume · {R55_BRCG.netflow7d} net flow</dd>
        </dl>
        <p className="s16-brcg-reading"><b>READING</b><span>No buyers, 22 sellers, and $13.16 in weekly volume: very little active demand.</span><span>The quote does not prove the full balance could be sold at that price.</span></p>
      </div> : <div className="s16-brcg-detail s16-brcg-boundary">
        <div><b>SUPPORTED BY THE SNAPSHOT</b><span>{R55_BRCG.quantity} BRCG × {R55_BRCG.unitPrice} = ABOUT $7.10.</span></div>
        <div className="s16-brcg-unknowns"><b>WHAT THE NOTE DOESN’T TELL US</b><span>Does the balance still exist?</span><span>Who controls it?</span><span>Could that many tokens actually be sold?</span></div>
        <div className="s16-brcg-conclusion"><b>THE VERDICT</b><span>Eight hundred eighty-eight million tokens sound impressive.</span><span>At this snapshot, they buy roughly one cheap lunch...not a fortune.</span></div>
      </div>}
    </div>
    <div className="s16-brcg-actions">
      <button type="button" className="secondary" onClick={onBack}>← EXPLORE</button>
      {page === 0
        ? <button type="button" className="primary" onClick={() => { if (!state.sideLead.marketContextReviewed) send({ type: 'REVIEW_BRCG_MARKET' }); onPage(1) }}>WHAT DOES THIS MEAN? →</button>
        : <><button type="button" className="secondary" onClick={() => onPage(0)}>← SNAPSHOT</button><button type="button" className="primary" disabled={state.sideLead.proofBoundaryReviewed} onClick={() => send({ type: 'REVIEW_BRCG_PROOF' })}>{state.sideLead.proofBoundaryReviewed ? 'FINDING FILED' : 'FILE BRCG FINDING'}</button></>}
    </div>
  </div>
}

function QueryReceipt({ plan, inputCount }: { plan: S16QueryPlan; inputCount: number }) {
  const copy = prototypeQueryCopy(plan)
  const hint = plan.id === 'Q3'
    ? 'This tests the connection, not who owns either address.'
    : plan.mode === 'GUIDED'
      ? 'Both clues must match. No hidden conditions.'
      : 'Your case progress is kept. Results also appear in HISTORY.'
  return <div className="s16-data-stack" data-testid="pre-dispatch-query-receipt" aria-label="Build query">
    <h2 style={{ fontSize: '9px' }}>{copy.title}</h2>
    <dl className="s16-fields">
      <dt>SEARCH</dt><dd>{inputCount} records</dd>
      <dt>CONDITIONS</dt><dd>{copy.conditions.map((condition, index) => <span key={condition}>{index > 0 && <br/>}{condition}</span>)}</dd>
      <dt>WILL SHOW</dt><dd>{copy.expected}</dd>
    </dl>
    <p className="s16-hint">{hint}</p>
  </div>
}

function SourceSurface({ runtime, record, selection, fileRead, canVerify, verified, savedKind, bothSaved, onVerify, onAddStart, onAddRoute, onViewEarlier, onOpenMatching, onCheckConnection }: { runtime: S13Runtime; record: S13Record; selection: RecordSelection; fileRead: boolean; canVerify: boolean; verified: boolean; savedKind: 'START' | 'ROUTE' | null; bothSaved: boolean; onVerify: () => void; onAddStart?: () => void; onAddRoute?: () => void; onViewEarlier?: () => void; onOpenMatching?: () => void; onCheckConnection?: () => void }) {
  const receipt = runtime.callAtlas.find(item => item.caseCorpusRecordIds.includes(record.recordId) && (!record.sourcePublicCallId || item.publicCallId === record.sourcePublicCallId))
  if (selection.sourcePage === 0) {
    const exact = record.recordId === runtime.proof.exactRecord.recordId
    const early = record.evidenceId === 'EXACT_EARLY_NET'
    const supporting = record.recordId === runtime.proof.contextualCorroboration.recordId
    const explanation = s16ExplainRecord(runtime, record, fileRead)
    const shows = early && fileRead ? 'The DAI first arrived at the destination shown above. The case calls this address First Engine.' : exact && fileRead ? 'The sender is First Engine and the destination is the address nicknamed Receiving Vault.' : supporting && fileRead ? 'Another view of the same later transaction—not an extra payment or independent confirmation.' : explanation.shows
    const limits = early && fileRead ? 'First Engine is a short name for the address, not the name of its owner.' : (exact || supporting) && fileRead ? 'Receiving Vault is an address nickname. This does not identify either controller, prove intent, or show where value went afterward.' : explanation.limits
    const addressed = (value: string | null | undefined, label = '', linked = false) => <><span className={linked ? 's16-linked-address' : undefined}>{middle(value ?? '', 11, 6)}</span>{label && <> <span className="s16-alias">· {label}</span></>}</>
    const sender = addressed(record.from_address, fileRead && (exact || supporting) ? 'First Engine' : '', fileRead && (exact || supporting))
    const receiver = addressed(record.to_address, fileRead && early ? 'First Engine' : fileRead && (exact || supporting) ? 'Receiving Vault' : '', fileRead && early)
    let action = onAddStart ? <button type="button" className="primary" onClick={onAddStart}>SAVE TO CASE</button>
      : onAddRoute ? <button type="button" className="primary" onClick={onAddRoute}>SAVE TO CASE</button>
        : canVerify ? <button type="button" className="primary" disabled={verified} onClick={onVerify}>{verified ? 'CONNECTION VERIFIED' : 'CONFIRM CONNECTION'}</button>
          : onOpenMatching ? <button type="button" className="primary" onClick={onOpenMatching}>{verified ? 'CASE REPORT' : 'OPEN TRANSACTION'}</button>
            : onViewEarlier ? <button type="button" className="primary" onClick={onViewEarlier}>VIEW EARLIER TRANSFER</button> : null
    let actionHint = onAddStart ? 'Save the first transfer for comparison.'
      : onAddRoute ? 'Save this possible connection for testing.'
        : canVerify ? 'Use this transaction as the link in your case report.'
          : onOpenMatching ? 'Both clues are saved. Test the connection in the transaction record.'
            : onViewEarlier ? 'Compare this sender with the receiver in the earlier transfer.' : ''
    let status: React.ReactNode = null
    if (verified) {
      action = null
      actionHint = ''
      status = exact
        ? <p className="s16-saved-state">Connection confirmed · used in your case report.</p>
        : supporting
          ? <p className="s16-hint">Supporting entry only. The transaction record confirmed the connection.</p>
          : early
            ? <p className="s16-saved-state">First transfer saved in CASE.</p>
            : null
    } else if (savedKind && !canVerify) {
      actionHint = ''
      if (bothSaved) {
        status = <p className="s16-saved-state">Both clues saved in CASE. Now test the connection.</p>
        action = onOpenMatching
          ? <button type="button" className="primary" onClick={onOpenMatching}>OPEN TRANSACTION</button>
          : onCheckConnection
            ? <button type="button" className="primary" onClick={onCheckConnection}>CHECK CONNECTION</button>
            : null
      } else {
        action = null
        status = <><p className="s16-saved-state">Saved to CASE.</p><p className="s16-hint">{savedKind === 'START' ? 'Use NEXT to compare the later sender with this receiver.' : 'Use PREV to compare this sender with the earlier receiver.'}</p></>
      }
    }
    return <div className="s16-data-stack s16-record-summary">
      <div className="s16-record-overview"><dl className="s16-fields s16-summary-fields"><dt>AMOUNT</dt><dd>{amount(record)}</dd><dt>SENDER</dt><dd>{sender}</dd><dt>RECEIVER</dt><dd>{receiver}</dd></dl></div>
      {fileRead && early ? <div className="s16-guide"><p><b>Follow the receiver.</b> Does it send DAI in a later record?</p><p className="s16-hint">First Engine is this address’s nickname in the case.<br/>It is not the name of its owner.</p></div>
        : fileRead && (exact || supporting) ? <div className="s16-guide"><p><b>The later sender matches the earlier receiver:</b> First Engine.</p><p className="s16-hint">{exact ? <>The amount is about the same; the time is later.<br/>Receiving Vault is the destination’s case nickname.</> : <>This entry shares the later transaction’s reference.<br/>It is another view, not another payment.</>}</p></div>
          : <div className="s16-meaning" data-explanation-rule={explanation.rule}><section><strong>WHAT IT SHOWS</strong><p>{shows}</p></section><section><strong>WHAT IT DOESN’T SHOW</strong><p>{limits}</p></section></div>}
      {(status || action) && <div className="s16-case-save"><div className="s16-case-save-copy">{status}{actionHint && <p className="s16-hint">{actionHint}</p>}</div>{action && <div className="s16-body-action">{action}</div>}</div>}
    </div>
  }
  const sourcePage = selection.sourcePage
  if (sourcePage === 1) return <div className="s16-data-stack"><p className="s16-kicker">TRANSACTION DETAILS</p><dl className="s16-fields s16-source-fields"><dt>WHEN</dt><dd>{prototypeDisplayDate(record.block_timestamp)}</dd><dt>TOKEN</dt><dd>{s16TokenSymbol(record)}</dd><dt>AMOUNT</dt><dd>{amount(record)}</dd><dt>FROM</dt><dd className="s16-full-id">{text(record.from_address)}</dd><dt>TO</dt><dd className="s16-full-id">{text(record.to_address)}</dd><dt>TX HASH</dt><dd className="s16-full-id">{text(record.transaction_hash)}</dd></dl></div>
  if (sourcePage === 2) return receipt ? <div className="s16-data-stack"><p className="s16-kicker">NANSEN TRANSFER RECORD</p><dl className="s16-fields s16-source-fields"><dt>NETWORK</dt><dd>Ethereum</dd><dt>API</dt><dd className="s16-full-id">POST /api/v1/tgm/transfers</dd><dt>TOKEN</dt><dd>{s16TokenSymbol(record)}</dd><dt>CONTRACT</dt><dd className="s16-full-id">{text(record.token_address)}</dd><dt>WHEN</dt><dd>{prototypeDisplayDate(record.block_timestamp)}</dd></dl></div> : <div className="s16-data-stack"><p className="s16-kicker">CASE TRANSACTION</p><dl className="s16-fields s16-source-fields"><dt>NETWORK</dt><dd>Ethereum</dd><dt>TOKEN</dt><dd>{s16TokenSymbol(record)}</dd><dt>CONTRACT</dt><dd className="s16-full-id">{text(record.token_address)}</dd><dt>WHEN</dt><dd>{prototypeDisplayDate(record.block_timestamp)}</dd></dl><p className="s16-compact">A transaction traced in the Euler case. Related entries are separate views, not additional transactions.</p></div>
  return <div className="s16-data-stack"><p className="s16-kicker">SAVED TRANSACTION FIELDS</p><pre className="s16-source-json">{JSON.stringify({ block_timestamp: record.block_timestamp, token_address: record.token_address, transfer_amount: record.transfer_amount, from_address: record.from_address, to_address: record.to_address, transaction_hash: record.transaction_hash }, null, 1)}</pre></div>
}

function PrototypeProof({ fixture }: { fixture: CaseFixture }) {
  const exact = fixture.s13!.proof.exactRecord
  return <div className="s16-proof-grid">
    <div className="s16-proof-line"><b>AMOUNT</b><span>{amount(exact)}</span></div>
    <div className="s16-proof-line"><b>RECEIVER</b><span>Receiving Vault</span></div>
    <div className="s16-proof-line"><b>LINK</b><span>First Engine → Receiving Vault<br/>11:38:11 UTC transaction</span></div>
  </div>
}

function CompletionSurface({ fixture, confirming, onConfirmingChange, onCloseCase }: { fixture: CaseFixture; confirming: boolean; onConfirmingChange: (confirming: boolean) => void; onCloseCase: () => void }) {
  const [committed, setCommitted] = useState(false)
  const closeButton = useRef<HTMLButtonElement>(null)
  const restore = useRef(false)
  useEffect(() => { if (!confirming && restore.current) { restore.current = false; closeButton.current?.focus() } }, [confirming])
  if (confirming) return <div className="s16-narrative s16-narrative-tight" role="dialog" aria-modal="true" aria-label="CLOSE THE EULER CASE?"><h2 id="close-case-title">THE FIRST TRAIL JOINED<br/>THE SECOND ROUTE.</h2><p className="s16-compact">The records establish that connection.<br/>They do not identify the people behind it,<br/>their intent, coordination, or all later destinations.</p><p className="s16-hint">Keep investigating, or close the case with this conclusion.</p><div className="s16-inline-options"><button type="button" className="secondary" onClick={() => { restore.current = true; onConfirmingChange(false) }}>KEEP INVESTIGATING</button><button type="button" className="primary" disabled={committed} onClick={() => { if (!committed) { setCommitted(true); onCloseCase() } }}>CLOSE CASE</button></div></div>
  return <div className="s16-report" data-testid="bounded-case-complete"><PrototypeProof fixture={fixture}/><p className="s16-hint">The first trail joined the second route.</p><div className="s16-body-action"><button ref={closeButton} type="button" className="primary" onClick={() => onConfirmingChange(true)}>CLOSE CASE</button></div></div>
}

export function S16Terminal({ fixture, state, send, onClose, onCloseCase, chromeSrc = null, cursorSrc = null }: S16TerminalProps) {
  const runtime = fixture.s13
  if (!runtime) throw new Error('S16Terminal requires the accepted runtime')
  const contract = useMemo(() => deriveS16TerminalContract(fixture, state), [fixture, state])
  const exploreCopy = prototypeExploreCopy(contract.fileRead, contract.searchableRecords.length)
  const [draft, setDraft] = useState<{ planId: S16QueryId; returnView: ExploreView } | null>(null)
  const [exploreView, setExploreView] = useState<ExploreView>('HOME')
  const [group, setGroup] = useState<S16QueryGroup>('WHAT')
  const [historyPage, setHistoryPage] = useState(0)
  const [brcgPage, setBrcgPage] = useState(0)
  const [resultOverview, setResultOverview] = useState(true)
  const [closeConfirming, setCloseConfirming] = useState(false)
  const [signalJitter, setSignalJitter] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [contract.section, contract.screen])
  useEffect(() => {
    let cancelled = false
    let onset = 0
    let release = 0
    const schedule = () => {
      onset = window.setTimeout(() => {
        if (cancelled) return
        setSignalJitter(true)
        release = window.setTimeout(() => {
          if (cancelled) return
          setSignalJitter(false)
          schedule()
        }, 150)
      }, 4200 + Math.random() * 7200)
    }
    schedule()
    return () => { cancelled = true; window.clearTimeout(onset); window.clearTimeout(release) }
  }, [])
  const selectedRun = contract.selectedRun
  const selection = state.s16RecordContext
  const visibleSelection = selection && ((selection.origin.kind === 'RUN' && contract.section === 'RESULTS') || (selection.origin.kind === 'ALL' && contract.section === 'EXPLORE') || (selection.origin.kind === 'REPORT' && contract.section === 'CASE')) ? selection : null
  const selectedRecord = selection ? runtime.caseCorpus.find(record => record.recordId === selection.recordId) ?? null : null
  const setSection = (section: S16TerminalSection) => {
    setDraft(null)
    if (selection) send({ type: 'S16_CLOSE_RECORD' })
    if (section === 'EXPLORE') setExploreView('HOME')
    if (section === 'RESULTS') setResultOverview(true)
    send({ type: 'SECTION', section })
  }
  const openBrcgLead = () => {
    setDraft(null)
    if (selection) send({ type: 'S16_CLOSE_RECORD' })
    setExploreView('BRCG')
    setBrcgPage(0)
    send({ type: 'SECTION', section: 'EXPLORE' })
  }
  const pageFor = (key: string) => state.s16Pages[key] ?? 0
  const updatePage = (key: string, page: number) => send({ type: 'S16_SET_PAGE', key, page: Math.max(0, page) })
  const openRecord = (record: S13Record, origin: RecordOrigin) => send({ type: 'S16_OPEN_RECORD', recordId: record.recordId, origin })
  const backToRows = () => { const id = selection?.recordId; send({ type: 'S16_CLOSE_RECORD' }); if (id) window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-record-id="${id}"]`)?.focus()) }
  const availableOptional = S16_OPTIONAL_QUERY_IDS.map(id => S16_QUERY_PLANS[id]).filter(plan => plan.gate === 'FILE' || (plan.gate === 'START' && state.s16StartAdded) || (plan.gate === 'ROUTE' && state.s16RouteAdded))
  const availableGroups = TERMINAL_QUERY_GROUPS.filter(item => availableOptional.some(plan => plan.group === item))
  const q2 = state.s16Runs.find(run => run.planId === 'Q2' && run.mode === 'GUIDED')
  const q3 = state.s16Runs.find(run => run.planId === 'Q3' && run.mode === 'GUIDED')
  const early = runtime.caseCorpus.find(record => record.evidenceId === 'EXACT_EARLY_NET')
  const exact = runtime.proof.exactRecord
  const selectionOrigin = selection?.origin ?? null
  const selectionRun = selectionOrigin?.kind === 'RUN' ? state.s16Runs.find(item => item.id === selectionOrigin.runId) : null
  const selectionRecords = selectionOrigin?.kind === 'ALL' ? s16AllRecords(runtime) : selectionOrigin?.kind === 'REPORT' ? [exact] : selectionRun ? s16RecordsForRun(runtime, selectionRun) : []
  const selectionIndex = selectedRecord ? selectionRecords.findIndex(item => item.recordId === selectedRecord.recordId) : -1
  const moveSelectedRecord = (direction: -1 | 1) => {
    if (!selectionOrigin || selectionOrigin.kind === 'REPORT') return
    const nextIndex = selectionIndex + direction
    const next = selectionRecords[nextIndex]
    if (!next) return
    const page = Math.floor(nextIndex / PAGE_SIZE)
    const key = selectionOrigin.kind === 'ALL' ? 'ALL' : selectionOrigin.runId
    updatePage(key, page)
    send({ type: 'S16_OPEN_RECORD', recordId: next.recordId, origin: selectionOrigin.kind === 'ALL' ? { kind: 'ALL', page } : { kind: 'RUN', runId: selectionOrigin.runId, page } })
  }
  const openExistingQ3 = () => {
    if (!q3) return
    if (state.s13VerifiedRecordId) {
      if (state.s16RecordContext) send({ type: 'S16_CLOSE_RECORD' })
      send({ type: 'SECTION', section: 'CASE' })
      return
    }
    send({ type: 'S16_OPEN_RECORD', recordId: exact.recordId, origin: { kind: 'RUN', runId: q3.id, page: 0 } })
  }
  const runDraft = () => {
    if (!draft) return
    setResultOverview(true)
    send({ type: 'S16_RUN_QUERY', planId: draft.planId, semantics: 'R2', origin: 'CURRENT' })
    setDraft(null)
  }
  const renderRows = (records: readonly S13Record[], key: string, origin: (page: number) => RecordOrigin) => {
    const maxPage = Math.max(0, Math.ceil(records.length / PAGE_SIZE) - 1)
    const page = Math.min(pageFor(key), maxPage)
    if (!records.length) return <div className="s16-empty"><h2>NO MATCHES IN THESE CASE RECORDS.</h2><p>This does not establish that no such activity happened elsewhere.</p></div>
    return <RecordRows records={records} page={page} onOpen={record => openRecord(record, origin(page))}/>
  }
  const renderSelection = () => {
    if (!selection || !selectedRecord) return null
    const q2Match = q2?.matchingIds.includes(selectedRecord.recordId)
    const fromQ2 = selection.origin.kind === 'RUN' && selection.origin.runId === q2?.id
    const fromQ3 = selection.origin.kind === 'RUN' && selection.origin.runId === q3?.id
    const laterRoute = Boolean(q2 && s16RouteRecordAdmitted(fixture, state, q2.id, selectedRecord.recordId))
    const canVerify = Boolean(fromQ3 && q3?.matchingIds.includes(selectedRecord.recordId) && selectedRecord.recordId === exact.recordId && state.s16StartAdded && state.s16RouteAdded)
    const addStart = fromQ2 && selectedRecord.recordId === early?.recordId && !state.s16StartAdded && q2 ? { onAddStart: () => send({ type: 'S16_ADD_START', runId: q2.id, recordId: selectedRecord.recordId }) } : {}
    const addRoute = fromQ2 && laterRoute && !state.s16RouteAdded && q2 ? { onAddRoute: () => send({ type: 'S16_ADD_ROUTE', runId: q2.id, recordId: selectedRecord.recordId }) } : {}
    const viewEarlier = fromQ2 && q2Match && selectedRecord.recordId !== early?.recordId && !state.s16StartAdded && early && q2 ? { onViewEarlier: () => send({ type: 'S16_OPEN_RECORD', recordId: early.recordId, origin: { kind: 'RUN', runId: q2.id, page: 0 } }) } : {}
    const openMatching = fromQ2 && q3 && laterRoute ? { onOpenMatching: openExistingQ3 } : {}
    const savedKind = selectedRecord.recordId === early?.recordId && state.s16StartAdded ? 'START' : laterRoute && state.s16RouteAdded ? 'ROUTE' : null
    const checkConnection = fromQ2 && state.s16StartAdded && state.s16RouteAdded && !q3 ? { onCheckConnection: () => { setResultOverview(true); setDraft({ planId: 'Q3', returnView: 'HOME' }); send({ type: 'SECTION', section: 'CASE' }) } } : {}
    return <SourceSurface runtime={runtime} record={selectedRecord} selection={selection} fileRead={contract.fileRead} canVerify={canVerify} verified={state.s13VerifiedRecordId === exact.recordId} savedKind={savedKind} bothSaved={state.s16StartAdded && state.s16RouteAdded} {...addStart} {...addRoute} {...viewEarlier} {...openMatching} {...checkConnection} onVerify={() => { if (q3) send({ type: 'S16_VERIFY_CONNECTION', runId: q3.id, recordId: selectedRecord.recordId }) }}/>
  }
  const renderCase = () => {
    if (!contract.fileRead) return <div className="s16-welcome"><h2>Terminal access authorized.</h2><div className="s16-welcome-copy"><p>Rook still needs the Euler case file.</p><p className="s16-hint">Browse the records now or return to the office and read the file first.</p></div></div>
    if (state.complete) return <CompletionSurface fixture={fixture} confirming={closeConfirming} onConfirmingChange={setCloseConfirming} onCloseCase={onCloseCase}/>
    if (state.s13VerifiedRecordId) return <div className="s16-report"><PrototypeProof fixture={fixture}/><p className="s16-hint">Save these three facts as the evidence for your conclusion.</p><div className="s16-body-action"><button type="button" className="primary" onClick={() => { send({ type: 'S16_FILE_FINDINGS' }); setCloseConfirming(true) }}>SAVE CASE</button></div></div>
    if (q3) return <><SectionHeading section="CASE"/><p className="s16-kicker">CONNECTION QUERY COMPLETE · 3 → 2 → 1</p><h2>ONE EXACT TRANSACTION MATCHED.</h2><p>Open the surviving transaction and verify the connection explicitly.</p><Actions><button type="button" className="primary" onClick={() => send({ type: 'S16_OPEN_RECORD', recordId: exact.recordId, origin: { kind: 'RUN', runId: q3.id, page: 0 } })}>OPEN TRANSACTION</button></Actions></>
    if (state.s16StartAdded && state.s16RouteAdded) return <div className="s16-narrative s16-narrative-tight"><h2>Did the DAI move onward?</h2><p>Check the transaction from First Engine<br/>to Receiving Vault.</p><div className="s16-body-action"><button type="button" className="primary" onClick={() => setDraft({ planId: 'Q3', returnView: 'HOME' })}>BUILD CONNECTION QUERY</button></div></div>
    if (state.s16RouteAdded) return <><SectionHeading section="CASE"/><p className="s16-kicker">LATER VIEW SAVED</p><h2>NOW SAVE THE EARLIER TRANSFER.</h2><p>The possible route is related, not proved. Both separate clues are required.</p><Actions><button type="button" className="primary" onClick={() => { if (q2 && early) { send({ type: 'S16_SELECT_RUN', runId: q2.id }); openRecord(early, { kind: 'RUN', runId: q2.id, page: 0 }) } }}>OPEN EARLIEST TRANSFER</button></Actions></>
    if (state.s16StartAdded) return <><SectionHeading section="CASE"/><p className="s16-kicker">FOLLOW THE FIRST ENGINE</p><h2>WHERE DOES THE ROUTE GO NEXT?</h2><p>Review the later transaction record and its supporting view in the saved matches.</p><Actions><button type="button" className="primary" onClick={() => { if (q2) send({ type: 'S16_SELECT_RUN', runId: q2.id }) }}>OPEN LATER TRANSFER</button></Actions></>
    if (q2) return <div className="s16-narrative"><h2>Start with the earliest transfer.</h2><p>Follow its receiver into the later records.<br/>Do you see the same address as their sender?</p><div className="s16-body-action"><button type="button" className="primary" onClick={() => { setResultOverview(false); send({ type: 'S16_SELECT_RUN', runId: q2.id }) }}>VIEW 3 MATCHES</button></div></div>
    return <div className="s16-narrative"><h2>Which DAI transfers match the amount in the file?</h2><p>The file identifies DAI and about 8.88 million.<br/>Use both clues to narrow the records.</p><div className="s16-body-action"><button type="button" className="primary" onClick={() => setDraft({ planId: 'Q2', returnView: 'HOME' })}>BUILD QUERY</button></div></div>
  }
  const renderResults = () => {
    if (visibleSelection) return renderSelection()
    if (!selectedRun) return <><SectionHeading section="RESULTS"/><h2>NO QUERY SELECTED.</h2><p>Run a case or optional question, or reopen one from History.</p></>
    const records = s16RecordsForRun(runtime, selectedRun)
    if (selectedRun.id === q2?.id) {
      if (resultOverview) return <div className="s16-narrative s16-narrative-tight s16-guidance-centered">
        <div className="s16-small-metrics">{selectedRun.countStages.map((count, index) => <span className="s16-metric-fragment" key={`${count}-${index}`}>{index > 0 && <span className="s16-metric-arrow" aria-hidden="true">→</span>}<span className="s16-metric-cell">{count}<small>{['RECORDS', 'DAI', 'AMOUNT MATCHES'][index]}</small></span></span>)}</div>
        <p className="s16-two-step"><b>The three records describe two steps:</b><br/>an earlier transfer and two views of one later movement.</p>
        <p className="s16-hint">Compare where the DAI arrived with where it later left.</p>
        <div className="s16-body-action"><button type="button" className="primary" onClick={() => setResultOverview(false)}>VIEW 3 MATCHES</button></div>
      </div>
      const openAnalyze = () => {
        if (!state.s16StartAdded && early) openRecord(early, { kind: 'RUN', runId: selectedRun.id, page: 0 })
        else if (!state.s16RouteAdded) openRecord(exact, { kind: 'RUN', runId: selectedRun.id, page: 0 })
        else if (q3) openExistingQ3()
        else { send({ type: 'SECTION', section: 'CASE' }); setDraft({ planId: 'Q3', returnView: 'HOME' }) }
      }
      const analyzeLabel = !state.s16StartAdded ? 'OPEN EARLIEST TRANSFER' : !state.s16RouteAdded ? 'OPEN LATER TRANSFER' : q3 ? state.s13VerifiedRecordId ? 'CASE REPORT' : 'OPEN TRANSACTION' : 'BUILD CONNECTION QUERY'
      return <div className="s16-match-list-wrap"><div className="s16-case-matches">{records.map(record => {
        const isEarly = record.recordId === early?.recordId
        const isExact = record.recordId === exact.recordId
        const isSupport = record.recordId === runtime.proof.contextualCorroboration.recordId
        const saved = isEarly ? state.s16StartAdded : record.recordId === state.s16RouteRecordId
        const related = state.s16RouteAdded && (isExact || isSupport) && !saved
        const label = isEarly ? 'Earlier transfer' : isExact ? 'Later transfer · transaction' : 'Later transfer · supporting entry'
        return <button type="button" className="s16-record-row s16-match-row" data-record-id={record.recordId} data-case-state={saved ? 'SAVED' : related ? 'RELATED' : 'UNSAVED'} key={record.recordId} onClick={() => openRecord(record, { kind: 'RUN', runId: selectedRun.id, page: 0 })} aria-label={`Open record. ${text(record.block_timestamp)}. ${label}. ${text(record.from_address)} to ${text(record.to_address)}.`}><b>{prototypeRecordRow(record).time} · {s16TokenSymbol(record)}</b><span>{label}</span><em>{saved ? 'SAVED' : related ? 'RELATED' : 'OPEN'}</em></button>
      })}</div><p className="s16-match-guide">Compare the earlier receiver with the later sender.</p><div className="s16-body-action"><button type="button" className="primary" aria-label={analyzeLabel} onClick={openAnalyze}>{state.s16StartAdded && state.s16RouteAdded ? q3 ? 'OPEN TRANSACTION' : 'CHECK CONNECTION' : 'ANALYZE'}</button></div></div>
    }
    if (selectedRun.id === q3?.id && resultOverview) return <div className="s16-narrative s16-narrative-tight s16-guidance-centered">
      <div className="s16-small-metrics">{selectedRun.countStages.map((count, index) => <span className="s16-metric-fragment" key={`${count}-${index}`}>{index > 0 && <span className="s16-metric-arrow" aria-hidden="true">→</span>}<span className="s16-metric-cell">{count}<small>{['AMOUNT MATCHES', 'ROUTE VIEWS', 'TRANSACTION'][index]}</small></span></span>)}</div>
      <p className="s16-compact"><b>The transaction connects the two addresses.</b><br/>Check it before using it in your case report.</p>
      <div className="s16-body-action"><button type="button" className="primary" onClick={() => openRecord(exact, { kind: 'RUN', runId: selectedRun.id, page: 0 })}>OPEN TRANSACTION</button></div>
    </div>
    return <>{renderRows(records, selectedRun.id, page => ({ kind: 'RUN', runId: selectedRun.id, page }))}</>
  }
  const renderExplore = () => {
    if (visibleSelection) return renderSelection()
    if (draft) { const plan = S16_QUERY_PLANS[draft.planId]; const inputCount = draft.planId === 'Q3' ? q2?.matchingIds.length ?? 0 : contract.searchableRecords.length; return <QueryReceipt plan={plan} inputCount={inputCount}/> }
    if (exploreView === 'ALL') return <>{renderRows(contract.searchableRecords, 'ALL', page => ({ kind: 'ALL', page }))}</>
    if (exploreView === 'BRCG') return <BrcgSurface state={state} send={send} page={brcgPage} onPage={setBrcgPage} onBack={() => setExploreView('HOME')}/>
    if (exploreView === 'QUESTIONS') return <div className="s16-choice-stack">{availableOptional.filter(plan => plan.group === group).map(plan => { const copy = prototypeQueryCopy(plan); return <button type="button" className="s16-choice" key={plan.id} onClick={() => setDraft({ planId: plan.id, returnView: 'QUESTIONS' })}><b>{copy.title}</b><small>{copy.conditions.join(' · ')}</small></button> })}</div>
    if (exploreView === 'GROUPS') return <div className="s16-lens-grid">{availableGroups.map(item => <button type="button" className="s16-lens" key={item} onClick={() => { setGroup(item); setExploreView('QUESTIONS') }}><b>{TERMINAL_QUERY_GROUP_LABELS[item]}</b><small>{TERMINAL_QUERY_GROUP_HINTS[item]}</small></button>)}</div>
    return <div className="s16-choice-stack"><button type="button" className="s16-choice" onClick={() => setExploreView('ALL')}><b>ALL RECORDS</b><small>{exploreCopy.allRecords}</small></button><button type="button" className="s16-choice" disabled={!contract.fileRead} onClick={() => setExploreView('GROUPS')}><b>QUESTION TYPES</b><small>{exploreCopy.questionTypes}</small></button>{state.sideLead.noteDiscovered && <button type="button" className="s16-choice" onClick={() => setExploreView('BRCG')}><b>OFFICE-NOTE TOKEN LEAD</b><small>Identify BRCG and examine the recovered note’s market snapshot.</small></button>}</div>
  }
  const renderHistory = () => {
    const runs = [...state.s16Runs].reverse()
    const pagesCount = Math.max(1, Math.ceil(runs.length / HISTORY_PAGE_SIZE))
    const page = Math.min(historyPage, pagesCount - 1)
    return <>{state.s16LegacyHistory.length > 0 && <div className="s16-legacy-history" aria-label="Migrated historical query audit">{state.s16LegacyHistory.map((item, index) => <p key={`${item.group}-${index}`}><b>{item.group.replaceAll('_', ' ')}</b> · V2 {item.status}{item.receiptReviewed ? ' · RECEIPT REVIEWED' : ''}</p>)}</div>}{runs.length ? <div className="s16-choice-stack">{runs.slice(page * HISTORY_PAGE_SIZE, (page + 1) * HISTORY_PAGE_SIZE).map(run => <button type="button" className="s16-choice" key={run.id} aria-current={state.s16SelectedRunId === run.id ? 'true' : undefined} onClick={() => { setResultOverview(true); send({ type: 'S16_SELECT_RUN', runId: run.id }) }}><b>{run.short}</b><small>{run.matchingIds.length} matching record{run.matchingIds.length === 1 ? '' : 's'} (of {run.inputIds.length} searched)</small></button>)}</div> : state.s16LegacyHistory.length === 0 && <p>No questions have been run yet.</p>}</>
  }
  const renderBody = () => {
    if (!state.access) return <><SectionHeading section="CASE"/><h2>ACCESS NOT YET EARNED</h2><p>Complete the Records Office authorization first.</p></>
    if (visibleSelection) return renderSelection()
    if (draft && contract.section === 'CASE') { const plan = S16_QUERY_PLANS[draft.planId]; return <QueryReceipt plan={plan} inputCount={plan.id === 'Q3' ? q2?.matchingIds.length ?? 0 : contract.searchableRecords.length}/> }
    if (contract.section === 'RESULTS') return renderResults()
    if (contract.section === 'EXPLORE') return renderExplore()
    if (contract.section === 'LEDGER') return renderHistory()
    return renderCase()
  }
  const landingFooter = contract.section === 'CASE' && !visibleSelection && !draft && !q2 && !state.s16StartAdded && !state.s16RouteAdded && !state.s13VerifiedRecordId && !state.complete
  const matchesFooter = contract.section === 'CASE' && !visibleSelection && !draft && Boolean(q2) && !state.s16StartAdded && !state.s16RouteAdded
  const quietFooter = contract.section === 'RESULTS' && selectedRun?.id === q2?.id && !visibleSelection
  const recordReturnLabel = visibleSelection?.origin.kind === 'ALL' ? 'ALL RECORDS' : visibleSelection?.origin.kind === 'REPORT' ? 'CASE REPORT' : 'MATCHES'
  const taskPresentation = visibleSelection && selectedRecord ? visibleSelection.sourcePage > 0
    ? { task: 'RECORD DETAILS', thread: ['', 'Full fields', 'Record origin', 'Saved fields'][visibleSelection.sourcePage] ?? '' }
    : { task: selectedRecord.evidenceId === 'EXACT_EARLY_NET' ? 'EARLIER TRANSFER' : selectedRecord.recordId === exact.recordId ? 'LATER TRANSFER' : selectedRecord.recordId === runtime.proof.contextualCorroboration.recordId ? 'SAME TRANSACTION · SUPPORTING ENTRY' : 'RECORD SUMMARY', thread: prototypeDisplayDate(selectedRecord.block_timestamp) }
    : draft ? { task: 'BUILD QUERY', thread: S16_QUERY_PLANS[draft.planId].mode === 'GUIDED' ? 'Your case question' : 'Optional question' }
    : contract.section === 'EXPLORE' && exploreView === 'ALL' ? { task: 'UNFILTERED RECORDS', thread: contract.fileRead ? 'No active filter · no ranking' : 'No question · no clues · no ranking' }
    : contract.section === 'EXPLORE' && exploreView === 'BRCG' ? { task: 'OFFICE-NOTE TOKEN LEAD', thread: 'Recovered note · BRCG market snapshot' }
    : contract.section === 'EXPLORE' && exploreView === 'GROUPS' ? { task: 'QUESTION TYPES', thread: 'Choose what to look for.' }
    : contract.section === 'EXPLORE' && exploreView === 'QUESTIONS' ? { task: TERMINAL_QUERY_GROUP_LABELS[group], thread: 'Choose a useful way to narrow the records.' }
    : contract.section === 'RESULTS' && selectedRun && selectedRun.id === q2?.id ? { task: resultOverview ? 'TOKEN + AMOUNT MATCHES' : 'THE THREE MATCHES', thread: `${selectedRun.matchingIds.length} matching records (of ${selectedRun.inputIds.length} searched)` }
    : contract.section === 'RESULTS' && selectedRun && selectedRun.id === q3?.id && resultOverview ? { task: 'CONNECTION SEARCH COMPLETE', thread: `${selectedRun.matchingIds.length} matching record (of ${selectedRun.inputIds.length} searched)` }
    : contract.section === 'RESULTS' && selectedRun ? { task: selectedRun.short.toUpperCase(), thread: `${selectedRun.matchingIds.length} matching records (of ${selectedRun.inputIds.length} searched)` }
    : closeConfirming ? { task: 'CLOSE THE EULER CASE?', thread: 'Your case report is saved.' }
    : { task: contract.task, thread: contract.thread }
  const taskActions = visibleSelection ? visibleSelection.sourcePage === 0
    ? <div className="s16-record-tools"><button type="button" className="s16-task-action" onClick={() => send({ type: 'S16_SOURCE_PAGE', page: 1 })}>MORE DETAILS</button><button type="button" className="s16-task-action" onClick={backToRows}>← {recordReturnLabel}</button></div>
    : <button type="button" className="s16-task-action" onClick={() => send({ type: 'S16_SOURCE_PAGE', page: 0 })}>← SUMMARY</button>
    : draft ? null
    : contract.section === 'EXPLORE' && exploreView === 'GROUPS'
      ? <button type="button" className="s16-task-action" onClick={() => setExploreView('HOME')}>← EXPLORE</button>
    : contract.section === 'EXPLORE' && exploreView === 'QUESTIONS'
      ? <button type="button" className="s16-task-action" onClick={() => setExploreView('GROUPS')}>← QUESTION TYPES</button>
    : contract.section === 'RESULTS' && selectedRun?.id === q2?.id && !resultOverview
      ? <button type="button" className="s16-task-action" onClick={() => setResultOverview(true)}>← SEARCH SUMMARY</button>
    : contract.section === 'RESULTS' && selectedRun?.id === q3?.id && resultOverview
      ? <button type="button" className="s16-task-action" onClick={() => setResultOverview(false)}>← MATCHES</button>
    : contract.section === 'RESULTS' && selectedRun?.mode === 'OPTIONAL'
      ? <button type="button" className="s16-task-action" onClick={() => { const plan = S16_QUERY_PLANS[selectedRun.planId]; if (plan.group) setGroup(plan.group); setExploreView('QUESTIONS'); send({ type: 'SECTION', section: 'EXPLORE' }) }}>← QUESTIONS</button>
      : null
  const explorePage = Math.min(pageFor('ALL'), Math.max(0, Math.ceil(contract.searchableRecords.length / PAGE_SIZE) - 1))
  const resultRecords = selectedRun ? s16RecordsForRun(runtime, selectedRun) : []
  const resultPage = selectedRun ? Math.min(pageFor(selectedRun.id), Math.max(0, Math.ceil(resultRecords.length / PAGE_SIZE) - 1)) : 0
  const historyPages = Math.max(1, Math.ceil(state.s16Runs.length / HISTORY_PAGE_SIZE))
  const terminalFooter = visibleSelection ? visibleSelection.sourcePage === 0 ? <div className="s16-page-nav s16-record-nav" aria-label="Records in this result"><button type="button" className="secondary" disabled={selectionIndex <= 0} onClick={() => moveSelectedRecord(-1)}>PREV</button><span className="s16-page-count">{selectionIndex + 1} / {selectionRecords.length} records</span><button type="button" className="secondary" disabled={selectionIndex < 0 || selectionIndex >= selectionRecords.length - 1} onClick={() => moveSelectedRecord(1)}>NEXT</button></div> : <div className="s16-page-nav"><button type="button" className="secondary" disabled={visibleSelection.sourcePage === 1} onClick={() => send({ type: 'S16_SOURCE_PAGE', page: (visibleSelection.sourcePage - 1) as 1 | 2 | 3 })}>PREV</button><span className="s16-page-count">{visibleSelection.sourcePage} / 3 pages</span><button type="button" className="secondary" disabled={visibleSelection.sourcePage === 3} onClick={() => send({ type: 'S16_SOURCE_PAGE', page: (visibleSelection.sourcePage + 1) as 1 | 2 | 3 })}>NEXT</button></div>
    : draft ? <div className="s16-page-nav"><button type="button" className="secondary" onClick={() => setDraft(null)}>← BACK</button><button type="button" className="primary" onClick={runDraft}>RUN QUERY</button></div>
    : contract.section === 'EXPLORE' && exploreView === 'ALL' ? <Paginator page={explorePage} count={contract.searchableRecords.length} onPage={next => updatePage('ALL', next)}/>
    : contract.section === 'EXPLORE' && (exploreView === 'GROUPS' || exploreView === 'QUESTIONS') ? <button type="button" className="secondary" onClick={() => setExploreView('ALL')}>ALL RECORDS</button>
    : contract.section === 'RESULTS' && selectedRun && selectedRun.id !== q2?.id && !(selectedRun.mode === 'GUIDED' && resultOverview) ? <Paginator page={resultPage} count={resultRecords.length} onPage={next => updatePage(selectedRun.id, next)}/>
    : contract.section === 'LEDGER' && historyPages > 1 ? <div className="s16-page-nav"><button type="button" className="secondary" disabled={historyPage === 0} onClick={() => setHistoryPage(historyPage - 1)}>PREV</button><span className="s16-page-count">{historyPage + 1} / {historyPages} pages</span><button type="button" className="secondary" disabled={historyPage >= historyPages - 1} onClick={() => setHistoryPage(historyPage + 1)}>NEXT</button></div>
    : contract.section === 'CASE' && (state.s13VerifiedRecordId || state.complete) && !closeConfirming ? <button type="button" className="secondary" onClick={() => send({ type: 'S16_OPEN_RECORD', recordId: exact.recordId, origin: { kind: 'REPORT', page: 0 } })}>VIEW TRANSACTION</button>
    : contract.section === 'CASE' && state.s16StartAdded && state.s16RouteAdded && !state.s13VerifiedRecordId && !state.complete && !closeConfirming ? <button type="button" className="secondary" onClick={() => { setResultOverview(false); if (q2) send({ type: 'S16_SELECT_RUN', runId: q2.id }) }}>MATCHING RECORDS</button>
    : landingFooter || matchesFooter ? <div className="s16-footer-actions">{state.sideLead.noteDiscovered && <button type="button" className="secondary" onClick={openBrcgLead}>OFFICE TOKEN LEAD</button>}<button type="button" className="secondary" onClick={() => setSection('EXPLORE')}>ALL RECORDS</button></div>
    : quietFooter ? null : null
  return <TerminalViewport mode="FULLSCREEN_CRT" chromeSrc={chromeSrc} cursorSrc={cursorSrc} shellState={state.error ? 'bounded-error' : state.access ? 'active' : 'locked'} degauss>
    <main data-testid="case-terminal" data-s16-screen={contract.screen} data-section={contract.section} data-terminal-stage={state.s16Runs.filter(run => run.mode === 'GUIDED').length + 1} data-proof-events={state.exactEventIds.length} data-hint-milestone={terminalHintMilestone(state)} data-prototype-binding={TERMINAL_PROTOTYPE_IDENTITY.name} data-prototype-sha256={TERMINAL_PROTOTYPE_IDENTITY.sha256} className={`case-terminal s16-terminal mode-fullscreen_crt${signalJitter ? ' signal-jitter' : ''}`} onKeyDown={event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (visibleSelection) {
        if (visibleSelection.sourcePage) send({ type: 'S16_SOURCE_PAGE', page: 0 })
        else backToRows()
      } else if (draft) setDraft(null)
      else setSection('CASE')
    }}>
      <header className="s16-topline"><h1 ref={heading} tabIndex={-1}>NANSEN™ CASE TERMINAL · EULER CASE</h1><button className="s16-office-button" type="button" onClick={onClose}>RETURN TO OFFICE</button></header>
      <TerminalNavigation sections={contract.sections} active={contract.section} onSelect={setSection}/>
      <TerminalTaskBar task={taskPresentation.task} thread={taskPresentation.thread} actions={taskActions}/>
      <section className="s16-body" aria-live="polite" data-testid="s16-screen-body">{renderBody()}</section>
      <footer className="s16-footer"><span className="s16-attribution">POWERED BY NANSEN API</span>{terminalFooter}</footer>
      <div className="s16-crt-effects" aria-hidden="true"><div className="s16-scanlines"/><div className="s16-noise"/><div className="s16-signal-band"/></div>
    </main>
  </TerminalViewport>
}
