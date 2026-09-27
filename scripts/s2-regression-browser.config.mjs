import config from '../playwright.config.ts'
import {fileURLToPath} from 'node:url'
export default {...config,testDir:'../tests/e2e',testIgnore:['**/s2-*.spec.ts'],retries:0,workers:1,reporter:[['list']],outputDir:'../.s2-regression-browser-results',use:{...config.use,launchOptions:{args:['--proxy-server=http://127.0.0.1:9','--proxy-bypass-list=127.0.0.1;localhost','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost']},screenshot:'off',trace:'off',video:'off'},webServer:{...config.webServer,cwd:fileURLToPath(new URL('../',import.meta.url)),reuseExistingServer:false}}
