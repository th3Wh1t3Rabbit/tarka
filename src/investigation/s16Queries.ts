import type { S13Record, S13Runtime } from './s13'

export type S16QueryMode = 'GUIDED' | 'OPTIONAL'
export type S16QueryGroup = 'WHAT' | 'WHO' | 'CHANGED' | 'PROVES'
export type S16QueryId = 'Q2' | 'Q3' | 'A_DAI' | 'A_OTHER' | 'A_LARGE' | 'R_REPEAT' | 'R_FIRST' | 'R_VAULT' | 'S_BEFORE' | 'S_AFTER' | 'P_VIEWS' | 'P_START' | 'P_LINK'
export type S16QuerySemantics = 'R1' | 'R2'
export type S16RunOrigin = 'CURRENT' | 'R1_NATIVE' | 'MIGRATED_V2'

export interface S16QueryPlan {
  id: S16QueryId
  mode: S16QueryMode
  group: S16QueryGroup | null
  title: string
  short: string
  conditions: readonly string[]
  expected: string
  gate: 'FILE' | 'START' | 'ROUTE'
}

export interface S16QueryRun {
  id: string
  planId: S16QueryId
  mode: S16QueryMode
  order: number
  title: string
  short: string
  conditions: readonly string[]
  inputIds: readonly string[]
  matchingIds: readonly string[]
  countStages: readonly number[]
  semantics: S16QuerySemantics
  origin: S16RunOrigin
}

export const S16_TOKEN_SYMBOLS = Object.freeze({
  '0x6b175474e89094c44da98b954eedeac495271d0f': 'DAI',
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': 'stETH',
  '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0': 'wstETH',
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDC',
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'WBTC',
} as const)

export function s16TokenSymbol(record: Pick<S13Record, 'token_address'>): string {
  const contract = record.token_address?.toLowerCase() as keyof typeof S16_TOKEN_SYMBOLS | undefined
  return contract && S16_TOKEN_SYMBOLS[contract] ? S16_TOKEN_SYMBOLS[contract] : 'UNIDENTIFIED'
}

export const S16_QUERY_PLANS: Readonly<Record<S16QueryId, S16QueryPlan>> = Object.freeze({
  Q2: { id: 'Q2', mode: 'GUIDED', group: null, title: 'Which DAI transfers match the amount in the file?', short: 'DAI + amount', conditions: ['Token: DAI (the contract in the Euler file)', 'Amount: 8,000,000–9,500,000 DAI'], expected: 'Transfers matching both clues.', gate: 'FILE' },
  Q3: { id: 'Q3', mode: 'GUIDED', group: null, title: 'Which record proves the later connection?', short: 'Exact connection', conditions: ['Sender: First Engine · Receiver: Receiving Vault', 'The exact transaction record, not another view of it'], expected: 'One transaction that establishes the connection.', gate: 'ROUTE' },
  A_DAI: { id: 'A_DAI', mode: 'OPTIONAL', group: 'WHAT', title: 'Which transfers moved DAI?', short: 'DAI transfers', conditions: ['Token: DAI'], expected: 'All DAI transfer records.', gate: 'FILE' },
  A_OTHER: { id: 'A_OTHER', mode: 'OPTIONAL', group: 'WHAT', title: 'Which transfers moved other tokens?', short: 'Other tokens', conditions: ['Token: stETH, wstETH, USDC or WBTC'], expected: 'All non-DAI token records.', gate: 'FILE' },
  A_LARGE: { id: 'A_LARGE', mode: 'OPTIONAL', group: 'WHAT', title: 'Which DAI transfers exceed one million?', short: 'Large DAI transfers', conditions: ['Token: DAI', 'Amount: more than 1,000,000 DAI'], expected: 'Large DAI transfer records.', gate: 'FILE' },
  R_REPEAT: { id: 'R_REPEAT', mode: 'OPTIONAL', group: 'WHO', title: 'Which sender-and-receiver pairs repeat?', short: 'Repeated address pairs', conditions: ['The same sender/receiver pair appears in multiple records'], expected: 'Records whose address pair repeats.', gate: 'FILE' },
  R_FIRST: { id: 'R_FIRST', mode: 'OPTIONAL', group: 'WHO', title: 'Which transfers involve the First Engine?', short: 'First Engine activity', conditions: ['Sender or receiver: First Engine'], expected: 'Records involving the case-named First Engine.', gate: 'START' },
  R_VAULT: { id: 'R_VAULT', mode: 'OPTIONAL', group: 'WHO', title: 'Which transfers reach the Receiving Vault?', short: 'Transfers to Receiving Vault', conditions: ['Receiver: Receiving Vault'], expected: 'Records reaching the case-named Receiving Vault.', gate: 'ROUTE' },
  S_BEFORE: { id: 'S_BEFORE', mode: 'OPTIONAL', group: 'CHANGED', title: 'Which transfers happened before 09:00?', short: 'Before 09:00', conditions: ['Time: before 09:00 UTC'], expected: 'Earlier records in the fixed collection window.', gate: 'FILE' },
  S_AFTER: { id: 'S_AFTER', mode: 'OPTIONAL', group: 'CHANGED', title: 'Which transfers happened from 09:00 onward?', short: 'From 09:00 onward', conditions: ['Time: 09:00–12:15 UTC'], expected: 'Later records in the fixed collection window.', gate: 'FILE' },
  P_VIEWS: { id: 'P_VIEWS', mode: 'OPTIONAL', group: 'PROVES', title: 'Which transactions have more than one record?', short: 'Repeated transaction views', conditions: ['The same transaction hash appears in multiple records'], expected: 'Records sharing a transaction reference.', gate: 'FILE' },
  P_START: { id: 'P_START', mode: 'OPTIONAL', group: 'PROVES', title: 'Which records describe the first breach transaction?', short: 'First breach transaction', conditions: ['Transaction: the starting point added to the case'], expected: 'Every view of the first breach transaction.', gate: 'START' },
  P_LINK: { id: 'P_LINK', mode: 'OPTIONAL', group: 'PROVES', title: 'Which records describe the later route transaction?', short: 'Later transaction views', conditions: ['Transaction: the later movement added to the case'], expected: 'Every view of the later route transaction.', gate: 'ROUTE' },
})
for (const plan of Object.values(S16_QUERY_PLANS)) { Object.freeze(plan.conditions); Object.freeze(plan) }

