import { identity } from '../nq5/schema.mjs'

export const CAMPAIGN='NQ5-T1-20260916-15fc6ad1-d6f3-422a-b724-de5e66154011'
export const validAddress=v=>typeof v==='string'&&/^0x[0-9a-f]{40}$/i.test(v)
export function amountClass(lexeme){
 if(typeof lexeme!=='string'||!/^[-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(lexeme)||lexeme.length>4096)throw new Error('SEMANTIC_EXACT_DECIMAL_REQUIRED')
 const [mantissa,exponent='0']=lexeme.split(/[eE]/);if(!Number.isInteger(Number(exponent))||Math.abs(Number(exponent))>1000)throw new Error('SEMANTIC_DECIMAL_EXPONENT_BOUND')
 return !/[1-9]/.test(mantissa)?'ZERO':mantissa.startsWith('-')?'NEGATIVE':'POSITIVE'
}
export const transferIdentity=r=>identity([r.transaction_hash.toLowerCase(),r.from_address.toLowerCase(),r.to_address.toLowerCase(),r.token_address.toLowerCase(),r.amount])
export function strictTransfers(exact,request,times){
 const stats={rawTransactionRecords:exact.data.length,rawTransferRows:0,subjectInvolvedRows:0,incidentalRows:0,positiveRows:0,zeroRows:0,negativeRows:0,duplicateRows:0,uniquePositiveSubjectRows:0,uniqueAdmittedRows:0}
 const records=[],candidates=[],seen=new Set(),tokens=new Set();let invalidAmount=false
 if(!validAddress(request.body.address))throw new Error('SEMANTIC_REQUEST_SUBJECT_INVALID')
 const subject=request.body.address.toLowerCase()
 for(const [i,tx]of exact.data.entries()){
  const transfers=[...(tx.tokens_sent??[]),...(tx.tokens_received??[])];if(!transfers.length)throw new Error('SEMANTIC_TRANSFER_CORE_REQUIRED')
  for(const t of transfers){
   if(t.chain!=='ethereum'||![t.from_address,t.to_address,t.token_address].every(validAddress))throw new Error('SEMANTIC_TRANSFER_CORE_INVALID')
   stats.rawTransferRows++;tokens.add(t.token_address.toLowerCase());const kind=amountClass(t.token_amount);stats[kind==='POSITIVE'?'positiveRows':kind==='ZERO'?'zeroRows':'negativeRows']++;if(kind!=='POSITIVE')invalidAmount=true
   const involved=t.from_address.toLowerCase()===subject||t.to_address.toLowerCase()===subject
   if(!involved){stats.incidentalRows++;continue}stats.subjectInvolvedRows++
   const joined=times[i].exactUtcFromAcceptedTruth,r={transaction_hash:tx.transaction_hash,from_address:t.from_address,to_address:t.to_address,token_address:t.token_address,amount:t.token_amount,evidence_grade:'CONTEXTUAL',temporal_class:times[i].classification,...(joined?{accepted_exact_utc:joined,accepted_exact_time_source:'ACCEPTED_EULER_TRUTH_HASH_JOIN'}:{})},key=transferIdentity(r)
   if(seen.has(key)){stats.duplicateRows++;continue}seen.add(key)
   candidates.push({...r,amountClass:kind});if(kind==='POSITIVE')records.push(r)
  }
 }
 stats.uniquePositiveSubjectRows=records.length
 const code=invalidAmount?'ZERO_OR_NEGATIVE_TRANSFER_RESPONSE_REJECTED':records.length?'PASS':'NO_UNIQUE_POSITIVE_SUBJECT_TRANSFER'
 const pass=code==='PASS';stats.uniqueAdmittedRows=pass?records.length:0
 return {pass,code,stats,normalizedRecords:pass?records:[],subjectCandidates:candidates,tokenContracts:[...tokens].sort(),normalizedIdentity:pass?identity(records):null}
}
export function assertCampaignRecord(record,campaign=CAMPAIGN){if(campaign!==CAMPAIGN||record.campaign_id!==campaign)throw new Error('SEMANTIC_EXACT_CAMPAIGN_BINDING_REQUIRED');return true}
