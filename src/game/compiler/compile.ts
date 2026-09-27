import type {
  CompiledScenarioBundle,
  LeadCaseConfig,
  NormalizedEvidenceGraph,
  ScenarioManifest,
  ScenarioProvenance,
  WorldManifest,
  WorldRole,
} from '../scenario/contracts'
import { canonicalScenarioJson, sha256Scenario } from '../solver/hash'
import providerPolicy from '../../acquisition/config/nansen-endpoints.json'

const roles: WorldRole[] = ['entry-origin', 'record-gate', 'case-index', 'branch-primary', 'branch-secondary', 'protocol-subgraph', 'joining-gate', 'receiving-point']

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function assertHexHash(value: string, context: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new TypeError(`${context} must be a lowercase SHA-256 digest`)
}

function validateInputs(graph: NormalizedEvidenceGraph, config: LeadCaseConfig): void {
  if (graph.scenarioId !== config.scenarioId) throw new TypeError('Evidence graph and Lead config scenario IDs differ')
  if (graph.cutoffUtc !== config.historicalCutoff) throw new TypeError('Evidence graph cutoff does not match the Lead config')
  if (new Set(config.experiencePlan.stages).size !== config.experiencePlan.stages.length) throw new TypeError('Experience stages must be unique')
  if (config.experiencePlan.branchIds[0] !== config.branches[0].id || config.experiencePlan.branchIds[1] !== config.branches[1].id) throw new TypeError('Experience branch IDs must match the declared Lead branches')
  if (new Set(Object.values(config.experiencePlan.navigation.nodeIds)).size !== roles.length) throw new TypeError('Navigation node IDs must be unique')
  if (config.branches[0].nodeId !== config.experiencePlan.navigation.nodeIds['branch-primary'] || config.branches[1].nodeId !== config.experiencePlan.navigation.nodeIds['branch-secondary']) throw new TypeError('Branch arrival nodes must match the navigation plan')
  if ((config.experiencePlan.navigation.deepTraceBranchId === null) !== (config.experiencePlan.navigation.deepTracePathId === null)) throw new TypeError('Deep-trace branch and path must be declared together')
  if (config.experiencePlan.navigation.deepTraceBranchId !== null && !config.experiencePlan.branchIds.includes(config.experiencePlan.navigation.deepTraceBranchId)) throw new TypeError('Deep-trace branch must be declared by the experience plan')
  const evidenceIds = graph.evidence.map(({ id }) => id)
  if (new Set(evidenceIds).size !== evidenceIds.length) throw new TypeError('Evidence IDs must be unique')
  const cutoff = graph.cutoffUtc === null ? null : Date.parse(graph.cutoffUtc)
  if (graph.cutoffUtc !== null && !Number.isFinite(cutoff)) throw new TypeError('Evidence cutoff is invalid')
  for (const item of graph.evidence) {
    if (!Number.isFinite(Date.parse(item.retrievedAtUtc))) throw new TypeError(`Evidence retrieval timestamp is invalid: ${item.id}`)
    assertHexHash(item.rawSha256, `Evidence ${item.id} raw hash`)
    assertHexHash(item.normalizedSha256, `Evidence ${item.id} normalized hash`)
    if (item.redistribution !== 'PUBLIC_ALLOWLISTED') throw new TypeError(`Evidence is not public-allowlisted: ${item.id}`)
    if (config.kind === 'HISTORICAL_CASE') {
      const endpointPolicies = providerPolicy.endpoints.filter(({ endpoint }) => endpoint === item.sourceEndpoint)
      if (endpointPolicies.length !== 1 || endpointPolicies[0]!.redistribution !== 'PUBLIC_ALLOWLISTED') throw new TypeError(`Evidence endpoint is not public-allowlisted by reviewed provider policy: ${item.id}`)
    }
    if (item.temporalClass === 'HISTORICAL_AT_CUTOFF' && item.observedAtUtc !== null && cutoff !== null && Date.parse(item.observedAtUtc) > cutoff) throw new TypeError(`Evidence occurs after cutoff: ${item.id}`)
    for (const amount of item.facts.assetAmounts) {
      if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount.amount)) throw new TypeError(`Evidence contains invalid or negative asset amount: ${item.id}`)
    }
    if (item.facts.negativeRowsPublished !== 0) throw new TypeError(`Evidence publishes negative historical rows: ${item.id}`)
    if (item.derivedFromEvidenceIds.includes(item.id)) throw new TypeError(`Evidence cannot derive from itself: ${item.id}`)
    if (item.proofGrade === 'DERIVED_VIEW' && item.independentForProof) throw new TypeError(`Derived view cannot claim independent proof: ${item.id}`)
    if ((item.temporalClass === 'CURRENT_METADATA_ONLY' || item.temporalClass === 'POST_CUTOFF_CONTEXT') && item.independentForProof) throw new TypeError(`Non-historical evidence cannot close proof: ${item.id}`)
  }
  const entityIds = graph.entities.map(({ id }) => id)
  const eventIds = graph.events.map(({ id }) => id)
  if (new Set(entityIds).size !== entityIds.length || new Set(eventIds).size !== eventIds.length) throw new TypeError('Graph entity and event IDs must be unique')
  for (const event of graph.events) {
    if (event.observedAtUtc !== null && cutoff !== null && Date.parse(event.observedAtUtc) > cutoff) throw new TypeError(`Event occurs after cutoff: ${event.id}`)
    if (event.evidenceIds.some((id) => !evidenceIds.includes(id))) throw new TypeError(`Event references missing evidence: ${event.id}`)
  }
  for (const relationship of graph.relationships) {
    if (!entityIds.includes(relationship.fromEntityId) || !entityIds.includes(relationship.toEntityId) || !eventIds.includes(relationship.eventId) || !evidenceIds.includes(relationship.evidenceId) || (relationship.basisEvidenceId !== null && !evidenceIds.includes(relationship.basisEvidenceId))) throw new TypeError(`Relationship references missing graph material: ${relationship.id}`)
    if (relationship.asset !== null && relationship.amount !== null) {
      const target = graph.evidence.find(({ id }) => id === relationship.evidenceId)!
      if (!target.facts.assetAmounts.some(({ asset, amount }) => asset === relationship.asset && amount === relationship.amount)) throw new TypeError(`Relationship amount is not present in evidence: ${relationship.id}`)
    }
    if (relationship.kind === 'INITIATES' && (relationship.asset !== null || relationship.amount !== null)) throw new TypeError(`Initiation edge cannot claim an asset transfer: ${relationship.id}`)
    if (relationship.kind === 'CONVERGES_TO') {
      const target = graph.evidence.find(({ id }) => id === relationship.evidenceId)!
      const basis = graph.evidence.find(({ id }) => id === relationship.basisEvidenceId)
      const basisAmount = basis?.facts.assetAmounts.find(({ asset }) => asset === relationship.asset)?.amount
      const precisionSafeMatch = basisAmount !== undefined && relationship.amount !== null
        && (basisAmount === relationship.amount
          || (basis?.numericPrecisionStatus === 'PROVIDER_REPORTED_DECIMAL'
            && target.numericPrecisionStatus === 'PROVIDER_REPORTED_DECIMAL'
            && Math.abs(Number(basisAmount) - Number(relationship.amount)) <= 0.000001))
      if (basis === undefined || target.grade !== 'EXACT' || basis.grade !== 'EXACT' || relationship.asset === null || relationship.amount === null || !precisionSafeMatch) throw new TypeError(`Convergence is not a precision-safe matched-amount relationship: ${relationship.id}`)
    }
  }
  for (const required of config.flow.requiredEvidenceIds) {
    if (!evidenceIds.includes(required)) throw new TypeError(`Required evidence is missing: ${required}`)
  }
  if (!evidenceIds.includes(config.firstFalsifier)) throw new TypeError('First falsifier is missing from evidence')
  if (graph.firstFalsifier !== config.firstFalsifier) throw new TypeError('Lead first falsifier does not match normalized graph derivation')
  if (config.proofEvidenceIds.some((id) => graph.evidence.find((item) => item.id === id)?.grade === 'CONTEXTUAL')) {
    throw new TypeError('Contextual evidence cannot satisfy solver proof closure')
  }
  if (config.proofEvidenceIds.some((id) => graph.evidence.find((item) => item.id === id)?.independentForProof !== true)) throw new TypeError('Derived or non-independent evidence cannot multiply proof closure')
  const optionIds = Object.fromEntries(Object.entries(config.theoryOptions).map(([slot, options]) => [slot, options.map(({ id }) => id)]))
  for (const [slot, value] of Object.entries(config.canonicalTheory)) {
    if (value === null || !optionIds[slot]?.includes(value)) throw new TypeError(`Canonical ${slot} is not an allowed option`)
  }
  for (const [slot, value] of Object.entries(config.wrongTheory)) {
    if (value === null || !optionIds[slot]?.includes(value)) throw new TypeError(`Wrong-theory ${slot} is not an allowed option`)
  }
  if (Object.keys(config.canonicalTheory).every((slot) => config.canonicalTheory[slot as keyof typeof config.canonicalTheory] === config.wrongTheory[slot as keyof typeof config.wrongTheory])) throw new TypeError('Wrong theory cannot equal canonical theory')
  const proofDependency = graph.proofDependencies.find(({ slot }) => slot === 'proof')
  if (!proofDependency || canonicalScenarioJson(proofDependency.evidenceIds) !== canonicalScenarioJson(config.proofEvidenceIds)) throw new TypeError('Lead proof closure does not match graph dependencies')
  for (const dependency of graph.proofDependencies) {
    if (dependency.evidenceIds.length === 0 || dependency.evidenceIds.some((id) => !evidenceIds.includes(id))) throw new TypeError(`Solver dependency is missing evidence: ${dependency.slot}`)
    if (dependency.evidenceIds.some((id) => graph.evidence.find((item) => item.id === id)?.grade === 'CONTEXTUAL')) throw new TypeError(`Contextual evidence cannot satisfy solver ${dependency.slot}`)
  }
  for (const contradiction of Object.values(config.contradictions)) if (contradiction.evidenceIds.some((id) => !evidenceIds.includes(id))) throw new TypeError(`Contradiction references missing evidence: ${contradiction.slot}`)
  const falsifyingRelationship = graph.relationships.find(({ evidenceId, falsifiesTheoryOptionIds }) => evidenceId === graph.firstFalsifier && falsifiesTheoryOptionIds.length > 0)
  if (!falsifyingRelationship || !Object.values(config.wrongTheory).filter((value): value is string => value !== null).some((value) => falsifyingRelationship.falsifiesTheoryOptionIds.includes(value))) throw new TypeError('First falsifier does not contradict the coherent wrong theory')
}

