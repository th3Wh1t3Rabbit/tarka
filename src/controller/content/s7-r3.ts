import catalog from '../../../content/parallel/narrative/S7_R2B_CONTENT_CATALOG.json' with { type: 'json' }
import matrix from '../../../content/parallel/narrative/S7_R2B_INTERACTION_MATRIX.json' with { type: 'json' }
import runtimeMap from '../../../content/parallel/narrative/S7_R2B_RUNTIME_SELECTION_MAP.json' with { type: 'json' }
import claimAudit from '../../../content/parallel/narrative/S7_R2B_CLAIM_BOUNDARY_AUDIT.json' with { type: 'json' }
import type { HotspotId, SpeechLine, VerbId } from '../../adventure/types'

type CatalogEntry = (typeof catalog.entries)[number]
const entries = new Map<string, CatalogEntry>(catalog.entries.map((entry) => [entry.key, entry]))

export const S7_R3_CONTENT_IDENTITY = Object.freeze({
  interface: catalog.interface,
  contentSha256: catalog.content_sha256,
  entryCount: catalog.entry_count,
  status: catalog.status,
})

export function r2bEntry(key: string): CatalogEntry {
  const entry = entries.get(key)
  if (!entry) throw new Error(`S7_R2B_COPY_KEY_NOT_FOUND:${key}`)
  return entry
}

export function resolveR2bExactTokens(text: string): string {
  return Object.entries(claimAudit.exact_bindings).reduce((value, [token, binding]) => value.replaceAll(`{${token}}`, binding.accepted_value), text)
}

export function r2bText(key: string, exactBindings = false): string { const text = r2bEntry(key).text; return exactBindings ? resolveR2bExactTokens(text) : text }

export function r2bLines(keys: readonly string[], exactBindings = false): SpeechLine[] {
  return keys.map((key) => {
    const entry = r2bEntry(key)
    const speaker: SpeechLine['speaker'] = entry.speaker === 'ROOK' ? 'ROOK' : entry.speaker === 'SYSTEM' ? 'SYSTEM' : 'MR_INDEX'
    return { speaker, text: exactBindings ? resolveR2bExactTokens(entry.text) : entry.text, copyKey: key }
  })
}

export const R2B_SEQUENCES = Object.freeze({
  opening: r2bLines(runtimeMap.sequences.opening),
  wrongTheory: r2bLines(runtimeMap.sequences.wrong_theory),
  exactCorrection: r2bLines(runtimeMap.sequences.exact_correction, true),
  return: r2bLines(runtimeMap.sequences.return),
  returnTag: r2bLines(runtimeMap.sequences.return_tag),
})

export function r2bInteraction(targetId: HotspotId, verb: VerbId, repeat = 0): { copyIds: readonly string[]; lines: SpeechLine[]; behavior: string | null } | null {
  if (targetId === 'office-globe' && verb === 'PUSH') {
    const groups = matrix.globe_escalation
    const copyIds = groups[Math.min(repeat, groups.length - 1)]!
    return { copyIds, lines: r2bLines(copyIds), behavior: 'OPTIONAL_GLOBE_ESCALATION' }
  }
  const cell = matrix.cells.find((entry) => entry.hotspot === targetId && entry.verb === verb)
  if (!cell?.response_keys.length) return null
  return { copyIds: cell.response_keys, lines: r2bLines(cell.response_keys), behavior: cell.behavior }
}

export const S7_R2B_INITIAL_CARD_COPY = Object.freeze({
  WHAT_LEFT: r2bText('lane_a.s7r2b.question.what_left'),
  INCIDENT_DAI: r2bText('lane_a.s7r2b.question.incident_dai'),
  INTERACTIONS: r2bText('lane_a.s7r2b.question.interactions'),
  EXACT_LINK: r2bText('lane_a.s7r2b.question.exact_link'),
})

export function validateR2bRuntimeSelection(): boolean {
  const unique = new Set(catalog.entries.map((entry) => entry.key))
  return catalog.entry_count === 191 && unique.size === 191 && matrix.cell_count === 81 && matrix.cells.length === 81 && runtimeMap.cross_version_semantic_ownership.length === 11
}
