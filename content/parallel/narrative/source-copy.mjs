import {BEATS,CLASSES,PHASES,VERBS,HOTSPOTS,ITEMS,LENSES,SECTIONS,CARDS,ZERO,GRADES,FOLDER_STATES,CLUE_STATES,THREAD_STATES,CHECKS,COVERAGE_STATES,DEAD_ARCHETYPES,tokenNames} from './catalog-contract.mjs'

// Editorial source of truth. The emitter performs mechanical JSON serialization only.
export const entries=[]
function add(id,text,options={}) {
  const tokens=tokenNames(text)
  const requires=options.requires??[]
  const fallback=options.fallback??(tokens.length || requires.length ? 'Inspect the available case state before drawing a conclusion.' : text)
  const line_class=options.line_class??'METHOD'
  const entry={key:`lane_a.${id}`,text,fallback,speaker:options.speaker??'SYSTEM',line_class,
    intention:options.intention??'EXPLAIN',performance_fallback:'TEXT_ONLY',claim_class:options.claim_class??'METHOD_ONLY',
    requires,evidence_ids:options.evidence_ids??[],surfaces:options.surfaces??[id],tokens,optional:['OPTIONAL_BANTER','REACTION'].includes(line_class),
    source_refs:options.source_refs??['src/app/CaseTerminalWorkbench.tsx','src/investigation/contracts.ts']}
  entries.push(entry);return entry.key
}
const office={speaker:'ROOK',line_class:'CORE',claim_class:'FICTIONAL_FRAMING',intention:'SPEAK',source_refs:['src/adventure/content.ts']}
const method={speaker:'ARCHIVIST',line_class:'METHOD',intention:'EXPLAIN'}
const boundary='This establishes neither common human identity nor offchain coordination, intent beyond recorded actions, or the ultimate destination of later value.'
const opening=[
  ['ROOK','Where am I—and why do I taste envelope glue?'],
  ['ARCHIVIST','Records Office. You were misfiled.'],
  ['ROOK','That explains the postage. Not the room.'],
  ['ARCHIVIST',"A trail stopped where it shouldn't have.\nYour name was attached to the request."],
  ['ROOK','By whom?'],['ARCHIVIST','Unsigned.'],['ROOK','Of course it was.'],
  ['ARCHIVIST','Find the First Breach record.\nThen we can discuss your return postage.']
]
export const openingKeys=opening.map(([speaker,text],i)=>add(`opening.${i+1}`,text,{...office,speaker,surfaces:[`PROVISIONAL_OPENING[${i}]`]}))
const beats=[
  ['ARCHIVIST','No ordinary witnesses. No useful camera record.'],
  ['ROOK','So we have a case without a trail.'],
  ['ARCHIVIST','The event happened onchain: its recorded activity is public.'],
  ['ROOK','I heard “public.” I may have missed the useful part.'],
  ['ARCHIVIST','The records are public. Reading a useful trail through them takes work.'],
  ['ROOK','Public records. Good. We can have this filed by lunch.'],
  ['ARCHIVIST','Public is not self-explanatory. A match is a lead, not a verdict.'],
  ['ARCHIVIST','This case artifact authorizes access to the records prepared for this investigation.'],
  ['ARCHIVIST','Nansen structures the onchain evidence. It does not solve the case or establish offchain intent.'],
  ['ROOK','Then we read the record before we write the ending.']
]
export const beatMappings=beats.map(([speaker,text],i)=>{
  const beat_id=BEATS[i]; const legacy_copy_key=`TODO.LEAD_COPY.${beat_id}`
  const copy_key=add(`beat.${beat_id}`,text,{speaker,line_class:'CORE',intention:speaker==='ROOK'?'SPEAK':'EXPLAIN',surfaces:[beat_id,legacy_copy_key],source_refs:['src/adventure/narrative.ts'],claim_class:i===7?'FICTIONAL_FRAMING':'METHOD_ONLY'})
  return {beat_id,cue_id:`onboarding.${String(i+1).padStart(2,'0')}`,legacy_copy_key,copy_key,speaker,advance:'PLAYER_PACED',runtime_effects_preserved:true}
})

const ruleLines={
  'pull-ticket':[['ROOK','A blank request. The office prefers its questions in writing.']],
  'complete-request':[['ROOK','First Breach record requested.']],
  'stamp-request':[['ROOK','Completed request.'],['ARCHIVIST','Approved. The stamp goes before the tube.']],
  'load-tube':[['ROOK','The stamped request is inside the tube.']],
  'close-tube':[['ROOK','Sealed.']],
  'dispatch-request':[['SYSTEM','Request dispatched. A returned canister is in the receiving cradle.']],
  'open-canister':[['ROOK','A locator strip. Something I can actually use.']],
  'take-strip':[['ROOK','First Breach strip secured.']],
  'unlock-terminal':[['SYSTEM','The case artifact is recognized. The frozen record is ready to inspect.']],
  'read-record':[['ROOK','First record secured. Now the questions can be specific.']],
  'reread-record':[['ROOK','The First Breach record is already archived. I can read it again.']]
}
Object.entries(ruleLines).forEach(([rule,lines])=>lines.forEach(([speaker,text],i)=>add(`puzzle.${rule}.${i+1}`,text,{...office,speaker,surfaces:[`rule.${rule}`],requires:[`PHASE.${PHASES[Math.min(Object.keys(ruleLines).indexOf(rule),10)]}`],fallback:'Inspect the request, tube and returned record to see the current office step.'})))

