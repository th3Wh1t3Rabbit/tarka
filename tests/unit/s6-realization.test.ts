import {describe,it,expect} from 'vitest'
import {createHash} from 'node:crypto'
import {testArtIndex,refreshTestArtIdentities} from '../fixtures/s5/art-index'
import {validateIntake} from '../../src/controller/foundation/contracts.mjs'
import {canonicalIdentitySerialization} from '../../src/controller/foundation/pixel-identity.mjs'
import {capabilityRealizationDefinition,capabilityRealizationSha256} from '../../src/controller/foundation/pixel-realization.mjs'
type Index=ReturnType<typeof testArtIndex>
const duplicate=()=>{
 const x=testArtIndex(),a=structuredClone(x.assets[0]!),c=structuredClone(x.clips[0]!),p=structuredClone(x.capabilities[0]!)
 a.id='RENAMED_ASSET';a.version='RENAMED_VERSION';a.path='RENAMED.png';a.approvalReceiptId=null;x.assets.push(a)
 c.id='RENAMED_CLIP';c.version='RENAMED_VERSION';c.approvalReceiptId=null;c.frames=c.frames.map(f=>({...f,assetId:a.id}));c.staticFallback=a.id;x.clips.push(c)
 p.id='RENAMED_CAPABILITY';p.clipIds=[c.id];p.staticAssetId=a.id;p.semanticFallback='Different fallback prose';x.capabilities.push(p);refreshTestArtIdentities(x)
 return x
}
const identity=(x:Index,n:number)=>capabilityRealizationSha256(x.capabilities[n],x.assets,x.clips)
describe('S6 realization equivalence only, exact approval identities preserved',()=>{
 it('agrees with Node SHA256 on the canonical projection',()=>{const x=testArtIndex();expect(identity(x,0)).toBe(createHash('sha256').update(canonicalIdentitySerialization(capabilityRealizationDefinition(x.capabilities[0],x.assets,x.clips))).digest('hex'))})
 it('rejects all renamed IDs/versions/path/prose with different exact identities',()=>{const x=duplicate();expect(x.clips[0]!.sha256).not.toBe(x.clips[1]!.sha256);expect(x.capabilities[0]!.contentIdentity).not.toBe(x.capabilities[1]!.contentIdentity);expect(identity(x,0)).toBe(identity(x,1));expect(()=>validateIntake(x)).toThrow('DUPLICATE_REQUIRED_CONTENT')})
 it('optional classification does not alter equivalence but permits optional reuse',()=>{const x=duplicate();x.capabilities[1]!.required=false;expect(identity(x,0)).toBe(identity(x,1));expect(validateIntake(x)).toBe(true)})
 it('static-only duplicate is rejected under renamed bytes/geometry aliases',()=>{const x=duplicate();x.capabilities.forEach(c=>{c.clipIds=[]});refreshTestArtIdentities(x);expect(()=>validateIntake(x)).toThrow('DUPLICATE_REQUIRED_CONTENT')})
 it('stale declared hash still fails first',()=>{const x=testArtIndex();x.clips[0]!.frames[0]!.durationMs++;expect(()=>validateIntake(x)).toThrow('CLIP_DEFINITION_IDENTITY')})
 it('recomputed derivative cannot inherit exact old receipt',()=>{const x=testArtIndex(),c=x.clips[0]!;x.approvalReceipts.push({id:'TEST_RECEIPT',assetOrClipId:c.id,version:c.version,sha256:c.sha256,status:'USER_APPROVED_EXACT_VERSION',authority:'PRINCIPAL'});c.approvalReceiptId='TEST_RECEIPT';c.id='DERIVATIVE';c.version='DERIVATIVE';x.capabilities[0]!.clipIds=[c.id];refreshTestArtIdentities(x);expect(()=>validateIntake(x)).toThrow('DERIVATIVE_APPROVAL_IDENTITY')})
 it('resolved event object labels normalize but all contact positions remain',()=>{const x=duplicate();for(let i=0;i<2;i++){x.clips[i]!.contacts=[{frame:0,propId:x.assets[i]!.id,actorAnchor:{x:1,y:2},propAnchor:{x:3,y:4},evidenceId:i?'OTHER_PREVIEW':'TEST_PREVIEW'}];x.clips[i]!.ownershipEvents=[{frame:0,propId:x.assets[i]!.id,from:'WORLD',to:x.assets[i]!.id}]}refreshTestArtIdentities(x);expect(identity(x,0)).toBe(identity(x,1));expect(()=>validateIntake(x)).toThrow('DUPLICATE_REQUIRED_CONTENT')})
 const differences:[string,(x:Index)=>void][]=[
  ['PNG bytes',x=>{x.assets[1]!.sha256='d'.repeat(64)}],['anchor',x=>{x.assets[1]!.anchor.x++}],['bounds',x=>{x.assets[1]!.transparentBounds.x++}],
  ['duration',x=>{x.clips[1]!.frames[0]!.durationMs++}],['hold',x=>{x.clips[1]!.frames[0]!.hold=false}],['frame membership',x=>{x.clips[1]!.frames.push({...x.clips[1]!.frames[0]!,order:1})}],
  ['loop',x=>{x.clips[1]!.loop=true}],['cancel',x=>{x.clips[1]!.cancellation='AT_FRAME_BOUNDARY'}],['entrance',x=>{x.clips[1]!.entrance='OTHER_IDLE'}],['exit',x=>{x.clips[1]!.exit='OTHER_IDLE'}],
  ['facing',x=>{x.clips[1]!.facing='RIGHT'}],['mirror',x=>{x.clips[1]!.mirrorAllowed=true}],['occlusion',x=>{x.clips[1]!.frontHandOcclusion='FRONT_HAND'}],
  ['palette',x=>{x.assets[1]!.paletteId='OTHER_PALETTE';x.clips[1]!.paletteId='OTHER_PALETTE'}],['shading',x=>{x.assets[1]!.materialShadingId='OTHER_SHADING';x.clips[1]!.materialShadingId='OTHER_SHADING'}],
  ['contact',x=>{x.clips[1]!.contacts=[{frame:0,propId:'PAPER',actorAnchor:{x:1,y:2},propAnchor:{x:3,y:4},evidenceId:'TEST_PREVIEW'}]}],
  ['ownership',x=>{x.clips[1]!.ownershipEvents=[{frame:0,propId:'PAPER',from:'WORLD',to:'ROOK'}]}],
 ]
 for(const[name,change]of differences)it('nearby different realization remains admissible: '+name,()=>{const x=duplicate();change(x);refreshTestArtIdentities(x);expect(identity(x,0)).not.toBe(identity(x,1));expect(validateIntake(x)).toBe(true)})
 it('frame order and capability clip order are material',()=>{const x=duplicate();x.clips[1]!.frames=[{order:0,assetId:x.assets[1]!.id,durationMs:100,hold:false},{order:1,assetId:x.assets[1]!.id,durationMs:200,hold:true}];refreshTestArtIdentities(x);const before=identity(x,1);x.clips[1]!.frames.reverse();x.clips[1]!.frames.forEach((f,i)=>{f.order=i});refreshTestArtIdentities(x);expect(identity(x,1)).not.toBe(before);x.capabilities[1]!.clipIds=x.clips.map(c=>c.id);const ordered=identity(x,1);x.capabilities[1]!.clipIds.reverse();expect(identity(x,1)).not.toBe(ordered)})
 it('distinct identical-looking owners cannot collapse into a self-transfer',()=>{const x=duplicate();x.clips[0]!.ownershipEvents=[{frame:0,propId:'PAPER',from:x.assets[0]!.id,to:x.assets[0]!.id}];x.clips[1]!.ownershipEvents=[{frame:0,propId:'PAPER',from:x.assets[0]!.id,to:x.assets[1]!.id}];refreshTestArtIdentities(x);expect(identity(x,0)).not.toBe(identity(x,1));expect(validateIntake(x)).toBe(true)})
})
