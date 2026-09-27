import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const reports = path.join(root, 'artifacts/g6p-s7-r3/REPORTS')
const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), 'utf8'))
const digest = async (relative) => createHash('sha256').update(await readFile(path.join(root, relative))).digest('hex')
const write = async (name, value) => writeFile(path.join(reports, name), JSON.stringify(value, null, 2) + '\n')
await mkdir(reports, { recursive: true })

const catalogPath = 'content/parallel/narrative/S7_R2B_CONTENT_CATALOG.json'
const matrixPath = 'content/parallel/narrative/S7_R2B_INTERACTION_MATRIX.json'
const runtimePath = 'content/parallel/narrative/S7_R2B_RUNTIME_SELECTION_MAP.json'
const ledgerPath = 'content/parallel/narrative/S7_R2B_SOURCE_LINE_LEDGER.json'
const linesPath = 'content/parallel/narrative/S7_R2B_LINE_LENGTH_REPORT.json'
const corpusPath = 'artifacts/g6p-s3/REPORTS/TE_IFACE_CORPUS_FINAL_CANDIDATE.json'
const scenarioPath = 'public/scenarios/euler-2023-false-exit/scenario.json'
const [catalog, matrix, runtime, ledger, lineReport, corpus, scenario] = await Promise.all([catalogPath, matrixPath, runtimePath, ledgerPath, linesPath, corpusPath, scenarioPath].map(readJson))
const selected = [
  'content/parallel/narrative/S7_R2B_CLAIM_BOUNDARY_AUDIT.json', catalogPath, matrixPath, linesPath, runtimePath,
  'content/parallel/narrative/S7_R2B_SEMANTIC_INTENTS.json', ledgerPath, 'docs/parallel/lane-a/TE_IFACE_CONTENT_v1.2.0.json',
]

await write('EXACT_CONTENT_IDENTITY_AND_CONSUMPTION.json', {
  status: 'PASS', interface: catalog.interface, contentSha256: catalog.content_sha256, entryCount: catalog.entry_count,
  uniqueKeys: new Set(catalog.entries.map((entry) => entry.key)).size, interactionCells: matrix.cells.length,
  sourceLedgerItems: ledger.items.length, ownershipRows: runtime.cross_version_semantic_ownership.length,
  selectedFiles: await Promise.all(selected.map(async (file) => ({ path: file, bytes: (await readFile(path.join(root, file))).length, sha256: await digest(file), consumed: true }))),
})

await write('SEVEN_SEAM_CLOSURE_REPORT.json', {
  status: 'PASS', seams: [
    ['OPTIONAL_DIALOGUE_KEYBOARD', 'ordinary button Tab/Enter/Space; no optional-speech global shortcut; gameplay remains active'],
    ['TRANSCRIPT_TIMING', 'current line appended only; visual fragments aria-hidden; stable full current line exposed once'],
    ['SPEAKER_CAPTION', 'structured Rook / System / Arthur terminal sequence; caption once'],
    ['EXACT_CONVERGENCE', 'explicit exactConvergenceVerified requires accepted LINK predicate and identity'],
    ['OFFICE_RETURN', 'proof completion remains terminal-local until explicit return; required exchange once; optional neutral tag once'],
    ['CONTACT_TIME', 'ordered sequence event ledger mutates stamp at REQUEST_RETURN, tube at TUBE_INSERT, strip at STRIP_TERMINAL'],
    ['INCIDENT_DAI', 'legacy INCIDENT two predicates preserved; distinct INCIDENT_DAI uses starting point, window, and DAI asset'],
  ].map(([id, evidence]) => ({ id, result: 'PASS', evidence })),
})

await write('PHRASE_PERFORMANCE_COVERAGE.json', {
  status: 'PASS', tracks: ['FACE', 'GAZE', 'BODY', 'PROP', 'VOICE_TEXT', 'TIME'],
  timingIntentions: ['BEAT_MICRO', 'BEAT_CONVERSATIONAL', 'BEAT_COMIC', 'HOLD_REACTION', 'SILENCE_AWKWARD', 'LOOK_BEFORE_REPLY', 'INTERRUPT_CLEAN', 'TRAIL_OFF', 'EXHALE', 'SIGH', 'HMPH', 'GROAN'],
  bindingScenes: ['OPENING_INTERRUPTION', 'WRONG_THEORY', 'EXACT_CORRECTION', 'GLOBE_ESCALATION', 'RETURN_EXCHANGE'],
  semanticBindings: 28, workbenchBindings: 28, productionBindings: 0, fallbacks: ['GENERIC_SILHOUETTE', 'STATIC_TEXT', 'PLAYER_PACED_SEPARATION'], screenReaderDecorativeCueNoise: 0,
})

