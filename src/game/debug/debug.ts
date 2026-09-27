import type { Dispatch } from 'react'
import type { GameAction, GameState } from '../domain/types'
import type { ScenarioManifest, WorldManifest } from '../scenario/contracts'
import { audioBus } from '../audio/audioBus'
import { guidedProbe3dAdapter } from '../render/presentationAdapter'

export interface RenderStats {
  calls: number
  triangles: number
  quality: 'high' | 'low'
  averageFrameMs: number
  fps: number
}

export interface TraceEscapeDebug {
  getState: () => Readonly<GameState>
  getScenarioInfo: () => Readonly<ScenarioManifest>
  getActiveBeat: () => GameState['beat']
  getNavigationState: () => Readonly<GameState['navigation']>
  getPresentationPosition: () => readonly number[]
  getEvidenceState: () => { discovered: readonly string[]; archived: readonly string[] }
  getChronoState: () => { time: number; anchors: Readonly<GameState['timeAnchors']> }
  getRenderStats: () => RenderStats
  getAudioEvents: () => readonly string[]
  triggerTestAction: (action: GameAction) => void
  resetScenario: () => void
  resetSyntheticScenario: () => void
}

declare global {
  interface Window {
    __TRACE_ESCAPE__?: TraceEscapeDebug
  }
}

export function installDebugInterface(
  getState: () => GameState,
  scenario: ScenarioManifest,
  world: WorldManifest,
  dispatch: Dispatch<GameAction>,
  getRenderStats: () => RenderStats,
) {
  window.__TRACE_ESCAPE__ = Object.freeze({
    getState: () => structuredClone(getState()),
    getScenarioInfo: () => structuredClone(scenario),
    getActiveBeat: () => getState().beat,
    getNavigationState: () => structuredClone(getState().navigation),
    getPresentationPosition: () => [...guidedProbe3dAdapter.resolvePosition(getState().navigation, world)],
    getEvidenceState: () => ({
      discovered: [...getState().discoveredEvidence],
      archived: [...getState().archivedEvidence],
    }),
    getChronoState: () => ({ time: getState().scenarioTime, anchors: structuredClone(getState().timeAnchors) }),
    getRenderStats,
    getAudioEvents: () => [...audioBus.getHistory()],
    triggerTestAction: (action: GameAction) => dispatch(action),
    resetScenario: () => dispatch({ type: 'RESET' }),
    resetSyntheticScenario: () => dispatch({ type: 'RESET' }),
  })
  return () => {
    delete window.__TRACE_ESCAPE__
  }
}
