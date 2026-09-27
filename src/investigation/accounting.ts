/** S2 active model. Historical supplier field names/receipts are not rewritten. */
export const MERIDIAN_POLICY = Object.freeze({ officialAccountCallFloor: 1000, accountPlanningBufferTarget: 1024, curatedProductCallFloor: null, quotaWindowStartUtc: '2026-09-14T00:00:00Z', quotaWindowEndUtc: '2026-09-27T23:59:00Z', newCallSolelyForCountAllowed: false, accountQuotaBelongsInCaseCorpus: false, cppIsCuratedGameEvidence: false })
export interface EvidenceAccounting {
 accountCompliance: { verifiedEligibleSuccesses: number | null; finalProofEligible: boolean; quotaMet: boolean }
 traceAcquisition: { attempts: number; responses2xx: number; supplierTerminals: number; retries: number; unknownReservations: number }
 curatedProductEvidence: { leadAcceptedCalls: number; publicRecords: number; integrationAccepted: boolean }
 credits: { knownTraceCredits: number; accountCredits: number | null }
}
export const acceptedEvidenceAccounting: EvidenceAccounting = {
 accountCompliance: { verifiedEligibleSuccesses: null, finalProofEligible: false, quotaMet: false },
 traceAcquisition: { attempts: 47, responses2xx: 33, supplierTerminals: 31, retries: 0, unknownReservations: 14 },
 curatedProductEvidence: { leadAcceptedCalls: 25, publicRecords: 25, integrationAccepted: false },
 credits: { knownTraceCredits: 37, accountCredits: null },
}
