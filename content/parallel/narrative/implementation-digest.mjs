import {readFileSync,readdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
export function implementationIdentity(root=process.cwd()) {
  const paths=[]
  function walk(dir) {
    for(const entry of readdirSync(resolve(root,dir),{withFileTypes:true})) {
      const path=`${dir}/${entry.name}`
      if(entry.isSymbolicLink())throw new Error('Implementation symlink prohibited')
      if(entry.isDirectory())walk(path)
      else if(entry.isFile())paths.push(path)
    }
  }
  walk('content/parallel/narrative');walk('tests/unit/parallel/narrative-contract')
  paths.push('docs/parallel/lane-a/01_REPOSITORY_COPY_INVENTORY.md','docs/parallel/lane-a/NARRATIVE_AND_MISSION_CONTENT_BIBLE.md','docs/parallel/lane-a/TE_IFACE_CONTENT_v1.1.0.json')
  const files=paths.sort().map(path=>({path,sha256:createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex')}))
  return {sha256:createHash('sha256').update(JSON.stringify(files)+'\n').digest('hex'),files}
}
if(process.argv[1]?.endsWith('implementation-digest.mjs'))process.stdout.write(JSON.stringify(implementationIdentity(),null,2)+'\n')
