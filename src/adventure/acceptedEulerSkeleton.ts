// Minimal runtime projection of the accepted frozen Euler scenario. Every
// value below is copied from the accepted v3 scenario; this module deliberately
// excludes retired renderer/world-profile fields from the public A2P bundle.
export const ACCEPTED_EULER_SKELETON = {
  scenarioId: 'EULER_2023_FALSE_EXIT',
  title: 'THE FALSE EXIT',
  question: 'Did the first trail stop—or join the second route?',
  historicalCutoffUtc: '2023-03-13T12:15:00Z',
  provenance: 'POWERED BY NANSEN API',
  conclusionBoundary: 'ROUTE CONVERGENCE ONLY // NO CLAIM OF IDENTITY, ULTIMATE DESTINATION, OR OFFCHAIN COORDINATION',
  hypothesisQuestion: 'WHERE DID THE FIRST TRAIL GO?',
  hypothesisIds: ['FIRST_TRAIL_STOPS_AT_FIRST_ENGINE', 'FIRST_TRAIL_JOINS_SECOND_ROUTE'],
  insufficientCopy: "THAT RECORD DOESN'T CLOSE THE TRAIL.",
  completeObjective: 'TRUTH RECONSTRUCTED.',
  evidenceGrades: {
    EXACT_EARLY_NET: 'EXACT',
    STATE_EARLY_ENGINE: 'CORROBORATING',
    CONTEXT_FIRST_ENGINE_ACTIVITY: 'CONTEXTUAL',
    EXACT_MAIN_RECEIVER: 'EXACT',
    CONTEXT_SECONDARY: 'CONTEXTUAL',
    EXACT_CONVERGENCE: 'EXACT',
  },
} as const
