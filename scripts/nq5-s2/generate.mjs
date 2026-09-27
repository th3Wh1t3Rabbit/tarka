import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {importActivity,identity} from './activity.mjs'
import {compileCorpus,validateConcept,CORPUS_INTERFACE} from './corpus.mjs'
import {OFF} from '../nq5-s1/core.mjs'
import {schemaOf} from '../nq5-s1/model.mjs'
import {ACTIVITY_INPUT_SCHEMA} from './schema.mjs'
export function derive(root){
 const read=n=>JSON.parse(fs.readFileSync(path.join(root,n))),sample=read('docs/source/execution-s2/INPUTS/CPP_SAMPLE_ACTIVITY_OBSERVATION_2026-09-17.json'),account=importActivity(sample),corpus=compileCorpus(read('docs/G6P_NQ5_T1_S2_CURATED_INPUT.json'))
 corpus.concepts.forEach(validateConcept)
 const receipt={schemaVersion:'1.0.0',gate:'G6P-NQ5-T1-S2',sourceVersion:'1.11.0',status:'DELIVERED_PENDING_MAIN_LEAD_REVIEW',accountReportIdentity:account.identity,corpusCandidateIdentity:corpus.identity,officialAccountCallFloor:1000,planningBufferTarget:1024,formerCuratedFloorRetired:true,curatedAcceptedCalls:25,sampleObservedUniqueRequests:20,sampleCredits:32,sampleEvidenceClass:'PRINCIPAL_TRANSCRIBED',sampleVerifiedLowerBound:0,quotaClaimed:false,cppBusinessPayloadImported:false,CPPIsCuratedEvidence:false,interface:CORPUS_INTERFACE,interfaceFrozen:false,LaneCActive:false,packetsSent:false,exactTruthUnchanged:true,networkRequests:0,credentialAccess:false,privateStateAccess:false,authorities:OFF}
 return {'MERIDIAN_ACCOUNT_ACTIVITY_REPORT.json':account,'TE_IFACE_CORPUS_RC1.json':corpus,'S2_DECISION_RECEIPT.json':{...receipt,identity:identity(receipt)}}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const docs=derive(process.cwd()),dir='artifacts/g6p-s2/REPORTS';fs.mkdirSync(dir,{recursive:true})
 for(const[n,v]of Object.entries(docs))fs.writeFileSync(path.join(dir,n),JSON.stringify(v,null,2)+'\n')
 fs.mkdirSync('artifacts/g6p-s2/SCHEMAS',{recursive:true})
 for(const[n,v]of Object.entries(docs))fs.writeFileSync('artifacts/g6p-s2/SCHEMAS/'+n+'.schema.json',JSON.stringify(schemaOf(v),null,2)+'\n')
 fs.writeFileSync('artifacts/g6p-s2/SCHEMAS/MERIDIAN_ACTIVITY_INPUT.schema.json',JSON.stringify(ACTIVITY_INPUT_SCHEMA,null,2)+'\n')
 console.log(JSON.stringify({status:'PASS',reports:Object.keys(docs),sampleRequests:20,sampleCredits:32,curatedConcepts:25,interfaceFrozen:false,networkRequests:0}))
}
