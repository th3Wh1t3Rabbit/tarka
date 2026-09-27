import { useEffect, useMemo, useRef, useState } from 'react'
import { animationActors, cueMoments, type AnimationCategory, type AnimationCue, type CueMode } from '../adventure/animationCues'
import { ANIMATION_REVIEW_WORKSPACE_KEY, DEFAULT_BEAT_MS, animationReviewClips, currentGameReviewMoments, forkCurrentGameProject, normalizeReviewProject, readReviewWorkspace, removeReviewVersion, replaceTimeline, reviewClipById, reviewProjectDiff, saveReviewVersion, timelineFor, upsertReviewCue, writeReviewDraft, type AnimationReviewProject, type ReviewTimelineSegment } from '../adventure/animationReview'
import './animation-director.css'

const CATEGORIES: AnimationCategory[] = ['Idle & life', 'Speech & listening', 'Movement', 'Actions & handoffs', 'Props & paperwork', 'Reactions & camera', 'Environment']
const REVIEW_GROUPS = ['Current game', 'Life', 'Interactions', 'Dialogue', 'Script'] as const

function storage() { try { return localStorage } catch { return null } }

function segmentFrame(segment: ReviewTimelineSegment, localMs: number) {
  const selected = reviewClipById(segment.clipId)
  if (!selected) return null
  if (segment.kind === 'FRAME_HOLD') return selected.frames[Math.min(segment.frameIndex, selected.frames.length - 1)] ?? selected.frames[0]
  const raw = Math.floor(Math.max(0, localMs) / (1000 / Math.max(1, segment.fps)))
  const index = segment.mode === 'LOOP' ? raw % selected.frames.length : Math.min(raw, selected.frames.length - 1)
  return selected.frames[index] ?? selected.frames[0]
}

function trackAt(segments: ReviewTimelineSegment[], elapsedMs: number) {
  let start = 0
  for (const segment of segments) {
    if (elapsedMs < start + segment.durationMs) return { segment, frame: segmentFrame(segment, elapsedMs - start) }
    start += segment.durationMs
  }
  const segment = segments.at(-1)
  return segment ? { segment, frame: segmentFrame(segment, segment.durationMs - 1) } : null
}

function timelineLength(tracks: Record<string, ReviewTimelineSegment[]>) {
  return Math.max(DEFAULT_BEAT_MS, ...Object.values(tracks).map((segments) => segments.reduce((sum, segment) => sum + segment.durationMs, 0)))
}

