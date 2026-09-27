import type { SideLeadCompletion } from '../story/r55/production'

export const PUBLIC_APPLICATION_NAME = 'Tarka'
export const PUBLIC_APPLICATION_DESCRIPTOR = 'Tarka — A Pixel Retro Nansen Investigation'

export type ProductionScreen = 'TITLE' | 'CREDITS' | 'GAMEPLAY' | 'COMPLETION'

export interface ProductionNavigationState {
  screen: ProductionScreen
  creditsReturn: Exclude<ProductionScreen, 'CREDITS'>
  freshRunEpoch: number
  titleFocus: 'PLAY' | 'CREDITS' | null
  completionStatus: SideLeadCompletion
}

export type ProductionNavigationAction =
  | { type: 'PLAY' }
  | { type: 'OPEN_CREDITS'; from?: Exclude<ProductionScreen, 'CREDITS'> }
  | { type: 'RETURN_FROM_CREDITS' }
  | { type: 'MAIN_MENU' }
  | { type: 'PLAY_AGAIN' }
  | { type: 'COMPLETE'; status: SideLeadCompletion }

export const initialProductionNavigationState: ProductionNavigationState = {
  screen: 'TITLE',
  creditsReturn: 'TITLE',
  freshRunEpoch: 0,
  titleFocus: null,
  completionStatus: 'UNDISCOVERED',
}

export function productionNavigationReducer(
  state: ProductionNavigationState,
  action: ProductionNavigationAction,
): ProductionNavigationState {
  switch (action.type) {
    case 'PLAY':
    case 'PLAY_AGAIN':
      return { ...state, screen: 'GAMEPLAY', freshRunEpoch: state.freshRunEpoch + 1, titleFocus: null }
    case 'OPEN_CREDITS':
      return { ...state, screen: 'CREDITS', creditsReturn: action.from ?? (state.screen === 'GAMEPLAY' || state.screen === 'COMPLETION' ? state.screen : 'TITLE'), titleFocus: null }
    case 'RETURN_FROM_CREDITS':
      return { ...state, screen: state.creditsReturn, titleFocus: state.creditsReturn === 'TITLE' ? 'CREDITS' : null }
    case 'MAIN_MENU':
      return { ...state, screen: 'TITLE', creditsReturn: 'TITLE', titleFocus: 'PLAY' }
    case 'COMPLETE':
      return { ...state, screen: 'COMPLETION', creditsReturn: 'COMPLETION', completionStatus: action.status, titleFocus: null }
  }
}

const GAMEPLAY_STORAGE_KEYS = new Set(['tarka.gameplay.v1', 'trace-escape.gameplay.v1'])
const GAMEPLAY_STORAGE_PREFIXES = ['trace-case-v1:']

export function clearProductionGameplayPersistence(storage: Storage | null): string[] {
  if (!storage) return []
  const removed: string[] = []
  try {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => Boolean(key))
    for (const key of keys) {
      if (!GAMEPLAY_STORAGE_KEYS.has(key) && !GAMEPLAY_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) continue
      storage.removeItem(key)
      removed.push(key)
    }
  } catch {
    // Storage may be unavailable. The keyed React remount remains the authoritative reset.
  }
  return removed
}
