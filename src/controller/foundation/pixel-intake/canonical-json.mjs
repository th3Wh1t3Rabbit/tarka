// Canonical JSON serialization: plain objects with sorted keys, arrays in
// order, primitives as JSON. Used for deterministic review packets so that
// identical inputs produce byte-identical output. Rejects non-plain values.
export function canonicalize(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('PACKET_NON_FINITE_NUMBER')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  if (typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`
  }
  throw new Error('PACKET_NON_CANONICAL_VALUE')
}

export function canonicalJson(value) {
  return `${canonicalize(value)}\n`
}