export const S16_GUIDED_QUERY_IDS = Object.freeze(['Q2', 'Q3'] as const)
// P_VIEWS remains in S16_QUERY_PLANS only so genuine R1 history can be
// inspected. R2 explains overlapping views beside the affected records.
export const S16_OPTIONAL_QUERY_IDS = Object.freeze(['A_DAI', 'A_OTHER', 'A_LARGE', 'R_REPEAT', 'R_FIRST', 'R_VAULT', 'S_BEFORE', 'S_AFTER', 'P_START', 'P_LINK'] as const)

function decimalCompare(a: unknown, b: string): number {
  const values = [String(a ?? ''), b].map(value => {
    if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error('Invalid accepted decimal')
    return value.split('.')
  })
  const places = Math.max(...values.map(parts => (parts[1] ?? '').length))
  const integers = values.map(parts => BigInt(parts[0]! + (parts[1] ?? '').padEnd(places, '0')))
  return integers[0] === integers[1] ? 0 : integers[0]! > integers[1]! ? 1 : -1
}

function pool(runtime: S13Runtime): S13Record[] {
  const ids = runtime.evidenceDelta.stages[0]?.survivingRecordIds ?? []
  const corpus = new Map(runtime.caseCorpus.map(record => [record.recordId, record]))
  const records = ids.map(id => corpus.get(id)).filter((record): record is S13Record => Boolean(record))
  if (records.length !== 98 || new Set(records.map(record => record.recordId)).size !== 98) throw new Error('Accepted S16 pool is unavailable')
  return records
}

function exacts(runtime: S13Runtime) {
  const exact = runtime.proof.exactRecord
  const early = runtime.caseCorpus.find(record => record.evidenceId === 'EXACT_EARLY_NET')
  if (!early) throw new Error('Accepted first breach record is unavailable')
  return { exact, early }
}

