#!/usr/bin/env node
// Pixel archive intake admission CLI (review-only, offline).
// Usage: node scripts/pixel-intake.mjs <archive.zip> [--out packet.json]
// Exit 0 with a canonical packet on stdout (or file) for every intake
// outcome, including HOLD_WITH_EVIDENCE. Exit 2 on usage/IO errors.
// Never activates, selects, or copies production art.
import { promises as fs } from 'node:fs'
import { renderPacket, runIntake } from '../src/controller/foundation/pixel-intake/intake-runner.mjs'

async function main(argv) {
  const args = argv.filter((a) => a !== '--help' && a !== '-h')
  const outFlag = args.indexOf('--out')
  let outPath = null
  if (outFlag !== -1) {
    outPath = args[outFlag + 1] ?? null
    args.splice(outFlag, outPath === null ? 1 : 2)
  }
  if (argv.includes('--help') || argv.includes('-h') || args.length !== 1 || outPath === null && outFlag !== -1) {
    process.stderr.write('Usage: node scripts/pixel-intake.mjs <archive.zip> [--out packet.json]\n')
    return 2
  }
  try {
    const packet = await runIntake(args[0])
    const text = renderPacket(packet)
    if (outPath !== null) await fs.writeFile(outPath, text, { mode: 0o600 })
    else process.stdout.write(text)
    return 0
  } catch (error) {
    process.stderr.write(`INTAKE_ERROR: ${error instanceof Error ? error.message : String(error)}\n`)
    return 2
  }
}

process.exitCode = await main(process.argv.slice(2))
