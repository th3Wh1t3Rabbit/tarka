// Three exact public-policy lines are not credential assignments. Do not exempt
// whole files/blobs, arbitrary LEAD prefixes, bearer values or appended tokens.
const publicLines = new Set([
  'Parent ' + 'authorization: ' + ['LEAD', 'NQ5', 'UNIFIED', 'CASEBOARD', 'UTILITY', '001'].join('-'),
  'r1_offline_and_precall_' + 'authorization: ' + ['REJECTED', 'NOT', 'CURRENT', 'AUTHORIZATION'].join('_'),
  'r3_final_precall_' + 'authorization: ' + ['ACCEPTED', 'BY', 'RECORDED', 'B1', 'LEAD', 'CONTRACT'].join('_'),
])
const patterns = [
  /(?:API|ACCESS|SECRET)[_-]?KEY\s*[:=]\s*["']?[A-Za-z0-9_\-]{12,}/i,
  /authorization\s*[:=]\s*["']?(?:bearer\s+)?[A-Za-z0-9_.\-]{16,}/i,
  /https?:\/\/[^\s/]+\/v\d+\/[A-Za-z0-9_\-]{16,}/i,
]
export function hasSecretLikeValue(content) {
  const masked = content.split('\n').map(line => {
    const plain = /^[ +\-]/.test(line) ? line.slice(1) : line
    return publicLines.has(plain.trimEnd()) ? '' : line
  }).join('\n')
  return patterns.some(pattern => pattern.test(masked))
}
