import type { AdventureState } from './types'

/** Puzzle progress that a production save may keep. */
export const DURABLE_ADVENTURE_FIELDS = ['instantText', 'highContrastHotspots', 'dialoguePresentation', 'reducedAnimation'] as const
export const ACCESSIBILITY_FIELDS = DURABLE_ADVENTURE_FIELDS

/** Live interaction state. It must not enter a production save. */
export const EPHEMERAL_ADVENTURE_FIELDS = [
  'walk',
  'selectedVerb',
  'selectedItemId',
  'hoveredHotspotId',
  'activeSequence',
  'speech',
  'nonblockingSpeech',
  'dialogueOpen',
  'intentReplacement',
  'focusReturnTarget',
  'rookPose',
  'mrIndexPose',
  'globePose',
  'globeMotion',
  'globeLevel',
  'globeElapsedMs',
  'globeBoostRemainingMs',
  'globeStartPhase',
  'globeDecayStage',
  'reviewHotspots',
  'inactiveSeconds',
] as const

export interface AccessibilityPreferences {
  instantText: boolean
  highContrastHotspots: boolean
  dialoguePresentation: AdventureState['dialoguePresentation']
  reducedAnimation: boolean
}

export function accessibilityPreferences(state: Pick<AdventureState, (typeof DURABLE_ADVENTURE_FIELDS)[number]>): AccessibilityPreferences {
  return {
    instantText: state.instantText,
    highContrastHotspots: state.highContrastHotspots,
    dialoguePresentation: state.dialoguePresentation,
    reducedAnimation: state.reducedAnimation,
  }
}

/** Investigation plus accessibility only. Ephemeral adventure fields are omitted. */
export function productionSaveDocument<T>(investigation: T, accessibility: AccessibilityPreferences) {
  return { investigation, accessibility }
}

export function ephemeralKeysIn(record: object): string[] {
  const keys = new Set(Object.keys(record))
  return EPHEMERAL_ADVENTURE_FIELDS.filter((field) => keys.has(field))
}
