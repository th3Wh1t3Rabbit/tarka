import { publicObjectName, publicSpeaker } from '../controller/content/adapter'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { EULER_MISSION_TRUTH, createEulerMissionState, eulerMissionReducer, evidenceClass, type AcceptedEvidenceId, type AssemblySlot, type JourneyStyle } from '../adventure/eulerMission'
import { RECORDS_OFFICE_NARRATIVE, advanceDialogueInput, createDialoguePlayback } from '../adventure/narrative'
import { initialPropState, transitionProp } from '../adventure/propCatalog'
import { attachOverlay, createSequenceState, mirrorTransform, requestAnimation, sequenceFor, tickSemanticPlayback, type SequenceState } from '../adventure/sequenceEngine'
import type { CharacterAnimationCatalog } from '../adventure/semanticCatalog'

const HYPOTHESES = [
  ['FIRST_TRAIL_STOPS_AT_FIRST_ENGINE', 'IT STOPPED AT THE FIRST ENGINE'],
  ['FIRST_TRAIL_JOINS_SECOND_ROUTE', 'IT JOINED THE SECOND ROUTE'],
] as const
const ASSEMBLY: [AssemblySlot, AcceptedEvidenceId][] = [['AMOUNT', 'EXACT_EARLY_NET'], ['RECEIVER', 'EXACT_MAIN_RECEIVER'], ['LINK', 'EXACT_CONVERGENCE']]

function SemanticCueFigure({ catalog, state, reducedMotion, reducedAnimationId, revealing }: { catalog: CharacterAnimationCatalog; state: SequenceState; reducedMotion: boolean; reducedAnimationId: string; revealing: boolean }) {
  const [playback, setPlayback] = useState(() => ({ ...state, revealingText: revealing }))
  const sequence = sequenceFor(catalog, playback)
  useEffect(() => {
    if (reducedMotion) return
    const timer = window.setInterval(() => setPlayback((current) => tickSemanticPlayback({ ...current, revealingText: revealing }, catalog, 50)), 50)
    return () => window.clearInterval(timer)
  }, [catalog, reducedMotion, revealing])
  const entries = catalog.characters[playback.characterId] as Record<string, typeof sequence>
  const requestedReducedId = !revealing && reducedAnimationId.startsWith('talk.') && reducedAnimationId.endsWith('.open') ? 'talk.neutral.closed' : reducedAnimationId
  const reducedSequence = reducedMotion ? entries[requestedReducedId] ?? entries[sequence.reducedMotion] ?? sequence : sequence
  const frame = reducedSequence.frames[reducedMotion ? 0 : playback.frameIndex] ?? reducedSequence.frames[0]
  const asset = frame ? catalog.assets[frame.assetSlot] : undefined
  const overlay = playback.overlay ? catalog.overlays[playback.overlay] : undefined
  const overlayFrame = overlay?.frames[reducedMotion ? overlay.reducedMotionFrame : playback.overlayFrameIndex]
  const overlayAsset = overlayFrame ? catalog.assets[overlayFrame.assetSlot] : undefined
  return <figure className="semantic-cue-figure" data-semantic-id={reducedSequence.id} data-semantic-frame={frame?.assetSlot ?? 'OPTIONAL_UNINSTALLED'} data-overlay-frame={overlayFrame?.assetSlot ?? 'NONE'}>
    {asset ? <img src={asset.src} width={asset.width} height={asset.height} alt={`${publicObjectName({ id: state.characterId, name: 'Rook' }, true)} ${reducedSequence.id} provisional animation`} style={{ transform: mirrorTransform(playback, reducedSequence), imageRendering: 'pixelated' }} /> : <span role="img" aria-label={`${publicObjectName({ id: state.characterId, name: 'Rook' }, true)} ${reducedSequence.id} optional asset not installed`}>OPTIONAL ASSET</span>}
    {overlayAsset && <img className="semantic-reaction-overlay" src={overlayAsset.src} width={overlayAsset.width} height={overlayAsset.height} alt={playback.overlay ?? ''} />}
    <figcaption>{reducedSequence.id} // {playback.facing} // {reducedMotion ? 'REDUCED' : reducedSequence.mode}</figcaption>
  </figure>
}

