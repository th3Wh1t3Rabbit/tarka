import {expect,test} from '@playwright/test'
import {attemptKeyboardSourceCopy,reachSourceByKeyboard} from '../fixtures/s2/keyboard-source-copy'
test('pre-fix B-F02 confirms all nine accepted keyboard exact-copy failures on MAIN',async({page})=>{
 const data=await reachSourceByKeyboard(page),results=[]
 for(const mode of ['FULLSCREEN_CRT','DOCKED_OVERLAY','PLAIN_LIST'])results.push(...await attemptKeyboardSourceCopy(page,data,mode))
 expect(results).toHaveLength(9);expect(results.every(r=>!r.copied)).toBe(true);expect(results.every(r=>r.sourceControls===0&&r.structure.tabIndex===-1)).toBe(true)
 expect(data.requests.filter(r=>r.forbidden)).toEqual([])
 console.log(JSON.stringify({test:'B-F02',phase:'PRE_FIX_MAIN',modeValueChecks:9,allFailedExactCopy:true,sourceControls:0,externalRequests:0,syntheticOnly:true}))
})
