import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { prototypeAmount, prototypeDisplayDate, prototypeExploreCopy, prototypeRecordRow, TERMINAL_PROTOTYPE_IDENTITY, TERMINAL_QUERY_GROUP_LABELS } from '../../src/app/terminalPrototypeAdapter'
import type { S13Record } from '../../src/investigation/s13'

const record = {
  recordId: 'ROW.TEST', recordKind: 'TRANSFER_EVENT', semanticRole: 'CONTEXTUAL', block_timestamp: '2023-03-13T09:01:59Z', transfer_amount: '0.05',
  token_address: '0x6b175474e89094c44da98b954eedeac495271d0f',
  from_address: '0xe008e45935ab51db7e7d3d673d82b6d81200a0c2', to_address: '0xcbffe1f6e2d2c3e7d7212b3cff848941c374818b',
  transaction_hash: '0xfea1091dc10fcd5240751dc1cc789d00d83dbe3a9e21bd37e22bde13e7f2b69e',
} as S13Record

describe('S17-P2-R3 exact terminal presentation adapter', () => {
  it('pins the canonical authority and exact group vocabulary', () => {
    expect(TERMINAL_PROTOTYPE_IDENTITY).toMatchObject({
      name: 'TARKA_S16_TERMINAL_FLOW_PROTOTYPE_v0.13.0',
      sha256: '6dba2a13eca9bc4ea1b6559e076125b8d31cad7fcaa17b8bfcfc91d48d9d5a6f',
      stage: { width: 480, height: 270 },
      aperture: { x: 44, y: 12, width: 393, height: 219, padding: 5 },
      rows: '21px 18px 27px 119px 24px',
    })
    expect(TERMINAL_QUERY_GROUP_LABELS).toEqual({
      WHAT: 'WHAT MOVED?', WHO: 'WHICH ADDRESSES?', CHANGED: 'WHEN DID IT MOVE?', PROVES: 'CHECK A KNOWN TRANSACTION',
    })
  })

  it('adapts authoritative records to the exact TIME | TOKEN | ROUTE shape', () => {
    expect(prototypeRecordRow(record)).toEqual({
      id: 'ROW.TEST', time: '09:01:59', token: 'DAI',
      route: '0xe008e4…0a0c2 → 0xcbffe1…4818b',
      accessibleLabel: 'Open record. 2023-03-13T09:01:59Z. DAI. 0xe008e45935ab51db7e7d3d673d82b6d81200a0c2 to 0xcbffe1f6e2d2c3e7d7212b3cff848941c374818b.',
    })
    expect(prototypeRecordRow(record).token).not.toMatch(/Earlier|Later/)
    expect(prototypeDisplayDate(record.block_timestamp)).toBe('13 Mar 2023 · 09:01:59 UTC')
    expect(prototypeAmount(record)).toBe('0.05 DAI')
    expect(prototypeExploreCopy(true, 98)).toMatchObject({ allRecords: '98 records · no filters applied', questionTypes: 'Choose what to look for.' })
  })

  it('has one S16 presentation stylesheet and no stale parallel values or visible COPY control', () => {
    const css = readFileSync('src/app/terminal-viewport.css', 'utf8')
    const component = readFileSync('src/app/S16Terminal.tsx', 'utf8')
    expect(css.match(/\.s5-dom-safe \.s16-terminal\{/g)).toHaveLength(1)
    expect(css).toContain('grid-template-rows:21px 18px 27px 119px 24px')
    expect(css).toContain('grid-template-columns:43px 34px minmax(0,1fr)')
    expect(css).toContain('.s16-source-fields{font-size:6.2px;line-height:1.32')
    expect(component).not.toContain('WHAT HAPPENED?')
    expect(component).not.toContain('WHO INTERACTED?')
    expect(component).not.toMatch(/>COPY</)
    expect(component).not.toContain('TOKEN / AMOUNT')
  })
})
