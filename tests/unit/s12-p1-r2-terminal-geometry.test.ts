import { describe, expect, it } from 'vitest'
import { scaledTerminalBox, TERMINAL_FRAME_GEOMETRY } from '../../src/adventure/terminalFrameGeometry'
import { readFileSync } from 'node:fs'

describe('S12-P1-R2 terminal frame geometry', () => {
  it('binds the content box to the accepted transparent opening', () => {
    expect(TERMINAL_FRAME_GEOMETRY.frame).toEqual({ width: 480, height: 270 })
    expect(TERMINAL_FRAME_GEOMETRY.alphaOpening).toEqual({ x: 44, y: 12, width: 393, height: 219 })
    expect(TERMINAL_FRAME_GEOMETRY.contentBox).toEqual(TERMINAL_FRAME_GEOMETRY.alphaOpening)
    expect(TERMINAL_FRAME_GEOMETRY.borderBox).toEqual({ x: 43, y: 11, width: 395, height: 221 })
    expect(scaledTerminalBox(TERMINAL_FRAME_GEOMETRY.borderBox, 2)).toMatchObject({ width: 790, height: 442 })
    expect(scaledTerminalBox(TERMINAL_FRAME_GEOMETRY.borderBox, 4)).toMatchObject({ width: 1580, height: 884 })
    expect(scaledTerminalBox(TERMINAL_FRAME_GEOMETRY.contentBox, 1)).toMatchObject({ width: 393, height: 219 })
    const css = readFileSync('src/app/terminal-viewport.css', 'utf8')
    expect(css).toContain('left:43px; top:11px; width:395px; height:221px; border:1px solid transparent')
  })
})
