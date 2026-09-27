// Receiving-side evidence preflight only; never archive admission or art approval.
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)
const closed=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&Object.keys(x).every(k=>keys.includes(k))
export const PIXEL_REVIEW_CLASSES=Object.freeze(['safeArchive','manifestMembers','assetBytesAndDecodedMetadata','clipDefinitions','realizationEquivalence','licenseProvenance','sequenceContactFitFallback','externalPrincipalProvenance'])
export function validatePixelReviewPacket(x) {
 if(!closed(x,['schemaVersion','status','archiveSha256','indexSha256','evidence','requestedAuthority'])||x.schemaVersion!=='1.0.0'||x.status!=='PREPARED_NOT_SENT'||!hash(x.archiveSha256)||!hash(x.indexSha256)||x.requestedAuthority!=='MAIN_INDEPENDENT_REVIEW_ONLY'||!closed(x.evidence,PIXEL_REVIEW_CLASSES))throw Error('S6_REVIEW_CLOSED_SCHEMA')
 const holds=[]
 for(const name of PIXEL_REVIEW_CLASSES){const e=x.evidence[name];if(!closed(e,['status','reportSha256','externalBinding'])||!['MISSING','PASS','FAIL'].includes(e.status)||(e.reportSha256!==null&&!hash(e.reportSha256))||(e.externalBinding!==null&&!hash(e.externalBinding))||(e.status==='PASS'&&e.reportSha256===null))throw Error('S6_REVIEW_EVIDENCE_SCHEMA');if(e.status!=='PASS')holds.push(name)}
 // Self-declared PASS and receipt-shaped data are not authenticated evidence.
 return {schemaVersion:'1.0.0',status:holds.length?'HOLD_MISSING_OR_FAILED_EVIDENCE':'HOLD_INDEPENDENT_AUTHENTICATION_AND_MAIN_ADMISSION',holds,archiveSha256:x.archiveSha256,indexSha256:x.indexSha256,PrincipalApprovalGranted:false,MAINArchiveAdmitted:false,visualSemanticApproved:false,integrationAccepted:false,packetsSent:false}
}
