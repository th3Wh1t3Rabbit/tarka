import { R55_ACTUAL_ACTION_MATRIX, executeR55ActualAction } from './r55ProductionRouteRegistry'

export type RepetitionKind = 'EXACT' | 'CONTAINMENT' | 'HIGH_SIMILARITY'
export interface DialogueWindow {
  start: number
  length: number
  lineIds: string[]
  text: string
  normalized: string
}
export interface DialogueRepetitionFinding {
  routeId: string
  kind: RepetitionKind
  similarity: number
  left: DialogueWindow
  right: DialogueWindow
}
export interface DialogueRepetitionAllowance extends DialogueRepetitionFinding {
  rationale: string
}

// Intentionally empty at R2. Additions must bind the exact route, identities,
// expected text, and rationale; broad route- or phrase-level exemptions are forbidden.
export const PRODUCTION_REPETITION_ALLOWLIST: readonly DialogueRepetitionAllowance[] = []

const normalize = (value: string) => value
  .normalize('NFKD')
  .toLocaleLowerCase('en-US')
  .replace(/[’‘]/g, "'")
  .replace(/[^a-z0-9']+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

function editDistance(left: string, right: string): number {
  if (left === right) return 0
  if (!left.length) return right.length
  if (!right.length) return left.length
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1]! + 1,
        previous[rightIndex]! + 1,
        previous[rightIndex - 1]! + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[right.length]!
}

function similarity(left: string, right: string): number {
  return 1 - editDistance(left, right) / Math.max(left.length, right.length, 1)
}

function windows(lines: ReturnType<typeof executeR55ActualAction>['lines']): DialogueWindow[] {
  const result: DialogueWindow[] = []
  for (let start = 0; start < lines.length; start += 1) {
    for (let length = 1; length <= Math.min(4, lines.length - start); length += 1) {
      const slice = lines.slice(start, start + length)
      const text = slice.map(line => line.text).join(' ')
      result.push({ start, length, lineIds: slice.map((line, offset) => line.copyKey ?? `line:${start + offset + 1}`), text, normalized: normalize(text) })
    }
  }
  return result
}

function compare(routeId: string, left: DialogueWindow, right: DialogueWindow): DialogueRepetitionFinding | null {
  if (!left.normalized || !right.normalized) return null
  // A window must not be compared with itself or an overlapping construction of itself.
  if (!(left.start + left.length <= right.start || right.start + right.length <= left.start)) return null
  if (left.normalized === right.normalized) return { routeId, kind: 'EXACT', similarity: 1, left, right }
  const shorter = left.normalized.length <= right.normalized.length ? left.normalized : right.normalized
  const longer = shorter === left.normalized ? right.normalized : left.normalized
  if (shorter.length >= 24 && longer.includes(shorter) && shorter.length / longer.length >= 0.55) {
    return { routeId, kind: 'CONTAINMENT', similarity: shorter.length / longer.length, left, right }
  }
  if (Math.min(left.normalized.length, right.normalized.length) < 24 || shorter.length / longer.length < 0.88) return null
  const score = similarity(left.normalized, right.normalized)
  if (score >= 0.88) {
    return { routeId, kind: 'HIGH_SIMILARITY', similarity: score, left, right }
  }
  return null
}

function allowanceMatches(finding: DialogueRepetitionFinding, allowance: DialogueRepetitionAllowance): boolean {
  return finding.routeId === allowance.routeId
    && finding.kind === allowance.kind
    && finding.left.text === allowance.left.text
    && finding.right.text === allowance.right.text
    && JSON.stringify(finding.left.lineIds) === JSON.stringify(allowance.left.lineIds)
    && JSON.stringify(finding.right.lineIds) === JSON.stringify(allowance.right.lineIds)
}

export function findDialogueRepetitions(routeId: string, lines: ReturnType<typeof executeR55ActualAction>['lines']): DialogueRepetitionFinding[] {
  const findings: DialogueRepetitionFinding[] = []
  const routeWindows = windows(lines)
  for (let leftIndex = 0; leftIndex < routeWindows.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < routeWindows.length; rightIndex += 1) {
      const finding = compare(routeId, routeWindows[leftIndex]!, routeWindows[rightIndex]!)
      if (finding) findings.push(finding)
    }
  }
  return findings
}

export function auditProductionDialogueRoutes() {
  const findings: DialogueRepetitionFinding[] = []
  const routeErrors: Array<{ routeId: string; error: string }> = []
  for (const descriptor of R55_ACTUAL_ACTION_MATRIX) {
    try {
      findings.push(...findDialogueRepetitions(descriptor.routeId, executeR55ActualAction(descriptor).lines))
    } catch (error) {
      routeErrors.push({ routeId: descriptor.routeId, error: error instanceof Error ? error.message : String(error) })
    }
  }
  const allowlisted = findings.filter(finding => PRODUCTION_REPETITION_ALLOWLIST.some(allowance => allowanceMatches(finding, allowance)))
  const violations = findings.filter(finding => !PRODUCTION_REPETITION_ALLOWLIST.some(allowance => allowanceMatches(finding, allowance)))
  return { routeCount: R55_ACTUAL_ACTION_MATRIX.length, routeErrors, findings, allowlisted, violations }
}
