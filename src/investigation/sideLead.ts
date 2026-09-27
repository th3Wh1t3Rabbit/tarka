import { R55_BRCG } from '../story/r55/production'

// Optional office-note token lead. Nothing exported here may enter or mutate
// Euler Hero records, questions, filters, theories, proof, or completion.
export const SIDE_LEAD_SOURCE_CLASS = 'OPTIONAL OFFICE-NOTE TOKEN LEAD / NOT EULER CASE EVIDENCE' as const
export const SIDE_LEAD_PROVENANCE = 'Frozen historical snapshot. Not Euler case evidence.' as const
/** Historical internal export retained for test/import compatibility; value is final R55 copy. */
export const SIDE_LEAD_PROVENANCE_LATE_BOUND = SIDE_LEAD_PROVENANCE
export interface SideLeadTokenChoice { id: 'BRCG'; name: typeof R55_BRCG.name; address: typeof R55_BRCG.contract; provenance: 'R55_ACCEPTED_SNAPSHOT' }
export const SIDE_LEAD_TOKENS: readonly SideLeadTokenChoice[] = [
  { id: 'BRCG', name: R55_BRCG.name, address: R55_BRCG.contract, provenance: 'R55_ACCEPTED_SNAPSHOT' },
]
export const SIDE_LEAD_HIGH_LEVEL_VIEW = {
  sourceClass: SIDE_LEAD_SOURCE_CLASS,
  title: 'Token God Mode · BRCG',
  lines: [
    `The note names ${R55_BRCG.quantity} ${R55_BRCG.symbol}.`,
    `At the frozen snapshot price, the theoretical value is ${R55_BRCG.summaryValue}.`,
    SIDE_LEAD_PROVENANCE,
  ],
} as const
export const SIDE_LEAD_TECHNICAL_VIEW = {
  sourceClass: SIDE_LEAD_SOURCE_CLASS,
  title: 'Exact accepted snapshot',
  fields: [
    ['Token', `${R55_BRCG.symbol} / ${R55_BRCG.name}`],
    ['Token contract', R55_BRCG.contract],
    ['Note quantity', `${R55_BRCG.quantity} ${R55_BRCG.symbol}`],
    ['Snapshot', R55_BRCG.snapshot],
    ['Exact unit price', R55_BRCG.unitPrice],
    ['Theoretical value', R55_BRCG.theoreticalValue],
    ['Liquidity', `${R55_BRCG.liquidity} (accepted exact value ${R55_BRCG.exactLiquidity})`],
    ['Last 7 days', `buyers ${R55_BRCG.buyers7d}; sellers ${R55_BRCG.sellers7d}; trading volume ${R55_BRCG.volume7d}; net flow ${R55_BRCG.netflow7d}`],
    ['Provenance', SIDE_LEAD_PROVENANCE],
  ],
} as const
