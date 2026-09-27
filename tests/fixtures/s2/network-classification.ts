export type RequestClass = 'static' | 'external' | 'provider' | 'mutation' | 'unknown'

const STATIC_PREFIXES = ['/assets/', '/art-packs/', '/art-review/background-detail/', '/scenarios/', '/artifacts/', '/public/', '/content/', '/src/', '/node_modules/', '/@vite/', '/@react-refresh', '/@fs/']

export function classifyBrowserRequest(url: URL, method: string, origin: string): RequestClass {
  const nansen = /(^|\.)nansen\.ai$/i.test(url.hostname)
  if (url.origin !== origin) return nansen ? 'provider' : 'external'
  if (method !== 'GET' && method !== 'HEAD') return 'mutation'
  if (nansen || /^\/api(?:\/|$)/i.test(url.pathname) || /\/(credential|account|provider)(?:\/|$)/i.test(url.pathname)) return 'provider'
  if (url.pathname === '/' || url.pathname === '/favicon.ico' || url.pathname === '/index.html') return 'static'
  if (STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return 'static'
  return 'unknown'
}

export function forbiddenRequest(url: URL, method: string, origin: string) {
  return classifyBrowserRequest(url, method, origin) !== 'static'
}
