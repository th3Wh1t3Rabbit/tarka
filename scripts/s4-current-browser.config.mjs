import config from './s3-current-browser.config.mjs'
export default {...config,testIgnore:[...config.testIgnore,'**/s4-*.spec.ts']}
