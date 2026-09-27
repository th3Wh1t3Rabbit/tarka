import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {sha} from '../nq5-s2/activity.mjs'
const BASE='0f52131c9f56f49128e7a413396331917e687a1f'
const common=[
 'src/app/App.tsx','src/app/CaseTerminalWorkbench.tsx','src/app/AcceptedEvidenceSea.tsx',
 'src/app/TerminalViewport.tsx','src/app/terminal-viewport.css',
 'src/app/corpus-presentation/CorpusPresentation.tsx','src/app/corpus-presentation/corpus.css',
 'src/investigation/semantic-ux/model.ts','src/controller/corpus/input.ts',
 'src/controller/foundation/contracts.mjs','src/controller/foundation/contracts.d.mts',
 'src/controller/foundation/blueprint.ts','src/controller/foundation/useIntegerViewportScale.ts',
 'tests/fixtures/s5/art-index.ts','tests/unit/s5-foundation.test.ts',
 'tests/e2e/s5-integration.spec.ts','scripts/s5-browser.config.mjs',
]
const laneC=['src/app/corpus-presentation/harness.html','src/app/corpus-presentation/harness.tsx',
 'tests/unit/lane-c/model.test.ts','tests/unit/lane-c/vitest.config.ts',
 'tests/e2e/lane-c/corpus.spec.ts','tests/e2e/lane-c/playwright.config.ts','tests/e2e/lane-c/vite.config.ts']
export function buildPackets(root,candidate,put){
 const git=(...a)=>execFileSync('git',a,{cwd:root,maxBuffer:128000000})
 const prerequisiteFiles=['package.json','package-lock.json','src/controller/content/runtime-content.json',
  'src/investigation/state.ts','src/investigation/query.ts','src/investigation/fixture.ts',
  'src/investigation/corpus-seam/authority.mjs',
  'artifacts/g6p-s3/REPORTS/TE_IFACE_CORPUS_FINAL_CANDIDATE.json',
  'artifacts/g6p-s3/REPORTS/SYNTHETIC_SEMANTIC_FIXTURE.json',
  'public/scenarios/euler-2023-false-exit/scenario.json',
  'public/scenarios/euler-2023-false-exit/evidence-graph.json']
 const prerequisites=prerequisiteFiles.map(file=>({file,sha256:sha(git('show',BASE+':'+file))}))
 const reports=[]
 for(const lane of ['A','C']){
  const prefix='LANE_'+lane+'_PREPARED_NOT_SENT/',files=[...common,...(lane==='C'?laneC:[])].sort()
  const patch=git('diff','--binary',BASE,candidate.commit,'--',...files)
  const source=files.map(file=>({file,sha256:sha(git('show',candidate.commit+':'+file))}))
  for(const f of source)put(prefix+'SOURCE/'+f.file,git('show',candidate.commit+':'+f.file))
  put(prefix+'TARGETED_RECOVERY.patch',patch)
  const contract={schemaVersion:'1.0.0',lane,status:'PREPARED_NOT_SENT',packetsSent:false,
   providerRequests:0,candidate,requiresAcceptedBase:BASE,
   recoveryScope:'Targeted source/test subset only; does not reconstruct the full candidate tree. Full delivery incremental bundle provides exact whole-tree recovery.',
   acceptedLaneAAdditionsPreserved:37,compiledClientEntriesPreserved:74,canonicalSemanticRecords:25,
   semanticContextIsExactProof:false,prerequisites,files:source,patchSha256:sha(patch),
   commands:lane==='A'?['npm run typecheck','npm run build','node node_modules/vitest/vitest.mjs run tests/unit/s5-foundation.test.ts --maxWorkers=4','node node_modules/@playwright/test/cli.js test --config scripts/s5-browser.config.mjs']:
    ['npm run typecheck','npm run build','node node_modules/vitest/vitest.mjs run --config tests/unit/lane-c/vitest.config.ts','node node_modules/vite/bin/vite.js build --config tests/e2e/lane-c/vite.config.ts','node node_modules/@playwright/test/cli.js test --config tests/e2e/lane-c/playwright.config.ts','node node_modules/@playwright/test/cli.js test --config scripts/s5-browser.config.mjs'],
   instructions:'In a separate clean local checkout of the exact prerequisite, verify every prerequisite hash, apply TARGETED_RECOVERY.patch, compare SOURCE hashes, and use installed locked dependencies only. No registry/provider retrieval. Supplier runs immutable original Lane A37 contracts in their original isolated fixture, not by editing them. Preserve main accepted branch and all protected context.',
  }
  put(prefix+'TARGETED_REGRESSION_CONTRACT.json',contract)
  put(prefix+'README.md',`Lane ${lane}: PREPARED_NOT_SENT. No task or message has been dispatched. This is an engineering regression request, not MAIN acceptance or art approval. Run node VERIFY_PACKET.mjs in this directory to verify exact candidate/base/patch/source bindings without dependencies. See contract for separate local recovery and focused checks. Terminal states use the existing shared reducer; the25 accepted context records cannot supply exact proof. Production art is not included or approved.\n`)
  const hashes={...Object.fromEntries(source.map(f=>['SOURCE/'+f.file,f.sha256])),
   'TARGETED_RECOVERY.patch':sha(patch),'TARGETED_REGRESSION_CONTRACT.json':sha(JSON.stringify(contract,null,2)+'\n'),
   'README.md':sha(`Lane ${lane}: PREPARED_NOT_SENT. No task or message has been dispatched. This is an engineering regression request, not MAIN acceptance or art approval. Run node VERIFY_PACKET.mjs in this directory to verify exact candidate/base/patch/source bindings without dependencies. See contract for separate local recovery and focused checks. Terminal states use the existing shared reducer; the25 accepted context records cannot supply exact proof. Production art is not included or approved.\n`)}
  const verifier="import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';const root=path.dirname(fileURLToPath(import.meta.url)),pins="+JSON.stringify(hashes)+",expected="+JSON.stringify(contract)+";const sha=b=>createHash('sha256').update(b).digest('hex');const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name),s=fs.lstatSync(p);if(s.isSymbolicLink()||(!s.isDirectory()&&(!s.isFile()||s.nlink!==1)))throw Error('PACKET_NONREGULAR');return s.isDirectory()?walk(p):[path.relative(root,p).split(path.sep).join('/')]});if(JSON.stringify(walk(root).sort())!==JSON.stringify([...Object.keys(pins),'VERIFY_PACKET.mjs'].sort()))throw Error('PACKET_EXACT_MEMBERS');for(const[n,h]of Object.entries(pins))if(sha(fs.readFileSync(path.join(root,n)))!==h)throw Error('PACKET_PIN');const c=JSON.parse(fs.readFileSync(path.join(root,'TARGETED_REGRESSION_CONTRACT.json')));if(JSON.stringify(c)!==JSON.stringify(expected)||c.status!=='PREPARED_NOT_SENT'||c.packetsSent!==false||c.providerRequests!==0)throw Error('PACKET_AUTHORITY');console.log(JSON.stringify({status:'PASS',lane:c.lane,packetStatus:c.status,candidate:c.candidate,sourceFiles:c.files.length,recovery:'BASE_DEPENDENT_TARGETED_SUBSET_NOT_FULL_TREE'}));\n"
  put(prefix+'VERIFY_PACKET.mjs',verifier)
  reports.push({lane,status:contract.status,sourceFiles:files.length,patchSha256:sha(patch),candidate})
 }
 return reports
}
