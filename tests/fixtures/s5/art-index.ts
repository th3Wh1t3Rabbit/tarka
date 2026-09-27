/** Synthetic index metadata only: no real Pixel asset or approval receipt is inspected. */
import {clipDefinitionSha256,capabilityContentSha256} from '../../../src/controller/foundation/pixel-identity.mjs'
export function testArtIndex() {
 const index={schemaVersion:'1.0.0',archiveId:'TEST_ARCHIVE',version:'TEST_VERSION',manifestAuthority:'AUTHORITATIVE_INDEX',
 assets:[{id:'TEST_ACTOR',path:'TEST_actor.png',sha256:'a'.repeat(64),version:'TEST_VERSION',kind:'ACTOR',width:48,height:88,channels:'RGBA',exclusiveFootBaseline:84,anchor:{x:24,y:84},transparentBounds:{x:9,y:9,width:29,height:75},paletteId:'TEST_PALETTE',materialShadingId:'TEST_SHADING',provenance:'SYNTHETIC_METADATA_ONLY_NOT_PIXEL_ARCHIVE',license:'SYNTHETIC_TEST_ONLY',previewEvidence:['TEST_PREVIEW'],approvalReceiptId:null as string|null,derivativeOf:null as string|null,bakedText:false,bakedEvidence:false}],
 clips:[{id:'TEST_CLIP',version:'TEST_VERSION',sha256:'b'.repeat(64),frames:[{order:0,assetId:'TEST_ACTOR',durationMs:200,hold:true}],loop:false,cancellation:'IMMEDIATE',entrance:'TEST_IDLE',exit:'TEST_IDLE',facing:'FRONT',mirrorAllowed:false,staticFallback:'TEST_ACTOR',contacts:[] as {frame:number;propId:string;actorAnchor:{x:number;y:number};propAnchor:{x:number;y:number};evidenceId:string}[],ownershipEvents:[] as {frame:number;propId:string;from:string;to:string}[],frontHandOcclusion:'NONE',paletteId:'TEST_PALETTE',materialShadingId:'TEST_SHADING',approvalReceiptId:null as string|null}],
 capabilities:[{id:'TEST_READ',required:true,clipIds:['TEST_CLIP'],staticAssetId:'TEST_ACTOR',semanticFallback:'Static reading pose and selectable text',contentIdentity:'c'.repeat(64)}],
 approvalReceipts:[] as {id:string;assetOrClipId:string;version:string;sha256:string;status:string;authority:string}[]}
 refreshTestArtIdentities(index)
 return index
}
export function refreshTestArtIdentities(index: ReturnType<typeof testArtIndex>) {
 for(const c of index.clips)c.sha256=clipDefinitionSha256(c,index.assets)
 for(const c of index.capabilities)c.contentIdentity=capabilityContentSha256(c,index.assets,index.clips)
}
