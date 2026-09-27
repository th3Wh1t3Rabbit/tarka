import { describe, expect, it } from 'vitest'
import { auditDialogueRepetition, type RepetitionAllowlistEntry } from '../../src/adventure/dialogueRepetitionAudit'
import { RUNTIME_TRANSCRIPT_AUTHORITY, runtimeTranscriptRoute, type RuntimeTranscriptRoute } from '../../src/adventure/runtimeTranscriptAuthority'
import type { SpeechLine } from '../../src/adventure/types'

const callbacks: RepetitionAllowlistEntry[] = [{
  routeId: 'opening.principal', kind: 'EXACT', leftLineIds: ['OPEN-045::2'], rightLineIds: ['OPEN-047'],
  expectedLeftText: 'The blockchain.', expectedRightText: 'The BLOCKCHAIN.',
  rationale: 'Arthur immediately repeats Rook’s confused term with corrective emphasis.',
}]
const approvedForm = runtimeTranscriptRoute('useful.give-form')!.deliveries.map(line => `${line.deliveryId}\0${line.speaker}\0${line.text}`)
const vhs = /VHS|videotape|doesn.t play them/i

function transcriptGuard(routes: readonly RuntimeTranscriptRoute[]) {
  const issues: string[] = []
  if (new Set(routes.map(route => route.routeId)).size !== routes.length) issues.push('DUPLICATE_ROUTE_ID')
  for (const route of routes) for (const [index, line] of route.lines.entries()) {
    const key = line.copyKey ?? line.finalScriptSource?.sourceNodeId ?? line.r55Source?.nodeId ?? ''
    if (key.includes('.provisional-')) issues.push(`PROVISIONAL:${route.routeId}:${index}`)
    if (vhs.test(line.text) && route.routeId !== 'useful.pickup-misc-contents' && !route.routeId.includes('sharknado-2-vhs')) issues.push(`VHS_SCOPE:${route.routeId}:${index}`)
  }
  const form = routes.find(route => route.routeId === 'useful.give-form')
  const observedForm = form?.deliveries.map(line => `${line.deliveryId}\0${line.speaker}\0${line.text}`) ?? []
  if (JSON.stringify(observedForm) !== JSON.stringify(approvedForm)) issues.push('FORM_TRANSCRIPT_DRIFT')
  const repetition = auditDialogueRepetition(routes.filter(route => route.lines.length > 1), callbacks)
  if (repetition.unallowlisted.length) issues.push('REPETITION_WINDOW')
  return issues
}

interface TerminalPresentationProbe { ordinaryToken: string; sourcePage1Fields: string[]; visibleControls: string[]; rowColumns: string; sourceFont: string }
function terminalGuard(probe: TerminalPresentationProbe) {
  const issues: string[] = []
  if (/Earlier|Later/i.test(probe.ordinaryToken)) issues.push('SEMANTIC_LABEL_IN_TOKEN_COLUMN')
  if (probe.sourcePage1Fields.join('|') !== 'WHEN|TOKEN|AMOUNT|FROM|TO|TX HASH') issues.push('SOURCE_PAGE_1_FIELDS')
  if (probe.visibleControls.some(control => control.toUpperCase() === 'COPY')) issues.push('VISIBLE_COPY_CONTROL')
  if (probe.rowColumns !== '43px 34px minmax(0,1fr)') issues.push('ROW_GEOMETRY')
  if (probe.sourceFont !== '6.2px/1.32') issues.push('SOURCE_TYPOGRAPHY')
  return issues
}

const terminalTruth: TerminalPresentationProbe = {
  ordinaryToken: 'DAI', sourcePage1Fields: ['WHEN', 'TOKEN', 'AMOUNT', 'FROM', 'TO', 'TX HASH'],
  visibleControls: ['← RECORD', 'NEXT'], rowColumns: '43px 34px minmax(0,1fr)', sourceFont: '6.2px/1.32',
}

describe('S17-P2-R3 semantic mutation controls', () => {
  it('accepts the actual authorities before applying mutants', () => {
    expect(transcriptGuard(RUNTIME_TRANSCRIPT_AUTHORITY)).toEqual([])
    expect(terminalGuard(terminalTruth)).toEqual([])
  })

  it('kills script/runtime mutants for the mechanisms that escaped earlier reviews', () => {
    const clone = () => structuredClone(RUNTIME_TRANSCRIPT_AUTHORITY) as RuntimeTranscriptRoute[]

    const staleAuthorization = clone()
    const form = staleAuthorization.find(route => route.routeId === 'useful.give-form')!
    const repeated = structuredClone(form.lines.slice(-6)) as SpeechLine[]
    form.lines = [...form.lines, ...repeated]
    form.deliveries = [...form.deliveries, ...form.deliveries.slice(-6).map((line, index) => ({ ...line, deliveryOrder: form.deliveries.length + index + 1 }))]
    expect(transcriptGuard(staleAuthorization)).toEqual(expect.arrayContaining(['FORM_TRANSCRIPT_DRIFT', 'REPETITION_WINDOW']))

    const broadVhs = clone()
    broadVhs.find(route => route.routeId === 'world.USE.pen-stand.item.loose-feather-pen')!.lines[0]!.text = 'The terminal doesn’t play VHS tapes.'
    expect(transcriptGuard(broadVhs)).toContain('VHS_SCOPE:world.USE.pen-stand.item.loose-feather-pen:0')

    const provisional = clone()
    provisional[0]!.lines[0]!.sourceCopyKey = 'OPEN-001.provisional-2'
    provisional[0]!.lines[0]!.copyKey = 'OPEN-001.provisional-2'
    expect(transcriptGuard(provisional)).toContain('PROVISIONAL:opening.principal:0')

    const duplicateRoute = clone()
    duplicateRoute.push(structuredClone(duplicateRoute[0]!))
    expect(transcriptGuard(duplicateRoute)).toContain('DUPLICATE_ROUTE_ID')
  }, 20_000)

  it('kills exact-presentation mutants for the concrete prototype drift mechanisms', () => {
    expect(terminalGuard({ ...terminalTruth, ordinaryToken: 'Earlier transfer' })).toContain('SEMANTIC_LABEL_IN_TOKEN_COLUMN')
    expect(terminalGuard({ ...terminalTruth, sourcePage1Fields: ['NETWORK', 'WHEN', 'TOKEN / AMOUNT', 'CONTRACT', 'FROM', 'TO', 'TX HASH'] })).toContain('SOURCE_PAGE_1_FIELDS')
    expect(terminalGuard({ ...terminalTruth, visibleControls: [...terminalTruth.visibleControls, 'COPY'] })).toContain('VISIBLE_COPY_CONTROL')
    expect(terminalGuard({ ...terminalTruth, rowColumns: '39px 132px minmax(0,1fr)' })).toContain('ROW_GEOMETRY')
    expect(terminalGuard({ ...terminalTruth, sourceFont: '4.2px/1' })).toContain('SOURCE_TYPOGRAPHY')
  })
})
