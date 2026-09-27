import {CLASSES,PROJECTS,MEASUREMENTS} from './activity.mjs'
const token={type:'string',pattern:'^[A-Za-z0-9_.-]{1,120}$'},number={type:'integer',minimum:0}
const row={type:'object',additionalProperties:false,required:['observed_at_utc','endpoint','displayed_credits','status','source_fragment','source_row'],properties:{observed_at_utc:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$'},endpoint:{type:'string',pattern:'^/api/v[1-9]\\d*/[a-z0-9/-]+$'},displayed_credits:number,status:{enum:['SUCCESS','FAILURE','UNRESOLVED']},source_fragment:token,source_row:{type:'integer',minimum:1},source_row_id:token,explicit_overlap_group:{anyOf:[token,{type:'null'}]},project_class:{enum:PROJECTS},http_status:{type:'integer',minimum:100,maximum:599}}}
const source={type:'object',additionalProperties:false,required:['source_id','source_class','project_class','rows'],properties:{schema_version:{const:'1.0.0'},source_id:token,source_class:{enum:CLASSES},project_class:{enum:PROJECTS},rows:{type:'array',items:row},timezone_note:{type:'string'},rows_received:number,final_quota_proof_eligible:{type:'boolean'},limitations:{type:'array',items:{type:'string'}},deduplication:{type:'object',additionalProperties:false,properties:{method:{type:'string'},duplicate_rows_removed:number}},derived_summary:{type:'object',additionalProperties:false,properties:Object.fromEntries(['unique_successful_requests','displayed_credit_total','polling_cycles','average_requests_per_cycle','five_minute_continuous_projection_requests_per_day','five_minute_continuous_projection_credits_per_day','principal_conservative_planning_floor_requests_per_day','full_window_projection_at_conservative_floor'].map(k=>[k,number]).concat([['endpoint_counts',{type:'object',patternProperties:{'^/api/v[1-9]\\d*/[a-z0-9/-]+$':number},additionalProperties:false}]]))}}}
row.properties.measurement_class={const:'PROVIDER_REQUEST_ROW'}
row.properties.displayed_credits={anyOf:[number,{type:'null'}]}
row.required.push('measurement_class')
const artifact={type:'object',additionalProperties:false,required:['filename','sha256','bytes'],properties:{filename:{type:'string',pattern:'^[A-Za-z0-9_.-]{1,240}$'},sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},bytes:{anyOf:[number,{type:'null'}]}}}
const logicalRow={type:'object',additionalProperties:false,required:['measurement_class','scheduled_utc','observed_terminal_utc','family','asset_symbol','operation_fingerprint','terminal_results','source_message_sha256','displayed_credits'],properties:{measurement_class:{const:'PROJECT_LOGICAL_OPERATION'},scheduled_utc:{type:'string'},observed_terminal_utc:{type:'string'},family:token,asset_symbol:token,operation_fingerprint:token,terminal_results:{enum:['live_controlled_success','package_result_authority_conflict','live_controlled_success|provider_start_failed']},source_message_sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},displayed_credits:{const:null}}}
source.properties.schema_version={const:'2.0.0'}
source.properties.measurement_class={enum:MEASUREMENTS}
source.properties.source_artifact=artifact
source.properties.upstream_artifact=artifact
source.properties.review_receipt={type:'object',additionalProperties:false,required:['identity','disposition'],properties:{identity:{type:'string',pattern:'^[a-f0-9]{64}$'},disposition:{enum:['VERIFIED','UNVERIFIED']}}}
source.properties.credit_semantics={enum:['DISPLAYED_CREDITS','UNKNOWN']}
source.properties.planning_commitment={type:'object',additionalProperties:false,required:['completeDaysConservativeCommittedCredits','partialDayConservativeCommittedCredits','metric'],properties:{completeDaysConservativeCommittedCredits:number,partialDayConservativeCommittedCredits:number,metric:{const:'NON_BILLED_CONSERVATIVE_PLANNING_COMMITMENT'}}}
source.properties.bounded_counts={type:'object',additionalProperties:false,required:['measurement','lowerBound','upperBound'],properties:{measurement:{enum:['PROVIDER_REQUEST_ROW','PROJECT_LOGICAL_OPERATION']},lowerBound:number,upperBound:{anyOf:[number,{type:'null'}]}}}
source.required.push('schema_version','measurement_class','source_artifact','credit_semantics')
source.properties.rows={type:'array',items:{oneOf:[row,logicalRow]}}
source.allOf=[
 {if:{properties:{measurement_class:{const:'PROVIDER_REQUEST_ROW'}}},then:{properties:{rows:{items:row},source_class:{not:{const:'PROJECT_LEDGER_SUMMARY'}}},not:{required:['planning_commitment']}},else:{properties:{credit_semantics:{const:'UNKNOWN'}},not:{required:['derived_summary']}}},
 {if:{properties:{measurement_class:{const:'PROJECT_LOGICAL_OPERATION'}}},then:{properties:{rows:{items:logicalRow},source_class:{not:{const:'ESTIMATED'}}},not:{required:['bounded_counts']}}},
 {if:{properties:{measurement_class:{const:'AGGREGATE_ONLY'}}},then:{required:['bounded_counts'],properties:{rows:{maxItems:0}}}},
 {if:{properties:{credit_semantics:{const:'UNKNOWN'},measurement_class:{const:'PROVIDER_REQUEST_ROW'}}},then:{properties:{rows:{items:{properties:{displayed_credits:{const:null}}}}}}}
]
export const ACTIVITY_INPUT_SCHEMA={$schema:'https://json-schema.org/draft/2020-12/schema',oneOf:[source,{type:'array',minItems:1,items:source}]}
