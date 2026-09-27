import registryJson from './generated/r55-registry.json'

export const R55_ACTIVATION = 'NOT_PRODUCTION_ACTIVE_UNTIL_LATER_GATE' as const
export type R55Input = 'pointer' | 'keyboard' | 'touch'

export type R55Predicate =
  | { type: 'NOT_ASKED'; topic: string }
  | { type: 'STATE_IN'; states: string[] }
  | { type: 'STATE_NOT_IN'; states: string[] }
  | { type: 'ALL'; predicates: R55Predicate[] }
export interface R55Effect { type: 'MARK_TOPIC_ASKED' | 'SET_STORY_STATE'; topic?: string; state?: string; once: boolean; sourceId: string }
export interface R55Edge { kind: string; source: string; target: string; predicate: R55Predicate | null; effects: R55Effect[] }
export interface R55Cue {
  actor: string
  intent: string
  sourceText: string
  subjectResolution: 'EXPLICIT_LEADING_SUBJECT' | 'INHERITED_LEADING_PRONOUN' | 'INHERITED_SUBJECTLESS_CONTINUATION' | 'AMBIGUOUS_UNRESOLVED'
  leadingSubject: string | null
  preferredClip: string | null
  selectedClip: string | null
  manifestPath: string
  manifestBlob: string
  manifestSha256: string
  selectionBlob: string
  selectionSha256: string
  membership: boolean
  fallback: boolean
  fallbackReason: string | null
  changesStoryMeaning: false
}
export interface R55Node {
  id: string
  ledgerId: string
  kind: string
  owner: string
  speaker: string | null
  text: string
  anchor: string
  source: { path: string; byteStart: number; byteEnd: number; lineStart: number; lineEnd: number }
  cues: R55Cue[]
  activation: typeof R55_ACTIVATION
  playableMission02: false
  entrypoint?: boolean
}
export interface R55Registry {
  schemaVersion: string
  activation: typeof R55_ACTIVATION
  archiveSha256: string
  catalog: { manifestPath: string; manifestBlob: string; manifestSha256: string; selectionOwner: string; selectionBlob: string; selectionSha256: string; clips: { rook: string[]; arthur: string[] } }
  a1: { sha256: string; phraseSource: string; phraseNodeId: string; hieroglyphsPresent: boolean }
  title: { publicTitle: string; displayWordmark: string; internalCodename: string; controls: string[]; activation: typeof R55_ACTIVATION }
  mission02: { playable: boolean; inGraph: boolean; stingerText: string; activation: typeof R55_ACTIVATION }
  namedRoutes: { direct: string; curious: string; mistaken: string; coreSequence: string }
  sourceMembers: Record<string, { bytes: number; sha256: string }>
  sourceLedger: { id: string; path: string; semanticClass?: string; classification?: string; inGraph: boolean; byteStart: number; byteEnd: number; rawText: string; rawSha256: string; displayText: string }[]
  cueSubjectAudit: {
    rule: string
    totalCues: number
    explicitCount: number
    inheritedCount: number
    unresolvedCount: number
    records: { nodeId: string; cueIndex: number; sourceText: string; actor: string; subjectResolution: R55Cue['subjectResolution']; leadingSubject: string | null }[]
  }
  graph: { nodes: R55Node[]; edges: R55Edge[]; entrypoints: { id: string; name: string; kind: string }[]; stateMachine: { authoredOccurrences: number; uniqueEdges: number } }
}
export interface R55Session {
  startId: string
  initialStoryState: string | null
  nodeId: string
  cueIndex: number
  revealed: boolean
  askedTopics: string[]
  storyState: string | null
  appliedOnceIds: string[]
  rejectedEdge: boolean
  lastSelectedEdge: { kind: string; source: string; target: string; effects: R55Effect[] } | null
}

export const r55Registry = registryJson as R55Registry
const nodes = new Map(r55Registry.graph.nodes.map((node) => [node.id, node]))
const outgoing = new Map<string, R55Edge[]>()
for (const edge of r55Registry.graph.edges) outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge])

export function r55Node(id: string): R55Node {
  const node = nodes.get(id)
  if (!node) throw new Error(`missing R55 node ${id}`)
  return node
}

export function edgesOf(id: string): R55Edge[] {
  return outgoing.get(id) ?? []
}

export function firstMultiCueNode(): R55Node {
  const node = r55Registry.graph.nodes.find((item) => item.kind === 'dialogueLine' && item.cues.length >= 2 && edgesOf(item.id).some((edge) => edge.kind === 'AUTHORED_FENCE_SEQUENCE'))
  if (!node) throw new Error('missing multi-cue line')
  return node
}

export function createR55Session(startId = firstMultiCueNode().id, storyState: string | null = null): R55Session {
  return { startId, initialStoryState: storyState, nodeId: startId, cueIndex: 0, revealed: false, askedTopics: [], storyState, appliedOnceIds: [], rejectedEdge: false, lastSelectedEdge: null }
}

