import { execFileSync } from 'node:child_process'
import { sha } from '../nq5/schema.mjs'
export const REVIEW_LENSES = ['GAMEPLAY_INVESTIGATION', 'CANONICAL_QUERY_QUESTION_LENSES', 'EVIDENCE_PROOF', 'PROVENANCE_ARCHIVE_ALLOWANCE', 'SAFETY_NO_LEAK_NO_NETWORK', 'ART_PERFORMANCE', 'ACCESSIBILITY', 'EVALUATION_REGRESSION']
export function r2ImplementationIdentity(root) {
  const names = execFileSync('git', ['ls-files', '--', '.', ':(exclude)ART_PRODUCTION', ':(exclude).cursor', ':(exclude)artifacts', ':(exclude)docs/G6P_A2U_R2_REVIEW.json', ':(exclude)docs/PROJECT_STATUS.yaml'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort()
  const rows = names.map(name => name + '\0' + execFileSync('git', ['rev-parse', 'HEAD:' + name], { cwd: root, encoding: 'utf8' }).trim())
  return sha(rows.join('\n') + '\n')
}
