import { describe, expect, it } from 'vitest'
import { formatInZone, getClockState, loadSchedule, renderClock } from '../../scripts/project-clock-lib.mjs'
import { applyRecordedLeadReceipt, getSnapshotWarning, validateCodexStatusUpdate } from '../../scripts/project-status-lib.mjs'

const schedule = loadSchedule()

describe('project clock', () => {
  it('uses unchanged v1.7.0/v1.7.1/v1.7.2 plus additive v1.7.3 remediation authority and existing critical-path target', () => {
    expect(schedule.sourceSetVersion).toBe('1.7.0')
    expect(schedule.correctionVersion).toBe('1.7.1')
    expect(schedule.additiveDeltaVersion).toBe('1.7.3')
    expect(schedule.gates.find(({ id }) => id === 'G6P_A2U_R3_R1')?.due).toBe('2026-09-17T23:00:00Z')
    expect(schedule.activeHotSourceEpoch).toBe('1.11.0')
    expect(schedule.activeGate).toBe('G6P_NQ5_T1_S5')
    expect(schedule.gates.find(({ id }) => id === schedule.activeGate)?.due).toBe('2026-09-17T23:00:00Z')
    expect(schedule.gates.find(({ id }) => id === 'G6P_NQ5_T1_P1')?.due).toBe('2026-09-17T17:00:00Z')
  })

  it('records the current Mission02 scope-cut deadline rather than historical overlay authority', () => {
    expect(schedule.gates.find(({ id }) => id === 'MISSION02_CUT')).toEqual({
      id: 'MISSION02_CUT',
      name: 'Mission02 admission decision; cut first if not ready',
      due: '2026-09-21T19:00:00Z',
    })
  })

  it('reserves exactly 72 hours between internal and external deadlines', () => {
    const state = getClockState(schedule, schedule.activeGate, new Date('2026-09-14T23:00:00Z'))
    expect(state.bufferDifferenceHours).toBe(72)
  })

  it('formats fixed UTC timestamps in competition-time PT', () => {
    expect(formatInZone(new Date('2026-09-16T06:00:00Z'), schedule.displayTimezone))
      .toBe('2026-09-15 23:00:00 UTC-7')
    expect(formatInZone(new Date('2026-09-24T23:59:00Z'), schedule.displayTimezone))
      .toBe('2026-09-24 16:59:00 UTC-7')
  })

  it('reports before, at, and after the active gate boundary', () => {
    expect(getClockState(schedule, schedule.activeGate, new Date('2026-09-17T22:00:00Z')).gateDelta).toBe(3_600_000)
    expect(getClockState(schedule, schedule.activeGate, new Date('2026-09-17T23:00:00Z')).overdueGate).toBeNull()
    expect(getClockState(schedule, schedule.activeGate, new Date('2026-09-17T23:00:01Z')).overdueGate).toBe(schedule.activeGate)
  })

  it('reports a later gate when operational status advances', () => {
    const output = renderClock(schedule, 'G7', new Date('2026-09-22T05:00:00Z'))
    expect(output).toContain('Active gate: G7 — Content lock target, not claimed')
    expect(output).toContain('22:00:00 remaining')
    expect(output).toContain('Overdue gate: NONE')
  })

  it('derives clock-only GREEN, AMBER, and RED at the same six/twelve-hour thresholds, not source acceptance', () => {
    expect(getClockState(schedule, schedule.activeGate, new Date('2026-09-17T23:00:00Z')).scheduleHealth).toBe('GREEN')
    expect(getClockState(schedule, schedule.activeGate, new Date('2026-09-18T05:00:00Z')).scheduleHealth).toBe('GREEN')
    expect(getClockState(schedule, schedule.activeGate, new Date('2026-09-18T05:00:01Z')).scheduleHealth).toBe('AMBER')
    expect(getClockState(schedule, schedule.activeGate, new Date('2026-09-18T11:00:00Z')).scheduleHealth).toBe('AMBER')
    expect(getClockState(schedule, schedule.activeGate, new Date('2026-09-18T11:00:01Z')).scheduleHealth).toBe('RED')
    expect(renderClock(schedule, schedule.activeGate, new Date('2026-09-18T11:00:01Z'))).toContain('Schedule health: RED (clock-derived)')
  })

  it('retires only the curated numeric target while preserving account policy and every fixed deadline', () => {
    expect(schedule.officialAccountCallFloor).toBe(1000)
    expect(schedule.accountEvidencePlanningBuffer).toBe(1024)
    expect(schedule.requiredCuratedCallFloor).toBeNull()
    expect(schedule.gates.find(({ id }) => id === 'NQ5_T1_FLOOR_TARGET')).toMatchObject({due:'2026-09-18T19:00:00Z',status:'RETIRED_POLICY_REBASE'})
    expect(schedule.hardInternalDeadline).toBe('2026-09-24T23:59:00Z')
    expect(schedule.plannedSubmissionTarget).toBe('2026-09-25T19:00:00Z')
    expect(schedule.externalDeadline).toBe('2026-09-27T23:59:00Z')
    expect(schedule.reservedBufferHours).toBe(72)
  })

  it('transitions the buffer at the internal and external boundaries', () => {
    expect(getClockState(schedule, schedule.activeGate, new Date('2026-09-24T23:58:59Z')).bufferState).toBe('INTACT_PROTECTED')
    expect(getClockState(schedule, schedule.activeGate, new Date('2026-09-24T23:59:00Z')).bufferState).toBe('ACTIVE_CONTINGENCY')
    expect(getClockState(schedule, schedule.activeGate, new Date('2026-09-27T23:59:00Z')).bufferState).toBe('EXHAUSTED')
  })

  it('covers planned submission and external deadline arithmetic', () => {
    const before = getClockState(schedule, schedule.activeGate, new Date('2026-09-25T18:59:59Z'))
    const at = getClockState(schedule, schedule.activeGate, new Date('2026-09-25T19:00:00Z'))
    const afterExternal = getClockState(schedule, schedule.activeGate, new Date('2026-09-27T23:59:01Z'))
    expect(before.plannedDelta).toBe(1_000)
    expect(at.plannedDelta).toBe(0)
    expect(afterExternal.externalDelta).toBe(-1_000)
  })
})

