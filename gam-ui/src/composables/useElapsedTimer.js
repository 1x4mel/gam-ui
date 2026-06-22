import { ref, computed } from 'vue'

/**
 * useElapsedTimer — realtime elapsed-clock composable for "Đang hoạt động".
 *
 * Solves the old "0s/8h" bug, whose root cause was clock skew: the elapsed
 * time was computed from the DB-server clock (`started_at_epoch`) but ticked
 * against the browser clock (`Date.now()`). When the DB ran ahead of the
 * client, `now - started < 0` was clamped to 0 and the timer froze on "0s".
 *
 * Here we keep the DB clock as the single source of truth. On every refresh
 * we record `serverTimeMs` (epoch ms from `UNIX_TIMESTAMP(NOW(6))`) and derive
 * a stable offset: `serverNow = clientNow + (serverTimeMs - clientAtRefresh)`.
 * The 1s interval only bumps the client clock; the offset keeps the displayed
 * value aligned with the server's auto-release sweep.
 *
 * If no server time is available (older backend), it falls back to the browser
 * clock — same behaviour as before, but never worse.
 */

const HOUR_MS = 3600000

/**
 * Tier definition for the 4-stage colour ladder. `key` doubles as the design
 * token suffix (`text-tier-<key>`, `bg-tier-<key>/15`, …). Colours are not the
 * only signal: every tier carries an emoji + a Vietnamese label so the state
 * is legible without colour (accessibility — not colour-dependent).
 */
const TIERS = {
  safe: { emoji: '🟢', label: 'An toàn', dotAnim: 'animate-pulse-slow' },
  soon: { emoji: '🟡', label: 'Sắp hết', dotAnim: 'animate-pulse' },
  near: { emoji: '🟠', label: 'Gần giới hạn', dotAnim: 'animate-pulse' },
  over: { emoji: '🔴', label: 'Quá giờ', dotAnim: 'gam-blink' },
  critical: { emoji: '🟣', label: 'Quá hard cap', dotAnim: 'gam-blink' },
}

/**
 * Tier ladder cho bộ đếm OFFLINE (cooling/rested). Đối xứng `elapsedTier` nhưng
 * *lùi ngược nghĩa*: % càng cao = càng gần "sẵn sàng" (tốt). Thay vì cảnh báo
 * quá giờ, đây là progress phục hồi để tài khoản an toàn dùng lại.
 *
 * `cooling` → mới nghỉ · `warming` → đang phục hồi · `almost` → gần sẵn sàng ·
 * `ready` → đủ `min_rested_hours` → "Sẵn sàng & an toàn".
 */
const REST_TIERS = {
  cooling: { emoji: '🔵', label: 'Đang nghỉ', dotAnim: 'animate-pulse-slow' },
  warming: { emoji: '🩵', label: 'Đang phục hồi', dotAnim: 'animate-pulse' },
  almost: { emoji: '🟦', label: 'Gần sẵn sàng', dotAnim: 'animate-pulse' },
  ready: { emoji: '🟢', label: 'Sẵn sàng', dotAnim: '' },
}

/**
 * Classify elapsed time into a colour tier based on the configured soft/hard
 * caps. Pure function — safe to unit-test and to reuse outside the composable
 * (e.g. sidebar badge, account-list lock indicator).
 *
 * @param {number} elapsedMs   elapsed milliseconds (>= 0)
 * @param {object} settings    { max_online_hours, hard_cap_online_hours }
 * @returns {{tier, percent, remainingMs, softMs, hardMs, emoji, label, dotAnim}}
 */
export function elapsedTier(elapsedMs, settings = {}) {
  const softMs = (Number(settings.max_online_hours) || 8) * HOUR_MS
  const hardMs = (Number(settings.hard_cap_online_hours) || 12) * HOUR_MS
  const e = Math.max(0, Number(elapsedMs) || 0)
  const percent = softMs > 0 ? Math.min(100, (e / softMs) * 100) : 0
  const remainingMs = Math.max(0, softMs - e)

  let key
  if (hardMs > 0 && e >= hardMs) key = 'critical'
  else if (percent >= 100) key = 'over'
  else if (percent >= 90) key = 'near'
  else if (percent >= 70) key = 'soon'
  else key = 'safe'

  return {
    tier: key,
    percent: Math.round(percent),
    remainingMs,
    softMs,
    hardMs,
    emoji: TIERS[key].emoji,
    label: TIERS[key].label,
    dotAnim: TIERS[key].dotAnim,
  }
}

/** Map a tier key to the text colour utility class. */
export function tierTextClass(tier) {
  return {
    safe: 'text-tier-safe',
    soon: 'text-tier-soon',
    near: 'text-tier-near',
    over: 'text-tier-over',
    critical: 'text-tier-critical',
  }[tier] || 'text-app-text-muted'
}

/** Map a tier key to the dot/background colour utility class. */
export function tierDotClass(tier) {
  return {
    safe: 'bg-tier-safe',
    soon: 'bg-tier-soon',
    near: 'bg-tier-near',
    over: 'bg-tier-over',
    critical: 'bg-tier-critical',
  }[tier] || 'bg-app-text-muted'
}

/** Map a tier key to a Tailwind border/ring accent class for card chrome. */
export function tierBorderClass(tier) {
  return {
    safe: 'border-app-border',
    soon: 'border-tier-soon/40',
    near: 'border-tier-near/50',
    over: 'gam-over-warning',
    critical: 'gam-over-warning gam-critical-warning',
  }[tier] || 'border-app-border'
}

