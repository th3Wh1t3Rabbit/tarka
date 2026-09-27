import path from 'node:path'
import {identity,sha,freeze} from '../nq5/schema.mjs'
import {readEvidence} from './evidence-files.mjs'
import {CORRECTION_SHA} from './authority.mjs'
export const PREPARED='G6P_NQ5_T1_P2_PREPARED_PUBLIC_METADATA.json'
export function preparedPlans(root){const bytes=readEvidence(path.join(root,'docs'),PREPARED);if(sha(bytes)!=='166e5d9a03fbdf121d8cd4c01d6e15f41b854184151a6dfe7e0e157c14ab3020')throw new Error('P2_EXACT_REVIEWED_HISTORICAL_PLAN_BYTES');const n=JSON.parse(bytes);if(n.schemaVersion!=='1.0.0'||n.scope!=='MAIN_REPRODUCED_PUBLIC_PRELIVE_PLAN_METADATA_ONLY_NO_RAW_OR_CURRENT_RUNTIME_PROOF'||n.approvedIdentityCorrectionSha256!==CORRECTION_SHA)throw new Error('P2_GOVERNED_PREPARED_METADATA_SCOPE');for(const k of ['plan','reserve','policy']){const{hash,...p}=n.plans[k];if(hash!==identity(p))throw new Error('P2_GOVERNED_PREPARED_METADATA_SEAL')};if(n.plans.plan.completeCandidateMatrixIdentity!==identity(n.plans.matrix)||n.plans.reserve.planIdentity!==n.plans.plan.hash||n.plans.plan.frontierPolicyIdentity!==n.plans.policy.hash||n.plans.plan.p1LeadAcceptanceReceiptIdentity!==n.p1LeadAcceptanceReceiptIdentity||n.plans.plan.acceptedPublicIndexIdentity!==n.acceptedIndexIdentity)throw new Error('P2_GOVERNED_PREPARED_METADATA_BINDINGS');return n}
export function assertPrepared(c){const n=preparedPlans(c.root);if(n.p1LeadAcceptanceReceiptIdentity!==c.receipt.hash||n.acceptedIndexIdentity!==identity(c.index)||identity(n.plans)!==identity(c.plans))throw new Error('P2_MAIN_REPRODUCED_PREPARED_METADATA_REQUIRED');return true}

export function historicalPlans(root){return freeze(structuredClone(preparedPlans(root).plans))}
