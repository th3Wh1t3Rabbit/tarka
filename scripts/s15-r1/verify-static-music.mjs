import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const files = root => readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(root, entry.name)) : [join(root, entry.name)])
const publicFiles = files('public')
const music = publicFiles.filter(path => /\.(?:ogg|mp3|wav|m4a|aac|flac)$/i.test(path))
const expectedAssets = [
  { path: 'public/audio/background-main.ogg', bytes: 1667977, sha256: '397e90e3ccae86acf986cf3e424c8c396b3c15cedab7ae7411d14c8900430e42', role: 'OFFICE_BACKGROUND', durationSeconds: 180.930583, codec: 'opus', sampleRate: 48000, channels: 2 },
  { path: 'public/audio/background-terminal.ogg', bytes: 1119859, sha256: 'e5ed7b7d320761a694193d7edc00f0ffe640ef87a43ac0e02f9097806f18a5f4', role: 'TERMINAL_BACKGROUND', durationSeconds: 117.07825, codec: 'opus', sampleRate: 48000, channels: 2 },
  { path: 'public/audio/case-closed.ogg', bytes: 1542299, sha256: 'e7dba70584c81831796807fbe375b063a05a454e708e65e635eabbafe3d68e9c', role: 'CASE_CLOSED_BACKGROUND', durationSeconds: 170.377125, codec: 'opus', sampleRate: 48000, channels: 2 },
  { path: 'public/audio/degauss-sfx.mp3', bytes: 50304, sha256: '03f2bae5ec4a4536b021698c62204822d77c227746f87a11f07292c1533ac9f7', role: 'DEGAUSS_SFX', durationSeconds: 3.144, codec: 'mp3', sampleRate: 48000, channels: 2 },
]
const actualPaths = music.map(path => relative('.', path)).sort()
const expectedPaths = expectedAssets.map(asset => asset.path).sort()
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) throw new Error(`Expected exactly the four production audio assets; found ${actualPaths.join(', ')}`)
const assets = expectedAssets.map(asset => {
  const bytes = readFileSync(asset.path)
  if (sha256(bytes) !== asset.sha256 || statSync(asset.path).size !== asset.bytes) throw new Error(`${asset.role} identity changed`)
  const builtPath = asset.path.replace(/^public\//, 'dist/')
  const builtSha256 = sha256(readFileSync(builtPath))
  if (builtSha256 !== asset.sha256) throw new Error(`${asset.role} built identity changed`)
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', asset.path], { encoding: 'utf8' })
  if (probe.status !== 0) throw new Error(`${asset.role} failed decode probe: ${probe.stderr}`)
  const decoded = JSON.parse(probe.stdout)
  const stream = decoded.streams?.[0]
  const durationSeconds = Number(decoded.format?.duration)
  if (stream?.codec_name !== asset.codec || Number(stream?.sample_rate) !== asset.sampleRate || Number(stream?.channels) !== asset.channels || Math.abs(durationSeconds - asset.durationSeconds) > 0.001) throw new Error(`${asset.role} decode identity changed`)
  return { ...asset, builtPath, builtSha256, decodeOk: true, decodedDurationSeconds: durationSeconds }
})
const receipt = { schemaVersion: 'tarka.static-audio.v2', status: 'PASS', publicFileCount: publicFiles.length, audioAssetCount: assets.length, assets, sourceClass: 'PROJECT_OWNER_CREATED', licenseStatus: 'CLEARED_BY_OWNER', publicDeploymentBlocked: false }
mkdirSync('review/s16-r1', { recursive: true })
writeFileSync('review/s16-r1/AUDIO_ASSET_RECEIPT.json', `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify(receipt))
