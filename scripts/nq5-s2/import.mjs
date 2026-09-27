import fs from 'node:fs'
import {importActivity,parseCSV} from './activity.mjs'
// Caller supplies an already-sanitized local activity file; no account/key lookup.
const [input,metadataFile]=process.argv.slice(2)
if(!input||!/\.(json|csv)$/i.test(input)||/(?:nansen[_-]?api[_-]?key|credential|secret)/i.test(input))throw Error('S2_LOCAL_SANITIZED_ACTIVITY_REQUIRED')
const stat=fs.lstatSync(input)
if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>8_000_000)throw Error('S2_REGULAR_BOUNDED_ACTIVITY_FILE_REQUIRED')
let metadata
if(/\.csv$/i.test(input)){
 if(!metadataFile||!/\.json$/i.test(metadataFile)||/(?:nansen[_-]?api[_-]?key|credential|secret)/i.test(metadataFile))throw Error('S2_EXPLICIT_SANITIZED_CSV_METADATA_REQUIRED')
 const m=fs.lstatSync(metadataFile);if(!m.isFile()||m.isSymbolicLink()||m.nlink!==1||m.size>100_000)throw Error('S2_REGULAR_BOUNDED_METADATA_REQUIRED')
 metadata=JSON.parse(fs.readFileSync(metadataFile,'utf8'))
}
const text=fs.readFileSync(input,'utf8'),data=/\.csv$/i.test(input)?parseCSV(text,metadata):JSON.parse(text)
console.log(JSON.stringify(importActivity(data),null,2))
