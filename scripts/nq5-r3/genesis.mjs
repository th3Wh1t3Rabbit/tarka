import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { identity, sha, freeze } from '../nq5/schema.mjs'
import { readCampaignEvidence } from '../nq5-r2/campaign-evidence.mjs'
import { ACTIVE_R3, GENESIS_AUTH } from './authority.mjs'
const proofs = new WeakMap(), EMPTY_SHA = sha(Buffer.alloc(0))
export const EMPTY_JOURNAL_SHA256 = EMPTY_SHA
export const configuredCampaignRoots = () => [path.join(os.homedir(),'.local/share/trace-escape/nq5-private'),path.join(os.homedir(),'.local/state/trace-escape/nq5-private')]
export const newCampaignId = () => 'NQ5-T1-' + new Date().toISOString().slice(0,10).replaceAll('-','') + '-' + randomUUID()
const safeId = id => /^NQ5-T1-\d{8}-[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/.test(id)
function directory(file, restrictive = false) {
  const stat = fs.lstatSync(file)
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || restrictive && (stat.mode & 0o777) !== 0o700) throw new Error('Indeterminate, unsafe or inconsistent configured roots.')
}
function noSymlinkParents(file) {
  let current = path.parse(file).root
  for (const part of file.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current,part)
    const stat = fs.lstatSync(current)
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Indeterminate root ancestry.')
  }
}
export function proveCampaignAbsent(roots, id) {
  if (!safeId(id) || !Array.isArray(roots) || roots.length !== 2 || roots.some(root => typeof root !== 'string' || !path.isAbsolute(root) || path.normalize(root) !== root) || roots[0] === roots[1] || roots.some((root,i) => root.startsWith(roots[1-i] + path.sep))) throw new Error('Campaign ID or configured roots inconsistent.')
  let entries = 0
  for (const root of roots) {
    noSymlinkParents(root); directory(root,true)
    const walk = location => {
      for (const name of fs.readdirSync(location)) {
        if (++entries > 10000 || name.includes(id)) throw new Error('Campaign collision or indeterminate root search.')
        const file = path.join(location,name), stat = fs.lstatSync(file)
        if (stat.isSymbolicLink() || stat.uid !== process.getuid() || !stat.isDirectory() && !stat.isFile()) throw new Error('Indeterminate root entry.')
        if (stat.isDirectory() && name.startsWith('NQ5-T1-')) throw new Error('Unexpected prior campaign baseline; genesis cannot reset or repeat this gate.')
        if (name === 'genesis.json' || name === 'GENESIS_COMMIT.json' || name === 'qualification.jsonl') throw new Error('Unexpected prior genesis or qualification journal; do not create a replacement baseline.')
        if (stat.isDirectory()) walk(file)
      }
    }
    walk(root)
  }
  return {complete:true, rootsChecked:2, entriesExamined:entries, candidateAbsent:true, noSymlinks:true, exclusiveCreationStillRequired:true}
}
function syncDirectory(file) { const descriptor = fs.openSync(file,fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW); try { fs.fsyncSync(descriptor) } finally { fs.closeSync(descriptor) } }
function exclusiveFile(file, bytes, appendOnly = false) {
  const descriptor = fs.openSync(file,fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW | (appendOnly ? fs.constants.O_APPEND : 0),0o600)
  try { if (bytes.length) fs.writeFileSync(descriptor,bytes); fs.fsyncSync(descriptor) } finally { fs.closeSync(descriptor) }
}
function privateBytes(file) {
  const descriptor = fs.openSync(file,fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
  try {
    const stat = fs.fstatSync(descriptor)
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600 || stat.nlink !== 1) throw new Error('Genesis restrictive file persistence mismatch.')
    return fs.readFileSync(descriptor)
  } finally { fs.closeSync(descriptor) }
}
function validateContext(context) {
  if (Object.keys(context).sort().join() !== 'accountObservationIdentity,accountReportSha256,candidateCommit,candidateTree,sourceIdentity' || !/^[a-f\d]{40}$/.test(context.candidateCommit) || !/^[a-f\d]{40}$/.test(context.candidateTree) || ![context.sourceIdentity,context.accountObservationIdentity,context.accountReportSha256].every(value=>/^[a-f\d]{64}$/.test(value)) || context.sourceIdentity !== identity(ACTIVE_R3)) throw new Error('Genesis current candidate/source/observation binding missing.')
}
function reopen(roots,id,context) {
  validateContext(context)
  const read = root => {
    noSymlinkParents(root); directory(root,true)
    const location = path.join(root,id); directory(location,true)
    if (fs.readdirSync(location).sort().join() !== 'GENESIS_COMMIT.json,genesis.json,qualification.jsonl') throw new Error('Unexpected prior journal or incomplete genesis transaction.')
    return {genesis:privateBytes(path.join(location,'genesis.json')),journal:privateBytes(path.join(location,'qualification.jsonl')),commit:privateBytes(path.join(location,'GENESIS_COMMIT.json')),file:path.join(location,'qualification.jsonl')}
  }
  const [primary,mirror] = roots.map(read)
  if (!primary.genesis.equals(mirror.genesis) || !primary.journal.equals(mirror.journal) || !primary.commit.equals(mirror.commit) || primary.journal.length !== 0 || sha(primary.journal) !== EMPTY_SHA) throw new Error('Genesis primary/mirror corruption or initial journal mismatch.')
  const record = JSON.parse(primary.genesis), commit = JSON.parse(primary.commit)
  const {createdAtUtc,rootCollisionProof,...core} = record
  const expected = {schemaVersion:'1.0.0',campaignId:id,authorizationId:GENESIS_AUTH,parentAuthorizationId:'LEAD-NQ5-UNIFIED-CASEBOARD-UTILITY-001',...context,initialJournalBytes:0,initialJournalSha256:EMPTY_SHA,t1:{attempts:0,countedSuccesses:0,actualCreditDelta:0,projectedCredits:0},priorDiscovery:{attempts:32,credits:37,classification:'SEPARATE_HISTORICAL_NOT_T1'},consumedAccount:{attempts:1,actualCreditDelta:0,classification:'SEPARATE_CONSUMED_OBSERVATION_NOT_T1'},observedAvailableCredits:630027,protectedReserveCredits:250,credentialAccess:false,providerRequests:0}
  if (identity(core) !== identity(expected) || !Number.isFinite(Date.parse(createdAtUtc)) || Date.parse(createdAtUtc) > Date.now() || rootCollisionProof?.complete !== true || rootCollisionProof.rootsChecked !== 2 || !rootCollisionProof.candidateAbsent || !rootCollisionProof.noSymlinks || identity(commit) !== identity({schemaVersion:'1.0.0',campaignId:id,genesisSha256:sha(primary.genesis),journalSha256:EMPTY_SHA,journalBytes:0,transactionCommitted:true})) throw new Error('Genesis identity/accounting/commit mismatch; no implicit reset allowed.')
  return {record,genesisSha256:sha(primary.genesis),commitSha256:sha(primary.commit),file:primary.file}
}
export function createCampaignGenesis(roots,id,context) {
  validateContext(context)
  const absence = proveCampaignAbsent(roots,id)
  // Exclusive directory reservation fences this multi-file transaction. A
  // durable COMMIT in both roots is required before any receipt or freeze.
  // Failure leaves a held incomplete baseline; no deletion, repair or retry.
  for (const root of roots) { fs.mkdirSync(path.join(root,id),{mode:0o700}); syncDirectory(root) }
  const record = {schemaVersion:'1.0.0',campaignId:id,authorizationId:GENESIS_AUTH,parentAuthorizationId:'LEAD-NQ5-UNIFIED-CASEBOARD-UTILITY-001',...context,createdAtUtc:new Date().toISOString(),rootCollisionProof:absence,initialJournalBytes:0,initialJournalSha256:EMPTY_SHA,t1:{attempts:0,countedSuccesses:0,actualCreditDelta:0,projectedCredits:0},priorDiscovery:{attempts:32,credits:37,classification:'SEPARATE_HISTORICAL_NOT_T1'},consumedAccount:{attempts:1,actualCreditDelta:0,classification:'SEPARATE_CONSUMED_OBSERVATION_NOT_T1'},observedAvailableCredits:630027,protectedReserveCredits:250,credentialAccess:false,providerRequests:0}
  const bytes = Buffer.from(JSON.stringify(record,null,2) + '\n'), commit = Buffer.from(JSON.stringify({schemaVersion:'1.0.0',campaignId:id,genesisSha256:sha(bytes),journalSha256:EMPTY_SHA,journalBytes:0,transactionCommitted:true},null,2) + '\n')
  for (const root of roots) {
    const location = path.join(root,id)
    exclusiveFile(path.join(location,'qualification.jsonl'),Buffer.alloc(0),true)
    exclusiveFile(path.join(location,'genesis.json'),bytes)
    syncDirectory(location)
  }
  for (const root of roots) { exclusiveFile(path.join(root,id,'GENESIS_COMMIT.json'),commit); syncDirectory(path.join(root,id)) }
  const result = reopen(roots,id,context)
  const receipt = freeze({schemaVersion:'1.0.0',status:'PASS_VERIFIED_CAMPAIGN_GENESIS',campaignId:id,authorizationId:GENESIS_AUTH,parentAuthorizationId:record.parentAuthorizationId,...context,createdAtUtc:record.createdAtUtc,exclusiveCreation:true,appendOnlyJournalCreation:true,durableTransactionCommitted:true,rootCollisionProof:absence,journalBytes:0,journalSha256:EMPTY_SHA,primaryGenesisSha256:result.genesisSha256,mirrorGenesisSha256:result.genesisSha256,genesisBytesEqual:true,primaryCommitSha256:result.commitSha256,mirrorCommitSha256:result.commitSha256,restrictiveDirectoryMode:'0700',restrictiveFileMode:'0600',ownerVerified:true,reopenedVerified:true,t1:record.t1,priorDiscovery:record.priorDiscovery,consumedAccount:record.consumedAccount,observedAvailableCredits:630027,protectedReserveCredits:250,credentialAccess:false,providerRequests:0,networkActivityInGenesis:false,documentationRetrievalIsSeparate:true,privatePathsIncluded:false,rawAccountBytesIncluded:false,qualificationExecutionHeld:true})
  proofs.set(receipt,{roots:[...roots],id,context:structuredClone(context)}); return receipt
}
export function assertGenesis(receipt, context) {
  const proof = proofs.get(receipt)
  if (!proof || identity(proof.context) !== identity(context)) throw new Error('Current bound verified genesis required, not a serialized zero-history receipt.')
  if (proof.lineage) { verifyResumeLineage(proof.lineage.root,proof.creationContext,context); verifyResumeRoots(proof.roots,proof.id) }
  const reopened = reopen(proof.roots,proof.id,proof.creationContext ?? context)
  if (reopened.genesisSha256 !== receipt.primaryGenesisSha256 || reopened.commitSha256 !== receipt.primaryCommitSha256) throw new Error('Genesis changed after verification.')
  const evidence = readCampaignEvidence(reopened.file)
  if (evidence.counted || evidence.actualCredits || evidence.projectedCredits || evidence.logicalIds.length || evidence.journalSha256 !== EMPTY_SHA) throw new Error('Initial campaign is not durably empty.')
  return evidence
}

