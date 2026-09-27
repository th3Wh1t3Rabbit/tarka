import { createHash } from 'node:crypto'

export const COMMENT_CATEGORIES = ['KEEP', 'COPY', 'TIMING', 'EXPRESSION', 'STAGING', 'PUZZLE', 'INVENTORY', 'ART_REQUEST', 'SOUND', 'FACT', 'ACCESSIBILITY', 'CUT_OPTIONAL', 'QUESTION']
export const APPROVAL_STATES = ['UNREVIEWED', 'APPROVE', 'APPROVE_WITH_NOTE', 'REVISE', 'CUT', 'DEFER']
export const UNRESOLVED_STATES = ['REVISE', 'CUT', 'DEFER']
export const CURRENT_SCHEMA_VERSION = '3.0.0'
export const PRIOR_R1_REVISION = 'S7-R3-R1:aeae341942c2573887aac0d142cabbd75ccdbeb8ac1e878e55bb5037d1904d8f'
export const ACCEPTED_R2_REVISION = 'S7-R3-R2:0dd6d4276f36c8283e7d64562b1caa8bc918a1b48dadc9661d5a64a4841ce445'
export const REVISION_REGISTRY_ALGORITHM = 'SHA-256(UTF-8(stable-canonical-JSON + LF)); object keys sorted, array order preserved'

export const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value

export const digest = (value) => createHash('sha256').update(JSON.stringify(stable(value)) + '\n').digest('hex')
export const canonicalJson = (value) => JSON.stringify(stable(value))
export const canonicalIdentity = (value) => digest(value)
export const commentIdentity = (comment) => canonicalIdentity(comment)

export function buildRevisionRegistry(entries) {
  const normalized = entries.map(({ revision, sourceIdentity, anchorSourceIdentities }) => {
    const anchors = Object.keys(anchorSourceIdentities).sort()
    const normalizedIdentities = Object.fromEntries(anchors.map((anchor) => [anchor, stable(anchorSourceIdentities[anchor])]))
    return {
      revision,
      sourceIdentity: stable(sourceIdentity),
      sourceIdentityDigest: digest(sourceIdentity),
      anchors,
      anchorSetDigest: digest(anchors),
      anchorSourceIdentities: normalizedIdentities,
      anchorSourceIdentitiesDigest: digest(normalizedIdentities),
    }
  }).sort((left, right) => left.revision.localeCompare(right.revision))
  const body = { schemaVersion: '1.0.0', algorithm: REVISION_REGISTRY_ALGORITHM, entries: normalized }
  return { ...body, digest: digest(body) }
}

