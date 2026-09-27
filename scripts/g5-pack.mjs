#!/usr/bin/env node
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'

const repositoryRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const temporaryRoot = path.join(repositoryRoot, '.g5-tools')
const publicRoot = path.join(repositoryRoot, 'public', 'scenarios', 'euler-2023-false-exit')
const jsonFiles = ['scenario.json', 'world.json', 'provenance.json', 'omitted-events.json', 'catalog.json', 'evidence-graph.json']
const publicPackAllowedKeys = new Set(`CASE_CONSTELLATION COMPLETE CONVERSION_TRACE COUNTER_RECONSTRUCTION ENTRY FORK HIGH_ACTIVITY OPENING PRISM_ARCHIVE PRISM_CONVERTER QUIET_RESERVOIR SIGNAL_RESIDUE THRESHOLD TIME_ANCHOR TRANSACTION_REPLAY TRUTH_ENGINE APPROACH CASE_INDEX BRANCH RETURN SYNTHESIS HYPOTHESIS HYPOTHESIS_TEST DEEP_TRACE RECEIVING_POINT CASE_ASSEMBLY actionLabel address alignBody alignTitle amount anchorLabel archive arrivalRadius asset assetAmounts basisEvidenceId body branches canonicalTheory captions caseFrame caseQuestion chain claim code compilerVersion completion completionAction contradictions conversionBody conversionEvidenceId conversionExact conversionTitle converter count cutoffUtc defaultScenarioId deepTraceBranchId deepTracePathId derivedFromEvidenceIds destination destinationBody destinationEvidenceId destinationExact destinationTitle disclaimer discoveryAction discoveryEvidenceIds display disposition durationMs endUtc entities entityId entries entryLabel eventId events evidence evidenceBody evidenceExact evidenceId evidenceIds evidenceStamp experiencePlan explanation facts fallbackOrder falsifiedCopy falsifiesTheoryOptionIds facingHint firstFalsifier firstScanMarker flow fork forkEvidenceId from fromEntityId gaps generatedAt grade historicalCutoff historicalWindow hypothesis hypothesisTestPathId id ids implementedProfiles independenceGroup independentForProof initiallyHidden insufficientCopy kind label missionLabel navigation negativeRowsPublished nodeId nodeIds nodes normalizedGraphHash normalizedObjectHashes normalizedSha256 numericPrecisionStatus objective objectives observedAtUtc omittedEventManifest opening openingEvidenceId options origin outboundPathId outcome passages position prelaunch presentation primaryAction proceduralOnly prominence proof proofDependencies proofEvidenceIds proofGrade provenanceCopy provenanceEvidenceIds provenanceRelationshipIds provesRoute question quiet rawResponseHashes rawSha256 reason receivingPathId redistribution relationships requiredEvidenceId requiredEvidenceIds resonanceProof retrievedAtUtc returnPathId role roleBindings route routeLabel scenarioHash scenarioId schemaVersion secondaryAction selectableDestination selectableEvidenceIds slot slots solvedTitle sourceEndpoint sourceFamilies sourceFamily spline stages startUtc stateLabel synthesisAction temporalClass testAction testActionLabel theoryOptions threshold title to toEntityId transactionHash transformation transitionAfterFirst truthAdvanceMode truthConclusion truthStages truthTimeline uncertainty unit version worldHash worldLabels worldProminence worldVersion wrongTheory activePresentationProfile approachPathId approachToGatePathId arrivalStage branchIds cameraLandmark confirmedCopy contextualEvidenceIds`.split(' '))
for (const key of ['entry-origin', 'record-gate', 'case-index', 'branch-primary', 'branch-secondary', 'protocol-subgraph', 'joining-gate', 'receiving-point', 'caseAssembly', 'sourceLineageId']) publicPackAllowedKeys.add(key)
const prohibitedPublicKey = /(?:secret|credential|authorization|api[_-]?key|private[_-]?key|(?:address|entity|wallet|smart[_-]?money)[_-]?labels?|raw(?:responseBody|providerBody|payload)|responsePayload)/i
const prohibitedPublicValue = /(?:^|[\s/_-])(?:smart[\s/_-]*money|wallet[\s/_-]*labels?|leaderboards?|trade[\s/_-]*execution)(?:$|[\s/_-])/i
const credentialLikeValue = /(?:^|\b)(?:sk-[A-Za-z0-9_-]{16,}|(?:api|secret|token|key)[_-][A-Za-z0-9_-]{16,})(?:$|\b)/i

