import { existsSync, realpathSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { JsonValue } from '../../src/acquisition/contracts.js'
import type { ExplicitCredentialSource } from '../../src/acquisition/integrity/credential.js'

export const repositoryRoot = process.cwd()

function canonicalFuturePath(target: string): string {
  let ancestor = path.resolve(target)
  while (!existsSync(ancestor)) {
    const parent = path.dirname(ancestor)
    if (parent === ancestor) break
    ancestor = parent
  }
  const canonicalAncestor = realpathSync(ancestor)
  return path.resolve(canonicalAncestor, path.relative(ancestor, path.resolve(target)))
}

function assertOutsideRepository(target: string, label: string): void {
  const canonicalRepository = realpathSync(repositoryRoot)
  const relative = path.relative(canonicalRepository, canonicalFuturePath(target))
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) throw new Error(`${label} must remain outside the repository`)
}

export function getArgument(name: string, required = false): string | null {
  const index = process.argv.indexOf(name)
  const value = index >= 0 ? process.argv[index + 1] : undefined
  if (required && (!value || value.startsWith('--'))) throw new Error(`Missing required ${name} argument`)
  return value && !value.startsWith('--') ? value : null
}

export function resolveRepositoryPath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(repositoryRoot, value)
}

function configuredValue(flag: string, environmentName: string, argv: string[], environment: NodeJS.ProcessEnv): string | null {
  const flagIndex = argv.indexOf(flag)
  const flagValue = flagIndex >= 0 ? argv[flagIndex + 1] : undefined
  if (flagIndex >= 0 && (!flagValue || flagValue.startsWith('--'))) throw new Error(`Missing required value for ${flag}`)
  const environmentValue = environment[environmentName]
  if (flagValue && environmentValue && path.resolve(flagValue) !== path.resolve(environmentValue)) throw new Error(`${flag} conflicts with ${environmentName}`)
  return flagValue ?? environmentValue ?? null
}

export function resolvePrivateStoreRoot(argv = process.argv.slice(2), environment = process.env): string {
  const configured = configuredValue('--private-store-root', 'TRACE_ESCAPE_PRIVATE_STORE_ROOT', argv, environment)
  if (configured === null || configured.trim() === '') throw new Error('Private store root must be explicitly configured with --private-store-root or TRACE_ESCAPE_PRIVATE_STORE_ROOT')
  if (!path.isAbsolute(configured)) throw new Error('Private store root must be an absolute path')
  const resolved = canonicalFuturePath(configured)
  assertOutsideRepository(resolved, 'Private store root')
  return resolved
}

export function resolveCredentialSource(argv = process.argv.slice(2), environment = process.env): ExplicitCredentialSource {
  const file = configuredValue('--credential-file', 'TRACE_ESCAPE_CREDENTIAL_FILE', argv, environment)
  const environmentName = getNamedArgument(argv, '--credential-env')
  if (file !== null && environmentName !== null) throw new Error('Configure exactly one credential source')
  if (file !== null) {
    if (!path.isAbsolute(file)) throw new Error('Credential file must be an absolute path')
    if (path.basename(file) !== 'NANSEN_API_KEY.txt') throw new Error('Credential file must be named NANSEN_API_KEY.txt')
    const resolved = canonicalFuturePath(file)
    assertOutsideRepository(resolved, 'Credential file')
    return { kind: 'EXPLICIT_FILE', path: resolved }
  }
  if (environmentName !== null) {
    if (environmentName !== 'NANSEN_API_KEY') throw new Error('Credential environment source must be NANSEN_API_KEY')
    return { kind: 'ENVIRONMENT', identifier: environmentName }
  }
  return null
}

function getNamedArgument(argv: string[], name: string): string | null {
  const index = argv.indexOf(name)
  if (index < 0) return null
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`Missing required value for ${name}`)
  return value
}

export function redactPrivatePaths<T>(value: T, privateRoot: string): T {
  const serialized = JSON.stringify(value)
  return JSON.parse(serialized.split(privateRoot).join('<PRIVATE_STORE>')) as T
}

export function resolveLexicallyContainedPath(value: string, allowedRoot: string): string {
  const requestedRoot = resolveRepositoryPath(allowedRoot)
  const requestedCandidate = resolveRepositoryPath(value)
  const requestedRelative = path.relative(requestedRoot, requestedCandidate)
  if (requestedRelative === '' || requestedRelative.startsWith('..') || path.isAbsolute(requestedRelative)) throw new Error(`Input must be contained by ${allowedRoot}`)
  return requestedCandidate
}

export async function resolveContainedJsonFile(value: string, allowedRoot: string): Promise<string> {
  const requestedRoot = resolveRepositoryPath(allowedRoot)
  const requestedCandidate = resolveLexicallyContainedPath(value, allowedRoot)
  const root = await realpath(requestedRoot)
  const candidate = await realpath(requestedCandidate)
  const relative = path.relative(root, candidate)
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Input must be contained by ${allowedRoot}`)
  if (path.extname(candidate).toLowerCase() !== '.json' || !(await stat(candidate)).isFile()) throw new Error('Input must be a regular JSON file')
  return candidate
}

export async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(resolveRepositoryPath(file), 'utf8')) as T
}

export async function writeJson(file: string, value: JsonValue | object): Promise<void> {
  const target = resolveRepositoryPath(file)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function writeJsonExclusive(file: string, value: JsonValue | object): Promise<void> {
  const target = resolveRepositoryPath(file)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
}

export function assertCleanGitInputs(files: string[]): void {
  const status = execFileSync('git', ['status', '--porcelain=v1', '--', ...files], { encoding: 'utf8' }).trim()
  if (status !== '') throw new Error('Executable acquisition inputs must be committed and clean before authorization')
}

export function printReport(report: object): void {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

export function fail(error: unknown): never {
  const message = error instanceof Error ? error.message : 'Unknown acquisition command failure'
  process.stderr.write(`FAILED: ${message}\n`)
  process.exit(1)
}
