import { identity } from '../nq5/schema.mjs'
import { seal } from './authority.mjs'
export const REGISTRY=Object.freeze({
 '0xb003df4b243f938132e8cadbeb237abc5a889fb4':'PUBLIC_LIQUIDITY_POOL_CONTROL',
 '0xef1c6e67703c7bd7107eed8303fbe6ec2554bf6b':'PUBLIC_PROTOCOL_ROUTER_CONTROL',
 '0xa5d7f0f7027fa8f4d1be8042e1e43bbdec36951e':'PUBLIC_CUSTODIAL_HUB_CONTROL',
 '0xf16e9b0d03470827a95cdfd0cb8a8a3b46969b91':'PUBLIC_CUSTODIAL_HUB_CONTROL',
 '0x1111111254eeb25477b68fb85ed929f73a960582':'PUBLIC_PROTOCOL_ROUTER',
 '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640':'PUBLIC_LIQUIDITY_POOL',
 '0xe592427a0aece92de3edee1f18e0157c05861564':'PUBLIC_PROTOCOL_ROUTER',
 '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc':'PUBLIC_LIQUIDITY_POOL',
 '0xdef1c0ded9bec7f1a1670819833240f027b25eff':'PUBLIC_PROTOCOL_EXCHANGE_PROXY',
 '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45':'PUBLIC_PROTOCOL_ROUTER'})
const lower=s=>s.toLowerCase()
export function opposite(record,subject){return lower(record.from_address)===lower(subject)?lower(record.to_address):lower(record.from_address)}
export function classify(p,truth){
 const subject=lower(p.request.body.address),records=p.admission.normalizedRecords,addresses=new Set(records.map(r=>opposite(r,subject)).filter(a=>a!==subject)),seed=truth.seedAddresses.map(lower).includes(subject),exact=records.some(r=>Object.hasOwn(truth.times,lower(r.transaction_hash))),known=REGISTRY[subject]??null,pageSaturated=p.semantic.stats.rawTransactionRecords>=100
 const hubThresholds={uniqueAdmittedRowsAtLeast100:records.length>=100,distinctOppositeAddressesAtLeast50:addresses.size>=50,pageSaturatedWithoutExactHashOrAcceptedSeed:pageSaturated&&!exact&&!seed}
 let sourceQualityClass=known?.includes('CUSTODIAL')?'PUBLIC_CUSTODIAL_HUB_CONTROL':known?.includes('LIQUIDITY')?'PUBLIC_LIQUIDITY_POOL_CONTROL':known?'PUBLIC_PROTOCOL_INFRASTRUCTURE_CONTROL':Object.values(hubThresholds).some(Boolean)?'HIGH_DEGREE_UNCLASSIFIED_HUB_CONTROL':seed?'ACCEPTED_EULER_SEED_CONTEXT':records.length<=10?'LOW_VOLUME_UNCLASSIFIED_COUNTERPARTY_TEST':'BOUNDED_COUNTERPARTY_TEST'
 const recursiveFrontierAuthority=!['PUBLIC_CUSTODIAL_HUB_CONTROL','PUBLIC_LIQUIDITY_POOL_CONTROL','PUBLIC_PROTOCOL_INFRASTRUCTURE_CONTROL','HIGH_DEGREE_UNCLASSIFIED_HUB_CONTROL'].includes(sourceQualityClass)
 return {logicalId:p.logicalId,subjectAddress:subject,sourceQualityClass,leadSuppliedPlanningRegistryClass:known,planningOnly:true,nansenLabel:false,playerFacingLabel:false,uniqueAdmittedRows:records.length,distinctOppositeAddresses:addresses.size,pageSaturated,caseSpecificExactHashLinkage:exact,acceptedSeedLinkage:seed,hubThresholds,recursiveFrontierAuthority,boundedControlValue:!recursiveFrontierAuthority,qualificationCountPreserved:true,gameplayIntegrationAccepted:false}
}
export function quality(sources,truth,lead){return seal({schemaVersion:'1.0.0',scope:'LEAD_SUPPLIED_PLANNING_CLASSES_NOT_NANSEN_LABELS_OR_GAME_CLAIMS',leadAcceptanceReceiptIdentity:lead.hash,leadAcceptedSourceCalls:sources.length,publicProjectionContainsPlanningClasses:false,planningRegistryIdentity:identity(REGISTRY),rows:sources.map(p=>classify(p,truth))})}
