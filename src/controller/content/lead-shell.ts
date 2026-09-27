import type { PuzzlePhase, SpeechLine } from '../../adventure/types'
import { contentText } from './adapter'
import { R2B_SEQUENCES, r2bText } from './s7-r3'
import { R55_OPENING } from '../../story/r55/production'

export const LEAD_SHELL_STATUS = 'EXACT_S7_R2B_CANDIDATE_PENDING_MAIN_REVIEW' as const

type LeadLine = SpeechLine & { id: string }
const line = (id: string, speaker: SpeechLine['speaker'], text: string): LeadLine => ({ id, speaker, text })

export const LEAD_OPENING: readonly LeadLine[] = [
  line('s7r2.opening.01', 'ROOK', 'This is the Records Office?'),
  line('s7r2.opening.02', 'MR_INDEX', 'It is the office in which records are kept. The sign was our first record.'),
  line('s7r2.opening.03', 'ROOK', 'Right. Mr. A—'),
  line('s7r2.opening.04', 'MR_INDEX', 'Arthur.'),
  line('s7r2.opening.05', 'ROOK', 'Efficient.'),
  line('s7r2.opening.06', 'MR_INDEX', 'Less efficient now.'),
  line('s7r2.opening.07', 'MR_INDEX', 'Your case was misfiled. To retrieve its opening record, submit a request.'),
  line('s7r2.opening.08', 'ROOK', 'To request a record, I need a record requesting the record.'),
  line('s7r2.opening.09', 'MR_INDEX', 'You are learning the system.'),
]

export function shellLine(entry: LeadLine, phase?: PuzzlePhase): SpeechLine {
  const context = phase ? { ['PHASE.' + phase]: true } : {}
  const text = entry.id.startsWith('lane_a.s7r2b.') ? r2bText(entry.id) : contentText(entry.id, entry.text, context)
  return { speaker: entry.speaker, text }
}
export function shellLines(entries: readonly LeadLine[], phase?: PuzzlePhase): SpeechLine[] { return entries.map((entry) => shellLine(entry, phase)) }

const PH = ''
export const INVENTORY_COPY = {
  'blank-terminal-authorization-form': 'A blank terminal-authorization form. It authorizes nothing yet.' + PH,
  'loose-feather-pen': 'A loose feather pen. It is not tethered to anything.' + PH,
  'signed-terminal-authorization-form-with-doodles': 'A signed completed form, with doodles in the margins.' + PH,
  'broken-feather-pen': 'A broken feather pen. It writes nothing, and it stays with Rook.' + PH,
  'approved-stamped-terminal-authorization-form': 'The approved stamped form, returned by Arthur. The terminal is authorized for today.' + PH,
  'euler-case-file': 'The official Euler case file. Its facts are already known; this file only rereads them.' + PH,
  'rubber-band': 'A rubber band of no investigative value.' + PH,
  'rubiks-cube': 'A Rubik\u2019s Cube of no investigative value.' + PH,
  'sharknado-2-vhs': 'A Sharknado 2 VHS of no investigative value.' + PH,
  'piggy-bank-intact': 'An intact piggy bank. It rattles faintly.' + PH,
  'small-toolbox-closed': 'A small closed toolbox. It rattles metallically.' + PH,
  'small-toolbox-open-empty': 'The small toolbox, open and empty. Its hammer and nails are already out.' + PH,
  'hammer': 'A hammer. It is retained after use.' + PH,
  'nails': 'A handful of nails.' + PH,
  'fictional-token-note': 'An office note with a token lead. Not Euler case evidence.' + PH,
} as const

export const DIALOGUE_COPY = {
  location: [line('s7r2.topic.location.01', 'MR_INDEX', 'The Records Office. Where events become records, records become questions, and questions become more records.')],
  misfiled: [line('s7r2.topic.misfiled.01', 'MR_INDEX', 'Someone filed a person under Pending. I corrected the category, not the condition.')],
  arthur: [line('s7r2.topic.arthur.01', 'MR_INDEX', 'Arthur.'), line('s7r2.topic.arthur.02', 'ROOK', 'I had not finished.'), line('s7r2.topic.arthur.03', 'MR_INDEX', 'I have.')],
  terminal: [line('s7r2.topic.terminal.01', 'MR_INDEX', 'A bounded record set. Public is not the same as simple.')],
  public: [line('s7r2.topic.public.01', 'MR_INDEX', 'Public means observable. Solved requires a question.')],
  lenses: [line('s7r2.topic.lenses.01', 'MR_INDEX', 'Activity asks what happened. Relationships ask who interacted. State asks what changed. Receipt asks which exact record establishes the link.')],
  exact: [line('s7r2.topic.exact.01', 'MR_INDEX', 'A specific record establishes a specific link. Context can point. It cannot sign.')],
  sports: [line('lane_a.s9.topic.sports.01', 'MR_INDEX', 'No scoreboard in the Records Office, Rook.')],
  health: [line('lane_a.s9.topic.health.01', 'MR_INDEX', 'The benefits package covers paper cuts.')],
  nansenBenefit: [line('lane_a.s9.topic.nansen-benefit.01', 'MR_INDEX', 'Nansen surfaces what already happened on chain. It files no forms for you.')],
} as const

export function leadTopicLines(id: keyof typeof DIALOGUE_COPY): SpeechLine[] { return shellLines(DIALOGUE_COPY[id]) }

export const TERMINAL_DIALOGUE = {
  wrongTheory: R2B_SEQUENCES.wrongTheory,
  exactCorrection: R2B_SEQUENCES.exactCorrection,
  ending: R2B_SEQUENCES.return,
  returnTag: R2B_SEQUENCES.returnTag,
} as const

export const EXACT_R2B_OPENING: SpeechLine[] = R55_OPENING
