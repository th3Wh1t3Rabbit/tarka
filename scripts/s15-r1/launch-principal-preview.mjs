import { mkdirSync, openSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const root = process.cwd()
const review = resolve(root, 'review/principal-playtest-1')
const port = '4174'
const url = `http://127.0.0.1:${port}/`
const sleep = milliseconds => new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds))
const listening = async () => { try { return (await fetch(url)).ok } catch { return false } }
const processes = () => readdirSync('/proc').filter(name => /^\d+$/.test(name)).flatMap(name => {
  try {
    return [{ pid: Number(name), cwd: readlinkSync(`/proc/${name}/cwd`), command: readFileSync(`/proc/${name}/cmdline`, 'utf8').replaceAll('\0', ' ') }]
  } catch { return [] }
})

if (await listening()) {
  const prior = processes().find(process => process.cwd === root && /vite.*preview|preview.*vite/.test(process.command))
  if (!prior) throw new Error(`Port ${port} is occupied by a process that is not a prior Tarka/Vite preview from this workspace`)
  process.kill(prior.pid, 'SIGTERM')
  for (let index = 0; index < 40 && await listening(); index += 1) await sleep(250)
  if (await listening()) throw new Error(`Prior workspace preview did not stop: ${prior.pid}`)
}

mkdirSync(review, { recursive: true })
const logPath = resolve(review, 'server.log')
const descriptor = openSync(logPath, 'w')
const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', port], { cwd: root, detached: true, stdio: ['ignore', descriptor, descriptor] })
child.unref()
writeFileSync(resolve(review, 'server.pid'), `${child.pid}\n`)
let healthy = false
for (let index = 0; index < 120; index += 1) { if (await listening()) { healthy = true; break }; await sleep(250) }
if (!healthy) { try { process.kill(child.pid, 'SIGTERM') } catch { /* The failed server already exited. */ }; throw new Error(`Principal preview failed readiness; inspect ${logPath}`) }
const receipt = { schemaVersion: 's15-r1-server-launch.v1', status: 'PASS_LIVE', url, pid: child.pid, logPath, healthCheck: 'HTTP_2XX', stopCommand: `kill "$(cat ${resolve(review, 'server.pid')})"`, userApprovedAlternatePort: 'EXPLICIT_USER_APPROVAL_2026-09-24', publicDeployment: false }
writeFileSync(resolve(review, 'server-launch.json'), `${JSON.stringify(receipt, null, 2)}\n`)
mkdirSync('artifacts/s15-r1/RECEIPTS', { recursive: true })
writeFileSync('artifacts/s15-r1/RECEIPTS/SERVER_LAUNCH.json', `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify(receipt))