const descriptions=[
  'A blank requisition form. It needs the name of the record, not a theory about the case.',
  'A request for the First Breach record, ready for Arthur to approve.',
  'An approved request, ready for the pneumatic tube.',
  'A fictional case-access locator for the frozen First Breach record. This strip itself is not historical proof.'
]
ITEMS.forEach((item,i)=>{
  add(`inventory.${item}.name`,item.replaceAll('-',' '),{...office,line_class:'SYSTEM',surfaces:[`inventory.${item}.name`]})
  add(`inventory.${item}.description`,descriptions[i],{...office,surfaces:[`inventory.${item}.description`]})
})
VERBS.forEach(verb=>add(`verb.${verb.toLowerCase()}`,verb.replaceAll('_',' '),{line_class:'SYSTEM',intention:'IDLE',surfaces:[`verb.${verb}`],source_refs:['src/adventure/types.ts','src/app/App.tsx']}))
HOTSPOTS.forEach(h=>{
  const name=h==='mr-index'?'Arthur the Archivist':h==='nansen-terminal'?'Nansen terminal':h==='rotunda-exit'?'Breach Rotunda exit':h.replaceAll('-',' ')
  add(`hotspot.${h}.name`,name,{...office,line_class:'SYSTEM',surfaces:[`hotspot.${h}.name`]})
  add(`hotspot.${h}.aria`,h==='mr-index'?'Arthur, Records Office archivist':name,{...office,line_class:'SYSTEM',surfaces:[`hotspot.${h}.ariaLabel`]})
})
const topics={record:['I need the First Breach record.','A completed request needs approval. Put the stamped request in the tube; close it before dispatch.'],noise:['Is the tube supposed to make that noise?','Yes. It is functioning within its dramatic tolerances.'],charge:['Are you in charge here?','I am responsible for the Records Office. Responsibility is not the same as enthusiasm.'],leave:['Never mind.']}
Object.entries(topics).forEach(([id,lines])=>{
  add(`topic.${id}.label`,lines[0],{...office,line_class:'SYSTEM',surfaces:[`topic.${id}.label`]})
  if(id!=='leave')lines.forEach((text,i)=>add(`topic.${id}.${i+1}`,text,{...office,speaker:i?'ARCHIVIST':'ROOK',line_class:id==='record'?'METHOD':'OPTIONAL_BANTER',surfaces:[`topic.${id}.lines`]}))
})
add('topic.leave.close','Conversation closed.',{line_class:'SYSTEM',intention:'IDLE',surfaces:['topic.leave.closes'],claim_class:'FICTIONAL_FRAMING',source_refs:['src/adventure/content.ts'],fallback:'Return to the office.'})

const fallbackTexts=['That item is not accepted here.','It is fixed in place.','Those objects do not interact.','It does not open.','That object does not establish a case fact.','It does not move.','It does not close further.','There is no reply.','It does not move.']
export const verbFallbacks=VERBS.map((verb,i)=>({verb,copy_key:add(`dead.verb.${verb.toLowerCase()}`,fallbackTexts[i],{...office,line_class:'DEAD_END',surfaces:[`fallback.${verb}`]})}))
const lookTexts=[
  'Filed records. Nothing here supplies an exact link for this case.',
  'A historical clock. The accepted record, not this prop, establishes event time.',
  'Blank requests come from this dispenser.',
  'A pen for completing record requests.',
  'Arthur the Archivist. Meticulous, helpful, and stationed behind the counter.',
  'The tube carries approved requests.',
  'The plunger dispatches a sealed tube.',
  'The receiving canister holds returned records.',
  'A frozen Nansen case terminal. Before access is earned, it needs the First Breach strip.',
  'The Breach Rotunda exit. This case remains inside the Records Office.'
]
export const looks=HOTSPOTS.map((target_id,i)=>({target_id,copy_key:add(`dead.look.${target_id}`,lookTexts[i],{...office,line_class:'DEAD_END',surfaces:[`look.${target_id}`]})}))
const alt=[['PUSH:filing-drawers','It has seniority.'],['PULL:historical-clock','That feels like a conversation with facilities.'],['OPEN:request-dispenser','No player-serviceable panel. I will leave its filing intact.'],['PULL:pen-stand','The pen stand is fixed to the counter.'],['PULL:mr-index','Arthur remains behind the counter.'],['OPEN:pneumatic-tube','The tube does not open further.'],['PULL:dispatch-plunger','The dispatch control only moves forward.'],['CLOSE:record-canister','The canister does not close further.'],['PUSH:nansen-terminal','The terminal remains in place.'],['OPEN:rotunda-exit','That route is outside the current investigation.']]
export const alternates=alt.map(([selector,text],i)=>({selector,copy_key:add(`dead.alternate.${i+1}`,text,{...office,line_class:'DEAD_END',surfaces:[`alternate.${selector}`]})}))
export const overrides=[
  {selector:'PUSH:filing-drawers',copy_key:alternates[0].copy_key},
  {selector:'PULL:historical-clock',copy_key:alternates[1].copy_key},
  {selector:'GIVE:mr-index:ANY_ITEM',copy_key:add('dead.rejected_item','This is not the completed request Arthur needs for approval.',{...office,line_class:'DEAD_END',surfaces:['override.GIVE:mr-index:ANY_ITEM']})},
  {selector:'TALK_TO:filing-drawers',copy_key:add('dead.drawers_reply','It remains professionally unavailable.',{...office,line_class:'DEAD_END',surfaces:['override.TALK_TO:filing-drawers']})}
]
entries.find(e=>e.key===alternates[0].copy_key).surfaces.push('override.PUSH:filing-drawers')
entries.find(e=>e.key===alternates[1].copy_key).surfaces.push('override.PULL:historical-clock')

