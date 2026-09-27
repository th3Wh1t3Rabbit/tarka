import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'

const [name, command, ...args] = process.argv.slice(2)
if (!/^[a-z0-9-]+$/.test(name)) throw new Error('INVALID_LOG_NAME')
const root = process.cwd()
const environment = {
  ...process.env,
  PATH: path.join(root, 'node_modules/.bin') + path.delimiter + process.env.PATH,
  LANG: 'C.UTF-8', TZ: 'UTC', TMPDIR: process.env.TMPDIR || os.tmpdir(), CI: '1', NO_COLOR: '1',
  PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH,
}
const result = spawnSync(command, args, { cwd: root, env: environment, encoding: 'utf8', maxBuffer: 128_000_000 })
const scrub = (value) => value.split(root).join('[CONTROLLER_ROOT]').split(os.homedir()).join('[LOCAL_HOME]').split(environment.TMPDIR).join('[LOCAL_VERIFICATION_ROOT]').replace(/\u001b\[[0-9;]*m/g, '')
const output = scrub((result.stdout || '') + (result.stderr || '')) + `\nEXIT_CODE=${result.status}\n`
const destination = path.join('artifacts/g6p-s7-r3/LOGS', name + '.log')
fs.mkdirSync(path.dirname(destination), { recursive: true })
fs.writeFileSync(destination, output)
console.log(JSON.stringify({ log: name, status: result.status === 0 ? 'PASS' : 'STOPPED_ATTEMPT', exitCode: result.status, bytes: Buffer.byteLength(output) }))
process.exitCode = result.status === 0 ? 0 : 1
