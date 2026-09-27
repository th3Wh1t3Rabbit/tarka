#!/usr/bin/env node
import { loadSchedule, parseNowArg, renderClock } from './project-clock-lib.mjs'
import { loadStatus } from './project-status-lib.mjs'

const schedule = loadSchedule()
const status = loadStatus()
const now = parseNowArg()
process.stdout.write(`${renderClock(schedule, status.active_gate.id, now)}\n`)