export function validateRevisionRegistry(registry) {
  const errors = []
  const exactKeys = (object, keys, label) => {
    if (!object || typeof object !== 'object' || Array.isArray(object)) { errors.push(`${label}:OBJECT_REQUIRED`); return false }
    if (canonicalJson(Object.keys(object).sort()) !== canonicalJson([...keys].sort())) errors.push(`${label}:CLOSED_SHAPE`)
    return true
  }
  if (!exactKeys(registry, ['schemaVersion', 'algorithm', 'entries', 'digest'], 'REGISTRY')) return { ok: false, errors }
  if (registry.schemaVersion !== '1.0.0') errors.push('REGISTRY:SCHEMA_VERSION')
  if (registry.algorithm !== REVISION_REGISTRY_ALGORITHM) errors.push('REGISTRY:ALGORITHM')
  if (!Array.isArray(registry.entries) || !registry.entries.length) errors.push('REGISTRY:ENTRIES')
  const revisions = new Set()
  for (const [index, entry] of (Array.isArray(registry.entries) ? registry.entries : []).entries()) {
    const label = `REGISTRY_ENTRY_${index}`
    if (!exactKeys(entry, ['revision', 'sourceIdentity', 'sourceIdentityDigest', 'anchors', 'anchorSetDigest', 'anchorSourceIdentities', 'anchorSourceIdentitiesDigest'], label)) continue
    if (typeof entry.revision !== 'string' || !entry.revision || revisions.has(entry.revision)) errors.push(`${label}:REVISION`)
    revisions.add(entry.revision)
    if (!entry.sourceIdentity || typeof entry.sourceIdentity !== 'object' || Array.isArray(entry.sourceIdentity) || digest(entry.sourceIdentity) !== entry.sourceIdentityDigest) errors.push(`${label}:SOURCE_IDENTITY`)
    if (!Array.isArray(entry.anchors) || entry.anchors.some((anchor) => typeof anchor !== 'string' || !anchor) || canonicalJson(entry.anchors) !== canonicalJson([...new Set(entry.anchors)].sort()) || digest(entry.anchors) !== entry.anchorSetDigest) errors.push(`${label}:ANCHOR_SET`)
    if (!entry.anchorSourceIdentities || typeof entry.anchorSourceIdentities !== 'object' || Array.isArray(entry.anchorSourceIdentities)) errors.push(`${label}:ANCHOR_IDENTITIES`)
    const identityAnchors = Object.keys(entry.anchorSourceIdentities ?? {}).sort()
    if (canonicalJson(identityAnchors) !== canonicalJson(entry.anchors ?? []) || digest(entry.anchorSourceIdentities) !== entry.anchorSourceIdentitiesDigest) errors.push(`${label}:ANCHOR_IDENTITIES_DIGEST`)
    for (const [anchor, identity] of Object.entries(entry.anchorSourceIdentities ?? {})) if (!identity || typeof identity !== 'object' || Array.isArray(identity) || !/^[a-f0-9]{64}$/.test(identity.sha256 ?? '')) errors.push(`${label}:ANCHOR_IDENTITY:${anchor}`)
  }
  const body = { schemaVersion: registry.schemaVersion, algorithm: registry.algorithm, entries: registry.entries }
  if (digest(body) !== registry.digest) errors.push('REGISTRY:DIGEST')
  return { ok: errors.length === 0, errors }
}

export function validUtcTimestamp(value) {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/.exec(value)
  if (!match) return false
  const instant = new Date(value)
  if (Number.isNaN(instant.getTime())) return false
  const canonical = instant.toISOString()
  return match[7] ? canonical === value : canonical === value.replace(/Z$/, '.000Z')
}

function itemForAnchor(model, anchor) {
  const [kind, ...parts] = anchor.split(':')
  const id = parts.join(':')
  if (kind === 'act') return model.acts.find((item) => item.id === id)
  if (kind === 'puzzle') return model.puzzle.find((item) => item.id === id)
  if (kind === 'timeline') return model.timeline.find((item) => item.id === id)
  if (kind === 'interaction') return model.interactions.find((item) => item.anchor === anchor)
  if (kind === 'dialogue') return model.dialogues.sequences.find((item) => item.id === id)
  if (kind === 'dialogue-menu') return model.dialogues.menus.find((item) => item.id === id)
  if (kind === 'dialogue-choice') {
    const [menuId, choiceId] = parts
    const menu = model.dialogues.menus.find((item) => item.id === menuId)
    const choice = menu?.choices.find((item) => item.id === choiceId)
    return choice ? { menuId, ...choice } : undefined
  }
  if (kind === 'performance') return model.performance.find((item) => item.id === id)
  if (kind === 'evidence') return model.evidence.records.find((item) => item.id === id)
  if (kind === 'journey') return model.journeys.find((item) => item.id === id)
  if (kind === 'art') return model.artIntentions.find((item) => item.intention === id)
  if (kind === 'concept') return model.concepts.find((item) => item.id === id)
  if (kind === 'renderer') return model.rendererRisk.find((item) => item.key === id)
}

