import { describe, expect, it } from 'vitest'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import { buildRuntimeSession } from '../../src/adventure/runtimeSession'
import { productionComposition } from '../../src/adventure/layout6Production'
import type { AdventureState } from '../../src/adventure/types'

const session = buildRuntimeSession(productionComposition)
const targets = ['official-case-file-cabinet', 'nansen-terminal', 'window', 'office-globe'] as const

function look(state: AdventureState, id: string) {
  return adventureReducer(adventureReducer(state, { type: 'SELECT_VERB', verb: 'LOOK_AT' }), { type: 'INTERACT', targetId: id as typeof targets[number] })
}

function fresh(position: { x: number; y: number }) {
  return { ...createInitialAdventureState({ skipIntro: true, session }), rookPosition: position, rookFacing: 'RIGHT' as const }
}

describe('S12-P2-R3 target-center look matrix', () => {
  it.each(targets)('%s measures distance to the center from every side', (id) => {
    const target = session.targets[id]!
    const range = target.lookRange ?? 150
    const center = { x: target.centerX, y: target.centerY }
    const outside = [
      { name: 'left', x: center.x - range - 80, y: center.y },
      { name: 'right', x: center.x + range + 80, y: center.y },
      { name: 'above', x: center.x, y: center.y - range - 80 },
      { name: 'below', x: center.x, y: center.y + range - 0 + 80 },
    ]
    for (const point of outside) {
      const next = look(fresh(point), id)
      expect(next.speech, point.name).toBeNull()
      expect(next.nonblockingSpeech, point.name).toBeNull()
      expect(next.walk, point.name).not.toBeNull()
      const arrived = adventureReducer(next, { type: 'WALK_TICK', delta: 8000 })
      expect(arrived.walk, point.name).toBeNull()
      expect(arrived.nonblockingSpeech ?? arrived.speech, point.name).not.toBeNull()
      if (point.x !== center.x) expect(next.rookFacing).toBe(center.x < point.x ? 'LEFT' : 'RIGHT')
    }
    const inside = look(fresh({ x: center.x + 8, y: center.y }), id)
    expect(inside.walk).toBeNull()
    expect(inside.nonblockingSpeech ?? inside.speech).not.toBeNull()
    expect(inside.rookFacing).toBe('LEFT')
    const dist = Math.hypot(center.x - (center.x - range - 80), center.y - center.y)
    const travel = dist - range
    const stand = { x: (center.x - range - 80) + travel, y: center.y }
    const exact = look(fresh(stand), id)
    expect(exact.walk).toBeNull()
    expect(exact.nonblockingSpeech ?? exact.speech).not.toBeNull()
  })

  it('a newer command before arrival cancels the old look speech', () => {
    const cabinet = session.targets['official-case-file-cabinet']!
    const started = look(fresh({ x: cabinet.centerX - 400, y: 350 }), 'official-case-file-cabinet')
    expect(started.walk?.pendingInteraction?.targetId).toBe('official-case-file-cabinet')
    const replaced = look(started, 'window')
    expect(replaced.walk?.pendingInteraction?.targetId).toBe('window')
    const arrived = adventureReducer(replaced, { type: 'WALK_TICK', delta: 8000 })
    const text = (arrived.nonblockingSpeech ?? arrived.speech)?.lines.map((line) => line.text).join(' ') ?? ''
    expect(text).toContain('A window.')
    expect(text).not.toContain('Labeled case files')
  })

  it('a hidden target does not walk or speak', () => {
    const hidden = {
      ...session,
      targets: { ...session.targets, window: { ...session.targets.window!, visible: false } },
    }
    const state = { ...createInitialAdventureState({ skipIntro: true, session: hidden }), rookPosition: { x: 100, y: 350 } }
    const next = look(state, 'window')
    expect(next.walk).toBeNull()
    expect(next.speech).toBeNull()
    expect(next.nonblockingSpeech).toBeNull()
  })
})
