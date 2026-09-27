// S9-P1 structural placeholder copy. Every entry is keyed by its FUTURE Story-lane
// content key; the English text is an explicitly marked structural placeholder that
// the Story lane replaces at content binding. Resolution uses the existing
// contentText/officeLines fallback path, so NO versioned catalog changes were needed
// and all pinned content identities hold. Nothing here is final copy.
import type { HintTier } from './adapter'
import type { PuzzlePhase, SpeechLine } from '../../adventure/types'

export interface PlaceholderCopy { key: string; speaker: SpeechLine['speaker']; text: string }
const ph = (key: string, speaker: PlaceholderCopy['speaker'], text: string): PlaceholderCopy => ({ key, speaker, text: text.replace(' [PLACEHOLDER — Story binds final copy]', '') })
const K = 'lane_a.s9.'

// Office hints: procedural goals only. Never names verb selection or inventory click order.
export const S9_OFFICE_HINTS: Record<PuzzlePhase, Record<HintTier, PlaceholderCopy>> = {
  START: {
    METHOD_HINT: ph(`${K}hint.start.method`, 'MR_INDEX', 'Work the authorization procedure: obtain the form, fill it out, return it. [PLACEHOLDER — Story binds final copy]'),
    CASE_HINT: ph(`${K}hint.start.case`, 'MR_INDEX', 'Arthur authorizes terminal use after a completed form is reviewed and returned. [PLACEHOLDER — Story binds final copy]'),
    DIRECT_HINT: ph(`${K}hint.start.direct`, 'MR_INDEX', 'A blank authorization form waits in the dispenser by the counter, and a loose pen sits in the inkwell. [PLACEHOLDER — Story binds final copy]'),
  },
  FORM_HELD: {
    METHOD_HINT: ph(`${K}hint.form-held.method`, 'MR_INDEX', 'The form needs the pen before Arthur will review it. [PLACEHOLDER — Story binds final copy]'),
    CASE_HINT: ph(`${K}hint.form-held.case`, 'MR_INDEX', 'A blank form alone authorizes nothing. [PLACEHOLDER — Story binds final copy]'),
    DIRECT_HINT: ph(`${K}hint.form-held.direct`, 'MR_INDEX', 'The loose pen in the inkwell completes the form. [PLACEHOLDER — Story binds final copy]'),
  },
  PEN_HELD: {
    METHOD_HINT: ph(`${K}hint.pen-held.method`, 'MR_INDEX', 'The pen needs the blank form before Arthur will review anything. [PLACEHOLDER — Story binds final copy]'),
    CASE_HINT: ph(`${K}hint.pen-held.case`, 'MR_INDEX', 'A loose pen alone authorizes nothing. [PLACEHOLDER — Story binds final copy]'),
    DIRECT_HINT: ph(`${K}hint.pen-held.direct`, 'MR_INDEX', 'The dispenser by the counter holds the blank authorization form. [PLACEHOLDER — Story binds final copy]'),
  },
  FORM_AND_PEN: {
    METHOD_HINT: ph(`${K}hint.form-and-pen.method`, 'MR_INDEX', 'Fill out the form, then return it. [PLACEHOLDER — Story binds final copy]'),
    CASE_HINT: ph(`${K}hint.form-and-pen.case`, 'MR_INDEX', 'Form plus pen becomes a completed form with doodles. [PLACEHOLDER — Story binds final copy]'),
    DIRECT_HINT: ph(`${K}hint.form-and-pen.direct`, 'MR_INDEX', 'The blank form and the loose pen belong together. [PLACEHOLDER — Story binds final copy]'),
  },
  FORM_COMPLETED: {
    METHOD_HINT: ph(`${K}hint.form-completed.method`, 'MR_INDEX', 'Return the completed form to Arthur for review. [PLACEHOLDER — Story binds final copy]'),
    CASE_HINT: ph(`${K}hint.form-completed.case`, 'MR_INDEX', 'Only Arthur can approve the completed form. [PLACEHOLDER — Story binds final copy]'),
    DIRECT_HINT: ph(`${K}hint.form-completed.direct`, 'MR_INDEX', 'Bring the signed completed form with doodles to Arthur behind the counter. [PLACEHOLDER — Story binds final copy]'),
  },
  FORM_SUBMITTED: {
    METHOD_HINT: ph(`${K}hint.form-submitted.method`, 'MR_INDEX', 'Arthur is reviewing the form. [PLACEHOLDER — Story binds final copy]'),
    CASE_HINT: ph(`${K}hint.form-submitted.case`, 'MR_INDEX', 'The review completes on its own. [PLACEHOLDER — Story binds final copy]'),
    DIRECT_HINT: ph(`${K}hint.form-submitted.direct`, 'MR_INDEX', 'Wait for Arthur to return the stamped form. [PLACEHOLDER — Story binds final copy]'),
  },
  COMPLETE: {
    METHOD_HINT: ph(`${K}hint.complete.method`, 'MR_INDEX', 'Find the official case file, then the terminal. [PLACEHOLDER — Story binds final copy]'),
    CASE_HINT: ph(`${K}hint.complete.case`, 'MR_INDEX', 'The official case-file cabinet holds the Euler file. [PLACEHOLDER — Story binds final copy]'),
    DIRECT_HINT: ph(`${K}hint.complete.direct`, 'MR_INDEX', 'The Euler file is inside the official case-file cabinet. The terminal comes after. [PLACEHOLDER — Story binds final copy]'),
  },
}

