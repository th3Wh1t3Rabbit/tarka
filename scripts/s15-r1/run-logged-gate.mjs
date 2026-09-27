import { createWriteStream, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'

const [name, command, ...args] = process.argv.slice(2)
if (!name || !command) throw new Error('Usage: run-logged-gate.mjs <name> <command> [...args]')
mkdirSync('artifacts/s15-r1/LOGS', { recursive: true })
const log = createWriteStream(`artifacts/s15-r1/LOGS/${name}.log`, { flags: 'w' })
const child = spawn(command, args, { env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } })
for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { process.stdout.write(chunk); log.write(chunk) })
child.on('error', error => { log.end(`${error.stack ?? error}\n`); throw error })
child.on('exit', (code, signal) => {
  log.end(`\nS15_R1_GATE name=${name} exit=${code ?? 'null'} signal=${signal ?? 'none'}\n`)
  process.exit(code ?? 1)
})
