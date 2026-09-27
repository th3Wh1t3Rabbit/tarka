import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { APPROACH_GAP } from '../../src/adventure/sceneComposition'
import { targetApproach } from '../../src/adventure/interactionGeometry'
import { productionComposition } from '../../src/adventure/layout6Production'
import { adventureReducer, createInitialAdventureState } from '../../src/adventure/reducer'
import { buildRuntimeSession, walkPointForTarget } from '../../src/adventure/runtimeSession'
import { WALK_Y_MAX, WALK_Y_MIN } from '../../src/adventure/scenes'

describe('S12-P2B spatial facing and target geometry', () => {
  it('moves the far walk boundary five pixels closer and leaves the near boundary', () => {
    expect(WALK_Y_MIN).toBe(340)
    expect(WALK_Y_MAX).toBe(365)
    expect(APPROACH_GAP).toBe(14)
    expect(targetApproach('mug').left).toBe(14)
    expect(targetApproach('nansen-terminal').left).not.toBe(targetApproach('request-dispenser').left)
    for (const id of ['official-case-file-cabinet', 'disorderly-stack-of-confidential-files', 'miscellaneous-drawer-cabinet', 'miscellaneous-catch-all-contents']) {
      expect(targetApproach(id), id).toMatchObject({ left: 8, right: 8 })
    }
  })

  it('stands beside a target instead of on it', () => {
    const session = buildRuntimeSession(productionComposition)
    const cabinet = session.targets['official-case-file-cabinet']!
    const fromLeft = walkPointForTarget(cabinet, cabinet.left - 80)
    const fromRight = walkPointForTarget(cabinet, cabinet.left + cabinet.width + 80)
    expect(fromLeft.x).toBeLessThan(cabinet.left)
    expect(fromRight.x).toBeGreaterThan(cabinet.left + cabinet.width)
  })

  it('keeps Rook facing the cabinet while Arthur turns toward him', () => {
    const session = buildRuntimeSession(productionComposition)
    const fresh = createInitialAdventureState({ skipIntro: true, session })
    const started = adventureReducer(adventureReducer({ ...fresh, rookPosition: { x: 200, y: 350 }, rookFacing: 'LEFT' }, { type: 'SELECT_VERB', verb: 'OPEN' }), { type: 'INTERACT', targetId: 'official-case-file-cabinet' })
    expect(started.walk).not.toBeNull()
    const direction = started.walk!.to.x < started.rookPosition.x ? 'LEFT' : 'RIGHT'
    expect(started.rookFacing).toBe(direction)
    const stepped = adventureReducer(started, { type: 'WALK_TICK', delta: 30 })
    if (stepped.walk) {
      const still = stepped.walk.to.x < stepped.rookPosition.x ? 'LEFT' : 'RIGHT'
      expect(stepped.rookFacing).toBe(still)
    }
    expect(stepped.mrIndexFacing).not.toBe(fresh.mrIndexFacing)
    expect(readFileSync('src/app/App.tsx', 'utf8')).not.toContain('exit-lit')
  })
})
