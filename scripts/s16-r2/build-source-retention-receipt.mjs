import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const runtimePath = resolve(root, 'public/scenarios/euler-2023-false-exit/s13-runtime.json')
const runtimeBytes = readFileSync(runtimePath)
const runtime = JSON.parse(runtimeBytes)
const runtimeSha256 = createHash('sha256').update(runtimeBytes).digest('hex')
const expectedRuntimeSha256 = readFileSync(`${runtimePath}.sha256`, 'utf8').trim().split(/\s+/)[0]
if (runtimeSha256 !== expectedRuntimeSha256) throw new Error('Accepted runtime bytes do not match their retained digest')

const poolIds = new Set(runtime.evidenceDelta.stages[0].survivingRecordIds)
const records = runtime.caseCorpus.filter(record => poolIds.has(record.recordId))
if (records.length !== 98) throw new Error(`Expected 98 searchable records, received ${records.length}`)

const checkedLocations = [
  'public/scenarios/euler-2023-false-exit/s13-runtime.json',
  'public/scenarios/euler-2023-false-exit/s13-runtime.json.sha256',
  'public/scenarios/euler-2023-false-exit/provenance.json',
  'docs/source/execution-p2/52_G6P_NQ5_T1_P2_EXECUTION_CONTRACT.txt',
  'docs/source/execution-p2/53_USER_APPROVED_P1_IDENTITY_CROSSWALK_CORRECTION.json',
  'docs/source/execution-p2-r1/54_G6P_NQ5_T1_P2_R1_EXECUTION_CONTRACT.txt',
]

const classes = (associated, hero = false) => ({
  ledgerCanonicalRequest: {
    result: hero ? 'UNASSOCIATED_BY_ACCEPTED_MODEL' : 'HASH_ONLY',
    byteHashComparisonOccurred: false,
    detail: hero
      ? 'The accepted Hero record has no call-atlas/request association.'
      : 'The retained contracts and runtime reference immutable acceptance identities, but expose no named private ledger or canonical-request object path.',
  },
  primaryResponse: { result: hero ? 'NOT_CHECKED_NO_NAMED_OBJECT' : 'ABSENT_IN_CHECKED_LOCATIONS', byteHashComparisonOccurred: false },
  mirrorResponse: { result: hero ? 'NOT_CHECKED_NO_NAMED_OBJECT' : 'ABSENT_IN_CHECKED_LOCATIONS', byteHashComparisonOccurred: false },
  acceptedNormalization: {
    result: 'VERIFIED_BYTES',
    byteHashComparisonOccurred: true,
    expectedSha256: expectedRuntimeSha256,
    observedSha256: runtimeSha256,
    container: 'public/scenarios/euler-2023-false-exit/s13-runtime.json',
    recordCountInOrigin: associated.length,
    qualification: 'This verifies the accepted public runtime container, not an original provider response.',
  },
  namedRecoveryCopy: { result: hero ? 'NOT_CHECKED_NO_NAMED_OBJECT' : 'ABSENT_IN_CHECKED_LOCATIONS', byteHashComparisonOccurred: false },
})

const metadata = (hero = false) => ({
  requestMethod: hero ? 'UNASSOCIATED_BY_ACCEPTED_MODEL' : 'UNAVAILABLE_IN_CHECKED_RECORDS',
  endpointPath: hero ? 'UNASSOCIATED_BY_ACCEPTED_MODEL' : 'UNAVAILABLE_IN_CHECKED_RECORDS',
  safeRequestParameters: hero ? 'UNASSOCIATED_BY_ACCEPTED_MODEL' : 'UNAVAILABLE_IN_CHECKED_RECORDS',
  requestBodyIdentity: hero ? 'UNASSOCIATED_BY_ACCEPTED_MODEL' : 'UNAVAILABLE_IN_CHECKED_RECORDS',
  responseIdentity: hero ? 'UNASSOCIATED_BY_ACCEPTED_MODEL' : 'UNAVAILABLE_IN_CHECKED_RECORDS',
  issuedCollectionTimestamp: hero ? 'UNASSOCIATED_BY_ACCEPTED_MODEL' : 'UNAVAILABLE_IN_CHECKED_RECORDS',
  completedCollectionTimestamp: hero ? 'UNASSOCIATED_BY_ACCEPTED_MODEL' : 'UNAVAILABLE_IN_CHECKED_RECORDS',
  acceptedEventTimestamp: 'VERIFIED_IN_ACCEPTED_PUBLIC_NORMALIZATION',
})

