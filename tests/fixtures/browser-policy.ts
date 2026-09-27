export function violatesFrozenBrowserPolicy(url: string, localOrigin = 'http://127.0.0.1:4173') {
  const parsed = new URL(url)
  return parsed.origin !== localOrigin || /^\/api(?:\/|$)/i.test(parsed.pathname) || /nansen|alchemy/i.test(parsed.hostname)
}
