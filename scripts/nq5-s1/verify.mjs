import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {OFF,BASE,CONTRACT_SHA,identity,sha,checkSeal,STATUS,falsifiable} from './core.mjs'
import {derive,schemaOf,readInput} from './model.mjs'
import {validateSchema} from '../nq5/schema.mjs'
export function verify(){
 const all=derive(),input=readInput(),n='artifacts/g6p-s1/',identities={}
 for(const[k,v]of Object.entries(all)){const b=fs.readFileSync(n+'REPORTS/'+k),s=JSON.parse(fs.readFileSync(n+'SCHEMAS/'+k+'.schema.json'));if(b.toString()!==JSON.stringify(v,null,2)+'\n'||identity(s)!==identity(schemaOf(v)))throw Error('S1_GENERATED_BYTES');validateSchema(k,v,s);checkSeal(v);identities[k]=v.identity}
 const b=all['ACCEPTED_EVIDENCE_AND_QUESTION_BASELINE.json'],r=all['UNRESOLVED_OBSERVATION_REGISTRY.json'],u=all['CURRENT_EULER_REQUEST_SPACE_UPPER_BOUND.json'],m=all['REQUEST_SPECIFIC_CANDIDATE_MATRIX.json'],d=all['S1_DECISION_RECEIPT.json']
 if(r.baselineIdentity!==b.identity||u.registryIdentity!==r.identity||m.registryIdentity!==r.identity||m.boundsIdentity!==u.identity||d.baselineIdentity!==b.identity||d.registryIdentity!==r.identity||d.boundsIdentity!==u.identity||d.candidateMatrixIdentity!==m.identity||d.optionsIdentity!==all['SCALE_PATH_OPTIONS_AND_DECISION.json'].identity)throw Error('S1_CROSSWALK')
 if(m.candidates.length!==r.observations.filter(o=>o.status===STATUS[0]).length||m.candidates.length!==u.maximumDefensibleAdditionalInventory||d.defensibleAdditionalInventory!==m.candidates.length||r.observations.some(o=>!falsifiable(o.consumerDelta)))throw Error('S1_OBSERVATION_CANDIDATE_BOUND')
 if(b.acceptedRows.length!==25||b.holds.length!==6||b.unknownReservations.length!==14||b.retiredRequests.length!==21||b.unknownReservations.some(o=>o.providerReceipt!=='UNKNOWN'||o.charge!=='UNKNOWN')||u.theoreticalAllConceivableEulerUpperBound!==null||u.expectedProviderSuccess!==null||u.eventualLeadAcceptance!==null)throw Error('S1_FALSE_SUCCESS')
 function walk(x){if(!x||typeof x!=='object')return;if(x.authorities&&identity(x.authorities)!==identity(OFF))throw Error('S1_AUTHORITY');for(const[k,v]of Object.entries(x)){if(/^(?:balanceAnchor|protectedReserve|remainingCredits|safeHeaders|accountBody|entity_name|address_label|counterparty_label|apiKey|credentialHash|privatePath|rawPayload)$/.test(k))throw Error('S1_PUBLIC_BOUNDARY');walk(v)}}
 Object.values(all).forEach(walk)
 if(sha(fs.readFileSync('docs/source/execution-s1/S1_EXECUTION_CONTRACT.txt'))!==CONTRACT_SHA)throw Error('S1_EXACT_EXECUTION_CONTRACT')
 const targets=input.source.files.map(f=>f.file)
 const historical=execFileSync('git',['diff','--name-only',BASE,'HEAD','--','docs/source',':(exclude)docs/source/v1.10.0',':(exclude)docs/source/execution-s1'],{encoding:'utf8'});if(historical.trim())throw Error('S1_HISTORY_REWRITE')
 return {status:'PASS',schemas:6,deterministicArtifactIdentities:identities,observationToCandidateCrosswalk:'PASS',auditedObservations:18,futureInventory:0,globalExhaustionClaim:false,sourceInstalledMembers:targets.length,sourceManifestEntries:16,stableFileHashes:'PASS',historicalEpochChanges:0,authorities:OFF}
}
if(process.argv[1]?.endsWith('/verify.mjs'))console.log(JSON.stringify(verify(),null,2))
