import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  elapsedTier,
  tierTextClass,
  tierDotClass,
  tierBorderClass,
  formatDuration,
  startedMsOf,
  useElapsedTimer,
} from '../../src/composables/useElapsedTimer.js'

/**
 * Unit tests for the "Đang hoạt động" realtime timer.
 *
 * elapsedTier / formatDuration / startedMsOf are pure functions → deterministic.
 * useElapsedTimer is exercised directly (no DOM mount, per vitest.config.js);
 * intervals are torn down explicitly via stop() in afterEach.
 *
 * These tests pin down the regression that motivated the rewrite: the elapsed
 * value must never go negative (the old "0s" bug) and must stay aligned to the
 * DB-server clock even when the browser clock lags behind.
 */

const HOUR = 3600000
const SETTINGS = { max_online_hours: 8, hard_cap_online_hours: 12 }

describe('elapsedTier', () => {
  it('classifies the safe band (0–70%)', () => {
    expect(elapsedTier(0, SETTINGS).tier).toBe('safe')
    expect(elapsedTier(1 * HOUR, SETTINGS).tier).toBe('safe') // 12.5%
    expect(elapsedTier(5 * HOUR, SETTINGS).tier).toBe('safe') // 62.5%
  })

  it('classifies the soon band (70–90%)', () => {
    expect(elapsedTier(5.6 * HOUR, SETTINGS).tier).toBe('soon') // 70%
    expect(elapsedTier(7 * HOUR, SETTINGS).tier).toBe('soon') // 87.5%
  })

  it('classifies the near band (90–100%)', () => {
    expect(elapsedTier(7.3 * HOUR, SETTINGS).tier).toBe('near') // ~91%
    expect(elapsedTier(7.9 * HOUR, SETTINGS).tier).toBe('near') // ~99%
  })

  it('classifies over once the soft cap is reached', () => {
    expect(elapsedTier(8 * HOUR, SETTINGS).tier).toBe('over') // 100%
    expect(elapsedTier(10 * HOUR, SETTINGS).tier).toBe('over') // between soft & hard
  })

  it('classifies critical once the hard cap is reached', () => {
    expect(elapsedTier(12 * HOUR, SETTINGS).tier).toBe('critical')
    expect(elapsedTier(20 * HOUR, SETTINGS).tier).toBe('critical')
  })

  it('caps percent at 100 and computes remaining down to zero', () => {
    const over = elapsedTier(10 * HOUR, SETTINGS)
    expect(over.percent).toBe(100)
    expect(over.remainingMs).toBe(0)
    const live = elapsedTier(4 * HOUR, SETTINGS)
    expect(live.percent).toBe(50)
    expect(live.remainingMs).toBe(4 * HOUR)
  })

  it('carries a label + emoji so colour is not the only signal (a11y)', () => {
    for (const key of ['safe', 'soon', 'near', 'over', 'critical']) {
      const ms =
        key === 'safe' ? 0 :
        key === 'soon' ? 6 * HOUR :
        key === 'near' ? 7.5 * HOUR :
        key === 'over' ? 9 * HOUR : 13 * HOUR
      const r = elapsedTier(ms, SETTINGS)
      expect(r.tier).toBe(key)
      expect(typeof r.label).toBe('string')
      expect(r.label.length).toBeGreaterThan(0)
      expect(r.emoji).toBeTruthy()
    }
  })

  it('never returns a negative remaining for negative elapsed (clamped)', () => {
    const r = elapsedTier(-5000, SETTINGS)
    expect(r.percent).toBe(0)
    expect(r.remainingMs).toBe(8 * HOUR)
  })

  it('respects custom cap settings', () => {
    const small = { max_online_hours: 1, hard_cap_online_hours: 2 }
    expect(elapsedTier(0.5 * HOUR, small).tier).toBe('safe') // 50%
    expect(elapsedTier(1 * HOUR, small).tier).toBe('over') // 100% soft
    expect(elapsedTier(2 * HOUR, small).tier).toBe('critical') // hard
  })
})

describe('tier class helpers', () => {
  it('map each tier to a text/dot/border class', () => {
    expect(tierTextClass('over')).toBe('text-tier-over')
    expect(tierDotClass('soon')).toBe('bg-tier-soon')
    expect(tierBorderClass('critical')).toContain('gam-over-warning')
    expect(tierBorderClass('critical')).toContain('gam-critical-warning')
    expect(tierBorderClass('unknown')).toBe('border-app-border')
  })
})

describe('formatDuration', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(5 * 1000)).toBe('5s')
    expect(formatDuration(125 * 1000)).toBe('2m 5s')
    expect(formatDuration(3725 * 1000)).toBe('1h 2m 5s')
  })

  it('clamps negatives to zero', () => {
    expect(formatDuration(-9999)).toBe('0s')
  })
})

describe('startedMsOf', () => {
  it('treats small numbers as epoch seconds, large as epoch ms', () => {
    expect(startedMsOf({ started_at_epoch: 1719050400 })).toBe(1719050400000)
    expect(startedMsOf({ started_at_epoch: 1719050400000 })).toBe(1719050400000)
  })

  it('parses a naive Frappe datetime as +07:00', () => {
    const ms = startedMsOf({ started_at: '2026-06-22 09:00:00' })
    expect(ms).toBe(new Date('2026-06-22T09:00:00+07:00').getTime())
  })

  it('returns null for empty input', () => {
    expect(startedMsOf(null)).toBeNull()
    expect(startedMsOf({})).toBeNull()
  })
})

describe('useElapsedTimer', () => {
  let timer

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    timer?.stop()
    timer = null
    vi.restoreAllMocks()
  })

  it('syncClock offsets the server clock so skew is absorbed', () => {
    timer = useElapsedTimer()
    const clientNow = Date.now()
    // Server clock is 5 minutes AHEAD of the client (the skew that caused "0s").
    const serverAhead = clientNow + 5 * 60000
    timer.syncClock(serverAhead)
    // serverNow should now be ~ serverAhead (within the same ms tick).
    expect(timer.serverNow.value).toBeGreaterThanOrEqual(serverAhead - 1500)
    expect(timer.serverNow.value).toBeLessThanOrEqual(serverAhead + 1500)
  })

  it('never reports a negative elapsed when started is in the future vs client', () => {
    timer = useElapsedTimer()
    // Server "now" matches the lease start source clock; lease started 30s ago
    // on the SERVER clock. With the offset applied, elapsed ≈ 30s, never 0.
    const serverStart = Date.now() - 30000
    timer.syncClock(serverStart + 30000) // server clock == lease clock source
    const lease = { started_at_epoch: Math.floor(serverStart / 1000) }
    const e = timer.elapsedFor(lease)
    expect(e).toBeGreaterThanOrEqual(28000) // ~30s, not 0
    expect(e).toBeLessThanOrEqual(45000)
  })

  it('falls back to the browser clock when no server time is synced', () => {
    timer = useElapsedTimer()
    const started = Date.now() - 10000
    const e = timer.elapsedFor({ started_at_epoch: Math.floor(started / 1000) })
    expect(e).toBeGreaterThanOrEqual(9000)
    expect(e).toBeLessThanOrEqual(15000)
  })

  it('start/stop controls the 1s tick', async () => {
    vi.useFakeTimers()
    timer = useElapsedTimer()
    const before = timer.now.value
    timer.start()
    vi.advanceTimersByTime(1000)
    expect(timer.now.value).toBeGreaterThan(before)
    timer.stop()
    const after = timer.now.value
    vi.advanceTimersByTime(5000)
    expect(timer.now.value).toBe(after) // stopped → no further change
    vi.useRealTimers()
  })
})
