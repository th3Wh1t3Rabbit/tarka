import fs from 'node:fs'
import path from 'node:path'
import { assertAccountBootstrapAuthorized } from '../nq5-checkpoint-policy.mjs'

export function resolveApprovedCredential(offline, candidate, explicitSourcePath, environment = () => process.env) {
  // Calling the environment supplier or reading a source is forbidden before PASS.
  assertAccountBootstrapAuthorized(offline, candidate)
  const env = environment()
  if (env.NANSEN_API_KEY !== undefined) return env.NANSEN_API_KEY
  const file = env.TRACE_ESCAPE_NANSEN_CREDENTIAL_PATH ?? explicitSourcePath
  if (!file || !path.isAbsolute(file) || path.basename(file) !== 'NANSEN_API_KEY.txt') return null
  try {
    const stat = fs.lstatSync(file)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) return null
    return fs.readFileSync(file, 'utf8').trim()
  } catch { return null }
}
