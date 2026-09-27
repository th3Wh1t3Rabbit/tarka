import { afterAll, describe, expect, it } from 'vitest'
import { StrictMode, act, createElement, useEffect } from 'react'
import { useSemanticTimers, type TimerSession } from '../../src/app/useSemanticTimers'

const prior = {
  document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
  HTMLElement: Object.getOwnPropertyDescriptor(globalThis, 'HTMLElement'),
  Element: Object.getOwnPropertyDescriptor(globalThis, 'Element'),
  Node: Object.getOwnPropertyDescriptor(globalThis, 'Node'),
  HTMLIFrameElement: Object.getOwnPropertyDescriptor(globalThis, 'HTMLIFrameElement'),
  IS_REACT_ACT_ENVIRONMENT: Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT'),
  navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
}

afterAll(() => {
  for (const [key, descriptor] of Object.entries(prior) as [string, PropertyDescriptor | undefined][]) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete (globalThis as Record<string, unknown>)[key]
  }
})

function installDom() {
  class HTMLElement {}
  class Element extends HTMLElement {}
  class Node {}
  class HTMLIFrameElement extends HTMLElement {}
  function el(tag: string) {
    const node = {
      tagName: tag.toUpperCase(),
      nodeType: 1,
      style: {},
      childNodes: [] as object[],
      attributes: {} as Record<string, string>,
      ownerDocument: null as object | null,
      parentNode: null as object | null,
      namespaceURI: 'http://www.w3.org/1999/xhtml',
      nodeName: tag.toUpperCase(),
      textContent: '',
      setAttribute(key: string, value: string) { this.attributes[key] = String(value) },
      getAttribute(key: string) { return this.attributes[key] ?? null },
      removeAttribute(key: string) { delete this.attributes[key] },
      hasAttribute(key: string) { return key in this.attributes },
      appendChild(child: { parentNode: object | null }) { child.parentNode = this; this.childNodes.push(child); return child },
      removeChild(child: object) { this.childNodes = this.childNodes.filter((item) => item !== child); return child },
      insertBefore(child: { parentNode: object | null }, before: object) {
        child.parentNode = this
        const index = this.childNodes.indexOf(before)
        if (index < 0) this.childNodes.push(child)
        else this.childNodes.splice(index, 0, child)
        return child
      },
      addEventListener() {},
      removeEventListener() {},
      focus() {},
      blur() {},
      contains() { return false },
      compareDocumentPosition() { return 0 },
      getBoundingClientRect() { return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON() { return {} } } },
    }
    Object.setPrototypeOf(node, HTMLElement.prototype)
    return node
  }
  const document = {
    createElement(tag: string) { const node = el(tag); node.ownerDocument = document; return node },
    createElementNS(_namespace: string, tag: string) { const node = el(tag); node.ownerDocument = document; return node },
    createTextNode(text: string) { return { nodeType: 3, nodeName: '#text', textContent: String(text), nodeValue: String(text), parentNode: null } },
    body: null as ReturnType<typeof el> | null,
    documentElement: null as ReturnType<typeof el> | null,
    head: null as ReturnType<typeof el> | null,
    activeElement: null,
    HTMLIFrameElement,
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null },
    querySelectorAll() { return [] },
  }
  document.body = el('body')
  document.body.ownerDocument = document
  document.documentElement = el('html')
  document.documentElement.ownerDocument = document
  document.head = el('head')
  document.documentElement.appendChild(document.body)
  Object.assign(globalThis, { document, HTMLElement, Element, Node, HTMLIFrameElement, navigator: { userAgent: 'node' }, IS_REACT_ACT_ENVIRONMENT: true })
  if (!globalThis.window) Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true })
  return document
}

function Harness({ tick, seen }: { tick: number; seen: TimerSession[] }) {
  const session = useSemanticTimers()
  seen.push(session)
  useEffect(() => () => { session.owner.invalidateAll() }, [session])
  return createElement('span', null, `${session.id}:${tick}`)
}

describe('S12-P1-R2 timer owner harness', () => {
  it('keeps one owner across rerender, Strict Mode remount, and cleanup', async () => {
    const document = installDom()
    const { createRoot } = await import('react-dom/client')
    const seen: TimerSession[] = []
    const root = createRoot(document.body as never)
    await act(async () => { root.render(createElement(StrictMode, null, createElement(Harness, { tick: 0, seen }))) })
    await act(async () => { root.render(createElement(StrictMode, null, createElement(Harness, { tick: 1, seen }))) })
    const owners = new Set(seen.map((session) => session.owner))
    const clocks = new Set(seen.map((session) => session.clock))
    expect(seen.length).toBeGreaterThan(0)
    expect(owners.size).toBe(1)
    expect(clocks.size).toBe(1)
    expect(new Set(seen.map((session) => session.id)).size).toBe(1)
    expect(seen[0]!.owner.activeHandles()).toEqual([])
    await act(async () => { root.unmount() })
    expect(seen[0]!.owner.activeHandles()).toEqual([])
  })
})
