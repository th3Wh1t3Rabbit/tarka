import fs from 'node:fs'

const SECOND = 1_000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function loadSchedule(url = new URL('../docs/PROJECT_SCHEDULE.json', import.meta.url)) {
  return JSON.parse(fs.readFileSync(url, 'utf8'))
}

export function parseNowArg(argv = process.argv.slice(2), fallback = new Date()) {
  const index = argv.indexOf('--now')
  if (index === -1) return fallback
  const value = argv[index + 1]
  if (!value) throw new Error('Expected an ISO timestamp after --now')
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) throw new Error(`Invalid --now timestamp: ${value}`)
  return parsed
}

export function formatInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'shortOffset',
  }).formatToParts(date)
  const value = (type) => parts.find((part) => part.type === type)?.value ?? ''
  const offset = value('timeZoneName').replace('GMT', 'UTC')
  return `${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')}:${value('second')} ${offset}`
}

export function formatDuration(milliseconds) {
  const overdue = milliseconds < 0
  let remaining = Math.abs(milliseconds)
  const days = Math.floor(remaining / DAY)
  remaining %= DAY
  const hours = Math.floor(remaining / HOUR)
  remaining %= HOUR
  const minutes = Math.floor(remaining / MINUTE)
  remaining %= MINUTE
  const seconds = Math.floor(remaining / SECOND)
  const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  const duration = days > 0 ? `${days}d ${clock}` : clock
  return overdue ? `OVERDUE by ${duration}` : `${duration} remaining`
}

export function getClockState(schedule, activeGateId, now) {
  const activeGate = schedule.gates.find((gate) => gate.id === activeGateId)
  if (!activeGate) throw new Error(`Unknown active gate: ${activeGateId}`)

  const internal = new Date(schedule.hardInternalDeadline)
  const planned = new Date(schedule.plannedSubmissionTarget)
  const external = new Date(schedule.externalDeadline)
  const gateDue = new Date(activeGate.due)
  const bufferDifferenceHours = (external.valueOf() - internal.valueOf()) / HOUR
  if (bufferDifferenceHours !== schedule.reservedBufferHours) {
    throw new Error(`Schedule invariant failed: expected ${schedule.reservedBufferHours} buffer hours, found ${bufferDifferenceHours}`)
  }

  let bufferState = 'INTACT_PROTECTED'
  if (now >= internal && now < external) bufferState = 'ACTIVE_CONTINGENCY'
  if (now >= external) bufferState = 'EXHAUSTED'

  let scheduleHealth = 'GREEN'
  if (gateDue.valueOf() - now.valueOf() < -6 * HOUR) scheduleHealth = 'AMBER'
  if (gateDue.valueOf() - now.valueOf() < -12 * HOUR) scheduleHealth = 'RED'

  return {
    now,
    activeGate,
    gateDelta: gateDue.valueOf() - now.valueOf(),
    internalDelta: internal.valueOf() - now.valueOf(),
    plannedDelta: planned.valueOf() - now.valueOf(),
    externalDelta: external.valueOf() - now.valueOf(),
    bufferDifferenceHours,
    bufferState,
    scheduleHealth,
    overdueGate: now > gateDue ? activeGate.id : null,
  }
}

export function renderClock(schedule, activeGateId, now) {
  const clock = getClockState(schedule, activeGateId, now)
  return [
    'TRACE//ESCAPE PROJECT CLOCK',
    `Current UTC: ${now.toISOString()}`,
    `Current PT:  ${formatInZone(now, schedule.displayTimezone)}`,
    `Active gate: ${clock.activeGate.id} — ${clock.activeGate.name}`,
    `Gate due:    ${formatDuration(clock.gateDelta)}`,
    `Internal:    ${formatDuration(clock.internalDelta)} (${schedule.hardInternalDeadline})`,
    `Submission:  ${formatDuration(clock.plannedDelta)} (${schedule.plannedSubmissionTarget})`,
    `External:    ${formatDuration(clock.externalDelta)} (${schedule.externalDeadline})`,
    `Buffer:      ${clock.bufferState} — ${clock.bufferDifferenceHours}h reserved`,
    `Overdue gate: ${clock.overdueGate ?? 'NONE'}`,
    `Schedule health: ${clock.scheduleHealth} (clock-derived)`,
  ].join('\n')
}