function effectId(effect: R55Effect): string {
  return `${effect.type}:${effect.topic ?? effect.state ?? ''}:${effect.sourceId}`
}

function applyEffects(session: R55Session, effects: R55Effect[]): R55Session {
  const next = { ...session, askedTopics: [...session.askedTopics], appliedOnceIds: [...session.appliedOnceIds] }
  for (const effect of effects) {
    const id = effectId(effect)
    if (effect.type === 'MARK_TOPIC_ASKED' && effect.topic && next.askedTopics.includes(effect.topic)) continue
    if (effect.once && next.appliedOnceIds.includes(id)) continue
    if (effect.once) next.appliedOnceIds.push(id)
    if (effect.type === 'MARK_TOPIC_ASKED' && effect.topic && !next.askedTopics.includes(effect.topic)) next.askedTopics.push(effect.topic)
    if (effect.type === 'SET_STORY_STATE' && effect.state) next.storyState = effect.state
  }
  return next
}

export function predicateAllows(session: R55Session, predicate: R55Predicate | null): boolean {
  if (!predicate) return true
  if (predicate.type === 'NOT_ASKED') return !session.askedTopics.includes(predicate.topic)
  if (predicate.type === 'STATE_IN') return session.storyState !== null && predicate.states.includes(session.storyState)
  if (predicate.type === 'STATE_NOT_IN') return session.storyState === null || !predicate.states.includes(session.storyState)
  if (predicate.type === 'ALL') return predicate.predicates.every((item) => predicateAllows(session, item))
  return false
}

export function predicateReason(session: R55Session, predicate: R55Predicate | null): string | null {
  if (!predicate || predicateAllows(session, predicate)) return null
  if (predicate.type === 'NOT_ASKED') return `already asked: ${predicate.topic}`
  if (predicate.type === 'STATE_IN') return `requires state: ${predicate.states.join(' | ')}`
  if (predicate.type === 'STATE_NOT_IN') return `unavailable in state: ${session.storyState ?? 'none'}`
  return predicate.predicates.map((item) => predicateReason(session, item)).filter(Boolean).join('; ')
}

export function validEdges(session: R55Session): R55Edge[] {
  return edgesOf(session.nodeId).filter((edge) => predicateAllows(session, edge.predicate))
}

export function advanceR55(session: R55Session, input: R55Input = 'pointer'): R55Session {
  void input
  const node = r55Node(session.nodeId)
  if (!session.revealed) return { ...session, revealed: true, rejectedEdge: false }
  if (session.cueIndex + 1 < node.cues.length) return { ...session, cueIndex: session.cueIndex + 1, rejectedEdge: false }
  const available = validEdges(session)
  const sequential = available.filter((edge) => edge.kind === 'AUTHORED_FENCE_SEQUENCE' || edge.kind === 'STATE_MACHINE' || edge.kind === 'TOPIC_RESPONSE')
  const choices = available.filter((edge) => edge.kind === 'TOPIC_CHOICE')
  if (sequential.length === 1 && choices.length === 0) {
    const edge = sequential[0]
    if (!edge) return session
    const next = applyEffects(session, edge.effects)
    return { ...next, nodeId: edge.target, cueIndex: 0, revealed: false, rejectedEdge: false, lastSelectedEdge: { kind: edge.kind, source: edge.source, target: edge.target, effects: edge.effects } }
  }
  return { ...session, rejectedEdge: false }
}

export function chooseR55(session: R55Session, edge: R55Edge): R55Session {
  if (edge.source !== session.nodeId) return { ...session, rejectedEdge: true }
  if (!predicateAllows(session, edge.predicate)) return { ...session, rejectedEdge: true }
  const next = applyEffects(session, edge.effects)
  const target = r55Node(edge.target)
  if (target.kind === 'choice' && edgesOf(target.id).every((candidate) => !predicateAllows(next, candidate.predicate))) return { ...session, rejectedEdge: true }
  return { ...next, nodeId: edge.target, cueIndex: 0, revealed: false, rejectedEdge: false, lastSelectedEdge: { kind: edge.kind, source: edge.source, target: edge.target, effects: edge.effects } }
}

export function resetR55(session: R55Session): R55Session {
  return createR55Session(session.startId, session.initialStoryState)
}

export function displayedText(session: R55Session): string {
  return r55Node(session.nodeId).text
}

export function r55LedgerEntry(id: string) {
  const entry = r55Registry.sourceLedger.find((item) => item.id === id)
  if (!entry) throw new Error(`missing R55 ledger entry ${id}`)
  return entry
}

export function clipAdmitted(clip: string | null): boolean {
  if (!clip) return false
  const match = /characters\.(rook|mrIndex)\.animations\.([A-Za-z0-9]+)/.exec(clip)
  if (!match?.[2]) return false
  const actor = match[1] === 'mrIndex' ? 'arthur' : 'rook'
  return r55Registry.catalog.clips[actor].includes(match[2])
}