function downloadJson(filename: string, payload: unknown) {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function updateTrack(project: AnimationReviewProject, momentId: string, actorId: string, updater: (segments: ReviewTimelineSegment[]) => ReviewTimelineSegment[]) {
  const timeline = timelineFor(project, momentId)
  return replaceTimeline(project, { ...timeline, tracks: { ...timeline.tracks, [actorId]: updater(timeline.tracks[actorId] ?? []) } })
}

export function AnimationDirector() {
  const actors = animationActors()
  const clips = useMemo(() => animationReviewClips(), [])
  const moments = useMemo(() => [...currentGameReviewMoments(), ...cueMoments()], [])
  const [workspace, setWorkspace] = useState(() => readReviewWorkspace(storage()))
  const project = workspace.draft
  const sheet = project.workingSheet
  const [actorId, setActorId] = useState('rook')
  const [clipId, setClipId] = useState('rook.idle.breath')
  const [category, setCategory] = useState<AnimationCategory>('Idle & life')
  const [clipSearch, setClipSearch] = useState('')
  const [momentId, setMomentId] = useState('current:rook-idle')
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [fps, setFps] = useState(2)
  const [holdMs, setHoldMs] = useState(0)
  const [beatBeforeMs, setBeatBeforeMs] = useState(0)
  const [beatAfterMs, setBeatAfterMs] = useState(0)
  const [segmentDurationMs, setSegmentDurationMs] = useState(DEFAULT_BEAT_MS * 2)
  const [directionNote, setDirectionNote] = useState('')
  const [mode, setMode] = useState<CueMode>('LOOP')
  const [versionName, setVersionName] = useState('Animation review pass')
  const [momentSearch, setMomentSearch] = useState('')
  const [timelineMs, setTimelineMs] = useState(0)
  const [timelinePlaying, setTimelinePlaying] = useState(false)
  const importRef = useRef<HTMLInputElement | null>(null)
  const [message, setMessage] = useState('This is a review-only fork of the current game. Nothing here changes live gameplay.')
  const clip = reviewClipById(clipId) ?? clips[0]!
  const moment = moments.find((item) => item.id === momentId) ?? moments[0]!
  const frameCount = clip.frames.length
  const timeline = timelineFor(project, momentId)
  const totalTimelineMs = timelineLength(timeline.tracks)
  const diff = reviewProjectDiff(project)
  const filteredMoments = useMemo(() => {
    const query = momentSearch.trim().toLowerCase()
    if (!query) return moments
    return moments.filter((item) => `${item.label} ${item.detail} ${item.eventKey ?? ''}`.toLowerCase().includes(query))
  }, [momentSearch, moments])
  const visibleClips = useMemo(() => {
    const query = clipSearch.trim().toLowerCase()
    return clips.filter((item) => item.actorId === actorId && item.category === category && (!query || `${item.label} ${item.intendedUse} ${item.frameLabels.join(' ')}`.toLowerCase().includes(query)))
  }, [actorId, category, clipSearch, clips])
  const rookStill = reviewClipById('rook.idle.still')!
  const arthurStill = reviewClipById('arthur.idle.still')!

  useEffect(() => {
    if (!playing || frameCount < 2) return
    const timer = window.setInterval(() => {
      setFrame((index) => {
        const next = index + 1
        if (next < frameCount) return next
        if (mode === 'LOOP') return 0
        setPlaying(false)
        return frameCount - 1
      })
    }, 1000 / Math.max(1, fps))
    return () => window.clearInterval(timer)
  }, [playing, fps, frameCount, mode, clipId])

  useEffect(() => {
    if (!timelinePlaying) return
    const timer = window.setInterval(() => setTimelineMs((current) => {
      const next = current + 50
      if (next < totalTimelineMs) return next
      setTimelinePlaying(false)
      return Math.max(0, totalTimelineMs - 1)
    }), 50)
    return () => window.clearInterval(timer)
  }, [timelinePlaying, totalTimelineMs])

  function updateProject(updater: (current: AnimationReviewProject) => AnimationReviewProject) {
    setWorkspace((current) => {
      const nextProject = updater(current.draft)
      const store = storage()
      return store ? writeReviewDraft(store, current, nextProject) : { ...current, draft: nextProject }
    })
  }

  function chooseClip(nextId: string) {
    const next = reviewClipById(nextId)
    setClipId(nextId)
    setFrame(0)
    if (next) { setFps(Math.max(1, Math.round(next.defaultFps))); setCategory(next.category) }
    setPlaying(false)
  }

  function chooseMoment(nextId: string) {
    setMomentId(nextId)
    setTimelineMs(0)
    setTimelinePlaying(false)
    const existing = sheet.cues.find((cue) => cue.momentId === nextId && cue.actorId === actorId)
    if (!existing) return
    chooseClip(existing.clipId)
    setFps(existing.fps)
    setHoldMs(existing.holdMs)
    setBeatBeforeMs(existing.beatBeforeMs ?? 0)
    setBeatAfterMs(existing.beatAfterMs ?? 0)
    setMode(existing.mode)
    setDirectionNote(existing.note ?? '')
  }

  function attach() {
    const cue: AnimationCue = { momentId, actorId, clipId, fps: Math.round(fps), holdMs: Math.round(holdMs), mode, beatBeforeMs: Math.round(beatBeforeMs), beatAfterMs: Math.round(beatAfterMs), note: directionNote.trim() }
    updateProject((current) => ({ ...current, workingSheet: upsertReviewCue(current.workingSheet, cue) }))
    setMessage(`Updated the review fork: ${clip.label} on ${moment.label} for ${actors.find((actor) => actor.id === actorId)?.label}. The live game is unchanged.`)
  }

  function addSegment(kind: ReviewTimelineSegment['kind'], selectedClipId = clipId, selectedFrame = frame, durationMs = segmentDurationMs, selectedMode = mode) {
    const selected = reviewClipById(selectedClipId)
    if (!selected || selected.actorId !== actorId) return
    const segment: ReviewTimelineSegment = { id: `segment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kind, actorId, clipId: selectedClipId, frameIndex: Math.min(selectedFrame, selected.frames.length - 1), durationMs: Math.max(50, Math.round(durationMs)), fps: Math.max(1, Math.round(fps || selected.defaultFps)), mode: kind === 'FRAME_HOLD' ? 'HOLD' : selectedMode, note: directionNote.trim() }
    updateProject((current) => updateTrack(current, momentId, actorId, (segments) => [...segments, segment]))
    setMessage(`Added ${selected.label} to the ${actorId} review timeline for ${durationMs} ms (${(durationMs / DEFAULT_BEAT_MS).toFixed(2)} beats).`)
  }

  function addPoseTalkRecipe() {
    const control = clip.poseTalkControl
    if (!control) return
    const now = Date.now()
    const entry = control.entryClipId ? reviewClipById(control.entryClipId) : null
    const setup: ReviewTimelineSegment = entry
      ? { id: `segment-${now}-enter`, kind: 'SEQUENCE', actorId, clipId: entry.id, frameIndex: 0, durationMs: DEFAULT_BEAT_MS, fps: Math.max(1, Math.round(entry.defaultFps)), mode: 'ONCE', note: `Enter pose: ${control.guidance}` }
      : { id: `segment-${now}-pose`, kind: 'FRAME_HOLD', actorId, clipId: clip.id, frameIndex: control.poseFrameIndex, durationMs: DEFAULT_BEAT_MS, fps: 1, mode: 'HOLD', note: `Establish pose: ${control.guidance}` }
    const talk: ReviewTimelineSegment = { id: `segment-${now}-talk`, kind: 'SEQUENCE', actorId, clipId: clip.id, frameIndex: control.poseFrameIndex, durationMs: DEFAULT_BEAT_MS * 4, fps: Math.max(1, Math.round(fps || clip.defaultFps)), mode: 'LOOP', note: control.guidance }
    updateProject((current) => updateTrack(current, momentId, actorId, (existing) => [...existing, setup, talk]))
    setMessage(`Added a pose-preserving talk recipe for ${clip.label}: establish the pose once, then talk for 2,000 ms without resetting the body pose.`)
  }

  function exportReview() {
    const payload = { schema: 'trace-escape.animation-review-export.v3', exportedAt: new Date().toISOString(), safety: { reviewOnly: true, liveGameApplied: false, storageKey: ANIMATION_REVIEW_WORKSPACE_KEY }, beatDefinition: { defaultBeatMs: DEFAULT_BEAT_MS, examples: { halfBeatMs: 250, oneBeatMs: 500, twoBeatsMs: 1000 } }, diff, project }
    const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'animation-review'
    downloadJson(`trace-escape-${slug}.json`, payload)
    setMessage(`Exported the review fork with ${diff.changedMomentIds.length} changed moment${diff.changedMomentIds.length === 1 ? '' : 's'}. It cannot alter the game by itself.`)
  }

  async function importReview(file: File | undefined) {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as { project?: AnimationReviewProject } | AnimationReviewProject
      const imported = normalizeReviewProject('project' in parsed && parsed.project ? parsed.project : parsed as AnimationReviewProject)
      if (!imported) throw new Error('No valid review project')
      setWorkspace((current) => {
        const fork = { ...structuredClone(imported), id: `imported-${Date.now()}`, name: `${imported.name} — imported working copy`, updatedAt: new Date().toISOString() }
        const store = storage()
        return store ? writeReviewDraft(store, current, fork) : { ...current, draft: fork }
      })
      setMessage(`Imported ${file.name} as an isolated working copy. The live game is unchanged.`)
    } catch { setMessage(`${file.name} is not a valid v3 animation review project.`) }
  }

  const binding = sheet.cues.find((cue) => cue.momentId === momentId && cue.actorId === actorId)
  const trackActors = [...new Set(['rook', 'arthur', actorId, ...Object.keys(timeline.tracks)])]
  const timelineFrames = Object.fromEntries(trackActors.map((id) => [id, trackAt(timeline.tracks[id] ?? [], timelineMs)?.frame ?? null]))
  const rookScene = timelineFrames.rook ?? (actorId === 'rook' ? clip.frames[Math.min(frame, frameCount - 1)] : rookStill.frames[0])
  const arthurScene = timelineFrames.arthur ?? (actorId === 'arthur' ? clip.frames[Math.min(frame, frameCount - 1)] : arthurStill.frames[0])

  return <main className="anim-director" data-testid="animation-director">
    <header>
      <div><h1>ANIMATION & SCRIPT REVIEW STUDIO</h1><p>Forked from the current game · review workspace only · live gameplay is never modified here.</p></div>
      <div><span className="safety-badge">REVIEW-ONLY FORK</span> <a href="/?artLayout=1">Art layout</a> · <a href="/?skipIntro=1">Live game</a></div>
    </header>
    <aside className="clip-browser">
      <h2>1 · Character</h2>
      {actors.map((actor) => <button type="button" className="actor-row" key={actor.id} aria-pressed={actor.id === actorId} onClick={() => { setActorId(actor.id); const first = clips.find((item) => item.actorId === actor.id); if (first) chooseClip(first.id) }}>{actor.label}</button>)}
      <h2>2 · Category</h2>
      <div className="category-grid">{CATEGORIES.filter((name) => clips.some((item) => item.actorId === actorId && item.category === name)).map((name) => <button type="button" key={name} aria-pressed={category === name} onClick={() => setCategory(name)}>{name}</button>)}</div>
      <label className="clip-search">Find a sequence or frame <input type="search" value={clipSearch} onChange={(event) => setClipSearch(event.target.value)} /></label>
      <h2>3 · Sequences</h2>
      {visibleClips.map((item) => <button type="button" className="clip-row" key={item.id} aria-pressed={item.id === clipId} onClick={() => chooseClip(item.id)}>{item.label}<small><span className={`clip-origin ${item.reviewAvailability.toLowerCase().replace('_', '-')}`}>{item.reviewAvailability === 'CURRENT_GAME' ? 'CURRENT GAME' : 'REVIEW OPTION'}</span>{item.poseTalkControl && <span className="talk-capable">POSE + TALK</span>} · {item.frames.length} frame{item.frames.length === 1 ? '' : 's'} · {item.defaultFps} fps</small><small>{item.intendedUse}</small></button>)}
    </aside>
    <section className="stage">
      <div className="preview" data-testid="animation-preview"><img alt={`${clip.label}, ${clip.frameLabels[Math.min(frame, frameCount - 1)]}`} src={clip.frames[Math.min(frame, frameCount - 1)]} /></div>
      <div className="frame-strip" aria-label="Supported frames">{clip.frames.map((src, index) => <button type="button" key={`${src}-${index}`} aria-pressed={index === frame} onClick={() => { setPlaying(false); setFrame(index) }} title={clip.frameLabels[index]}><img alt="" src={src} /><span>{clip.frameLabels[index]}</span></button>)}</div>
      {clip.poseTalkControl && <p className="talk-control-note"><strong>Pose-preserving talk:</strong> {clip.poseTalkControl.guidance} The recipe below separates pose setup from the standard mouth loop; both durations remain editable.</p>}
      <h2>Scene and timeline preview</h2>
      <div className="scene-preview" data-testid="animation-scene-preview">
        <img className="scene-room" alt="" src="/art-packs/production/room-plate-480x180.png" />
        <img className="scene-actor scene-rook" alt="Rook preview" src={rookScene} />
        <img className="scene-actor scene-arthur" alt="Arthur preview" src={arthurScene} />
        {moment.text && <div className={`scene-line speaker-${moment.speaker?.toLowerCase().replace('_', '-') ?? 'system'}`}><strong>{moment.speaker === 'MR_INDEX' ? 'ARTHUR' : moment.speaker}</strong><span>{moment.text}</span></div>}
      </div>
      <section className="beat-guide" aria-label="Beat timing guide"><strong>Beat timing</strong><span>1 beat = {DEFAULT_BEAT_MS} ms</span><span>½ beat = {DEFAULT_BEAT_MS / 2} ms</span><span>2 beats = {DEFAULT_BEAT_MS * 2} ms</span><p>A beat is the studio's default short pause—like 3 feet making 1 yard. Use beats for rhythm or type exact milliseconds. During any beat, each character can hold a frame or play another sequence on their own track.</p></section>
      <div className="transport">
        <button type="button" onClick={() => { setPlaying(false); setFrame((index) => (index - 1 + frameCount) % frameCount) }}>Previous frame</button>
        <button type="button" aria-pressed={playing} onClick={() => setPlaying((value) => !value)}>{playing ? 'Pause sequence' : 'Play sequence'}</button>
        <button type="button" onClick={() => { setPlaying(false); setFrame((index) => (index + 1) % frameCount) }}>Next frame</button>
        <span data-testid="animation-frame">Frame {Math.min(frame, frameCount - 1) + 1} / {frameCount}</span>
        <label>FPS <input aria-label="Playback FPS" type="number" min={1} max={24} value={fps} onChange={(event) => setFps(Math.min(24, Math.max(1, Number(event.target.value) || 1)))} /></label>
        <label>Mode <select aria-label="Playback mode" value={mode} onChange={(event) => setMode(event.target.value as CueMode)}><option value="LOOP">Loop</option><option value="ONCE">Play once</option><option value="HOLD">Play once and hold</option></select></label>
      </div>
      <div className="timing-grid">
        <label>Hold ms <input aria-label="Hold milliseconds" type="number" min={0} max={10000} step={50} value={holdMs} onChange={(event) => setHoldMs(Math.min(10000, Math.max(0, Number(event.target.value) || 0)))} /></label>
        <label>Beat before <input aria-label="Beat before beats" type="number" min={0} max={20} step={0.25} value={beatBeforeMs / DEFAULT_BEAT_MS} onChange={(event) => setBeatBeforeMs(Math.round(Math.min(20, Math.max(0, Number(event.target.value) || 0)) * DEFAULT_BEAT_MS))} /></label>
        <label>Before ms <input aria-label="Beat before milliseconds" type="number" min={0} max={10000} step={50} value={beatBeforeMs} onChange={(event) => setBeatBeforeMs(Math.min(10000, Math.max(0, Number(event.target.value) || 0)))} /></label>
        <label>Beat after <input aria-label="Beat after beats" type="number" min={0} max={20} step={0.25} value={beatAfterMs / DEFAULT_BEAT_MS} onChange={(event) => setBeatAfterMs(Math.round(Math.min(20, Math.max(0, Number(event.target.value) || 0)) * DEFAULT_BEAT_MS))} /></label>
        <label>After ms <input aria-label="Beat after milliseconds" type="number" min={0} max={10000} step={50} value={beatAfterMs} onChange={(event) => setBeatAfterMs(Math.min(10000, Math.max(0, Number(event.target.value) || 0)))} /></label>
        <label>New clip duration ms <input aria-label="Timeline clip duration milliseconds" type="number" min={50} max={60000} step={50} value={segmentDurationMs} onChange={(event) => setSegmentDurationMs(Math.min(60000, Math.max(50, Number(event.target.value) || DEFAULT_BEAT_MS)))} /></label>
      </div>
      <label className="direction-note">Direction note <textarea aria-label="Direction note" value={directionNote} onChange={(event) => setDirectionNote(event.target.value)} placeholder="What should happen, why, and what should be checked in-game later." /></label>
      <div className="editor-actions">
        <button type="button" onClick={attach}>UPDATE REVIEW BINDING</button>
        <button type="button" onClick={() => addSegment('SEQUENCE')}>ADD SEQUENCE TO {actorId.toUpperCase()} TRACK</button>
        <button type="button" onClick={() => addSegment('FRAME_HOLD')}>HOLD SELECTED FRAME</button>
        {clip.poseTalkControl && <button type="button" onClick={addPoseTalkRecipe}>ADD POSE + TALK RECIPE</button>}
      </div>
      {binding && <p className="binding">Review binding for {actorId}: {reviewClipById(binding.clipId)?.label} · {binding.fps} fps · {binding.mode} · before {(binding.beatBeforeMs ?? 0) / DEFAULT_BEAT_MS} beats / {binding.beatBeforeMs ?? 0} ms · after {(binding.beatAfterMs ?? 0) / DEFAULT_BEAT_MS} beats / {binding.beatAfterMs ?? 0} ms · hold {binding.holdMs} ms{binding.note ? ` · ${binding.note}` : ''}</p>}
      <section className="timeline-editor" data-testid="animation-timeline">
        <div className="timeline-toolbar"><h2>Timeline · {moment.label}</h2><button type="button" onClick={() => { setTimelineMs(0); setTimelinePlaying((value) => !value) }}>{timelinePlaying ? 'PAUSE TIMELINE' : 'PLAY TIMELINE'}</button><span>{timelineMs} / {totalTimelineMs} ms</span></div>
        <input className="timeline-scrubber" aria-label="Timeline position milliseconds" type="range" min={0} max={Math.max(0, totalTimelineMs - 1)} value={Math.min(timelineMs, totalTimelineMs - 1)} onChange={(event) => { setTimelinePlaying(false); setTimelineMs(Number(event.target.value)) }} />
        {trackActors.map((trackActor) => {
          const segments = timeline.tracks[trackActor] ?? []
          return <div className="timeline-track" key={trackActor}><strong>{trackActor.toUpperCase()}</strong><div className="timeline-strip">{segments.length === 0 ? <span className="empty-track">No override—current scene fallback remains visible.</span> : segments.map((segment, index) => <article key={segment.id} style={{ flexGrow: Math.max(1, segment.durationMs / DEFAULT_BEAT_MS) }} data-active={trackAt(segments, timelineMs)?.segment.id === segment.id}><span>{reviewClipById(segment.clipId)?.label}</span><small>{segment.kind === 'FRAME_HOLD' ? `hold frame ${segment.frameIndex + 1}` : `${segment.mode.toLowerCase()} · ${segment.fps} fps`}</small><label>ms <input aria-label={`${trackActor} segment ${index + 1} duration milliseconds`} type="number" min={50} max={60000} step={50} value={segment.durationMs} onChange={(event) => updateProject((current) => updateTrack(current, momentId, trackActor, (items) => items.map((item) => item.id === segment.id ? { ...item, durationMs: Math.min(60000, Math.max(50, Number(event.target.value) || 50)) } : item)))} /></label><small>{(segment.durationMs / DEFAULT_BEAT_MS).toFixed(2)} beats</small><div><button type="button" aria-label={`Move ${trackActor} segment ${index + 1} earlier`} disabled={index === 0} onClick={() => updateProject((current) => updateTrack(current, momentId, trackActor, (items) => { const next = [...items]; [next[index - 1], next[index]] = [next[index]!, next[index - 1]!]; return next }))}>←</button><button type="button" aria-label={`Move ${trackActor} segment ${index + 1} later`} disabled={index === segments.length - 1} onClick={() => updateProject((current) => updateTrack(current, momentId, trackActor, (items) => { const next = [...items]; [next[index], next[index + 1]] = [next[index + 1]!, next[index]!]; return next }))}>→</button><button type="button" aria-label={`Remove ${trackActor} segment ${index + 1}`} onClick={() => updateProject((current) => updateTrack(current, momentId, trackActor, (items) => items.filter((item) => item.id !== segment.id)))}>×</button></div></article>)}</div></div>
        })}
      </section>
    </section>
    <aside className="bindings">
      <h2>Script and game moments</h2>
      <label className="moment-search">Search <input type="search" value={momentSearch} onChange={(event) => setMomentSearch(event.target.value)} placeholder="drawer, authorization, copy key..." /></label>
      {REVIEW_GROUPS.map((group) => <details key={group} open={group === 'Current game' || Boolean(momentSearch)}>
        <summary>{group} ({filteredMoments.filter((item) => item.group === group).length})</summary>
        {filteredMoments.filter((item) => item.group === group).map((item) => {
          const attached = sheet.cues.filter((cue) => cue.momentId === item.id)
          return <button type="button" className="moment-row" key={item.id} aria-pressed={item.id === momentId} onClick={() => chooseMoment(item.id)}>{item.label}<small>{item.detail}</small>{attached.length > 0 && <small className="attached">{attached.map((cue) => `${cue.actorId}: ${reviewClipById(cue.clipId)?.label}`).join(' · ')}</small>}</button>
        })}
      </details>)}
      <h2>Review-only project</h2>
      <p className="isolation-note">Saved here: <code>{ANIMATION_REVIEW_WORKSPACE_KEY}</code><br/>The game animation key is never written or read by this studio.</p>
      <p data-testid="animation-default">Baseline: {project.source.label}<br/>Working changes: {diff.changedMomentIds.length} moments · {diff.timelineTrackChanges} timeline tracks.</p>
      <label>Project name <input aria-label="Cue sheet name" value={versionName} onChange={(event) => setVersionName(event.target.value)} /></label>
      <button type="button" onClick={() => { const store = storage(); if (!store) return; const next = saveReviewVersion(store, workspace, project, versionName); setWorkspace(next); setMessage(`Saved ${versionName} as an immutable review version. The game is unchanged.`) }}>SAVE REVIEW VERSION</button>
      <button type="button" onClick={() => { if (!window.confirm('Start a new review fork from the current implemented game? Save or export the present draft first if you need it.')) return; const fresh = forkCurrentGameProject(); setWorkspace((current) => { const store = storage(); return store ? writeReviewDraft(store, current, fresh) : { ...current, draft: fresh } }); setMessage('Started a fresh review fork from the current implemented game.') }}>FORK CURRENT GAME AGAIN</button>
      <div className="review-transfer">
        <button type="button" onClick={exportReview}>EXPORT REVIEW JSON</button>
        <button type="button" onClick={() => importRef.current?.click()}>IMPORT REVIEW JSON</button>
        <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => { void importReview(event.target.files?.[0]); event.target.value = '' }} />
      </div>
      {workspace.versions.map((version) => <article className="saved-version" key={version.id}><strong>{version.name}</strong><small>{version.savedAt}</small><div>
        <button type="button" onClick={() => { const fork = { ...structuredClone(version.project), id: `working-${Date.now()}`, name: `${version.name} — working copy`, updatedAt: new Date().toISOString() }; setWorkspace((current) => { const store = storage(); return store ? writeReviewDraft(store, current, fork) : { ...current, draft: fork } }); setMessage(`Loaded ${version.name} as a new working copy. The saved version and game remain unchanged.`) }}>LOAD AS WORKING COPY</button>
        <button type="button" onClick={() => { const store = storage(); if (!store) return; setWorkspace(removeReviewVersion(store, workspace, version.id)); setMessage(`Removed saved review version ${version.name}; the game remains unchanged.`) }}>REMOVE VERSION</button>
      </div></article>)}
    </aside>
    <footer data-testid="animation-status">{message}</footer>
  </main>
}
