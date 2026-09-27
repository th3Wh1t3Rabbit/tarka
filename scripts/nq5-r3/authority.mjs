import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { identity, sha, freeze } from '../nq5/schema.mjs'
import { ACTIVE as FOUNDATION, validateSourceInstallation } from '../nq5-r2/authority.mjs'
export const R2_CUT = '272f6dd4b0d2cb9e2b567ae1899214766db5b4d6'
export const R2_ARCHIVE_SHA256 = '6f2d14e290bab61eb943af6132fc5ba66b80d8ea84df1230c413c2d2428cb604'
export const GENESIS_AUTH = 'LEAD-NQ5-T1-CAMPAIGN-GENESIS-001'
export const DELTA_ARCHIVE_SHA256 = 'db3456f7c6fd5d64de979f66ad2b08e5c2681e446b22f4fc42205fc5937dd649'
export const R3_SOURCE_MANIFEST_SHA256 = '76bd045d04e857b1e34819ae27219c2af4164d19ce83a583ed9b927f7133e093'
export const REVIEWED_ACCOUNT_REPORT_SHA256 = '6dc07198fdc6f6dc685b076877456c9b669517798aea932cc39c981f8e11ee3f'
export const REVIEWED_ACCOUNT_REUSE_RECEIPT_SHA256 = '4b7549feb22b558c2eccd85b05ee47889480eaaa18749241e721ac0a14765175'
export const DELTA_PINS = freeze({
  "docs/source/v1.7.2/00_READ_ME_FIRST.md": "72baa1c6aaacc5a7c4af5aa2ee63b1e617339809079941af3def2ef7f9944845",
  "docs/source/v1.7.2/35_A2U_R2_LEAD_REVIEW_AND_R3_HANDOFF.md": "d99ca83d4edc5ebe7748ddb111d6a9e675e88d120b85bd419923815a1d71aa0c",
  "docs/source/v1.7.2/36_NQ5_PLAN_SPECIFIC_PUBLIC_CONTRACT_AND_CAMPAIGN_GENESIS_POLICY.md": "92b9d26d6559cbdde8fa7cfcbdaf90d06373202a0420b5a1e0f65a97c02e650d",
  "docs/source/v1.7.2/37_G6P_A2U_R3_ACTIVE_CODEX_CONTRACT.txt": "e3c35798a3aad2c3bf34bb540ef4cbe2542bbb0297a33d4408941ff2163a1b30",
  "docs/source/v1.7.2/38_DELTA_FIRST_SOURCE_MAINTENANCE_RULE.md": "37601330471ce121fc95ea8a29615da6aefce0e993cfde2a78da7a9f3c726b77",
  "docs/source/v1.7.2/39_CURRENT_PROJECT_STATE_DELTA_R3.yaml": "38257801dd6209a16083e25bf6b53ea5f4edf9414fbf38f747321bccfdb79abd",
  "docs/source/v1.7.2/MANIFEST.sha256": "c40317517ffa7a3dd690e19bdc78c219efa223741b46a32d7661573a20aff624",
  "docs/source/v1.7.2/PROJECT_FILE_ACTIONS.txt": "1f7168ae29770615e6e5b2de33b121ef4d010066cf0f388565a80a42f7f14aab",
  "docs/source/v1.7.2/VALIDATION.json": "dc0d28e4ecf26fc9bdcc9249d7208675c3a3c504ddcaa9f6936d5f6ba6fb0b7b"
})
export const ACTIVE_R3 = freeze({ activeGate: 'G6P-A2U-R3', versions: ['1.7.0','1.7.1','1.7.2'], precedence: ['Later explicit user instruction','v1.7.2 additive delta where it speaks',...FOUNDATION.precedence.slice(1)], foundationIdentity: identity(FOUNDATION), deltaHashes: DELTA_PINS, credentialResolutionAllowed: false, providerCallsAllowed: false, additionalAccountAttemptsAuthorized: 0, qualificationExecutionHeld: true, genesisAuthorization: GENESIS_AUTH, documentationGetScope: 'docs.nansen.ai exact named pages and two exact ask questions only' })
export function validateR3Source(root) {
  const base = validateSourceInstallation()
  const manifest = fs.readFileSync(root + '/docs/source/ACTIVE_R3_SOURCE_MANIFEST.sha256')
  if (sha(manifest) !== '76bd045d04e857b1e34819ae27219c2af4164d19ce83a583ed9b927f7133e093') throw new Error('R3 source manifest pin mismatch.')
  const expected = {...FOUNDATION.fileHashes,...DELTA_PINS}
  const supplied = Object.fromEntries(manifest.toString('utf8').trimEnd().split('\n').map(line => { const [digest,name] = line.split('  '); return [name,digest] }))
  if (identity(supplied) !== identity(expected)) throw new Error('R3 source inventory mismatch.')
  for (const [name,digest] of Object.entries(DELTA_PINS)) if (!fs.lstatSync(root + '/' + name).isFile() || sha(fs.readFileSync(root + '/' + name)) !== digest) throw new Error('Delta source bytes changed.')
  if (identity(fs.readdirSync(root + '/docs/source/v1.7.2').sort()) !== identity(Object.keys(DELTA_PINS).map(name => name.split('/').at(-1)).sort())) throw new Error('Unexpected source delta file.')
  for (const name of Object.keys(FOUNDATION.fileHashes)) {
    const original = execFileSync('git',['show', R2_CUT + ':' + name],{cwd:root})
    if (sha(original) !== sha(fs.readFileSync(root + '/' + name))) throw new Error('Unchanged foundation source was replaced.')
  }
  return {status:'PASS', activeGate:ACTIVE_R3.activeGate, sourceIdentity:identity(ACTIVE_R3), manifestSha256:sha(manifest), additiveFiles:9, materialAuthorityAdditions:5, unchangedFoundationFiles:base.exactGovernedFiles, replacedFiles:0, deletedFiles:0, deltaArchiveSha256:DELTA_ARCHIVE_SHA256, deltaManifestSha256:DELTA_PINS['docs/source/v1.7.2/MANIFEST.sha256'], precedence:ACTIVE_R3.precedence}
}
export function r3ImplementationIdentity(root) {
  const names = execFileSync('git',['ls-files','--','.',':(exclude)ART_PRODUCTION',':(exclude).cursor',':(exclude)artifacts',':(exclude)docs/G6P_A2U_R3_REVIEW.json',':(exclude)docs/PROJECT_STATUS.yaml'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean).sort()
  return sha(names.map(name => name + '\0' + execFileSync('git',['rev-parse','HEAD:' + name],{cwd:root,encoding:'utf8'}).trim()).join('\n') + '\n')
}
