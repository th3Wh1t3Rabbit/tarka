import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
export function implementationIdentity(root) {
  const names = execFileSync('git', ['ls-files', '--', '.', ':(exclude)ART_PRODUCTION', ':(exclude).cursor', ':(exclude)artifacts', ':(exclude)docs/G6P_A2U_R1_REVIEW.json', ':(exclude)docs/PROJECT_STATUS.yaml'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  const hash = createHash('sha256')
  for (const name of names.sort()) {
    const blob = execFileSync('git', ['rev-parse', `HEAD:${name}`], { cwd: root, encoding: 'utf8' }).trim()
    hash.update(`${name}\0${blob}\n`)
  }
  return hash.digest('hex')
}

export function assertAuthorityPreserved(root, baseline = '0fec4680efc7bfafc9d2d0497f54b26be733e234') {
  const tree = (ref) => execFileSync('git', ['ls-tree', '-r', ref, '--', 'docs/overlays'], { cwd: root, encoding: 'utf8' })
  if (tree('HEAD') !== tree(baseline)) throw new Error('Admitted historical authority changed; no account issue permitted.')
  return true
}
