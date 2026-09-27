// Named, test-pinned safety caps for Pixel archive intake admission.
// Every cap is enforced before the corresponding resource is consumed.
// Values are conservative: orders of magnitude above an organized Pixel pack
// (tens to low hundreds of small PNGs, kilobytes each) while bounding
// memory, disk, and CPU against hostile input.
export const INTAKE_SAFETY_CAPS = Object.freeze({
  // Whole input file. A PNG-only art pack has no honest reason to approach this.
  MAX_ARCHIVE_BYTES: 256 * 1024 * 1024,
  // Central-directory member count (files + directories).
  MAX_MEMBERS: 4096,
  // Single member uncompressed size.
  MAX_MEMBER_UNCOMPRESSED_BYTES: 16 * 1024 * 1024,
  // Sum of member uncompressed sizes.
  MAX_TOTAL_UNCOMPRESSED_BYTES: 512 * 1024 * 1024,
  // Decoded path characters. Aligned with the intake contract safePath limit.
  MAX_PATH_CHARS: 240,
  // Full normalized UTF-8 path bytes. Keeps every segment below ordinary
  // filesystem component limits without measuring host-specific maxima.
  MAX_PATH_BYTES: 240,
  // Per-member uncompressed/compressed ratio guard (zip-bomb backstop).
  MAX_EXPANSION_RATIO: 100,
  // PNG decoder memory bounds (wider than the contract asset maximum of
  // 1920x1080; oversize-vs-declared is still reported as a mismatch).
  MAX_PNG_WIDTH: 4096,
  MAX_PNG_HEIGHT: 4096,
  MAX_PNG_PIXELS: 8 * 1024 * 1024,
  // Single PNG chunk data length.
  MAX_PNG_CHUNK_BYTES: 64 * 1024 * 1024,
})

export const SAFETY_CAP_RATIONALE = Object.freeze({
  MAX_ARCHIVE_BYTES: 'Bounds input read; 256 MiB exceeds any plausible organized PNG pack.',
  MAX_MEMBERS: 'Bounds central-directory walk; 4096 exceeds pack + index + directories.',
  MAX_MEMBER_UNCOMPRESSED_BYTES: 'Bounds per-member inflate output; 16 MiB exceeds any single frame PNG.',
  MAX_TOTAL_UNCOMPRESSED_BYTES: 'Bounds aggregate extraction; 512 MiB exceeds whole-pack expansion.',
  MAX_PATH_CHARS: 'Matches the intake contract safePath segment limit; blocks overlong-name games.',
  MAX_PATH_BYTES: 'Full-path UTF-8 bytes; keeps every segment below ordinary component limits.',
  MAX_EXPANSION_RATIO: 'Per-member zip-bomb backstop; honest PNG ratios stay far below 100.',
  MAX_PNG_WIDTH: 'Decoder memory bound; wider than any contract asset.',
  MAX_PNG_HEIGHT: 'Decoder memory bound; taller than any contract asset.',
  MAX_PNG_PIXELS: 'Bounds decoded RGBA allocation (~32 MiB worst case).',
  MAX_PNG_CHUNK_BYTES: 'Bounds single-chunk allocation; IDAT totals stay under member caps.',
})