SECTIONS.forEach(section=>add(`section.${section.toLowerCase()}`,section,{line_class:'SYSTEM',intention:'IDLE',surfaces:[`section.${section}`]}))
const sectionTeach=['Keep facts, an open question, the thread and theories together. Ask a bounded question here.','These folders explain matches, evidence grades and useful follow-up questions. A match alone is not proof.','Explore the discovered public-safe Case Corpus. It contains evidence views, not a complete history of the chain.','Inspect the selected record, its evidence grade, precision, lineage and claim limits. Event time and retrieval time answer different questions.','Inspect the Research Ledger and Call Atlas. Acquisition calls, evidence views and blockchain events are different counts.']
SECTIONS.forEach((section,i)=>add(`section.${section.toLowerCase()}.teach`,sectionTeach[i],{...method,surfaces:[`section.${section}.teaching`]}))
const lensData={
  ACTIVITY:['What happened here?','Shows recorded activity within the accepted scope.','It does not by itself establish a complete route, identity or intent.'],
  RELATIONSHIPS:['Who interacted with whom?','Shows observed address interactions in the retrieved records.','Frequency is not causation, ownership or common human control.'],
  STATE:['What changed before and after?','Can corroborate a bounded change; this fixture uses a transaction-derived state view.','A derived state view is not independent proof and cannot identify a causing transaction by itself.'],
  RECEIPT:['Which exact record establishes the link?','Can establish the specific recorded link only when the accepted exact predicate is verified.','A receipt for some other event cannot close this gap. Exactness does not establish identity or intent.']
}
Object.entries(lensData).forEach(([lens,lines])=>['question','may_establish','cannot_establish'].forEach((field,i)=>add(`lens.${lens.toLowerCase()}.${field}`,lines[i],{...method,surfaces:[`lens.${lens}.${field}`]})))
const cardData={
  WHAT_LEFT:['What left this address?','The earned outgoing-direction clue makes this a useful first question.','Shows outgoing activity from the known address in the accepted corpus.','It does not show every later destination.','Check asset and time, then test a specific receipt.'],
  INCIDENT:['What happened during the incident?','The earned address and incident window bound this question.','Shows retrieved activity involving the known address during the incident window.','The retrieved corpus is not complete chain history.','Use the recorded asset or direction to narrow the results.'],
  ASSET_OUT:['Show this asset moving out.','The earned asset and outgoing direction narrow the current lead.','Finds accepted records matching the disclosed asset, direction and window filters.','A matching amount or asset alone does not prove route continuity.','Select a candidate and inspect its exact receipt.'],
  HIGH_VALUE:['Show high-value activity.','The First Breach amount supplies a known threshold in the recorded asset.','Finds accepted activity matching the disclosed address, asset and amount threshold.','It does not identify the person behind an address or allocate all later value.','Compare direction and time before testing the receipt.'],
  INTERACTIONS:['Who interacted most?','The known address gives this relationship question an anchor.','Shows observed interaction counts within the retrieved records.','Partial-corpus frequency is not complete historical ranking, causation or human identity.','Test a specific candidate rather than following frequency alone.'],
  STATE_CHANGE:['What changed before and after?','The known address and window support a bounded state question.','Shows a transaction-derived corroborating state view in this fixture.','It is not independent evidence and cannot fill an exact proof slot.','Return to the recorded event and ask for its exact receipt.'],
  WHAT_ARRIVED:['What arrived here?','The earned starting address supplies the destination to inspect.','Shows accepted incoming activity at the known address.','It does not prove what happened after the arrival.','Compare the arrival with the outgoing activity.'],
  FOLLOW_FORWARD:['Follow this candidate forward.','The selected discovered candidate supplies the next source address.','Shows candidate activity from that address within accepted coverage.','Following an address does not establish common control or an ultimate destination.','Check the window and asset; request the specific receipt.'],
  EXACT_RECEIPT:['Show the exact receipt.','The selected discovered record supplies the transaction identifier.','Tests that recorded event against the accepted exact relationship predicate.','Exactness alone does not make this the required Link. Human identity is outside its claim boundary.','If the required link verifies, file its exact evidence; otherwise inspect why it is insufficient.'],
  COMPARE_ROUTES:['Compare these two routes.','The two selected discovered records define the comparison.','Compares their disclosed factual dimensions.','Similarity does not prove continuity, human identity or intent.','Test the unresolved relationship with an exact receipt.']
}
Object.entries(cardData).forEach(([card,lines])=>['question','why','may_establish','cannot_establish','next'].forEach((field,i)=>add(`card.${card.toLowerCase()}.${field}`,lines[i],{...method,surfaces:[`CARD.${card}.${field}`],requires:['ACCESS_EARNED',...(['FOLLOW_FORWARD','EXACT_RECEIPT'].includes(card)?['CANDIDATE_DISCOVERED']:card==='COMPARE_ROUTES'?['TWO_CANDIDATES_SELECTED']:[])],fallback:'Use an available Question Card based on discovered clues.'})))

