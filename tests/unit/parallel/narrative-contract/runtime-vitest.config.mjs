import {createRequire} from 'node:module'
import {resolve,dirname} from 'node:path'
// Optional read-only reuse of an existing local dependency installation. No
// packages are installed and no source/config files outside owned paths change.
const dependencyAnchor=resolve(process.env.LANE_A_DEPENDENCY_ANCHOR??'package.json')
const dependencyRequire=createRequire(dependencyAnchor)
const vitestRoot=dirname(dependencyRequire.resolve('vitest/package.json'))
export default {
  resolve:{alias:{vitest:resolve(vitestRoot,'dist/index.js'),'js-yaml':dependencyRequire.resolve('js-yaml')}},
  test:{environment:'node',include:['tests/unit/g6p-a0.test.ts','tests/unit/g6p-a2p.test.ts','tests/unit/g6p-a2u.test.ts','tests/unit/g6p-a2u-cut.test.mjs','tests/unit/g6p-a2u-bootstrap-schema.test.mjs','tests/unit/parallel/narrative-contract/catalogs.test.mjs','tests/unit/parallel/narrative-contract/runtime-adapter.test.ts']}
}
