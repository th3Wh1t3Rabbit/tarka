import candidate from '../../../artifacts/g6p-s3/REPORTS/TE_IFACE_CORPUS_FINAL_CANDIDATE.json'
import scenario from '../../../public/scenarios/euler-2023-false-exit/scenario.json'
import graph from '../../../public/scenarios/euler-2023-false-exit/evidence-graph.json'
import content from '../content/runtime-content.json'
import { buildFrozenFixture } from '../../investigation/fixture'
import { admitFrozenCorpusCandidate } from '../../investigation/corpus-seam/authority.mjs'
import { browse, createCanonicalView, type BrowseQuery } from '../../investigation/semantic-ux/model'
import { usefulRules } from '../../adventure/content'
import { availableCards, createInvestigationState, investigationReducer } from '../../investigation/state'
import { dispatchQuery } from '../../investigation/query'

/** Closed pre-archive performance contract: semantics and honest fallback only. */
export function validatePreArchiveBeat(value: unknown): true {
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v))
  const closed = (v: unknown, allowed: string[], required = allowed): v is Record<string, unknown> => object(v) && Reflect.ownKeys(v).every(key => typeof key === 'string' && allowed.includes(key) && Object.hasOwn(Object.getOwnPropertyDescriptor(v, key)!, 'value')) && required.every(key => Object.hasOwn(v, key))
  const fail = () => { throw Error('S6_R1_PREARCHIVE_BINDING_REJECTED') }
  const keys = ['id', 'controllerState', 'requiredClueIds', 'requiredCardIds', 'acceptedCorpus', 'copyRefs', 'optionalCopy', 'props', 'performance', 'sound', 'failureRecovery', 'claimBoundary', 'provenance']
  if (!closed(value, keys)) return fail()
  const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim()
  // Candidate arrays are never iterated or read through their methods/indexes.
  // Check the exact prototype BEFORE obtaining length, descriptors or values.
  // Snapshots are validator-owned, derived only from accepted data descriptors.
  const snapshots = new WeakMap<object, readonly unknown[]>()
  const arrayValues = (v: unknown): readonly unknown[] => {
    if (!Array.isArray(v) || Object.getPrototypeOf(v) !== Array.prototype) return fail()
    const cached = snapshots.get(v)
    if (cached) return cached
    const descriptors = Object.getOwnPropertyDescriptors(v as object)
    const length = descriptors.length
    if (!length || !Object.hasOwn(length, 'value') || typeof length.value !== 'number' || !Number.isSafeInteger(length.value) || length.value < 0) return fail()
    const size = length.value
    const ownKeys = Reflect.ownKeys(descriptors)
    if (ownKeys.length !== size + 1) return fail()
    for (let i = 0; i < ownKeys.length; i++) {
      const key = ownKeys[i]!
      if (key === 'length') continue
      if (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || !Number.isSafeInteger(Number(key)) || Number(key) >= size || !Object.hasOwn(descriptors[key]!, 'value')) return fail()
    }
    const values: unknown[] = []
    for (let i = 0; i < size; i++) {
      const key = String(i)
      if (!Object.hasOwn(descriptors, key)) return fail()
      const descriptor = descriptors[key]!
      if (!Object.hasOwn(descriptor, 'value')) return fail()
      values[i] = descriptor.value
    }
    const snapshot = Object.freeze(values)
    snapshots.set(v, snapshot)
    return snapshot
  }
  const texts = (v: unknown): readonly unknown[] => {
    const values = arrayValues(v)
    for (let i = 0; i < values.length; i++) if (!text(values[i])) return fail()
    return values
  }
  for (const key of ['id', 'controllerState', 'failureRecovery', 'claimBoundary']) if (!text(value[key])) return fail()
  for (const key of ['requiredClueIds', 'requiredCardIds', 'provenance']) texts(value[key])
  const copyRefs = arrayValues(value.copyRefs)
  for (let i = 0; i < copyRefs.length; i++) {
    const ref = copyRefs[i]
    if (!closed(ref, ['copyId', 'status']) || !text(ref.copyId) || ref.status !== 'BINDING_ACCEPTED_REQUIRED_CONTENT_MECHANICS_NOT_FINAL_DIALOGUE_DENSITY') return fail()
  }
  if (!closed(value.optionalCopy, ['status', 'copyId', 'includedInClient']) || value.optionalCopy.status !== 'LATE_BOUND' || value.optionalCopy.copyId !== 'TODO.LEAD_COPY.OPTIONAL_CHEMISTRY' || value.optionalCopy.includedInClient !== false) return fail()
  if (value.sound !== 'OPTIONAL_NEVER_CARRIES_REQUIRED_INFORMATION') return fail()
  const corpus = value.acceptedCorpus
  if (!closed(corpus, ['filterBefore', 'filterAfter', 'before', 'after', 'countsMeaning']) || !text(corpus.countsMeaning)) return fail()
  const filterKeys = ['search', 'lens', 'role', 'zeroStatus', 'consumerId', 'storyUse', 'subjectId', 'timeWindowId', 'coverageCellId', 'groupBy']
  const choices: Record<string, readonly string[]> = {
    lens: ['ACTIVITY', 'RELATIONSHIPS', 'STATE', 'RECEIPT'],
    role: ['EXACT', 'CONTEXTUAL', 'CORROBORATING', 'BOUNDED_NO_MATCH', 'CONTROL', 'CANDIDATE', 'DEAD_END', 'PROVENANCE', 'COVERAGE'],
    zeroStatus: ['bounded-no-match', 'observed'],
    groupBy: ['none', 'lens', 'role', 'storyUse', 'subject', 'timeWindow', 'coverage'],
    storyUse: ['Case context', 'Corpus browsing', 'Flow question', 'Dead-end question', 'Evidence comparison', 'Query receipt', 'Coverage context', 'Audit reference', 'Regression reference', 'Other named consumer'],
  }
  for (const key of ['filterBefore', 'filterAfter']) {
    const filter = corpus[key]
    if (!closed(filter, filterKeys, []) || Object.entries(filter).some(([k, v]) => typeof v !== 'string' || (choices[k] && !choices[k].includes(v)))) return fail()
  }
  for (const key of ['before', 'after']) {
    const count = corpus[key]
    if (!closed(count, ['count', 'displayIds', 'questionIds']) || !Number.isSafeInteger(count.count) || (count.count as number) < 0) return fail()
    const displayIds = texts(count.displayIds), questionIds = texts(count.questionIds)
    if (displayIds.length !== count.count || questionIds.length !== count.count) return fail()
  }
  const p = value.performance
  if (!closed(p, ['rook', 'arthur', 'productionClipIds'], ['rook', 'arthur'])) return fail()
  if (Object.hasOwn(p, 'productionClipIds') && p.productionClipIds !== 'LATE_BOUND') return fail()
  for (const name of ['rook', 'arthur']) {
    const actor = p[name]
    if (!closed(actor, ['intention', 'facing', 'reducedMotion'], ['intention', 'reducedMotion']) || typeof actor.intention !== 'string' || !['INSPECT', 'USE', 'READ', 'WORK', 'REACT', 'LISTEN'].includes(actor.intention) || actor.reducedMotion !== 'STATIC_WITH_SEMANTIC_TEXT' || (Object.hasOwn(actor, 'facing') && actor.facing !== 'LATE_BOUND')) return fail()
  }
  if (typeof value.props !== 'string' || !value.props.trim()) return fail()
  // Defense in depth against nested pre-archive binding fields. Semantic filter
  // timeWindowId and historical UTC proof text are not animation timing.
  const inspect = (v: unknown, path = ''): void => {
    if (Array.isArray(v)) {
      const values = arrayValues(v)
      for (let i = 0; i < values.length; i++) inspect(values[i], path + '.' + i)
      return
    }
    if (!object(v)) return
    for (const [key, child] of Object.entries(v)) {
      if (path === '.performance' && key === 'productionClipIds' && child === 'LATE_BOUND') continue
      if (['.performance.rook', '.performance.arthur'].includes(path) && key === 'facing' && child === 'LATE_BOUND') continue
      const normalized = key.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '')
      if (/clip|frame|anchor|coordinate|duration|hold|timing|mirror|transition|filename|objectfit|requiredvisualcapability|facing/.test(normalized)) fail()
      inspect(child, path + '.' + key)
    }
  }
  inspect(value)
  return true
}