const generic={
  'terminal.access_locked':'Earn the First Breach record in the Records Office. No provider call is needed to play.',
  'terminal.access_earned':'First Breach record earned. The frozen terminal is available.',
  'terminal.ask':'Ask a bounded question inside CASE.',
  'terminal.return':'Return to Records Office',
  'terminal.back_to_case':'Back to CASE',
  'terminal.frozen':'Frozen historical snapshot. No live provider calls during play.',
  'terminal.attribution':'Powered by Nansen API',
  'tray.optional_categories':'These are optional categories, not required slots. Apply only the clues your question needs.',
  'receipt.teach':'Review the question, lens, active filters and their origins, expected result class, and coverage before dispatch.',
  'receipt.no_hidden_filter':'No hidden filter will be added.',
  'receipt.dispatch':'Dispatch',
  'receipt.review_required':'Review the Query Receipt first. Then dispatch here or push the same physical plunger again.',
  'receipt.funnel':'The funnel counts matching records in the accepted corpus, not people, provider calls or complete chain activity.',
  'delta.teach':'A changed result count explains the effect of your question. It does not by itself upgrade the evidence.',
  'delta.no_exclusion':'No previously returned candidate was excluded.',
  'delta.predicate':'Inspect the first predicate that excluded this previously returned candidate.',
  'results.no_dispatch':'No dispatch yet. Build a question inside CASE.',
  'results.show_more':'Show more matching records',
  'results.sort':'Order reflects the disclosed factual sort rule, not likelihood or guilt.',
  'candidate.why_matched':'Why it matched',
  'candidate.may_support':'What it may support',
  'candidate.cannot_prove':'What it does not prove',
  'candidate.next_question':'Next useful question',
  'candidate.source':'Source for this result',
  'candidate.save':'Save lead',
  'candidate.pin':'Pin result to Caseboard',
  'candidate.compare':'Compare candidate',
  'candidate.repeat':'This is the same discovered lead. Reusing it does not create a new event or a new provider call.',
  'candidate.saved':'Lead saved as a reusable question to test. No clue was consumed.',
  'candidate.pinned':'Pinned with its stated evidence grade. Pinning does not verify an exact link.',
  'candidate.context':'Context helps choose a question. It cannot fill an exact proof slot.',
  'candidate.control':'A control checks the method within its accepted scope. It is not a route continuation.',
  'candidate.corroboration':'Corroboration supports a bounded interpretation. Check whether it derives from an event already counted as evidence.',
  'comparison.teach':'Compare time, direction, asset, amount, relationship, evidence grade, coverage and exact-receipt availability. Use facts, not confidence scores.',
  'comparison.two_only':'Compare at most two discovered candidates.',
  'comparison.empty':'Select two discovered candidates to compare.',
  'caseboard.known':'Known Facts',
  'caseboard.open_question':'Open Question',
  'caseboard.trace':'Trace Thread',
  'caseboard.gap':'The thread gap is open. Candidate fit alone cannot establish the exact continuation.',
  'caseboard.theory_not_fact':'A working theory is optional and revisable. It is not a fact.',
  'caseboard.read_first':'Read First Breach memory',
  'caseboard.read_second':'Read Second Breach memory',
  'proof.context_rejected':'Contextual and corroborating views cannot fill Amount, Receiver or Link. Use the required discovered exact evidence.',
  'proof.insufficient':'This receipt does not establish the required link. Inspect its relationship, evidence grade and source; keep the lead separate from proof.',
  'proof.build_case':'Build the bounded case',
  'source.event_time':'Event time and time classification',
  'source.retrieval_time':'Retrieval time — when the evidence was collected, not when the event occurred',
  'source.contextual_time':'Contextual time is not promoted to exact UTC. Inspect the accepted time classification.',
  'source.precision':'Provider-reported precision — preserve the supplied decimals and units',
  'source.raw_digest':'Raw response SHA-256 — a digest, not the private raw response',
  'source.normalized_digest':'Normalized evidence SHA-256',
  'source.lineage':'Source lineage and named evidence consumer',
  'source.derived':'A derived view may repeat an existing event. It is not automatically independent corroboration.',
  'source.boundary':boundary,
  'explore.teach':'Use discovered clues to navigate the relevant evidence haystack. Not every relevant view belongs in final proof.',
  'explore.search':'Search discovered public-safe fields',
  'explore.search_no_match':'No discovered record matches this search. This is not historical absence.',
  'explore.manual':'Manual filters use known values. Review their exact effect in the Query Receipt.',
  'ledger.attempts':'HTTP attempts include retries.',
  'ledger.responses':'A successful provider response is not automatically a qualification-accepted success.',
  'ledger.supplier':'An immutable supplier terminal is distinct from local semantic support and formal Lead acceptance.',
  'ledger.acceptance':'Formal Lead acceptance is per logical request and requires its bound evidence and audit.',
  'ledger.credits':'Credits measure provider accounting, not the number of blockchain events.',
  'ledger.reuse':'Local reuse is neither a new provider request nor another accepted success.',
  'ledger.fixture':'This fixture displays only its bound accounting metadata. It is not a claim about current campaign progress.',
  'ledger.unknown':'Accounting or proof-root metadata unavailable here. Do not infer acquisition or acceptance.',
  'ledger.coverage':'Coverage is subject × time window × lens × partition. A completed cell is not all chain history.',
  'ledger.atlas':'Call Atlas maps known source lineage to evidence consumers. One source can produce several views of an event.',
  'ledger.why_nansen':'Nansen organizes onchain activity and relationships into inspectable evidence. The investigator asks questions, tests alternatives and respects claim limits.',
  'recovery.query_changed':'Query changed. Review all active filters in the Query Receipt.',
  'recovery.undo':'Query undone. Discovered evidence is unchanged.',
  'recovery.redo':'Query redone. Review its active filters before dispatch.',
  'recovery.last_dispatch':'Query restored to the last dispatch, or to an empty question if none exists.',
  'recovery.remove_chips':'Query chips removed. Discovered evidence is unchanged.',
  'recovery.save_query':'Local query saved. It is not a new provider call.',
  'recovery.load_query':'Saved local query staged. Review its receipt before dispatch.',
  'recovery.reset_case':'Return to the existing case start. No later clue or proof is inferred.',
  'recovery.invalid_input':'Invalid input. Staged clues and the existing query are preserved.',
  'recovery.locked_identifier':'That identifier has not been discovered. Use a known clue; staged inputs are preserved.',
  'recovery.invalid_save':'Local save could not be restored. No clue or proof was inferred.',
  'recovery.corpus_load':'Frozen investigation corpus unavailable. The Records Office opening puzzle remains playable; no provider access is requested.',
  'recovery.storage_unavailable':'Persistent local storage is unavailable. Continue in memory; progress may not survive closing this session.',
  'recovery.reentry':'Return to the available case state. Inspect the staged query before continuing.',
  'physical.equivalent':'The physical plunger and terminal dispatch use the same reviewed question and local frozen corpus.',
  'physical.canister_returned':'Returned result is ready to reveal.',
  'physical.canister_empty':'No returned result is ready to reveal.',
  'accessibility.player_paced':'Reveal the full line, then continue when ready.',
  'accessibility.plain_list':'Plain-list presentation uses the same case state and evidence.',
  'accessibility.reduced_motion':'Reduced motion changes presentation, not the evidence or available actions.',
  'accessibility.instant_text':'Instant text reveals the complete line. No timed response is required.',
  'accessibility.high_contrast':'Evidence grades and states are written out; meaning does not depend on color.',
  'accessibility.focus':'Continue from the selected record or return to CASE.',
  'fictional_boundary':'Office objects are fictional framing. Only accepted historical records enter case evidence.'
}
Object.entries(generic).forEach(([id,text])=>add(id,text,{line_class:id.startsWith('candidate.')||id.startsWith('caseboard.')?'CASE':id.startsWith('terminal.')||id.startsWith('accessibility.')?'SYSTEM':'METHOD',claim_class:id==='source.boundary'?'BOUNDARY_ONLY':id==='fictional_boundary'?'FICTIONAL_FRAMING':'METHOD_ONLY',intention:id.startsWith('accessibility.')?'IDLE':'EXPLAIN'}))
;['STARTING_POINT','WHEN','WHAT_MOVED','CHECK'].forEach(c=>add(`tray.${c.toLowerCase()}`,c.replaceAll('_',' '),{line_class:'SYSTEM',intention:'IDLE',surfaces:[`tray.${c}`]}))
const gradeWords=['An accepted exact recorded event. A particular proof slot still requires its matching predicate.','A corroborating view. Check whether it derives from the same event.','Historical context. Useful for questions, not decisive proof.']
GRADES.forEach((g,i)=>add(`grade.${g.toLowerCase()}`,gradeWords[i],{surfaces:[`grade.${g}`]}))
const folders=['Not tested against the required relationship.','Saved for further testing; not verified.','Corroborating only; not independent exact proof.','Contradicted by an accepted test within its stated scope.','The specific accepted exact test has verified this record; respect its claim boundary.']
FOLDER_STATES.forEach((s,i)=>add(`folder.${s.toLowerCase()}`,folders[i],{surfaces:[`folder.${s}`],requires:s==='EXACT'?['EXACT_CONVERGENCE_VERIFIED']:s==='CONTRADICTED'?['RESULT_CLASSIFIED']:[],fallback:'Inspect the candidate status and source before treating it as verified.'}))
const clueTexts=['Not discovered. No hidden value is revealed.','Discovered; inspect its source before applying it.','Available to stage without typing or dragging.','Applied to the current question. Review its visible filter effect.','Related to the selected discovered record.','Pinned to the Caseboard with its stated evidence grade.','Archived through the existing verified evidence state; still reusable.']
CLUE_STATES.forEach((s,i)=>add(`clue.${s.toLowerCase()}`,clueTexts[i],{surfaces:[`clue.${s}`]}))
;['START','WINDOW','ASSET','AMOUNT','OUT','RESULT.*','PROOF.*'].forEach(id=>add(`clue.family.${id.toLowerCase().replace('*','discovered')}`,'Inspect this discovered clue and its source. Apply it without typing; it remains reusable.',{surfaces:[`CLUE.${id}`],requires:['ACCESS_EARNED'],fallback:'Discover the clue through the existing case actions first.'}))
const threadTexts=['No thread is pinned yet.','The candidate fits some known facts, but fit is not proof.','A specific exact link is still needed.','Corroborated, not independently proved.','An accepted continuity check contradicts this thread within its scope.','The accepted exact relationship closes this thread gap.']
THREAD_STATES.forEach((s,i)=>add(`thread.${s.toLowerCase()}`,threadTexts[i],{surfaces:[`thread.${s}`],requires:s==='PROVED'?['EXACT_CONVERGENCE_VERIFIED']:[],fallback:'Inspect the thread gap and its available evidence.'}))
const checkTexts=['Check record order against the earned first event.','Check the recorded source and destination; address compatibility is not human identity.','Keep assets and units distinct; use only proven transformations.','Preserve decimal precision. A compatible amount does not allocate all later value.','Only the matching accepted exact predicate closes this relationship.','Keep the record inside the accepted historical cutoff.']
CHECKS.forEach((s,i)=>add(`continuity.${s.toLowerCase()}`,checkTexts[i],{surfaces:[`continuity.${s}`]}))
const coverageTexts=['Planned, not answered. No absence claim is supported.','Complete only for the stated accepted cell. Check whether negative evidence is actually supported.','Partial accepted coverage. No matching record is not proof of absence.','An accepted complete empty cell. Any negative claim remains bounded to that exact scope and classification.','Coverage failed. No absence may be inferred.','Outside the admitted scope. No historical absence may be inferred.']
COVERAGE_STATES.forEach((s,i)=>add(`coverage.${s.toLowerCase()}`,coverageTexts[i],{surfaces:[`coverage.${s}`]}))
add('query.broad','Broad question: many records may match. Use earned clues to ask what matters.',{surfaces:['query.BROAD']})
add('query.focused','Focused question: inspect the disclosed filters and their origins.',{surfaces:['query.FOCUSED']})
add('query.candidate','Candidate question: test a discovered lead within accepted coverage.',{surfaces:['query.CANDIDATE']})
add('query.exact','Exact question: the recorded event must satisfy the required accepted predicate.',{surfaces:['query.EXACT']})

