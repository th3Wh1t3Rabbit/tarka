import config from './s2-browser.config.mjs'
export default {...config,testMatch:'s5-*.spec.ts',outputDir:'../.s5-browser-results',use:{...config.use,launchOptions:{args:['--proxy-server=http://127.0.0.1:9','--proxy-bypass-list=127.0.0.1;localhost','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost']}}}
