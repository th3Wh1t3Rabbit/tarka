import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { redactPrivatePaths, resolveCredentialSource, resolvePrivateStoreRoot, writeJsonExclusive } from '../../scripts/acquisition/common.js'
import { reserveExecutableInputs } from '../../scripts/acquisition/g5-bybit-reserve.js'
import { closureExecutableInputs } from '../../scripts/acquisition/g5-euler-closure.js'

describe('explicit acquisition runtime configuration', () => {
  const outside = path.resolve(process.cwd(), '..', 'private-fixture')

  it('requires an explicit absolute private store outside the repository', () => {
    expect(() => resolvePrivateStoreRoot([], {})).toThrow(/explicitly configured/)
    expect(() => resolvePrivateStoreRoot(['--private-store-root', 'relative'], {})).toThrow(/absolute path/)
    expect(() => resolvePrivateStoreRoot(['--private-store-root', process.cwd()], {})).toThrow(/outside the repository/)
    expect(resolvePrivateStoreRoot(['--private-store-root', outside], {})).toBe(outside)
    expect(resolvePrivateStoreRoot([], { TRACE_ESCAPE_PRIVATE_STORE_ROOT: outside })).toBe(outside)
  })

  it('fails closed on conflicting store configuration', () => {
    expect(() => resolvePrivateStoreRoot(['--private-store-root', outside], { TRACE_ESCAPE_PRIVATE_STORE_ROOT: `${outside}-other` })).toThrow(/conflicts/)
  })

  it('selects exactly one credential source without reading its value', () => {
    const credential = path.join(mkdtempSync(path.join(os.tmpdir(), 'trace-credential-')), 'NANSEN_API_KEY.txt')
    writeFileSync(credential, 'fixture-only')
    expect(resolveCredentialSource(['--credential-file', credential], {})).toEqual({ kind: 'EXPLICIT_FILE', path: credential })
    expect(resolveCredentialSource(['--credential-env', 'NANSEN_API_KEY'], {})).toEqual({ kind: 'ENVIRONMENT', identifier: 'NANSEN_API_KEY' })
    expect(resolveCredentialSource([], {})).toBeNull()
    expect(() => resolveCredentialSource(['--credential-file', credential, '--credential-env', 'NANSEN_API_KEY'], {})).toThrow(/exactly one/)
    expect(() => resolveCredentialSource(['--credential-file', '/private/credential.txt'], {})).toThrow(/named NANSEN_API_KEY/)
    expect(() => resolveCredentialSource(['--credential-env', 'PROVIDER_CREDENTIAL'], {})).toThrow(/must be NANSEN_API_KEY/)
  })

  it('rejects canonical private-store and credential paths that enter the repository through symlinks', () => {
    const repositoryTarget = path.join(process.cwd(), '.runtime-config-symlink-target')
    const outsideRoot = mkdtempSync(path.join(os.tmpdir(), 'trace-symlink-'))
    try {
      mkdirSync(repositoryTarget, { recursive: true })
      const storeLink = path.join(outsideRoot, 'store-link')
      symlinkSync(repositoryTarget, storeLink)
      expect(() => resolvePrivateStoreRoot(['--private-store-root', storeLink], {})).toThrow(/outside the repository/)

      const repositoryCredential = path.join(repositoryTarget, 'NANSEN_API_KEY.txt')
      writeFileSync(repositoryCredential, 'fixture-only')
      const credentialLink = path.join(outsideRoot, 'NANSEN_API_KEY.txt')
      symlinkSync(repositoryCredential, credentialLink)
      expect(() => resolveCredentialSource(['--credential-file', credentialLink], {})).toThrow(/outside the repository/)
    } finally {
      rmSync(repositoryTarget, { recursive: true, force: true })
      rmSync(outsideRoot, { recursive: true, force: true })
    }
  })

  it('redacts configured private roots from public structures', () => {
    expect(redactPrivatePaths({ primary: `${outside}/primary/raw/object.json.gz` }, outside)).toEqual({ primary: '<PRIVATE_STORE>/primary/raw/object.json.gz' })
  })

  it('writes authorization evidence once and refuses overwrite', async () => {
    const target = path.join(mkdtempSync(path.join(os.tmpdir(), 'trace-write-once-')), 'authorization.json')
    await writeJsonExclusive(target, { authorized: true })
    await expect(writeJsonExclusive(target, { authorized: false })).rejects.toMatchObject({ code: 'EEXIST' })
  })

  it('binds both G5 authorizations to the complete executable acquisition boundary', () => {
    const mandatory = [
      'scripts/acquisition/common.ts', 'src/acquisition/contracts.ts', 'src/acquisition/integrity/credential.ts',
      'src/acquisition/integrity/governor.ts', 'src/acquisition/integrity/identity.ts',
      'src/acquisition/integrity/ledger.ts', 'src/acquisition/integrity/retry.ts',
      'src/acquisition/integrity/store.ts', 'src/acquisition/live/executor.ts', 'src/acquisition/live/transport.ts',
    ]
    expect(closureExecutableInputs).toEqual(expect.arrayContaining(mandatory))
    expect(reserveExecutableInputs).toEqual(expect.arrayContaining([...mandatory, 'scripts/acquisition/g4a-audition.ts']))
  })
})
