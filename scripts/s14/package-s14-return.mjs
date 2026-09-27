import { createHash } from 'node:crypto'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`)
  return result.stdout.trim()
}
const commit = run('git', ['rev-parse', 'HEAD'])
const tree = run('git', ['rev-parse', 'HEAD^{tree}'])
const parent = run('git', ['rev-parse', 'HEAD^'])
if (parent !== 'ac7c67dbc7704ad147b831207e6e100a1fb15999') throw new Error('S14 candidate parent mismatch')
if (run('git', ['rev-list', '--parents', '-n', '1', 'HEAD']).split(/\s+/).length !== 2) throw new Error('S14 candidate is not a direct non-merge child')

const name = 'TRACE_ESCAPE_CURSOR_TO_MAIN_S14_R55_EXACT_COPY_AND_ENDING_PRODUCTION_BINDING_v1.0.0_2026-09-24'
const temporary = mkdtempSync(join(tmpdir(), 's14-return-'))
const stage = join(temporary, name)
mkdirSync(stage)
const put = (path, value) => { const target = join(stage, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, value) }
const copy = (from, to) => { const target = join(stage, to); mkdirSync(dirname(target), { recursive: true }); cpSync(resolve(root, from), target, { recursive: true }) }

const projection = JSON.parse(readFileSync('src/story/r55/generated/r55-production.json', 'utf8'))
const changedPaths = run('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']).split('\n').filter(Boolean)
const receipt = {
  schemaVersion: 's14-r55-return.v1',
  disposition: 'CANDIDATE_PENDING_CHATGPT_MAIN_LEAD_REVIEW',
  commit, tree, parent,
  changedPaths,
  authority: projection.authority,
  projection: { sha256: sha(readFileSync('src/story/r55/generated/r55-production.json')), payloadSha256: projection.projectionSha256, coverage: projection.coverage },
  archiveVerification: { deep: 'PASS', semantics: 'PASS', negativeTests: 12, archiveSha256: projection.authority.archiveSha256 },
  exactCopy: { a1: 'PASS_R43_VERBATIM_HASH_BOUND', haystack: true, hieroglyphs: false, missing: 0, duplicate: 0, fallbacks: 0 },
  e03: { tokens: [98, 3, 2], s13Funnel: [98, 98, 74, 3, 2, 1], dispatchGroups: ['98→98', '98→3', '3→1'] },
  brcg: { states: 4, resolution: 'MARKET_CONTEXT_AND_WHAT_THIS_PROVES', heroIsolation: 'PASS', payoff: 'ONE_TIME_BEFORE_HERO_CLOSE_ONLY' },
  ending: { confirmation: true, cancelPreservesStateAndFocus: true, exactlyOnceCommit: true, variants: ['DEFAULT', 'BRCG'], inputBlackout: true, persistentCompletion: true },
  mission02: { playable: false, staticStingerOnly: true },
  qualification: { unit: '51 passed, 1 skipped', browser: '3 passed', semanticProbes: '34/34 intended-reason rejections', typecheck: 'PASS', lint: 'PASS_WITH_ZERO_ERRORS_ZERO_WARNINGS', build: 'PASS', externalRuntimeRequests: 0 },
  notRun: ['full fresh Vitest suite (owned by S15)', 'full integrated browser matrix (owned by S15)'],
  expansionTrigger: 'NONE',
  excludedEffects: 0,
  nextGate: 'S15_READY_NOT_STARTED',
}
put('RETURN_RECEIPT.json', `${JSON.stringify(receipt, null, 2)}\n`)
put('CHANGED_PATHS.txt', `${changedPaths.join('\n')}\n`)
put('RECOVERY.md', `# S14 candidate recovery\n\nPrerequisite commit: \`${parent}\`.\n\nPreferred recovery: fetch the included \`GIT/s14-candidate.bundle\`, verify that its single candidate commit is \`${commit}\`, and inspect before moving any ref.\n\nPatch recovery: from an exact clean checkout at the prerequisite commit, apply \`GIT/s14-candidate.patch\` with binary support, then verify the resulting tree is \`${tree}\`.\n\nDo not apply to a different base, move a protected ref, deploy, publish, or treat this package as self-acceptance.\n`)
const coverage = ['event_key,owner,anchor,node_id,source_path,byte_start,byte_end,line_start,line_end']
for (const event of projection.events) for (const line of event.lines) coverage.push([event.key,event.owner,event.anchor,line.nodeId,line.source.path,line.source.byteStart,line.source.byteEnd,line.source.lineStart,line.source.lineEnd].map(value => `"${String(value).replaceAll('"','""')}"`).join(','))
put('RECEIPTS/R55_EXACT_COPY_COVERAGE.csv', `${coverage.join('\n')}\n`)
put('RECEIPTS/AUTHORITY_AND_PROJECTION.json', `${JSON.stringify({ authority: projection.authority, projectionSha256: projection.projectionSha256, coverage: projection.coverage }, null, 2)}\n`)
put('RECEIPTS/A1_E03_BRCG_ENDING.json', `${JSON.stringify({ a1: receipt.exactCopy, e03: receipt.e03, brcg: receipt.brcg, ending: receipt.ending, mission02: receipt.mission02 }, null, 2)}\n`)
copy('scripts/s14/build-r55-production-projection.mjs', 'TOOLS/build-r55-production-projection.mjs')
copy('scripts/s14/run-s14-negative-probes.mjs', 'TOOLS/run-s14-negative-probes.mjs')
copy('artifacts/s14-r55/LOGS', 'LOGS')
copy('artifacts/s14-r55/SCREENSHOTS', 'SCREENSHOTS')

