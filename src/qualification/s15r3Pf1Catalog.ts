export interface Pf1ContractRow {
  id: string
  exactRequirementSummary: string
  rightfulProductionOwners: readonly string[]
  stateActionPrecondition: string
  publicRouteOrCallsite: string
  expectedObservation: string
  executingTestIds: readonly string[]
  evidenceArtifactIds: readonly string[]
  observationKey: string
}

function row(id: string, exactRequirementSummary: string, owner: string, stateActionPrecondition: string, publicRouteOrCallsite: string): Pf1ContractRow {
  return {
    id,
    exactRequirementSummary,
    rightfulProductionOwners: [owner],
    stateActionPrecondition,
    publicRouteOrCallsite,
    expectedObservation: `${id} observes: ${exactRequirementSummary}`,
    executingTestIds: [`S15-R3 executable PF1 contract > ${id} — ${exactRequirementSummary}`],
    evidenceArtifactIds: [`OBSERVATION.${id}`],
    observationKey: `s15r3.${id.toLowerCase()}`,
  }
}

/** Explicit, typed PF1 contract. Result and status are joined from executable observations. */
export const PF1_CONTRACT: readonly Pf1ContractRow[] = [
  row('PF1-001', 'Arthur-only opening and Rook entrance', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-002', 'Automatic dialogue is the default', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-003', 'Compact dialogue controls beside music', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-004', 'Delivery model; no blank-line artifacts', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-005', 'Stitch over-fragmented phrases', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-006', 'Semantic emphasis', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-007', 'Speaker/mouth ownership', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-008', 'Nansen trademark treatment', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-009', 'Arrival order and early deliveries', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-010', 'Lead-investigator introduction order', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-011', 'Arthur’s `You?!?` reaction', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-012', '`I never threw it` stays in the ordinary Arthur delivery', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-013', 'Closer-than-ever delivery', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-014', 'Forgotten-brief question', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-015', 'Missing-brief accusation', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-016', 'Rook’s case-brief excuse', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-017', 'Official office copy', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-018', 'Short-version sequence', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-019', 'Focused-now sequence', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-020', 'Long-day camera beat', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-021', 'Witness answer', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-022', 'Crime-scene line', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-023', 'Remove abstract line', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-024', 'Nansen question', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-025', 'Terminal-start line', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-026', 'Authorization emphasis', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-027', 'Lead-investigator objection', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-028', 'Migraine beat', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-029', 'Management channel', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-030', 'Complete-the-form instruction', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-031', 'Do-not-touch warning', 'src/story/s15r2/principalFeedback.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → opening dialogue'),
  row('PF1-032', 'Be-the-change quip', 'src/adventure/content.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → interact with the named office target'),
  row('PF1-033', 'Writing the form', 'src/adventure/content.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → interact with the named office target'),
  row('PF1-034', 'Coffee dialogue', 'src/adventure/content.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → interact with the named office target'),
  row('PF1-035', 'Pen pickup caution', 'src/adventure/content.ts', 'Active production dialogue reaches this authored delivery', '/ → PLAY → interact with the named office target'),
  row('PF1-036', 'Coffee-steam frame order', 'src/adventure/animationCues.ts', 'Player control is active and the applicable world action is selected', '/ → PLAY → ordinary office interaction'),
  row('PF1-037', 'Full globe runtime', 'src/adventure/reducer.ts', 'Player control is active and the applicable world action is selected', '/ → PLAY → ordinary office interaction'),
  row('PF1-038', 'Lamp state before dialogue', 'src/adventure/reducer.ts', 'Player control is active and the applicable world action is selected', '/ → PLAY → ordinary office interaction'),
  row('PF1-039', 'Physical interaction choreography', 'src/adventure/reducer.ts', 'Player control is active and the applicable world action is selected', '/ → PLAY → ordinary office interaction'),
  row('PF1-040', 'TALK TO world objects', 'src/adventure/reducer.ts', 'Player control is active and the applicable world action is selected', '/ → PLAY → ordinary office interaction'),
  row('PF1-041', 'Unauthorized drawer and terminal choreography', 'src/adventure/reducer.ts', 'Player control is active and the applicable world action is selected', '/ → PLAY → ordinary office interaction'),
  row('PF1-042', 'Arthur pointing hold', 'src/adventure/reducer.ts', 'Player control is active and the applicable world action is selected', '/ → PLAY → ordinary office interaction'),
  row('PF1-043', 'Form handoff/stamp sequence', 'src/adventure/reducer.ts', 'Player control is active and the applicable world action is selected', '/ → PLAY → ordinary office interaction'),
  row('PF1-044', 'Postapproval duplicate dialogue', 'src/adventure/reducer.ts', 'Player control is active and the applicable world action is selected', '/ → PLAY → ordinary office interaction'),
  row('PF1-045', 'Cancel pending item targeting on empty click', 'src/adventure/reducer.ts', 'Player control is active and the applicable world action is selected', '/ → PLAY → ordinary office interaction'),
  row('PF1-046', 'Arthur hotspot priority', 'src/adventure/reducer.ts', 'Player control is active and the applicable world action is selected', '/ → PLAY → ordinary office interaction'),
  row('PF1-047', 'Feather pen labels', 'src/adventure/content.ts', 'The named world or inventory object is visible or focused', '/ → PLAY → hover or focus the named object'),
  row('PF1-048', 'Broken pen label', 'src/adventure/content.ts', 'The named world or inventory object is visible or focused', '/ → PLAY → hover or focus the named object'),
  row('PF1-049', 'Terminal label', 'src/adventure/content.ts', 'The named world or inventory object is visible or focused', '/ → PLAY → hover or focus the named object'),
  row('PF1-050', 'Wall/prop labels', 'src/adventure/content.ts', 'The named world or inventory object is visible or focused', '/ → PLAY → hover or focus the named object'),
  row('PF1-051', 'Hover-label casing policy', 'src/adventure/content.ts', 'The named world or inventory object is visible or focused', '/ → PLAY → hover or focus the named object'),
  row('PF1-052', 'Cabinet labels', 'src/adventure/content.ts', 'The named world or inventory object is visible or focused', '/ → PLAY → hover or focus the named object'),
  row('PF1-053', 'Signed and approved form art/labels', 'src/adventure/content.ts', 'The named world or inventory object is visible or focused', '/ → PLAY → hover or focus the named object'),
  row('PF1-054', 'Preserve accepted foundation', 'src/app/App.tsx', 'S15-R3 qualification and preservation preconditions hold', '/ ordinary production routes'),
  row('PF1-055', 'Current suites and new regression ownership', 'tests/e2e/s15-r1-production-journeys.spec.ts', 'S15-R3 qualification and preservation preconditions hold', '/ ordinary production routes'),
  row('PF1-056', 'Fresh evidence only', 'review/s15-r3/EVIDENCE_OWNERSHIP.json', 'S15-R3 qualification and preservation preconditions hold', '/ ordinary production routes'),
  row('PF1-057', 'Relaunch Principal Playtest 2', 'review/s15-r3/QUALIFICATION.json', 'S15-R3 qualification and preservation preconditions hold', 'No launch route; S15-R3 authority forbids Principal Playtest 2'),
]
