const required = (condition, reason) => { if (!condition) throw new Error(reason) }
const bannedRoutePrimitives = /\b(?:r55SourceSlice|r55SpeechBySourceSlice|r55EventBySourceKey|r55SpeechByEvent|executeR55ProductionRoute)\s*\(/

export function validateTrueRouteSources(files) {
  const registry = files['src/adventure/r55ProductionRouteRegistry.ts']
  const test = files['tests/unit/s14-r5-true-production-routes.test.ts']
  const joined = Object.values(files).join('\n')
  required(!bannedRoutePrimitives.test(registry), 'PROJECTION_PRIMITIVE_COUNTED_AS_ROUTE:REGISTRY')
  required(!bannedRoutePrimitives.test(test), 'PROJECTION_PRIMITIVE_COUNTED_AS_ROUTE:TEST')
  required(!/projection\.sourceSlices\.map/.test(joined), 'PROJECTION_DESCRIPTOR_INVENTORY_COUNTED_AS_ROUTE')
  required(!/r55SpeechByEvent\(\s*(?:window|globalThis|localStorage|sessionStorage|location|document)/.test(joined), 'FREE_FORM_EVENT_LOOKUP')
  required(registry.includes('R55_TRUE_PRODUCTION_ROUTE_REGISTRY') && registry.includes('executeR55TrueProductionRoute'), 'TRUE_ROUTE_REGISTRY_MISSING')
  required(test.includes('executeR55TrueProductionRoute(descriptor)'), 'TRUE_ROUTE_EXECUTION_MISSING')
}
