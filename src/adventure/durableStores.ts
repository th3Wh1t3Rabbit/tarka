import type { CaseFixture } from '../investigation/contracts'
import { exportLocalSave, restoreInvestigation, type InvestigationState } from '../investigation/state'
import { ACCESSIBILITY_FIELDS, type AccessibilityPreferences } from './persistencePolicy'

export const INVESTIGATION_SAVE_KEYS = ['fixtureId', 'fixtureMode', 'fixtureOrigin', 'saveVersion', 'commands'] as const
export const ACCESSIBILITY_SAVE_KEY = 'trace-escape.accessibility.v1'
export const DEV_LAYOUT_LIBRARY_KEY = 'trace-escape.layout-library.v1'
export const DEV_CUE_LIBRARY_KEY = 'trace-escape.animation-cues.v1'

export interface DurableStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const ACCESSIBILITY_DEFAULTS: AccessibilityPreferences = {
  instantText: false,
  highContrastHotspots: false,
  dialoguePresentation: 'FULLSCREEN_CRT',
  reducedAnimation: false,
}

function allowlistedInvestigation(raw: string): string | null {
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const record = parsed as Record<string, unknown>
  if (![2, 3, 4, 5].includes(Number(record.saveVersion))) return null
  const body: Record<string, unknown> = {}
  for (const key of INVESTIGATION_SAVE_KEYS) body[key] = record[key]
  if (record.saveVersion === 5 && Object.hasOwn(record, 'legacySource')) body.legacySource = record.legacySource
  return JSON.stringify(body)
}

/** A completed investigation is stronger than any later incomplete envelope. */
export function commitInvestigationSave(storage: DurableStorage | null, key: string, fixture: CaseFixture, next: InvestigationState): boolean {
  if (!storage) return false
  try {
    const previousText = storage.getItem(key)
    if (previousText) {
      const previous = restoreInvestigation(fixture, previousText)
      if (previous.complete && !next.complete) return false
    }
    const body = allowlistedInvestigation(exportLocalSave(next))
    if (!body) return false
    storage.setItem(key, body)
    return true
  } catch {
    return false
  }
}

export function readAccessibilityPreferences(storage: DurableStorage | null): AccessibilityPreferences {
  if (!storage) return { ...ACCESSIBILITY_DEFAULTS }
  try {
    const raw = storage.getItem(ACCESSIBILITY_SAVE_KEY)
    if (!raw) return { ...ACCESSIBILITY_DEFAULTS }
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...ACCESSIBILITY_DEFAULTS }
    const record = parsed as Record<string, unknown>
    if (record.schema !== 'trace-escape.accessibility.v1') return { ...ACCESSIBILITY_DEFAULTS }
    const keys = Object.keys(record).filter((key) => key !== 'schema')
    if (keys.some((key) => !ACCESSIBILITY_FIELDS.includes(key as (typeof ACCESSIBILITY_FIELDS)[number]))) return { ...ACCESSIBILITY_DEFAULTS }
    const presentation = record.dialoguePresentation
    if (presentation !== 'FULLSCREEN_CRT' && presentation !== 'DOCKED_OVERLAY' && presentation !== 'PLAIN_LIST') return { ...ACCESSIBILITY_DEFAULTS }
    if (typeof record.instantText !== 'boolean' || typeof record.highContrastHotspots !== 'boolean' || typeof record.reducedAnimation !== 'boolean') return { ...ACCESSIBILITY_DEFAULTS }
    return {
      instantText: record.instantText,
      highContrastHotspots: record.highContrastHotspots,
      dialoguePresentation: presentation,
      reducedAnimation: record.reducedAnimation,
    }
  } catch {
    return { ...ACCESSIBILITY_DEFAULTS }
  }
}

export function commitAccessibilityPreferences(storage: DurableStorage | null, preferences: AccessibilityPreferences): boolean {
  if (!storage) return false
  try {
    const body = {
      schema: 'trace-escape.accessibility.v1',
      instantText: preferences.instantText,
      highContrastHotspots: preferences.highContrastHotspots,
      dialoguePresentation: preferences.dialoguePresentation,
      reducedAnimation: preferences.reducedAnimation,
    }
    storage.setItem(ACCESSIBILITY_SAVE_KEY, JSON.stringify(body))
    return true
  } catch {
    return false
  }
}

export function devLibraryAccess(dev: boolean): boolean {
  return dev === true
}