function compileWorld(graph: NormalizedEvidenceGraph, config: LeadCaseConfig): WorldManifest {
  const datedEvents = graph.events.map(({ observedAtUtc }) => observedAtUtc === null ? null : Date.parse(observedAtUtc)).filter((value): value is number => value !== null && Number.isFinite(value)).sort((left, right) => left - right)
  const temporalSpanHours = datedEvents.length > 1 ? (datedEvents.at(-1)! - datedEvents[0]!) / 3_600_000 : 0
  const proofEdges = graph.relationships.filter(({ kind }) => kind !== 'CONTEXT_ONLY').length
  const depthStep = 2.2 + Math.min(0.8, temporalSpanHours / 12)
  const branchSpread = 3.4 + Math.min(1.8, proofEdges * 0.18)
  const branchDepth = 6 - depthStep * 4.5
  const positions: Record<WorldRole, [number, number, number]> = {
    'entry-origin': [0, 0, 6],
    'record-gate': [0, 0, 6 - depthStep * 1.5],
    'case-index': [0, 0, 6 - depthStep * 3],
    'branch-primary': [-branchSpread, 0, branchDepth],
    'branch-secondary': [branchSpread, 0, branchDepth],
    'protocol-subgraph': [-branchSpread, -0.8, branchDepth - depthStep * 1.8],
    'joining-gate': [0, 0, branchDepth - depthStep * (2.4 + Math.min(0.8, temporalSpanHours / 8))],
    'receiving-point': [0, 0, branchDepth - depthStep * (4.7 + Math.min(1.2, proofEdges / 10))],
  }
  const navigation = config.experiencePlan.navigation
  const evidenceByRole: Partial<Record<WorldRole, string>> = {
    'entry-origin': config.flow.openingEvidenceId,
    'record-gate': config.flow.openingEvidenceId,
    'case-index': config.flow.forkEvidenceId,
    'branch-primary': config.branches[0].evidenceId,
    'branch-secondary': config.branches[1].evidenceId,
    'protocol-subgraph': config.flow.openingEvidenceId,
    'joining-gate': config.experiencePlan.hypothesis.evidenceId,
    'receiving-point': config.flow.destinationEvidenceId,
  }
  const nodes = roles.map((role) => ({
    id: navigation.nodeIds[role],
    role,
    label: config.worldLabels[role],
    evidenceId: evidenceByRole[role] ?? null,
    provenanceEvidenceIds: evidenceByRole[role] ? [evidenceByRole[role]!] : [],
    presentation: {
      position: [...positions[role]] as [number, number, number],
      cameraLandmark: [positions[role][0], positions[role][1] + 1.2, positions[role][2] - 1.4] as [number, number, number],
      prominence: Math.max(0.8, Math.min(1.2, config.worldProminence[role] ?? 1)),
    },
  }))
  const relationshipIds = (evidenceId: string) => graph.relationships.filter((relationship) => relationship.evidenceId === evidenceId).map(({ id }) => id)
  const passage = (input: Omit<WorldManifest['passages'][number], 'durationMs' | 'presentation'>): WorldManifest['passages'][number] => {
    const from = nodes.find(({ id }) => id === input.from)!
    const to = nodes.find(({ id }) => id === input.to)!
    const [ax, ay, az] = from.presentation.position
    const [bx, by, bz] = to.presentation.position
    const distance = Math.hypot(bx - ax, by - ay, bz - az)
    return { ...input, durationMs: Math.round(Math.max(2_600, Math.min(4_200, 2_300 + distance * 180))), presentation: { spline: [[ax, ay, az], [(ax + bx) / 2, Math.max(ay, by) + 0.28, (az + bz) / 2], [bx, by, bz]], arrivalRadius: 0.45 } }
  }
  const deepTraceBranch = config.branches.find(({ id }) => id === navigation.deepTraceBranchId)
  const deepTrace = navigation.deepTracePathId === null || deepTraceBranch === undefined ? [] : [passage({ id: navigation.deepTracePathId, from: deepTraceBranch.nodeId, to: navigation.nodeIds['protocol-subgraph'], role: 'context', initiallyHidden: true, facingHint: 'FORWARD', arrivalStage: 'DEEP_TRACE', provenanceRelationshipIds: relationshipIds(config.flow.conversionEvidenceId), selectableDestination: false })]
  const primaryReturnFrom = navigation.deepTraceBranchId === config.branches[0].id ? navigation.nodeIds['protocol-subgraph'] : config.branches[0].nodeId
  return {
    version: '3.0.0',
    scenarioId: config.scenarioId,
    proceduralOnly: true,
    activePresentationProfile: 'GUIDED_PROBE_3D',
    implementedProfiles: ['GUIDED_PROBE_3D'],
    fallbackOrder: ['FIRST_PERSON_RAIL_3D', 'ORTHOGRAPHIC_2_5D', 'TOP_DOWN_VECTOR_2D'],
    nodes,
    passages: [
      passage({ id: navigation.approachToGatePathId, from: navigation.nodeIds['entry-origin'], to: navigation.nodeIds['record-gate'], role: 'approach', initiallyHidden: false, facingHint: 'FORWARD', arrivalStage: 'APPROACH', provenanceRelationshipIds: relationshipIds(config.flow.openingEvidenceId), selectableDestination: true }),
      passage({ id: config.experiencePlan.approachPathId, from: navigation.nodeIds['record-gate'], to: navigation.nodeIds['case-index'], role: 'approach', initiallyHidden: false, facingHint: 'FORWARD', arrivalStage: 'CASE_INDEX', provenanceRelationshipIds: relationshipIds(config.flow.forkEvidenceId), selectableDestination: true }),
      passage({ id: config.branches[0].outboundPathId, from: navigation.nodeIds['case-index'], to: config.branches[0].nodeId, role: 'branch', initiallyHidden: false, facingHint: 'LEFT', arrivalStage: 'BRANCH', provenanceRelationshipIds: relationshipIds(config.branches[0].evidenceId), selectableDestination: true }),
      passage({ id: config.branches[0].returnPathId, from: primaryReturnFrom, to: navigation.nodeIds['case-index'], role: 'return', initiallyHidden: false, facingHint: 'RETURN', arrivalStage: 'CASE_INDEX', provenanceRelationshipIds: relationshipIds(config.branches[0].evidenceId), selectableDestination: true }),
      passage({ id: config.branches[1].outboundPathId, from: navigation.nodeIds['case-index'], to: config.branches[1].nodeId, role: 'branch', initiallyHidden: false, facingHint: 'RIGHT', arrivalStage: 'BRANCH', provenanceRelationshipIds: relationshipIds(config.branches[1].evidenceId), selectableDestination: true }),
      passage({ id: config.branches[1].returnPathId, from: config.branches[1].nodeId, to: navigation.nodeIds['case-index'], role: 'return', initiallyHidden: false, facingHint: 'RETURN', arrivalStage: 'CASE_INDEX', provenanceRelationshipIds: relationshipIds(config.branches[1].evidenceId), selectableDestination: true }),
      ...deepTrace,
      passage({ id: navigation.hypothesisTestPathId, from: navigation.nodeIds['case-index'], to: navigation.nodeIds['joining-gate'], role: 'hypothesis-test', initiallyHidden: true, facingHint: 'FORWARD', arrivalStage: 'HYPOTHESIS_TEST', provenanceRelationshipIds: relationshipIds(config.experiencePlan.hypothesis.evidenceId), selectableDestination: true }),
      passage({ id: navigation.receivingPathId, from: navigation.nodeIds['joining-gate'], to: navigation.nodeIds['receiving-point'], role: 'continuation', initiallyHidden: true, facingHint: 'FORWARD', arrivalStage: 'RECEIVING_POINT', provenanceRelationshipIds: relationshipIds(config.flow.destinationEvidenceId), selectableDestination: true }),
    ],
  }
}

