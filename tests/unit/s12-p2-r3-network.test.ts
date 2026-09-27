import { describe, expect, it } from 'vitest'
import { classifyBrowserRequest } from '../fixtures/s2/network-classification'

const origin = 'http://127.0.0.1:4173'

describe('S12-P2-R3 static asset classification', () => {
  it('allows only named same-origin static GET and HEAD paths', () => {
    for (const path of ['/', '/assets/index.js', '/art-packs/production/room-plate-480x180.png', '/art-review/background-detail/bg-wall-clock.png', '/scenarios/euler-2023-false-exit/scenario.json']) {
      expect(classifyBrowserRequest(new URL(path, origin), 'GET', origin)).toBe('static')
      expect(classifyBrowserRequest(new URL(path, origin), 'HEAD', origin)).toBe('static')
    }
    expect(classifyBrowserRequest(new URL('https://api.nansen.ai/api/v1/portfolio'), 'GET', origin)).toBe('provider')
    expect(classifyBrowserRequest(new URL('/api/v1/portfolio', origin), 'GET', origin)).toBe('provider')
    expect(classifyBrowserRequest(new URL('https://example.com/art-packs/a.png'), 'GET', origin)).toBe('external')
    expect(classifyBrowserRequest(new URL('/art-packs/a.png', origin), 'POST', origin)).toBe('mutation')
    expect(classifyBrowserRequest(new URL('/unknown-endpoint', origin), 'GET', origin)).toBe('unknown')
  })
})
