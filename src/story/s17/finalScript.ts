import authority from './generated/final-script.json' with { type: 'json' }
import type { R55PerformanceCue, SpeechEmphasis, SpeechLine } from '../../adventure/types'

type FinalBubble = (typeof authority.bubbles)[number]

const bubblesByEvent = new Map<string, FinalBubble[]>()
const bubblesBySourceNode = new Map<string, FinalBubble[]>()
for (const bubble of authority.bubbles) {
  const event = bubblesByEvent.get(bubble.eventKey) ?? []
  event.push(bubble)
  bubblesByEvent.set(bubble.eventKey, event)
  const node = bubblesBySourceNode.get(bubble.sourceNodeId) ?? []
  node.push(bubble)
  bubblesBySourceNode.set(bubble.sourceNodeId, node)
}

function emphasisRanges(text: string, terms: readonly string[]): SpeechEmphasis[] {
  let cursor = 0
  return terms.flatMap(term => {
    const start = text.indexOf(term, cursor)
    if (start < 0) return []
    cursor = start + term.length
    return [{ start, end: cursor }]
  })
}

function performanceCues(bubble: FinalBubble): R55PerformanceCue[] {
  const note = [bubble.cue, bubble.performanceNote].filter(Boolean).join(' · ')
  if (!note) return []
  const actor = bubble.speaker === 'ARTHUR' ? 'arthur' : bubble.speaker === 'ROOK' ? 'rook' : null
  const admitted = {
    ARTHUR_ADJUST_GLASSES: { selectedClip: 'arthur.you-incredulous', supportedTrack: 'BODY' as const },
    ARTHUR_CAMERA_GLANCE: { selectedClip: 'arthur.camera-glance', supportedTrack: 'GAZE' as const },
    ARTHUR_CAMERA_TALK: { selectedClip: 'arthur.camera-talk', supportedTrack: 'FACE' as const },
  }[bubble.cue]
  return [{
    cueId: `${bubble.id}:authored-performance`, actor, intent: bubble.cue || note,
    selectedClip: admitted?.selectedClip ?? null,
    fallback: !admitted,
    fallbackReason: admitted ? null : `Final authored cue retained as semantic performance metadata: ${note}`,
    supportedTrack: admitted?.supportedTrack ?? 'BODY',
  }]
}

function toSpeech(bubble: FinalBubble): SpeechLine {
  const text = bubble.text
  const emphasis = emphasisRanges(text, bubble.emphasis)
  const beatBeforeMs = bubble.beatBeforeMs === '' ? undefined : Number(bubble.beatBeforeMs)
  const reviewedBeatAfter = bubble.id === 'r55-1325b81ac9f2ea385e43' ? 250 : bubble.id === 'r55-244598e54ce46059ead0' ? 350 : undefined
  const beatAfterMs = reviewedBeatAfter ?? (bubble.beatAfterMs === '' ? undefined : Number(bubble.beatAfterMs))
  return {
    speaker: bubble.speaker === 'ARTHUR' ? 'MR_INDEX' : bubble.speaker === 'ROOK' ? 'ROOK' : 'SYSTEM',
    text,
    copyKey: bubble.id,
    sourceCopyKey: bubble.sourceRecordId,
    finalScriptSource: {
      eventKey: bubble.eventKey,
      sourceRecordId: bubble.sourceRecordId,
      sourceNodeId: bubble.sourceNodeId,
      sourceOrder: bubble.sourceOrder,
      effectiveAction: bubble.effectiveAction,
      source: bubble.source,
    },
    deliveryParts: [text],
    ...(emphasis.length ? { emphasis } : {}),
    ...(typeof beatBeforeMs === 'number' && Number.isFinite(beatBeforeMs) ? { beatBeforeMs } : {}),
    ...(typeof beatAfterMs === 'number' && Number.isFinite(beatAfterMs) ? { beatAfterMs } : {}),
    ...(bubble.cue || bubble.performanceNote ? { performanceCues: performanceCues(bubble) } : {}),
    authority: 'FINAL_SCRIPT_RECONCILIATION',
  }
}

