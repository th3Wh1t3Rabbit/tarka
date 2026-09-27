import {clipDefinitionSha256,capabilityContentSha256} from './pixel-identity.mjs'
import {capabilityRealizationSha256} from './pixel-realization.mjs'
const fail = message => { throw Error('S5_' + message) }
const object = x => x && typeof x === 'object' && !Array.isArray(x)
const closed = (x, keys) => object(x) && Object.keys(x).length === keys.length && Object.keys(x).every(k => keys.includes(k))
const eq = (a,b) => JSON.stringify(a) === JSON.stringify(b)
const hash = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x)
const id = x => typeof x === 'string' && /^[A-Za-z][A-Za-z0-9_.-]{0,127}$/.test(x)
const safePath = x => typeof x === 'string' && x.length <= 240 && x.split('/').every(p => /^[A-Za-z0-9_.-]+$/.test(p) && !['.','..'].includes(p)) && !x.startsWith('/')
const strings = x => Array.isArray(x) && x.every(id) && new Set(x).size === x.length
const point = p => closed(p,['x','y']) && Object.values(p).every(Number.isInteger)
const nonempty = x => typeof x === 'string' && x.trim().length > 0 && x.length < 2000
const freeze = x => { if(x && typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x)}return x }

export const VIEWPORT = freeze({
 schemaVersion:'1.0.0', viewport:{width:480,height:270}, room:{width:480,height:180}, controls:{width:480,height:90},
 references:[{width:960,height:540,scale:2},{width:1920,height:1080,scale:4}],
 scaling:'NEAREST_NEIGHBOR_INTEGER', actorIndependentScale:1, terminalReplaces:'ROOM_AND_CONTROLS',
 crtOpening:{x:24,y:18,width:432,height:216}, domSafe:{x:32,y:26,width:416,height:200},
 layers:['shell-back','screen-mask','shell-bezel','indicator'], bakedText:false,bakedEvidence:false,bakedInteractiveState:false,
 states:['off','locked','boot','active','bounded-error','reduced-motion-active'],
 semanticDOM:true, sharedReducer:true, rasterRequiredForPlainOrDocked:false
})
export function validateViewport(x) {
 if(!closed(x,Object.keys(VIEWPORT)) || !eq(x,VIEWPORT)) fail('VIEWPORT_CONTRACT')
 return true
}
export function validateScale(x) {
 if(!closed(x,['scale','nearestNeighbor','actorIndependentScale']) || !Number.isInteger(x.scale) || x.scale < 1 || x.scale > 16 || x.nearestNeighbor !== true || x.actorIndependentScale !== 1) fail('ART_SCALING')
 return true
}
export function validateIntake(x) {
 if(!closed(x,['schemaVersion','archiveId','version','manifestAuthority','assets','clips','capabilities','approvalReceipts']) || x.schemaVersion!=='1.0.0' || !id(x.archiveId) || !nonempty(x.version) || x.manifestAuthority!=='AUTHORITATIVE_INDEX' || !Array.isArray(x.assets) || !x.assets.length || !Array.isArray(x.clips) || !Array.isArray(x.capabilities) || !Array.isArray(x.approvalReceipts)) fail('INTAKE_SCHEMA')
 const assets = new Map(), paths=new Set(), receipts=new Map()
 for(const a of x.approvalReceipts){
  if(!closed(a,['id','assetOrClipId','version','sha256','status','authority']) || !id(a.id) || !id(a.assetOrClipId) || !hash(a.sha256) || !nonempty(a.version) || a.status!=='USER_APPROVED_EXACT_VERSION' || a.authority!=='PRINCIPAL' || receipts.has(a.id)) fail('APPROVAL_RECEIPT')
  receipts.set(a.id,a)
 }
 for(const a of x.assets){
  if(!closed(a,['id','path','sha256','version','kind','width','height','channels','exclusiveFootBaseline','anchor','transparentBounds','paletteId','materialShadingId','provenance','license','previewEvidence','approvalReceiptId','derivativeOf','bakedText','bakedEvidence']) || !id(a.id) || assets.has(a.id) || !safePath(a.path) || paths.has(a.path) || !a.path.endsWith('.png') || !hash(a.sha256) || !nonempty(a.version) || !['ACTOR','PROP','ROOM','TERMINAL'].includes(a.kind) || !Number.isInteger(a.width) || !Number.isInteger(a.height) || a.width<1 || a.height<1 || a.width>1920 || a.height>1080 || a.channels!=='RGBA' || !point(a.anchor) || !closed(a.transparentBounds,['x','y','width','height']) || !Object.values(a.transparentBounds).every(Number.isInteger) || a.transparentBounds.width<1 || a.transparentBounds.height<1 || a.transparentBounds.x<0 || a.transparentBounds.y<0 || a.transparentBounds.x+a.transparentBounds.width>a.width || a.transparentBounds.y+a.transparentBounds.height>a.height || a.anchor.x<0 || a.anchor.y<0 || a.anchor.x>a.width || a.anchor.y>a.height || !id(a.paletteId) || !id(a.materialShadingId) || !nonempty(a.provenance) || !nonempty(a.license) || !strings(a.previewEvidence) || !a.previewEvidence.length || (a.derivativeOf!==null && !id(a.derivativeOf))) fail('ASSET_SCHEMA_OR_DUPLICATE')
  if(a.kind==='ACTOR' && (a.width!==48 || a.height!==88 || a.exclusiveFootBaseline!==84 || a.anchor.y!==84 || a.transparentBounds.y+a.transparentBounds.height>84)) fail('ACTOR_CANVAS_BASELINE')
  if(a.kind!=='ACTOR' && a.exclusiveFootBaseline!==null) fail('NONACTOR_BASELINE')
  if(a.bakedText!==false || a.bakedEvidence!==false) fail('RASTER_INTERACTIVE_CONTENT')
  if(a.approvalReceiptId!==null){const p=receipts.get(a.approvalReceiptId);if(!p || p.assetOrClipId!==a.id || p.version!==a.version || p.sha256!==a.sha256) fail('DERIVATIVE_APPROVAL_IDENTITY')}
  paths.add(a.path);assets.set(a.id,a)
 }
 const clips=new Map()
 for(const c of x.clips){
  if(!closed(c,['id','version','sha256','frames','loop','cancellation','entrance','exit','facing','mirrorAllowed','staticFallback','contacts','ownershipEvents','frontHandOcclusion','paletteId','materialShadingId','approvalReceiptId']) || !id(c.id) || clips.has(c.id) || !nonempty(c.version) || !hash(c.sha256) || !Array.isArray(c.frames) || !c.frames.length || typeof c.loop!=='boolean' || !['IMMEDIATE','AT_FRAME_BOUNDARY','FINISH_REQUIRED_CONTACT'].includes(c.cancellation) || !id(c.entrance) || !id(c.exit) || !['FRONT','LEFT','RIGHT','BACK'].includes(c.facing) || typeof c.mirrorAllowed!=='boolean' || !assets.has(c.staticFallback) || !Array.isArray(c.contacts) || !Array.isArray(c.ownershipEvents) || !['NONE','FRONT_HAND','PROP_FRONT','LAYER_SPLIT'].includes(c.frontHandOcclusion) || !id(c.paletteId) || !id(c.materialShadingId)) fail('CLIP_SCHEMA')
  for(const [i,f] of c.frames.entries()){
   if(!closed(f,['order','assetId','durationMs','hold']) || f.order!==i || !assets.has(f.assetId) || !Number.isInteger(f.durationMs) || f.durationMs<1 || f.durationMs>60000 || typeof f.hold!=='boolean') fail('FRAME_ORDER_TIMING')
   const a=assets.get(f.assetId);if(a.paletteId!==c.paletteId || a.materialShadingId!==c.materialShadingId) fail('PALETTE_SHADING')
  }
  for(const e of c.contacts) if(!closed(e,['frame','propId','actorAnchor','propAnchor','evidenceId']) || !Number.isInteger(e.frame) || e.frame<0 || e.frame>=c.frames.length || !id(e.propId) || !point(e.actorAnchor) || !point(e.propAnchor) || !id(e.evidenceId)) fail('CONTACT_EVENT')
  for(const e of c.ownershipEvents) if(!closed(e,['frame','propId','from','to']) || !Number.isInteger(e.frame) || e.frame<0 || e.frame>=c.frames.length || !id(e.propId) || !id(e.from) || !id(e.to)) fail('OWNERSHIP_EVENT')
  const computedIdentity=clipDefinitionSha256(c,x.assets)
  if(c.sha256!==computedIdentity)fail('CLIP_DEFINITION_IDENTITY')
  if(c.approvalReceiptId!==null){const p=receipts.get(c.approvalReceiptId);if(!p || p.assetOrClipId!==c.id || p.version!==c.version || p.sha256!==computedIdentity)fail('DERIVATIVE_APPROVAL_IDENTITY')}
  clips.set(c.id,c)
 }
 const caps=new Set(), requiredContent=new Set()
 for(const c of x.capabilities){
  if(!closed(c,['id','required','clipIds','staticAssetId','semanticFallback','contentIdentity']) || !id(c.id) || caps.has(c.id) || typeof c.required!=='boolean' || !strings(c.clipIds) || !c.clipIds.every(v=>clips.has(v)) || !assets.has(c.staticAssetId) || !nonempty(c.semanticFallback) || !hash(c.contentIdentity)) fail('CAPABILITY_OR_FALLBACK')
  const computedIdentity=capabilityContentSha256(c,x.assets,x.clips)
  if(c.contentIdentity!==computedIdentity)fail('CAPABILITY_CONTENT_IDENTITY')
  // S6 user-approved scope exception: only duplicate realization, never approval.
  const realizationIdentity=c.required?capabilityRealizationSha256(c,x.assets,x.clips):null
  if(c.required && requiredContent.has(realizationIdentity)) fail('DUPLICATE_REQUIRED_CONTENT')
  if(c.required)requiredContent.add(realizationIdentity);caps.add(c.id)
 }
 for(const a of x.assets)if(a.derivativeOf!==null && !assets.has(a.derivativeOf)) fail('DERIVATIVE_PARENT')
 for(const p of x.approvalReceipts)if(!assets.has(p.assetOrClipId) && !clips.has(p.assetOrClipId))fail('UNUSED_APPROVAL')
 return true
}
export async function verifyIntakeBytes(index, bytesByPath) {
 validateIntake(index)
 const paths=Object.keys(bytesByPath)
 if(paths.length!==index.assets.length || paths.some(p=>!index.assets.some(a=>a.path===p)))fail('ARCHIVE_MEMBER_SET')
 for(const a of index.assets){
  const b=bytesByPath[a.path];if(!(b instanceof Uint8Array)) fail('ARCHIVE_BYTES')
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('')
  if(digest!==a.sha256) fail('ARCHIVE_HASH')
 }
 return true
}