/**
 * Classify rested (offline) time into a colour tier based on `min_rested_hours`.
 * Pure function — đối xứng `elapsedTier` cho bộ đếm offline. % = rested/min,
 * càng cao càng tốt (gần sẵn sàng dùng lại).
 *
 * @param {number} restedMs   thời gian đã nghỉ (ms, >= 0)
 * @param {object} settings   { min_rested_hours }
 * @returns {{tier, percent, remainingMs, minMs, emoji, label, dotAnim, ready}}
 */
export function restedTier(restedMs, settings = {}) {
  const minMs = (Number(settings.min_rested_hours) || 8) * HOUR_MS
  const r = Math.max(0, Number(restedMs) || 0)
  const percent = minMs > 0 ? Math.min(100, (r / minMs) * 100) : 100
  const remainingMs = Math.max(0, minMs - r)

  let key
  if (percent >= 100) key = 'ready'
  else if (percent >= 90) key = 'almost'
  else if (percent >= 70) key = 'warming'
  else key = 'cooling'

  return {
    tier: key,
    percent: Math.round(percent),
    remainingMs,
    minMs,
    ready: percent >= 100,
    emoji: REST_TIERS[key].emoji,
    label: REST_TIERS[key].label,
    dotAnim: REST_TIERS[key].dotAnim,
  }
}

/** Map a resting tier key to the text colour utility class. */
export function restedTextClass(tier) {
  return {
    cooling: 'text-tier-cool',
    warming: 'text-tier-warm',
    almost: 'text-tier-almost',
    ready: 'text-tier-safe',
  }[tier] || 'text-app-text-muted'
}

/** Map a resting tier key to the dot/background colour utility class. */
export function restedDotClass(tier) {
  return {
    cooling: 'bg-tier-cool',
    warming: 'bg-tier-warm',
    almost: 'bg-tier-almost',
    ready: 'bg-tier-safe',
  }[tier] || 'bg-app-text-muted'
}

/** Map a resting tier key to a border/ring accent class for card chrome. */
export function restedBorderClass(tier) {
  return {
    cooling: 'border-tier-cool/40',
    warming: 'border-tier-warm/50',
    almost: 'border-tier-almost/50',
    ready: 'border-tier-safe/60',
  }[tier] || 'border-app-border'
}

/**
 * Epoch ms for a resting row's `ended_at` (điểm bắt đầu nghỉ). Accepts epoch
 * seconds (`ended_at_epoch`), epoch ms, hoặc naive Frappe datetime string.
 * Đối xứng `startedMsOf`.
 */
export function endedMsOf(r) {
  if (!r) return null
  const epoch = Number(r.ended_at_epoch)
  if (epoch && !isNaN(epoch)) {
    return epoch < 1e12 ? epoch * 1000 : epoch
  }
  if (!r.ended_at) return null
  let str = String(r.ended_at)
  if (str.includes(' ') && !str.includes('Z') && !str.includes('+')) {
    str = str.replace(' ', 'T')
  }
  if (!/([Zz]|[+-]\d{2}:?\d{2})$/.test(str)) str += '+07:00'
  const t = new Date(str).getTime()
  return isNaN(t) ? null : t
}

/**
 * Human label for an elapsed duration. Shows seconds for a realtime feel.
 *   125s → "2m 5s", 3725s → "1h 2m 5s"
 */
export function formatDuration(ms) {
  const totalSec = Math.max(0, Math.floor((Number(ms) || 0) / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/**
 * Normalise a lease's start timestamp to epoch *milliseconds*.
 * Accepts epoch seconds (`started_at_epoch`), epoch ms, or a naive Frappe
 * datetime string (interpreted as the +07:00 server zone, like toEpochMs).
 */
export function startedMsOf(l) {
  if (!l) return null
  const epoch = Number(l.started_at_epoch)
  if (epoch && !isNaN(epoch)) {
    // epoch seconds (UNIX_TIMESTAMP) → ms. Values > 1e12 are already ms.
    return epoch < 1e12 ? epoch * 1000 : epoch
  }
  if (!l.started_at) return null
  let str = String(l.started_at)
  if (str.includes(' ') && !str.includes('Z') && !str.includes('+')) {
    str = str.replace(' ', 'T')
  }
  if (!/([Zz]|[+-]\d{2}:?\d{2})$/.test(str)) str += '+07:00'
  const t = new Date(str).getTime()
  return isNaN(t) ? null : t
}

/**
 * Stateful timer. One instance drives the whole "Đang hoạt động" view; the
 * parent passes the computed `serverNow` down as the `now` prop so existing
 * prop-driven children keep working.
 */
export function useElapsedTimer() {
  const now = ref(Date.now())
  const serverOffsetMs = ref(0) // serverClock − clientClock (ms)

  /** Server clock at the moment of the last refresh, in epoch ms. */
  const serverTimeMs = ref(null)

  const serverNow = computed(() => now.value + serverOffsetMs.value)

  let timer = null

  /** Re-anchor the offset using a fresh DB-server epoch ms sample. */
  function syncClock(serverMs) {
    if (!Number.isFinite(serverMs)) return
    serverTimeMs.value = serverMs
    serverOffsetMs.value = serverMs - Date.now()
  }

  /** Start the 1s client tick. Idempotent. */
  function start() {
    if (timer) return
    timer = setInterval(() => { now.value = Date.now() }, 1000)
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null }
  }

  /** Elapsed ms for a lease (by its `started_at_epoch`/`started_at`). */
  function elapsedFor(l) {
    const started = startedMsOf(l)
    if (started == null) return 0
    return Math.max(0, serverNow.value - started)
  }

  return { now, serverNow, serverTimeMs, serverOffsetMs, syncClock, start, stop, elapsedFor }
}