export function buildAnchorSourceIdentities(model, anchors) {
  return Object.fromEntries(anchors.map((anchor) => {
    const item = itemForAnchor(model, anchor)
    if (!item) throw new Error(`ANCHOR_SOURCE_NOT_FOUND:${anchor}`)
    return [anchor, { sha256: digest({ anchor, item }), sourceType: anchor.split(':')[0], sourceId: anchor.slice(anchor.indexOf(':') + 1) }]
  }))
}

const PUZZLE_OWNER = {
  'NODE.REQUEST': 'ACT-1', 'NODE.TUBE': 'ACT-1', 'NODE.ACCESS': 'ACT-1', 'NODE.SEA': 'ACT-2',
  'NODE.THEORY': 'ACT-3', 'NODE.PROOF': 'ACT-4', 'NODE.RETURN': 'ACT-5',
}
const TIMELINE_OWNER = {
  START: 'ACT-0', TICKET_PULLED: 'ACT-1', REQUEST_COMPLETED: 'ACT-1', REQUEST_STAMPED: 'ACT-1',
  REQUEST_IN_TUBE: 'ACT-1', TUBE_CLOSED: 'ACT-1', DISPATCHED: 'ACT-1', CANISTER_OPEN: 'ACT-1',
  STRIP_TAKEN: 'ACT-1', TERMINAL_UNLOCKED: 'ACT-1', EVIDENCE_SEA: 'ACT-2', CANDIDATES: 'ACT-2',
  THEORY_FILED: 'ACT-3', PROOF_COMPLETE: 'ACT-4', RETURNED: 'ACT-5',
}
const DIALOGUE_OWNER = { OPENING: 'ACT-0', WRONG_THEORY: 'ACT-3', EXACT_CORRECTION: 'ACT-4', RETURN: 'ACT-5', RETURN_TAG: 'ACT-5' }
const MENU_OWNER = { PRE_STAMP: 'ACT-1', POST_ACCESS: 'ACT-2' }
const PERFORMANCE_OWNER = {
  OPEN: 'ACT-0', WRONG: 'ACT-3', EXACT: 'ACT-4', RETURN: 'ACT-5',
}

function ownershipFor(model, anchor) {
  const [kind, ...parts] = anchor.split(':')
  const id = parts.join(':')
  if (kind === 'act') return { owner: id, rationale: 'Direct act review anchor.' }
  if (kind === 'puzzle') return { owner: PUZZLE_OWNER[id], rationale: `Puzzle node ${id} is resolved in its declared act.` }
  if (kind === 'timeline') return { owner: TIMELINE_OWNER[id], rationale: `Milestone ${id} belongs to the act that produces or consumes it.` }
  if (kind === 'interaction') {
    const [hotspot, verb] = parts
    if (['historical-clock', 'office-globe'].includes(hotspot)) return { owner: 'GLOBAL', rationale: 'Optional ambient desk interaction is reusable outside a required act.' }
    if (hotspot === 'nansen-terminal' && verb !== 'USE') return { owner: 'ACT-2', rationale: 'Terminal exploration belongs to the evidence-sea act.' }
    return { owner: 'ACT-1', rationale: 'Physical Records Office procedure belongs to the request act.' }
  }
  if (kind === 'dialogue') return { owner: DIALOGUE_OWNER[id], rationale: `Sequence ${id} has an explicit narrative act.` }
  if (kind === 'dialogue-menu' || kind === 'dialogue-choice') {
    const menuId = parts[0]
    return { owner: MENU_OWNER[menuId], rationale: `Menu ${menuId} is available only in its declared act state.` }
  }
  if (kind === 'performance') {
    const section = parts[0]?.split('.')[1]
    const owner = PERFORMANCE_OWNER[section] ?? 'GLOBAL'
    return { owner, rationale: owner === 'GLOBAL' ? 'Optional ambient performance is reusable and not required by one act.' : `Performance section ${section} is bound to its exact dialogue act.` }
  }
  if (kind === 'evidence') return { owner: 'ACT-2', rationale: 'Accepted semantic evidence-sea item is reviewed in the evidence-sea act.' }
  if (kind === 'journey') return { owner: 'GLOBAL', rationale: 'Journey spans multiple acts and cannot truthfully belong to only one.' }
  if (kind === 'art') {
    const performance = model.performance.find((item) => item.intention === id)
    if (performance) return ownershipFor(model, `performance:${performance.id}`)
    return { owner: 'GLOBAL', rationale: 'Reusable capability intention spans multiple sequences or acts.' }
  }
  if (kind === 'concept') return { owner: 'GLOBAL', rationale: 'Review-only optional concept is not admitted into any act.' }
  if (kind === 'renderer') {
    const key = id
    if (key.startsWith('lane_a.s7r2b.opening.')) return { owner: 'ACT-0', rationale: 'Opening renderer line belongs to the opening act.' }
    if (key.includes('.menu.PRE_STAMP.')) return { owner: 'ACT-1', rationale: 'Pre-stamp renderer line belongs to request procedure.' }
    if (key.includes('.menu.POST_ACCESS.') || key.includes('.folder.contextual') || key.includes('.matrix.nansen-terminal.')) return { owner: 'ACT-2', rationale: 'Terminal/context renderer line belongs to evidence-sea review.' }
    if (key.includes('.question.exact_link') || key.includes('.exact_correction.')) return { owner: 'ACT-4', rationale: 'Exact-link renderer line belongs to exact proof.' }
    if (key.includes('.matrix.request-dispenser.')) return { owner: 'ACT-1', rationale: 'Request-dispenser renderer line belongs to request procedure.' }
    return { owner: 'GLOBAL', rationale: 'Renderer-risk line has no exclusive act relationship.' }
  }
  throw new Error(`OWNERSHIP_KIND_UNHANDLED:${anchor}`)
}

