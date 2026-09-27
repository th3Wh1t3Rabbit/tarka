import { compileScenario } from '../compiler/compile'
import { hashScenario } from '../solver/hash'
import type { LeadCaseConfig, NormalizedEvidenceGraph } from './contracts'
import { syntheticScenario } from './synthetic'

const rawHash = hashScenario(syntheticScenario).slice('fnv1a64:'.length).padStart(64, '0')

export const syntheticEvidenceGraph: NormalizedEvidenceGraph = {
  schemaVersion: '1.0.0',
  scenarioId: syntheticScenario.scenarioId,
  cutoffUtc: null,
  entities: syntheticScenario.entities.map(({ id, name }) => ({ id, role: name, kind: 'SYNTHETIC_ENTITY', address: null })),
  events: syntheticScenario.events.map(({ id }) => ({ id, kind: 'SYNTHETIC', observedAtUtc: null, transactionHash: null, evidenceIds: syntheticScenario.evidence.filter(({ eventIds }) => eventIds.includes(id)).map(({ id: evidenceId }) => evidenceId) })),
  relationships: [
    { id: 'synthetic-origin', kind: 'SYNTHETIC_ROUTE', fromEntityId: 'origin', toEntityId: 'fork', eventId: 'evt-origin-departure', evidenceId: 'origin-event', basisEvidenceId: null, asset: null, amount: null, falsifiesTheoryOptionIds: [] },
    { id: 'synthetic-continuation', kind: 'SYNTHETIC_ROUTE', fromEntityId: 'quiet', toEntityId: 'archive', eventId: 'evt-prism-conversion', evidenceId: 'conversion-event', basisEvidenceId: 'quiet-transformation-gap', asset: null, amount: null, falsifiesTheoryOptionIds: [] },
    { id: 'synthetic-activity-falsifier', kind: 'SYNTHETIC_ROUTE', fromEntityId: 'fork', toEntityId: 'high-activity', eventId: 'evt-high-activity', evidenceId: 'activity-contradiction', basisEvidenceId: null, asset: null, amount: null, falsifiesTheoryOptionIds: ['high-noise'] },
  ],
  proofDependencies: [
    { slot: 'route', evidenceIds: ['quiet-transformation-gap'] },
    { slot: 'transformation', evidenceIds: ['conversion-event'] },
    { slot: 'destination', evidenceIds: ['archive-successor-delta'] },
    { slot: 'proof', evidenceIds: ['quiet-transformation-gap', 'conversion-event', 'archive-successor-delta'] },
  ],
  firstFalsifier: 'activity-contradiction',
  gaps: [],
  evidence: syntheticScenario.evidence.map((item) => ({
    id: item.id,
    grade: item.class === 'activity-context' ? 'CONTEXTUAL' : item.class === 'state-delta' ? 'CORROBORATING' : 'EXACT',
    observedAtUtc: null,
    sourceFamily: 'SYNTHETIC_FIXTURE',
    sourceEndpoint: 'synthetic-fixture://prism-calibration-v2',
    retrievedAtUtc: '2026-09-14T00:00:00Z',
    temporalClass: 'SYNTHETIC',
    normalizedSha256: rawHash,
    redistribution: 'PUBLIC_ALLOWLISTED',
    uncertainty: null,
    rawSha256: rawHash,
    claim: item.claim,
    transactionHash: null,
    proofGrade: item.class === 'activity-context' ? 'CONTEXT' : 'EXACT_EVENT',
    sourceLineageId: `SYNTHETIC_${item.id}`,
    independenceGroup: `SYNTHETIC_${item.id}`,
    derivedFromEvidenceIds: [],
    independentForProof: item.class !== 'activity-context',
    numericPrecisionStatus: 'ROUNDED_PLAYER_DISPLAY',
    facts: { assetAmounts: [], roleBindings: [], stateLabel: 'SYNTHETIC FIXTURE', provesRoute: item.class !== 'activity-context', negativeRowsPublished: 0 },
  })),
}

