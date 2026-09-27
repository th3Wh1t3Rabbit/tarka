import type { HotspotId, InventoryItemId, PuzzlePhase, SpeechLine, VerbId } from '../../adventure/types'
import type { ActorIntention, SoundIntent } from '../mission/performance'
import { RECORDS_OFFICE_STEPS } from '../mission/choreography'
import { sequenceForRule } from '../mission/performance'
import { r2bInteraction } from '../content/s7-r3'

export const HERO_HOTSPOTS = ['request-dispenser', 'pen-stand', 'mr-index', 'nansen-terminal', 'historical-clock', 'office-globe'] as const satisfies readonly HotspotId[]

export type InteractionClassification = 'REQUIRED_BLOCKING' | 'OPTIONAL_NONBLOCKING'
export interface SemanticInteraction {
  id: string
  verb: VerbId
  targetId: HotspotId
  copyIds: readonly string[]
  lines: readonly SpeechLine[]
  actorIntentions: readonly { actor: 'ROOK' | 'ARTHUR'; intention: ActorIntention }[]
  soundIntent: SoundIntent | null
  soundCaption: string | null
  repeatIndex: number
  classification: InteractionClassification
  stateEffects: readonly ['NONE'] | readonly ['PROGRESSION_RULE']
}

type OptionalEntry = { text: string; speaker?: SpeechLine['speaker']; arthur?: string; sound?: SoundIntent; caption?: string }
const optional = (text: string, extra: Omit<OptionalEntry, 'text'> = {}): OptionalEntry => ({ text, ...extra })
const rows: Record<typeof HERO_HOTSPOTS[number], Partial<Record<VerbId, OptionalEntry>>> = {
  'request-dispenser': {
    GIVE: optional('It only gives. It does not accept returns, criticism, or personal growth.'), PULL: optional('The dispenser does not release the sheet. The blank form is the thing to pick up.'), PICK_UP: optional('It appears to be holding up several regulations.'), USE: optional('I need something worth combining with a machine that already has a purpose.'), OPEN: optional('The service panel is not a shortcut.', { speaker: 'MR_INDEX', arthur: 'So it is a long cut.' }), LOOK_AT: optional('An authorization form dispenser. One sheet per problem, which feels optimistic.'), PUSH: optional('It pushes back with the confidence of policy.'), CLOSE: optional('It is closed in every meaningful bureaucratic sense.'), TALK_TO: optional('I ask for expedited service. It dispenses silence.'),
  },
  'pen-stand': {
    GIVE: optional('The pens belong to the desk. Arthur has documentation.'), PICK_UP: optional('The inkwell sits empty. The pen is already in hand.'), OPEN: optional('There is no lid. Bureaucracy has finally simplified something.'), LOOK_AT: optional('An inkwell. The feather pen is loose.'), PUSH: optional('It remains upright and morally superior.'), CLOSE: optional('The pens are uncapped only emotionally.'), TALK_TO: optional('Blue ink has always been aloof.'), PULL: optional('The stand is fixed to the counter.'),
  },
  'mr-index': {
    GIVE: optional('This is not a recognized request.', { speaker: 'MR_INDEX', arthur: 'It is recognizable.\nThat is not the same thing.' }), PICK_UP: optional('He would file an objection before leaving the floor.'), USE: optional('Conversation first. Equipment second.'), OPEN: optional('I am not opening Arthur.'), LOOK_AT: optional('Arthur the Archivist. He has alphabetized his patience.'), PUSH: optional('I choose not to test the load-bearing capacity of civil service.'), CLOSE: optional('He looks pre-closed.'), PULL: optional('Arthur is not a drawer.'),
  },
  'nansen-terminal': {
    GIVE: optional('No mouth. Probably for the best.'), PICK_UP: optional('It is desk-sized in the way a desk is floor-sized.'), USE: optional('The terminal waits for structured questions.'), OPEN: optional('I am not voiding the warranty on history.'), LOOK_AT: optional('A terminal with the posture of a locked filing cabinet.'), PUSH: optional('The screen blooms green, then judges me.'), CLOSE: optional('I can leave the screen. The case stays.'), TALK_TO: optional('Hello?', { arthur: '[BZZZT.]\nIt prefers structured questions.', sound: 'SFX.CRT_CONFIRM', caption: '[BZZZT.]' }), PULL: optional('The terminal is attached to the part of the building with electricity.'),
  },
  'historical-clock': {
    GIVE: optional('Time already has everything I own.'), PICK_UP: optional('It is bolted down, presumably against hindsight.'), USE: optional('No item in my pockets can improve chronology.'), OPEN: optional('Do not audit the clock.', { speaker: 'MR_INDEX', arthur: 'That sounds like clock talk.' }), LOOK_AT: optional('It keeps historical time, which is just time with paperwork.'), PUSH: optional('Time advances only in the usual, expensive direction.'), CLOSE: optional('The case can close. The clock remains open for business.'), TALK_TO: optional('It ticks in short, well-documented statements.'), PULL: optional('The minute hand refuses informal discovery.'),
  },
  'office-globe': {
    GIVE: optional('Arthur already has jurisdiction.'), PICK_UP: optional("Arthur’s left eyebrow files a prior restraint."), USE: optional('I do not yet have a world-sized problem. Give it a minute.'), OPEN: optional('No seam. Probably classified.'), LOOK_AT: optional('The world, reduced to something Arthur can keep on a desk.'), CLOSE: optional('It is already a closed world.'), TALK_TO: optional('I ask where the money went. The globe remains broadly unhelpful.'), PULL: optional('It rotates. The planet remains attached.'),
  },
}

