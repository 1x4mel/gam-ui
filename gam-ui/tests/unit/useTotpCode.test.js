import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useTotpCode } from '../../src/composables/useTotpCode.js'

/**
 * `useTotpCode` is exercised directly (no @vue/test-utils mount). This dev
 * sandbox cannot load any vitest DOM environment and cannot run isolated
 * workers (see vitest.config.js), so the composable runs in plain node — Vue's
 * `onUnmounted` simply no-ops (with a warning) outside a setup() context, and we
 * tear the interval down explicitly per test.
 *
 * Real (not fake) timers: `generateTotp` uses `crypto.subtle`, whose libuv
 * threadpool completion is only delivered on a live event-loop spin. We therefore
 * drive the composable with real `setTimeout` waits and assert code format +
 * lifecycle/cache behaviour. Exact wall-clock window rollover (needs a 30s
 * boundary) isn't asserted here; the time-step math itself is covered by
 * totp.test.js (totpWindowInfo), and HMAC correctness by the RFC 6238 vectors.
 */

const SECRET = 'JBSWY3DP' // base32 for "Hello"
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' // RFC 6238 seed

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

describe('useTotpCode', () => {
  let api

  beforeEach(() => {
    // Silence the expected "onUnmounted called outside setup" warning.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    api?.stop()
    api = null
    vi.restoreAllMocks()
  })

  it('is idle until start()', () => {
    const getSecret = vi.fn().mockResolvedValue(SECRET)
    api = useTotpCode(getSecret)
    expect(api.running.value).toBe(false)
    expect(api.code.value).toBe('')
    expect(getSecret).not.toHaveBeenCalled()
  })

  it('generates a 6-digit code on start and exposes the countdown', async () => {
    const getSecret = vi.fn().mockResolvedValue(SECRET)
    api = useTotpCode(getSecret)

    api.start()
    await wait(50) // let the async reveal + generateTotp settle

    expect(api.code.value).toMatch(/^\d{6}$/)
    expect(api.running.value).toBe(true)
    expect(api.loading.value).toBe(false)
    expect(api.secondsLeft.value).toBeGreaterThan(0)
    expect(api.secondsLeft.value).toBeLessThanOrEqual(30)
    expect(api.progress.value).toBeGreaterThan(0)
    expect(getSecret).toHaveBeenCalledTimes(1)
  })

  it('keeps a single audited reveal while ticking within a window', async () => {
    const getSecret = vi.fn().mockResolvedValue(SECRET)
    api = useTotpCode(getSecret)
    api.start()
    await wait(50)
    const code = api.code.value
    expect(code).toMatch(/^\d{6}$/)

    await wait(2000) // a couple of 1s ticks, very likely the same window
    expect(api.running.value).toBe(true)
    // still only one reveal; code stays valid within the window
    expect(getSecret).toHaveBeenCalledTimes(1)
    expect(api.code.value).toMatch(/^\d{6}$/)
  })

  it('stop() halts the countdown but keeps the last code', async () => {
    const getSecret = vi.fn().mockResolvedValue(SECRET)
    api = useTotpCode(getSecret)
    api.start()
    await wait(50)
    const code = api.code.value
    expect(code).toMatch(/^\d{6}$/)

    api.stop()
    expect(api.running.value).toBe(false)

    await wait(1200)
    expect(api.code.value).toBe(code) // frozen after stop
  })

  it('reset() clears code + secret cache, forcing a fresh reveal', async () => {
    const getSecret = vi.fn().mockResolvedValue(SECRET)
    api = useTotpCode(getSecret)
    api.start()
    await wait(50)
    expect(api.code.value).toMatch(/^\d{6}$/)
    expect(getSecret).toHaveBeenCalledTimes(1)

    api.reset()
    expect(api.code.value).toBe('')
    expect(api.running.value).toBe(false)

    api.start()
    await wait(50)
    expect(api.code.value).toMatch(/^\d{6}$/)
    expect(getSecret).toHaveBeenCalledTimes(2) // re-fetched after reset
  })

  it('surfaces reveal errors', async () => {
    const getSecret = vi.fn().mockRejectedValue(new Error('reveal denied'))
    api = useTotpCode(getSecret)
    api.start()
    await wait(50)

    expect(api.code.value).toBe('')
    expect(api.error.value).toBe('reveal denied')
    expect(api.running.value).toBe(true) // interval keeps ticking to retry
    expect(getSecret).toHaveBeenCalled()
  })

  it('honours a custom period/digits option', async () => {
    const getSecret = vi.fn().mockResolvedValue(RFC_SECRET)
    api = useTotpCode(getSecret, { period: 30, digits: 8 })
    api.start()
    await wait(50)
    expect(api.code.value).toMatch(/^\d{8}$/)
  })
})
