import type { DialogueDisplay, DialoguePace, R55PerformanceCue, SpeechActor, SpeechLine } from '../../adventure/types'
import { FINAL_COFFEE_TALK, FINAL_FORM_COMPLETION, FINAL_PEN_PICKUP, FINAL_PRINCIPAL_OPENING } from '../s17/finalScript'

export type PrincipalCueId = 'ARTHUR_ADJUST_GLASSES' | 'ARTHUR_CAMERA_GLANCE' | 'ARTHUR_CAMERA_TALK'
type Draft = { speaker: SpeechActor; text: string; beatBeforeMs?: number; beatAfterMs?: number; performanceCue?: PrincipalCueId }

const PRINCIPAL_CUES: Record<PrincipalCueId, readonly R55PerformanceCue[]> = {
  ARTHUR_ADJUST_GLASSES: [{ cueId: 'PF1.ARTHUR_ADJUST_GLASSES', actor: 'arthur', intent: 'SPEAK_GLASS_WIGGLE_CAMERA_TAKE', selectedClip: 'arthur.you-incredulous', fallback: false, fallbackReason: null, supportedTrack: 'BODY' }],
  ARTHUR_CAMERA_GLANCE: [{ cueId: 'PF1.ARTHUR_CAMERA_GLANCE', actor: 'arthur', intent: 'CAMERA_GLANCE', selectedClip: 'arthur.camera-glance', fallback: false, fallbackReason: null, supportedTrack: 'GAZE' }],
  ARTHUR_CAMERA_TALK: [{ cueId: 'PF1.ARTHUR_CAMERA_TALK', actor: 'arthur', intent: 'CAMERA_TALK', selectedClip: 'arthur.camera-talk', fallback: false, fallbackReason: null, supportedTrack: 'FACE' }],
}

export function delivery(draft: Draft, index: number): SpeechLine {
  const emphasis: Array<{ start: number; end: number }> = []
  let text = ''; let open = -1
  for (const char of draft.text) {
    if (char === '*') { if (open < 0) open = text.length; else { emphasis.push({ start: open, end: text.length }); open = -1 } }
    else text += char
  }
  return { speaker: draft.speaker, text, copyKey: `s15-r3.principal-opening.${String(index + 1).padStart(2, '0')}`, ...(emphasis.length ? { emphasis } : {}), ...(draft.beatBeforeMs == null ? {} : { beatBeforeMs: draft.beatBeforeMs }), ...(draft.beatAfterMs == null ? {} : { beatAfterMs: draft.beatAfterMs }), ...(draft.performanceCue ? { performanceCues: PRINCIPAL_CUES[draft.performanceCue] } : {}), authority: 'PRINCIPAL_PLAYTEST_1_FEEDBACK' }
}

const D = (speaker: SpeechActor, text: string, extra: Omit<Draft, 'speaker' | 'text'> = {}): Draft => ({ speaker, text, ...extra })
const R = (text: string, extra: Omit<Draft, 'speaker' | 'text'> = {}) => D('ROOK', text, extra)
const A = (text: string, extra: Omit<Draft, 'speaker' | 'text'> = {}) => D('MR_INDEX', text, extra)
const wordFromCodes = (codes: number[]) => String.fromCharCode(...codes)