export function buildOwnershipGraph(model, anchors) {
  const rows = anchors.map((anchor) => ({ anchor, ...ownershipFor(model, anchor) }))
  for (const row of rows) if (!['ACT-0', 'ACT-1', 'ACT-2', 'ACT-3', 'ACT-4', 'ACT-5', 'GLOBAL'].includes(row.owner) || !row.rationale) throw new Error(`INVALID_OWNERSHIP:${row.anchor}`)
  if (new Set(rows.map(({ anchor }) => anchor)).size !== anchors.length || rows.length !== anchors.length) throw new Error('OWNERSHIP_NOT_EXACTLY_ONCE')
  return {
    schemaVersion: '1.0.0',
    classificationCount: rows.length,
    rows,
    byOwner: Object.fromEntries(['ACT-0', 'ACT-1', 'ACT-2', 'ACT-3', 'ACT-4', 'ACT-5', 'GLOBAL'].map((owner) => [owner, rows.filter((row) => row.owner === owner).map((row) => row.anchor)])),
  }
}

export function validateReviewBook(value, context) {
  const errors = []
  const exactKeys = (object, keys, label) => {
    if (!object || typeof object !== 'object' || Array.isArray(object)) { errors.push(`${label}:OBJECT_REQUIRED`); return false }
    const actual = Object.keys(object).sort()
    if (JSON.stringify(actual) !== JSON.stringify([...keys].sort())) errors.push(`${label}:CLOSED_SHAPE`)
    return true
  }
  const registryValidation = validateRevisionRegistry(context.revisionRegistry)
  if (!registryValidation.ok) errors.push(...registryValidation.errors.map((error) => `CONTEXT:${error}`))
  const registryEntries = new Map((context.revisionRegistry?.entries ?? []).map((entry) => [entry.revision, entry]))
  if (!exactKeys(value, ['schemaVersion', 'revision', 'sourceIdentity', 'anchorSourceIdentities', 'comments'], 'BOOK')) return { ok: false, errors, value: null }
  if (value.schemaVersion !== CURRENT_SCHEMA_VERSION) errors.push('BOOK:SCHEMA_VERSION')
  const bookRevision = registryEntries.get(value.revision)
  if (!bookRevision) errors.push('BOOK:REVISION_UNKNOWN')
  if (!value.sourceIdentity || typeof value.sourceIdentity !== 'object' || Array.isArray(value.sourceIdentity)) errors.push('BOOK:SOURCE_IDENTITY')
  if (!value.anchorSourceIdentities || typeof value.anchorSourceIdentities !== 'object' || Array.isArray(value.anchorSourceIdentities)) errors.push('BOOK:ANCHOR_IDENTITIES')
  if (bookRevision && digest(value.sourceIdentity) !== bookRevision.sourceIdentityDigest) errors.push('BOOK:SOURCE_IDENTITY_REGISTRY_MISMATCH')
  if (bookRevision && digest(value.anchorSourceIdentities) !== bookRevision.anchorSourceIdentitiesDigest) errors.push('BOOK:ANCHOR_IDENTITIES_REGISTRY_MISMATCH')
  const allowedAnchors = new Set(bookRevision?.anchors ?? [])
  for (const [anchor, identity] of Object.entries(value.anchorSourceIdentities ?? {})) {
    if (typeof anchor !== 'string' || !anchor || !identity || typeof identity !== 'object' || !/^[a-f0-9]{64}$/.test(identity.sha256 ?? '')) errors.push(`ANCHOR_IDENTITY:${anchor}`)
  }
  if (!Array.isArray(value.comments)) errors.push('BOOK:COMMENTS_ARRAY')
  const comments = []
  const seen = new Set()
  for (const [index, comment] of (Array.isArray(value.comments) ? value.comments : []).entries()) {
    const label = `COMMENT_${index}`
    if (!exactKeys(comment, ['anchor', 'category', 'approval', 'author', 'timestamp', 'sourceRevision', 'itemId', 'text'], label)) continue
    if (!allowedAnchors.has(comment.anchor)) errors.push(`${label}:ANCHOR`)
    if (!COMMENT_CATEGORIES.includes(comment.category)) errors.push(`${label}:CATEGORY`)
    if (!APPROVAL_STATES.includes(comment.approval)) errors.push(`${label}:APPROVAL`)
    if (comment.itemId !== comment.anchor) errors.push(`${label}:ITEM_ID`)
    if (typeof comment.author !== 'string' || !comment.author.trim() || comment.author.length > 80) errors.push(`${label}:AUTHOR`)
    if (typeof comment.text !== 'string' || !comment.text.trim() || comment.text.length > 4000) errors.push(`${label}:TEXT`)
    if (!validUtcTimestamp(comment.timestamp)) errors.push(`${label}:TIMESTAMP`)
    const sourceRevision = registryEntries.get(comment.sourceRevision)
    if (!sourceRevision) errors.push(`${label}:SOURCE_REVISION`)
    else if (!sourceRevision.anchors.includes(comment.anchor)) errors.push(`${label}:SOURCE_REVISION_ANCHOR`)
    const identity = commentIdentity(comment)
    if (!seen.has(identity)) { seen.add(identity); comments.push(structuredClone(comment)) }
  }
  return errors.length ? { ok: false, errors, value: null } : { ok: true, errors: [], value: { ...structuredClone(value), comments }, duplicatesRemoved: value.comments.length - comments.length }
}

