import { hotspots, inventoryItems } from './content'
import { publicObjectName } from '../controller/content/adapter'
import type { AdventureState, VerbId } from './types'

function sentenceCase(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
}

export function displayCommandSentence(state: AdventureState, hoveredItemName: string | null) {
  return hoveredItemName ?? buildCommandSentence(state)
}

export function buildCommandSentence(state: AdventureState) {
  const hotspot = hotspots.find(({ id }) => id === state.hoveredHotspotId)
  const objectName = hotspot ? publicObjectName(hotspot) : '...'
  if (!state.selectedVerb) return hotspot ? `Walk to ${objectName}` : 'Walk to'
  const verb = sentenceCase(state.selectedVerb satisfies VerbId)
  const item = state.selectedItemId ? inventoryItems[state.selectedItemId] : null
  if ((state.selectedVerb === 'USE' || state.selectedVerb === 'GIVE') && item) {
    const connector = state.selectedVerb === 'GIVE' ? 'to' : 'with'
    return hotspot ? `${verb} ${item.name} ${connector} ${objectName}` : `${verb} ${item.name} ${connector}`
  }
  return hotspot ? `${verb} ${objectName}` : verb
}