export const OPENING_DRAFT: Draft[] = [
  R('“This the Records Office?”'), A('“No. It’s a pizza restaurant.”'), R('“Right...”'), A('“We’re closed to the public.”'), A('“I’m waiting for a top-tier lead investigator.”'),
  R('“Then your wait is over.”'), R('“I’m your lead investigator.”'), R('“My friends call me Rook.”'), A('“You?!?”', { beatBeforeMs: 700, beatAfterMs: 900, performanceCue: 'ARTHUR_ADJUST_GLASSES' }),
  R('“Yup! Yours truly.”'), A('“They’re not sending anyone else?”'), R('“Nope! It’s just me and you.”'), A('“I was afraid of that...”'), R('“I didn’t catch your name.”'),
  A('“I never threw it.”', { beatAfterMs: 500 }), A('“I’m Mr. A, the Archivist. My friends call me Arthur.”'), R('“So, Arthur—”'), A('“...But *you* can call me Mr. A.”'),
  R('“Well... by the end of this investigation, we’ll be closer than ever.”'), A('“I wouldn’t count on it.”'), R('“So...what is it exactly am I investigating?”'), R('“It sounded very important.”'),
  A('“You did read the case brief, didn’t you?”'), R('“Errm... case brief?”'), A('“You’re telling me the big-shot lead investigator for arguably one of the most significant cases this office has ever handled shows up alone... and without the case brief?”'),
  R('“Ohhhh... *that* case brief.”'), R('“It’s...uh...”'), R('“I must have left it in my car.”'), R('“It’s a long walk back.”'), R('“Maybe I can just borrow yours?”'),
  A('“We have an official office copy filed in the cabinet. It is available on a need-to-know basis... and without an approved authorization form, there is nothing that *you* need to know.”'),
  A('“Until then...”'), A('“I’ll give you the short version.”'), A('“Please pay attention.”'), R('“I’m fully focused.”', { beatAfterMs: 500 }), R('“Starting...now”'),
  A('“This is going to be a long day.”', { performanceCue: 'ARTHUR_CAMERA_TALK', beatAfterMs: 550 }), A('“Euler Finance was hacked. A large amount of digital assets was taken.”'),
  R('“Any witnesses?”'), A('“None.”'), R('“Any suspects?”'), A('“Not one we can identify from the record.”'), R('“Crime scene?”'), A('“The digital transactions *are* the crime scene.”'),
  A('“All we have is the public record of those transactions. The blockchain.”'), R('“The block...what?”'), A('“The BLOCKCHAIN. A public ledger.”'), A('“It records what moved... when it moved... and which wallet addresses sent and received it.”'),
  A('“Once recorded, those entries cannot simply be erased.”'), R('“So whoever did this left a trail.”'), A('“Yes.”'), R('“Great. This already sounds like a closed case to me. We just go to this public chain thingy and trace the activity.”'),
  A(`“*Public* is not the same as *simple*.”`), A('“The ledger is enormous... technical... and full of activity that has nothing to do with this case.”'), A(`“It’s like trying to find a needle in a mathematically precise ${wordFromCodes([104, 97, 121, 115, 116, 97, 99, 107])}.”`),
  R('“Sounds complicated.”'), A('“It is.”'), A('“Fortunately, our office has been authorized to use the Nansen™ API for this case. The case terminal already has the relevant records loaded.”'),
  A('“Nansen™ helps us organize and query the activity, sort through the noise, and surface patterns or relationships that would be difficult to spot manually.”'), R('“So Nansen™ solves the case for us?”'),
  A('“No. Nansen™ has organized the activity. It has not decided which activity matters. That is where you come in.”'), R('“So I need a clue.”'), A('“You need a question.”'), R('“I have several.”'), A('“One *relevant* question.”'),
  R('“Okay then...”'), R('“I’ll jump on the terminal and get started right away.”'), A('“*The Records Office* is authorized to use the Nansen™ API for this case.”'), A('“*You* are not authorized to use the case terminal.”'),
  R('“But...I’m the lead investigator!”'), A('“The more you remind me of that, the worse my migraine gets.”', { beatAfterMs: 350 }), A('“It does not matter who you are. You need to submit a terminal authorization form.”'),
  A('“It must pass through the appropriate management channels and receive approval from the shift manager.”'), R('“So...the management channel is you?”'), A('“It is company policy.”'), R('“Where do I get the form?”'),
  A('“Take a blank terminal authorization form from the dispenser.”'), A('“Fill it out COMPLETELY, then bring it back to me.”'), A('“Until you submit it, and unless management renders you a favorable response, do not use the terminal or access the case files.”'), A('“And DO NOT touch anything else!”'),
]

export const PRINCIPAL_OPENING: SpeechLine[] = FINAL_PRINCIPAL_OPENING

function punctuationGroups(text: string) {
  return text.match(/[.!?…]+|[,;:—]+/g)?.length ?? 0
}

const FULL_READING_SCALE: Record<DialoguePace, number> = {
  FAST: 1,
  NORMAL: 1.3,
  SLOW: 1.6,
}

const TYPED_READING_SCALE: Record<DialoguePace, number> = {
  FAST: 1,
  NORMAL: 1.25,
  SLOW: 1.5,
}

const TYPED_REVEAL_INTERVAL_MS: Record<DialoguePace, number> = {
  FAST: 100,
  NORMAL: 125,
  SLOW: 150,
}

export function dialogueRevealIntervalMs(pace: DialoguePace) {
  return TYPED_REVEAL_INTERVAL_MS[pace]
}

export function dialogueAdvanceDelayMs(line: Pick<SpeechLine, 'text' | 'beatBeforeMs' | 'beatAfterMs'>, pace: DialoguePace, display: DialogueDisplay = 'FULL') {
  const wordCount = line.text.trim().split(/\s+/).filter(Boolean).length
  const authoredBeat = Math.max(0, line.beatBeforeMs ?? 0) + Math.max(0, line.beatAfterMs ?? 0)
  if (display === 'FULL') {
    const normalReading = Math.max(1100, 600 + 220 * wordCount + Math.min(450, 80 * punctuationGroups(line.text)))
    const reading = Math.round(normalReading * FULL_READING_SCALE[pace])
    return reading + authoredBeat
  }
  const normalReading = 900 + Math.min(1700, wordCount * 58 + line.text.length * 7)
  const reading = Math.round(normalReading * TYPED_READING_SCALE[pace])
  return reading + authoredBeat
}

export const PRINCIPAL_INTERACTION_COPY = {
  penPickup: FINAL_PEN_PICKUP,
  completeForm: FINAL_FORM_COMPLETION,
  coffeeTalk: FINAL_COFFEE_TALK,
} satisfies Record<string, SpeechLine[]>