// Export failed after the first durable creation. Revalidation is strictly
// read-only: the historical candidate binding and every private byte survive.
import { execFileSync } from 'node:child_process'
const resumeChanges = new Set(['scripts/secret-patterns.mjs','tests/unit/nq5-r2-secret-patterns.test.mjs','scripts/nq5-r3/genesis.mjs','scripts/package-nq5-r3-checkpoint.mjs','tests/unit/nq5-r3-checkpoint.test.mjs','docs/G6P_A2U_R3_REVIEW.json'])
function verifyResumeLineage(root,creation,current) {
  validateContext(creation); validateContext(current)
  const git = (...args) => execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trimEnd()
  for (const value of [creation,current]) if (git('rev-parse',value.candidateCommit+'^{tree}') !== value.candidateTree) throw new Error('Resume candidate tree mismatch.')
  git('merge-base','--is-ancestor',creation.candidateCommit,current.candidateCommit)
  if (['sourceIdentity','accountObservationIdentity','accountReportSha256'].some(key=>creation[key] !== current[key])) throw new Error('Resume cannot change source or consumed observation.')
  const changes = git('diff','--name-only',creation.candidateCommit,current.candidateCommit).split('\n').filter(Boolean)
  if (changes.some(file=>!resumeChanges.has(file))) throw new Error('Resume lineage changes an unrelated or protected implementation.')
  const old = git('show',creation.candidateCommit+':scripts/nq5-r3/genesis.mjs'), now = git('show',current.candidateCommit+':scripts/nq5-r3/genesis.mjs')
  const boundary = 'export function assertGenesis('
  if (old.split(boundary)[0] !== now.split(boundary)[0]) throw new Error('Original genesis creation/validation implementation changed.')
}
function verifyResumeRoots(roots,id) {
  // Reuse the full fail-closed metadata search, allowing only the exact expected
  // baseline at the root. No missing/partial/extra baseline permits creation.
  if (!Array.isArray(roots) || roots.length !== 2 || roots.some(value=>!path.isAbsolute(value) || path.normalize(value)!==value) || roots[0]===roots[1] || roots.some((value,i)=>value.startsWith(roots[1-i]+path.sep))) throw new Error('Resume roots inconsistent.')
  let entries=0
  for (const configured of roots) {
    noSymlinkParents(configured); directory(configured,true)
    const walk = location => { for (const name of fs.readdirSync(location)) {
      if (++entries>10000) throw new Error('Indeterminate resume root search.')
      const file=path.join(location,name),stat=fs.lstatSync(file)
      if (stat.isSymbolicLink() || stat.uid!==process.getuid() || !stat.isDirectory()&&!stat.isFile()) throw new Error('Unsafe resume root entry.')
      if (location===configured && name===id && stat.isDirectory()) continue
      if (name.startsWith('NQ5-T1-') || ['genesis.json','GENESIS_COMMIT.json','qualification.jsonl'].includes(name)) throw new Error('Unexpected additional or misplaced baseline.')
      if (stat.isDirectory()) walk(file)
    } }
    walk(configured)
  }
}
export function resumeCampaignGenesis(roots,id,creation,current,root,expectedGenesisSha256) {
  if (!safeId(id) || !/^[a-f\d]{64}$/.test(expectedGenesisSha256)) throw new Error('Explicit historical baseline identity required.')
  verifyResumeLineage(root,creation,current)
  verifyResumeRoots(roots,id)
  const result=reopen(roots,id,creation),record=result.record
  if (result.genesisSha256!==expectedGenesisSha256) throw new Error('Historical baseline hash mismatch; no repair or replacement.')
  const receipt=freeze({schemaVersion:'1.1.0',status:'PASS_VERIFIED_CAMPAIGN_GENESIS',campaignId:id,authorizationId:GENESIS_AUTH,parentAuthorizationId:record.parentAuthorizationId,...current,creationCandidateCommit:creation.candidateCommit,creationCandidateTree:creation.candidateTree,createdAtUtc:record.createdAtUtc,operation:'READ_ONLY_REVALIDATION_OF_EXISTING_COMMITTED_GENESIS',creationNotRepeated:true,privateArtifactsModified:false,historicalCandidateBindingPreserved:true,currentCandidateDescendsFromCreation:true,originalCreationImplementationPreserved:true,durableTransactionCommitted:true,rootCollisionProof:record.rootCollisionProof,journalBytes:0,journalSha256:EMPTY_SHA,primaryGenesisSha256:result.genesisSha256,mirrorGenesisSha256:result.genesisSha256,primaryCommitSha256:result.commitSha256,mirrorCommitSha256:result.commitSha256,genesisBytesEqual:true,restrictiveDirectoryMode:'0700',restrictiveFileMode:'0600',ownerVerified:true,reopenedVerified:true,t1:record.t1,priorDiscovery:record.priorDiscovery,consumedAccount:record.consumedAccount,observedAvailableCredits:630027,protectedReserveCredits:250,credentialAccess:false,providerRequests:0,networkActivityInGenesis:false,privatePathsIncluded:false,rawAccountBytesIncluded:false,qualificationExecutionHeld:true})
  proofs.set(receipt,{roots:[...roots],id,context:structuredClone(current),creationContext:structuredClone(creation),lineage:{root}})
  assertGenesis(receipt,current)
  return receipt
}