add('theory.wrong','IT STOPPED AT THE FIRST ENGINE',{line_class:'CASE',claim_class:'BOUNDED_CONTEXT',requires:['ACCESS_EARNED'],fallback:'A working theory is optional, revisable and not a fact.',surfaces:['theory.FIRST_TRAIL_STOPS_AT_FIRST_ENGINE']})
add('theory.accepted','IT JOINED THE SECOND ROUTE',{line_class:'CASE',claim_class:'BOUNDED_CONTEXT',requires:['ACCESS_EARNED'],fallback:'A working theory is optional, revisable and not a fact.',surfaces:['theory.FIRST_TRAIL_JOINS_SECOND_ROUTE']})
add('theory.falsifier','The exact 11:38:11 UTC record shows the First Engine sending DAI to the Receiving Vault. “It stopped at the First Engine” no longer fits that record.',{...method,claim_class:'ACCEPTED_EXACT',requires:['EXACT_CONVERGENCE_VERIFIED'],evidence_ids:['EXACT_CONVERGENCE'],fallback:'Test the working theory against a discovered exact continuation; candidate fit alone is insufficient.',surfaces:['theory.falsifier','TODO.LEAD_COPY.FALSE_TERMINAL']})
add('theory.recovery','Keep the rejected theory with its exact falsifier. Revise the theory; do not erase the earlier reasoning.',{...method,requires:['EXACT_CONVERGENCE_VERIFIED'],fallback:'A theory remains revisable while you test the evidence.'})
add('proof.first_amount','First Breach: approximately 8.88M DAI. The supplied provider/display decimal is 8,877,507.3483067 DAI.',{claim_class:'ACCEPTED_EXACT',requires:['EXACT_EARLY_DISCOVERED'],evidence_ids:['EXACT_EARLY_NET'],fallback:'Inspect the earned First Breach record and its supplied decimal precision.',surfaces:['proof.AMOUNT.record']})
add('proof.receiver','The exact Second Breach record reaches the Receiving Vault at 09:12:23 UTC.',{claim_class:'ACCEPTED_EXACT',requires:['EXACT_MAIN_DISCOVERED'],evidence_ids:['EXACT_MAIN_RECEIVER'],fallback:'Read the Second Breach record before filing the Receiver.',surfaces:['proof.RECEIVER.record']})
add('proof.link','Verified link: First Engine → Receiving Vault, 11:38:11 UTC, 8,877,507.348306697 DAI. Preserve the supplied convergence precision.',{claim_class:'ACCEPTED_EXACT',requires:['EXACT_CONVERGENCE_VERIFIED'],evidence_ids:['EXACT_CONVERGENCE'],fallback:'The exact continuation has not been verified here. Inspect a discovered candidate receipt.',surfaces:['proof.LINK.record','TODO.LEAD_COPY.PROOF_01']})
;['AMOUNT','RECEIVER','LINK'].forEach(slot=>{
  add(`proof.${slot.toLowerCase()}.label`,slot,{line_class:'SYSTEM',intention:'IDLE',surfaces:[`proof.${slot}.label`]})
  add(`proof.${slot.toLowerCase()}.open`,`${slot}: open. File the required discovered exact evidence.`,{surfaces:[`proof.${slot}.OPEN`]})
  add(`proof.${slot.toLowerCase()}.filed`,`${slot}: exact evidence filed.`,{line_class:'SYSTEM',claim_class:'ACCEPTED_EXACT',requires:['EXACT_CONVERGENCE_VERIFIED',`SLOT.${slot}_FILED`,slot==='AMOUNT'?'EXACT_EARLY_DISCOVERED':slot==='RECEIVER'?'EXACT_MAIN_DISCOVERED':'EXACT_CONVERGENCE_VERIFIED'].filter((v,i,a)=>a.indexOf(v)===i),evidence_ids:[slot==='AMOUNT'?'EXACT_EARLY_NET':slot==='RECEIVER'?'EXACT_MAIN_RECEIVER':'EXACT_CONVERGENCE'],fallback:`${slot}: inspect its required discovered exact evidence.`,surfaces:[`proof.${slot}.FILED`]})
})
add('proof.repeat','This exact link is already verified and archived. Reopening it does not create a new discovery or provider call.',{line_class:'SYSTEM',claim_class:'ACCEPTED_EXACT',requires:['EXACT_CONVERGENCE_VERIFIED'],evidence_ids:['EXACT_CONVERGENCE'],fallback:'Inspect the available receipt and its current verification state.'})
add('conclusion.heading','THE FIRST TRAIL JOINED THE SECOND ROUTE.',{speaker:'ROOK',line_class:'CORE',claim_class:'ACCEPTED_EXACT',requires:['CASE_COMPLETE','EXACT_CONVERGENCE_VERIFIED'],evidence_ids:['EXACT_EARLY_NET','EXACT_MAIN_RECEIVER','EXACT_CONVERGENCE'],fallback:'The case is not complete. Check Amount, Receiver and Link against the required exact records.'})
add('conclusion.boundary','This establishes route convergence to the Receiving Vault inside the accepted cutoff. '+boundary,{line_class:'CORE',claim_class:'BOUNDARY_ONLY',requires:['CASE_COMPLETE','EXACT_CONVERGENCE_VERIFIED'],fallback:boundary})
add('reaction.exact_rook','A lead becomes a link when the record earns it.',{speaker:'ROOK',line_class:'REACTION',intention:'ATTENTIVE',requires:['EXACT_CONVERGENCE_VERIFIED'],fallback:'I should read the available record first.'})

