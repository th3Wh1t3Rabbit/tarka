import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const partial = process.argv.includes('--no-hardcoded')
const receipt = resolve('review/s15-r6/RECEIPTS/BROWSER_STAGE_OBSERVATIONS.ndjson')
if (!existsSync(receipt)) throw Error('R6_BROWSER_RECEIPT_MISSING')
const rows = readFileSync(receipt, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
if (!rows.length) throw Error('R6_BROWSER_RECEIPT_EMPTY')
if (rows.some(row => row.action === 'PASS' || row.semanticContact === 'PASS' || row.physicalPose === 'PASS')) throw Error('R6_HARDCODED_PASS_REJECTED')
for (const row of rows) {
  if (!row.generatingTestId || !row.stateActionRoute || !row.phase || !row.rook?.animation || typeof row.rook?.cue !== 'string' || !row.rook?.performance || !Array.isArray(row.inventory)) throw Error(`R6_UNBOUND_BROWSER_ROW:${row.screenshot}`)
  if (row.screenshot && !existsSync(resolve('review/s15-r6', row.screenshot))) throw Error(`R6_SCREENSHOT_MISSING:${row.screenshot}`)
}
if (!partial) {
  const expected = [
    'take-form-empty-hand-contact', 'take-pen-empty-hand-contact', 'drawer-loot-empty-hand-contact', 'case-file-item-contact',
    'form-pre-handoff-rook-paper', 'form-post-handoff-arthur-document', 'form-stamp-contact-desk-stamp-hidden',
    'form-post-stamp-pre-return-desk-stamp-restored', 'form-approved-return-normal-staging',
  ]
  for (const id of expected) if (!rows.some(row => row.screenshot === `SCREENSHOTS/${id}.png`)) throw Error(`R6_REQUIRED_STAGE_MISSING:${id}`)
  const byAction = action => rows.find(row => row.action === action)
  if (byAction('offer')?.formPaperOwner !== 'ROOK_VISIBLE') throw Error('R6_OFFER_OWNER_OBSERVATION_FAILED')
  if (byAction('handoff')?.formPaperOwner !== 'ARTHUR_VISIBLE' || byAction('handoff')?.arthur?.animation !== 'document') throw Error('R6_HANDOFF_OWNER_OBSERVATION_FAILED')
  if (byAction('stamp')?.deskStampVisible !== 'false' || byAction('stamp')?.arthur?.animation !== 'stamp') throw Error('R6_STAMP_USE_OBSERVATION_FAILED')
  if (byAction('stamp-caption')?.deskStampVisible !== 'true' || byAction('stamp-caption')?.arthur?.animation !== 'document') throw Error('R6_POST_STAMP_OBSERVATION_FAILED')
  if (byAction('focus')?.formPaperOwner !== 'ROOK_APPROVED_INVENTORY' || byAction('focus')?.rook?.animation !== 'idle' || byAction('focus')?.arthur?.animation !== 'idle') throw Error('R6_NORMAL_STAGING_OBSERVATION_FAILED')
}
console.log(`PASS_S15_R6_BROWSER_EVIDENCE ${rows.length}`)
