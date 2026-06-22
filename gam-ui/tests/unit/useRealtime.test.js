import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { effectScope } from 'vue'

// useRealtime keeps module-level state (socket singleton + refcount maps), so
// each test takes a fresh module instance via vi.resetModules() + dynamic import.
const mockState = vi.hoisted(() => ({ fake: null }))

vi.mock('socket.io-client', () => ({
  // io() returns whatever fake socket the current test installed.
  io: () => (mockState.fake ? mockState.fake.socket : null),
}))

/** Minimal socket.io stand-in: records emit() calls and lets tests dispatch events. */
function makeFakeSocket() {
  const handlers = new Map()
  const emits = []
  const socket = {
    on(event, cb) {
      if (!handlers.has(event)) handlers.set(event, new Set())
      handlers.get(event).add(cb)
      return socket
    },
    off(event, cb) {
      const set = handlers.get(event)
      if (set && cb) set.delete(cb)
      return socket
    },
    emit(event, ...args) {
      emits.push({ event, args })
      return socket
    },
  }
  return {
    socket,
    emits,
    dispatch(event, payload) {
      const set = handlers.get(event)
      if (set) [...set].forEach((cb) => cb(payload))
    },
  }
}

const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms))

describe('useRealtime refcount (P1.4)', () => {
  let originalWindow

  beforeEach(() => {
    vi.resetModules()
    mockState.fake = makeFakeSocket()
    originalWindow = global.window
    // getSocketUrl() reads window.location — stub it for the node env.
    global.window = { location: { port: '', protocol: 'http:', hostname: 'localhost' } }
  })

  afterEach(() => {
    if (originalWindow === undefined) delete global.window
    else global.window = originalWindow
    mockState.fake = null
  })

  it('unmounting one subscriber keeps the other receiving list_update', async () => {
    const { useRealtime } = await import('../../src/composables/useRealtime.js')
    const scope1 = effectScope()
    const scope2 = effectScope()
    let hits1 = 0
    let hits2 = 0

    const rt1 = scope1.run(() => useRealtime())
    const rt2 = scope2.run(() => useRealtime())

    rt1.subscribe('GAM Account', () => { hits1++ })
    rt2.subscribe('GAM Account', () => { hits2++ })

    // Server-side subscribe is emitted exactly once (refcounted), not per consumer.
    const subs = mockState.fake.emits.filter((e) => e.event === 'doctype_subscribe')
    expect(subs.length).toBe(1)

    mockState.fake.dispatch('list_update', { doctype: 'GAM Account' })
    await wait()
    expect(hits1).toBe(1)
    expect(hits2).toBe(1)

    // "Unmount" the first consumer — must NOT take the other's handler with it.
    scope1.stop()
    await wait()

    mockState.fake.dispatch('list_update', { doctype: 'GAM Account' })
    await wait()
    expect(hits1).toBe(1) // rt1 disposed → no further hits
    expect(hits2).toBe(2) // rt2 still receives updates

    // Server unsubscribe must NOT fire while a consumer remains.
    const unsubsAfterOne = mockState.fake.emits.filter((e) => e.event === 'doctype_unsubscribe')
    expect(unsubsAfterOne.length).toBe(0)

    // Unmount the last consumer → server unsubscribe finally fires (refcount 0).
    scope2.stop()
    await wait()
    const unsubsAfterAll = mockState.fake.emits.filter((e) => e.event === 'doctype_unsubscribe')
    expect(unsubsAfterAll.length).toBe(1)
  })

  it('subscribe() returns a disposer that removes only its own handler', async () => {
    const { useRealtime } = await import('../../src/composables/useRealtime.js')
    const scope = effectScope()
    let hits = 0

    const rt = scope.run(() => useRealtime())
    const dispose = rt.subscribe('GAM Email', () => { hits++ })

    mockState.fake.dispatch('list_update', { doctype: 'GAM Email' })
    await wait()
    expect(hits).toBe(1)

    dispose()
    await wait()

    mockState.fake.dispatch('list_update', { doctype: 'GAM Email' })
    await wait()
    expect(hits).toBe(1) // disposed → no more hits

    // refcount hit zero → server unsubscribe emitted exactly once
    const unsubs = mockState.fake.emits.filter((e) => e.event === 'doctype_unsubscribe')
    expect(unsubs.length).toBe(1)

    scope.stop()
  })
})
