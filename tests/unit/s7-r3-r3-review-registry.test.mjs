import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ACCEPTED_R2_REVISION, PRIOR_R1_REVISION, canonicalIdentity, commentIdentity,
  compareRevisions, migrateSelectedComments, validUtcTimestamp, validateReviewBook, validateRevisionRegistry,
} from '../../scripts/nq5-s7-r3/workbench-integrity.mjs'

const read = (name) => JSON.parse(readFileSync(`artifacts/principal-review/${name}`, 'utf8'))
const model = read('WORKBENCH_MODEL.json')
const current = read('FIXTURE_CURRENT_REVIEW_BOOK.json')
const acceptedR2 = read('FIXTURE_ACCEPTED_R2_REVIEW_BOOK.json')
const prior = read('FIXTURE_PRIOR_REVIEW_BOOK.json')
const alteredPrior = read('FIXTURE_ALTERED_PRIOR_ITEM_IDENTITY.json')
const schema = read('REVIEW_BOOK.schema.json')
const context = { revisionRegistry: model.revisionRegistry }
const clone = (value) => structuredClone(value)
const registryEntry = (revision) => model.revisionRegistry.entries.find((entry) => entry.revision === revision)

describe('S7-R3-R3 accepted revision registry', () => {
  it('binds accepted R1, accepted R2, migration fixture, and current R3 with one canonical digest', () => {
    expect(validateRevisionRegistry(model.revisionRegistry)).toEqual({ ok: true, errors: [] })
    expect(model.revisionRegistryDigest).toBe(model.revisionRegistry.digest)
    expect(registryEntry(PRIOR_R1_REVISION).anchors).toHaveLength(235)
    expect(registryEntry(ACCEPTED_R2_REVISION).anchors).toHaveLength(235)
    expect(registryEntry(model.revision).anchors).toHaveLength(235)
    expect(model.knownRevisions).toEqual(model.revisionRegistry.entries.map((entry) => entry.revision))
  })

  it('accepts exact registered prior/current exports and rejects registry digest tampering', () => {
    expect(validateReviewBook(prior, context).ok).toBe(true)
    expect(validateReviewBook(acceptedR2, context).ok).toBe(true)
    expect(validateReviewBook(current, context).ok).toBe(true)
    const registry = clone(model.revisionRegistry)
    registry.entries[0].anchorSetDigest = '0'.repeat(64)
    expect(validateRevisionRegistry(registry).ok).toBe(false)
  })

  it.each([
    ['altered prior per-item identity', () => alteredPrior],
    ['substituted whole-source identity', () => ({ ...clone(prior), sourceIdentity: { substituted: true } })],
    ['added prior anchor', () => { const value = clone(prior); value.anchorSourceIdentities['fake:ADDED'] = { sha256: '1'.repeat(64) }; return value }],
    ['removed prior anchor', () => { const value = clone(prior); delete value.anchorSourceIdentities['performance:PERF.OPEN.RIGHT.BEAT']; return value }],
    ['renamed prior anchor', () => { const value = clone(prior); value.anchorSourceIdentities['puzzle:NODE.REQUEST_RENAMED'] = value.anchorSourceIdentities['puzzle:NODE.REQUEST']; delete value.anchorSourceIdentities['puzzle:NODE.REQUEST']; return value }],
    ['unknown revision', () => ({ ...clone(prior), revision: 'UNKNOWN:REVISION' })],
    ['source revision without comment anchor', () => { const value = clone(prior); value.comments.find((comment) => comment.anchor.startsWith('legacy:')).sourceRevision = ACCEPTED_R2_REVISION; return value }],
  ])('atomically rejects %s without mutating the active current book', (_label, candidate) => {
    const before = JSON.stringify(current)
    const result = validateReviewBook(candidate(), context)
    expect(result.ok).toBe(false)
    expect(result.value).toBeNull()
    expect(JSON.stringify(current)).toBe(before)
  })

  it('cannot turn the registered CHANGED request item into SAME by imported self-description', () => {
    expect(validateReviewBook(alteredPrior, context).ok).toBe(false)
    const acceptedPrior = registryEntry(prior.revision)
    const acceptedCurrent = registryEntry(model.revision)
    const comparison = compareRevisions(acceptedCurrent.anchorSourceIdentities, acceptedPrior.anchorSourceIdentities, prior.comments)
    expect(comparison.items.find((item) => item.anchor === 'puzzle:NODE.REQUEST').status).toBe('CHANGED')
    const sameAnchors = comparison.items.filter((item) => item.status === 'SAME').map((item) => item.anchor)
    const migrated = migrateSelectedComments(comparison, [], { sameAnchors, changedAnchors: [] })
    expect(migrated.some((comment) => comment.anchor === 'puzzle:NODE.REQUEST')).toBe(false)
  })
})

