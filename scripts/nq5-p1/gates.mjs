import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {identity,sha} from '../nq5/schema.mjs'
import {gitEnv} from '../nq5-b1-r1/gates.mjs'
import {REVIEW_LENSES} from '../nq5-r2/review-identity.mjs'
import {assertLocalEvidence} from '../nq5-b3/gates.mjs'
import {cut,digest,REVIEWS} from './authority.mjs'
import {admittedCaptured as readCaptured} from './docs.mjs'
import {contracts} from './admission.mjs'
export function localGate(root){const dir=path.join(root,'artifacts/g6p-p1/local'),v=JSON.parse(fs.readFileSync(path.join(dir,'VERIFICATION.json')));assertLocalEvidence(v,n=>fs.readFileSync(path.join(dir,n+'.log')));if(identity(v.candidate)!==identity(cut(root))||v.implementationSha256!==digest(root))throw new Error('P1_CURRENT_ALL14_REQUIRED');return v}
export function reviewGate(root,index){const r=JSON.parse(fs.readFileSync(path.join(root,REVIEWS[index])));if(r.status!=='PASS_BOUNDED_NO_CREDENTIAL_SCOPE'||r.checkpoint!==(index===0?'P1_REVIEW_A_PRELIVE':'P1_REVIEW_B_POSTLIVE')||r.implementationSha256!==digest(root)||r.unresolvedAcceptedP0P1!==0||r.credentialAccess!==false||r.actualPrivateStateAccess!==false||r.providerRequests!==0||r.externalDocumentationGets!==0||identity(r.lenses.map(x=>x.name).sort())!==identity([...REVIEW_LENSES].sort())||r.lenses.some(x=>x.status!=='PASS_BOUNDED_SCOPE'))throw new Error('P1_BOUND_REVIEW_REQUIRED');if(execFileSync('git',['rev-parse',r.reviewedImplementationCommit+'^{tree}'],{cwd:root,env:gitEnv(),encoding:'utf8'}).trim()!==r.reviewedImplementationTree)throw new Error('P1_REVIEW_TREE');execFileSync('git',['merge-base','--is-ancestor',r.reviewedImplementationCommit,'HEAD'],{cwd:root,env:gitEnv()});return r}
export function freshDocs(c){const d=readCaptured(c.root);if(d.identity!==c.admission.official.identity||identity([contracts(d).tgm.hash,contracts(d).counter.hash])!==identity([c.admission.tgm.hash,c.admission.counter.hash]))throw new Error('P1_LIVE_DOCUMENT_BINDING');const required=new Set(['index','tgm','pricing','rates','coverage','redistribution','terms',...(c.admission.counter.status.startsWith('ADMITTED_')?['counterparties','clarification']:[])]);for(const s of d.index.snapshots.filter(s=>required.has(s.name))){const age=Date.now()-Date.parse(s.retrievedAtUtc);if(s.httpStatus!==200||!Number.isFinite(age)||age<0||age>7200000||sha(d.bodies[s.name])!==s.sha256)throw new Error('P1_LIVE_DOCUMENT_FRESHNESS_REQUIRED')}return true}