const FORM_COMPLETION_CLOSEOUT: readonly SpeechLine[] = [
  { speaker: 'ROOK', text: 'Purpose:', copyKey: 'S17.P1.R1.FORM.PURPOSE_LABEL', deliveryParts: ['Purpose:'], authority: 'PRINCIPAL_S17_DELTA' },
  { speaker: 'ROOK', text: 'Investigate official things...officially.', copyKey: 'S17.P1.R1.FORM.PURPOSE', deliveryParts: ['Investigate official things...officially.'], beatAfterMs: 300, authority: 'PRINCIPAL_S17_DELTA' },
  { speaker: 'ROOK', text: 'Annnd...my signature.', copyKey: 'S17.P1.R1.FORM.SIGNATURE', deliveryParts: ['Annnd...my signature.'], beatAfterMs: 350, authority: 'PRINCIPAL_S17_DELTA' },
  { speaker: 'ROOK', text: 'Whoops...', copyKey: 'S17.P1.R1.FORM.WHOOPS', deliveryParts: ['Whoops...'], authority: 'PRINCIPAL_S17_DELTA' },
  { speaker: 'ROOK', text: 'I think I pressed too hard, and broke the pen.', copyKey: 'S17.P1.R1.FORM.BROKE_PEN', deliveryParts: ['I think I pressed too hard, and broke the pen.'], authority: 'PRINCIPAL_S17_DELTA' },
  { speaker: 'ROOK', text: 'At least I finished the form though.', copyKey: 'S17.P1.R1.FORM.FINISHED', deliveryParts: ['At least I finished the form though.'], authority: 'PRINCIPAL_S17_DELTA' },
]

function authoredCue(cueId: string, actor: 'rook' | 'arthur', intent: string, selectedClip: string, supportedTrack: R55PerformanceCue['supportedTrack'], activation: R55PerformanceCue['activation'] = 'LINE_START'): R55PerformanceCue {
  return { cueId, actor, intent, selectedClip, activation, fallback: false, fallbackReason: null, supportedTrack }
}

function withCues(line: SpeechLine, ...cues: R55PerformanceCue[]): SpeechLine {
  return { ...line, performanceCues: [...(line.performanceCues ?? []), ...cues] }
}

function withoutCues(line: SpeechLine): SpeechLine {
  const corrected = { ...line }
  delete corrected.performanceCues
  return corrected
}

function runtimeCorrection(line: SpeechLine): SpeechLine {
    if (line.copyKey === 'OPEN-009') return { ...line, beatAfterMs: 900 }
    if (line.copyKey === 'OPEN-010') return {
      ...withCues(
        line,
        authoredCue('S17.OPEN.ROOK_PROUD', 'rook', 'PROUD_DELIVERY', 'rook.proud-delivery', 'BODY'),
        authoredCue('S17.OPEN.ARTHUR_SARDONIC', 'arthur', 'SILENT_SARDONIC_REACTION', 'arthur.sardonic-reaction', 'FACE'),
      ),
      beatAfterMs: 500,
    }
    if (line.copyKey === 'OPEN-015') return withoutCues(line)
    if (line.copyKey === 'OPEN-019') return {
      ...line,
      deliveryParts: ['Well...by the end of this investigation...', "we'll be closer than ever."],
    }
    if (line.copyKey === 'OPEN-023') return { ...withoutCues(line), beatAfterMs: 550 }
    if (line.copyKey === 'OPEN-030') return withCues(line, authoredCue('S17.OPEN.ROOK_SHRUG', 'rook', 'QUESTIONING_SHRUG_DELIVERY', 'rook.shrug-delivery', 'BODY'))
    if (line.copyKey === 'OPEN-053') return withCues(line, authoredCue('S17.OPEN.ARTHUR_PRESENT', 'arthur', 'PRESENT_EXPLANATION', 'arthur.present-delivery', 'BODY'))
    if (line.copyKey === 'OPEN-056') return withCues(line, authoredCue('S17.OPEN.ROOK_THINKING', 'rook', 'THINKING_DELIVERY', 'rook.thinking-delivery', 'BODY'))
    if (line.copyKey === 'OPEN-060') return { ...withCues(line, authoredCue('S17.OPEN.ARTHUR_GLASSES', 'arthur', 'SILENT_GLASSES_ADJUST', 'arthur.glasses-adjust', 'BODY')), beatAfterMs: 350 }
    if (line.copyKey === 'OPEN-071') return withCues(line, authoredCue('S17.OPEN.ARTHUR_SLOUCH', 'arthur', 'WEARY_SLOUCH_DELIVERY', 'arthur.slouch-delivery', 'BODY'))
    if (line.copyKey === 'r55-1ed81e32d6ba819d9791') return {
      ...withCues(line, authoredCue('S17.END.ROOK_CASE_CRACKED', 'rook', 'TRIUMPHANT_CASE_CRACKED_DELIVERY', 'rook.case-cracked-delivery', 'BODY')),
      beatAfterMs: 650,
    }
    if (line.copyKey === 'r55-704a43f5b0ed1e772315') return withCues(line, authoredCue('S17.END.ROOK_ROUTE_EXPLAINS', 'rook', 'ONE_HAND_EXPLANATION', 'rook.emphasis-delivery', 'BODY'))
    if (line.copyKey === 'r55-39b7f488778fa5d53563') return withCues(line, authoredCue('S17.END.ROOK_TEAM_APPEAL', 'rook', 'OPEN_HAND_TEAM_APPEAL', 'rook.shrug-delivery', 'BODY'))
    if (line.copyKey === 'r55-f44a7654b6f9576c60e7') return withCues(line, authoredCue('S17.END.ARTHUR_COMPETENCE', 'arthur', 'RESTRAINED_HAND_EXPLANATION', 'arthur.present-delivery', 'BODY'))
    if (line.copyKey === 'r55-9b5bf8d20b134d48072d') return withCues(line, authoredCue('S17.END.ROOK_PIZZA_INVITE', 'rook', 'OPEN_HAND_PIZZA_INVITATION', 'rook.pizza-invite-delivery', 'BODY'))
    if (line.copyKey === 'r55-8cf2720e348f133630a6') return {
      ...withCues(line, authoredCue('S17.END.ARTHUR_PIZZA_REFUSAL', 'arthur', 'RESTRAINED_HAND_REFUSAL', 'arthur.present-delivery', 'BODY')),
      beatAfterMs: 450,
    }
    if (line.copyKey === 'r55-66e1d346ac05e4659673') return {
      ...withCues(line, authoredCue('S17.END.ARTHUR_BUT_GLASS_WIGGLE', 'arthur', 'SILENT_GLASSES_WIGGLE_AFTER_BUT', 'arthur.glasses-wiggle', 'BODY')),
      beatAfterMs: 700,
    }
    if (line.copyKey === 'r55-f1d5092bf604006fdd94::2') return {
      ...withCues(line, authoredCue('S17.PIGGY.ROOK_OOPSY_HOLD', 'rook', 'EMBARRASSED_OOPSY_REACTION_AFTER_SPEECH', 'rook.embarrassed-reaction', 'BODY', 'AFTER_SPEECH')),
      // The ordinary talking pose delivers the entire promise first. Once its
      // mouth-motion window closes, the remaining natural read time becomes a
      // silent one-shot whoops hold before the admission on the next line.
    }
    if (line.copyKey === 'r55-4aa744bd9078967381c4') return {
      ...withCues(line, authoredCue('S17.PIGGY.ROOK_CAMERA_BEAT', 'rook', 'SILENT_CHEEKY_CAMERA_REACTION', 'rook.camera-cheeky-hold', 'FACE')),
      beatAfterMs: 650,
    }
    if (line.copyKey === 'r55-e94ceeafd16f0cf784c1::2') return {
      ...line,
      performanceCues: [{ cueId: 'S17.P1.R1.ARTHUR_DOCUMENT_ADJUST', actor: 'arthur', intent: 'DOCUMENT_ADJUST', selectedClip: 'arthur.document-adjust', fallback: false, fallbackReason: null, supportedTrack: 'PROP' }] satisfies R55PerformanceCue[],
    }
    return line
}