// Bounded reminder barks: at most two, NONBLOCKING, never gate progress.
export const BARK_1_AFTER_S = 75
export const BARK_2_AFTER_S = 165
export const S9_FORM_BARK_1: PlaceholderCopy = ph(`${K}bark.form-1`, 'MR_INDEX', 'Rook. The authorization form, when you are ready. [PLACEHOLDER — Story binds final copy]')
export const S9_FORM_BARK_2: PlaceholderCopy = ph(`${K}bark.form-2`, 'MR_INDEX', 'Still waiting on that form, Rook. [PLACEHOLDER — Story binds final copy]')

// State-aware form reminder topic replies, keyed by office phase.
export const S9_FORM_REMINDER_REPLIES: Record<PuzzlePhase, PlaceholderCopy> = {
  START: ph(`${K}topic.form-reminder.start`, 'MR_INDEX', 'The blank form. The loose pen. Then me. [PLACEHOLDER — Story binds final copy]'),
  FORM_HELD: ph(`${K}topic.form-reminder.form-held`, 'MR_INDEX', 'Now the loose pen, then the form is fillable. [PLACEHOLDER — Story binds final copy]'),
  PEN_HELD: ph(`${K}topic.form-reminder.pen-held`, 'MR_INDEX', 'Now the blank form, then the form is fillable. [PLACEHOLDER — Story binds final copy]'),
  FORM_AND_PEN: ph(`${K}topic.form-reminder.form-and-pen`, 'MR_INDEX', 'Fill it out, then bring it to me. [PLACEHOLDER — Story binds final copy]'),
  FORM_COMPLETED: ph(`${K}topic.form-reminder.form-completed`, 'MR_INDEX', 'That looks complete. Hand it over. [PLACEHOLDER — Story binds final copy]'),
  FORM_SUBMITTED: ph(`${K}topic.form-reminder.form-submitted`, 'MR_INDEX', 'Under review. One moment. [PLACEHOLDER — Story binds final copy]'),
  COMPLETE: ph(`${K}topic.form-reminder.complete`, 'MR_INDEX', 'Authorized. The official case file is next. [PLACEHOLDER — Story binds final copy]'),
}

export const S9_CASE_FILE_REMINDER: PlaceholderCopy = ph(`${K}topic.case-file-reminder`, 'MR_INDEX', 'The official case-file cabinet. The Euler file. Then the terminal. [PLACEHOLDER — Story binds final copy]')

// Terminal stage-2 empty-known-inputs status (late-bound content arrives with Story copy).
export const S9_EMPTY_KNOWN_INPUTS_STATUS: PlaceholderCopy = ph(`${K}terminal.empty-known-inputs`, 'SYSTEM', 'No known inputs yet. Collect the official case file to establish DAI, address, and amount. [PLACEHOLDER — Story binds final copy]')
