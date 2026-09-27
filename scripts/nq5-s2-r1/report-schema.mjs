import {schemaOf} from '../nq5-s1/model.mjs'
import {MEASUREMENTS} from '../nq5-s2/activity.mjs'
export function reportSchema(report){
 const s=schemaOf(report),nullableInteger={anyOf:[{type:'integer',minimum:0},{type:'null'}]}
 const visit=x=>{if(!x||typeof x!=='object')return;if(x.properties){for(const[k,p]of Object.entries(x.properties)){if(k==='credits'||k==='bytes')x.properties[k]=structuredClone(nullableInteger);else if(k==='measurementClass')x.properties[k]={enum:MEASUREMENTS};else if(['reviewIdentity','submissionApplicabilityReviewIdentity'].includes(k))x.properties[k]={anyOf:[{type:'string',pattern:'^[a-f0-9]{64}$'},{type:'null'}]};else visit(p)}}if(x.items)visit(x.items);if(x.anyOf)x.anyOf.forEach(visit)}
 visit(s);return s
}