function runtimeCorrections(eventKey: string, lines: SpeechLine[]): SpeechLine[] {
  const corrected = lines.map(runtimeCorrection)
  return eventKey === 'complete form' ? [...corrected, ...FORM_COMPLETION_CLOSEOUT] : corrected
}

export function finalScriptHasEvent(eventKey: string) {
  return bubblesByEvent.has(eventKey)
}

export function finalSpeechByEvent(eventKey: string): SpeechLine[] {
  return runtimeCorrections(eventKey, (bubblesByEvent.get(eventKey) ?? []).map(toSpeech))
}

export function finalSpeechBySourceNode(sourceNodeId: string): SpeechLine[] {
  // Source-sliced routes still receive per-line runtime performance/timing
  // corrections, but never event-level appended material such as the form
  // closeout.
  return (bubblesBySourceNode.get(sourceNodeId) ?? []).map(toSpeech).map(runtimeCorrection)
}

export const FINAL_PRINCIPAL_OPENING = finalSpeechByEvent('PRINCIPAL_OPENING')
export const FINAL_PEN_PICKUP = finalSpeechByEvent('pen pickup')
export const FINAL_FORM_COMPLETION = finalSpeechByEvent('complete form')
export const FINAL_COFFEE_TALK = finalSpeechBySourceNode('r55-0e8aa2f337a5a93ccad0')
export const FINAL_SCRIPT_EVENT_KEYS = [...bubblesByEvent.keys()]
export const FINAL_SCRIPT_LINES = authority.bubbles.map(toSpeech)

export const FINAL_SCRIPT_IDENTITY = {
  schemaVersion: authority.schemaVersion,
  status: authority.status,
  sourceAuthoritySha256: authority.sourceAuthoritySha256,
  runtimeRegistrySha256: 'd337a24448735e3cdc1e0dddfb42b773fca0d335021d1c222c66217640c93f89',
  bubbles: authority.bubbles.length,
  eventGroups: authority.counts.event_groups,
  uniqueEventKeys: bubblesByEvent.size,
  sourceNodes: bubblesBySourceNode.size,
} as const

if (FINAL_SCRIPT_IDENTITY.bubbles !== 724 || FINAL_SCRIPT_IDENTITY.uniqueEventKeys !== 141) {
  throw new Error('FINAL_SCRIPT_AUTHORITY_COUNT_DRIFT')
}
