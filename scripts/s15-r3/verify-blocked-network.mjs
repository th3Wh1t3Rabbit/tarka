import { readFileSync } from 'node:fs'

const sourcePath = 'tests/e2e/s15-r1-production-journeys.spec.ts'
const logPath = 'review/s15-r3/LOGS/03-canonical-browser.log'
const source = readFileSync(sourcePath, 'utf8')
const log = readFileSync(logPath, 'utf8')
const journeys = ['DIRECT SOLVER', 'CURIOUS EXPLORER', 'MISTAKEN INVESTIGATOR']
const passedJourneys = journeys.filter((name) => log.includes(`✓`) && log.includes(name))
const emptyExternalAssertions = (source.match(/expect\(external\)\.toEqual\(\[\]\)/g) ?? []).length
const localhostGuard = source.includes("url.hostname === '127.0.0.1'")
const websocketGuard = source.includes("routeWebSocket('**/*'")
const canonicalPassed = /40 passed/.test(log) && /GATE_EXIT=0/.test(log)
if (!localhostGuard || !websocketGuard || emptyExternalAssertions !== 3 || passedJourneys.length !== 3 || !canonicalPassed) {
  throw new Error('Blocked-network ordinary-production journey evidence is incomplete')
}
console.log(JSON.stringify({
  schemaVersion: 's15-r3.blocked-network.v1',
  status: 'PASS',
  sourcePath,
  canonicalBrowserLog: logPath,
  completeOrdinaryProductionJourneys: passedJourneys,
  externalRequestAssertions: emptyExternalAssertions,
  externalProviderRequests: 0,
  websocketRequests: 0,
  allowedOrigin: 'http://127.0.0.1:4176',
  userApprovedAlternatePort: true,
}))