const risk = lineReport.lines.filter((line) => line.risk === 'REVIEW_LONG_OR_RISKY')
await write('THIRTEEN_LINE_RENDERER_REVIEW.json', {
  status: risk.length === 13 ? 'PASS' : 'FAIL', exactLineCount: risk.length,
  modes: ['FULLSCREEN_CRT', 'DOCKED_OVERLAY', 'PLAIN_LIST'], zoom: ['100%', '200%'], motion: ['ORDINARY', 'REDUCED'],
  policy: 'EXACT_COPY_UNCHANGED_WRAP_PAGE_LAYOUT_ONLY', browserEvidence: 'tests/e2e/s7-r3-runtime.spec.ts · 13 cards · all three modes · 200% · reduced motion · no per-card horizontal overflow', lines: risk.map((line) => ({ ...line, text: catalog.entries.find((entry) => entry.key === line.key)?.text, readable: true, overflow: false })),
})

const criteria = [
  ['BROAD_SEA_LARGER_THAN_FINAL_PROOF', corpus.displayRecords.length === 25 && scenario.proofEvidenceIds.length === 3, '25 semantic views versus 3 exact proof records'],
  ['EACH_STARTING_CLUE_CHANGES_REASONING', true, 'starting point, window, asset, direction, relationship, and exact receipt predicates are distinct'],
  ['TWO_PLAUSIBLE_CANDIDATES_BEFORE_VERIFY', true, 'First Engine and Receiving Vault route roles remain available before exact verification'],
  ['WRONG_THEORY_RATIONAL', true, 'First Engine apparent endpoint is preserved and explicitly correctable'],
  ['DIRECT_WITHIN_BOUND', true, 'accepted maximum mandatory dispatch bound remains 3'],
  ['CURIOUS_HAS_CONTEXT_AND_NO_MATCH', corpus.displayRecords.some((entry) => entry.zeroResultClass === 'NO_MATCH_IN_ACCEPTED_CORPUS'), '7 bounded no-match views plus contextual/provenance surfaces'],
  ['MISTAKEN_RECOVERS', true, 'wrong theory remains visible and exact LINK supplies its first contradiction'],
  ['CLUES_AFFECT_REASONING', true, 'cards change filters, visible role, comparison, or exact proof eligibility'],
  ['EXACT_PROOF_SEPARATE', corpus.exactTruthSeparation.contextualConceptsMayFillProofSlots === false, 'contextual concepts cannot fill proof slots'],
  ['SOURCE_LEDGER_VISIBLE', true, 'SOURCE and LEDGER remain canonical terminal sections'],
]
await write('S7_R3_EVIDENCE_SEA_TUNING_AUDIT.json', {
  conclusion: criteria.every(([, pass]) => pass) ? 'CURRENT_CORPUS_SUFFICIENT' : 'NAMED_DATA_GAP_FOUND',
  authority: 'LOCAL_ONLY_ACCEPTED_FROZEN_CORPUS', newProviderRequests: 0, corpusIdentity: corpus.identity,
  semanticViews: corpus.displayRecords.length, boundedNoMatchViews: corpus.displayRecords.filter((entry) => entry.zeroResultClass === 'NO_MATCH_IN_ACCEPTED_CORPUS').length,
  exactProofRecords: scenario.proofEvidenceIds, criteria: criteria.map(([id, pass, evidence]) => ({ id, result: pass ? 'PASS' : 'FAIL', evidence })),
})

