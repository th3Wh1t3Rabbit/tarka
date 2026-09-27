import type {DisplayRecord} from './contracts'
import type {Presentation} from '../contracts'
declare const admittedCorpusBrand:unique symbol
declare const admittedSyntheticBrand:unique symbol
export type DeepReadonly<T>=T extends object?{readonly [P in keyof T]:DeepReadonly<T[P]>}:T
export interface AdmittedCorpus {readonly [admittedCorpusBrand]:true;readonly kind:'PINNED_REVIEWED_CANDIDATE_NOT_MAIN_FROZEN';readonly interface:'TE-IFACE-CORPUS@1.0.0';readonly identity:string}
export interface AdmittedSyntheticCorpus {readonly [admittedSyntheticBrand]:true;readonly kind:'NONCANONICAL_NONHISTORICAL_NONPROOF_SYNTHETIC_ONLY'}
export const CORPUS_INTERFACE:'TE-IFACE-CORPUS@1.0.0'
export const CORPUS_INTERFACE_IDENTITY:'4c9d93c8b9b97503df4580ee72f8d19c7515a9ed29dad54d558cb258bd2c3e60'
export function canonicalJSON(value:unknown):string
export function admitFrozenCorpusCandidate(value:unknown):Promise<AdmittedCorpus>
export function validateDisplayRecord(value:unknown,corpus:AdmittedCorpus):Promise<DeepReadonly<DisplayRecord>>
export function displayForMode(corpus:AdmittedCorpus,mode:Presentation,ids?:string[]):Promise<readonly DeepReadonly<DisplayRecord>[]>
export function admitSyntheticCorpusFixture(value:unknown):Promise<AdmittedSyntheticCorpus>
export function syntheticDisplayForMode(corpus:AdmittedSyntheticCorpus,mode:Presentation,ids?:string[]):Promise<readonly DeepReadonly<DisplayRecord>[]>
