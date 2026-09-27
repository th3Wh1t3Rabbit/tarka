export const PROP_STATE_IDS = {
  requestDispenser: ['loaded', 'outputting', 'empty'],
  requestTicket: ['world.blank', 'inventory.blank', 'inventory.completed', 'inventory.stamped', 'handoff'],
  penStand: ['full', 'empty', 'pen.inventory'],
  dispatchPlunger: ['up', 'pressing', 'down', 'recovering'],
  recordCanister: ['closed', 'opening', 'open', 'closing', 'with_record', 'empty'],
  nansenTerminal: ['dormant', 'boot_1', 'boot_2', 'active_idle_a', 'active_idle_b', 'prompt', 'processing', 'alert', 'result'],
  caseAccessArtifact: ['idle', 'glint_a', 'glint_b', 'recognized'],
  ledger: ['closed', 'opening', 'open', 'page_turn', 'marked', 'stamped'],
  deskLamp: ['off', 'on', 'glow_a', 'glow_b'],
  globe: ['idle', 'spin_a', 'spin_b', 'settle'],
  mug: ['idle', 'steam_a', 'steam_b'],
  filingCabinet: ['closed', 'opening', 'open', 'closing'],
  door: ['closed', 'opening', 'open', 'closing', 'locked'],
} as const

export type PropFamily = keyof typeof PROP_STATE_IDS
export type PropState = typeof PROP_STATE_IDS[PropFamily][number]

export interface PropRuntimeState { family: PropFamily; state: string }

const TRANSITIONS: Partial<Record<PropFamily, Record<string, string[]>>> = {
  requestDispenser: { loaded: ['outputting'], outputting: ['empty'], empty: ['loaded'] },
  requestTicket: { 'world.blank': ['inventory.blank'], 'inventory.blank': ['inventory.completed'], 'inventory.completed': ['inventory.stamped'], 'inventory.stamped': ['handoff'], handoff: [] },
  penStand: { full: ['empty', 'pen.inventory'], empty: ['full'], 'pen.inventory': ['full'] },
  dispatchPlunger: { up: ['pressing'], pressing: ['down'], down: ['recovering'], recovering: ['up'] },
  recordCanister: { closed: ['opening', 'with_record'], with_record: ['opening'], opening: ['open'], open: ['closing', 'empty'], empty: ['closing'], closing: ['closed'] },
  nansenTerminal: { dormant: ['boot_1'], boot_1: ['boot_2'], boot_2: ['active_idle_a'], active_idle_a: ['active_idle_b', 'prompt'], active_idle_b: ['active_idle_a', 'prompt'], prompt: ['processing'], processing: ['alert', 'result'], alert: ['prompt'], result: ['prompt'] },
  caseAccessArtifact: { idle: ['glint_a', 'recognized'], glint_a: ['glint_b'], glint_b: ['idle', 'recognized'], recognized: ['idle'] },
  ledger: { closed: ['opening'], opening: ['open'], open: ['page_turn', 'marked', 'closing'], page_turn: ['open'], marked: ['stamped', 'open'], stamped: ['open'] },
  deskLamp: { off: ['on'], on: ['off', 'glow_a'], glow_a: ['glow_b', 'off'], glow_b: ['glow_a', 'off'] },
  globe: { idle: ['spin_a'], spin_a: ['spin_b'], spin_b: ['spin_a', 'settle'], settle: ['idle'] },
  mug: { idle: ['steam_a'], steam_a: ['steam_b', 'idle'], steam_b: ['steam_a', 'idle'] },
  filingCabinet: { closed: ['opening'], opening: ['open'], open: ['closing'], closing: ['closed'] },
  door: { closed: ['opening', 'locked'], opening: ['open'], open: ['closing'], closing: ['closed'], locked: ['closed'] },
}

export function initialPropState(family: PropFamily): PropRuntimeState {
  return { family, state: PROP_STATE_IDS[family][0] }
}

export function transitionProp(current: PropRuntimeState, nextState: string): PropRuntimeState {
  if (!(PROP_STATE_IDS[current.family] as readonly string[]).includes(nextState)) throw new Error(`Unknown ${current.family} state: ${nextState}`)
  const allowed = TRANSITIONS[current.family]?.[current.state]
  if (allowed && !allowed.includes(nextState)) throw new Error(`Illegal ${current.family} transition: ${current.state} -> ${nextState}`)
  return { ...current, state: nextState }
}

export function propMeaning(state: PropRuntimeState) {
  return `${state.family}:${state.state}`
}