function lintPublicPackValue(value, location, errors) {
  if (Array.isArray(value)) return value.forEach((item, index) => lintPublicPackValue(item, `${location}[${index}]`, errors))
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (!publicPackAllowedKeys.has(key)) errors.push(`${location}.${key}: field is not in the public-pack schema`)
      if (prohibitedPublicKey.test(key)) errors.push(`${location}.${key}: prohibited public field`)
      lintPublicPackValue(nested, `${location}.${key}`, errors)
    }
    return
  }
  if (typeof value === 'string') {
    if (/(?:\/home\/|\/Users\/|[A-Z]:\\\\)/.test(value)) errors.push(`${location}: absolute private path`)
    if (prohibitedPublicValue.test(value)) errors.push(`${location}: prohibited provider material`)
    if (credentialLikeValue.test(value)) errors.push(`${location}: credential-like value`)
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, canonical(nested)]))
  return value
}

function hash(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')}`
}

async function compileCatalog() {
  await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      ssr: path.join(repositoryRoot, 'src/game/scenario/catalog.ts'),
      outDir: temporaryRoot,
      emptyOutDir: true,
      rollupOptions: { output: { entryFileNames: 'catalog.mjs' } },
    },
  })
  const module = await import(`${pathToFileURL(path.join(temporaryRoot, 'catalog.mjs')).href}?v=${Date.now()}`)
  return module
}

async function generate() {
  const catalogModule = await compileCatalog()
  const catalog = catalogModule.scenarioCatalog
  const entry = catalog.entries.find(({ id }) => id === 'EULER_2023_FALSE_EXIT')
  if (!entry) throw new Error('Euler Hero is missing from the compiled catalog')
  const { scenario, world, provenance } = entry.bundle
  const evidenceGraph = catalogModule.eulerEvidenceGraph
  await mkdir(publicRoot, { recursive: true })
  const outputs = {
    'scenario.json': scenario,
    'world.json': world,
    'provenance.json': provenance,
    'omitted-events.json': scenario.omittedEventManifest,
    'catalog.json': { schemaVersion: catalog.schemaVersion, defaultScenarioId: catalog.defaultScenarioId, entries: catalog.entries.map(({ id, kind, title, bundle }) => ({ id, kind, title, scenarioHash: bundle.provenance.scenarioHash, worldHash: bundle.provenance.worldHash })) },
    'evidence-graph.json': evidenceGraph,
  }
  for (const [name, value] of Object.entries(outputs)) await writeFile(path.join(publicRoot, name), `${JSON.stringify(value, null, 2)}\n`)
  await writeFile(path.join(publicRoot, 'scenario.sha256'), `${provenance.scenarioHash.replace('sha256:', '')}\n`)
  await rm(temporaryRoot, { recursive: true, force: true })
  process.stdout.write(`PASS: generated ${Object.keys(outputs).length + 1} deterministic Euler public-pack files.\n`)
}

