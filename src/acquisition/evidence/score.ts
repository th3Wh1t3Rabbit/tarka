import type { CaseScore, FatalDefect, ScoreCategory } from '../contracts.js'
import { EvidenceValidationError, evidenceValidationConstants } from './validators.js'

export const SCORE_CATEGORY_MAXIMUMS: Readonly<Record<ScoreCategory, number>> = {
  proofClosureAuditability: 20,
  nansenIndispensability: 15,
  branchTransformationTopology: 15,
  timeMechanicPotential: 10,
  nonexpertNarrativeClarity: 10,
  replayTruthfulDepth: 10,
  visualWorldReadability: 10,
  complianceDataReliability: 10,
}

export interface CaseScoreInput {
  candidateId: string
  categories: Record<ScoreCategory, number>
  fatalDefects: FatalDefect[]
  eligibilityThreshold: number
}

export function scoreCase(input: CaseScoreInput): CaseScore {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.candidateId)) throw new EvidenceValidationError('CaseScore.candidateId: must be a stable identifier')
  const categoryKeys = Object.keys(input.categories).sort()
  const expectedKeys = [...evidenceValidationConstants.SCORE_CATEGORIES].sort()
  if (categoryKeys.length !== expectedKeys.length || categoryKeys.some((key, index) => key !== expectedKeys[index])) throw new EvidenceValidationError('CaseScore.categories: all and only the eight canonical categories are required')
  for (const category of evidenceValidationConstants.SCORE_CATEGORIES) {
    const value = input.categories[category]
    if (!Number.isInteger(value) || value < 0 || value > SCORE_CATEGORY_MAXIMUMS[category]) throw new EvidenceValidationError(`CaseScore.categories.${category}: must be an integer from 0 to ${SCORE_CATEGORY_MAXIMUMS[category]}`)
  }
  if (!Number.isInteger(input.eligibilityThreshold) || input.eligibilityThreshold < 0 || input.eligibilityThreshold > 100) throw new EvidenceValidationError('CaseScore.eligibilityThreshold: must be an integer from 0 to 100')
  if (!Array.isArray(input.fatalDefects) || new Set(input.fatalDefects).size !== input.fatalDefects.length || input.fatalDefects.some((defect) => !evidenceValidationConstants.FATAL_DEFECTS.includes(defect))) throw new EvidenceValidationError('CaseScore.fatalDefects: contains an unknown or duplicate fatal defect')
  const total = evidenceValidationConstants.SCORE_CATEGORIES.reduce((sum, category) => sum + input.categories[category], 0)
  return { schemaVersion: '1.0.0', candidateId: input.candidateId, categories: { ...input.categories }, total, fatalDefects: [...input.fatalDefects], eligible: input.fatalDefects.length === 0 && total >= input.eligibilityThreshold }
}