const archetypeTexts=[
  'A busy address looked promising. Activity volume alone does not establish the link; inspect the first accepted test that fails.',
  'The asset fits, but this record falls outside the question’s accepted time window. That rules it out for this question, not for all history.',
  'The time fits, but the recorded direction does not. Test the actual source and destination, not the name of the address.',
  'A familiar address is a lead, not proof of ownership, control or route continuity. Test the specific interaction.',
  'A state change is tempting, but it does not identify a causing transaction by itself. Seek the matching exact event.',
  'A proposed stopping point is a theory. Only an accepted exact continuation can reject it; an empty partial query cannot.'
]
export const archetypes=DEAD_ARCHETYPES.map((archetype,i)=>({archetype,copy_key:add(`dead.archetype.${archetype.toLowerCase()}`,archetypeTexts[i],{...method,line_class:'DEAD_END',claim_class:'BOUNDED_CONTEXT',requires:['RESULT_CLASSIFIED'],fallback:'Inspect the candidate’s first accepted failed criterion before ruling it out.',surfaces:[`dead_archetype.${archetype}`]}),activation:'EXISTING_ACCEPTED_CLASSIFICATION_ONLY'}))
const zeros=[
  'No matching record in the accepted corpus. This is not proof that no event occurred. Inspect the filters or ask a different bounded question.',
  'The accepted complete scope supports negative evidence only for the question and coverage cell shown. This is not chain-wide absence.',
  'This question is outside accepted coverage. No historical absence may be inferred. Inspect coverage before changing the question.'
]
export const zeroResults=ZERO.map((classification,i)=>({classification,copy_key:add(`zero.${classification.toLowerCase()}`,zeros[i],{line_class:'DEAD_END',claim_class:i===1?'SCOPED_NEGATIVE':'BOUNDARY_ONLY',requires:i===1?['RESULT_CLASSIFIED','NEGATIVE_SCOPE_ACCEPTED']:['RESULT_CLASSIFIED'],fallback:'Inspect the result classification and accepted coverage. No absence is established by missing information.',surfaces:[`zero.${classification}`]}),changes_theory:i===1}))

