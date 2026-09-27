import {describe,it,expect} from 'vitest'
import {createHash} from 'node:crypto'
import {validateIntake} from '../../src/controller/foundation/contracts.mjs'
import {canonicalIdentitySerialization,identitySha256,clipIdentityDefinition,clipDefinitionSha256,capabilityContentSha256} from '../../src/controller/foundation/pixel-identity.mjs'
import {testArtIndex,refreshTestArtIdentities} from '../fixtures/s5/art-index'

function richIndex() {
 const x=testArtIndex(),a=x.assets[0]!,c=x.clips[0]!
 x.assets.push({...structuredClone(a),id:'TEST_SECOND',path:'TEST_second.png',sha256:'d'.repeat(64)},
  {...structuredClone(a),id:'TEST_THIRD',path:'TEST_third.png',sha256:'e'.repeat(64)})
 c.frames.push({order:1,assetId:'TEST_SECOND',durationMs:300,hold:false})
 c.contacts.push({frame:0,propId:'TEST_PROP',actorAnchor:{x:24,y:40},propAnchor:{x:0,y:0},evidenceId:'TEST_CONTACT'})
 c.ownershipEvents.push({frame:0,propId:'TEST_PROP',from:'TEST_DESK',to:'TEST_HAND'})
 x.clips.push({...structuredClone(c),id:'TEST_SECOND_CLIP',version:'TEST_SECOND_VERSION'})
 x.capabilities[0]!.clipIds.push('TEST_SECOND_CLIP')
 refreshTestArtIdentities(x)
 return x
}
type Index=ReturnType<typeof richIndex>
function syntheticReceipt(x:Index) {
 // Consistency simulation only. This is NOT an issued Principal approval.
 const c=x.clips[0]!;c.approvalReceiptId='TEST_SIMULATED_RECEIPT'
 x.approvalReceipts.push({id:c.approvalReceiptId,assetOrClipId:c.id,version:c.version,sha256:c.sha256,status:'USER_APPROVED_EXACT_VERSION',authority:'PRINCIPAL'})
}
const mutations: [string,(x:Index)=>void][]=[
 ['id',x=>{x.clips[0]!.id='TEST_RENAMED_CLIP'}],['version',x=>{x.clips[0]!.version='TEST_V2'}],
 ['duration',x=>{x.clips[0]!.frames[0]!.durationMs=999}],
 ['frame-addition',x=>{x.clips[0]!.frames.push({order:2,assetId:'TEST_THIRD',durationMs:400,hold:true})}],
 ['frame-removal',x=>{x.clips[0]!.frames.pop()}],
 ['frame-substitution',x=>{x.clips[0]!.frames[0]!.assetId='TEST_THIRD'}],
 ['frame-order',x=>{x.clips[0]!.frames.reverse().forEach((f,i)=>{f.order=i})}],
 ['hold',x=>{x.clips[0]!.frames[0]!.hold=false}],['loop',x=>{x.clips[0]!.loop=true}],
 ['cancellation',x=>{x.clips[0]!.cancellation='AT_FRAME_BOUNDARY'}],
 ['entrance',x=>{x.clips[0]!.entrance='TEST_ENTER'}],['exit',x=>{x.clips[0]!.exit='TEST_EXIT'}],
 ['facing',x=>{x.clips[0]!.facing='LEFT'}],['mirror',x=>{x.clips[0]!.mirrorAllowed=true}],
 ['static-fallback',x=>{x.clips[0]!.staticFallback='TEST_SECOND'}],
 ['contact-frame',x=>{x.clips[0]!.contacts[0]!.frame=1}],
 ['contact-prop',x=>{x.clips[0]!.contacts[0]!.propId='TEST_OTHER_PROP'}],
 ['contact-actor-anchor',x=>{x.clips[0]!.contacts[0]!.actorAnchor.x++}],
 ['contact-prop-anchor',x=>{x.clips[0]!.contacts[0]!.propAnchor.x++}],
 ['contact-evidence',x=>{x.clips[0]!.contacts[0]!.evidenceId='TEST_OTHER_EVIDENCE'}],
 ['ownership-frame',x=>{x.clips[0]!.ownershipEvents[0]!.frame=1}],
 ['ownership-prop',x=>{x.clips[0]!.ownershipEvents[0]!.propId='TEST_OTHER_PROP'}],
 ['ownership-from',x=>{x.clips[0]!.ownershipEvents[0]!.from='TEST_OTHER_DESK'}],
 ['ownership-to',x=>{x.clips[0]!.ownershipEvents[0]!.to='TEST_OTHER_HAND'}],
 ['occlusion',x=>{x.clips[0]!.frontHandOcclusion='FRONT_HAND'}],
 ['palette',x=>{for(const a of x.assets)a.paletteId='TEST_NEW_PALETTE';for(const c of x.clips)c.paletteId='TEST_NEW_PALETTE'}],
 ['material-shading',x=>{for(const a of x.assets)a.materialShadingId='TEST_NEW_MATERIAL';for(const c of x.clips)c.materialShadingId='TEST_NEW_MATERIAL'}],
 ['referenced-asset-sha',x=>{x.assets[0]!.sha256='f'.repeat(64)}],
]
describe('S5-R1 exact semantic clip and capability identity',()=>{
 it('synchronous SHA agrees with Node crypto across standard, Unicode and block-boundary vectors',()=>{for(const text of ['', 'abc','你好 — 🕵️',...Array.from({length:140},(_,i)=>'x'.repeat(i))])expect(identitySha256(text)).toBe(createHash('sha256').update(text).digest('hex'))})
 it('canonical serialization sorts object keys recursively but preserves exact array order',()=>{expect(canonicalIdentitySerialization({z:[{b:2,a:1}],a:'text'})).toBe(canonicalIdentitySerialization({a:'text',z:[{a:1,b:2}]}));expect(canonicalIdentitySerialization([1,2])).not.toBe(canonicalIdentitySerialization([2,1]));for(const v of [undefined,NaN,Infinity,new Date()])expect(()=>canonicalIdentitySerialization(v)).toThrow()})
 it('clip serialization excludes self-declared hash and receipt reference without excluding material fields',()=>{const x=richIndex(),c=x.clips[0]!,before=clipDefinitionSha256(c,x.assets);c.sha256='0'.repeat(64);c.approvalReceiptId='TEST_ATTESTATION_ONLY';expect(clipDefinitionSha256(c,x.assets)).toBe(before);expect(clipIdentityDefinition(c,x.assets)).not.toHaveProperty('sha256');expect(clipIdentityDefinition(c,x.assets)).not.toHaveProperty('approvalReceiptId')})
 for(const[name,mutate]of mutations)it('rejects stale computed clip hash and synthetic old receipt after '+name,()=>{const x=richIndex();syntheticReceipt(x);expect(validateIntake(x)).toBe(true);const declared=x.clips[0]!.sha256;mutate(x);expect(clipDefinitionSha256(x.clips[0],x.assets)).not.toBe(declared);expect(()=>validateIntake(x)).toThrow('CLIP_DEFINITION_IDENTITY')})
 const capChanges:[string,(x:Index)=>void][]=[['arbitrary-content-identity',x=>{x.capabilities[0]!.contentIdentity='0'.repeat(64)}],['clip-order',x=>{x.capabilities[0]!.clipIds.reverse()}],['clip-content',x=>{x.capabilities[0]!.clipIds.pop()}],['static-asset',x=>{x.capabilities[0]!.staticAssetId='TEST_SECOND'}],['semantic-fallback',x=>{x.capabilities[0]!.semanticFallback='Different static realization'}]]
 for(const[name,mutate]of capChanges)it('rejects stale/arbitrary capability identity after '+name,()=>{const x=richIndex();mutate(x);expect(()=>validateIntake(x)).toThrow('CAPABILITY_CONTENT_IDENTITY')})
 it('changed fallback asset bytes invalidate capability even without any clips',()=>{const x=richIndex();x.capabilities[0]!.clipIds=[];refreshTestArtIdentities(x);x.assets[2]!.sha256='9'.repeat(64);x.capabilities[0]!.staticAssetId='TEST_THIRD';expect(()=>validateIntake(x)).toThrow('CAPABILITY_CONTENT_IDENTITY')})
 it('referenced realization metadata affects clip identity even when PNG bytes are unchanged',()=>{const x=richIndex();x.assets[0]!.anchor.x++;expect(()=>validateIntake(x)).toThrow('CLIP_DEFINITION_IDENTITY')})
 it('static-only capability binds realization anchors even without a clip',()=>{const x=richIndex();x.clips=[];x.capabilities[0]!.clipIds=[];refreshTestArtIdentities(x);x.assets[0]!.anchor.x++;expect(()=>validateIntake(x)).toThrow('CAPABILITY_CONTENT_IDENTITY')})
 it('legitimate revised definition requires new identity and cannot keep a stale simulated receipt',()=>{const x=richIndex();syntheticReceipt(x);x.clips[0]!.frames[0]!.durationMs++;refreshTestArtIdentities(x);expect(()=>validateIntake(x)).toThrow('DERIVATIVE_APPROVAL_IDENTITY');x.clips[0]!.approvalReceiptId=null;x.approvalReceipts=[];expect(validateIntake(x)).toBe(true)})
 it('synthetic exact-version receipt consistency accepts only computed content, never an actual art approval',()=>{const x=richIndex();x.clips[0]!.version='TEST_V2';x.clips[0]!.frames[0]!.durationMs++;refreshTestArtIdentities(x);syntheticReceipt(x);expect(validateIntake(x)).toBe(true);x.approvalReceipts[0]!.version='TEST_OLD';expect(()=>validateIntake(x)).toThrow('DERIVATIVE_APPROVAL_IDENTITY')})
 it('duplicate required realization is detected using computed identity despite renamed capability labels',()=>{const x=richIndex();x.capabilities.push({...structuredClone(x.capabilities[0]!),id:'TEST_ALIAS'});expect(capabilityContentSha256(x.capabilities[0],x.assets,x.clips)).toBe(capabilityContentSha256(x.capabilities[1],x.assets,x.clips));expect(()=>validateIntake(x)).toThrow('DUPLICATE_REQUIRED_CONTENT')})
})
