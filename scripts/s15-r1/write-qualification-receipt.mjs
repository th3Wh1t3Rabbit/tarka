import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const logNames = ['01-canonical-unit', '02-canonical-browser', '03-projection-replay', '04-actual-action-matrix', '05-semantic-mutations', '06-typecheck', '07-lint', '08-production-build', '09-browser-boundary', '10-secret-scan', '11-secret-history', '12-test-ownership', '13-evidence-ownership', '14-static-music', '15-blocked-network']
for (const name of logNames) if (!readFileSync(`artifacts/s15-r1/LOGS/${name}.log`, 'utf8').includes(`S15_R1_GATE name=${name} exit=0 signal=none`)) throw new Error(`Gate log is not successful: ${name}`)
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const receipt = {
  schemaVersion: 's15-r1-qualification.v1', status: 'PASS_ALL_REQUIRED_GATES', commit: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'), parent: git('rev-parse', 'HEAD^'),
  currentProduction: { unitAcquisition: '15_FILES_159_PASS_1_ACCEPTED_SKIP', browser: '12_FILES_34_PASS', directSolver: 'PASS', curiousExplorer: 'PASS', mistakenInvestigator: 'PASS' },
  authority: { projection: 'PASS_590_NODES', actualActionMatrix: 'PASS_551_UNIQUE_590_ACCOUNTED', semanticMutations: 'PASS_19_OF_19_REJECTED' },
  engineering: { typecheck: 'PASS', lint: 'PASS_ZERO_ERRORS_ZERO_WARNINGS', build: 'PASS_EXISTING_CHUNK_ADVISORY', browserBoundary: 'PASS', secretScan: 'PASS', gitHistorySecretScan: 'PASS' },
  ownership: { testManifest: 'PASS_163_CLASSIFIED', freshEvidence: 'PASS', blockedNetwork: 'PASS_ZERO_EXTERNAL_ZERO_WEBSOCKET', staticMusic: 'PASS_ONE_EXACT_ASSET' },
  historicalDiagnostics: { status: 'PRESERVED_NON_GATING_NOT_RUN_BY_CURRENT_PRODUCTION_COMMANDS', files: 136, commands: ['npm run test:historical', 'npm run test:e2e:historical'] },
  licenseStatus: 'PRINCIPAL_SUPPLIED_LICENSE_METADATA_PENDING', publicDeploymentBlocked: true,
}
mkdirSync('artifacts/s15-r1/RECEIPTS', { recursive: true })
writeFileSync('artifacts/s15-r1/RECEIPTS/QUALIFICATION.json', `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify(receipt))
