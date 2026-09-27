import assert from 'node:assert/strict'
import dns from 'node:dns'
import net from 'node:net'
const expected=/external network hold/
assert.throws(()=>fetch('https://example.invalid/'),expected)
assert.throws(()=>dns.lookup('example.invalid',()=>{}),expected)
assert.throws(()=>net.connect({host:'example.invalid',port:443}),expected)
await assert.rejects(dns.promises.lookup('example.invalid'),expected)
console.log(JSON.stringify({status:'PASS',blockedBeforeRequest:4,externalRequests:0,credentialAccess:false,probeTargets:'Reserved invalid host only; hold rejects before transport.'}))
