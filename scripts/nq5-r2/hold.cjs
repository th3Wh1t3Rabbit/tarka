// R2 permits local verification servers only. No external DNS, socket or fetch.
const net = require('node:net'), dns = require('node:dns')
const local = host => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)
const deny = () => { throw new Error('R2 external network hold; no request permitted.') }
const connect = net.Socket.prototype.connect
net.Socket.prototype.connect = function (...args) {
  const effective = Array.isArray(args[0]) ? args[0] : args, normalized = effective[0]
  if (normalized && typeof normalized === 'object' && normalized.path) return connect.apply(this, args)
  const host = typeof normalized === 'object' ? normalized.host ?? 'localhost' : typeof effective[1] === 'string' ? effective[1] : 'localhost'
  if (!local(host)) deny()
  return connect.apply(this, args)
}
const lookup = dns.lookup
dns.lookup = function (host, ...args) { if (!local(host)) deny(); return lookup.call(this, host, ...args) }
for (const key of Object.keys(dns)) if (key.startsWith('resolve') && typeof dns[key] === 'function') dns[key] = deny
dns.promises.lookup = async function (host, ...args) { if (!local(host)) deny(); return new Promise((resolve, reject) => lookup(host, ...args, (error, address, family) => error ? reject(error) : resolve({ address, family }))) }
for (const key of Object.keys(dns.promises)) if (key.startsWith('resolve') && typeof dns.promises[key] === 'function') dns.promises[key] = deny
const fetch = globalThis.fetch
globalThis.fetch = (...args) => { const url = new URL(typeof args[0] === 'string' || args[0] instanceof URL ? args[0] : args[0].url); if (!local(url.hostname)) deny(); return fetch(...args) }
