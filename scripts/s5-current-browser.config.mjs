import config from './s4-r2-current-browser.config.mjs'
export default {...config,testIgnore:[...config.testIgnore,'**/s5-*.spec.ts','**/lane-c/**'],outputDir:'../.s5-current-browser-results'}