function queryMatches(runtime: S13Runtime, planId: S16QueryId, input: readonly S13Record[], semantics: S16QuerySemantics): { matching: S13Record[]; stages: number[] } {
  const all = pool(runtime)
  const { exact, early } = exacts(runtime)
  const samePairCount = (record: S13Record) => all.filter(other => other.from_address === record.from_address && other.to_address === record.to_address).length
  const samePairTransactionCount = (record: S13Record) => new Set(all.filter(other => other.from_address === record.from_address && other.to_address === record.to_address).map(other => other.transaction_hash).filter(Boolean)).size
  const sameHashCount = (record: S13Record) => all.filter(other => other.transaction_hash === record.transaction_hash).length
  const dai = (record: S13Record) => s16TokenSymbol(record) === 'DAI'
  const amountBand = (record: S13Record) => dai(record) && decimalCompare(record.transfer_amount, '8000000') >= 0 && decimalCompare(record.transfer_amount, '9500000') <= 0
  const route = (record: S13Record) => record.from_address === exact.from_address && record.to_address === exact.to_address
  if (planId === 'Q2') {
    const tokenMatches = input.filter(dai)
    const matching = tokenMatches.filter(amountBand)
    return { matching, stages: [input.length, tokenMatches.length, matching.length] }
  }
  if (planId === 'Q3') {
    const routeMatches = input.filter(route)
    const matching = routeMatches.filter(record => record.recordId === exact.recordId)
    return { matching, stages: [input.length, routeMatches.length, matching.length] }
  }
  const predicate: Record<Exclude<S16QueryId, 'Q2' | 'Q3'>, (record: S13Record) => boolean> = {
    A_DAI: dai,
    A_OTHER: record => s16TokenSymbol(record) !== 'DAI' && s16TokenSymbol(record) !== 'UNIDENTIFIED',
    A_LARGE: record => dai(record) && decimalCompare(record.transfer_amount, '1000000') > 0,
    R_REPEAT: record => semantics === 'R1' ? samePairCount(record) > 1 : samePairTransactionCount(record) > 1,
    R_FIRST: record => record.from_address === early.to_address || record.to_address === early.to_address,
    R_VAULT: record => record.to_address === exact.to_address,
    S_BEFORE: record => (record.block_timestamp ?? '') < '2023-03-13T09:00:00Z',
    S_AFTER: record => (record.block_timestamp ?? '') >= '2023-03-13T09:00:00Z',
    P_VIEWS: record => Boolean(record.transaction_hash) && sameHashCount(record) > 1,
    P_START: record => Boolean(early.transaction_hash) && record.transaction_hash === early.transaction_hash,
    P_LINK: record => Boolean(exact.transaction_hash) && record.transaction_hash === exact.transaction_hash,
  }
  const matching = input.filter(predicate[planId])
  return { matching, stages: [input.length, matching.length] }
}

export function s16QueryInput(runtime: S13Runtime, planId: S16QueryId, runs: readonly S16QueryRun[]): S13Record[] {
  if (planId !== 'Q3') return pool(runtime)
  const first = runs.find(run => run.planId === 'Q2' && run.mode === 'GUIDED')
  if (!first) return []
  const ids = new Set(first.matchingIds)
  return pool(runtime).filter(record => ids.has(record.recordId))
}

export function createS16Run(runtime: S13Runtime, planId: S16QueryId, priorRuns: readonly S16QueryRun[], semantics: S16QuerySemantics = 'R2', origin: S16RunOrigin = 'CURRENT'): S16QueryRun {
  if (planId === 'P_VIEWS' && semantics !== 'R1') throw new Error('Repeated transaction views are historical-only in S16-R2')
  const plan = S16_QUERY_PLANS[planId]
  const input = s16QueryInput(runtime, planId, priorRuns)
  if (planId === 'Q3' && !priorRuns.some(run => run.planId === 'Q2' && run.mode === 'GUIDED')) throw new Error('Exact-link query requires the saved token-and-amount run')
  const evaluated = queryMatches(runtime, planId, input, semantics)
  const order = priorRuns.length + 1
  return Object.freeze({
    id: `S16-RUN-${String(order).padStart(4, '0')}`,
    planId,
    mode: plan.mode,
    order,
    title: plan.title,
    short: plan.short,
    conditions: Object.freeze([...plan.conditions]),
    inputIds: Object.freeze(input.map(record => record.recordId)),
    matchingIds: Object.freeze(evaluated.matching.map(record => record.recordId)),
    countStages: Object.freeze([...evaluated.stages]),
    semantics,
    origin,
  })
}