export function computeActStates(ownershipGraph, comments) {
  const commentsFor = (anchor) => comments.filter((comment) => comment.anchor === anchor)
  const anchorState = (anchor) => {
    const own = commentsFor(anchor)
    if (own.some((comment) => UNRESOLVED_STATES.includes(comment.approval))) return 'UNRESOLVED'
    if (own.some((comment) => ['APPROVE', 'APPROVE_WITH_NOTE'].includes(comment.approval))) return 'APPROVED'
    return own.length ? 'REVIEWED' : 'UNREVIEWED'
  }
  return Object.fromEntries(['ACT-0', 'ACT-1', 'ACT-2', 'ACT-3', 'ACT-4', 'ACT-5'].map((act) => {
    const children = ownershipGraph.byOwner[act].filter((anchor) => anchor !== `act:${act}`)
    const unresolvedChildren = children.filter((anchor) => anchorState(anchor) === 'UNRESOLVED')
    const reviewedChildren = children.filter((anchor) => anchorState(anchor) !== 'UNREVIEWED')
    const approvedChildren = children.filter((anchor) => anchorState(anchor) === 'APPROVED')
    const directState = anchorState(`act:${act}`)
    const state = directState === 'UNRESOLVED' || unresolvedChildren.length ? 'UNRESOLVED'
      : directState === 'APPROVED' && approvedChildren.length === children.length ? 'APPROVED'
        : 'UNREVIEWED'
    return [act, { state, directState, reviewed: reviewedChildren.length, approved: approvedChildren.length, total: children.length, unresolved: unresolvedChildren.length, unresolvedChildren }]
  }))
}

