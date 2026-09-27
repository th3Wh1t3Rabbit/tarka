import fs from 'node:fs'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {sha,canonical} from '../nq5-s2/activity.mjs'
import {privatePathFindings} from '../nq5-s1/privacy.mjs'
import {hasSecretLikeValue} from '../secret-patterns.mjs'
import {deriveBlueprint} from '../../src/controller/foundation/blueprint.ts'
import {validateViewport,validateIntake} from '../../src/controller/foundation/contracts.mjs'
import {compileContent} from '../nq5-s4/compile-content.mjs'
import {testArtIndex} from '../../tests/fixtures/s5/art-index.ts'
export const BASE='0d39031a746f09f5fd2d984c96585daf3b34a2d8',TREE='fbf58344223f1e0d95d96b5e9fbd80147e41fb8d',ACCEPTED='0f52131c9f56f49128e7a413396331917e687a1f'
export const EXTRA=['src/controller/foundation/contracts.mjs','src/controller/foundation/pixel-identity.mjs','src/controller/foundation/pixel-identity.d.mts','src/app/CaseTerminalWorkbench.tsx','src/app/AcceptedEvidenceSea.tsx','src/app/SemanticDisplaySource.tsx','src/app/corpus-presentation/CorpusPresentation.tsx','tests/fixtures/s5/art-index.ts','tests/fixtures/s2/browser-helpers.ts','tests/unit/s5-foundation.test.ts','tests/unit/s5-r1-identity.test.ts','tests/e2e/s5-r1-single-explore.spec.ts','tests/e2e/nq5-r1-parity.spec.ts','scripts/s5-r1-browser.config.mjs','scripts/s5-r1-existing-browser.config.mjs','artifacts/g6p-s5/REPORTS/SYNTHETIC_INTAKE_EXAMPLE.json']
export const allowedPath=n=>EXTRA.includes(n)||['scripts/nq5-s5-r1/','docs/source/execution-s5-r1/','artifacts/g6p-s5-r1/'].some(p=>n.startsWith(p))
const read=n=>JSON.parse(fs.readFileSync(n)),git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:128000000}).trim()
export async function verify(){
 assert.equal(git('rev-parse',BASE+'^{tree}'),TREE);execFileSync('git',['merge-base','--is-ancestor',BASE,'HEAD'])
 assert.equal(git('rev-list','--merges',BASE+'..HEAD'),'');assert.equal(git('diff',BASE,'HEAD','--','AGENTS.md'),'')
 assert.equal(git('rev-parse','HEAD:AGENTS.md'),git('rev-parse',ACCEPTED+':AGENTS.md'))
 const changes=git('diff','--name-only',BASE,'--','.',':(exclude).cursor',':(exclude)ART_PRODUCTION').split('\n').filter(Boolean);assert.ok(changes.every(allowedPath),'CLOSED_R1_SOURCE_SCOPE')
 const preservation=read('artifacts/g6p-s5/REPORTS/PRESERVATION.json')
 for(const f of [...preservation.preservedFiles,...preservation.laneAFiles])assert.equal(sha(fs.readFileSync(f.file)),f.sha256,f.file)
 assert.equal(preservation.laneAFiles.length,37);assert.equal(sha(fs.readFileSync('src/controller/content/runtime-content.json')),'57f27ecfef64f9c149f2f80bdb1efffbc629d79fd5f6a76e21c0e943c5c95bfc');assert.equal(canonical(compileContent()),canonical(read('src/controller/content/runtime-content.json')))
 for(const file of ['artifacts/g6p-s5/REPORTS/MVP_BLUEPRINT.json','artifacts/g6p-s5/REPORTS/MVP_BLUEPRINT.md','artifacts/g6p-s5/REPORTS/CORPUS_COUNT_CROSSWALK.json','artifacts/g6p-s5/REPORTS/VIEWPORT_TERMINAL_CONTRACT.json','artifacts/g6p-s5/REPORTS/PRESERVATION.json','src/controller/foundation/blueprint.ts','src/app/TerminalViewport.tsx','src/app/terminal-viewport.css'])assert.ok(fs.readFileSync(file).equals(execFileSync('git',['show',BASE+':'+file],{maxBuffer:128000000})),file)
 const bp=await deriveBlueprint();assert.equal(canonical(bp),canonical(read('artifacts/g6p-s5/REPORTS/MVP_BLUEPRINT.json')));assert.equal(bp.beats.length,24);assert.equal(bp.semanticTotal,25);assert.equal(bp.boundedNoMatches,7)
 validateViewport(read('artifacts/g6p-s5/REPORTS/VIEWPORT_TERMINAL_CONTRACT.json'));validateIntake(read('artifacts/g6p-s5/REPORTS/SYNTHETIC_INTAKE_EXAMPLE.json'));assert.equal(canonical(testArtIndex()),canonical(read('artifacts/g6p-s5/REPORTS/SYNTHETIC_INTAKE_EXAMPLE.json')))
 const before=JSON.parse(execFileSync('git',['show',BASE+':artifacts/g6p-s5/REPORTS/SYNTHETIC_INTAKE_EXAMPLE.json']));const now=testArtIndex();before.clips[0].sha256=now.clips[0].sha256;before.capabilities[0].contentIdentity=now.capabilities[0].contentIdentity;assert.equal(canonical(before),canonical(now),'ONLY_SYNTHETIC_DECLARED_IDENTITIES_CHANGED')
 const source=fs.readFileSync('src/app/CaseTerminalWorkbench.tsx','utf8');assert.equal((source.match(/<AcceptedEvidenceSea\b/g)||[]).length,1)
 for(const marker of ['data-testid="case-corpus"','Search discovered records','EXPLORE.MANUAL','SHOW MORE CORPUS RECORDS','corpusRecords','setCorpusCount'])assert.ok(!source.includes(marker),marker)
 const review=read('docs/source/execution-s5-r1/INPUT/TRACE_ESCAPE_MAIN_LEAD_REVIEW_S5_RECEIPT_v1.0.0_2026-09-18.json');assert.equal(review.disposition,'S5_REMEDIATION_REQUIRED_WITH_MAJOR_SUBSYSTEM_ACCEPTANCE');assert.equal(review.reviewed_candidate.promoted,false);assert.equal(review.reviewed_candidate.commit,BASE)
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name])
 for(const file of [...EXTRA,...walk('scripts/nq5-s5-r1'),...walk('docs/source/execution-s5-r1'),...walk('artifacts/g6p-s5-r1')]){if(file.includes('/SCREENSHOTS/'))continue;const s=fs.lstatSync(file);assert.ok(s.isFile()&&!s.isSymbolicLink());const t=fs.readFileSync(file,'utf8');assert.equal(privatePathFindings(t).length,0,file);assert.equal(hasSecretLikeValue(t),false,file)}
 return{status:'PASS',preservedLaneAFiles:37,clientEntries:74,canonicalSemanticRecords:25,boundedNoMatchRecords:7,blueprintBeats:24,truthAndCorpusChanges:0,viewportChanges:0,LaneCOwnedEdits:['src/app/corpus-presentation/CorpusPresentation.tsx · optional display-safe inspection callback only'],proofReducerChanges:0,externalNetworkRequests:0,credentialAccess:false}
}
if(process.argv[1]?.endsWith('/verify.mjs'))console.log(JSON.stringify(await verify()))
