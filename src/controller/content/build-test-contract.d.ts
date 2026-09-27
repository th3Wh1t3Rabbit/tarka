declare module '*scripts/nq5-s4-r1/consumers.mjs' {
 export function consumerManifest(dead:unknown):Record<string,string>
 export function assertClosedClient(map:unknown,manifest:unknown):boolean
}
declare module '*scripts/nq5-s4/compile-content.mjs' {
 export function compileContent():{entries:Record<string,{text:string;fallback:string;optional:boolean}>;dead:Record<string,unknown>;compiledEntries:number}
 export function compileEntries(catalog:unknown,manifest:unknown):unknown
}