const globePush: readonly SpeechLine[][] = [
  [{ speaker: 'ROOK', text: 'Continents in motion.' }, { speaker: 'MR_INDEX', text: 'They were correctly filed.' }],
  [{ speaker: 'ROOK', text: 'I am checking for alternate routes.' }, { speaker: 'MR_INDEX', text: 'You are checking my patience.' }],
  [{ speaker: 'ROOK', text: 'Mr. A—' }, { speaker: 'MR_INDEX', text: 'Arthur.' }, { speaker: 'ROOK', text: 'The globe likes me.' }, { speaker: 'MR_INDEX', text: 'The globe has no standards.' }],
  [{ speaker: 'MR_INDEX', text: 'Mr. Rook.' }, { speaker: 'ROOK', text: 'That is first-name progress.' }],
]

const requiredLeadLines: Readonly<Record<string, readonly SpeechLine[]>> = {
  'take-form': [{ speaker: 'ROOK', text: 'Blank authorization form.' }],
  'take-form-2': [{ speaker: 'ROOK', text: 'Blank authorization form.' }],
  'take-pen': [{ speaker: 'ROOK', text: 'Loose feather pen. Nobody chained this one.' }],
  'take-pen-2': [{ speaker: 'ROOK', text: 'Loose feather pen. Nobody chained this one.' }],
  'give-form': [{ speaker: 'ROOK', text: 'Completed form, with doodles.' }, { speaker: 'MR_INDEX', text: 'Reviewed. Stamped. Returned. The terminal is authorized for today.' }],
  'reprimand-start': [{ speaker: 'MR_INDEX', text: 'Not yet, Rook. Authorization first.' }],
  'reprimand-form-held': [{ speaker: 'MR_INDEX', text: 'Not yet, Rook. Authorization first.' }],
  'reprimand-pen-held': [{ speaker: 'MR_INDEX', text: 'Not yet, Rook. Authorization first.' }],
  'reprimand-form-and-pen': [{ speaker: 'MR_INDEX', text: 'Not yet, Rook. Authorization first.' }],
  'reprimand-form-completed': [{ speaker: 'MR_INDEX', text: 'Bring it here first, Rook. Then the terminal.' }],
  'reprimand-form-submitted': [{ speaker: 'MR_INDEX', text: 'Under review, Rook. One moment.' }],
}

function optionalLines(entry: OptionalEntry): SpeechLine[] {
  const first = { speaker: entry.speaker ?? 'ROOK', text: entry.text } as SpeechLine
  if (!entry.arthur) return [first]
  const additional = entry.arthur.split('\n').map((text, index): SpeechLine => ({ speaker: index % 2 === 0 ? (first.speaker === 'MR_INDEX' ? 'ROOK' : 'MR_INDEX') : first.speaker, text }))
  return [first, ...additional]
}