const bundlePath = join(stage, 'GIT/s14-candidate.bundle')
mkdirSync(dirname(bundlePath), { recursive: true })
run('git', ['bundle', 'create', bundlePath, 'HEAD', `^${parent}`])
const patch = spawnSync('git', ['diff', '--binary', `${parent}..HEAD`], { cwd: root })
if (patch.status !== 0) throw new Error('Unable to create exact binary patch')
put('GIT/s14-candidate.patch', patch.stdout)

const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)])
const payload = files(stage).map(path => ({ path: relative(stage, path), sha256: sha(readFileSync(path)), bytes: statSync(path).size })).sort((a,b) => a.path.localeCompare(b.path))
put('MANIFEST.sha256', payload.map(item => `${item.sha256}  ${item.path}`).join('\n') + '\n')
const manifestSha = sha(readFileSync(join(stage, 'MANIFEST.sha256')))
const verifier = `#!/usr/bin/env python3\nimport hashlib,pathlib,sys\nroot=pathlib.Path(__file__).resolve().parent\nmanifest=root/'MANIFEST.sha256'\nexpected='${manifestSha}'\nif hashlib.sha256(manifest.read_bytes()).hexdigest()!=expected: raise SystemExit('FAIL_MANIFEST_IDENTITY')\nlisted={}\nfor row in manifest.read_text().splitlines():\n h,p=row.split('  ',1); listed[p]=h\nallowed=set(listed)|{'MANIFEST.sha256','VERIFY_S14_RETURN.py'}\nactual={str(p.relative_to(root)) for p in root.rglob('*') if p.is_file()}\nif actual!=allowed: raise SystemExit('FAIL_MEMBER_SET')\nfor p,h in listed.items():\n if hashlib.sha256((root/p).read_bytes()).hexdigest()!=h: raise SystemExit('FAIL_HASH '+p)\nprint('PASS_S14_RETURN',len(actual),'${commit}','${tree}')\n`
put('VERIFY_S14_RETURN.py', verifier)

const output = `/path/to/local-user/Downloads/${name}.zip`
const zipped = spawnSync('zip', ['-X', '-q', '-r', output, name], { cwd: temporary, encoding: 'utf8' })
if (zipped.status !== 0) throw new Error(zipped.stderr)
const memberCount = Number(run('python3', ['-c', `import zipfile;print(len(zipfile.ZipFile('${output}').infolist()))`]))
console.log(JSON.stringify({ output, sha256: sha(readFileSync(output)), bytes: statSync(output).size, members: memberCount, commit, tree, parent, changedPaths: changedPaths.length }))
