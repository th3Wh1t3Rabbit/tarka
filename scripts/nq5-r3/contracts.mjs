import fs from 'node:fs'
import { identity, sha, freeze } from '../nq5/schema.mjs'
import { extractDocumentFacts, resolveLocalSchema } from '../nq5/official.mjs'
import { admitContract } from '../nq5/planner.mjs'
const admitted = new WeakMap(), verifiedSnapshots = new WeakMap()
export const FAMILIES = Object.freeze({ transactions: 'profiler/address/transactions', 'historical-balances': 'profiler/address/historical-balances', counterparties: 'profiler/address/counterparties', lookup: 'transaction-with-token-transfer-lookup' })
export const QUESTIONS = Object.freeze([
  'Whether the redistribution allowance for `profiler/address/counterparty` applies to the documented endpoint `POST /api/v1/profiler/address/counterparties`.',
  'Whether responses or derived public-safe fields from `POST /api/v1/transaction-with-token-transfer-lookup` may be redistributed in a public application with visible Nansen attribution.',
])
export const PUBLIC_FIELDS = Object.freeze({
  'profiler/address/transactions': ['transaction_hash','block_timestamp','from_address','to_address','token_address','amount'],
  'profiler/address/historical-balances': ['token_address','balance','block_timestamp'],
  'profiler/address/counterparties': ['counterparty_address','transaction_count','volume'],
  'transaction-with-token-transfer-lookup': ['transaction_hash','block_timestamp','from_address','to_address','token_address','amount'],
})
const projectionPolicy = family => ({ family, fields: PUBLIC_FIELDS[family], attribution: 'Powered by Nansen API', visibleAttributionRequiredByLocalPolicy: true, unknownPublicFields: 'REJECT', rawBodyExport: 'FORBIDDEN', providerHeadersExport: 'FORBIDDEN', stripPrivateFieldsBeforeProjection: ['all labels','entity names','smart-money classifications','account data','credentials','private headers','raw bodies','unallowlisted metadata'], exactNumericStringsRequired: true, historicalCutoffEnforced: true, stateCannotProveExactEvent: true })
export function rejectUnsafePublicProjection(family, row) {
  if (!PUBLIC_FIELDS[family] || !row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).sort().join() !== [...PUBLIC_FIELDS[family]].sort().join()) throw new Error('Unknown, private or missing public field.')
  for (const [key,value] of Object.entries(row)) {
    if (typeof value !== 'string' && !(key === 'transaction_count' && Number.isSafeInteger(value) && value >= 0)) throw new Error('Unsafe public value.')
    if (typeof value === 'string' && /[\r\n\0]|@|Bearer\s|(?:api.?key|secret|credential)\s*[:=]|\/home\/|\/tmp\/|[A-Za-z]:\\/i.test(value)) throw new Error('Sensitive public value.')
    if (key.endsWith('_address') && !/^0x[\da-f]{40}$/i.test(value)) throw new Error('Invalid public address.')
    if (key === 'transaction_hash' && !/^0x[\da-f]{64}$/i.test(value)) throw new Error('Invalid receipt identity.')
    if (key === 'block_timestamp' && !Number.isFinite(Date.parse(value))) throw new Error('Invalid public timestamp.')
    if (['amount','balance','volume'].includes(key) && !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) throw new Error('Exact decimal required.')
  }
  return true
}
export function redistributionDecision(family, rules, answer) {
  const exact = rules.find(rule => rule.family === family)
  if (family === FAMILIES.transactions || family === FAMILIES['historical-balances']) return exact ? { disposition: 'PUBLICLY_ADMITTED_FOR_T1', sourceRule: exact } : { disposition: 'NOT_PUBLICLY_ADMITTED_FOR_T1', reason: 'Exact family is omitted or restricted.' }
  // Generated prose cannot manufacture source authority. Any clarification must
  // have a captured, exact positive authoritative source, not a suggested link.
  if (!answer?.capturedSourceRule || answer.httpStatus !== 200 || answer.generatedWithoutExactPositiveSource || answer.contradictory || answer.ambiguous || answer.capturedSourceRule.family !== family || answer.capturedSourceRule.status !== 'Allowed') return { disposition: 'NOT_PUBLICLY_ADMITTED_FOR_T1', reason: 'No exact authoritative positive clarification; singular/plural alias and omission are not permission.' }
  return { disposition: 'PUBLICLY_ADMITTED_FOR_T1', sourceRule: answer.capturedSourceRule }
}
const endpoints = body => [...body.matchAll(/```json\s*\n([\s\S]*?)\n```/g)].map(match => JSON.parse(match[1])).filter(doc => doc.openapi && doc.paths)
export function loadOfficialSnapshot(root) {
  const directory = root + '/docs/official/r3/', bytes = fs.readFileSync(directory + 'INDEX.json'), index = JSON.parse(bytes)
  const names = ['transactions','historical-balances','counterparties','lookup','pricing','rate-limits','coverage','redistribution','overview','clarification-1','clarification-2']
  if (index.providerCalls !== 0 || index.credentialResolution !== false || index.redirectsFollowed !== false || index.snapshots.length !== names.length || new Set(index.snapshots.map(doc => doc.name)).size !== names.length || index.snapshots.some(doc => !names.includes(doc.name)) || identity(fs.readdirSync(directory).sort()) !== identity(['INDEX.json',...names.filter(name=>name !== 'lookup').map(name => name + '.md')].sort())) throw new Error('Official snapshot inventory or scope mismatch.')
  const snapshots = index.snapshots.map(doc => {
    const url = new URL(doc.url)
    if (url.origin !== 'https://docs.nansen.ai' || url.username || url.password || url.hash || doc.file !== (doc.name === 'lookup' ? 'transactions.md' : doc.name + '.md') || !Number.isFinite(Date.parse(doc.retrievedAtUtc)) || Date.now() - Date.parse(doc.retrievedAtUtc) > 86400000 || Date.parse(doc.retrievedAtUtc) > Date.now()) throw new Error('Invalid documentation provenance or freshness.')
    if (doc.name.startsWith('clarification-')) {
      if (url.pathname !== '/guides/redistribution-guide.md' || [...url.searchParams.keys()].join() !== 'ask' || url.searchParams.get('ask') !== QUESTIONS[Number(doc.name.at(-1)) - 1]) throw new Error('Unauthorized clarification question.')
    } else if (url.search || !url.pathname.endsWith('.md')) throw new Error('Unexpected documentation query.')
    const paths = {transactions:'/api/profiler/address-transactions.md',lookup:'/api/profiler/address-transactions.md','historical-balances':'/api/profiler/address-historical-balances.md',counterparties:'/api/profiler/address-counterparties.md',pricing:'/getting-started/credits.md','rate-limits':'/getting-started/rate-limits.md',coverage:'/api/data-coverage.md',redistribution:'/guides/redistribution-guide.md',overview:'/api/overview.md'}
    if (!doc.name.startsWith('clarification-') && url.pathname !== paths[doc.name]) throw new Error('Documentation page is outside exact named scope.')
    const file = directory + doc.file
    if (!fs.lstatSync(file).isFile()) throw new Error('Nonregular official snapshot.')
    const bodyBytes = fs.readFileSync(file), body = new TextDecoder('utf-8', {fatal:true}).decode(bodyBytes)
    if (sha(bodyBytes) !== doc.bodySha256) throw new Error('Exact official bytes disagree.')
    const unavailable = body.startsWith('# Page Not Found') || doc.httpStatus !== 200
    if (unavailable !== (doc.status !== 'FETCHED')) throw new Error('HTTP200 unavailable content must not be admitted.')
    return {...doc, body, contracts: unavailable ? [] : endpoints(body), facts: extractDocumentFacts(doc.name,body)}
  })
  const snapshot = freeze({index, indexSha256:sha(bytes), snapshots, status:snapshots.filter(doc=>!doc.name.startsWith('clarification-')).every(doc=>doc.status === 'FETCHED') ? 'PASS_EXACT_REQUIRED_SNAPSHOTS' : 'INCOMPLETE_REQUIRED_ENDPOINT_SNAPSHOT'})
  verifiedSnapshots.set(snapshot,root); return snapshot
}
export function buildContractAdmission(snapshot, planClass = 'PRO') {
  if (!verifiedSnapshots.has(snapshot) || !['PRO','FREE'].includes(planClass)) throw new Error('Exact captured snapshot and observed plan class required.')
  const find = name => snapshot.snapshots.find(doc => doc.name === name), pricing = find('pricing'), rate = find('rate-limits'), coverage = find('coverage'), redistribution = find('redistribution')
  if ([pricing,rate,coverage,redistribution].some(doc => doc.status !== 'FETCHED') || !rate.facts.proPerMinute || !rate.facts.freePerMinute || !coverage.facts.ethereumFromUtc || redistribution.facts.attribution !== 'Powered by Nansen API') throw new Error('Shared exact policy/pricing/coverage/rate facts unresolved.')
  const perSecond = planClass === 'PRO' ? 75 : 15, perMinute = planClass === 'PRO' ? rate.facts.proPerMinute : rate.facts.freePerMinute
  if (!(planClass === 'PRO' ? /\| Pro \(all paid plans\)\s*\|\s*75 requests/ : /\| Free\s*\|\s*15 requests/).test(rate.body)) throw new Error('Exact plan second-window rate unresolved.')
  const source = doc => ({url:doc.url,retrievedAtUtc:doc.retrievedAtUtc,httpStatus:doc.httpStatus,bodySha256:doc.bodySha256,status:doc.status})
  const records = [], contracts = []
  for (const [name,family] of Object.entries(FAMILIES)) {
    const endpoint = find(name), path = '/api/v1/' + family, document = endpoint.contracts.find(doc => doc.paths[path]?.post), operation = document?.paths[path]?.post
    const credits = pricing.facts.endpointCosts[family]?.[planClass]
    const decision = redistributionDecision(family, redistribution.facts.rules, name === 'counterparties' || name === 'lookup' ? {httpStatus:find(name === 'counterparties' ? 'clarification-1' : 'clarification-2').httpStatus, generatedWithoutExactPositiveSource:true, ambiguous:true} : null)
    const requestSchema = operation ? resolveLocalSchema(document, operation.requestBody.content['application/json'].schema) : null
    const responseSchema = operation ? resolveLocalSchema(document, operation.responses['200'].content['application/json'].schema) : null
    const pagination = operation ? {request:requestSchema.properties.pagination ?? null,response:responseSchema.properties.pagination ?? null,admission:'Page1 only at genesis; later page requires durable explicit nonempty is_last_page=false plus named utility. Default values never prove continuation.'} : null
    if (!Number.isFinite(credits)) throw new Error('Exact family credit price unresolved.')
    const publiclyAdmitted = decision.disposition === 'PUBLICLY_ADMITTED_FOR_T1'
    if (publiclyAdmitted && (!operation || !requestSchema.properties.chain.enum.includes('ethereum') || !pagination.response?.properties.is_last_page || pagination.response.properties.is_last_page.type !== 'boolean')) throw new Error('Public family endpoint/chain/pagination unresolved.')
    const policy = projectionPolicy(family), rates = {planClass,planPerSecond:perSecond,planPerMinute:perMinute,endpointAdditionalPerMinute:null,endpointAdditionalLimitDisposition:'Not listed in current exact additional-limit table',localPerMinute:200,localMinimumDelayMs:250,localConcurrency:1}
    if (rate.body.includes('`POST ' + path + '`')) throw new Error('New endpoint-specific limit requires exact admission.')
    const sources = {endpoint:source(endpoint),pricing:source(pricing),rate:source(rate),coverage:source(coverage),redistribution:source(redistribution),...(name === 'counterparties' || name === 'lookup' ? {clarification:source(find(name === 'counterparties' ? 'clarification-1' : 'clarification-2'))} : {})}
    let contract = null
    if (publiclyAdmitted) {
      const snapshotDocuments = {endpoint:{mode:'NANSEN_OFFICIAL_OPENAPI',...source(endpoint),paths:{[path]:{post:{requestSchema,responseSchema}}}},pricing:{...source(pricing),planClass,credits,maximumCredits:credits},rate:{...source(rate),requestsPerMinute:200,minimumDelayMs:250,actualPlanLimits:rates},coverage:{...source(coverage),classification:'PAGINATED_BOUNDED',fromUtc:coverage.facts.ethereumFromUtc,revisionsPossible:true},redistribution:{...source(redistribution),policy:'ALLOWLIST_ONLY',sourceRule:decision.sourceRule,publicProjectionPolicy:policy}}
      contract = admitContract({admitted:true,family,path,method:'POST',requestSchema,responseSchema,credits,maximumCredits:credits,concurrency:1,requestsPerMinute:200,minimumDelayMs:250,coverage:'PAGINATED_BOUNDED',redistribution:'ALLOWLIST_ONLY',retrievedAtUtc:endpoint.retrievedAtUtc,snapshots:Object.fromEntries(Object.entries(snapshotDocuments).map(([key,value])=>[key,identity(value)])),snapshotDocuments})
      contracts.push(contract)
    }
    records.push({family,path,method:'POST',disposition:decision.disposition,reason:decision.reason ?? 'Exact current endpoint and exact redistribution table entry admitted.',qualificationCountedEligible:publiclyAdmitted,publicCallIndexEligible:publiclyAdmitted,endpointSchemaVerified:!!operation,requestSchema,responseSchema,pagination,credits,maximumCredits:credits,rateLimits:rates,ethereumHistoricalCoverage:{fromUtc:coverage.facts.ethereumFromUtc,revisionsPossible:true},redistributionClass:publiclyAdmitted ? 'ALLOWLIST_ONLY' : 'NOT_PUBLICLY_ADMITTED_FOR_T1',publicProjectionPolicy:policy,sources,contractHash:contract?.hash ?? null})
  }
  const result = freeze({schemaVersion:'1.0.0',status:snapshot.status === 'PASS_EXACT_REQUIRED_SNAPSHOTS' && contracts.length ? 'PASS_PLAN_SPECIFIC_CONTRACT_ADMISSION' : 'BLOCKED_WITH_EVIDENCE',requiredSnapshotComplete:snapshot.status === 'PASS_EXACT_REQUIRED_SNAPSHOTS',officialIndexSha256:snapshot.indexSha256,planClass,records,contracts,heldFamiliesAreNotCountedOrPubliclyIndexed:true,acceptedEulerEvidenceUnchanged:true,qualificationAttempts:0,qualificationCounted:0})
  admitted.set(result,{root:verifiedSnapshots.get(snapshot),snapshot}); return result
}
export function assertContractAdmission(value) {
  if (!admitted.has(value) || value.status !== 'PASS_PLAN_SPECIFIC_CONTRACT_ADMISSION' || !value.requiredSnapshotComplete || !value.contracts.length) throw new Error('Current complete exact contract admission required before genesis/freeze.')
  const proof = admitted.get(value), current = loadOfficialSnapshot(proof.root)
  if (current.indexSha256 !== value.officialIndexSha256 || identity(current.index) !== identity(proof.snapshot.index)) throw new Error('Current exact official snapshot changed.')
  for (const {hash,...contract} of value.contracts) if (identity(contract) !== hash || admitContract(contract).hash !== hash) throw new Error('Current official contract changed or expired.')
  return value
}