export function resolveHeroInteraction(verb: VerbId, targetId: HotspotId, phase: PuzzlePhase, itemId: InventoryItemId | null, priorRepeats = 0): SemanticInteraction {
  if (!HERO_HOTSPOTS.includes(targetId as typeof HERO_HOTSPOTS[number])) throw new Error(`NOT_HERO_HOTSPOT:${targetId}`)
  const required = RECORDS_OFFICE_STEPS.find((step) => step.verb === verb && step.target === targetId && step.phaseBefore === phase && step.requiredItem === itemId)
  if (required) {
    const selected = r2bInteraction(targetId, verb, priorRepeats)
    // Rule-level Lead lines outrank generic matrix cells for required
    // interactions. (The retired flow's matrix cells still shadow optional
    // flavor, which the Story lane rebinds; required progression must render
    // the rule's own structural placeholders instead of stale cell copy.)
    const lead = requiredLeadLines[required.id]
    const lines = lead ?? (selected?.behavior === null ? selected.lines : [])
    const copyIds = lead ? lead.map((_, index) => `s7r2.interaction.required.${required.id}.${index + 1}`) : (selected?.copyIds ?? [`s7r2.interaction.required.${required.id}`])
    const sequence = sequenceForRule(required.id)
    const sound = sequence?.actions.find((action) => action.sound)
    return { id: `INTERACTION.REQUIRED.${required.id}`, verb, targetId, copyIds, lines, actorIntentions: [{ actor: 'ROOK', intention: verb === 'LOOK_AT' ? 'READ' : verb === 'PICK_UP' ? 'PICK_UP' : verb === 'GIVE' ? 'GIVE' : 'USE' }], soundIntent: sound?.sound ?? (required.id === 'take-form' || required.id === 'take-form-2' ? 'SFX.PAPER_PULL' : required.id === 'take-pen' || required.id === 'take-pen-2' ? 'SFX.PEN_SCRATCH' : null), soundCaption: sound?.caption ?? null, repeatIndex: 0, classification: 'REQUIRED_BLOCKING', stateEffects: ['PROGRESSION_RULE'] }
  }
  if (targetId === 'mr-index' && verb === 'TALK_TO') return { id: 'INTERACTION.OPTIONAL.mr-index.TALK_TO', verb, targetId, copyIds: ['s7r2.dialogue.menu'], lines: [], actorIntentions: [{ actor: 'ROOK', intention: 'TALK' }, { actor: 'ARTHUR', intention: 'LISTEN' }], soundIntent: null, soundCaption: null, repeatIndex: priorRepeats, classification: 'OPTIONAL_NONBLOCKING', stateEffects: ['NONE'] }
  if (targetId === 'office-globe' && verb === 'PUSH') {
    const repeatIndex = Math.min(priorRepeats, globePush.length - 1)
    const selected = r2bInteraction(targetId, verb, repeatIndex)!
    return { id: 'INTERACTION.OPTIONAL.office-globe.PUSH', verb, targetId, copyIds: selected.copyIds, lines: selected.lines, actorIntentions: [{ actor: 'ROOK', intention: 'USE' }, { actor: 'ARTHUR', intention: 'TALK' }], soundIntent: 'SFX.GLOBE_SPIN', soundCaption: null, repeatIndex, classification: 'OPTIONAL_NONBLOCKING', stateEffects: ['NONE'] }
  }
  if (targetId === 'request-dispenser' && (verb === 'PULL' || verb === 'PICK_UP')) {
    const entry = rows['request-dispenser'][verb]!
    return { id: `INTERACTION.OPTIONAL.request-dispenser.${verb}`, verb, targetId, copyIds: [`s12p2r4.dispenser.${verb.toLowerCase()}`], lines: optionalLines(entry), actorIntentions: [{ actor: 'ROOK', intention: 'USE' }], soundIntent: null, soundCaption: null, repeatIndex: priorRepeats, classification: 'OPTIONAL_NONBLOCKING', stateEffects: ['NONE'] }
  }
  const entry = rows[targetId as typeof HERO_HOTSPOTS[number]]?.[verb]
  const selected = r2bInteraction(targetId, verb, priorRepeats)
  const id = `INTERACTION.OPTIONAL.${targetId}.${verb}`
  return { id, verb, targetId, copyIds: selected?.copyIds ?? [id], lines: selected?.lines ?? (entry ? optionalLines(entry) : []), actorIntentions: [{ actor: 'ROOK', intention: verb === 'TALK_TO' ? 'TALK' : verb === 'LOOK_AT' ? 'INSPECT' : 'USE' }], soundIntent: entry?.sound ?? null, soundCaption: entry?.caption ?? null, repeatIndex: priorRepeats, classification: 'OPTIONAL_NONBLOCKING', stateEffects: ['NONE'] }
}
