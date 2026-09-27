import fs from 'node:fs'
import { load as loadYaml } from 'js-yaml'
import { getClockState, loadSchedule } from './project-clock-lib.mjs'

export function loadStatus(url = new URL('../docs/PROJECT_STATUS.yaml', import.meta.url)) {
  return loadYaml(fs.readFileSync(url, 'utf8'))
}

export function validateCodexStatusUpdate(current, next) {
  if (current.lead_acceptance_status !== next.lead_acceptance_status) {
    throw new Error('Codex status update cannot change Lead acceptance status')
  }
  if (current.accepted_base !== next.accepted_base) {
    throw new Error('Codex status update cannot change the accepted base')
  }
  if (current.api_authorization?.nansen !== next.api_authorization?.nansen || current.api_authorization?.alchemy !== next.api_authorization?.alchemy) {
    throw new Error('Codex status update cannot change API authorization')
  }
  return true
}

export function applyRecordedLeadReceipt(current, receipt) {
  if (receipt?.disposition !== 'ACCEPTED' || typeof receipt?.accepted_base !== 'string' || receipt.accepted_base.length === 0) {
    throw new Error('Accepted base can change only from a recorded ACCEPTED Lead receipt')
  }
  return {
    ...current,
    accepted_base: receipt.accepted_base,
    accepted_implementation_cut: receipt.accepted_implementation_cut,
    lead_acceptance_status: receipt.lead_acceptance_status,
  }
}

export function getSnapshotWarning(status, now, staleAfterHours = 24) {
  const snapshot = new Date(status.snapshot.utc)
  if (Number.isNaN(snapshot.valueOf())) return 'WARNING: status snapshot timestamp is invalid'
  const ageHours = (now.valueOf() - snapshot.valueOf()) / 3_600_000
  return ageHours > staleAfterHours
    ? `WARNING: status snapshot is stale by ${ageHours.toFixed(1)} hours`
    : null
}

function list(value) {
  if (!Array.isArray(value) || value.length === 0) return '  - NONE'
  return value.map((item) => `  - ${String(item)}`).join('\n')
}

export function renderStatus(status, now = new Date()) {
  const usage = status.api_usage
  const snapshotWarning = getSnapshotWarning(status, now)
  const clockHealth = getClockState(loadSchedule(), status.active_gate.id, now).scheduleHealth
  return [
    '',
    'TRACE//ESCAPE PROJECT STATUS',
    `Source set: ${status.source_set_version}`,
    ...(status.active_overlay_version ? [`Active overlay: ${status.active_overlay_version}`] : []),
    `Accepted base: ${status.accepted_base ?? 'NONE — no Lead acceptance yet'}`,
    `Candidate base: ${status.candidate_base ?? 'PENDING'}`,
    `Implementation: ${status.implementation_status}`,
    `Lead disposition: ${status.lead_acceptance_status}`,
    `Schedule health: ${clockHealth} (clock-derived; recorded ${status.schedule_health})`,
    `API authorization: Nansen ${status.api_authorization.nansen}; Alchemy ${status.api_authorization.alchemy}`,
    `TRACE acquisition: ${usage.nansen_calls} attempts / ${usage.nansen_credits_reported} known credits; Alchemy ${usage.alchemy_calls} calls`,
    ...(status.account_compliance ? [`Meridian account quota: verified eligible successes ${status.account_compliance.verified_eligible_successes ?? 'UNKNOWN'} / ${status.account_compliance.official_floor}; quota claimed ${status.account_compliance.quota_claimed}`, `Curated product evidence: ${status.curated_product_evidence.lead_accepted_calls} accepted calls; no numeric product-call floor`, `CPP sample: ${status.account_compliance.cpp_sample_requests} requests / ${status.account_compliance.cpp_sample_credits} credits; ${status.account_compliance.evidence_class}, not final proof`] : []),
    'Blockers:',
    list(status.blockers),
    'Remaining critical path:',
    list(status.remaining_critical_path),
    `Next acceptance event: ${status.next_acceptance_event}`,
    snapshotWarning,
  ].filter((line) => line !== null).join('\n')
}
