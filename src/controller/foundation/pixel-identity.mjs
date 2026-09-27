// Pure, synchronous browser/Node identities. No IO, dependencies or approval authority.
export function canonicalIdentitySerialization(value) {
 if(value===null || typeof value==='string' || typeof value==='boolean')return JSON.stringify(value)
 if(typeof value==='number' && Number.isFinite(value))return JSON.stringify(value)
 if(Array.isArray(value))return '['+Array.from(value,v=>canonicalIdentitySerialization(v)).join(',')+']'
 if(value && typeof value==='object' && [Object.prototype,null].includes(Object.getPrototypeOf(value)))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalIdentitySerialization(value[k])).join(',')+'}'
 throw Error('S5_PIXEL_NON_CANONICAL_VALUE')
}
const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]
const rotate=(x,n)=>(x>>>n)|(x<<(32-n))
export function identitySha256(text) {
 const bytes=new TextEncoder().encode(text),padded=new Uint8Array(Math.ceil((bytes.length+9)/64)*64),view=new DataView(padded.buffer)
 padded.set(bytes);padded[bytes.length]=128;view.setUint32(padded.length-8,Math.floor(bytes.length/0x20000000));view.setUint32(padded.length-4,(bytes.length*8)>>>0)
 const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],w=new Uint32Array(64)
 for(let off=0;off<padded.length;off+=64){
  for(let i=0;i<16;i++)w[i]=view.getUint32(off+i*4)
  for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(rotate(a,7)^rotate(a,18)^(a>>>3))+w[i-7]+(rotate(b,17)^rotate(b,19)^(b>>>10)))>>>0}
  let[a,b,c,d,e,f,g,j]=h
  for(let i=0;i<64;i++){const t1=(j+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+K[i]+w[i])>>>0,t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0}
  for(const[i,v]of [a,b,c,d,e,f,g,j].entries())h[i]=(h[i]+v)>>>0
 }
 return h.map(v=>v.toString(16).padStart(8,'0')).join('')
}
const asset=(assets,id)=>{const a=assets.find(a=>a.id===id);if(!a)throw Error('S5_PIXEL_UNKNOWN_ASSET');return a}
const realization=a=>({sha256:a.sha256,version:a.version,kind:a.kind,width:a.width,height:a.height,channels:a.channels,exclusiveFootBaseline:a.exclusiveFootBaseline,anchor:a.anchor,transparentBounds:a.transparentBounds,paletteId:a.paletteId,materialShadingId:a.materialShadingId})
export function clipIdentityDefinition(clip,assets) {
 const {id,version,frames,loop,cancellation,entrance,exit,facing,mirrorAllowed,staticFallback,contacts,ownershipEvents,frontHandOcclusion,paletteId,materialShadingId}=clip
 return {identityDomain:'TRACE_ESCAPE_PIXEL_CLIP_DEFINITION',identityVersion:'1.0.0',id,version,
  frames:frames.map(({order,assetId,durationMs,hold})=>({order,assetId,assetSha256:asset(assets,assetId).sha256,assetRealization:realization(asset(assets,assetId)),durationMs,hold})),
  loop,cancellation,entrance,exit,facing,mirrorAllowed,
  staticFallback:{assetId:staticFallback,assetSha256:asset(assets,staticFallback).sha256,assetRealization:realization(asset(assets,staticFallback))},
  contacts,ownershipEvents,frontHandOcclusion,paletteId,materialShadingId}
}
export const clipDefinitionSha256=(clip,assets)=>identitySha256(canonicalIdentitySerialization(clipIdentityDefinition(clip,assets)))
export function capabilityIdentityDefinition(capability,assets,clips) {
 return {identityDomain:'TRACE_ESCAPE_PIXEL_CAPABILITY_CONTENT',identityVersion:'1.0.0',
  staticAssetSha256:asset(assets,capability.staticAssetId).sha256,staticAssetRealization:realization(asset(assets,capability.staticAssetId)),
  orderedClipIdentities:capability.clipIds.map(id=>{const c=clips.find(c=>c.id===id);if(!c)throw Error('S5_PIXEL_UNKNOWN_CLIP');return clipDefinitionSha256(c,assets)}),
  semanticFallback:capability.semanticFallback}
}
export const capabilityContentSha256=(capability,assets,clips)=>identitySha256(canonicalIdentitySerialization(capabilityIdentityDefinition(capability,assets,clips)))
