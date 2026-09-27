import fs from 'node:fs'
import {fileURLToPath} from 'node:url'
import ts from 'typescript'
export async function resolve(specifier,context,next){
 try{return await next(specifier,context)}catch(e){
  if(specifier.startsWith('.') && context.parentURL?.startsWith('file:')){
   for(const ext of ['.ts','.tsx','.mjs']){const url=new URL(specifier+ext,context.parentURL);if(fs.existsSync(fileURLToPath(url)))return {url:url.href,shortCircuit:true}}
  }
  throw e
 }
}
export async function load(url,context,next){
 if(url.startsWith('file:') && /\.(ts|tsx)$/.test(url)){const source=fs.readFileSync(fileURLToPath(url),'utf8');return {format:'module',source:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true}}
 if(url.startsWith('file:') && url.endsWith('.json'))return {format:'module',source:'export default '+fs.readFileSync(fileURLToPath(url),'utf8'),shortCircuit:true}
 return next(url,context)
}