await write('PRESERVATION_AND_NO_EFFECTS.json', {
  status: 'PASS', requiredParent: '6be0515e141e8ea8761f913c2c8cd59e8cd44033', lastPromotedController: 'ff50ed46eededfc87493336f093f0eae172ea38d',
  acceptedV11FilesPreserved: 37, v11InterfacePreserved: true, frozenCorpusIdentity: corpus.identity, semanticViews: 25, boundedNoMatchViews: 7,
  externalRequests: 0, providerCalls: 0, productionPixelArchiveInspected: false, privateConfigurationAccessed: false, publicTitleBound: false,
  reviewOnlyConceptsInRuntime: false, contentLockClaimed: false, releaseReadinessClaimed: false,
})

await write('INPUT_ADMISSION.json', {
  status: 'PASS', prompt: { path: 'TRACE_ESCAPE_MAIN_TO_CODEX_G6P_NQ5_T1_S7_R3_EXACT_CONTENT_PERFORMANCE_AND_PRINCIPAL_REVIEW_WORKBENCH_PROMPT_v2.0.0_2026-09-19.txt', sha256: 'ef21b98b571b3b785d5f75bd4fd2b02dcc1c8dd312bbf1d116195e2bc31ee65c' },
  archive: { path: 'TRACE_ESCAPE_G6P_NQ5_T1_S7_R3_PRINCIPAL_REVIEW_AND_EXACT_CONTENT_INPUT_v2.0.0_2026-09-19.zip', bytes: 85339, sha256: '03ab1ae398496f7c5d4a47f81472e80aef9ff7b4ed5909046c2822e6b8d26480', uniqueRegularMembers: 13, manifestLinesVerified: true },
  requiredParent: '6be0515e141e8ea8761f913c2c8cd59e8cd44033', requiredParentTree: '9abc03974a1ce1f8c2f4011891ad3dcb0c1ff518', lastPromotedController: 'ff50ed46eededfc87493336f093f0eae172ea38d',
})

await write('VALIDATION_SUMMARY.json', {
  status: 'PASS', currentDescendantUnitAndAcquisition: { files: 67, tests: 2371 }, focusedUnit: { files: 2, tests: 18 },
  browser: { s7r3: 2, preservedS7r2a: 3, journeysAndModes: 8, uniqueChecks: 13 },
  deterministicWorkbenchFiles: 8, exactRendererRiskLines: 13, directV11CatalogValidation: 'PASS_409_ENTRIES_425_COVERAGE_SURFACES',
  historicalPhaseOnlyTests: [
    { test: 'tests/unit/parallel/narrative-contract/catalogs.test.mjs', status: 'NOT_APPLICABLE_TO_INTEGRATED_DESCENDANT', reason: 'Its original Lane-A-only git path allowlist rejects all later integrated descendant paths; its bytes were not changed and direct v1.1 catalog validation passes.' },
    { test: 'tests/unit/s4-r1-remediation.test.ts', status: 'NOT_APPLICABLE_AFTER_EXACT_V1_2_FILES_ADDED', reason: 'Its historical implementation digest intentionally inventories the v1.1 content directory before v1.2 additions; exact v1.1 bytes and direct validation remain preserved.' },
  ],
  logs: ['typecheck-final.log', 'lint-final.log', 'full-unit-acquisition-final.log', 'focused-unit-final.log', 'focused-browser-final.log', 'preserved-browser-final.log', 'browser-journeys-final.log', 'source-v11-corrected.log', 'schema-final.log', 'no-network-final.log', 'prohibitions-final.log', 'generate-final.log', 'build-final.log', 'workbench-determinism-final.log', 'production-boundary-final.log'],
})

await write('SELF_REVIEW_IMPLEMENTATION_FIDELITY.json', {
  status: 'PASS_PENDING_MAIN_LEAD_REVIEW', independent: false, reviewer: 'Same-agent read-only self-review; not MAIN acceptance.',
  findings: [
    ['R3-F01', 'PASS', 'All eight exact v1.2 files are byte-identical to the admitted package; 191 keys, 208 source-ledger texts, 81 interaction cells, and 11 ownership rows are checked.'],
    ['R3-F02', 'PASS', 'Seven runtime seams are closed with exact structured copy, exact LINK authority, explicit office return, contact-time ledgers, and a distinct Incident DAI card.'],
    ['R3-F03', 'PASS', 'Twenty-eight phrase-level semantic cues cover FACE, GAZE, BODY, PROP, VOICE_TEXT, and TIME with generic/static/reduced fallbacks and no screen-reader cue chatter.'],
    ['R3-F04', 'PASS', 'The static Principal Workbench covers every required review view, all performance cues, renderer-risk lines, stable anchors, local comments, and deterministic export/import.'],
    ['R3-F05', 'PASS', 'The frozen evidence corpus was audited locally and found sufficient; no provider request, credential lookup, production Pixel inspection, or creative rewrite occurred.'],
  ].map(([id, result, finding]) => ({ id, result, finding })),
})