export function s16RunIsValid(runtime: S13Runtime, run: S16QueryRun, priorRuns: readonly S16QueryRun[]): boolean {
  if (!run || typeof run !== 'object' || !S16_QUERY_PLANS[run.planId] || !['R1', 'R2'].includes(run.semantics) || !['CURRENT', 'R1_NATIVE', 'MIGRATED_V2'].includes(run.origin) || run.order !== priorRuns.length + 1 || run.id !== `S16-RUN-${String(run.order).padStart(4, '0')}`) return false
  try { return JSON.stringify(run) === JSON.stringify(createS16Run(runtime, run.planId, priorRuns, run.semantics, run.origin)) } catch { return false }
}

export function s16RecordsForRun(runtime: S13Runtime, run: S16QueryRun): S13Record[] {
  const ids = new Set(run.matchingIds)
  return pool(runtime).filter(record => ids.has(record.recordId))
}

export function s16AllRecords(runtime: S13Runtime): S13Record[] { return pool(runtime) }

export interface S16RecordFacts {
  time: string
  transactionRecordIds: readonly string[]
  transactionTokens: readonly string[]
  reverseIds: readonly string[]
  sameDirectionIds: readonly string[]
  pairTransactions: readonly string[]
  senderTransactions: readonly string[]
  receiverTransactions: readonly string[]
  zeroReceiver: boolean
}

export interface S16RecordExplanation {
  shows: string
  limits: string
  rule: 'zero-receiver' | 'reverse-in-transaction' | 'same-direction-entry' | 'repeated-route' | 'multiple-tokens' | 'multi-entry-transaction' | 'active-sender' | 'repeat-receiver' | 'fractional-transfer' | 'single-transfer'
  facts: S16RecordFacts
}

const shortAddress = (value: unknown, head = 6, tail = 4): string => {
  const whole = String(value ?? '')
  return whole.length > head + tail + 1 ? `${whole.slice(0, head)}…${whole.slice(-tail)}` : whole || 'Not recorded'
}

const explanationTime = (record: S13Record): string => {
  const value = String(record.block_timestamp ?? '')
  return value.includes('T') ? value.split('T')[1]!.replace('Z', '') : '—'
}