export function MissionHarness({ catalog, reducedMotion: initialReducedMotion = false }: { catalog: CharacterAnimationCatalog; reducedMotion?: boolean }) {
  const [mission, dispatch] = useReducer(eulerMissionReducer, undefined, () => createEulerMissionState())
  const [dialogue, setDialogue] = useState(createDialoguePlayback)
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion)
  const [propState, setPropState] = useState(() => initialPropState('caseAccessArtifact'))
  const [narrativeObjective, setNarrativeObjective] = useState('BEGIN_RECORDS_ONBOARDING')
  const [narrativeEvidence, setNarrativeEvidence] = useState<string[]>([])
  const currentCue = RECORDS_OFFICE_NARRATIVE[dialogue.cueIndex]
  const characterState = useMemo(() => {
    if (!currentCue) return createSequenceState('rook')
    const characterId = currentCue.speaker === 'ARCHIVIST' ? 'archivist' : 'rook'
    const initial = createSequenceState(characterId)
    const entries = catalog.characters[characterId] as Record<string, ReturnType<typeof sequenceFor>>
    const requested = entries[currentCue.animationId]
    if (!requested) return initial
    const next = requestAnimation(initial, sequenceFor(catalog, initial), requested, { held: currentCue.animationId.startsWith('react.'), facing: currentCue.facing })
    return attachOverlay(next, currentCue.reactionOverlay ?? null)
  }, [catalog, currentCue])
  const chooseJourney = (journey: JourneyStyle) => { dispatch({ type: 'BEGIN', journey }); setDialogue(createDialoguePlayback()) }
  const advance = () => {
    const completingCue = Boolean(currentCue && dialogue.visibleCharacters >= currentCue.provisionalText.length)
    if (completingCue && currentCue?.propCue?.family === 'caseAccessArtifact') setPropState((current) => transitionProp(current, currentCue.propCue!.state))
    if (completingCue && currentCue?.update?.objectiveId) setNarrativeObjective(currentCue.update.objectiveId)
    if (completingCue && currentCue?.update?.evidenceId) setNarrativeEvidence((current) => current.includes(currentCue.update!.evidenceId!) ? current : [...current, currentCue.update!.evidenceId!])
    const next = advanceDialogueInput(dialogue, RECORDS_OFFICE_NARRATIVE)
    setDialogue(next)
    if (next.complete) dispatch({ type: 'COMPLETE_ONBOARDING' })
  }
  return <main className="mission-harness" data-testid="euler-mission-harness" data-stage={mission.stage}>
    <header><span>PLACEHOLDER-PLAYABLE // NOT FINAL NARRATIVE OR ART</span><h1>CASE 01 // {EULER_MISSION_TRUTH.title}</h1><p>{EULER_MISSION_TRUTH.question}</p></header>
    <nav aria-label="Test journey"><span>JOURNEY</span>{(['DIRECT', 'CURIOUS', 'MISTAKEN'] as JourneyStyle[]).map((journey) => <button key={journey} aria-pressed={mission.journey === journey} onClick={() => chooseJourney(journey)}>{journey}</button>)}<button aria-pressed={reducedMotion} onClick={() => setReducedMotion((value) => !value)}>MOTION {reducedMotion ? 'REDUCED' : 'FULL'}</button></nav>
    <section className={`mission-stage camera-${currentCue?.cameraFraming?.toLowerCase() ?? 'none'}`}><small>{mission.stage}</small><h2>{mission.objective}</h2>
      {mission.stage === 'ONBOARDING' && currentCue && <div className="mission-cue-stage" aria-live="polite"><SemanticCueFigure key={`${currentCue.id}:${reducedMotion}`} catalog={catalog} state={characterState} reducedMotion={reducedMotion} reducedAnimationId={currentCue.reducedMotionAnimationId} revealing={dialogue.visibleCharacters < currentCue.provisionalText.length}/><button className="mission-dialogue" onClick={advance} data-testid="mission-dialogue" data-animation-id={reducedMotion ? currentCue.reducedMotionAnimationId : characterState.animationId} data-facing={characterState.facing} data-overlay={characterState.overlay ?? 'NONE'} data-interruption={currentCue.interruption} data-camera={currentCue.cameraFraming ?? 'NONE'} data-prop-cue={currentCue.propCue ? `${currentCue.propCue.family}:${currentCue.propCue.state}` : 'NONE'}><strong>{publicSpeaker(currentCue.speaker)}</strong><span>{currentCue.provisionalText.slice(0, dialogue.visibleCharacters)}</span><small>{dialogue.visibleCharacters < currentCue.provisionalText.length ? 'CONTINUE TO REVEAL' : 'CONTINUE'}</small></button><output>NARRATIVE OBJECTIVE {narrativeObjective} // PROP {propState.state} // EVIDENCE {narrativeEvidence.length}</output></div>}
      {mission.stage === 'FIRST_RECORD' && <button onClick={() => dispatch({ type: 'ACQUIRE_FIRST_RECORD' })}>ACQUIRE FIRST BREACH RECORD</button>}
      {mission.stage === 'FORK' && <div className="mission-choices"><button disabled={mission.inspectedBranches.includes('first-breach')} onClick={() => dispatch({ type: 'INSPECT_BRANCH', branchId: 'first-breach' })}>READ FIRST BREACH</button><button disabled={mission.inspectedBranches.includes('second-breach')} onClick={() => dispatch({ type: 'INSPECT_BRANCH', branchId: 'second-breach' })}>READ SECOND BREACH</button></div>}
      {mission.stage === 'HYPOTHESIS' && <div className="mission-choices">{HYPOTHESES.map(([hypothesisId, label]) => <button key={hypothesisId} onClick={() => dispatch({ type: 'SELECT_HYPOTHESIS', hypothesisId })}>{label}</button>)}</div>}
      {mission.stage === 'TEST' && <button onClick={() => dispatch({ type: 'TEST_HYPOTHESIS' })}>SWEEP FORWARD</button>}
      {mission.stage === 'CASE_ASSEMBLY' && <div className="mission-choices">{ASSEMBLY.map(([slot, evidenceId]) => <button key={slot} disabled={mission.assembly[slot] === evidenceId} onClick={() => dispatch({ type: 'ASSEMBLE', slot, evidenceId })}>{slot} // {evidenceId}</button>)}</div>}
      {mission.stage === 'COMPLETE' && <article><h2>TRUTH RECONSTRUCTED.</h2><p>THE FIRST TRAIL JOINED THE SECOND ROUTE.</p><strong>{EULER_MISSION_TRUTH.conclusionBoundary}</strong><button onClick={() => dispatch({ type: 'RESET' })}>REPLAY SKELETON</button></article>}
    </section>
    <aside><h2>EVIDENCE // {mission.evidenceIds.length}</h2>{mission.evidenceIds.map((id) => <p key={id}><strong>{evidenceClass(id)}</strong> {id}</p>)}</aside>
    <footer><span>{EULER_MISSION_TRUTH.provenance}</span><span>FROZEN CUTOFF {EULER_MISSION_TRUTH.historicalCutoffUtc}</span><span>NO LIVE CALLS DURING PLAY</span>{mission.recoveryCount > 0 && <span>BOUNDED RECOVERY {mission.recoveryCount}</span>}</footer>
  </main>
}