const groups = new Map()
for (const record of records.filter(record => record.sourceLogicalRequestId)) {
  const list = groups.get(record.sourceLogicalRequestId) ?? []
  list.push(record)
  groups.set(record.sourceLogicalRequestId, list)
}

const origins = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, associated]) => ({
  publicSafeOriginId: `E03:${id}`,
  originKind: 'ACCEPTED_CONTEXTUAL_CALL_ORIGIN',
  associatedRecordIds: associated.map(record => record.recordId).sort(),
  expectedAdmittedHashes: {
    acceptanceBindingSha256: runtime.acceptance.bindingSha256,
    acceptedRuntimeContainerSha256: expectedRuntimeSha256,
    originalRequestResponseHashes: 'NOT_EXPOSED_BY_CHECKED_PROJECT_INDEXES',
  },
  inspectedObjectClasses: classes(associated),
  primaryMirrorAgreement: 'NOT_COMPARABLE_ORIGINAL_BYTES_UNAVAILABLE',
  metadata: metadata(),
}))

for (const record of records.filter(record => record.eulerHero)) origins.push({
  publicSafeOriginId: `HERO:${record.evidenceId}`,
  originKind: 'EXACT_HERO_WITHOUT_CALL_ATLAS_ASSOCIATION',
  associatedRecordIds: [record.recordId],
  expectedAdmittedHashes: {
    acceptedRuntimeContainerSha256: expectedRuntimeSha256,
    originalRequestResponseHashes: 'NO_ASSOCIATION_IN_ACCEPTED_MODEL',
  },
  inspectedObjectClasses: classes([record], true),
  primaryMirrorAgreement: 'NOT_APPLICABLE_NO_ACCEPTED_CALL_ASSOCIATION',
  metadata: metadata(true),
})

origins.sort((a, b) => a.publicSafeOriginId.localeCompare(b.publicSafeOriginId))
const coveredIds = new Set(origins.flatMap(origin => origin.associatedRecordIds))
if (coveredIds.size !== 98 || records.some(record => !coveredIds.has(record.recordId))) throw new Error('Origin inventory does not cover the full searchable corpus')

const receipt = {
  schema: 'trace-escape.s16-r2.source-retention-receipt.v1',
  scope: 'Bounded read-only inspection of named project indexes and accepted S16 searchable-corpus origins; no home/download/credential/network scan.',
  classificationEnum: ['VERIFIED_BYTES', 'HASH_ONLY', 'ABSENT_IN_CHECKED_LOCATIONS', 'NOT_CHECKED_NO_NAMED_OBJECT', 'UNASSOCIATED_BY_ACCEPTED_MODEL'],
  checkedLocations,
  checkedLocationPolicy: 'Only the listed project indexes/contracts and the exact source objects they name were considered. The contracts name integrity identities but do not expose a private ledger, primary, mirror, or recovery filesystem object path.',
  runtime: {
    searchableRecords: records.length,
    contextualRecords: records.filter(record => !record.eulerHero).length,
    exactHeroRecords: records.filter(record => record.eulerHero).length,
    distinctContextualOrigins: groups.size,
    runtimeSha256,
    runtimeDigestMatch: true,
    runtimeProviderCalls: runtime.productionBoundary.runtimeProviderCalls,
  },
  results: {
    originalsRecovered: 0,
    originalPrimaryMirrorPairsCompared: 0,
    normalizedPublicRuntimeVerified: true,
    missingMetadataGapRemains: true,
    conclusion: 'Accepted public normalization bytes are present and verified. Original request/response, primary/mirror, collection-time, and named recovery objects were not available through the bounded named project indexes. No global-loss claim and no reacquisition claim is made.',
  },
  origins,
  publicProjectionDecision: {
    enriched: false,
    reason: 'No additional independently verified per-origin fields were available. Existing static public-safe projection and exact Hero non-association are preserved.',
    prohibitedInference: 'Exact Hero records do not inherit provider endpoint or call metadata from same-hash contextual records.',
  },
}

const output = resolve(root, 'docs/review/s16-r2/SOURCE_RETENTION_RECEIPT.json')
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`)
console.log(`PASS_S16_R2_SOURCE_RETENTION ${origins.length} ${coveredIds.size} ${runtimeSha256}`)
