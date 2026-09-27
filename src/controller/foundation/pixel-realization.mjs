// S6 duplicate-content identity only. Never an approval identity or approval grant.
import {canonicalIdentitySerialization,identitySha256} from './pixel-identity.mjs'
const find=(values,id)=>{const x=values.find(v=>v.id===id);if(!x)throw Error('S6_UNKNOWN_REALIZATION_REFERENCE');return x}
export const assetRealizationDefinition=a=>({pngByteSha256:a.sha256,kind:a.kind,width:a.width,height:a.height,channels:a.channels,exclusiveFootBaseline:a.exclusiveFootBaseline,anchor:a.anchor,transparentBounds:a.transparentBounds,palette:a.paletteId,materialShading:a.materialShadingId})
// Unresolved tokens are retained as semantic state/owner/prop roles, never erased.
// Future admission must independently authenticate their role/contact bindings.
const role=(id,assets)=>{const a=assets.find(a=>a.id===id);return a?{asset:assetRealizationDefinition(a)}:{semanticRole:id}}
export function clipRealizationDefinition(c,assets) {
 const props=new Map(),owners=new Map()
 const eventRole=(id,map)=>{const a=assets.find(a=>a.id===id);if(!a)return {semanticRole:id};if(!map.has(id))map.set(id,map.size);return {asset:assetRealizationDefinition(a),roleOrdinal:map.get(id)}}
 // Preserve same/different logical participants even when two actors/props look alike.
 return {frames:c.frames.map(f=>({asset:assetRealizationDefinition(find(assets,f.assetId)),durationMs:f.durationMs,hold:f.hold})),loop:c.loop,cancellation:c.cancellation,entrance:role(c.entrance,assets),exit:role(c.exit,assets),facing:c.facing,mirrorAllowed:c.mirrorAllowed,staticFallback:assetRealizationDefinition(find(assets,c.staticFallback)),contacts:c.contacts.map(e=>({frame:e.frame,prop:eventRole(e.propId,props),actorAnchor:e.actorAnchor,propAnchor:e.propAnchor})),ownershipEvents:c.ownershipEvents.map(e=>({frame:e.frame,prop:eventRole(e.propId,props),from:eventRole(e.from,owners),to:eventRole(e.to,owners)})),frontHandOcclusion:c.frontHandOcclusion,palette:c.paletteId,materialShading:c.materialShadingId}
}
export function capabilityRealizationDefinition(c,assets,clips) {
 return {identityDomain:'TRACE_ESCAPE_PIXEL_REALIZATION_EQUIVALENCE',identityVersion:'1.0.0',staticAsset:assetRealizationDefinition(find(assets,c.staticAssetId)),orderedClips:c.clipIds.map(id=>clipRealizationDefinition(find(clips,id),assets))}
}
export const capabilityRealizationSha256=(c,assets,clips)=>identitySha256(canonicalIdentitySerialization(capabilityRealizationDefinition(c,assets,clips)))
