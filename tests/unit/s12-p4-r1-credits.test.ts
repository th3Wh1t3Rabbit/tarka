import { describe, expect, it } from 'vitest'
import credits from '../../src/app/CREDITS_PROVENANCE.json'

describe('S12-P4-R1 Credits provenance', () => {
  it('binds the Principal-supplied creator and public profile links', () => {
    expect(credits.createdBy).toEqual({
      displayName: 'th3Wh1t3Rabbit',
      authority: 'PRINCIPAL_DIRECT_2026-09-26',
      links: [
        { label: 'GitHub', href: 'https://github.com/th3Wh1t3Rabbit/tarka' },
        { label: 'X', href: 'https://x.com/th3Wh1t3Rabbit' },
        { label: 'Buy Me a Coffee', href: 'https://buymeacoffee.com/th3Wh1t3Rabbit' },
      ],
    })
  })

  it('keeps the contributor body intentionally empty', () => {
    expect(credits.contributorDisposition).toBe('CONTRIBUTOR_METADATA_NOT_YET_BOUND')
    expect(credits.contributors).toEqual([])
  })

  it('binds every source-governed competition, data, and title line to a source identity and claim boundary', () => {
    const visible = [
      ...credits.sections.createdFor,
      ...credits.sections.poweredBy,
      ...credits.sections.dataSources.filter((line) => line !== 'NANSEN API'),
      credits.sections.aboutTitle,
    ]
    expect(credits.bindings.map((binding) => binding.visibleLine)).toEqual(visible)
    for (const binding of credits.bindings) {
      expect(binding.sourcePath).not.toBe('')
      expect(binding.sourceSha256).toMatch(/^[0-9a-f]{64}$/)
      expect(binding.sourceFieldOrLine).not.toBe('')
      expect(binding.claimBoundary).not.toBe('')
    }
  })

  it('freezes the exact public-safe data and title copy', () => {
    expect(credits.sections.dataSources).toEqual([
      'NANSEN API',
      'ETHEREUM',
      'EULER FINANCE · MARCH 13, 2023',
      'FROZEN HISTORICAL CASE SNAPSHOT',
    ])
    expect(credits.sections.aboutTitle).toBe('TARKA (तर्क) — REASONING, LOGIC, INQUIRY. TEST A VIEW, EXCLUDE UNTENABLE ALTERNATIVES, AND CLOSE ONLY WHAT EXACT EVIDENCE SUPPORTS.')
  })
})
