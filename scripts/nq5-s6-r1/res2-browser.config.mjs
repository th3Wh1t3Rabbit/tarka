import config from '../s5-browser.config.mjs'
import {fileURLToPath} from 'node:url'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
export default {...config,testDir:fileURLToPath(new URL('./',import.meta.url)),testMatch:'res2-atomic.spec.ts',outputDir:fs.mkdtempSync(path.join(os.tmpdir(),'res2-browser-results-')),workers:1,retries:0}