export function compileScenario(graph: NormalizedEvidenceGraph, config: LeadCaseConfig): CompiledScenarioBundle {
  validateInputs(graph, config)
  const evidence = [...graph.evidence].sort((left, right) => left.id.localeCompare(right.id))
  const generatedAt = new Date(Math.max(...evidence.map(({ retrievedAtUtc }) => Date.parse(retrievedAtUtc)))).toISOString()
  const { schemaVersion: _schemaVersion, omittedEventIds, ...manifestConfig } = structuredClone(config)
  void _schemaVersion
  const scenario: ScenarioManifest = {
    ...manifestConfig,
    schemaVersion: '3.0.0',
    compilerVersion: '2.0.0',
    generatedAt,
    evidence,
    proofEvidenceIds: [...graph.proofDependencies.find(({ slot }) => slot === 'proof')!.evidenceIds],
    firstFalsifier: graph.firstFalsifier,
    omittedEventManifest: {
      ids: uniqueSorted(omittedEventIds),
      count: new Set(omittedEventIds).size,
      reason: 'Omitted as nonessential context or outside the bounded playable proof.',
    },
  }
  const world = compileWorld(graph, config)
  const normalizedGraphHash = sha256Scenario(graph)
  const scenarioHash = sha256Scenario(scenario)
  const worldHash = sha256Scenario(world)
  const provenance: ScenarioProvenance = {
    schemaVersion: '1.0.0',
    scenarioId: config.scenarioId,
    sourceFamilies: [...new Set(evidence.map(({ sourceFamily }) => sourceFamily))].sort(),
    rawResponseHashes: uniqueSorted(evidence.map(({ rawSha256 }) => rawSha256)),
    normalizedObjectHashes: uniqueSorted(evidence.map(({ normalizedSha256 }) => normalizedSha256)),
    normalizedGraphHash,
    compilerVersion: '2.0.0',
    worldVersion: '3.0.0',
    scenarioHash,
    worldHash,
    generatedAt,
  }
  return { scenario, world, provenance }
}

export function verifyCompiledBundle(bundle: CompiledScenarioBundle): boolean {
  return bundle.scenario.scenarioId === bundle.world.scenarioId
    && bundle.scenario.scenarioId === bundle.provenance.scenarioId
    && bundle.world.proceduralOnly
    && bundle.provenance.scenarioHash === sha256Scenario(bundle.scenario)
    && bundle.provenance.worldHash === sha256Scenario(bundle.world)
    && bundle.provenance.normalizedGraphHash.startsWith('sha256:')
    && canonicalScenarioJson(bundle).length > 0
}
