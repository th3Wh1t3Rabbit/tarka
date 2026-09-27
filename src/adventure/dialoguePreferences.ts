import type { DialogueDisplay, DialogueMode, DialoguePace } from './types'

export const DIALOGUE_PREFERENCES_KEY = 'trace-dialogue-delivery-v1'
export interface DialoguePreferences { mode: DialogueMode; pace: DialoguePace; display: DialogueDisplay }
export const DEFAULT_DIALOGUE_PREFERENCES: DialoguePreferences = { mode: 'AUTO', pace: 'NORMAL', display: 'FULL' }

export function readDialoguePreferences(storage: Pick<Storage, 'getItem'> | null): DialoguePreferences {
  if (!storage) return DEFAULT_DIALOGUE_PREFERENCES
  try {
    const value = JSON.parse(storage.getItem(DIALOGUE_PREFERENCES_KEY) ?? 'null') as Partial<DialoguePreferences> | null
    return {
      mode: value?.mode === 'MANUAL' ? 'MANUAL' : 'AUTO',
      pace: value?.pace === 'SLOW' || value?.pace === 'FAST' ? value.pace : 'NORMAL',
      display: value?.display === 'TYPED' ? 'TYPED' : 'FULL',
    }
  } catch { return DEFAULT_DIALOGUE_PREFERENCES }
}

export function writeDialoguePreferences(storage: Pick<Storage, 'setItem'> | null, value: DialoguePreferences) {
  try { storage?.setItem(DIALOGUE_PREFERENCES_KEY, JSON.stringify(value)) } catch { /* Preference storage is optional. */ }
}
