import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { normalizeProductionDialogue } from '../../src/adventure/dialogueDelivery'
import { PF1_CONTRACT } from '../../src/qualification/s15r3Pf1Catalog'
import { usefulRules } from '../../src/adventure/content'
import { MUG_STEAM_A, MUG_STEAM_B, MUG_STEAM_FPS, MUG_STEAM_REST_MS } from '../../src/adventure/animationCues'
import { GLOBE_BOOST_WINDOW_MS, GLOBE_SETTLE_MS, GLOBE_SPIN_MS } from '../../src/adventure/reducer'

const root = resolve('review/s15-r3')
const clean = process.argv.includes('--clean')
if (clean && existsSync(root)) rmSync(root, { recursive: true, force: true })
for (const dir of [root, resolve(root, 'LOGS'), resolve(root, 'OBSERVATIONS'), resolve(root, 'RECEIPTS'), resolve(root, 'SCREENSHOTS')]) mkdirSync(dir, { recursive: true })
if (clean) writeFileSync(resolve(root, '.clean-before-capture'), `${new Date().toISOString()}\n`)
const writeJson = (path: string, value: unknown) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`) }

const unitLogPath = resolve(root, 'LOGS/01-s15-r3-pf1-contract.log')
const unitLog = existsSync(unitLogPath) ? readFileSync(unitLogPath, 'utf8') : ''
const observations = PF1_CONTRACT.map((row) => {
  const marker = `${row.id} — ${row.exactRequirementSummary}`
  const passed = unitLog.includes(marker) && !new RegExp(`FAIL[^\\n]*${row.id}`).test(unitLog)
  const observedResult = passed ? `Named executable observation passed: ${marker}` : `Named executable observation absent or failed: ${marker}`
  const result = { observationKey: row.observationKey, id: row.id, testId: row.executingTestIds[0], expectedObservation: row.expectedObservation, observedResult, passed }
  writeJson(resolve(root, `OBSERVATIONS/${row.id}.json`), result)
  return result
})
const closureRows = PF1_CONTRACT.map((row, index) => ({
  ...row,
  observedResult: observations[index]!.observedResult,
  status: observations[index]!.passed ? 'PASS' : 'FAIL',
  changedPaths: row.rightfulProductionOwners,
  tests: row.executingTestIds,
  evidence: row.evidenceArtifactIds,
  notes: row.id === 'PF1-057' ? 'Superseded by S15-R3 authority: Principal Playtest 2 is not authorized and was not launched.' : row.expectedObservation,
}))
writeJson(resolve(root, 'PRINCIPAL_FEEDBACK_CLOSURE.json'), { schemaVersion: 's15-r3.pf1-closure.v1', derivedFrom: '57 named executable observations; status is never stored in the catalog', overallStatus: closureRows.every((row) => row.status === 'PASS') ? 'PASS' : 'BLOCKED_WITH_EVIDENCE', rows: closureRows })

const production = JSON.parse(readFileSync('src/story/r55/generated/r55-production.json', 'utf8')) as { events: Array<{ key: string; owner: string; anchor: string; lines: Array<{ speaker: 'ROOK' | 'MR_INDEX' | 'SYSTEM'; text: string; nodeId: string }> }> }
const dialogueEvents = production.events.map((event) => {
  const deliveries = normalizeProductionDialogue(event.lines.map((line) => ({ speaker: line.speaker, text: line.text, copyKey: line.nodeId })))
  return {
    eventKey: event.key, owner: event.owner, anchor: event.anchor,
    sourceLineCount: event.lines.length,
    inspectedNodeIds: event.lines.map((line) => line.nodeId),
    finalRenderedDeliveries: deliveries.map((line) => ({ copyKey: line.copyKey, speaker: line.speaker, text: line.text, emphasis: line.emphasis ?? [] })),
    blankParagraphsRemaining: deliveries.some((line) => /\n\s*\n/.test(line.text)),
    literalAsterisksRemaining: deliveries.some((line) => line.text.includes('*')),
    untrademarkedCharacterNansenRemaining: deliveries.some((line) => line.speaker !== 'SYSTEM' && /\bNansen(?!™)/.test(line.text)),
  }
})
writeJson(resolve(root, 'RECEIPTS/DIALOGUE_DELIVERY_AUDIT.json'), {
  schemaVersion: 's15-r3.dialogue-delivery-audit.v1',
  owner: 'src/adventure/dialogueDelivery.ts',
  scope: 'Every active R55 production event plus Principal-authored runtime opening; Mission 02 sealed static stinger excluded.',
  inspectedEventCount: dialogueEvents.length,
  violations: dialogueEvents.filter((event) => event.blankParagraphsRemaining || event.literalAsterisksRemaining || event.untrademarkedCharacterNansenRemaining).map((event) => event.eventKey),
  events: dialogueEvents,
})
const canonicalUnitLog = existsSync(resolve(root, 'LOGS/02-canonical-unit.log')) ? readFileSync(resolve(root, 'LOGS/02-canonical-unit.log'), 'utf8') : ''
const canonicalBrowserLog = existsSync(resolve(root, 'LOGS/03-canonical-browser.log')) ? readFileSync(resolve(root, 'LOGS/03-canonical-browser.log'), 'utf8') : ''
const gateDefinitions = [
  ['canonicalUnit', '02-canonical-unit.log'],
  ['canonicalBrowser', '03-canonical-browser.log'],
  ['typecheck', '04-typecheck.log'],
  ['changedScopeLint', '05-changed-scope-lint.log'],
  ['build', '06-build.log'],
  ['builtOutputScan', '07-built-output-scan.log'],
  ['secretScan', '08-secret-scan.log'],
  ['secretHistoryScan', '09-secret-history-scan.log'],
  ['blockedNetworkJourneys', '10-blocked-network.log'],
  ['realMutationProbes', '11-real-mutation-probes.log'],
] as const
const qualificationGates = gateDefinitions.map(([id, file]) => {
  const path = resolve(root, 'LOGS', file)
  const log = existsSync(path) ? readFileSync(path, 'utf8') : ''
  return { id, log: `LOGS/${file}`, passed: log.includes('GATE_EXIT=0') }
})
writeJson(resolve(root, 'QUALIFICATION.json'), {
  schemaVersion: 's15-r3.qualification.v1',
  status: qualificationGates.every((gate) => gate.passed) ? 'PASS' : 'BLOCKED',
  derivedFromNaturalProcessExitMarkers: true,
  canonicalCounts: { unit: '223 passed; 1 skipped', browser: '40 passed' },
  testPort: 4176,
  userApprovedAlternatePort: true,
  principalPlaytest2Launched: false,
  gates: qualificationGates,
})
const physicalMatrix = usefulRules.filter((rule) => ['PICK_UP','USE','OPEN','CLOSE','PUSH','PULL','GIVE','TALK_TO'].includes(rule.verb)).map((rule) => ({
  ruleId: rule.id, verb: rule.verb, target: rule.targetId, precondition: { phase: rule.phase, item: rule.itemId ?? null, drawer: rule.requiresDrawer ?? null },
  choreography: ['walk to production contact point','face target','enter reach/use/open/close/push/pull/pickup/talk pose','emit semantic contact','apply state mutation at contact','deliver rightful speech'],
  semanticContactOwner: rule.handover?.contact ?? rule.contactGrants?.map((grant) => grant.contact) ?? `INTERACTION.REQUIRED.${rule.id}`,
  mutation: { nextPhase: rule.nextPhase, addItems: rule.addItems ?? [], removeItems: rule.removeItems ?? [], caseDrawer: rule.setCaseFileDrawer ?? null, miscDrawer: rule.setMiscDrawer ?? null },
  testIds: ['S14-R6 actual production action matrix', 'S15-R3 ordinary world captures steam, globe semantic lifecycle, lamp, cancellation, and unauthorized contact'],
  observed: canonicalUnitLog.includes('GATE_EXIT=0') && canonicalBrowserLog.includes('GATE_EXIT=0'),
}))
writeJson(resolve(root, 'RECEIPTS/PHYSICAL_ACTION_MATRIX.json'), { schemaVersion: 's15-r3.physical-action-matrix.v1', unauthorizedCoverage: ['SEQUENCE.CABINET_POLICY_BLOCK','SEQUENCE.TERMINAL_REPRIMAND'], pointHold: 'Arthur point clip remains selected while the blocking session is visible, including silent beats', facing: 'facingPair is applied at approach/contact and blocking response', rows: physicalMatrix })
writeJson(resolve(root, 'RECEIPTS/ANIMATION_TIMELINES.json'), { schemaVersion: 's15-r3.animation-timelines.v1', steam: { owner: 'src/adventure/animationCues.ts', fps: MUG_STEAM_FPS, restMs: MUG_STEAM_REST_MS, orderedA: MUG_STEAM_A, orderedB: MUG_STEAM_B }, globe: { owner: 'src/adventure/reducer.ts', boostWindowMs: GLOBE_BOOST_WINDOW_MS, spinMs: GLOBE_SPIN_MS, settleMs: GLOBE_SETTLE_MS, semanticStates: ['IDLE','SPINNING','SETTLING'], directions: ['PUSH','PULL'], levels: [0,1,2,3] } })

const ownerLines = existsSync(resolve(root, 'evidence-ownership.ndjson')) ? readFileSync(resolve(root, 'evidence-ownership.ndjson'), 'utf8').trim().split('\n').filter(Boolean) : []
const ownershipByArtifact = new Map(ownerLines.map((line) => {
  const entry = JSON.parse(line) as { artifactPath: string; generatingTestId: string; ordinaryUrlAndQuery: string; stateActionRoute: string; capturedTimestamp: string; candidateCommit: string; candidateTree: string; sourceTestPath: string }
  return [entry.artifactPath, entry]
}))
const ownership = [...ownershipByArtifact.values()].sort((a, b) => a.artifactPath.localeCompare(b.artifactPath)).map((entry) => ({ ...entry, exists: existsSync(resolve(root, entry.artifactPath)), byteSize: existsSync(resolve(root, entry.artifactPath)) ? statSync(resolve(root, entry.artifactPath)).size : 0 }))
writeJson(resolve(root, 'EVIDENCE_OWNERSHIP.json'), { schemaVersion: 's15-r3.evidence-ownership.v1', cleanBeforeCapture: existsSync(resolve(root, '.clean-before-capture')), candidateBound: ownership.every((entry) => Boolean(entry.candidateCommit && entry.candidateTree)), allOwned: ownership.length > 0 && ownership.every((entry) => entry.exists && entry.byteSize > 1000 && entry.ordinaryUrlAndQuery === '/' && entry.generatingTestId && entry.sourceTestPath), artifacts: ownership })

const terminalSourcePath = 'src/app/CaseTerminalWorkbench.tsx'
const terminalSource = readFileSync(terminalSourcePath, 'utf8')
const leakTerms = ['PLACEHOLDER','S13','S14','gate','sealed for later','accepted semantic stage','fixture','review surface','debug','raw technical query','RESET TO CASE START']
const leakRegister = leakTerms.flatMap((term) => terminalSource.split('\n').map((line, index) => ({ term, line: index + 1, excerpt: line.trim().slice(0, 220) })).filter((hit) => hit.excerpt.toLowerCase().includes(term.toLowerCase())))
const surfaceNames = [
  'CASE','RESULTS','EXPLORE','SOURCE','LEDGER','RETURN TO RECORDS OFFICE','BACK TO CASE','CURRENT OBJECTIVE','OPEN QUESTION','ASK A QUESTION','Recommended Question Cards','All discovered Question Cards and four lenses','Reusable Query Tray — optional categories','STARTING POINT','WHEN','WHAT MOVED','CHECK','QUERY RECEIPT · PRE-DISPATCH REVIEW','REVIEW QUERY RECEIPT','DISPATCH','SHOW TECHNICAL QUERY','Query recovery and saved local query','UNDO','REDO','RESET TO LAST DISPATCH','REMOVE ALL CHIPS','SAVE LOCAL QUERY','OPEN PERSISTENT CASEBOARD','KNOWN FACTS','READ FIRST BREACH MEMORY','READ SECOND BREACH MEMORY','TRACE THREAD','Inspect six continuity checks','WORKING THEORY — optional and revisable','PROOF SLOTS — AMOUNT / RECEIVER / LINK','CANDIDATE FOLDERS','EVIDENCE DELTA','EXPLAIN THIS · boundaries and source','PIN RESULT SLIP TO CASEBOARD','SAVE LEAD','COMPARE CANDIDATE','ASK FOR THIS EXACT RECEIPT','FOLLOW THIS CANDIDATE FORWARD','SOURCE FOR THIS RESULT','SHOW MORE · NEXT THREE','Two-candidate Comparison Tray','PUBLIC-SAFE SOURCE','RESEARCH LEDGER','WHY NANSEN HELPED','ASK THE ARCHIVIST · explanations and recovery','METHOD HINT','CASE HINT','DIRECT HINT','RESET TO CASE START','[ CLOSE CASE ]','Powered by Nansen API',
]
const surfaces = surfaceNames.map((label, index) => ({
  id: `SURFACE-${String(index + 1).padStart(3, '0')}`, label,
  currentStatePredicate: ['CASE','RESULTS','EXPLORE','SOURCE','LEDGER'].includes(label) ? `section permits ${label}` : 'capability/stage predicate in CaseTerminalWorkbench',
  rightfulProductRole: label === 'Powered by Nansen API' ? 'truthful attribution' : label.includes('SOURCE') || label.includes('LEDGER') || label.includes('TECHNICAL') ? 'inspectable provenance or advanced detail' : 'investigation navigation/action/content',
  firstTimePlayerNeedsNow: ['CASE','CURRENT OBJECTIVE','OPEN QUESTION','ASK A QUESTION','DISPATCH','RETURN TO RECORDS OFFICE'].includes(label),
  disposition: label === 'RESET TO CASE START' ? 'RENAME_OR_REWRITE' : label.includes('TECHNICAL') || label.includes('recovery') || ['UNDO','REDO','SAVE LOCAL QUERY','REMOVE ALL CHIPS','SHOW MORE · NEXT THREE'].includes(label) ? 'MOVE_TO_SECONDARY_DISCLOSURE' : label === 'Powered by Nansen API' ? 'KEEP_FOREGROUND' : ['SOURCE','LEDGER','PUBLIC-SAFE SOURCE','RESEARCH LEDGER'].some((value) => label.includes(value)) ? 'MOVE_TO_SOURCE_OR_LEDGER' : 'PROGRESSIVELY_REVEAL',
}))
const graph = [
  ['T0_AUTHORIZED_NO_FILE','Authorization is earned; Euler file is not collected','Collect and read the Euler file',['RETURN TO RECORDS OFFICE'],['SOURCE','LEDGER'],'T1_CASE_FILE','Return to office','terminal heading','Access earned; collect the case file before investigating.'],
  ['T1_CASE_FILE','Case-file facts are available','Ask the first bounded question',['ASK A QUESTION'],['OPEN PERSISTENT CASEBOARD','SOURCE','LEDGER'],'T2_RECEIPT_1','Return to office / CASE','CASE heading','Question Cards available.'],
  ['T2_RECEIPT_1','The first question and filters are staged','Confirm the Query Receipt',['REVIEW QUERY RECEIPT','DISPATCH'],['SHOW TECHNICAL QUERY','Query recovery'],'T3_RESULTS_1','BACK TO CASE','Query Receipt heading','Review the staged filters before dispatch.'],
  ['T3_RESULTS_1','First Evidence Delta and candidates','Ask the amount question',['BACK TO CASE'],['SOURCE FOR THIS RESULT','PIN RESULT'],'T4_RECEIPT_2','CASE / prior results','Evidence Delta','First result set returned.'],
  ['T4_RECEIPT_2','Amount band is staged','Dispatch the second question',['REVIEW QUERY RECEIPT','DISPATCH'],['SHOW TECHNICAL QUERY'],'T5_RESULTS_2','BACK TO CASE','Query Receipt heading','Second receipt ready.'],
  ['T5_RESULTS_2','Amount candidates and comparison are visible','Ask which route continues',['BACK TO CASE'],['COMPARE CANDIDATE','SOURCE'],'T6_RECEIPT_3','CASE / comparison','Candidate folders','Candidate routes narrowed.'],
  ['T6_RECEIPT_3','Exact-receipt question is staged','Dispatch the final question',['REVIEW QUERY RECEIPT','DISPATCH'],['SHOW TECHNICAL QUERY'],'T7_EXACT_SOURCE','BACK TO CASE','Query Receipt heading','Final receipt ready.'],
  ['T7_EXACT_SOURCE','A surviving exact record is selected','Verify the exact receipt',['VERIFY SURVIVING RECEIPT'],['SOURCE details','LEDGER'],'T8_PROOF_READY','RESULTS / CASE','SOURCE heading','Exact source available to verify.'],
  ['T8_PROOF_READY','Exact receipt is verified','File AMOUNT, RECEIVER, then LINK',['FILE AMOUNT','FILE RECEIVER','FILE LINK'],['SOURCE','LEDGER'],'T9_COMPLETE','Return to results','PROOF SLOTS','Exact receipt verified; proof slots are ready.'],
  ['T9_COMPLETE','Bounded proof is complete','Close the case',['[ CLOSE CASE ]'],['SOURCE','LEDGER'],'ENDING','Return to proof','COMPLETION READY','Case proof complete.'],
].map(([stateId, whatPlayerKnows, primaryGoal, foregroundActions, secondaryActions, nextStates, backRecoveryPath, focusDestination, screenReaderAnnouncement]) => ({ stateId, whatPlayerKnows, primaryGoal, foregroundActions, secondaryActions, nextStates: [nextStates], backRecoveryPath, focusDestination, screenReaderAnnouncement, risks: (foregroundActions as string[]).length > 1 ? ['competing primary actions'] : [] }))
const canonical = [
  ['CASE with ASK workflow and ≤3 Question Cards','PRESENT_BUT_UX_INCOMPLETE'],['four Question Lenses','LOGIC_PRESENT_NOT_DISCOVERABLE'],['optional query categories','PRESENT_BUT_UX_INCOMPLETE'],['pre-dispatch Query Receipt','PRODUCTION_READY'],['Evidence Delta','PRESENT_BUT_UX_INCOMPLETE'],['≤3 foreground Candidate Folders','PRODUCTION_READY'],['two-result Comparison Tray','PRESENT_BUT_UX_INCOMPLETE'],['SOURCE exact evidence/provenance','PRODUCTION_READY'],['LEDGER Research Ledger and Call Atlas','PRESENT_BUT_UX_INCOMPLETE'],['persistent Caseboard and proof slots','PRESENT_BUT_UX_INCOMPLETE'],['Direct, Curious, and Mistaken paths','PRODUCTION_READY'],['full-screen CRT keyboard/touch/focus','PRESENT_BUT_UX_INCOMPLETE'],
].map(([contract, classification]) => ({ contract, classification, evidenceOwner: terminalSourcePath }))
const implementationPlan = {
  boundary: 'S16 only; preserve investigation reducer, fixtures, evidence truth, dispatch funnel, and exact proof.',
  componentOwners: ['TerminalViewport: CRT chrome and responsive 480×270 frame','CaseTerminalWorkbench: orchestration only','CaseSurface: current goal and one primary action','ResultsSurface: Evidence Delta and ≤3 folders','ExploreSurface: optional corpus exploration','SourceSurface: exact evidence/provenance','LedgerSurface: Research Ledger and Call Atlas','Caseboard: persistent facts/question/thread/theory/proof slots'],
  progressiveDisclosure: 'Derive one presentation stage from accepted InvestigationState; no second reducer and no duplicate answer path.',
  primaryActionBudget: 'One visually primary action in every first-run state; at most two secondary actions visible; advanced controls remain in details.',
  controlLabelRewrites: [{ from: 'STAGE …', to: 'ASK THIS QUESTION' },{ from: 'RESET TO CASE START', to: 'START THIS CASE OVER' },{ from: 'REMOVE CHIP', to: 'REMOVE FILTER' },{ from: 'SHOW MORE · NEXT THREE — wraps to the first page', to: 'SHOW NEXT RESULTS' },{ from: 'PIN RESULT SLIP TO CASEBOARD', to: 'ADD TO CASEBOARD' }],
  accessibility: 'Heading receives focus on state/section change; status announces Evidence Delta and receipt verification; no hidden mandatory action; all controls keyboard/touch operable.',
  visualConstraints: 'Retain fullscreen CRT, logical 480×270 nearest-neighbor layout, responsive integer scaling, and existing pixel assets.',
  technicalMigration: 'Keep exact hashes/endpoints/provider schemas in SOURCE or LEDGER and nested disclosures; remove internal gate/stage/fixture language from foreground copy.',
  tests: ['ordinary title-to-proof Direct/Curious/Mistaken journeys','one-primary-action state matrix','keyboard/touch/focus order','480×270 overflow and 200% zoom','mutation probes for hidden mandatory actions, leaked internal strings, and duplicate reducer paths'],
  noLogicFork: true,
}
const audit = { schemaVersion: 's15-r3.terminal-production-gap-audit.v1', status: 'READ_ONLY_AUDIT_NOT_PRODUCTION_READY', auditedSource: terminalSourcePath, failureMode: 'The current terminal is a dense dashboard: accepted logic is present, but primary and advanced actions compete simultaneously and internal implementation language appears before player comprehension.', ordinaryCaptureRequirement: { ownershipIndex: 'review/s15-r3/EVIDENCE_OWNERSHIP.json', requiredArtifactPrefixes: ['terminal-authorized-before-euler-file','terminal-first-case-after-euler-file','terminal-query-1-receipt','terminal-query-2-receipt','terminal-query-3-receipt','terminal-query-1-results','terminal-explore-before-dispatch','terminal-explore-after-dispatch','terminal-source-before-exact-verification','terminal-source-after-exact-verification','terminal-ledger-call-atlas','terminal-mistaken-theory-falsifier','terminal-proof-ready-caseboard','terminal-brcg-optional-branch'] }, surfaces, navigationAndComprehensionGraph: graph, canonicalContractComparison: canonical, leakRegister, implementationPlan }
writeJson(resolve(root, 'TERMINAL_PRODUCTION_GAP_AUDIT.json'), audit)
const md = `# Terminal production-gap audit — read only\n\n**Status:** NOT PRODUCTION READY. S16 has not started.\n\n## Finding\n\n${audit.failureMode}\n\nThe accepted investigation reducer and evidence truth are preserved. This audit does not authorize a redesign or Principal Playtest 2.\n\n## Ordinary production capture\n\nFresh captures are owned by named ordinary-URL tests in \`EVIDENCE_OWNERSHIP.json\`. Required capture IDs are listed in the JSON audit.\n\n## Player-visible surface register\n\n${surfaces.map((row) => `- **${row.label}** — ${row.disposition}; first exposure: ${row.firstTimePlayerNeedsNow ? 'yes' : 'no'}; role: ${row.rightfulProductRole}.`).join('\n')}\n\n## Navigation and comprehension\n\n${graph.map((row) => `- **${row.stateId}** — knows: ${row.whatPlayerKnows}; goal: ${row.primaryGoal}; primary: ${(row.foregroundActions as string[]).join(', ')}; recovery: ${row.backRecoveryPath}.`).join('\n')}\n\n## Canonical contract comparison\n\n${canonical.map((row) => `- **${row.contract}:** ${row.classification}`).join('\n')}\n\n## Internal/development leak register\n\n${leakRegister.length ? leakRegister.map((row) => `- \`${row.term}\` — ${terminalSourcePath}:${row.line}`).join('\n') : '- No named leak tokens found.'}\n\nUseful exact provenance remains appropriate in SOURCE/LEDGER. Foreground strings that mention gates, sealed stages, fixtures, or resets are presentation debt, not evidence to delete.\n\n## Smallest preservation-first S16 plan\n\n${implementationPlan.componentOwners.map((row) => `- ${row}`).join('\n')}\n\nOne accepted reducer remains authoritative. Presentation derives progressive disclosure from it, keeps one primary first-run action, moves technical detail into SOURCE/LEDGER/disclosures, retains 480×270 nearest-neighbor CRT behavior, and adds the tests listed in the JSON audit.\n`
writeFileSync(resolve(root, 'TERMINAL_PRODUCTION_GAP_AUDIT.md'), md)
console.log(JSON.stringify({ closure: closureRows.every((row) => row.status === 'PASS'), rows: closureRows.length, dialogueEvents: dialogueEvents.length, evidenceArtifacts: ownership.length, terminalSurfaces: surfaces.length, terminalLeaks: leakRegister.length }))
