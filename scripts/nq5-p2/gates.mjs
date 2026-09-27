import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {identity} from '../nq5/schema.mjs'
import {gitEnv} from '../nq5-b1-r1/gates.mjs'
import {REVIEW_LENSES} from '../nq5-r2/review-identity.mjs'
import {assertLocalEvidence} from '../nq5-b3/gates.mjs'
import {cut,digest,REVIEWS,CORRECTION_SHA} from './authority.mjs'
import {readEvidence} from './evidence-files.mjs'
export {fresh as freshDocs} from './docs.mjs'
export function localGate(root){const dir=path.join(root,'artifacts/g6p-p2/local'),v=JSON.parse(readEvidence(dir,'VERIFICATION.json'));assertLocalEvidence(v,n=>readEvidence(dir,n+'.log'));if(identity(v.candidate)!==identity(cut(root))||v.implementationSha256!==digest(root))throw new Error('P2_CURRENT_ALL14_REQUIRED');return v}
export function reviewGate(root,index){const r=JSON.parse(readEvidence(path.join(root,'docs'),path.basename(REVIEWS[index])));if(r.status!=='PASS_BOUNDED_NO_CREDENTIAL_SCOPE'||r.checkpoint!==(index===0?'P2_REVIEW_A_PRELIVE':'P2_REVIEW_B_POSTLIVE')||r.approvedIdentityCorrectionSha256!==CORRECTION_SHA||r.implementationSha256!==digest(root)||r.unresolvedAcceptedP0P1!==0||r.credentialAccess!==false||r.actualPrivateStateAccess!==false||r.providerRequests!==0||r.externalDocumentationGets!==0||identity(r.lenses.map(x=>x.name).sort())!==identity([...REVIEW_LENSES].sort())||r.lenses.some(x=>x.status!=='PASS_BOUNDED_SCOPE'))throw new Error('P2_CURRENT_BOUND_REVIEW_REQUIRED');if(execFileSync('git',['rev-parse',r.reviewedImplementationCommit+'^{tree}'],{cwd:root,env:gitEnv(),encoding:'utf8'}).trim()!==r.reviewedImplementationTree)throw new Error('P2_REVIEW_TREE');execFileSync('git',['merge-base','--is-ancestor',r.reviewedImplementationCommit,'HEAD'],{cwd:root,env:gitEnv()});return r}
