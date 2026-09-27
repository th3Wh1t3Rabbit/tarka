import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {importActivity,preparePrincipalSample,parseCSV,identity,sha} from '../nq5-s2/activity.mjs'
import {ACTIVITY_INPUT_SCHEMA} from '../nq5-s2/schema.mjs'
import {reportSchema} from './report-schema.mjs'
import {compileCorpus} from '../nq5-s2/corpus.mjs'
import {OFF} from '../nq5-s1/core.mjs'
export const INPUT='docs/source/execution-s2-r1'
export const OUTPUT='artifacts/g6p-s2-r1'
export const START='12303488687b47a260ce63e44d670423810ff517'
export function derive(root=process.cwd()){
 const read=n=>fs.readFileSync(path.join(root,n)),json=n=>JSON.parse(read(n))
 const filename='CPP_SAMPLE_ACTIVITY_OBSERVATION_2026-09-17.json',sampleBytes=read('docs/source/execution-s2/INPUTS/'+filename)
 const sample=preparePrincipalSample(JSON.parse(sampleBytes),{filename,sha256:sha(sampleBytes),bytes:sampleBytes.length})
 const evidence=json(INPUT+'/CPP_EVIDENCE/MERIDIAN_ACCOUNT_ACTIVITY_EVIDENCE_CPP_OBSERVABILITY.json'),csvName='CPP_ELIGIBLE_WINDOW_LOGICAL_OPERATIONS_LOWER_BOUND.csv',csv=read(INPUT+'/CPP_EVIDENCE/'+csvName)
 const receipt=read(INPUT+'/MAIN_REVIEW/TRACE_ESCAPE_MAIN_LEAD_REVIEW_S2_RECEIPT_v1.0.0_2026-09-17.json')
 // Original sidecar is CRLF. The admitted LF derivative is reversibly normalized.
 const originalCsv=Buffer.from(csv.toString().replace(/\r?\n/g,'\r\n'))
 const cpp={schema_version:'2.0.0',source_id:evidence.source_id,source_class:'PROJECT_LEDGER_SUMMARY',project_class:'CPP',measurement_class:'PROJECT_LOGICAL_OPERATION',source_artifact:{filename:csvName,sha256:sha(originalCsv),bytes:originalCsv.length},upstream_artifact:{filename:evidence.source_archive.filename,sha256:evidence.source_archive.sha256,bytes:evidence.source_archive.bytes},review_receipt:{identity:sha(receipt),disposition:'VERIFIED'},credit_semantics:'UNKNOWN',planning_commitment:{completeDaysConservativeCommittedCredits:24124,partialDayConservativeCommittedCredits:299,metric:'NON_BILLED_CONSERVATIVE_PLANNING_COMMITMENT'},limitations:evidence.limitations,rows:parseCSV(csv.toString(),{}).rows.map(r=>({...r,measurement_class:'PROJECT_LOGICAL_OPERATION',displayed_credits:null}))}
 const originalManifest=read(INPUT+'/MANIFEST.sha256').toString().split('\n').find(l=>l.endsWith('  CPP_EVIDENCE/'+csvName))
 if(!originalManifest||cpp.source_artifact.sha256!==originalManifest.slice(0,64))throw Error('S2R1_ORIGINAL_CSV_BINDING')
 const account=importActivity(sample),cppReport=importActivity(cpp),combined=importActivity([sample,cpp])
 const corpus=compileCorpus(json('docs/G6P_NQ5_T1_S2_CURATED_INPUT.json')),sealedCorpus=json('artifacts/g6p-s2/REPORTS/TE_IFACE_CORPUS_RC1.json')
 if(JSON.stringify(corpus)!==JSON.stringify(sealedCorpus)||corpus.identity!=='64807a4cbfb7b5ea1fb4931c2b94731c9e8c6e4f7b751fc609f3ce1c45df5e53')throw Error('S2R1_CORPUS_CHANGED')
 const decision={schemaVersion:'2.0.0',gate:'G6P-NQ5-T1-S2-R1',status:'DELIVERED_PENDING_MAIN_LEAD_REVIEW',reviewedStartCommit:START,mainReviewReceiptIdentity:sha(receipt),sampleAccountReportIdentity:account.identity,cppLogicalOperationReportIdentity:cppReport.identity,combinedReportIdentity:combined.identity,corpusCandidateIdentity:corpus.identity,curatedAcceptedCalls:25,quotaClaimed:false,providerRequestFloorEvidenced:false,sameAccountSubmissionApplicability:'UNRESOLVED',interfaceFrozen:false,LaneCActive:false,packetsSent:false,networkRequests:0,credentialAccess:false,privateStateAccess:false,authorities:OFF}
 return {reports:{'MERIDIAN_ACCOUNT_ACTIVITY_REPORT.json':account,'CPP_LOGICAL_OPERATION_REPORT.json':cppReport,'COMBINED_ACCOUNT_PLANNING_REPORT.json':combined,'S2_R1_DECISION_RECEIPT.json':{...decision,identity:identity(decision)}},inputs:{'PRINCIPAL_SAMPLE_TRANSFORMED.json':sample,'CPP_SAFE_TRANSFORMED_INPUT.json':cpp},corpus}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const result=derive();for(const sub of ['REPORTS','SCHEMAS','INPUTS'])fs.mkdirSync(OUTPUT+'/'+sub,{recursive:true})
 for(const[n,v]of Object.entries(result.reports)){fs.writeFileSync(OUTPUT+'/REPORTS/'+n,JSON.stringify(v,null,2)+'\n');fs.writeFileSync(OUTPUT+'/SCHEMAS/'+n+'.schema.json',JSON.stringify(reportSchema(v),null,2)+'\n')}
 for(const[n,v]of Object.entries(result.inputs))fs.writeFileSync(OUTPUT+'/INPUTS/'+n,JSON.stringify(v,null,2)+'\n')
 fs.writeFileSync(OUTPUT+'/SCHEMAS/MERIDIAN_ACTIVITY_INPUT.schema.json',JSON.stringify(ACTIVITY_INPUT_SCHEMA,null,2)+'\n')
 console.log(JSON.stringify({status:'PASS',sampleRequests:result.reports['MERIDIAN_ACCOUNT_ACTIVITY_REPORT.json'].observed.requests,sampleCredits:32,cppOperations:result.reports['CPP_LOGICAL_OPERATION_REPORT.json'].logicalOperations.distinctLogicalOperationLowerBound,cppRequests:0,quotaClaimed:false,corpusUnchanged:true}))
}