const templates={
  'template.receipt':'Lens: {QUESTION_LENS}. Scope: {COVERAGE_SCOPE}. Review the displayed question, filters and origins before dispatch.',
  'template.subject':'Known subject role: {SUBJECT_ROLE}. Use its discovered clues to ask a bounded question.',
  'template.phase':'Narrative phase: {NARRATIVE_PHASE}. Keep this view within its accepted coverage; a phase label is not proof.',
  'template.results':'{RESULT_COUNT} matching records in {COVERAGE_SCOPE}. A record count is not a count of people or complete chain activity.',
  'template.delta':'{PREVIOUS_COUNT} previous → {RESULT_COUNT} new matching records. Inspect the {FILTER_EFFECT} and its disclosed predicates; count change alone does not upgrade evidence.',
  'template.candidate':'This folder represents {CANDIDATE_ROLE}. Evidence grade: {EVIDENCE_GRADE}. Inspect why it matched and what it cannot prove.',
  'template.source':'Public source call: {PUBLIC_CALL_ID}. Inspect its accepted provenance and claim boundary in SOURCE.',
  'template.exact_time':'Accepted exact event time: {EXACT_TIME_IF_ACCEPTED}. Exact time alone does not establish the required route relationship.',
  'template.control':'Inspect {CANDIDATE_ROLE} within {COVERAGE_SCOPE}. A control is not a route seed or exact proof.',
  'template.exclusion':'The first excluding predicate belongs to the {FILTER_EFFECT}. Inspect the actual predicate shown in Evidence Delta; exclusion is scoped to this question.'
}
const templateFallbacks={
  'template.receipt':'Review the displayed question, lens, filters, origins and accepted coverage before dispatch.',
  'template.subject':'Use a discovered subject clue to ask a bounded question. No subject role is supplied here.',
  'template.phase':'Inspect the view’s accepted temporal classification and coverage. No phase is supplied here.',
  'template.results':'Inspect the returned records and accepted coverage. A result count is unavailable here; do not infer zero.',
  'template.delta':'Inspect the visible filter effects and result sets. Count comparison is unavailable; no decrease or increase is inferred.',
  'template.candidate':'Inspect this discovered folder’s evidence grade, match reasons and claim limits. No grade or role is inferred.',
  'template.source':'Inspect the selected public-safe record’s available provenance. No accepted public call identifier is supplied here.',
  'template.exact_time':'Exact event time is unavailable or unaccepted here. Inspect the time classification; contextual time is not exact UTC.',
  'template.control':'Inspect the available control classification and accepted scope. Do not infer a route continuation.',
  'template.exclusion':'Inspect the first excluding predicate actually shown in Evidence Delta. No filter effect is inferred here.'
}
export const templateKeys=Object.entries(templates).map(([id,text])=>add(id,text,{fallback:templateFallbacks[id],claim_class:id==='template.exact_time'?'ACCEPTED_EXACT':'BOUNDED_CONTEXT',requires:['ACCESS_EARNED',...(id==='template.candidate'||id==='template.control'||id==='template.source'||id==='template.exact_time'?['CANDIDATE_DISCOVERED']:[])],evidence_ids:[],surfaces:[id]}))

