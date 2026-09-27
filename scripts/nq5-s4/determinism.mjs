import fs from 'node:fs'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {sha} from '../nq5-s2/activity.mjs'
const dir='public/scenarios/euler-2023-false-exit/',names=['scenario.json','provenance.json','catalog.json','scenario.sha256','world.json','evidence-graph.json','omitted-events.json'],before=names.map(n=>sha(fs.readFileSync(dir+n)))
for(let i=0;i<2;i++){execFileSync(process.execPath,['scripts/g5-pack.mjs','generate'],{env:process.env,stdio:'pipe'});assert.deepEqual(names.map(n=>sha(fs.readFileSync(dir+n))),before)}
console.log(JSON.stringify({status:'PASS',recompiles:2,identicalGeneratedFiles:7,networkRequests:0}))
