import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { identity, sha, freeze } from '../nq5/schema.mjs'
import { ACTIVE_R3, validateR3Source } from '../nq5-r3/authority.mjs'
export const R3_CUT = 'fd59f20cbf0be64d34d3ff32d76e3629f46d0afd'
export const R3_TREE = 'dbc47b2de664fb4af616a3e35900fc9a92eefe1c'
export const R3_ARCHIVE_SHA256 = '92dadf31d1dd447a433a16af2e23f7efeec33ec26791014b4eb94fa15e129131'
export const CAMPAIGN_ID = 'NQ5-T1-20260916-15fc6ad1-d6f3-422a-b724-de5e66154011'
export const DELTA_ARCHIVE_SHA256 = '07eada16e7a4e5219fed9a169a543c7ff30a8fab4f01e486a01452823b027a13'
export const SOURCE_MANIFEST_SHA256 = 'ceb7b460bdb4a575df15c42aa3ccc796b699be2ee45537444cd022cfed96b0d5'
export const DELTA_PINS = freeze({
  "docs/source/v1.7.3/00_READ_ME_FIRST.md": "5f09ddb5576ff79518768fbb2aebf891fd06e2a533a95c2c9c4e1cef1ac51697",
  "docs/source/v1.7.3/40_A2U_R3_LEAD_REVIEW_AND_R3_R1_HANDOFF.md": "8f7342798aec8f76c629c5a692a0c434fcb191a2c3f091887ea77976bee371fc",
  "docs/source/v1.7.3/41_G6P_A2U_R3_R1_FRONTIER_POLICY_IDENTITY_REMEDIATION_CONTRACT.txt": "c54f1e13778c10e865c129eaeb9d2859976d8819e192d86c2940908419cd2308",
  "docs/source/v1.7.3/42_CURRENT_PROJECT_STATE_DELTA_R3_R1.yaml": "ec8854ac4634237ce6c52e10238a326730b103e9a62934782949f7be67b1a504",
  "docs/source/v1.7.3/MANIFEST.sha256": "af9a6e13174edddadf508f4e7609d6419f899f1e9c5b15a67bdb9b917c698111",
  "docs/source/v1.7.3/PROJECT_FILE_ACTIONS.txt": "6b6060e77d967bdc6262c5fb1899c023c558461fa97ff67726db16b548376823",
  "docs/source/v1.7.3/VALIDATION.json": "3cb4e1969968f4dfa1f48158d938fac19126f2644e630f4d6e87984390f49f22"
})
export const PRESERVED_PINS = freeze({
  "OFFICIAL_DOCS/INDEX.json": "44bcb48d3362927d50b54a303d7b0baae671b5d1c82d5741f92433caa88d917b",
  "PLANS/PLAN_SPECIFIC_OFFICIAL_CONTRACT_ADMISSION.json": "8deac4cc4eb0a8e39fea7ec5b27b947c3a1ba13b52040830cf880fbd182d4be7",
  "PLANS/T1_PLAN.json": "b8b8a314445e507c3d6087c728140caa6239e2daaf168df3ce730fdefa1285bb",
  "PLANS/T1_RESERVE_PLAN.json": "421e9085bfe7560cb89f5f2e584929340cfc3a3447d46445f64ec0772ba831cf",
  "REPORTS/NQ5_ACCOUNT_PREFLIGHT_REDACTED.json": "6dc07198fdc6f6dc685b076877456c9b669517798aea932cc39c981f8e11ee3f",
  "REPORTS/ACCOUNT_OBSERVATION_REUSE_RECEIPT.json": "4b7549feb22b558c2eccd85b05ee47889480eaaa18749241e721ac0a14765175",
  "REPORTS/T1_CAMPAIGN_GENESIS_RECEIPT.json": "55869d9f484d3e8bc5b55f9cfa15de014da9015d7d9d249256b36433380b8f9c"
})
export const ACTIVE_R3_R1 = freeze({activeGate:'G6P-A2U-R3-R1',versions:['1.7.0','1.7.1','1.7.2','1.7.3'],precedence:['Later explicit user instruction','v1.7.3 additive delta where it speaks',...ACTIVE_R3.precedence.slice(1)],foundationIdentity:identity(ACTIVE_R3),deltaHashes:DELTA_PINS,credentialResolutionAllowed:false,providerCallsAllowed:false,documentationRetrievalAllowed:false,additionalAccountAttemptsAuthorized:0,qualificationExecutionHeld:true,campaignCreationAllowed:false,privateStateMutationAllowed:false,campaignId:CAMPAIGN_ID})
export function validateR3R1Source(root) {
  validateR3Source(root)
  const manifest=fs.readFileSync(root+'/docs/source/ACTIVE_R3_R1_SOURCE_MANIFEST.sha256')
  if(sha(manifest)!==SOURCE_MANIFEST_SHA256)throw new Error('R3-R1 source manifest pin mismatch.')
  const lines=manifest.toString().trimEnd().split('\n'),expected=fs.readFileSync(root+'/docs/source/ACTIVE_R3_SOURCE_MANIFEST.sha256','utf8').trimEnd().split('\n')
  if(lines.length!==59||identity(lines.slice(0,52))!==identity(expected)||identity(lines.slice(52))!==identity(Object.entries(DELTA_PINS).map(([name,hash])=>hash+'  '+name)))throw new Error('Additive source inventory mismatch.')
  if(identity(fs.readdirSync(root+'/docs/source/v1.7.3').sort())!==identity(Object.keys(DELTA_PINS).map(name=>name.split('/').at(-1)).sort()))throw new Error('Unexpected delta inventory.')
  for(const line of lines){const [hash,name]=line.split('  ');if(!fs.lstatSync(root+'/'+name).isFile()||sha(fs.readFileSync(root+'/'+name))!==hash)throw new Error('Exact source bytes changed.')}
  for(const line of expected){const [,name]=line.split('  ');if(!fs.readFileSync(root+'/'+name).equals(execFileSync('git',['show',R3_CUT+':'+name],{cwd:root})))throw new Error('Accepted source foundation changed.')}
  for(const name of ['scripts/nq5-r3/genesis.mjs','scripts/nq5-r3/contracts.mjs'])if(!fs.readFileSync(root+'/'+name).equals(execFileSync('git',['show',R3_CUT+':'+name],{cwd:root})))throw new Error('Accepted genesis or contract implementation reopened.')
  return {status:'PASS',activeGate:ACTIVE_R3_R1.activeGate,sourceIdentity:identity(ACTIVE_R3_R1),frozenArtifactSourceIdentity:identity(ACTIVE_R3),manifestSha256:SOURCE_MANIFEST_SHA256,unchangedFoundationFiles:52,additiveFiles:7,materialAuthorityAdditions:3,replacedFiles:0,deletedFiles:0,deltaArchiveSha256:DELTA_ARCHIVE_SHA256,precedence:ACTIVE_R3_R1.precedence}
}
export function implementationIdentity(root) {
 const names=execFileSync('git',['ls-files','--','.',':(exclude)ART_PRODUCTION',':(exclude).cursor',':(exclude)artifacts',':(exclude)docs/G6P_A2U_R3_R1_REVIEW.json',':(exclude)docs/PROJECT_STATUS.yaml'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean).sort()
 return sha(names.map(name=>name+'\0'+execFileSync('git',['rev-parse','HEAD:'+name],{cwd:root,encoding:'utf8'}).trim()).join('\n')+'\n')
}
