import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
// Build-only AST inspection, never browser imports or execution of game modules.
function rawInitializer(file,name){
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
 let found;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(source)===name)found=n.initializer;ts.forEachChild(n,visit)}visit(source)
 assert.ok(found,'MISSING_CONSUMER_SOURCE_'+name)
 while(ts.isAsExpression(found)||ts.isParenthesizedExpression(found))found=found.expression
 return found
}
function initializer(file,name){
 let found=rawInitializer(file,name)
 if(ts.isCallExpression(found))found=found.arguments.find(ts.isArrayLiteralExpression)
 assert.ok(found&&ts.isArrayLiteralExpression(found),'UNRECOGNIZED_CONSUMER_SOURCE_'+name)
 return found.elements
}
const prop=(node,key)=>node.properties.find(p=>p.name?.getText().replace(/['"]/g,'')===key)?.initializer
export function consumerManifest(dead){
 const bindings={},add=(key,consumer)=>{assert.ok(!bindings[key]||bindings[key]===consumer);bindings[key]=consumer},series=(prefix,n,file)=>{for(let i=1;i<=n;i++)add(prefix+'.'+i,file)}
 series('lane_a.opening',initializer('src/adventure/content.ts','PROVISIONAL_OPENING').length,'src/adventure/content.ts opening')
 for(const rule of initializer('src/adventure/content.ts','usefulRules'))series('lane_a.puzzle.'+prop(rule,'id').text,prop(rule,'speech').elements.length,'src/adventure/content.ts usefulRules')
 const topic=initializer('src/adventure/content.ts','dialogueTopics').find(n=>prop(n,'id').text==='record');assert.ok(topic)
 series('lane_a.topic.record',prop(topic,'lines').elements.length,'src/adventure/content.ts mandatory record topic')
 for(const id of initializer('src/adventure/narrative.ts','RECORDS_OFFICE_BEAT_IDS'))add('lane_a.beat.'+id.text,'src/adventure/narrative.ts stable cue')
 for(const group of ['verb_fallbacks','looks','alternates','overrides','zero_results'])for(const item of dead[group]){if(group==='verb_fallbacks'&&item.verb==='LOOK_AT')continue;add(item.copy_key,'src/controller/content/adapter.ts '+(group==='overrides'?'alternates':group))}
 const recovery=rawInitializer('src/controller/content/adapter.ts','keys');assert.ok(ts.isObjectLiteralExpression(recovery))
 for(const p of recovery.properties){assert.ok(ts.isStringLiteral(p.initializer));add('lane_a.recovery.'+p.initializer.text,'src/controller/content/adapter.ts recoveryCopy')}
 for(const file of ['src/controller/content/adapter.ts','src/app/App.tsx','src/app/CaseTerminalWorkbench.tsx','src/adventure/narrative.ts']){
  const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(source)==='contentText'&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0]))add(n.arguments[0].text,file+' direct contentText');ts.forEachChild(n,visit)}visit(source)
 }
 return Object.fromEntries(Object.entries(bindings).sort(([a],[b])=>a.localeCompare(b)))
}
export function assertClosedClient(map,manifest){
 assert.deepEqual(Object.keys(map.entries).sort(),Object.keys(manifest).sort(),'CLIENT_CONSUMER_KEY_SET')
 assert.equal(map.compiledEntries,Object.keys(manifest).length)
 assert.equal(map.optionalIncluded,false);assert.equal(map.exactLiteralIncluded,false)
 for(const [key,e]of Object.entries(map.entries)){
  assert.ok(!/\.(theory|proof|conclusion|banter|performance|title)\./.test(key),'DEFERRED_CLIENT_KEY')
  assert.equal(e.optional,false);assert.notEqual(e.claimClass,'ACCEPTED_EXACT')
  for(const text of [e.text,e.fallback])assert.ok(!/IT JOINED THE SECOND ROUTE|THE FIRST TRAIL JOINED THE SECOND ROUTE|0x[a-f0-9]{40}|\b\d{2}:\d{2}(?::\d{2})?|\b\d+(?:\.\d+)?\s*(?:DAI|ETH)\b/i.test(text),'CLIENT_EXACT_OR_ANSWER_TEXT')
 }
 return true
}
