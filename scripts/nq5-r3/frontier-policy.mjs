import { identity, sha, freeze } from '../nq5/schema.mjs'
import { frontierPolicy } from '../nq5-r2/frontier.mjs'
import { ACTIVE_R3 } from './authority.mjs'

const bytes = value => Buffer.from(JSON.stringify(value,null,2)+'\n')
function payload(fixture,plan,admission,sourceIdentity) {
  const {hash:_inheritedHash,...base}=frontierPolicy(fixture)
  return {...base,schemaVersion:'3.0.0',activeSourceIdentity:sourceIdentity,frozenArtifactSourceIdentity:plan.activeSourceIdentity,campaignId:plan.campaignId,publiclyAdmittedFamilies:admission.contracts.map(row=>row.family).sort(),heldFamiliesExcluded:admission.records.filter(row=>!row.qualificationCountedEligible).map(row=>row.family).sort(),genesisDoesNotProveFuturePages:true,frozenPlanSha256:sha(bytes(plan)),frozenPlanIdentity:plan.hash}
}
export function assertFrontierPolicyIdentity(policy,{fixture,plan,admission,campaignId=plan.campaignId,sourceIdentity=identity(ACTIVE_R3)}) {
  if(!policy || typeof policy!=='object' || Array.isArray(policy) || !/^[a-f\d]{64}$/.test(policy.hash))throw new Error('Missing or malformed frontier-policy identity.')
  const {hash,...contents}=policy,{hash:planHash,...planContents}=plan
  if(identity(contents)!==hash || identity(planContents)!==planHash || !plan.frozen || plan.activeSourceIdentity!==identity(ACTIVE_R3) || plan.campaignId!==campaignId || plan.officialContractAdmissionSha256!==sha(bytes(admission)) || plan.requests.some(row=>!admission.contracts.some(contract=>contract.hash===row.contractHash && contract.family===row.family)) || identity(contents)!==identity(payload(fixture,plan,admission,sourceIdentity)))throw new Error('Frontier policy identity or plan/campaign/source/admitted-family binding mismatch.')
  return true
}
export function buildFrontierPolicy(fixture,plan,admission,sourceIdentity=identity(ACTIVE_R3)) {
  const contents=payload(fixture,plan,admission,sourceIdentity),policy=freeze({...contents,hash:identity(contents)})
  assertFrontierPolicyIdentity(policy,{fixture,plan,admission,sourceIdentity})
  return policy
}
