'use strict'

const net = require('node:net')
const dns = require('node:dns')
const dgram = require('node:dgram')
const http = require('node:http')
const http2 = require('node:http2')
const https = require('node:https')
const tls = require('node:tls')
const { syncBuiltinESMExports } = require('node:module')

function blocked() {
  throw new Error('NONLOCAL_NETWORK_ATTEMPT_BLOCKED')
}

net.connect = blocked
net.createConnection = blocked
net.Socket.prototype.connect = blocked
dns.lookup = blocked
dns.resolve = blocked
for (const name of ['lookup', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCaa', 'resolveCname', 'resolveMx', 'resolveNaptr', 'resolveNs', 'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt', 'reverse']) {
  if (typeof dns.promises[name] === 'function') dns.promises[name] = blocked
}
dgram.createSocket = blocked
http.request = blocked
http.get = blocked
https.request = blocked
https.get = blocked
http2.connect = blocked
tls.connect = blocked
globalThis.fetch = blocked
syncBuiltinESMExports()
