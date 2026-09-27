import { describe, expect, it } from 'vitest'
import { auditDialogueRepetition, type RepetitionAllowlistEntry } from '../../src/adventure/dialogueRepetitionAudit'
import { R55_TRUE_PRODUCTION_ROUTE_REGISTRY, executeR55TrueProductionRoute } from '../../src/adventure/r55ProductionRouteRegistry'

const INTENTIONAL_REPETITION_ALLOWLIST: readonly RepetitionAllowlistEntry[] = []

describe('S17-P2-R2 executable production-route repetition guard', () => {
  const routes = R55_TRUE_PRODUCTION_ROUTE_REGISTRY.map(route => ({ routeId: route.routeId, lines: executeR55TrueProductionRoute(route) }))

  it('executes every registered route and rejects exact, containment, and high-similarity repeated windows', () => {
    const audit = auditDialogueRepetition(routes, INTENTIONAL_REPETITION_ALLOWLIST)
    expect(audit.routeCount).toBe(R55_TRUE_PRODUCTION_ROUTE_REGISTRY.length)
    expect(audit.staleAllowlist).toEqual([])
    expect(audit.unallowlisted).toEqual([])
  })

  it('keeps the superseded A2/A4 authorization block dormant in the effective give-form route', () => {
    const route = routes.find(candidate => candidate.routeId === 'useful.give-form')!
    const eventKeys = route.lines.map(line => line.finalScriptSource?.eventKey ?? line.r55Source?.eventKey)
    expect(eventKeys).not.toContain('COPY.A2_A4:A2.1 — Post-authorization direction')
    for (const phrase of ['But just for TODAY.', 'Knew the dinosaurs would win you over.', 'They did not.', 'Do not snoop.', 'How much snooping counts as snooping?', 'What if I need another case file?']) {
      expect(route.lines.filter(line => line.text.includes(phrase)), phrase).toHaveLength(1)
    }
  })
})
