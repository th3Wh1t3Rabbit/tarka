import { validateScenario, type SyntheticScenario, type TheoryEvaluation, type TheorySelection, type TheorySlot } from '../scenario/schema'
import type { ScenarioManifest } from '../scenario/contracts'

const contradictionBySlot: Record<TheorySlot, TheoryEvaluation['firstContradiction']> = {
  route: { slot: 'route', code: 'NO_MARKED_STATE', evidenceIds: ['activity-contradiction'], display: 'The selected route received no marked state.' },
  transformation: { slot: 'transformation', code: 'CONVERSION_MISMATCH', evidenceIds: ['conversion-event'], display: 'BALANCE 17 / 17 ACCOUNTED' },
  destination: { slot: 'destination', code: 'DESTINATION_MISMATCH', evidenceIds: ['archive-successor-delta'], display: 'AFTER  11 CYAN / 6 VIOLET' },
  proof: { slot: 'proof', code: 'PROOF_INSUFFICIENT', evidenceIds: ['conversion-event', 'archive-successor-delta'], display: 'ROUTE EVENT + STATE DELTA' },
}

export function evaluateTheory(scenario: SyntheticScenario, theory: TheorySelection): TheoryEvaluation {
  if (!validateScenario(scenario)) {
    throw new TypeError('Cannot evaluate an invalid synthetic scenario.')
  }

  for (const slot of ['route', 'transformation', 'destination', 'proof'] as const) {
    if (theory[slot] !== scenario.canonicalTheory[slot]) {
      const contradiction = contradictionBySlot[slot]
      return {
        accepted: false,
        firstContradiction: contradiction ? { ...contradiction, evidenceIds: [...contradiction.evidenceIds] } : null,
        proofEvidenceIds: [],
      }
    }
  }
  return {
    accepted: true,
    firstContradiction: null,
    proofEvidenceIds: ['quiet-transformation-gap', 'conversion-event', 'archive-successor-delta'],
  }
}

export function evaluateCompiledTheory(scenario: ScenarioManifest, theory: TheorySelection): TheoryEvaluation {
  for (const slot of ['route', 'transformation', 'destination', 'proof'] as const) {
    if (theory[slot] !== scenario.canonicalTheory[slot]) {
      const contradiction = scenario.contradictions[slot]
      return {
        accepted: false,
        firstContradiction: { ...contradiction, evidenceIds: [...contradiction.evidenceIds] },
        proofEvidenceIds: [],
      }
    }
  }
  const proof = scenario.proofEvidenceIds.map((id) => scenario.evidence.find((item) => item.id === id))
  if (proof.some((item) => item === undefined || item.grade === 'CONTEXTUAL')) {
    throw new TypeError('Compiled scenario proof closure is missing or contextual.')
  }
  return { accepted: true, firstContradiction: null, proofEvidenceIds: [...scenario.proofEvidenceIds] }
}

export function isCoherentTheorySelection(scenario: ScenarioManifest, theory: TheorySelection): boolean {
  const coherentTheories = [scenario.canonicalTheory, scenario.wrongTheory]
  return coherentTheories.some((candidate) => (
    (Object.keys(theory) as TheorySlot[]).every((slot) => theory[slot] === null || theory[slot] === candidate[slot])
  ))
}

export function selectCoherentTheoryValue(
  scenario: ScenarioManifest,
  theory: TheorySelection,
  slot: TheorySlot,
  value: string,
): TheorySelection {
  const candidates = [scenario.canonicalTheory, scenario.wrongTheory].filter((candidate) => candidate[slot] === value)
  if (candidates.length === 0) return theory
  const selection: TheorySelection = { ...theory, [slot]: value }
  for (const candidateSlot of Object.keys(selection) as TheorySlot[]) {
    const selected = selection[candidateSlot]
    if (selected !== null && !candidates.some((candidate) => candidate[candidateSlot] === selected)) selection[candidateSlot] = null
  }
  return selection
}