export async function deriveBlueprint() {
  const view = await createCanonicalView(await admitFrozenCorpusCandidate(candidate))
  const fixture = buildFrozenFixture(scenario as Parameters<typeof buildFrozenFixture>[0], graph)
  const keys = Object.keys(content.entries)
  const counts = (filter: BrowseQuery) => { const v = browse(view, filter); return { count: v.visible, displayIds: v.cards.map(c => c.display.id), questionIds: v.cards.map(c => c.display.questionId) } }
  const beat = (id: string, controllerState: string, filterBefore: BrowseQuery, filterAfter: BrowseQuery, clueIds: string[], cardIds: string[], prefix: string, propState: string, intention: string, recovery: string) => ({
    id, controllerState, requiredClueIds: clueIds, requiredCardIds: cardIds,
    acceptedCorpus: { filterBefore, filterAfter, before: counts(filterBefore), after: counts(filterAfter), countsMeaning:'Unique accepted semantic display records; NOT raw rows, event totals, proof records, player-discovered facts or account requests.' },
    copyRefs: keys.filter(k => k.startsWith(prefix)).map(copyId => ({copyId,status:'BINDING_ACCEPTED_REQUIRED_CONTENT_MECHANICS_NOT_FINAL_DIALOGUE_DENSITY'})),
    optionalCopy: {status:'LATE_BOUND',copyId:'TODO.LEAD_COPY.OPTIONAL_CHEMISTRY',includedInClient:false},
    props:propState, performance:{rook:{intention,facing:'LATE_BOUND',reducedMotion:'STATIC_WITH_SEMANTIC_TEXT'},arthur:{intention:'LISTEN',facing:'LATE_BOUND',reducedMotion:'STATIC_WITH_SEMANTIC_TEXT'},productionClipIds:'LATE_BOUND'},
    sound:'OPTIONAL_NEVER_CARRIES_REQUIRED_INFORMATION',
    failureRecovery:recovery, claimBoundary:fixture.proof.boundary,
    provenance:['TE-IFACE-CORPUS@1.0.0','TE-IFACE-CONTENT@1.1.0','current accepted Euler scenario and reducer'],
  })
  const beats = [beat('ARRIVAL','START / player-paced opening',{}, {}, [], [],'lane_a.opening','Misfiled case opening; no terminal authorization','INSPECT','Opening can advance instantly; all nine verbs remain available after speech.')]
  for (const rule of usefulRules) beats.push(beat('OFFICE.'+rule.id,rule.phase+' → '+(rule.nextPhase ?? '(unchanged)'),{}, {}, [], [],'lane_a.puzzle.'+rule.id,rule.id+'; inventory and target interaction remain existing reducer-owned; '+(rule.itemId ?? 'no held artifact required'),'USE','Wrong verb/item preserves phase/inventory; accepted dead-end copy; retry the reusable required interaction.'))
  beats.push(beat('EARNED_TERMINAL','Adventure COMPLETE; EARN_ACCESS → CASE',{}, {},fixture.startingClueIds,[], 'lane_a.beat','Terminal authorized; whole room+controls replaced by semantic terminal','INSPECT','No timed boot gate; RETURN restores office focus and retains the same case.'))
  beats.push(beat('BROAD_SEA','SECTION EXPLORE; complete admitted base',{}, {},fixture.startingClueIds,[], 'lane_a.ledger','Local semantic filters; no proof-slot mutation','READ','Reset local filters restores exactly 25; local empty differs from seven bounded no-match records.'))
  const startingSubject = fixture.clues.find(c => c.id === 'CLUE.START')!.filters[0]!.value
  beats.push(beat('CLUE_NARROW','COLLECTION.EULER_CASE_FILE discovers starting clues; EXPLORE subject facet',{}, {subjectId:startingSubject},fixture.startingClueIds,['CARD.INCIDENT'],'lane_a.recovery','Starting subject + incident window + recorded asset remain reusable; local semantic facet does not mutate CASE query','INSPECT','Unrecognized or undiscovered CASE identifier rejects staging; reset browse facets or remove a CASE chip explicitly.'))
  beats.push(beat('QUERY_RECEIPT_EVIDENCE_DELTA','CASE stages known filters; REVIEW_RECEIPT → DISPATCH; RESULTS foreground max three', {lens:'ACTIVITY'}, {lens:'ACTIVITY',subjectId:startingSubject},fixture.startingClueIds,['CARD.ASSET_OUT'],'lane_a.recovery','Query Receipt reviewed; canister returned; up to three foreground folders and two compared routes','WORK','Chip removal, undo/redo, saved query and redispatch preserve discoveries; never invent an extra STATE display member.'))
  for (const [lens,card] of [['ACTIVITY','CARD.WHAT_LEFT'],['RELATIONSHIPS','CARD.INTERACTIONS'],['STATE','CARD.STATE_CHANGE'],['RECEIPT','CARD.EXACT_RECEIPT']] as const) beats.push(beat('LENS.'+lens,'CASE STAGE_CARD / REVIEW_RECEIPT / DISPATCH; or EXPLORE local lens',{}, {lens},lens==='RECEIPT'?[ 'CLUE.RESULT.'+fixture.proof.slots.LINK ]:fixture.startingClueIds,[card],'lane_a.recovery','Query Tray staged; returned canister; Candidate Folders not yet proof','WORK','STATE has zero frozen semantic display members: retain honest zero; use existing separate Euler corroboration, never synthesize an accepted record. RECEIPT card requires selected discovered result.'))
  beats.push(beat('WRONG_THEORY','THEORY FIRST_TRAIL_STOPS_AT_FIRST_ENGINE; revisable',{}, {lens:'RELATIONSHIPS'},fixture.startingClueIds,['CARD.WHAT_LEFT'],'lane_a.recovery','Theory thread open; no false conclusion filed','REACT','IT STOPPED AT THE FIRST ENGINE remains a hypothesis; replay and exact receipt recover without resetting earned clues.'))
  beats.push(beat('FIRST_FALSIFIER','SELECT_RESULT LINK; CARD.EXACT_RECEIPT; exact predicate', {lens:'RELATIONSHIPS'},{lens:'RECEIPT'},['CLUE.RESULT.'+fixture.proof.slots.LINK],['CARD.EXACT_RECEIPT'],'lane_a.recovery','Verified exact receipt archived; first contradiction at 2023-03-13T11:38:11Z','READ','Contextual display/zero/state cannot satisfy exact predicate; choose a discovered candidate and verify its receipt.'))
  beats.push(beat('PROOF','READ_BRANCH SECOND; ASSEMBLE AMOUNT / RECEIVER / LINK',{}, {},['CLUE.PROOF.'+fixture.proof.slots.LINK],['CARD.EXACT_RECEIPT'],'lane_a.recovery','Three exact proof slots filed; bounded conclusion','REACT','Undiscovered/contextual/no-match IDs rejected; required branch memory and exact event retained.'))
  beats.push(beat('RETURN_CLOSURE','complete; RETURN TO RECORDS OFFICE; same case save',{}, {},fixture.startingClueIds,[],'lane_a.recovery','Office returns; case retained; Arthur/Rook chemistry late-bound','LISTEN','Return/reentry, reset and plain/docked modes preserve or explicitly reset central state; optional banter does not gate success.'))
  for (const b of beats) validatePreArchiveBeat(b)
  let earned = investigationReducer(fixture,createInvestigationState(fixture),{type:'EARN_ACCESS'})
  earned = investigationReducer(fixture,earned,{type:'STAGE_CARD',cardId:'CARD.WHAT_LEFT'})
  earned = investigationReducer(fixture,earned,{type:'DISPATCH',path:'TERMINAL'}) // Guard must reject unreviewed Query Receipt.
  const receiptGuardRejected = earned.result === null && earned.exactEventIds.length === 0 && earned.announcement.startsWith('Review the Query Receipt before dispatch.')
  let state = investigationReducer(fixture,createInvestigationState(fixture),{type:'EARN_ACCESS'})
  state = investigationReducer(fixture,state,{type:'COLLECT_CASE_FILE'})
  // The accepted S6 blueprint remains the v1.1 authority snapshot. The distinct
  // S7-R2B Incident DAI selector is represented by the later controller layer.
  const proofQueries = availableCards(fixture,state).filter(c => c.id !== 'CARD.INCIDENT_DAI').map(c => ({cardId:c.id,questionId:c.questionId,prerequisites:c.prerequisites,query:{lens:c.lens,questionId:c.questionId,filters:c.effects.map(f=>({...f,origin:'QUESTION_CARD' as const,sourceId:c.id}))},matches:dispatchQuery(fixture,{lens:c.lens,questionId:c.questionId,filters:c.effects.map(f=>({...f,origin:'QUESTION_CARD' as const,sourceId:c.id}))},null).recordIds}))
  state = investigationReducer(fixture,state,{type:'STAGE_CARD',cardId:'CARD.INCIDENT_DAI'})
  state = investigationReducer(fixture,state,{type:'REVIEW_RECEIPT'})
  state = investigationReducer(fixture,state,{type:'DISPATCH',path:'TERMINAL'})
  state = investigationReducer(fixture,state,{type:'SELECT_RESULT',recordId:fixture.openingRecordId})
  state = investigationReducer(fixture,state,{type:'STAGE_CARD',cardId:'CARD.FOLLOW_FORWARD'})
  state = investigationReducer(fixture,state,{type:'REVIEW_RECEIPT'})
  state = investigationReducer(fixture,state,{type:'DISPATCH',path:'TERMINAL'})
  state = investigationReducer(fixture,state,{type:'SELECT_RESULT',recordId:fixture.proof.slots.LINK})
  state = investigationReducer(fixture,state,{type:'STAGE_CARD',cardId:'CARD.EXACT_RECEIPT'})
  state = investigationReducer(fixture,state,{type:'REVIEW_RECEIPT'})
  state = investigationReducer(fixture,state,{type:'DISPATCH',path:'TERMINAL'})
  const exactVerified = state.exactEventIds.includes('EXACT.'+fixture.proof.slots.LINK)
  state = investigationReducer(fixture,state,{type:'READ_BRANCH',branch:'SECOND'})
  for(const slot of ['AMOUNT','RECEIVER','LINK'] as const) state=investigationReducer(fixture,state,{type:'ASSEMBLE',slot,recordId:fixture.proof.slots[slot]})
  if(!exactVerified || !state.complete || !receiptGuardRejected) throw Error('S5_BLUEPRINT_REDUCER_PROOF')
  return {schemaVersion:'1.0.0',status:'FOUNDATION_PENDING_MAIN_REVIEW',corpusIdentity:candidate.identity,semanticTotal:view.total,boundedNoMatches:view.boundedNoMatches,
    finalTitle:'LATE_BOUND',finalDialogueDensity:'LATE_BOUND',artClipIdsAndFilenames:'LATE_BOUND',
    conclusion:fixture.proof.conclusion,firstFalsifierUtc:fixture.proof.linkTimeUtc,beats,
    proofLayer:{separateFrom25ContextualDisplay:true,fixtureId:fixture.id,total:fixture.records.length,slots:fixture.proof.slots,proofQueries,receiptGuardRejected,exactVerified,complete:state.complete},
    journeys:[
      {id:'DIRECT_SOLVER',beats:['ARRIVAL','EARNED_TERMINAL','LENS.ACTIVITY','FIRST_FALSIFIER','PROOF','RETURN_CLOSURE'],recovery:'Question Receipt then exact event; no exploration requirement.'},
      {id:'CURIOUS_EXPLORER',beats:['ARRIVAL','EARNED_TERMINAL','BROAD_SEA','LENS.RELATIONSHIPS','LENS.STATE','LENS.RECEIPT','FIRST_FALSIFIER','PROOF','RETURN_CLOSURE'],recovery:'Local regroup/reset, compare two, SOURCE/LEDGER, same query/reducer.'},
      {id:'MISTAKEN_INVESTIGATOR',beats:['ARRIVAL','EARNED_TERMINAL','WRONG_THEORY','FIRST_FALSIFIER','PROOF','RETURN_CLOSURE'],recovery:'Wrong theory is revisable; exact 11:38:11 contradiction, no consumable clue loss.'}
    ],accessibility:{keyboard:true,plainAndDockedShareReducer:true,reducedMotionStatic:true,instantText:true,meaningNotColorOnly:true,focusReturn:true,actualATCertification:'PENDING'}
  }
}
