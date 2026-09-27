// Supplier's unchanged direct test has a historical Lane-A-only path gate.
// It runs in an isolated exact-additions fixture, not the integration worktree.
if(process.argv.some(v=>v.endsWith('/narrative-contract/catalogs.node.mjs'))){
 const root=process.env.S4_LANE_CONTRACT_ROOT
 if(!root)throw Error('S4_LANE_CONTRACT_FIXTURE_REQUIRED')
 process.chdir(root)
}
