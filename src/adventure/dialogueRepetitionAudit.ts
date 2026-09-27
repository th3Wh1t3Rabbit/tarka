import type { SpeechLine } from './types'

export type RepetitionKind = 'EXACT' | 'CONTAINMENT' | 'HIGH_SIMILARITY'
export interface RepetitionWindow { start: number; end: number; lineIds: string[]; text: string; normalized: string }
export interface RepetitionFinding { routeId: string; kind: RepetitionKind; left: RepetitionWindow; right: RepetitionWindow; score: number }
export interface RepetitionAllowlistEntry {
  routeId: string
  kind: RepetitionKind
  leftLineIds: readonly string[]
  rightLineIds: readonly string[]
  expectedLeftText: string
  expectedRightText: string
  rationale: string
}

const normalize = (value: string) => value.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const lineId = (line: SpeechLine, index: number) => line.copyKey ?? line.finalScriptSource?.sourceNodeId ?? line.r55Source?.nodeId ?? `line-${index + 1}`
const words = (value: string) => value.split(' ').filter(Boolean)
const bigrams = (value: string) => {
  const tokens = words(value)
  return new Set(tokens.length < 2 ? tokens : tokens.slice(0, -1).map((token, index) => `${token} ${tokens[index + 1]}`))
}
const jaccard = (left: Set<string>, right: Set<string>) => {
  const union = new Set([...left, ...right])
  if (!union.size) return 0
  let intersection = 0
  for (const value of left) if (right.has(value)) intersection += 1
  return intersection / union.size
}
const overlaps = (left: RepetitionWindow, right: RepetitionWindow) => left.start < right.end && right.start < left.end

function windows(lines: readonly SpeechLine[]) {
  const result: RepetitionWindow[] = []
  // Long dialogue regressions in the authorization exchange were made of
  // differently-split historical blocks, so a four-bubble scan could miss
  // the repeated passage. Eight bubbles is the permanent production floor.
  for (let start = 0; start < lines.length; start += 1) for (let length = 1; length <= 8 && start + length <= lines.length; length += 1) {
    const slice = lines.slice(start, start + length)
    const text = slice.map(line => line.text).join(' ')
    result.push({ start, end: start + length, lineIds: slice.map((line, index) => lineId(line, start + index)), text, normalized: normalize(text) })
  }
  return result
}

function classify(left: RepetitionWindow, right: RepetitionWindow): { kind: RepetitionKind; score: number } | null {
  if (!left.normalized || !right.normalized || overlaps(left, right)) return null
  if (left.normalized === right.normalized) return { kind: 'EXACT', score: 1 }
  const shorter = left.normalized.length <= right.normalized.length ? left : right
  const longer = shorter === left ? right : left
  const ratio = shorter.normalized.length / longer.normalized.length
  if (shorter.normalized.length >= 35 && ratio >= .55 && longer.normalized.includes(shorter.normalized)) return { kind: 'CONTAINMENT', score: ratio }
  if (Math.min(words(left.normalized).length, words(right.normalized).length) < 6 || ratio < .65) return null
  const score = jaccard(bigrams(left.normalized), bigrams(right.normalized))
  return score >= .82 ? { kind: 'HIGH_SIMILARITY', score } : null
}

function sameFinding(left: RepetitionFinding, right: RepetitionFinding) {
  return left.routeId === right.routeId && left.kind === right.kind
    && left.left.lineIds.join('|') === right.left.lineIds.join('|')
    && left.right.lineIds.join('|') === right.right.lineIds.join('|')
}

function allowlisted(finding: RepetitionFinding, allowlist: readonly RepetitionAllowlistEntry[]) {
  return allowlist.some(entry => entry.routeId === finding.routeId && entry.kind === finding.kind
    && entry.leftLineIds.join('|') === finding.left.lineIds.join('|')
    && entry.rightLineIds.join('|') === finding.right.lineIds.join('|')
    && normalize(entry.expectedLeftText) === finding.left.normalized
    && normalize(entry.expectedRightText) === finding.right.normalized
    && entry.rationale.trim().length >= 12)
}

export function auditDialogueRepetition(routes: readonly { routeId: string; lines: readonly SpeechLine[] }[], allowlist: readonly RepetitionAllowlistEntry[] = []) {
  const findings: RepetitionFinding[] = []
  for (const route of routes) {
    const candidates = windows(route.lines)
    for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const left = candidates[leftIndex]!, right = candidates[rightIndex]!
      const match = classify(left, right)
      if (!match) continue
      const finding = { routeId: route.routeId, kind: match.kind, left, right, score: match.score }
      // Prefer the smallest exact evidence for the same line identities/kind.
      if (!findings.some(existing => sameFinding(existing, finding))) findings.push(finding)
    }
  }
  const unallowlisted = findings.filter(finding => !allowlisted(finding, allowlist))
  const staleAllowlist = allowlist.filter(entry => !findings.some(finding => finding.routeId === entry.routeId && finding.kind === entry.kind
    && finding.left.lineIds.join('|') === entry.leftLineIds.join('|') && finding.right.lineIds.join('|') === entry.rightLineIds.join('|')))
  return { routeCount: routes.length, findings, unallowlisted, allowlist: [...allowlist], staleAllowlist }
}
