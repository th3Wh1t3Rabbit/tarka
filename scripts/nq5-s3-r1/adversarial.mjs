// Shared resealed mutation checks run against the actual browser authority module.
// This module has no IO/import dependencies; the Lane C validator runs the same cases.
export async function runAuthorityAdversarial(seam,candidate,fixture){
 const clone=x=>structuredClone(x),assert=(ok,name)=>{if(!ok)throw Error('S3R1_FALSE_SUCCESS_'+name)}
 const hash=async x=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(seam.canonicalJSON(x)))),n=>n.toString(16).padStart(2,'0')).join('')
 const reseal=async(x,prefix)=>{const{id,identity,...body}=x,h=await hash(body);return prefix?{id:prefix+h,identity:h,...body}:{...body,identity:h}}
 const corpus=await seam.admitFrozenCorpusCandidate(candidate),synthetic=await seam.admitSyntheticCorpusFixture(fixture),results=[]
 const reject=async(name,fn)=>{let rejected=false;try{await fn()}catch{rejected=true}assert(rejected,name);results.push({name,status:'REJECTED'})}
 const recordCases=[
 ['changed_question',r=>{r.question='Fabricated unaccepted question';r.questionId='QUESTION.RESEALED.UNACCEPTED'}],
 ['changed_concept_id',r=>{r.conceptId='CONCEPT.'+'0'.repeat(64)}],
 ['changed_consumer',r=>{r.consumerIds=['CONSUMER.RESEALED.UNACCEPTED']}],
 ['empty_coverage_cells',r=>{r.coverage.cellIds=[]}],
 ['duplicate_coverage_cells',r=>{r.coverage.cellIds=[r.coverage.cellIds[0],r.coverage.cellIds[0]]}],
 ['changed_coverage_cell_id',r=>{r.coverage.cellIds=['CELL.RESEALED.UNACCEPTED']}],
 ['null_coverage_key',r=>{r.coverage.key=null}],
 ['coverage_lens_mismatch',r=>{r.coverage.key.lens=r.lens==='ACTIVITY'?'RELATIONSHIPS':'ACTIVITY'}],
 ['changed_coverage_key',r=>{r.coverage.key.partitionId='PARTITION.RESEALED.UNACCEPTED'}],
 ['duplicate_consumers',r=>{r.consumerIds=[r.consumerIds[0],r.consumerIds[0]]}],
 ['changed_record_lens',r=>{r.lens=r.lens==='ACTIVITY'?'RELATIONSHIPS':'ACTIVITY';r.coverage.key.lens=r.lens}]
 ]
 for(const[name,change]of recordCases){const r=clone(candidate.displayRecords[0]);change(r);const sealed=await reseal(r,'SEMANTIC.');await reject(name+'_record_membership',()=>seam.validateDisplayRecord(sealed,corpus));const full=clone(candidate);full.displayRecords[0]=sealed;await reject(name+'_whole_candidate_resealed',async()=>seam.admitFrozenCorpusCandidate(await reseal(full)))}
 const mutateFull=async(name,change)=>{const x=clone(candidate);await change(x);await reject(name,async()=>seam.admitFrozenCorpusCandidate(await reseal(x)))}
 await mutateFull('dropped_record',x=>{x.displayRecords.pop()})
 await mutateFull('added_fabricated_record',async x=>{const r=clone(x.displayRecords[0]);r.question='Fabricated';x.displayRecords.push(await reseal(r,'SEMANTIC.'))})
 await mutateFull('substituted_fabricated_record',async x=>{const r=clone(x.displayRecords[0]);r.question='Fabricated';x.displayRecords[0]=await reseal(r,'SEMANTIC.')})
 await mutateFull('changed_display_identity_mapping',async x=>{const r=clone(x.displayRecords[0]);r.conceptId=x.displayRecords[1].conceptId;x.displayRecords[0]=await reseal(r,'SEMANTIC.')})
 await mutateFull('changed_audit_mapping',x=>{x.auditReferences[0].conceptId=x.auditReferences[1].conceptId})
 await mutateFull('stripped_audit_provenance',x=>{delete x.auditReferences[0].provenance})
 await mutateFull('changed_concept_resealed',async x=>{x.concepts[0].question.question='Fabricated';x.concepts[0]=await reseal(x.concepts[0],'CONCEPT.')})
 await mutateFull('coherent_concept_display_audit_substitution_all_seals_recomputed',async x=>{
  const oldId=x.concepts[0].id,c=clone(x.concepts[0]);c.question.question='Coherent fabricated question';c.question.id='QUESTION.COHERENT.FABRICATED'
  const replacement=await reseal(c,'CONCEPT.');x.concepts[0]=replacement
  const di=x.displayRecords.findIndex(r=>r.conceptId===oldId),d=clone(x.displayRecords[di]);d.conceptId=replacement.id;d.question=replacement.question.question;d.questionId=replacement.question.id;x.displayRecords[di]=await reseal(d,'SEMANTIC.')
  const a=x.auditReferences.find(r=>r.conceptId===oldId);a.conceptId=replacement.id;a.identity=replacement.identity
 })
 await mutateFull('reordered_records',x=>{x.displayRecords.reverse()})
 await mutateFull('freeze_promotion',x=>{x.interfaceFrozen=true})
 await mutateFull('activation_promotion',x=>{x.LaneCActive=true})
 await mutateFull('runtime_provider_promotion',x=>{x.runtimeProviderCalls=1})
 const wrong=clone(candidate);wrong.identity='0'.repeat(64);await reject('wrong_pinned_identity',()=>seam.admitFrozenCorpusCandidate(wrong))
 for(const mode of ['FULLSCREEN_CRT','DOCKED_OVERLAY','PLAIN_LIST']){
  await reject('raw_subset_'+mode,()=>seam.displayForMode(candidate.displayRecords.slice(1),mode))
  await reject('raw_full_list_'+mode,()=>seam.displayForMode(candidate.displayRecords,mode))
  await reject('synthetic_token_in_canonical_'+mode,()=>seam.displayForMode(synthetic,mode))
  await reject('canonical_token_in_synthetic_'+mode,()=>seam.syntheticDisplayForMode(corpus,mode))
  const ids=[candidate.displayRecords[0].id,candidate.displayRecords[3].id],selected=await seam.displayForMode(corpus,mode,ids)
  assert(seam.canonicalJSON(selected)===seam.canonicalJSON([candidate.displayRecords[0],candidate.displayRecords[3]].sort((a,b)=>a.id.localeCompare(b.id))),'valid_subset_'+mode)
  assert(selected.every(r=>Object.isFrozen(r)&&Object.isFrozen(r.coverage)&&Object.isFrozen(r.coverage.cellIds)),'immutable_subset_'+mode)
 }
 await reject('forged_token',()=>seam.displayForMode({...corpus},'PLAIN_LIST'))
 await reject('cloned_token',()=>seam.displayForMode(clone(corpus),'PLAIN_LIST'))
 await reject('duplicate_subset_ids',()=>seam.displayForMode(corpus,'PLAIN_LIST',[candidate.displayRecords[0].id,candidate.displayRecords[0].id]))
 await reject('fabricated_subset_id',()=>seam.displayForMode(corpus,'PLAIN_LIST',['SEMANTIC.'+'0'.repeat(64)]))
 await reject('raw_record_selector',()=>seam.displayForMode(corpus,'PLAIN_LIST',[candidate.displayRecords[0]]))
 await reject('synthetic_record_in_canonical',()=>seam.validateDisplayRecord(fixture.records[0],corpus))
 const noSeal=clone(candidate);noSeal.displayRecords[0].question='Fabricated';await reject('stale_top_level_seal',()=>seam.admitFrozenCorpusCandidate(noSeal))
 return {status:'PASS',resealedFalseSuccessRejections:results.length,results,legitimateSubsetModes:3,completeCandidateAdmitted:true,interfaceIdentity:seam.CORPUS_INTERFACE_IDENTITY,interfaceFrozen:false,LaneCActive:false}
}
