import { FAMILY_PURPOSES, admitContract } from './planner.mjs'
import { identity } from './schema.mjs'

export function resolveLocalSchema(document, value, seen = new Set()) {
  if (Array.isArray(value)) return value.map((item) => resolveLocalSchema(document, item, seen))
  if (!value || typeof value !== 'object') return value
  if (value.$ref) {
    if (!value.$ref.startsWith('#/') || seen.has(value.$ref)) throw new Error('Remote or recursive contract reference is not admitted.')
    const target = value.$ref.slice(2).split('/').reduce((node, key) => node?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], document)
    if (!target) throw new Error('Unresolved local contract reference.')
    return resolveLocalSchema(document, target, new Set([...seen, value.$ref]))
  }
  // Documentation annotations are not part of the executable schema identity.
  return Object.fromEntries(Object.entries(value).filter(([key]) => !['description', 'title', 'examples', 'example', 'default'].includes(key)).map(([key, child]) => [key, resolveLocalSchema(document, child, seen)]))
}

export function extractDocumentFacts(name, body) {
  const strip = (value) => value.replace(/<[^>]*>/g, '').trim()
  if (name === 'pricing') return { endpointCosts: Object.fromEntries([...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].flatMap((match) => { const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => strip(cell[1])); return cells.length === 3 && (FAMILY_PURPOSES[cells[0]] || cells[0] === 'account') && /^\d+$/.test(cells[1]) && /^\d+$/.test(cells[2]) ? [[cells[0], { FREE: Number(cells[1]), PRO: Number(cells[2]) }]] : [] })) }
  if (name === 'rate-limits') return { freePerMinute: /^\| Free\s*\|\s*15 requests\s*\|\s*300 requests/m.test(body) ? 300 : null, proPerMinute: /^\| Pro \(all paid plans\)\s*\|\s*75 requests\s*\|\s*1,500 requests/m.test(body) ? 1500 : null }
  if (name === 'coverage') return { ethereumFromUtc: /\| Ethereum\s*\| 30 Jul 2015\s*\|/.test(body) ? '2015-07-30T00:00:00Z' : null, historicalRevisionsPossible: body.includes('not immutable response snapshots') }
  if (name === 'redistribution') return { rules: [...body.matchAll(/^\|\s*([^|]+?)\s*\|\s*✅ Allowed\s*\|\s*([^|]+?)\s*\|/gm)].map((match) => ({ family: match[1].trim(), requirement: match[2].trim() })), attribution: body.includes('Powered by Nansen API') ? 'Powered by Nansen API' : null }
  return {}
}

export function officialContract(refresh, family, planClass) {
  if (!FAMILY_PURPOSES[family] || !['FREE', 'PRO'].includes(planClass) || refresh.status !== 'PASS_PUBLIC_DOC_REFRESH_ONLY') throw new Error('Official admission requires observed plan class and complete public refresh.')
  const find = (name) => refresh.snapshots.find((snapshot) => snapshot.name === name && snapshot.status === 'FETCHED')
  const endpoint = refresh.snapshots.flatMap((snapshot) => (snapshot.contracts ?? []).map((doc) => ({ snapshot, doc }))).find(({ doc }) => Object.keys(doc.paths).includes(`/api/${family.includes('historical-transactions') ? 'v1beta1' : 'v1'}/${family}`))
  const pricing = find('pricing'), rate = find('rate-limits'), coverage = find('coverage'), redistribution = find('redistribution')
  const path = `/api/${family.includes('historical-transactions') ? 'v1beta1' : 'v1'}/${family}`
  const operation = endpoint?.doc.paths[path]?.post
  const credits = pricing?.facts.endpointCosts?.[family]?.[planClass]
  const rule = redistribution?.facts.rules?.find((item) => item.family === family)
  // Do not infer permission for a differently named or undocumented endpoint.
  if (!operation || !Number.isFinite(credits) || !rule || !coverage?.facts.ethereumFromUtc || redistribution.facts.attribution !== 'Powered by Nansen API' || !Number.isFinite(rate?.facts[planClass === 'FREE' ? 'freePerMinute' : 'proPerMinute'])) throw new Error('Plan-specific pricing, coverage, rate or redistribution rule is unresolved.')
  const requestSchema = resolveLocalSchema(endpoint.doc, operation.requestBody.content['application/json'].schema)
  const responseSchema = resolveLocalSchema(endpoint.doc, operation.responses['200'].content['application/json'].schema)
  const snapshotDocuments = { endpoint: { mode: 'NANSEN_OFFICIAL_OPENAPI', url: endpoint.snapshot.url, bodySha256: endpoint.snapshot.bodySha256, paths: { [path]: { post: { requestSchema, responseSchema } } } }, pricing: { url: pricing.url, bodySha256: pricing.bodySha256, planClass, credits, maximumCredits: credits }, rate: { url: rate.url, bodySha256: rate.bodySha256, requestsPerMinute: 200, minimumDelayMs: 250 }, coverage: { url: coverage.url, bodySha256: coverage.bodySha256, classification: 'PAGINATED_BOUNDED', fromUtc: coverage.facts.ethereumFromUtc }, redistribution: { url: redistribution.url, bodySha256: redistribution.bodySha256, policy: 'ALLOWLIST_ONLY', sourceRule: rule } }
  return admitContract({ admitted: true, family, path, method: 'POST', requestSchema, responseSchema, credits, maximumCredits: credits, concurrency: 1, requestsPerMinute: 200, minimumDelayMs: 250, coverage: 'PAGINATED_BOUNDED', redistribution: 'ALLOWLIST_ONLY', retrievedAtUtc: endpoint.snapshot.retrievedAtUtc, snapshots: Object.fromEntries(Object.entries(snapshotDocuments).map(([key, value]) => [key, identity(value)])), snapshotDocuments })
}
