export interface ExplicitCredentialSources {
  environmentValue?: string | null
  fileValue?: string | null
}

export interface CredentialPresence {
  status: 'ABSENT' | 'PRESENT' | 'CONFLICT' | 'INVALID'
  source: 'NONE' | 'ENVIRONMENT' | 'EXPLICIT_FILE' | 'MULTIPLE'
  redacted: true
}

export type ExplicitCredentialSource =
  | { kind: 'ENVIRONMENT'; identifier: string }
  | { kind: 'EXPLICIT_FILE'; path: string }
  | null

export interface CredentialStatusReaders {
  readEnvironment: (identifier: string) => string | null | undefined | Promise<string | null | undefined>
  readFile: (path: string) => string | null | undefined | Promise<string | null | undefined>
}

export interface CredentialUseResult<T> {
  presence: CredentialPresence
  value?: T
}

function classify(value: string | null | undefined): 'ABSENT' | 'PRESENT' | 'INVALID' {
  if (value === null || value === undefined || value.trim() === '') return 'ABSENT'
  if (/\r|\n|\0/.test(value)) return 'INVALID'
  return 'PRESENT'
}

/**
 * Inspects caller-injected values only. This module intentionally has no access
 * to process.env or the filesystem, so G3 cannot resolve a real credential.
 */
export function inspectExplicitCredentialSource(sources: ExplicitCredentialSources): CredentialPresence {
  const environment = classify(sources.environmentValue)
  const file = classify(sources.fileValue)

  if (environment === 'INVALID' || file === 'INVALID') {
    return { status: 'INVALID', source: environment === 'INVALID' && file === 'INVALID' ? 'MULTIPLE' : environment === 'INVALID' ? 'ENVIRONMENT' : 'EXPLICIT_FILE', redacted: true }
  }

  if (environment === 'PRESENT' && file === 'PRESENT') {
    return { status: 'CONFLICT', source: 'MULTIPLE', redacted: true }
  }

  if (environment === 'PRESENT') return { status: 'PRESENT', source: 'ENVIRONMENT', redacted: true }
  if (file === 'PRESENT') return { status: 'PRESENT', source: 'EXPLICIT_FILE', redacted: true }
  return { status: 'ABSENT', source: 'NONE', redacted: true }
}

/**
 * Prepared CLI/server boundary for a future authorized gate. The caller must
 * inject both the explicit source selector and its readers. G3 supplies neither
 * ambient environment nor filesystem access here, and failures are redacted.
 */
export async function resolveExplicitCredentialStatus(
  source: ExplicitCredentialSource,
  readers: CredentialStatusReaders,
): Promise<CredentialPresence> {
  if (source === null) return { status: 'ABSENT', source: 'NONE', redacted: true }

  if (source.kind === 'ENVIRONMENT') {
    if (!source.identifier.trim()) return { status: 'INVALID', source: 'ENVIRONMENT', redacted: true }
    try {
      const value = await readers.readEnvironment(source.identifier)
      return inspectExplicitCredentialSource({ environmentValue: value ?? null })
    } catch {
      return { status: 'INVALID', source: 'ENVIRONMENT', redacted: true }
    }
  }

  if (!source.path.trim()) return { status: 'INVALID', source: 'EXPLICIT_FILE', redacted: true }
  try {
    const value = await readers.readFile(source.path)
    return inspectExplicitCredentialSource({ fileValue: value ?? null })
  } catch {
    return { status: 'INVALID', source: 'EXPLICIT_FILE', redacted: true }
  }
}

/** Keeps the raw credential inside a caller-provided callback and returns only
 * redacted status plus the callback result. Errors are intentionally sanitized. */
export async function withExplicitCredential<T>(
  source: ExplicitCredentialSource,
  readers: CredentialStatusReaders,
  consumeCredential: (credential: string) => Promise<T>,
): Promise<CredentialUseResult<T>> {
  if (source === null) return { presence: { status: 'ABSENT', source: 'NONE', redacted: true } }
  let raw: string | null | undefined
  try {
    raw = source.kind === 'ENVIRONMENT'
      ? await readers.readEnvironment(source.identifier)
      : await readers.readFile(source.path)
  } catch {
    return {
      presence: { status: 'INVALID', source: source.kind, redacted: true },
    }
  }
  const presence = source.kind === 'ENVIRONMENT'
    ? inspectExplicitCredentialSource({ environmentValue: raw ?? null })
    : inspectExplicitCredentialSource({ fileValue: raw ?? null })
  if (presence.status !== 'PRESENT' || raw === null || raw === undefined) return { presence }
  return { presence, value: await consumeCredential(raw) }
}