describe('status ownership', () => {
  const base = {
    lead_acceptance_status: 'NOT_REVIEWED',
    accepted_base: null,
    api_authorization: { nansen: 'BLOCKED', alchemy: 'BLOCKED' },
  }

  it('allows Codex-owned implementation reporting', () => {
    expect(validateCodexStatusUpdate(base, { ...base, implementation_status: 'DELIVERED_PENDING_LEAD_REVIEW' })).toBe(true)
  })

  it('rejects self-marking Lead acceptance or accepted base', () => {
    expect(() => validateCodexStatusUpdate(base, { ...base, lead_acceptance_status: 'ACCEPTED' })).toThrow(/Lead acceptance/)
    expect(() => validateCodexStatusUpdate(base, { ...base, accepted_base: 'abc123' })).toThrow(/accepted base/)
  })

  it('changes an accepted base only from a recorded ACCEPTED Lead receipt', () => {
    const receipt = {
      disposition: 'ACCEPTED',
      accepted_base: '58ef9823cc34f56bcbba96b646072193f09bdf22',
      accepted_implementation_cut: '0bba275aa41d6247a714a39799c6d20bade6f575',
      lead_acceptance_status: 'G0_G1_ACCEPTED',
    }
    expect(applyRecordedLeadReceipt(base, receipt).accepted_base).toBe(receipt.accepted_base)
    expect(() => applyRecordedLeadReceipt(base, { ...receipt, disposition: 'PENDING' })).toThrow(/recorded ACCEPTED Lead receipt/)
  })

  it('warns when the operational snapshot is stale', () => {
    const status = { snapshot: { utc: '2026-09-14T23:56:21Z' } }
    expect(getSnapshotWarning(status, new Date('2026-09-15T23:56:20Z'))).toBeNull()
    expect(getSnapshotWarning(status, new Date('2026-09-16T00:56:21Z'))).toMatch(/stale by 25.0 hours/)
  })
})
