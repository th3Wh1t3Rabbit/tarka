import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {sha} from './activity.mjs'
/** Approved previously published archives: verification inputs only, never delivery members. */
export function attachPublishedRegressionInputs(root,parent,env){
 const sources=[['scripts/nq5-b1/authority.mjs',null,'ACCEPTED_ARCHIVE_SHA','TRACE_ESCAPE_G6P_A2U_R3_R1_FRONTIER_POLICY_IDENTITY_REMEDIATION_DELIVERY_v1.0.0.zip'],['scripts/nq5-b1-r1/checkpoint.mjs','B1_ARCHIVE','B1_SHA'],['scripts/nq5-b1-r2/gates.mjs','R1_ARCHIVE','R1_SHA'],...['scripts/nq5-b1-r3/authority.mjs','scripts/nq5-b1-r3-r1/authority.mjs','scripts/nq5-b1-r3-r2/authority.mjs','scripts/nq5-b2/authority.mjs','scripts/nq5-b3/authority.mjs'].map(n=>[n,'ARCHIVE','ARCHIVE_SHA'])],bindings=[]
 for(const [file,name,pin,literal]of sources){const text=fs.readFileSync(path.join(root,file),'utf8'),n=literal||text.match(new RegExp('\\b'+name+"\\s*=\\s*'([^']+)'"))?.[1],h=text.match(new RegExp('\\b'+pin+"\\s*=\\s*'([a-f0-9]{64})'"))?.[1]
  if(!n||!/^TRACE_ESCAPE_[A-Za-z0-9_.]+\.zip$/.test(n)||!h)throw Error('S2_PUBLISHED_INPUT_PIN')
  const input=path.join(path.dirname(root),n),st=fs.lstatSync(input);if(!st.isFile()||st.isSymbolicLink()||sha(fs.readFileSync(input))!==h)throw Error('S2_PUBLISHED_INPUT_IDENTITY')
  const py="import zipfile,stat,sys\nwith zipfile.ZipFile(sys.argv[1]) as z:\n names=[i.filename for i in z.infolist()]\n assert len(names)==len(set(names))\n for i in z.infolist():\n  assert not i.is_dir() and stat.S_IFMT(i.external_attr>>16) in (0,stat.S_IFREG) and not i.filename.startswith('/') and '\\\\' not in i.filename and '..' not in i.filename.split('/')\nprint('SAFE_REGULAR_METADATA')"
  if(!execFileSync('python3',['-c',py,input],{env}).toString().includes('SAFE_REGULAR_METADATA'))throw Error('S2_PUBLISHED_ARCHIVE_ADMISSION')
  const target=path.join(parent,n);if(fs.existsSync(target)){if(!fs.lstatSync(target).isSymbolicLink()||fs.readlinkSync(target)!==input)throw Error('S2_PUBLISHED_TEMP_INPUT_COLLISION')}else fs.symlinkSync(input,target)
  bindings.push({archive:n,sha256:h,authority:'PRIOR_PUBLISHED_REDACTED_SYNTHETIC_REGRESSION_REFERENCE_ONLY',metadataAdmission:'PASS',copied:false,includedInDelivery:false})
 }
 return {status:'PASS',bindings,dependencyKind:'Eight local published evidence references external to tracked repository, including transitive foundation; no network retrieval.',privateCampaignReplay:false,credentialResolution:false,completeHistoryIncludedInDelivery:false}
}