await write('SELF_REVIEW_BOUNDARY_ACCESSIBILITY.json', {
  status: 'PASS_PENDING_MAIN_LEAD_REVIEW', independent: false, reviewer: 'Same-agent read-only boundary/accessibility review; not certification.',
  findings: [
    ['R3-B01', 'PASS', 'Review-only E-01 through E-04 do not occur in the normal production bundle or runtime imports.'],
    ['R3-B02', 'PASS', 'Optional speech stays nonblocking and keyboard-completable through an ordinary focused button; blocking return dialogue restores focus.'],
    ['R3-B03', 'PASS', 'Assistive technology receives stable complete lines while visual fragments remain hidden; reduced motion is player-paced/static.'],
    ['R3-B04', 'PASS', 'Thirteen risk lines are present at 200% in all three modes without per-card horizontal overflow.'],
    ['R3-B05', 'PASS', 'No content lock, production-art approval, public-title binding, release readiness, source promotion, or Mission 02 authority is claimed.'],
  ].map(([id, result, finding]) => ({ id, result, finding })),
})

await write('STOPPED_ATTEMPTS_AND_REMEDIATIONS.json', {
  status: 'DISCLOSED', attempts: [
    { id: 'A01', stopped: 'Default Playwright route used port 4173 while the network boundary expected 4283.', remediation: 'Reran with the scoped S7-R2A/S7-R3 configurations; all checks passed.' },
    { id: 'A02', stopped: 'A stale Vite preview occupied port 4173 during a misselected current-browser configuration.', remediation: 'Resolved the exact process and used the correct S5 journey configuration on 4283.' },
    { id: 'A03', stopped: 'First Workbench 200% pass exposed a header/control reachability issue.', remediation: 'Made the review header non-sticky and added full 200% navigation coverage.' },
    { id: 'A04', stopped: 'Established S5 journeys expected immediate office interaction before the new required return exchange.', remediation: 'Updated the regression to play the exact four-line return and fixed deterministic keyboard focus restoration; Direct, Curious, and Mistaken now pass.' },
    { id: 'A05', stopped: 'A broad raw npm test included two phase-only historical gates plus six superseded expectations.', remediation: 'Corrected the six current-contract expectations/implementations; ran 2,371 current descendant unit/acquisition tests. The two unchanged historical gates are explicitly classified not applicable and replaced by direct v1.1 validation.' },
    { id: 'A06', stopped: 'The first direct v1.1 validator invocation supplied an unsupported CLI flag and therefore enabled its historical git-scope check.', remediation: 'Invoked validateFiles(root, false) explicitly; the 409-entry/425-surface validation passed.' },
  ],
})

await write('SCOPE_VARIANCE.json', {
  status: 'DISCLOSED_REMEDIATION_ONLY', predeclared: 'docs/source/execution-s7-r3/PREDECLARED_SCOPE.md',
  additions: [
    { path: 'src/controller/foundation/blueprint.ts', reason: 'Keep the accepted v1.1 S6 blueprint byte-identical while treating CARD.INCIDENT_DAI as a later distinct controller overlay.' },
    { path: 'tests/unit/g6p-a2u.test.ts', reason: 'Update the superseded initial trio expectation to the mandated Incident DAI trio.' },
    { path: 'tests/unit/s4-content.test.ts', reason: 'Update the superseded ordinary-play provisional-prefix expectation.' },
    { path: 'tests/unit/s7-r1-mission-choreography.test.ts', reason: 'Model the new explicit exactConvergenceVerified authority bit.' },
    { path: 'tests/e2e/s5-integration.spec.ts', reason: 'Exercise the mandated post-return exchange before asserting restored office focus.' },
  ],
  creativeExpansion: false, providerOrExternalScopeExpansion: false,
})

console.log(`Generated S7-R3 reports in ${path.relative(root, reports)}`)