export const syntheticLeadConfig: LeadCaseConfig = {
  schemaVersion: '1.0.0',
  scenarioId: syntheticScenario.scenarioId,
  kind: 'SYNTHETIC_CALIBRATION',
  missionLabel: 'CALIBRATION',
  title: 'THE SIGNAL VAULT',
  chain: 'SYNTHETIC',
  historicalWindow: null,
  historicalCutoff: null,
  prelaunch: ['TRACE//ESCAPE', 'THE SIGNAL VAULT', 'A SYNTHETIC CALIBRATION', 'NO WALLET · NO NETWORK · ONLY THE TRAIL'],
  opening: ['THE TRAIL WENT DARK.', 'THE CHAIN DID NOT.', 'FOLLOW THE VALUE.'],
  caseFrame: [],
  caseQuestion: 'WHERE DID THE MARKED STATE CONTINUE?',
  firstScanMarker: ['SYNTHETIC TRANSFER REPLAY', 'FICTIONAL CALIBRATION DATA'],
  objectives: {
    ENTRY: 'THE VAULT IS WAITING.', OPENING: 'STAY WITH THE SIGNAL.', SIGNAL_RESIDUE: 'FOLLOW THE GOLD RESIDUE.', THRESHOLD: 'STABILIZE THE THRESHOLD.', TRANSACTION_REPLAY: 'COMPARE THE STATE BEFORE AND AFTER.', FORK: 'TEST BOTH PLAUSIBLE ROUTES.', QUIET_RESERVOIR: 'FOLLOW WHAT REMAINED UNRESOLVED.', HIGH_ACTIVITY: 'CHALLENGE THE LOUDEST ROUTE.', TIME_ANCHOR: 'REWIND TO THE PROVEN FORK.', CONVERSION_TRACE: 'TRACE THE CHANGE IN FORM.', PRISM_CONVERTER: 'TRACE THE CHANGE IN FORM.', PRISM_ARCHIVE: 'PROVE WHERE THE SUCCESSOR STATES ACCUMULATED.', CASE_CONSTELLATION: 'CASE CONSTELLATION', COUNTER_RECONSTRUCTION: 'THEORY BREAK.', TRUTH_ENGINE: 'TRUTH ENGINE', COMPLETE: 'TRUTH RECONSTRUCTED.',
  },
  captions: {
    SIGNAL_RESIDUE: 'A marked unit of value leaves the origin.', THRESHOLD: 'The route is unstable. Scan reveals direction, not truth.', TRANSACTION_REPLAY: 'Synthetic transfer replayed. Compare state, not appearances.', FORK: 'Two routes look plausible. Order does not decide truth.', QUIET_RESERVOIR: 'Seventeen marked units entered. Their original form does not continue.', HIGH_ACTIVITY: 'Activity is not continuity.', TIME_ANCHOR: 'The trail did not end. Our assumption did.', CONVERSION_TRACE: 'Two independent traces. Resonance.', PRISM_CONVERTER: 'The form changed. The value continued.', COMPLETE: 'You followed continuity across a change in form.',
  },
  branches: [
    { id: 'branch-a', nodeId: 'branch-primary', outboundPathId: 'to-first-breach', returnPathId: 'return-from-first-breach', routeLabel: 'ROUTE A', entryLabel: 'ROUTE A // STATE RECORD', objective: 'READ THE RECORD', evidenceId: 'quiet-transformation-gap', discoveryEvidenceIds: ['quiet-transformation-gap', 'fork-state-delta'], evidenceStamp: 'T+18', evidenceBody: 'Seventeen marked units entered. Their original form does not continue.', evidenceExact: '17 GOLD IN // 0 GOLD OUT', actionLabel: 'READ THE ECHO', discoveryAction: 'READ THE ECHO', completionAction: 'UNWIND THE TRAIL', transitionAfterFirst: ['One route is recorded. Test the other.'] },
    { id: 'branch-b', nodeId: 'branch-secondary', outboundPathId: 'to-second-breach', returnPathId: 'return-from-second-breach', routeLabel: 'ROUTE B', entryLabel: 'ROUTE B // ACTIVITY RECORD', objective: 'OPEN THE TRANSFER MAP', evidenceId: 'activity-contradiction', discoveryEvidenceIds: ['activity-contradiction'], evidenceStamp: 'T+18', evidenceBody: 'Activity is not continuity.', evidenceExact: '86 INTERACTIONS // 0 MARKED UNITS', actionLabel: 'OPEN THE TRANSFER MAP', discoveryAction: 'OPEN THE TRANSFER MAP', completionAction: 'RETURN TO THE INDEX', transitionAfterFirst: ['One route is recorded. Test the other.'] },
  ],
  flow: {
    openingEvidenceId: 'origin-event', forkEvidenceId: 'fork-state-delta', conversionEvidenceId: 'conversion-event', destinationEvidenceId: 'archive-successor-delta',
    requiredEvidenceIds: syntheticScenario.evidence.map(({ id }) => id), anchorLabel: 'FORK // T+18', alignTitle: 'CONVERSION TRACE ONLINE', alignBody: 'The route ends only if value and form are treated as the same thing.', resonanceProof: 'ROUTE EVENT + STATE DELTA', conversionTitle: 'PRISM CONVERTER // SYNTHETIC RECORD', conversionBody: 'The form changed. The value continued.', conversionExact: ['INPUT 17 GOLD', 'OUTPUT 11 CYAN', 'OUTPUT 6 VIOLET', 'BALANCE 17 / 17 ACCOUNTED'], destinationTitle: 'STATE ECHO // PRISM ARCHIVE', destinationBody: 'Successor states accumulated here.', destinationExact: ['BEFORE 0 CYAN / 0 VIOLET', 'AFTER 11 CYAN / 6 VIOLET'],
  },
  theoryOptions: syntheticScenario.theoryOptions,
  canonicalTheory: syntheticScenario.canonicalTheory,
  wrongTheory: { route: 'high-noise', transformation: 'gold-to-successors', destination: 'high-chamber', proof: 'activity-plus-intensity' },
  contradictions: {
    route: { slot: 'route', code: 'NO_MARKED_STATE', evidenceIds: ['activity-contradiction'], display: 'The selected route received no marked state.' },
    transformation: { slot: 'transformation', code: 'CONVERSION_MISMATCH', evidenceIds: ['conversion-event'], display: 'BALANCE 17 / 17 ACCOUNTED' },
    destination: { slot: 'destination', code: 'DESTINATION_MISMATCH', evidenceIds: ['archive-successor-delta'], display: 'AFTER  11 CYAN / 6 VIOLET' },
    proof: { slot: 'proof', code: 'PROOF_INSUFFICIENT', evidenceIds: ['conversion-event', 'archive-successor-delta'], display: 'ROUTE EVENT + STATE DELTA' },
  },
  proofEvidenceIds: ['quiet-transformation-gap', 'conversion-event', 'archive-successor-delta'],
  firstFalsifier: 'activity-contradiction',
  truthTimeline: syntheticScenario.truthTimeline,
  truthStages: ['ISOLATE THE ROUTE', 'PEEL BACK THE FORM', 'PROVE THE DESTINATION'],
  truthConclusion: ['ROUTE CONTINUITY PROVEN', 'FICTIONAL CALIBRATION DATA'],
  completion: { title: 'TRUTH RECONSTRUCTED.', solvedTitle: 'THE SIGNAL VAULT', body: 'You followed continuity across a change in form.', disclaimer: 'SYNTHETIC CALIBRATION ONLY.', primaryAction: 'REPLAY CALIBRATION', secondaryAction: null },
  provenanceCopy: 'NO EXTERNAL DATA // CALIBRATION ONLY',
  omittedEventIds: [],
  worldLabels: { 'entry-origin': 'Origin', 'record-gate': 'Record Gate', 'case-index': 'Case Index', 'branch-primary': 'Route A', 'branch-secondary': 'Route B', 'protocol-subgraph': 'Conversion Chamber', 'joining-gate': 'Joining Gate', 'receiving-point': 'Archive' },
  worldProminence: {},
  experiencePlan: {
    stages: ['ENTRY', 'OPENING', 'APPROACH', 'CASE_INDEX', 'BRANCH', 'RETURN', 'SYNTHESIS', 'HYPOTHESIS', 'HYPOTHESIS_TEST', 'DEEP_TRACE', 'RECEIVING_POINT', 'CASE_ASSEMBLY', 'TRUTH_ENGINE', 'COMPLETE'],
    branchIds: ['branch-a', 'branch-b'], approachPathId: 'to-case-index', synthesisAction: 'BRING THE RECORDS TOGETHER',
    navigation: { nodeIds: { 'entry-origin': 'entry-origin', 'record-gate': 'record-gate', 'case-index': 'case-index', 'branch-primary': 'branch-primary', 'branch-secondary': 'branch-secondary', 'protocol-subgraph': 'protocol-subgraph', 'joining-gate': 'joining-gate', 'receiving-point': 'receiving-point' }, approachToGatePathId: 'approach-record', deepTraceBranchId: 'branch-a', deepTracePathId: 'protocol-descent', hypothesisTestPathId: 'sweep-forward', receivingPathId: 'to-receiving-point' },
    hypothesis: { question: 'WHERE DID THE MARKED STATE GO?', options: [{ id: 'SYNTHETIC_STOPPED', label: 'IT STOPPED AT ROUTE A', outcome: 'FALSIFIED' }, { id: 'SYNTHETIC_CONTINUED', label: 'IT JOINED THE ARCHIVE ROUTE', outcome: 'CONFIRMED' }], testAction: 'SWEEP_FORWARD', testActionLabel: 'SWEEP FORWARD', evidenceId: 'conversion-event', confirmedCopy: ['THEORY HOLDS'], falsifiedCopy: ['THEORY BREAK'] },
    caseAssembly: { title: 'BUILD THE CASE', slots: [{ id: 'AMOUNT', label: 'THE AMOUNT', requiredEvidenceId: 'quiet-transformation-gap' }, { id: 'RECEIVER', label: 'THE RECEIVER', requiredEvidenceId: 'archive-successor-delta' }, { id: 'LINK', label: 'THE LINK', requiredEvidenceId: 'conversion-event' }], selectableEvidenceIds: ['quiet-transformation-gap', 'archive-successor-delta', 'conversion-event', 'activity-contradiction'], contextualEvidenceIds: ['activity-contradiction'], insufficientCopy: 'THAT RECORD DOESN\'T CLOSE THE TRAIL.' },
    truthAdvanceMode: 'PLAYER_PACED',
  },
}

export const syntheticBundle = compileScenario(syntheticEvidenceGraph, syntheticLeadConfig)
