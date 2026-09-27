import { describe, expect, it } from 'vitest'
import { clearProductionGameplayPersistence, initialProductionNavigationState, productionNavigationReducer } from '../../src/app/productionNavigation'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe('S12-P4 Tarka launch navigation', () => {
  it('boots at the title and starts every play action with a new run epoch', () => {
    const first = productionNavigationReducer(initialProductionNavigationState, { type: 'PLAY' })
    expect(first).toMatchObject({ screen: 'GAMEPLAY', freshRunEpoch: 1 })
    const menu = productionNavigationReducer(first, { type: 'MAIN_MENU' })
    expect(menu).toMatchObject({ screen: 'TITLE', titleFocus: 'PLAY' })
    const replay = productionNavigationReducer(menu, { type: 'PLAY_AGAIN' })
    expect(replay).toMatchObject({ screen: 'GAMEPLAY', freshRunEpoch: 2 })
  })

  it('returns credits to its opener and restores title focus', () => {
    const credits = productionNavigationReducer(initialProductionNavigationState, { type: 'OPEN_CREDITS', from: 'TITLE' })
    expect(credits.screen).toBe('CREDITS')
    expect(productionNavigationReducer(credits, { type: 'RETURN_FROM_CREDITS' })).toMatchObject({ screen: 'TITLE', titleFocus: 'CREDITS' })
  })

  it('clears only gameplay persistence and preserves dev, art, preference, and unrelated keys', () => {
    const storage = new MemoryStorage()
    storage.setItem('trace-case-v1:euler:sha', 'stale terminal state')
    storage.setItem('tarka.gameplay.v1', 'stale run')
    storage.setItem('trace-escape.accessibility.v1', 'preference')
    storage.setItem('trace-escape.dev-library', 'keep')
    storage.setItem('unrelated', 'keep')
    expect(clearProductionGameplayPersistence(storage).sort()).toEqual(['tarka.gameplay.v1', 'trace-case-v1:euler:sha'])
    expect(storage.getItem('trace-escape.accessibility.v1')).toBe('preference')
    expect(storage.getItem('trace-escape.dev-library')).toBe('keep')
    expect(storage.getItem('unrelated')).toBe('keep')
  })
})
