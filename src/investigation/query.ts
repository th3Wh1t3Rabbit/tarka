import type { CandidateFolder, CaseFixture, CaseRecord, DispatchResult, Filter, Query, ZeroClass } from './contracts'

function decimalParts(value: string) {
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error('Amount must be a non-negative decimal')
  const [whole, fraction = ''] = value.split('.')
  return { integer: BigInt(`${whole}${fraction}`), scale: fraction.length }
}
export function compareDecimal(a: string, b: string) {
  const x = decimalParts(a); const y = decimalParts(b)
  const left = x.integer * 10n ** BigInt(y.scale); const right = y.integer * 10n ** BigInt(x.scale)
  return left < right ? -1 : left > right ? 1 : 0
}
export function canonicalQuery(query: Query) {
  const normalized = query.filters.map((filter) => ({ field: filter.field, value: ['SUBJECT', 'SOURCE', 'DESTINATION', 'TRANSACTION'].includes(filter.field) ? filter.value.toLowerCase() : filter.field === 'ASSET' ? filter.value.trim().toUpperCase() : filter.field === 'RECORD_SET' ? [...new Set(filter.value.split('|'))].sort().join('|') : filter.value }))
  const filters = [...new Map(normalized.map((filter) => [`${filter.field}:${filter.value}`, filter])).values()].sort((a, b) => a.field.localeCompare(b.field) || a.value.localeCompare(b.value))
  return { operator: 'AND' as const, lens: query.lens, filters }
}
export function queryValidationIssues(query: Query): string[] {
  const filters = canonicalQuery(query).filters
  if (!filters.some((filter) => filter.field === 'MIN_AMOUNT')) return []
  const assets = filters.filter((filter) => filter.field === 'ASSET')
  if (assets.length !== 1 || !assets[0]!.value) return ['MIN_AMOUNT requires exactly one distinct ASSET. Remove the amount threshold or keep one asset; every staged chip is preserved.']
  if (filters.some((filter) => filter.field === 'MIN_AMOUNT' && !/^\d+(?:\.\d+)?$/.test(filter.value))) return ['MIN_AMOUNT must be a non-negative decimal; every staged chip is preserved.']
  return []
}
export function assertExecutableQuery(query: Query) {
  const issues = queryValidationIssues(query)
  if (issues.length) throw new Error(`INVALID_QUERY: ${issues.join(' ')}`)
}
export function firstExcludingPredicate(record: CaseRecord, query: Query): string | null {
  assertExecutableQuery(query)
  const asset = canonicalQuery(query).filters.find((filter) => filter.field === 'ASSET')?.value
  for (const filter of canonicalQuery(query).filters) {
    const v = filter.value
    let passes = true
    switch (filter.field) {
      case 'SUBJECT': passes = [record.source, record.destination].some((value) => value.toLowerCase() === v); break
      case 'SOURCE': passes = record.source.toLowerCase() === v; break
      case 'DESTINATION': passes = record.destination.toLowerCase() === v; break
      case 'ASSET': passes = record.assetAmounts.some((amount) => amount.asset.trim().toUpperCase() === v); break
      case 'FROM': passes = Date.parse(record.observedAtUtc) >= Date.parse(v); break
      case 'TO': passes = Date.parse(record.observedAtUtc) <= Date.parse(v); break
      case 'MIN_AMOUNT': passes = Boolean(asset && record.assetAmounts.some((amount) => amount.asset.trim().toUpperCase() === asset && compareDecimal(amount.amount, v) >= 0)); break
      case 'TRANSACTION': passes = record.transactionHash.toLowerCase() === v; break
      case 'GRADE': passes = record.grade === v; break
      case 'KIND': passes = record.kind === v; break
      case 'RECORD_SET': passes = v.split('|').includes(record.id); break
    }
    if (!passes) return `${filter.field} = ${v}`
  }
  if (query.lens === 'STATE' && record.kind !== 'STATE') return 'STATE requires a state view'
  if (query.lens === 'RECEIPT' && (record.derivedFrom.length > 0 || record.grade !== 'EXACT')) return 'RECEIPT requires an exact event, not a derived/contextual view'
  return null
}
export function coverageFor(fixture: CaseFixture, query: Query) {
  const subjects = query.filters.filter(({ field }) => ['SUBJECT', 'SOURCE', 'DESTINATION'].includes(field)).map(({ value }) => value.toLowerCase())
  const from = query.filters.find(({ field }) => field === 'FROM')?.value
  const to = query.filters.find(({ field }) => field === 'TO')?.value
  return fixture.coverage.filter((cell) => cell.lens === query.lens && subjects.length > 0 && subjects.every((subject) => subject === cell.subject.toLowerCase()) && (!from || Date.parse(from) >= Date.parse(cell.fromUtc)) && (!to || Date.parse(to) <= Date.parse(cell.toUtc)))
}
export function zeroClassification(fixture: CaseFixture, query: Query): ZeroClass {
  const cells = coverageFor(fixture, query)
  const outsideCutoff = query.filters.some(({ field, value }) => (field === 'FROM' || field === 'TO') && Date.parse(value) > Date.parse(fixture.cutoffUtc))
  if (!cells.length || outsideCutoff || cells.some((cell) => ['FAILED', 'PLANNED', 'NOT_IN_SCOPE'].includes(cell.status))) return 'QUERY_OUTSIDE_COVERAGE'
  const bounded = query.filters.some(({ field }) => field === 'FROM') && query.filters.some(({ field }) => field === 'TO')
  return bounded && cells.every((cell) => cell.supportsNegative && ['COMPLETE', 'EMPTY_COMPLETE'].includes(cell.status)) ? 'NEGATIVE_EVIDENCE_SUPPORTED' : 'NO_MATCH_IN_ACCEPTED_CORPUS'
}
export function querySentence(query: Query) {
  const filters = canonicalQuery(query).filters
  return `${query.lens}: ${filters.length ? filters.map(({ field, value }) => `${field.toLowerCase().replaceAll('_', ' ')} ${value}`).join(' AND ') : 'all accepted records within the frozen cutoff'}.`
}
export function queryReceipt(fixture: CaseFixture, query: Query) {
  return { plainQuestion: querySentence(query), activeFilters: query.filters.map((filter) => ({ ...filter })), validationIssues: queryValidationIssues(query), executionAllowed: queryValidationIssues(query).length === 0, questionLens: query.lens, coverageScope: `Frozen corpus through ${fixture.cutoffUtc}; not complete chain history.`, expectedResultClass: query.lens === 'RECEIPT' ? 'EXACT_RECEIPT' : query.lens === 'STATE' ? 'STATE' : query.lens === 'RELATIONSHIPS' ? 'COUNTERPARTIES' : 'CANDIDATES', noHiddenFilterMutation: true }
}
export function dispatchQuery(fixture: CaseFixture, query: Query, previous: DispatchResult | null): DispatchResult {
  assertExecutableQuery(query)
  const rows = fixture.records.filter((record) => Date.parse(record.observedAtUtc) <= Date.parse(fixture.cutoffUtc) && !firstExcludingPredicate(record, query)).sort((a, b) => a.observedAtUtc.localeCompare(b.observedAtUtc) || a.id.localeCompare(b.id))
  const subject = query.filters.find(({ field }) => ['SUBJECT', 'SOURCE', 'DESTINATION'].includes(field))?.value.toLowerCase()
  const counterparty = (record: CaseRecord) => record.source.toLowerCase() === subject ? record.destination : record.source
  const frequencies = new Map<string, Set<string>>()
  if (query.lens === 'RELATIONSHIPS') {
    for (const record of rows.filter((row) => row.kind === 'ACTIVITY' && row.grade === 'EXACT')) {
      const party = counterparty(record)
      if (!frequencies.has(party)) frequencies.set(party, new Set())
      frequencies.get(party)!.add(record.transactionHash)
    }
    rows.sort((a, b) => (frequencies.get(counterparty(b))?.size ?? 0) - (frequencies.get(counterparty(a))?.size ?? 0) || a.observedAtUtc.localeCompare(b.observedAtUtc) || a.id.localeCompare(b.id))
  }
  const folders: CandidateFolder[] = rows.map((record) => ({ id: `FOLDER.${record.id}`, recordId: record.id, summary: record.summary, whyMatched: query.filters.length ? query.filters.map(({ field, value }) => `${field} ${value}`) : ['Matches the broad accepted-corpus question'], grade: record.grade, status: record.grade === 'CORROBORATING' ? 'CORROBORATING' : 'UNTESTED', maySupport: record.grade === 'EXACT' ? 'This recorded event; route continuity still requires the accepted exact predicate.' : record.grade === 'CORROBORATING' ? 'A bounded state interpretation, not independent route proof.' : 'Bounded historical context.', cannotProve: record.claimBoundary, nextQuestionIds: [record.grade === 'CORROBORATING' ? 'QUESTION.EXACT_RECEIPT' : 'QUESTION.FOLLOW_FORWARD'], sortReason: 'Chronological order, then stable record ID; not likelihood or guilt.' }))
  const excluded = (previous?.recordIds ?? []).filter((id) => !rows.some((record) => record.id === id)).map((recordId) => ({ recordId, firstPredicate: firstExcludingPredicate(fixture.records.find((record) => record.id === recordId)!, query) ?? 'Historical cutoff' }))
  if (query.lens === 'RELATIONSHIPS') for (const folder of folders) {
    const record = rows.find(({ id }) => id === folder.recordId)!
    folder.whyMatched.push(`${frequencies.get(counterparty(record))?.size ?? 0} distinct exact activity transactions with this counterparty in these retrieved rows; views of one transaction count once.`)
    folder.sortReason = 'Observed distinct-transaction interaction count, then time and stable ID. Partial corpus frequency is not causation or complete historical ranking.'
  }
  return { query: structuredClone(query), recordIds: rows.map(({ id }) => id), folders, zeroClass: rows.length ? null : zeroClassification(fixture, query), coverageIds: coverageFor(fixture, query).map(({ id }) => id), delta: { previousCount: previous?.recordIds.length ?? 0, newCount: rows.length, includedReason: query.filters.map(({ field, origin }) => `${field} from ${origin}`).join('; ') || 'Broad corpus query', excluded } }
}
export function filterFromClue(id: string, field: Filter['field'], value: string): Filter { return { field, value, origin: 'CASE_CLUE', sourceId: id } }