export function compareRevisions(currentIdentities, priorIdentities, priorComments = []) {
  const anchors = [...new Set([...Object.keys(currentIdentities), ...Object.keys(priorIdentities)])].sort()
  const items = anchors.map((anchor) => {
    const current = currentIdentities[anchor]?.sha256 ?? null
    const prior = priorIdentities[anchor]?.sha256 ?? null
    const status = current && prior ? current === prior ? 'SAME' : 'CHANGED' : prior ? 'MISSING' : 'NEW'
    return { anchor, status, priorSourceIdentity: prior, currentSourceIdentity: current, priorComments: priorComments.filter((comment) => comment.anchor === anchor) }
  })
  return { schemaVersion: '1.0.0', counts: Object.fromEntries(['SAME', 'CHANGED', 'MISSING', 'NEW'].map((status) => [status, items.filter((item) => item.status === status).length])), items }
}

export function migrateSelectedComments(comparison, activeComments, selection = { sameAnchors: [], changedAnchors: [] }) {
  const same = new Set(selection.sameAnchors)
  const changed = new Set(selection.changedAnchors)
  const selected = comparison.items.filter((item) => item.status === 'SAME' ? same.has(item.anchor) : item.status === 'CHANGED' ? changed.has(item.anchor) : false).flatMap((item) => item.priorComments)
  const result = structuredClone(activeComments)
  const seen = new Set(result.map(commentIdentity))
  for (const comment of selected) {
    const identity = commentIdentity(comment)
    if (!seen.has(identity)) { seen.add(identity); result.push(structuredClone(comment)) }
  }
  return result
}

export function reviewBookSchema(revision, revisionRegistry, currentAnchors) {
  const knownRevisions = revisionRegistry.entries.map((entry) => entry.revision)
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object', additionalProperties: false,
    required: ['schemaVersion', 'revision', 'sourceIdentity', 'anchorSourceIdentities', 'comments'],
    properties: {
      schemaVersion: { const: CURRENT_SCHEMA_VERSION }, revision: { enum: knownRevisions }, sourceIdentity: { type: 'object' },
      anchorSourceIdentities: { type: 'object', additionalProperties: { type: 'object', required: ['sha256'], properties: { sha256: { pattern: '^[a-f0-9]{64}$' } } } },
      comments: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['anchor', 'category', 'approval', 'author', 'timestamp', 'sourceRevision', 'itemId', 'text'], properties: {
        anchor: { type: 'string' }, category: { enum: COMMENT_CATEGORIES }, approval: { enum: APPROVAL_STATES }, itemId: { type: 'string' },
        author: { type: 'string', minLength: 1, maxLength: 80 }, text: { type: 'string', minLength: 1, maxLength: 4000 },
        timestamp: { type: 'string', format: 'date-time', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$', description: 'Strict UTC calendar instant; implementations must round-trip through toISOString exactly.' }, sourceRevision: { enum: knownRevisions },
      } } },
    },
    currentRevision: revision,
    currentAnchors,
    revisionRegistryDigest: revisionRegistry.digest,
  }
}
