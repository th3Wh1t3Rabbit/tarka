import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { auditProductionDialogueRoutes, findDialogueRepetitions, PRODUCTION_REPETITION_ALLOWLIST } from '../../src/adventure/productionDialogueAudit'
import { FORM_SEQUENCE_SPEECH } from '../../src/adventure/content'
import { R55_ACTUAL_ACTION_MATRIX, executeR55ActualAction } from '../../src/adventure/r55ProductionRouteRegistry'

describe('S17-P2-R2 effective production dialogue repetition guard', () => {
  it('proves exact, containment, and paraphrase detectors against executable synthetic routes', () => {
    const line = (copyKey: string, text: string) => ({ speaker: 'ROOK' as const, copyKey, text })
    expect(findDialogueRepetitions('mutant.exact', [line('a', 'A repeated authorization sentence.'), line('b', 'A repeated authorization sentence.')]).some(finding => finding.kind === 'EXACT')).toBe(true)
    expect(findDialogueRepetitions('mutant.containment', [line('a', 'The confidential files are in the cabinet.'), line('b', 'Remember: the confidential files are in the cabinet.')]).some(finding => finding.kind === 'CONTAINMENT')).toBe(true)
    expect(findDialogueRepetitions('mutant.similarity', [line('a', 'We should inspect the confidential file cabinet now.'), line('b', 'We should inspect that confidential file cabinet now.')]).some(finding => finding.kind === 'HIGH_SIMILARITY')).toBe(true)
  })

  it('executes all 214 registered routes without an accidental repeated bubble or block', () => {
    const audit = auditProductionDialogueRoutes()
    expect(audit.routeCount).toBe(214)
    expect(audit.routeErrors).toEqual([])
    expect(PRODUCTION_REPETITION_ALLOWLIST.length).toBeLessThanOrEqual(3)
    expect(audit.violations).toEqual([])
    if (process.env.S17_P2_R2_WRITE_EVIDENCE === '1') {
      const directory = resolve('review/s17-p2-r2')
      mkdirSync(directory, { recursive: true })
      writeFileSync(resolve(directory, 'PRODUCTION_DIALOGUE_AUDIT.json'), `${JSON.stringify({ schemaVersion: '1.0.0', ...audit, allowlist: PRODUCTION_REPETITION_ALLOWLIST }, null, 2)}\n`)
    }
  }, 20_000)

  it('hard-locks give-form to the current A1 post-authorization owners exactly once', () => {
    const descriptor = R55_ACTUAL_ACTION_MATRIX.find(route => route.routeId === 'useful.give-form')!
    const lines = executeR55ActualAction(descriptor).lines
    const sourceEvent = (line: (typeof lines)[number]) => line.finalScriptSource?.eventKey ?? line.r55Source?.eventKey
    const eventKeys = lines.map(sourceEvent).filter(Boolean)
    expect(eventKeys).not.toContain('COPY.A2_A4:A2.1 — Post-authorization direction')
    expect(new Set(FORM_SEQUENCE_SPEECH.POST_STAMP_AUTHORIZATION.map(line => line.finalScriptSource?.eventKey ?? line.r55Source?.eventKey))).toEqual(new Set([
      'COPY.A1:Stamp, return, and authorization',
      'COPY.A1:Confidential-files warning and approved continuation',
    ]))
    expect(lines.filter(line => sourceEvent(line) === 'COPY.A1:Stamp, return, and authorization')).toHaveLength(FORM_SEQUENCE_SPEECH.POST_STAMP_AUTHORIZATION.filter(line => (line.finalScriptSource?.eventKey ?? line.r55Source?.eventKey) === 'COPY.A1:Stamp, return, and authorization').length)
    expect(lines.filter(line => sourceEvent(line) === 'COPY.A1:Confidential-files warning and approved continuation')).toHaveLength(FORM_SEQUENCE_SPEECH.POST_STAMP_AUTHORIZATION.filter(line => (line.finalScriptSource?.eventKey ?? line.r55Source?.eventKey) === 'COPY.A1:Confidential-files warning and approved continuation').length)
    if (process.env.S17_P2_R2_WRITE_EVIDENCE === '1') {
      const directory = resolve('review/s17-p2-r2')
      mkdirSync(directory, { recursive: true })
      writeFileSync(resolve(directory, 'EFFECTIVE_GIVE_FORM_ROUTE.json'), `${JSON.stringify({
        routeId: descriptor.routeId,
        lineCount: lines.length,
        lines: lines.map((line, index) => ({ index: index + 1, speaker: line.speaker, text: line.text, copyKey: line.copyKey, sourceEvent: sourceEvent(line) })),
      }, null, 2)}\n`)
    }
  })
})