describe('S7-R3-R3 strict UTC calendar timestamps', () => {
  it.each(['2026-02-29T00:00:00.000Z','2026-02-31T00:00:00.000Z','2026-02-00T00:00:00.000Z','2026-04-31T00:00:00.000Z','2026-01-01T24:00:00.000Z','2026-01-01T00:60:00.000Z','2026-01-01T00:00:60.000Z','2026-01-01T00:00:00.0Z','2026-01-01T00:00:00.00Z','2026-01-01T00:00:00.0000Z','2026-01-01T00:00:00+00:00','x2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Zx'])('rejects %s', (timestamp) => {
    expect(validUtcTimestamp(timestamp)).toBe(false)
  })

  it.each(['2024-02-29T00:00:00.000Z','2026-09-19T00:00:00Z',new Date().toISOString()])('accepts %s', (timestamp) => {
    expect(validUtcTimestamp(timestamp)).toBe(true)
  })

  it('keeps schema grammar aligned with the shared validator', () => {
    const timestamp = schema.properties.comments.items.properties.timestamp
    expect(timestamp.pattern).toBe('^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$')
    expect(timestamp.description).toContain('round-trip')
  })
})

describe('S7-R3-R3 canonical comment identity', () => {
  const ordered = prior.comments[0]
  const reversed = Object.fromEntries(Object.entries(ordered).reverse())

  it('collapses opposite property order to the first semantic record', () => {
    expect(commentIdentity(ordered)).toBe(commentIdentity(reversed))
    const result = validateReviewBook({ ...clone(prior), comments: [ordered, reversed] }, context)
    expect(result.ok).toBe(true)
    expect(result.value.comments).toEqual([ordered])
    expect(result.duplicatesRemoved).toBe(1)
  })

  it.each(['text','approval','anchor','category','author','timestamp','itemId','sourceRevision'])('keeps a different %s as a different identity', (field) => {
    const changed = { ...ordered, [field]: `${ordered[field]}-different` }
    expect(commentIdentity(changed)).not.toBe(commentIdentity(ordered))
  })

  it('preserves array order and gives JSON and embedded Markdown the same active book', () => {
    expect(canonicalIdentity([1, 2])).not.toBe(canonicalIdentity([2, 1]))
    const encoded = Buffer.from(JSON.stringify(prior), 'utf8').toString('base64')
    const markdown = `# Book\n<!-- REVIEW_BOOK_JSON ${encoded} -->\n`
    const decoded = JSON.parse(Buffer.from(markdown.match(/<!-- REVIEW_BOOK_JSON ([A-Za-z0-9+/=]+) -->/)[1], 'base64').toString('utf8'))
    expect(validateReviewBook(decoded, context)).toEqual(validateReviewBook(prior, context))
  })

  it('uses canonical identities to avoid duplicating an already active comment during migration', () => {
    const comparison = compareRevisions(registryEntry(model.revision).anchorSourceIdentities, registryEntry(prior.revision).anchorSourceIdentities, [reversed])
    const migrated = migrateSelectedComments(comparison, [ordered], { sameAnchors: [ordered.anchor], changedAnchors: [] })
    expect(migrated).toEqual([ordered])
  })
})
