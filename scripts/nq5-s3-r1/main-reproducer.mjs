import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import ts from 'typescript'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
const baseline=process.argv.includes('--baseline'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'s3r1-main-repro-')),put=(n,s)=>{const file=temp+'/'+n;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,s);return file}
const compile=(n,source)=>put(n,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)
put('package.json','{"type":"commonjs"}\n')
compile('investigation/query.js',fs.readFileSync('src/investigation/query.ts','utf8'))
compile('investigation/contracts.js',fs.readFileSync('src/investigation/contracts.ts','utf8'))
const contracts=compile('investigation/corpus-seam/contracts.js',fs.readFileSync(baseline?'docs/source/execution-s3-r1/BINDINGS/S3_REVIEWED_CONTRACTS.ts':'src/investigation/corpus-seam/contracts.ts','utf8'))
if(!baseline)put('investigation/corpus-seam/authority.mjs',fs.readFileSync('src/investigation/corpus-seam/authority.mjs'))
const script=put('MAIN_REPRO.cjs',fs.readFileSync('docs/source/execution-s3-r1/FINDING/S3_R1_SELF_SEALED_DISPLAY_RECORD_AUTHORITY_GAP_REPRO.js'))
const output=JSON.parse(execFileSync(process.execPath,[script,contracts,path.resolve('artifacts/g6p-s3/REPORTS/TE_IFACE_CORPUS_FINAL_CANDIDATE.json')],{encoding:'utf8'}))
const cases=[...output.recordMutationResults,...output.setMutationResults]
assert.equal(cases.length,9);assert.ok(cases.every(x=>x.accepted===baseline))
console.log(JSON.stringify(output,null,2))
console.log(JSON.stringify({status:baseline?'EXPECTED_BASELINE_FALSE_SUCCESS_REPRODUCED':'PASS_REMEDIATION',actualCases:9,accepted:baseline?9:0,rejected:baseline?0:9,compiledActualContracts:!baseline,originalReproducerBytesUnchanged:true,originalStatusAndConclusionAreFixedText:'Interpret actual accepted booleans, not the original fixed FALSE_SUCCESS_REPRODUCED literal.',adaptation:'Original .js bytes copied to owned temporary .cjs solely for CommonJS execution; TypeScript transpiled with installed locked compiler. No install, network or credential access.'}))
