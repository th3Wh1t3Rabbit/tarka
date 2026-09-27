import fs from 'node:fs'
import path from 'node:path'
import { identity, sha } from '../nq5/schema.mjs'
import { git } from '../nq5-b1-r2/gates.mjs'
import { LOCAL_SUITES } from '../nq5-b1/live.mjs'
import { REVIEW_LENSES } from '../nq5-r2/review-identity.mjs'
import { replay, readMirrored } from '../nq5-b1/store.mjs'
import { LEDGER_SHA } from '../nq5-b1-r1/checkpoint.mjs'
import { digest, cut } from './authority.mjs'
import { privateContext } from './context.mjs'
import { safeReplay } from './evidence.mjs'
import { assertLiveDocs } from './docs.mjs'

const liveProofs=new WeakMap()
export function assertPrivateAncestry(roots){for(const root of roots){if(!path.isAbsolute(root))throw new Error('R3_PRIVATE_ANCESTRY_CHANGED');let current=path.parse(root).root;for(const part of root.slice(current.length).split(path.sep).filter(Boolean)){current=path.join(current,part);const s=fs.lstatSync(current);if(s.isSymbolicLink()||!s.isDirectory())throw new Error('R3_PRIVATE_ANCESTRY_CHANGED')}}return true}
const contextIdentity=c=>identity({bound:c.bound,profile:c.profile,plans:c.plans,truth:c.truth,oldProfile:c.oldProfile,auditSchema:c.auditSchema,originalLockSha256:c.diagnostic.originalLockSha256,originalStateHashes:c.originalStateHashes,prior:{rows:c.prior.rows,starts:[...c.prior.starts],responses:[...c.prior.responses],terminals:[...c.prior.terminals],bytes:c.prior.bytes,bytesSha256:c.prior.bytesSha256}})
export function assertRawInventory(roots,expectedNames){for(const root of roots){const dir=path.join(root,'raw-b1'),d=fs.lstatSync(dir);if(d.isSymbolicLink()||!d.isDirectory()||(d.mode&0o777)!==0o700||d.uid!==process.getuid()||fs.readdirSync(dir).sort().join()!==[...expectedNames].sort().join())throw new Error('R3_PREKEY_RAW_INVENTORY_CHANGED');for(const name of expectedNames){if(!/^[a-f0-9]{64}\.[1-3]\.bin$/.test(name))throw new Error('R3_PREKEY_RAW_INVENTORY_CHANGED');const s=fs.lstatSync(path.join(dir,name));if(s.isSymbolicLink()||!s.isFile()||(s.mode&0o777)!==0o600||s.uid!==process.getuid()||s.nlink!==1)throw new Error('R3_PREKEY_RAW_METADATA_CHANGED')}}return true}
export function reviewGate(root,name,{blockedAllowed=false}={}){
 const r=JSON.parse(fs.readFileSync(path.join(root,name)))
 if(r.schemaVersion!=='1.0.0'||r.implementationSha256!==digest(root)||r.credentialAccess!==false||r.providerRequests!==0||r.actualPrivateStateAccess!==false||!Array.isArray(r.lenses)||r.lenses.length!==8||identity(r.lenses.map(l=>l.name).sort())!==identity([...REVIEW_LENSES].sort()))throw new Error('R3_DEDICATED_REVIEW_REQUIRED')
 if(!blockedAllowed&&(r.status!=='PASS_BOUNDED_NO_CREDENTIAL_SCOPE'||r.unresolvedAcceptedP0P1!==0||r.lenses.some(l=>l.status!=='PASS_BOUNDED_SCOPE')))throw new Error('R3_DEDICATED_REVIEW_REQUIRED')
 if(git(root,'rev-parse',r.reviewedImplementationCommit+'^{tree}')!==r.reviewedImplementationTree)throw new Error('R3_REVIEW_TREE_IDENTITY');git(root,'merge-base','--is-ancestor',r.reviewedImplementationCommit,'HEAD');return r
}
export function localGate(root){const dir=path.join(root,'artifacts/g6p-b1-r3/local'),v=JSON.parse(fs.readFileSync(path.join(dir,'VERIFICATION.json'))),candidate=cut(root),age=Date.now()-Date.parse(v.generatedAtUtc)
 if(v.status!=='PASS'||v.implementationSha256!==digest(root)||identity(v.candidate)!==identity(candidate)||!Number.isFinite(age)||age<0||age>86400000||v.suites.length!==14||identity(v.suites.map(x=>x.name).sort())!==identity([...LOCAL_SUITES].sort())||v.credentialAccess!==false||v.actualPrivateStateAccess!==false||v.authenticatedNansenProviderRequests!==0||v.unauthenticatedDocumentationGets!==0||v.accountRequests!==0||v.browserRuntimeRequests!==0||v.networkHold!==true)throw new Error('R3_COMPLETE_LOCAL_REGRESSION_REQUIRED')
 for(const s of v.suites){const b=fs.readFileSync(path.join(dir,s.name+'.log'));if(s.status!=='PASS'||!b.toString().trim()||sha(b)!==s.sha256)throw new Error('R3_DIRECT_SUITE_EVIDENCE_REQUIRED')}return v
}
export function admitPreLive(root,docs){
 const v=localGate(root),review=reviewGate(root,'docs/G6P_NQ5_T1_B1_R3_PRELIVE_REVIEW.json');assertLiveDocs(root,docs)
 const context=privateContext(root),r=safeReplay(context);if(!r.safelyAdmissible||!r.admittedContextualTransferCount)throw new Error('R3_PRESERVED_REPLAY_BLOCKER')
 liveProofs.set(context,{root,docs,bound:context.bound,candidate:cut(root),implementationSha256:digest(root),contextIdentity:contextIdentity(context),originalLockSha256:context.diagnostic.originalLockSha256,originalStateHashes:{...context.originalStateHashes},rawNames:[...context.prior.responses.values()].map(r=>r.rawName),verificationIdentity:identity(v),reviewIdentity:identity(review),roots:[...context.roots]});return context
}
export function assertLiveContext(context,{locked=false}={}){
 const proof=liveProofs.get(context);if(!proof)throw new Error('R3_BRANDED_PRELIVE_PROOF_REQUIRED')
 if(context.bound!==proof.bound||identity(cut(proof.root))!==identity(proof.candidate)||digest(proof.root)!==proof.implementationSha256||identity(localGate(proof.root))!==proof.verificationIdentity||identity(reviewGate(proof.root,'docs/G6P_NQ5_T1_B1_R3_PRELIVE_REVIEW.json'))!==proof.reviewIdentity||identity(context.roots)!==identity(proof.roots)||contextIdentity(context)!==proof.contextIdentity)throw new Error('R3_CHANGED_PRELIVE_PROOF')
 assertLiveDocs(proof.root,proof.docs)
 assertPrivateAncestry(proof.roots)
 const current=replay(proof.roots,context.bound.envelope);if(current.bytesSha256!==LEDGER_SHA||current.bytes!==4659||identity(current.rows)!==identity(context.prior.rows))throw new Error('R3_PRIVATE_ADMISSION_CHANGED')
 if(sha(readMirrored(proof.roots,'B1_EXECUTION_LOCK.json'))!==proof.originalLockSha256)throw new Error('R3_ORIGINAL_LOCK_CHANGED')
 for(const[n,h]of Object.entries(proof.originalStateHashes))if(sha(readMirrored(proof.roots,n))!==h)throw new Error('R3_GENESIS_CHANGED')
 assertRawInventory(proof.roots,proof.rawNames)
 const names=['B1_EXECUTION_LOCK.json','GENESIS_COMMIT.json','genesis.json','qualification.jsonl','raw-b1',...(locked?['B1_R3_RESUME_LOCK.json']:[])].sort().join();for(const root of proof.roots)if(fs.readdirSync(root).sort().join()!==names)throw new Error('R3_UNEXPECTED_PRIVATE_STATE')
 return proof
}
