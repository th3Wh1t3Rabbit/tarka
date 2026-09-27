const required = (condition, reason) => { if (!condition) throw new Error(reason) }
const bannedRoutePrimitives = /\b(?:r55SourceSlice|r55SpeechBySourceSlice|r55EventBySourceKey|r55SpeechByEvent|executeR55ProductionRoute)\s*\(/

export function validateActionMatrixSources(files) {
  const registry = files['src/adventure/r55ProductionRouteRegistry.ts']
  const test = files['tests/unit/s14-r6-actual-action-matrix.test.ts']
  const joined = Object.values(files).join('\n')
  required(!bannedRoutePrimitives.test(registry), 'DIRECT_PROJECTION_AS_ROUTE:REGISTRY')
  required(!bannedRoutePrimitives.test(test), 'DIRECT_PROJECTION_AS_ROUTE:TEST')
  required(!/projection\.sourceSlices\.map/.test(joined), 'PROJECTION_DESCRIPTOR_INVENTORY_AS_ROUTE')
  required(!/r55SpeechByEvent\(\s*(?:window|globalThis|localStorage|sessionStorage|location|document)/.test(joined), 'FREE_FORM_EVENT_LOOKUP')
  required(registry.includes('R55_ACTUAL_ACTION_MATRIX') && registry.includes('executeR55ActualAction'), 'ACTUAL_ACTION_MATRIX_MISSING')
  required(test.includes('executeR55ActualAction(descriptor)'), 'ACTUAL_ACTION_EXECUTION_MISSING')
  required(test.includes('actualObservedNodeOccurrences') && test.includes('duplicateNodeOccurrences'), 'HANDWRITTEN_OR_UNOBSERVED_RECEIPT')
}
