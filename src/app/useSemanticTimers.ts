import { useState } from 'react'
import { nextTimerToken, timerFireAllowed, type SemanticTimerName, type SemanticTimerToken } from '../adventure/semanticTimers'

export interface LiveTimerToken extends SemanticTimerToken {
  epoch: number
}

export type TimerHandleKind = 'TIMEOUT' | 'INTERVAL' | 'ANIMATION_FRAME'

export interface TimerClock {
  setInterval(fn: () => void, ms: number): number
  clearInterval(id: number): void
  setTimeout(fn: () => void, ms: number): number
  clearTimeout(id: number): void
  requestAnimationFrame(fn: () => void): number
  cancelAnimationFrame(id: number): void
}

export interface ActiveTimerHandle {
  kind: TimerHandleKind
  id: number
}

export function browserTimerClock(): TimerClock {
  return {
    setInterval: (fn, ms) => window.setInterval(fn, ms),
    clearInterval: (id) => window.clearInterval(id),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id),
    requestAnimationFrame: (fn) => window.requestAnimationFrame(fn),
    cancelAnimationFrame: (id) => window.cancelAnimationFrame(id),
  }
}

export function createLiveTimerOwner(clock: TimerClock) {
  let epoch = 1
  const current = new Map<string, LiveTimerToken>()
  const handles = new Map<string, ActiveTimerHandle>()
  const key = (kind: TimerHandleKind, id: number) => `${kind}:${id}`
  function arm(name: SemanticTimerName, eventId: string): LiveTimerToken {
    const token: LiveTimerToken = { ...nextTimerToken(current.get(name) ?? null, name, eventId), epoch }
    current.set(name, token)
    return token
  }
  function allow(token: LiveTimerToken): boolean {
    return token.epoch === epoch && timerFireAllowed(current.get(token.name) ?? null, token)
  }
  function retire(token: LiveTimerToken) {
    const live = current.get(token.name)
    if (live && live.epoch === token.epoch && live.generation === token.generation && live.eventId === token.eventId) {
      current.set(token.name, { ...live, eventId: `retired:${live.generation}` })
    }
  }
  function track(kind: TimerHandleKind, id: number) {
    handles.set(key(kind, id), { kind, id })
    return id
  }
  function release(kind: TimerHandleKind, id: number) {
    handles.delete(key(kind, id))
  }
  function cancel(handle: ActiveTimerHandle) {
    if (handle.kind === 'TIMEOUT') clock.clearTimeout(handle.id)
    else if (handle.kind === 'INTERVAL') clock.clearInterval(handle.id)
    else clock.cancelAnimationFrame(handle.id)
  }
  function invalidateAll() {
    epoch += 1
    current.clear()
    for (const handle of handles.values()) cancel(handle)
    handles.clear()
  }
  return { arm, allow, retire, track, release, invalidateAll, epoch: () => epoch, activeHandles: () => [...handles.values()] }
}

export type LiveTimerOwner = ReturnType<typeof createLiveTimerOwner>

export interface TimerSession {
  id: number
  clock: TimerClock
  owner: LiveTimerOwner
}

let retained: TimerSession | null = null
let nextSessionId = 1

/** One owner for this page lifetime, including a Strict Mode remount. */
export function retainTimerSession(): TimerSession {
  if (!retained) {
    const clock = browserTimerClock()
    retained = { id: nextSessionId++, clock, owner: createLiveTimerOwner(clock) }
  }
  return retained
}

export function useSemanticTimers() {
  const [session] = useState(retainTimerSession)
  return session
}
