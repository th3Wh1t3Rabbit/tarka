import config from './s2-current-browser.config.mjs'
export default {...config,testIgnore:[...config.testIgnore,'**/s3-*.spec.ts']}
