import {validateDisplayRecord,displayForMode,type AdmittedCorpus,type AdmittedSyntheticCorpus} from '../../src/investigation/corpus-seam/contracts'
// Compile-only checks: never invoked; @ts-expect-error must be consumed by tsc.
export function canonicalTypeContract(record:unknown,corpus:AdmittedCorpus,synthetic:AdmittedSyntheticCorpus){
  validateDisplayRecord(record,corpus)
  // @ts-expect-error canonical record validation requires an admitted token
  validateDisplayRecord(record)
  // @ts-expect-error a forged ordinary object has no private corpus brand
  validateDisplayRecord(record,{})
  // @ts-expect-error synthetic tokens do not confer canonical authority
  validateDisplayRecord(record,synthetic)
  // @ts-expect-error arbitrary raw arrays cannot confer corpus authority
  displayForMode([record],'PLAIN_LIST')
}
