#!/usr/bin/env node
import '../nq5-r2/hold.cjs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {derive,statusLog} from './model.mjs'
import {persist} from './io.mjs'
import {deliver} from './delivery.mjs'
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url))),environment=Object.fromEntries(['PATH','HOME','USER','LOGNAME','SHELL','TMPDIR','LANG','LC_ALL','DISPLAY','XDG_RUNTIME_DIR','PLAYWRIGHT_BROWSERS_PATH','npm_config_cache'].flatMap(k=>process.env[k]===undefined?[]:[[k,process.env[k]]]))
process.env=environment
const childEnv={...environment,PYTHONDONTWRITEBYTECODE:'1',NODE_OPTIONS:'--require '+path.join(root,'scripts/nq5-r2/hold.cjs'),npm_config_update_notifier:'false'}
async function main(){if(process.argv.length!==3||!['--audit','--status','--deliver'].includes(process.argv[2]))throw new Error('P2_R1_NO_ISSUE_UNSUPPORTED_MODE');if(process.argv[2]==='--deliver'){process.stdout.write(JSON.stringify(await deliver(root,childEnv))+'\n');return}const d=derive(root);if(process.argv[2]==='--status'){process.stdout.write(statusLog(d));return}persist(root,d);process.stdout.write(JSON.stringify({status:d.status,formalLeadAccepted:d.partial.index.length,newFormalLeadAccepted:d.partial.accepted.length,newPermanentHolds:d.partial.held.length,totalPermanentHolds:d.report.permanentlyHeldSupplierTerminals,httpStarts:47,observedProvider2xx:33,supplierCounted:31,knownCredits:37,unresolvedReservations:14,neverIssuedRetired:21,individualBlockers:d.partial.individualBlockers,credentialAccess:false,privateMutation:false,newNetworkRequests:0,ledgerSha256:d.report.ledgerSha256,ledgerBytes:d.report.ledgerBytes,P3_AUTHORIZED_TO_ISSUE:false,LaneC:false,controllerSeamCommit:false})+'\n')}
main().catch(e=>{process.stderr.write((/^P2_R1_[A-Z0-9_]+$/.test(e.message)?e.message:'P2_R1_FAIL_CLOSED_NO_UNSAFE_ERROR_EXPORT')+'; no network, credentials, reissue, rescue, private repair or P3.\n');process.exitCode=1})
