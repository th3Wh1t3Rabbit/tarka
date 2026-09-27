import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yaml from 'js-yaml'

const repository = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const source = path.join(repository, 'docs/overlays/g6p-a2u-v1.0.1')
const output = path.join(repository, 'artifacts/g6p-a2u/current/source-admission')
const read = (name) => readFileSync(path.join(source, name), 'utf8')
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const allowance = yaml.load(read('02_NANSEN_UTILITY_BOUND_QUALIFICATION_ALLOWANCE.yaml'))
const ledger = JSON.parse(read('03_PRIVATE_CALL_LEDGER.schema.json'))
const index = JSON.parse(read('04_PUBLIC_CALL_INDEX.schema.json'))
const auth = 'LEAD-NQ5-UNIFIED-CASEBOARD-UTILITY-001'
for (const value of [allowance.authorization_id, ledger.properties.authorization_id.const, index.properties.authorization_id.const]) assert(value === auth, 'Authorization conflict')
const equalSets = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
assert(equalSets(allowance.purpose_codes, ledger.properties.purpose_code.enum), 'Private purpose conflict')
assert(equalSets(allowance.qualification_purpose_codes, index.properties.purpose_code.enum), 'Public purpose conflict')
assert(index.properties.public_call_id.pattern === '^NQ5-[0-9]{6}$', 'Public prefix conflict')
assert(!index.properties.question_lens.enum.includes('ADMIN') && !index.properties.purpose_code.enum.includes('ACCOUNT_PREFLIGHT'), 'Private preflight leaked')
const admin = ledger.allOf.find((rule) => rule.if?.properties?.question_lens?.const === 'ADMIN').then.properties
assert(admin.endpoint_family.const === 'account' && admin.purpose_code.const === 'ACCOUNT_PREFLIGHT' && admin.qualification_counted.const === false && admin.investigative_question_id.const === null && admin.coverage_cell_ids.maxItems === 0, 'ADMIN invariants missing')
assert(allowance.admin_preflight_contract.public_call_index_record_created === false, 'ADMIN public output enabled')
for (const name of ['10_MAIN_CODEX_PROMPT.txt', '11_SUPERSESSION_AND_GATE_STATUS.md']) assert(read(name).includes(auth), `${name} authorization missing`)
const validation = execFileSync('python3', ['14_VALIDATE_OVERLAY_CONSISTENCY.py', '.'], { cwd: source, encoding: 'utf8' })
const manifest = execFileSync('sha256sum', ['-c', 'MANIFEST.sha256'], { cwd: source, encoding: 'utf8' })
mkdirSync(output, { recursive: true })
writeFileSync(path.join(output, 'OVERLAY_CONSISTENCY_PASS.log'), validation + manifest)
const historical = path.join(repository, 'artifacts/g6p-a2u/precall/NQ5_PRECALL_AUTHORIZATION_REPORT.json')
const report = { status: 'PASS', activeGate: 'G6P-A2U', sourceVersion: '1.0.1', authorizationId: auth, publicCallPrefix: 'NQ5', privateOnlyAdminVerified: true, historicalBlockerSha256: hash(readFileSync(historical)), sourceManifestSha256: hash(read('MANIFEST.sha256')), credentialResolutionAttempted: false, providerCallsIssued: 0 }
writeFileSync(path.join(output, 'SOURCE_ADMISSION.json'), JSON.stringify(report, null, 2) + '\n')
process.stdout.write(JSON.stringify(report, null, 2) + '\n')
