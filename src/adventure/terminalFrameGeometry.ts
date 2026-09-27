/** Accepted Core v2.1 terminal frame. Content sits in the transparent opening. */
export const TERMINAL_FRAME_GEOMETRY = {
  frame: { width: 480, height: 270 },
  alphaOpening: { x: 44, y: 12, width: 393, height: 219 },
  contentBox: { x: 44, y: 12, width: 393, height: 219 },
  borderBox: { x: 43, y: 11, width: 395, height: 221 },
  border: 1,
} as const

export function scaledTerminalBox(box: { x: number; y: number; width: number; height: number }, scale: number) {
  return { x: box.x * scale, y: box.y * scale, width: box.width * scale, height: box.height * scale }
}