async function verify() {
  const parsed = Object.fromEntries(await Promise.all(jsonFiles.map(async (name) => [name, JSON.parse(await readFile(path.join(publicRoot, name), 'utf8'))])))
  const scenarioDigest = (await readFile(path.join(publicRoot, 'scenario.sha256'), 'utf8')).trim()
  const scenario = parsed['scenario.json']
  const world = parsed['world.json']
  const provenance = parsed['provenance.json']
  const omitted = parsed['omitted-events.json']
  const graph = parsed['evidence-graph.json']
  const providerPolicy = JSON.parse(await readFile(path.join(repositoryRoot, 'src/acquisition/config/nansen-endpoints.json'), 'utf8'))
  const errors = []
  if (provenance.scenarioHash !== hash(scenario)) errors.push('scenario hash mismatch')
  if (provenance.worldHash !== hash(world)) errors.push('world hash mismatch')
  if (provenance.normalizedGraphHash !== hash(graph)) errors.push('normalized evidence graph hash mismatch')
  if (scenarioDigest !== provenance.scenarioHash.replace('sha256:', '')) errors.push('scenario.sha256 mismatch')
  if (scenario.scenarioId !== world.scenarioId || scenario.scenarioId !== provenance.scenarioId) errors.push('scenario identity mismatch')
  if (JSON.stringify(omitted) !== JSON.stringify(scenario.omittedEventManifest)) errors.push('omitted-event manifest mismatch')
  if (!world.proceduralOnly) errors.push('world is not procedural-only')
  for (const item of scenario.evidence) {
    const policies = providerPolicy.endpoints.filter(({ endpoint }) => endpoint === item.sourceEndpoint)
    if (policies.length !== 1 || policies[0].redistribution !== 'PUBLIC_ALLOWLISTED' || item.redistribution !== 'PUBLIC_ALLOWLISTED') errors.push(`endpoint redistribution policy mismatch: ${item.id}`)
  }
  if (scenario.schemaVersion !== '3.0.0' || world.version !== '3.0.0' || provenance.schemaVersion !== '1.0.0' || graph.schemaVersion !== '1.0.0') errors.push('schema version mismatch')
  if (scenario.proofEvidenceIds.some((id) => scenario.evidence.find((item) => item.id === id)?.grade === 'CONTEXTUAL')) errors.push('contextual evidence closes solver proof')
  if (!scenario.evidence.some(({ grade }) => grade === 'EXACT') || !scenario.evidence.some(({ grade }) => grade === 'CORROBORATING') || !scenario.evidence.some(({ grade }) => grade === 'CONTEXTUAL')) errors.push('evidence grades incomplete')
  const evidenceIds = new Set(scenario.evidence.map(({ id }) => id))
  if (!evidenceIds.has(scenario.firstFalsifier) || scenario.proofEvidenceIds.some((id) => !evidenceIds.has(id)) || Object.values(scenario.contradictions).some(({ evidenceIds: ids }) => ids.some((id) => !evidenceIds.has(id)))) errors.push('solver evidence reference mismatch')
  if (scenario.evidence.some((item) => item.facts.negativeRowsPublished !== 0 || item.facts.assetAmounts.some(({ amount }) => !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount)))) errors.push('negative or invalid asset amount')
  const cutoff = Date.parse(scenario.historicalCutoff)
  if (scenario.evidence.some(({ observedAtUtc }) => observedAtUtc !== null && Date.parse(observedAtUtc) > cutoff) || graph.events.some(({ observedAtUtc }) => observedAtUtc !== null && Date.parse(observedAtUtc) > cutoff)) errors.push('post-cutoff evidence')
  const expectedFamilies = [...new Set(scenario.evidence.map(({ sourceFamily }) => sourceFamily))].sort()
  const expectedRaw = [...new Set(scenario.evidence.map(({ rawSha256 }) => rawSha256))].sort()
  const expectedNormalized = [...new Set(scenario.evidence.map(({ normalizedSha256 }) => normalizedSha256))].sort()
  if (JSON.stringify(provenance.sourceFamilies) !== JSON.stringify(expectedFamilies) || JSON.stringify(provenance.rawResponseHashes) !== JSON.stringify(expectedRaw) || JSON.stringify(provenance.normalizedObjectHashes) !== JSON.stringify(expectedNormalized)) errors.push('provenance evidence digest mismatch')
  const catalogEntry = parsed['catalog.json'].entries.find(({ id }) => id === scenario.scenarioId)
  if (!catalogEntry || catalogEntry.scenarioHash !== provenance.scenarioHash || catalogEntry.worldHash !== provenance.worldHash || parsed['catalog.json'].defaultScenarioId !== scenario.scenarioId) errors.push('catalog hash or default mismatch')
  const catalogModule = await compileCatalog()
  const compiledEntry = catalogModule.scenarioCatalog.entries.find(({ id }) => id === scenario.scenarioId)
  if (!compiledEntry || JSON.stringify(canonical(compiledEntry.bundle.scenario)) !== JSON.stringify(canonical(scenario)) || JSON.stringify(canonical(compiledEntry.bundle.world)) !== JSON.stringify(canonical(world)) || JSON.stringify(canonical(compiledEntry.bundle.provenance)) !== JSON.stringify(canonical(provenance)) || JSON.stringify(canonical(catalogModule.eulerEvidenceGraph)) !== JSON.stringify(canonical(graph))) errors.push('public pack differs from compiled source')
  const text = jsonFiles.map((name) => JSON.stringify(parsed[name])).join('\n')
  for (const name of jsonFiles) lintPublicPackValue(parsed[name], name, errors)
  for (const [label, pattern] of [
    ['absolute private path', /(?:\/home\/|\/Users\/|[A-Z]:\\\\)/],
    ['secret field', /(?:apiKey|accessKey|credential|authorizationBearer)/i],
    ['provider-only label data', /smart[_ -]?money|wallet[_ -]?label/i],
    ['raw provider body', /rawResponseBody|responsePayload/i],
    ['prohibited identity claim', /same human|common human control is proven|offchain coordination is proven/i],
  ]) if (pattern.test(text)) errors.push(label)
  if (errors.length) throw new Error(`G5 public-pack verification failed: ${errors.join('; ')}`)
  process.stdout.write('PASS: verified compact Euler pack, hashes, grades, omissions, and public boundary.\n')
}

const mode = process.argv[2]
try {
  if (mode === 'generate') await generate()
  else if (mode === 'verify') await verify()
  else throw new Error('Expected generate or verify')
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
