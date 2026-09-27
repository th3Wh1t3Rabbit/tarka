import { s16TokenSymbol, type S16QueryGroup, type S16QueryId, type S16QueryPlan } from '../investigation/s16Queries'
import type { S13Record } from '../investigation/s13'

/** Exact visible vocabulary from the approved v0.13 presentation authority. */
export const TERMINAL_PROTOTYPE_IDENTITY = {
  name: 'TARKA_S16_TERMINAL_FLOW_PROTOTYPE_v0.13.0',
  sha256: '6dba2a13eca9bc4ea1b6559e076125b8d31cad7fcaa17b8bfcfc91d48d9d5a6f',
  stage: { width: 480, height: 270 },
  aperture: { x: 44, y: 12, width: 393, height: 219, padding: 5 },
  rows: '21px 18px 27px 119px 24px',
} as const

export const TERMINAL_QUERY_GROUPS: readonly S16QueryGroup[] = ['WHAT', 'WHO', 'CHANGED', 'PROVES']
export const TERMINAL_QUERY_GROUP_LABELS: Record<S16QueryGroup, string> = {
  WHAT: 'WHAT MOVED?',
  WHO: 'WHICH ADDRESSES?',
  CHANGED: 'WHEN DID IT MOVE?',
  PROVES: 'CHECK A KNOWN TRANSACTION',
}
export const TERMINAL_QUERY_GROUP_HINTS: Record<S16QueryGroup, string> = {
  WHAT: 'Tokens and amounts',
  WHO: 'Senders and receivers',
  CHANGED: 'Earlier and later transfers',
  PROVES: 'Inspect a transfer you found',
}

const PROTOTYPE_QUERY_COPY: Readonly<Record<S16QueryId, Pick<S16QueryPlan, 'title' | 'conditions'> & { expected: string }>> = Object.freeze({
  Q2: { title: 'Which DAI transfers match the amount in the file?', conditions: ['Token: DAI (the contract in the Euler file)', 'Amount: 8,000,000–9,500,000 DAI'], expected: 'Transfers matching both clues.' },
  Q3: { title: 'Did DAI leave the first address for the second route?', conditions: ['Sender: First Engine · Receiver: Receiving Vault', 'The transaction record that establishes the transfer, not a supporting entry'], expected: 'One transaction that establishes the connection.' },
  A_DAI: { title: 'Which transfers moved DAI?', conditions: ['Token: DAI'], expected: 'Every matching record, ready to inspect.' },
  A_OTHER: { title: 'Which transfers moved other tokens?', conditions: ['Token: stETH, wstETH, USDC or WBTC'], expected: 'Every matching record, ready to inspect.' },
  A_LARGE: { title: 'Which DAI transfers exceed one million?', conditions: ['Token: DAI', 'Amount: more than 1,000,000 DAI'], expected: 'Every matching record, ready to inspect.' },
  R_REPEAT: { title: 'Which address pairs made repeated transfers?', conditions: ['The same sender and receiver appear in more than one transaction'], expected: 'Every matching record, ready to inspect.' },
  R_FIRST: { title: 'Which transfers involve the First Engine?', conditions: ['Sender or receiver: First Engine'], expected: 'Every matching record, ready to inspect.' },
  R_VAULT: { title: 'Which transfers reach the Receiving Vault?', conditions: ['Receiver: Receiving Vault'], expected: 'Every matching record, ready to inspect.' },
  S_BEFORE: { title: 'Which transfers happened before 09:00?', conditions: ['Time: before 09:00 UTC'], expected: 'Every matching record, ready to inspect.' },
  S_AFTER: { title: 'Which transfers happened from 09:00 onward?', conditions: ['Time: 09:00–12:15 UTC'], expected: 'Every matching record, ready to inspect.' },
  P_VIEWS: { title: 'Which transactions have more than one record?', conditions: ['The same transaction hash appears in multiple records'], expected: 'Every matching record, ready to inspect.' },
  P_START: { title: 'Which records describe the first breach transaction?', conditions: ['Transaction: the starting point you added to the case'], expected: 'Every matching record, ready to inspect.' },
  P_LINK: { title: 'Which records describe the later route transaction?', conditions: ['Transaction: the later movement you discovered'], expected: 'Every matching record, ready to inspect.' },
})

/** Presentation-only copy; query evaluation continues to use the production plan. */
export function prototypeQueryCopy(plan: S16QueryPlan) { return PROTOTYPE_QUERY_COPY[plan.id] }

export interface PrototypeRecordRow {
  id: string
  time: string
  token: string
  route: string
  accessibleLabel: string
}

const value = (candidate: unknown) => candidate === null || candidate === undefined || candidate === '' ? 'Not recorded' : String(candidate)
const compact = (candidate: unknown, head = 8, tail = 5) => {
  const whole = value(candidate)
  return whole.length <= head + tail + 1 ? whole : `${whole.slice(0, head)}…${whole.slice(-tail)}`
}

export function prototypeClock(record: Pick<S13Record, 'block_timestamp'>) {
  const timestamp = value(record.block_timestamp)
  return timestamp.includes('T') ? timestamp.split('T')[1]!.replace('Z', '') : '—'
}

export function prototypeDisplayDate(candidate: unknown) {
  const timestamp = value(candidate)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(timestamp)) return timestamp === 'Not recorded' ? '' : timestamp
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${timestamp.slice(8, 10)} ${months[Number(timestamp.slice(5, 7)) - 1]} ${timestamp.slice(0, 4)} · ${timestamp.slice(11, 19)} UTC`
}

export function prototypeAmount(record: Pick<S13Record, 'transfer_amount'> & Partial<Pick<S13Record, 'token_symbol' | 'token_address'>>) {
  const raw = value(record.transfer_amount)
  const [whole, fraction] = raw.split('.')
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${grouped}${fraction !== undefined ? `.${fraction}` : ''} ${s16TokenSymbol(record as S13Record)}`
}

/** Narrow truth adapter: presentation receives no mock/prototype state. */
export function prototypeRecordRow(record: S13Record): PrototypeRecordRow {
  const timestamp = value(record.block_timestamp)
  const token = s16TokenSymbol(record)
  return {
    id: record.recordId,
    time: prototypeClock(record),
    token,
    route: `${compact(record.from_address)} → ${compact(record.to_address)}`,
    accessibleLabel: `Open record. ${timestamp}. ${token}. ${value(record.from_address)} to ${value(record.to_address)}.`,
  }
}

export function prototypeExploreCopy(fileRead: boolean, recordCount: number) {
  return {
    task: 'EXPLORE',
    thread: fileRead ? 'Browse records or ask another question.' : 'Browse the records while you look for the file.',
    allRecords: `${recordCount} records · no filters applied`,
    questionTypes: fileRead ? 'Choose what to look for.' : 'Collect the Euler file to unlock case questions.',
  } as const
}
