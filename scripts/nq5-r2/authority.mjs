import fs from 'node:fs'
import { identity, sha, validateSchema } from '../nq5/schema.mjs'
const root = new URL('../../', import.meta.url)
export const ACTIVE = JSON.parse(fs.readFileSync(new URL('docs/source/ACTIVE_SOURCE.json', root)))
const schemaFiles = { clues: '12_CASE_CLUE_QUERY_AND_QUESTION_LENS.schema.json', terminal: '13_CASE_TERMINAL_AND_CASEBOARD_CONTRACT.schema.json', proof: '14_EVIDENCE_ROUTE_PUZZLE_AND_PROOF.schema.json', results: '15_RESULT_CARD_AND_TRACE_THREAD.schema.json', ledger: '18_NQ5_PRIVATE_CALL_LEDGER.schema.json', public: '19_NQ5_PUBLIC_CALL_INDEX.schema.json', offline: '20_NQ5_OFFLINE_PRECALL_AUTHORIZATION_REPORT.schema.json', account: '21_NQ5_ACCOUNT_PREFLIGHT_REDACTED.schema.json' }
export function validateActiveSchema(kind, object) {
  if (!schemaFiles[kind]) throw new Error('Unknown active schema.')
  const relative = kind === 'terminal' ? ACTIVE.terminalSchema : 'docs/source/v1.7.0/' + schemaFiles[kind]
  return validateSchema('provider', object, JSON.parse(fs.readFileSync(new URL(relative, root))))
}
export function validateSourceInstallation() {
  const manifest = fs.readFileSync(new URL('docs/source/ACTIVE_SOURCE_MANIFEST.sha256', root))
  if (sha(manifest) !== '3b37d1bd44ffd1d1ccb81108cbcb78e611db2e5eebf00b78ecddaa040f502c5d') throw new Error('Supplied source pin set changed.')
  const pinned = Object.fromEntries(manifest.toString('utf8').trimEnd().split('\n').map(line => { const [digest, relative] = line.split('  '); return [relative, digest] }))
  if (identity(pinned) !== identity(ACTIVE.fileHashes)) throw new Error('Active source inventory differs from supplied exact pin set.')
  for (const [relative, expected] of Object.entries(ACTIVE.fileHashes)) if (!fs.lstatSync(new URL(relative, root)).isFile() || sha(fs.readFileSync(new URL(relative, root))) !== expected) throw new Error('Active source bytes changed or are not regular supplied files.')
  for (const version of ['v1.7.0', 'v1.7.1']) {
    const directory = 'docs/source/' + version + '/', expected = Object.keys(pinned).filter(relative => relative.startsWith(directory)).map(relative => relative.slice(directory.length)).sort()
    if (identity(fs.readdirSync(new URL(directory, root)).sort()) !== identity(expected)) throw new Error('Additional or missing material in exact supplied source directory.')
  }
  const precedence = ['Later explicit user instruction', 'v1.7.1 correction where it speaks', 'v1.7.0 base', 'accepted receipts and reviewed evidence', 'older material historical only']
  if (ACTIVE.baseVersion !== '1.7.0' || ACTIVE.correctionVersion !== '1.7.1' || identity(ACTIVE.precedence) !== identity(precedence)) throw new Error('Current source version/precedence identity changed.')
  const corrected = JSON.parse(fs.readFileSync(new URL(ACTIVE.terminalSchema, root)))
  const sections = corrected.properties.sections.prefixItems.map(item => item.const)
  if (ACTIVE.activeGate !== 'G6P-A2U-R2' || corrected.properties.schema_version.const !== '2.0.2' || sections.join() !== 'CASE,RESULTS,EXPLORE,SOURCE,LEDGER' || ACTIVE.credentialResolutionAllowed || ACTIVE.additionalAccountAttemptsAuthorized !== 0 || ACTIVE.qualificationCallsAllowed || !ACTIVE.networkHeld) throw new Error('Source precedence or hold is invalid.')
  return { status: 'PASS', baseVersion: ACTIVE.baseVersion, correctionVersion: ACTIVE.correctionVersion, activeGate: ACTIVE.activeGate, exactGovernedFiles: Object.keys(ACTIVE.fileHashes).length, activeSourceIdentity: identity(ACTIVE), terminalSchemaVersion: '2.0.2', canonicalSections: sections, precedence: ACTIVE.precedence, completeBaseInstalled: true, correctionAppliedWithoutMutatingBase: true, historicalAccountExceptionConsumed: true, credentialResolutionAllowed: false, networkHeld: true, qualificationCallsAllowed: false }
}
