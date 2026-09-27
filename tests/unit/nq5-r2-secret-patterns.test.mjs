import { describe, expect, it } from 'vitest'
import { hasSecretLikeValue } from '../../scripts/secret-patterns.mjs'
const id = ['LEAD', 'NQ5', 'UNIFIED', 'CASEBOARD', 'UTILITY', '001'].join('-'), disposition = ['REJECTED', 'NOT', 'CURRENT', 'AUTHORIZATION'].join('_')
const publicLines = ['Parent ' + 'authorization: ' + id, 'r1_offline_and_precall_' + 'authorization: ' + disposition]
const fixtureToken = ['SYNTHETIC', 'SECRET', 'CONTROL', 'NOT_REAL'].join('_')
describe('R2 exact public policy labels never mask credential controls', () => {
  it.each(['', '+', '-', ' '])('allows only whole exact public lines including source diff prefix:%s', prefix => { expect(hasSecretLikeValue(publicLines.map(line => prefix + line).join('\n'))).toBe(false) })
  it.each(publicLines.map((_, index) => index))('rejects appended token or altered public label:%s', index => { expect(hasSecretLikeValue(publicLines[index] + fixtureToken)).toBe(true); expect(hasSecretLikeValue(publicLines[index] + ' extra')).toBe(true); expect(hasSecretLikeValue(publicLines[index].replace('authorization:', 'authorization='))).toBe(true) })
  it('does not mask bearer headers, different contexts, other assignments or neighboring secrets', () => { const header = 'authorization' + ': Bearer ' + fixtureToken, assignment = ['API', 'KEY'].join('_') + '=' + fixtureToken; for (const value of [header, assignment, 'authorization' + ': ' + id, 'https://example.invalid/v2/' + fixtureToken, publicLines.join('\n') + '\n' + header]) expect(hasSecretLikeValue(value)).toBe(true) })
})
