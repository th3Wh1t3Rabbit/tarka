(() => {
  const CATEGORIES = ['KEEP', 'COPY', 'TIMING', 'EXPRESSION', 'STAGING', 'PUZZLE', 'INVENTORY', 'ART_REQUEST', 'SOUND', 'FACT', 'ACCESSIBILITY', 'CUT_OPTIONAL', 'QUESTION']
  const APPROVALS = ['UNREVIEWED', 'APPROVE', 'APPROVE_WITH_NOTE', 'REVISE', 'CUT', 'DEFER']
  const SCHEMA_VERSION = '3.0.0'
  const REGISTRY_ALGORITHM = 'SHA-256(UTF-8(stable-canonical-JSON + LF)); object keys sorted, array order preserved'
  const stable = (value) => Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
      : value
  const canonicalJson = (value) => JSON.stringify(stable(value))
  const rotateRight = (value, shift) => (value >>> shift) | (value << (32 - shift))
  const SHA256_K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ]
  function sha256(text) {
    const bytes = new TextEncoder().encode(text)
    const length = Math.ceil((bytes.length + 9) / 64) * 64
    const padded = new Uint8Array(length)
    padded.set(bytes)
    padded[bytes.length] = 0x80
    const view = new DataView(padded.buffer)
    const bitLength = bytes.length * 8
    view.setUint32(length - 8, Math.floor(bitLength / 0x100000000))
    view.setUint32(length - 4, bitLength >>> 0)
    const hash = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]
    const words = new Uint32Array(64)
    for (let offset = 0; offset < length; offset += 64) {
      for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4)
      for (let index = 16; index < 64; index += 1) {
        const left = words[index - 15]
        const right = words[index - 2]
        const sigma0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3)
        const sigma1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10)
        words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0
      }
      let [a,b,c,d,e,f,g,h] = hash
      for (let index = 0; index < 64; index += 1) {
        const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
        const choice = (e & f) ^ (~e & g)
        const first = (h + sum1 + choice + SHA256_K[index] + words[index]) >>> 0
        const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
        const majority = (a & b) ^ (a & c) ^ (b & c)
        const second = (sum0 + majority) >>> 0
        h = g; g = f; f = e; e = (d + first) >>> 0; d = c; c = b; b = a; a = (first + second) >>> 0
      }
      hash[0] = (hash[0] + a) >>> 0; hash[1] = (hash[1] + b) >>> 0
      hash[2] = (hash[2] + c) >>> 0; hash[3] = (hash[3] + d) >>> 0
      hash[4] = (hash[4] + e) >>> 0; hash[5] = (hash[5] + f) >>> 0
      hash[6] = (hash[6] + g) >>> 0; hash[7] = (hash[7] + h) >>> 0
    }
    return hash.map((value) => value.toString(16).padStart(8, '0')).join('')
  }
  const digest = (value) => sha256(`${canonicalJson(value)}\n`)
  const commentIdentity = (comment) => digest(comment)
  const exactKeys = (object, keys) => object && typeof object === 'object' && !Array.isArray(object) && canonicalJson(Object.keys(object).sort()) === canonicalJson([...keys].sort())
  function validUtcTimestamp(value) {
    const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/.exec(value)
    if (!match) return false
    const instant = new Date(value)
    if (Number.isNaN(instant.getTime())) return false
    const canonical = instant.toISOString()
    return match[7] ? canonical === value : canonical === value.replace(/Z$/, '.000Z')
  }
  function validateRevisionRegistry(registry) {
    const errors = []
    if (!exactKeys(registry, ['schemaVersion', 'algorithm', 'entries', 'digest'])) return { ok: false, errors: ['REGISTRY:CLOSED_SHAPE'] }
    if (registry.schemaVersion !== '1.0.0') errors.push('REGISTRY:SCHEMA_VERSION')
    if (registry.algorithm !== REGISTRY_ALGORITHM) errors.push('REGISTRY:ALGORITHM')
    if (!Array.isArray(registry.entries) || !registry.entries.length) errors.push('REGISTRY:ENTRIES')
    const revisions = new Set()
    for (const [index, entry] of (Array.isArray(registry.entries) ? registry.entries : []).entries()) {
      const label = `REGISTRY_ENTRY_${index}`
      if (!exactKeys(entry, ['revision', 'sourceIdentity', 'sourceIdentityDigest', 'anchors', 'anchorSetDigest', 'anchorSourceIdentities', 'anchorSourceIdentitiesDigest'])) { errors.push(`${label}:CLOSED_SHAPE`); continue }
      if (typeof entry.revision !== 'string' || !entry.revision || revisions.has(entry.revision)) errors.push(`${label}:REVISION`)
      revisions.add(entry.revision)
      if (!entry.sourceIdentity || typeof entry.sourceIdentity !== 'object' || Array.isArray(entry.sourceIdentity) || digest(entry.sourceIdentity) !== entry.sourceIdentityDigest) errors.push(`${label}:SOURCE_IDENTITY`)
      if (!Array.isArray(entry.anchors) || canonicalJson(entry.anchors) !== canonicalJson([...new Set(entry.anchors)].sort()) || digest(entry.anchors) !== entry.anchorSetDigest) errors.push(`${label}:ANCHOR_SET`)
      const identityAnchors = Object.keys(entry.anchorSourceIdentities ?? {}).sort()
      if (canonicalJson(identityAnchors) !== canonicalJson(entry.anchors ?? []) || digest(entry.anchorSourceIdentities) !== entry.anchorSourceIdentitiesDigest) errors.push(`${label}:ANCHOR_IDENTITIES`)
    }
    if (digest({ schemaVersion: registry.schemaVersion, algorithm: registry.algorithm, entries: registry.entries }) !== registry.digest) errors.push('REGISTRY:DIGEST')
    return { ok: errors.length === 0, errors }
  }
  function validateReviewBook(value, context) {
    const errors = []
    const registryValidation = validateRevisionRegistry(context.revisionRegistry)
    if (!registryValidation.ok) errors.push(...registryValidation.errors.map((error) => `CONTEXT:${error}`))
    const registryEntries = new Map((context.revisionRegistry?.entries ?? []).map((entry) => [entry.revision, entry]))
    if (!exactKeys(value, ['schemaVersion', 'revision', 'sourceIdentity', 'anchorSourceIdentities', 'comments'])) return { ok: false, errors: [...errors, 'BOOK:CLOSED_SHAPE'], value: null }
    if (value.schemaVersion !== SCHEMA_VERSION) errors.push('BOOK:SCHEMA_VERSION')
    const bookRevision = registryEntries.get(value.revision)
    if (!bookRevision) errors.push('BOOK:REVISION_UNKNOWN')
    if (!value.sourceIdentity || typeof value.sourceIdentity !== 'object' || Array.isArray(value.sourceIdentity)) errors.push('BOOK:SOURCE_IDENTITY')
    if (!value.anchorSourceIdentities || typeof value.anchorSourceIdentities !== 'object' || Array.isArray(value.anchorSourceIdentities)) errors.push('BOOK:ANCHOR_IDENTITIES')
    if (bookRevision && digest(value.sourceIdentity) !== bookRevision.sourceIdentityDigest) errors.push('BOOK:SOURCE_IDENTITY_REGISTRY_MISMATCH')
    if (bookRevision && digest(value.anchorSourceIdentities) !== bookRevision.anchorSourceIdentitiesDigest) errors.push('BOOK:ANCHOR_IDENTITIES_REGISTRY_MISMATCH')
    const allowedAnchors = new Set(bookRevision?.anchors ?? [])
    if (!Array.isArray(value.comments)) errors.push('BOOK:COMMENTS_ARRAY')
    const comments = []
    const seen = new Set()
    for (const [index, comment] of (Array.isArray(value.comments) ? value.comments : []).entries()) {
      const label = `COMMENT_${index}`
      if (!exactKeys(comment, ['anchor', 'category', 'approval', 'author', 'timestamp', 'sourceRevision', 'itemId', 'text'])) { errors.push(`${label}:CLOSED_SHAPE`); continue }
      if (!allowedAnchors.has(comment.anchor)) errors.push(`${label}:ANCHOR`)
      if (!CATEGORIES.includes(comment.category)) errors.push(`${label}:CATEGORY`)
      if (!APPROVALS.includes(comment.approval)) errors.push(`${label}:APPROVAL`)
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
  function compareRevisions(currentIdentities, priorIdentities, priorComments = []) {
    const anchors = [...new Set([...Object.keys(currentIdentities), ...Object.keys(priorIdentities)])].sort()
    const items = anchors.map((anchor) => {
      const current = currentIdentities[anchor]?.sha256 ?? null
      const prior = priorIdentities[anchor]?.sha256 ?? null
      const status = current && prior ? current === prior ? 'SAME' : 'CHANGED' : prior ? 'MISSING' : 'NEW'
      return { anchor, status, priorSourceIdentity: prior, currentSourceIdentity: current, priorComments: priorComments.filter((comment) => comment.anchor === anchor) }
    })
    return { schemaVersion: '1.0.0', counts: Object.fromEntries(['SAME', 'CHANGED', 'MISSING', 'NEW'].map((status) => [status, items.filter((item) => item.status === status).length])), items }
  }
  window.WorkbenchIntegrity = { stable, canonicalJson, digest, commentIdentity, validUtcTimestamp, validateRevisionRegistry, validateReviewBook, compareRevisions }
})()