const puzzleHints=[
  ['Forms usually begin where blank forms are issued.','The request dispenser is the place to start.','PULL the request dispenser.'],
  ['A blank request needs particulars before approval.','The pen stand can complete the blank request.','USE the blank request with the pen stand.'],
  ['Completion and approval are different steps.','Arthur approves completed requests.','GIVE the completed request to Arthur.'],
  ['An approved request needs a dispatch container.','The pneumatic tube accepts the stamped request.','USE the stamped request with the pneumatic tube.'],
  ['Dispatch needs a sealed container.','The request is loaded; the tube needs closing.','CLOSE the pneumatic tube.'],
  ['A prepared mechanism still needs its control.','The dispatch plunger sends the sealed tube.','PUSH the dispatch plunger.'],
  ['Returned records need inspecting.','The returned canister is in the receiving cradle.','OPEN the returned record canister.'],
  ['An opened container can still hold a useful item.','The First Breach locator strip is inside the open canister.','PICK UP the strip from the record canister.'],
  ['An access artifact identifies prepared records; it is not historical proof.','The terminal recognizes the First Breach strip.','USE the First Breach strip with the Nansen terminal.'],
  ['Access is not the same as reading the record.','The terminal is ready for inspection.','LOOK AT the Nansen terminal.'],
  ['Read the earned record before choosing what to ask.','The First Breach record supports a bounded terminal question.','OPEN the Case Terminal and choose an available Question Card.']
]
export const ladders=[]
function ladder(id,selector,lines,requires=[]) {
  const tiers={}
  ;['METHOD_HINT','CASE_HINT','DIRECT_HINT'].forEach((tier,i)=>{
    tiers[tier]=add(`hint.${id}.${tier.toLowerCase()}`,lines[i],{...method,line_class:i===0?'METHOD':'CASE',requires,fallback:'Inspect the available object or discovered record. Ask what action or bounded test it supports.',surfaces:[`hint.${selector}.${tier}`]})
  })
  ladders.push({id:`HINT.${id.toUpperCase()}`,selector,tiers,no_undiscovered_value:true})
}
PHASES.forEach((phase,i)=>ladder(`puzzle.${phase.toLowerCase()}`,`PHASE.${phase}`,puzzleHints[i],[`PHASE.${phase}`]))
ladder('investigation','ACCESS_EARNED',['Compare time, direction and asset before interpreting a route.','Reuse a discovered clue or inspect a saved candidate.','Choose an available Question Card, review its receipt, then dispatch.'],['ACCESS_EARNED'])
ladder('selected_candidate','CANDIDATE_DISCOVERED',['A plausible match needs a specific test.','The selected discovered record supplies the receipt identifier.','Select the known candidate and stage its Exact Receipt card. Review the receipt before dispatch.'],['ACCESS_EARNED','CANDIDATE_DISCOVERED'])
ladder('exact_found','EXACT_CONVERGENCE_VERIFIED',['Separate exact evidence from contextual or derived views.','Use the discovered exact records for Amount, Receiver and Link.','Read the two breach memories and file the required exact records in the three proof slots.'],['ACCESS_EARNED','EXACT_CONVERGENCE_VERIFIED'])
const basic=ladders.find(x=>x.selector==='ACCESS_EARNED')
entries.find(e=>e.key===basic.tiers.METHOD_HINT).surfaces.push('TODO.LEAD_COPY.HINT_METHOD','TODO.LEAD_COPY.METHOD_HINT')
entries.find(e=>e.key===basic.tiers.CASE_HINT).surfaces.push('TODO.LEAD_COPY.HINT_CASE','TODO.LEAD_COPY.CASE_HINT')
entries.find(e=>e.key===basic.tiers.DIRECT_HINT).surfaces.push('TODO.LEAD_COPY.HINT_DIRECT','TODO.LEAD_COPY.DIRECT_HINT')
export const unavailableHint=add('hint.unavailable','Inspect an available object or discovered record. Ask what it supports before drawing a conclusion.',{...method,surfaces:['hint.unavailable']})
export const optionalExchanges=[
  {id:'banter.mr_a',copy_keys:[
    add('banter.mr_a.rook','Any advice, Mr. A?',{speaker:'ROOK',line_class:'OPTIONAL_BANTER',intention:'AMUSED'}),
    add('banter.mr_a.arthur','Arthur. Advice is available under the appropriate question.',{speaker:'ARCHIVIST',line_class:'OPTIONAL_BANTER',intention:'IRRITATED'})
  ],selection:'EXPLICIT_OPTIONAL',max_per_interaction:1,progression_role:false},
  {id:'banter.archive_ace',copy_keys:[
    add('banter.archive_ace.rook','All right, Archive Ace. One bounded question.',{speaker:'ROOK',line_class:'OPTIONAL_BANTER',intention:'AMUSED'}),
    add('banter.archive_ace.arthur','Arthur. The question may remain; the nickname may not.',{speaker:'ARCHIVIST',line_class:'OPTIONAL_BANTER',intention:'IRRITATED'})
  ],selection:'EXPLICIT_OPTIONAL',max_per_interaction:1,progression_role:false}
]

// This reference keeps unused exports out of accidental lint-based pruning.
export const editorialVocabulary={CLASSES,LENSES,CARDS}