const explanationAmount = (record: S13Record): string => {
  const [integer, fraction] = String(record.transfer_amount ?? '').split('.')
  const grouped = integer!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${grouped}${fraction === undefined ? '' : `.${fraction}`} ${s16TokenSymbol(record)}`
}

export function s16RecordFacts(runtime: S13Runtime, record: S13Record): S16RecordFacts {
  const records = pool(runtime)
  if (!records.some(item => item.recordId === record.recordId)) throw new Error('Record is outside the accepted S16 pool')
  const transaction = records.filter(item => item.transaction_hash === record.transaction_hash)
  const sameToken = transaction.filter(item => item.token_address === record.token_address)
  const reverse = sameToken.filter(item => item.from_address === record.to_address && item.to_address === record.from_address && item.recordId !== record.recordId)
  const sameDirection = sameToken.filter(item => item.from_address === record.from_address && item.to_address === record.to_address && item.recordId !== record.recordId)
  const unique = (values: Array<string | null | undefined>) => [...new Set(values.filter((value): value is string => typeof value === 'string'))]
  return Object.freeze({
    time: explanationTime(record),
    transactionRecordIds: Object.freeze(transaction.map(item => item.recordId)),
    transactionTokens: Object.freeze([...new Set(transaction.map(s16TokenSymbol))].sort()),
    reverseIds: Object.freeze(reverse.map(item => item.recordId)),
    sameDirectionIds: Object.freeze(sameDirection.map(item => item.recordId)),
    pairTransactions: Object.freeze(unique(records.filter(item => item.from_address === record.from_address && item.to_address === record.to_address).map(item => item.transaction_hash))),
    senderTransactions: Object.freeze(unique(records.filter(item => item.from_address === record.from_address).map(item => item.transaction_hash))),
    receiverTransactions: Object.freeze(unique(records.filter(item => item.to_address === record.to_address).map(item => item.transaction_hash))),
    zeroReceiver: /^0x0{40}$/i.test(String(record.to_address ?? '')),
  })
}

/** Deterministic, accepted-field-only explanation for every record in the 98-record S16 pool. */
export function s16ExplainRecord(runtime: S13Runtime, record: S13Record, fileRead: boolean): S16RecordExplanation {
  const facts = s16RecordFacts(runtime, record)
  const time = facts.time
  const value = explanationAmount(record)
  const token = s16TokenSymbol(record)
  let shows: string
  let limits: string
  let rule: S16RecordExplanation['rule']
  if (facts.zeroReceiver) {
    shows = `At ${time}, ${value} is recorded with the all-zero address as its receiver.`
    limits = 'The destination is recorded, but this entry alone does not explain the operation that produced it.'
    rule = 'zero-receiver'
  } else if (facts.reverseIds.length) {
    shows = `At ${time}, ${value} goes to ${shortAddress(record.to_address)}. This transaction also has a transfer back the other way.`
    limits = 'Compare both amounts. This one entry is not the net balance change for either address.'
    rule = 'reverse-in-transaction'
  } else if (facts.sameDirectionIds.length) {
    shows = `At ${time}, ${value} goes to ${shortAddress(record.to_address)}. Another entry in this transaction uses the same route.`
    limits = record.transaction_hash === runtime.proof.exactRecord.transaction_hash ? 'The other entry describes the same later transfer. Two views are not two payments.' : 'Compare the amounts and record details before treating similar entries as separate payments.'
    rule = 'same-direction-entry'
  } else if (facts.pairTransactions.length > 1) {
    shows = `At ${time}, ${value} follows a route found in ${facts.pairTransactions.length} different saved transactions.`
    limits = 'A repeated address pair shows a pattern of transfers, not who controls the addresses or why they interacted.'
    rule = 'repeated-route'
  } else if (facts.transactionTokens.length > 1) {
    shows = `At ${time}, ${value} goes to ${shortAddress(record.to_address)}. This transaction also contains ${facts.transactionTokens.filter(item => item !== token).join(' and ')} entries.`
    limits = 'Tokens appearing in one transaction do not, by themselves, establish an exchange rate or a conversion.'
    rule = 'multiple-tokens'
  } else if (facts.transactionRecordIds.length > 1) {
    shows = `At ${time}, ${value} goes to ${shortAddress(record.to_address)}. It is one of ${facts.transactionRecordIds.length} entries sharing a transaction reference.`
    limits = 'One transaction may have several movements. Use the amounts and addresses to distinguish this entry.'
    rule = 'multi-entry-transaction'
  } else if (facts.senderTransactions.length > 1) {
    shows = `At ${time}, ${value} leaves a sender found in ${facts.senderTransactions.length - 1} other saved transactions.`
    limits = 'This entry records one destination. It does not show the sender’s total balance or all subsequent activity.'
    rule = 'active-sender'
  } else if (facts.receiverTransactions.length > 1) {
    shows = `At ${time}, ${value} arrives at an address receiving transfers in ${facts.receiverTransactions.length} saved transactions.`
    limits = 'Several arrivals do not identify who controls the sending addresses or whether they share an owner.'
    rule = 'repeat-receiver'
  } else if (decimalCompare(record.transfer_amount, '1') < 0) {
    shows = `At ${time}, ${value} moves to ${shortAddress(record.to_address)}. This is a fraction of one token.`
    limits = 'The small amount does not explain its purpose. There is no reason or owner identity in this record.'
    rule = 'fractional-transfer'
  } else {
    shows = `At ${time}, ${value} moves along this sender-to-receiver route.`
    limits = 'This entry shows one movement, not the full history or ownership of either address.'
    rule = 'single-transfer'
  }
  if (fileRead && token !== 'DAI') limits = `This is ${token}, not DAI. Its amount cannot make it match the token clue in the Euler file.`
  else if (fileRead && record.recordKind !== 'HERO_IMMUTABLE' && !((decimalCompare(record.transfer_amount, '8000000') >= 0) && (decimalCompare(record.transfer_amount, '9500000') <= 0))) {
    limits = decimalCompare(record.transfer_amount, '8000000') < 0 ? 'It is DAI, but the amount is below the 8,000,000–9,500,000 DAI search range.' : 'It is DAI, but the amount is above the 8,000,000–9,500,000 DAI search range.'
  }
  return Object.freeze({ shows, limits, rule, facts })
}
