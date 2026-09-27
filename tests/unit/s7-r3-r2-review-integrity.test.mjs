import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { APPROVAL_STATES, COMMENT_CATEGORIES, computeActStates, compareRevisions, migrateSelectedComments, validateReviewBook } from '../../scripts/nq5-s7-r3/workbench-integrity.mjs'

const read = (name) => JSON.parse(readFileSync(`artifacts/principal-review/${name}`, 'utf8'))
const model = read('WORKBENCH_MODEL.json')
const empty = read('FIXTURE_CURRENT_REVIEW_BOOK.json')
const prior = read('FIXTURE_PRIOR_REVIEW_BOOK.json')
const context = { revisionRegistry: model.revisionRegistry }
const validComment = {
  anchor: 'puzzle:NODE.REQUEST', category: 'PUZZLE', approval: 'APPROVE', author: 'Principal',
  timestamp: '2026-09-19T00:00:00.000Z', sourceRevision: model.revision, itemId: 'puzzle:NODE.REQUEST', text: 'Reviewed.',
}

describe('S7-R3-R2 explicit ownership and act aggregation', () => {
  it('classifies all 235 anchors exactly once with required semantic ownership', () => {
    const graph = model.ownershipGraph
    expect(model.reviewAnchors).toHaveLength(235)
    expect(graph.rows).toHaveLength(235)
    expect(new Set(graph.rows.map((row) => row.anchor)).size).toBe(235)
    expect(graph.rows.find((row) => row.anchor === 'puzzle:NODE.REQUEST').owner).toBe('ACT-1')
    expect(graph.rows.filter((row) => row.anchor.startsWith('evidence:')).every((row) => row.owner === 'ACT-2')).toBe(true)
    expect(graph.rows.find((row) => row.anchor === 'puzzle:NODE.THEORY').owner).toBe('ACT-3')
    expect(graph.rows.find((row) => row.anchor === 'puzzle:NODE.PROOF').owner).toBe('ACT-4')
    expect(graph.rows.find((row) => row.anchor === 'dialogue:RETURN').owner).toBe('ACT-5')
  })

  it('keeps the correct act unresolved while sibling approvals and GLOBAL comments cannot hide it', () => {
    const unresolved = { ...validComment, approval: 'REVISE', text: 'Revise request node.' }
    const sibling = { ...validComment, anchor: 'puzzle:NODE.TUBE', itemId: 'puzzle:NODE.TUBE', text: 'Tube approved.' }
    const global = { ...validComment, anchor: 'journey:DIRECT', itemId: 'journey:DIRECT', approval: 'REVISE', text: 'Global journey note.' }
    let states = computeActStates(model.ownershipGraph, [unresolved, sibling, global])
    expect(states['ACT-1'].state).toBe('UNRESOLVED')
    expect(states['ACT-1'].unresolvedChildren).toContain('puzzle:NODE.REQUEST')
    expect(states['ACT-2'].unresolved).toBe(0)
    states = computeActStates(model.ownershipGraph, [unresolved, { ...sibling, approval: 'APPROVE_WITH_NOTE' }])
    expect(states['ACT-1'].unresolvedChildren).toEqual(['puzzle:NODE.REQUEST'])
  })
})

describe('S7-R3-R2 strict atomic review-book validation', () => {
  it('round-trips a complete current book and deterministically removes exact duplicates', () => {
    const value = { ...empty, comments: [validComment, structuredClone(validComment)] }
    const result = validateReviewBook(value, context)
    expect(result.ok).toBe(true)
    expect(result.value.comments).toEqual([validComment])
    expect(result.duplicatesRemoved).toBe(1)
  })

  it.each([
    ['anchor', 'unsupported:anchor'], ['category', 'BAD'], ['approval', 'BAD'], ['itemId', 'puzzle:NODE.TUBE'],
    ['author', ''], ['text', ''], ['timestamp', 'not-a-date'], ['sourceRevision', 'unknown-revision'],
  ])('rejects invalid %s without mutating the supplied current book', (field, invalid) => {
    const activeBefore = JSON.stringify(empty)
    const candidate = { ...empty, comments: [{ ...validComment, [field]: invalid }] }
    expect(validateReviewBook(candidate, context).ok).toBe(false)
    expect(JSON.stringify(empty)).toBe(activeBefore)
  })

  it('rejects unknown comment fields and mixed valid/invalid books as one atomic unit', () => {
    const invalid = { ...validComment, category: 'BAD', extra: true }
    const result = validateReviewBook({ ...empty, comments: [validComment, invalid] }, context)
    expect(result.ok).toBe(false)
    expect(result.value).toBeNull()
    expect(COMMENT_CATEGORIES).toContain(validComment.category)
    expect(APPROVAL_STATES).toContain(validComment.approval)
  })
})

describe('S7-R3-R2 per-item revision comparison and deliberate migration', () => {
  it('classifies SAME, CHANGED, MISSING, and NEW deterministically with both identities', () => {
    const first = compareRevisions(model.anchorSourceIdentities, prior.anchorSourceIdentities, prior.comments)
    const second = compareRevisions(model.anchorSourceIdentities, prior.anchorSourceIdentities, prior.comments)
    expect(first).toEqual(second)
    expect(Object.values(first.counts).every((count) => count > 0)).toBe(true)
    const changed = first.items.find((item) => item.anchor === 'puzzle:NODE.REQUEST')
    expect(changed.status).toBe('CHANGED')
    expect(changed.priorSourceIdentity).not.toBe(changed.currentSourceIdentity)
    expect(first.items.find((item) => item.anchor === 'legacy:RETIRED_REVIEW_ITEM').status).toBe('MISSING')
    expect(first.items.find((item) => item.anchor === 'concept:E-04').status).toBe('NEW')
  })

  it('carries nothing without selection, permits SAME bulk selection, and requires CHANGED item selection', () => {
    const comparison = compareRevisions(model.anchorSourceIdentities, prior.anchorSourceIdentities, prior.comments)
    expect(migrateSelectedComments(comparison, [])).toEqual([])
    const sameAnchors = comparison.items.filter((item) => item.status === 'SAME').map((item) => item.anchor)
    const sameOnly = migrateSelectedComments(comparison, [], { sameAnchors, changedAnchors: [] })
    expect(sameOnly.map((comment) => comment.anchor)).toEqual(['performance:PERF.OPEN.RIGHT.BEAT'])
    const withChanged = migrateSelectedComments(comparison, sameOnly, { sameAnchors: [], changedAnchors: ['puzzle:NODE.REQUEST'] })
    expect(withChanged.map((comment) => comment.anchor)).toContain('puzzle:NODE.REQUEST')
    expect(withChanged.map((comment) => comment.anchor)).not.toContain('legacy:RETIRED_REVIEW_ITEM')
  })
})
