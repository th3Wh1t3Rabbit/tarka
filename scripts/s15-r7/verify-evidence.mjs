import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve('review/s15-r7')
const browserPath = resolve(root, 'RECEIPTS/BROWSER_STAGE_OBSERVATIONS.ndjson')
const reducerPath = resolve(root, 'RECEIPTS/REDUCER_STAGE_OBSERVATIONS.ndjson')
const mouthPath = resolve(root, 'RECEIPTS/MOUTH_FRAME_SERIES.json')
for (const path of [browserPath, reducerPath, mouthPath]) if (!existsSync(path)) throw Error(`R7_EVIDENCE_MISSING:${path}`)
const rows = readFileSync(browserPath, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
const reducer = readFileSync(reducerPath, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
const mouth = JSON.parse(readFileSync(mouthPath, 'utf8'))
if (!rows.length || !reducer.length || !mouth.samples?.length) throw Error('R7_EVIDENCE_EMPTY')
if (rows.some(row => Object.values(row).includes('PASS'))) throw Error('R7_HARDCODED_PASS_REJECTED')
const required = ['opening-frame-zero-blackout', 'opening-entry-blackout-inert', 'opening-final-dismissal-active', 'opening-auto-mouth-owner', 'form-review-dialogue-one-paper', 'form-stamp-approval-commit', 'form-post-stamp-continuation', 'form-truthful-return', 'terminal-powered-unauthorized']
for (const id of required) {
  const row = rows.find(item => item.screenshot === `SCREENSHOTS/${id}.png`)
  if (!row || !row.generatingTestId || !row.stateActionRoute || !existsSync(resolve(root, row.screenshot))) throw Error(`R7_BROWSER_STAGE_MISSING:${id}`)
}
const stage = id => rows.find(row => row.screenshot === `SCREENSHOTS/${id}.png`)
if (stage('opening-frame-zero-blackout').interfaceTreatment !== 'BLACKOUT' || stage('opening-entry-blackout-inert').interfaceTreatment !== 'BLACKOUT') throw Error('R7_OPENING_BLACKOUT_EVIDENCE_FAILED')
if (stage('opening-final-dismissal-active').interfaceTreatment !== 'ACTIVE') throw Error('R7_OPENING_DISMISSAL_EVIDENCE_FAILED')
if (stage('form-review-dialogue-one-paper').paperOverlayCount !== 1 || stage('form-review-dialogue-one-paper').paperOwner !== 'ARTHUR_VISIBLE') throw Error('R7_REVIEW_PAPER_EVIDENCE_FAILED')
if (stage('form-stamp-approval-commit').deskStampOwner !== 'ARTHUR_IN_USE' || stage('form-stamp-approval-commit').terminalAuthorized !== 'true') throw Error('R7_STAMP_EVIDENCE_FAILED')
if (stage('form-post-stamp-continuation').deskStampOwner !== 'DESK') throw Error('R7_POST_STAMP_EVIDENCE_FAILED')
if (stage('form-truthful-return').actorIntentions !== 'ARTHUR:RETURN,ROOK:RECEIVE') throw Error('R7_RETURN_EVIDENCE_FAILED')
if (stage('terminal-powered-unauthorized').terminalPowered !== 'true' || stage('terminal-powered-unauthorized').terminalCanOpen !== 'false') throw Error('R7_TERMINAL_EVIDENCE_FAILED')
if (!mouth.samples.some(sample => sample.revealing === 'false')) throw Error('R7_REVEALED_WAIT_SAMPLE_MISSING')
for (const sample of mouth.samples) if ((sample.speaker === 'ROOK' ? sample.rookTalking : sample.arthurTalking) !== 'true') throw Error('R7_MOUTH_OWNER_SAMPLE_FAILED')
const screenshots = readdirSync(resolve(root, 'SCREENSHOTS')).filter(name => name.endsWith('.png'))
if (screenshots.length !== required.length) throw Error(`R7_SCREENSHOT_SET_UNEXPECTED:${screenshots.length}`)
console.log(`PASS_S15_R7_EVIDENCE browser=${rows.length} reducer=${reducer.length} mouth=${mouth.samples.length} screenshots=${screenshots.length}`)
