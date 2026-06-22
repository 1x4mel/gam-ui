import { ref, computed } from 'vue'
import { useActiveUsage } from './useActiveUsage.js'

/**
 * useOnlineWatcher — live elapsed-time tracking for the session user's active
 * leases, to power the "online too long" warning (governance).
 *
 * - `now` ticks every 30s (cheap; durations are in hours).
 * - `myLeaseDurations` recomputes elapsed hours per lease reactively.
 * - `overSoftCap`  → any lease ≥ max_online_hours  (warn popup, bypassable)
 * - `overHardCap`  → any lease ≥ hard_cap_online_hours (critical; server also
 *   auto-releases via _auto_release_expired, this is the client-side alert).
 *
 * Note: started_at comes from the server as a naive "YYYY-MM-DD HH:MM:SS" string
 * (Frappe now_datetime, site timezone). We parse it as UTC. The site is UTC so
 * this is accurate; the server sweep is authoritative regardless.
 */
const TICK_MS = 30000

function parseStartedToEpochMs(s) {
  if (!s) return null
  const iso = typeof s === 'string' ? s.replace(' ', 'T').replace(/([+-]\d{2}:?\d{2}|Z)$/, '$1') : s
  const candidate = typeof iso === 'string' ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z') : new Date(s)
  const t = candidate.getTime()
  return isNaN(t) ? null : t
}

export function useOnlineWatcher() {
  const { myActive, allActive, settings } = useActiveUsage()
  const now = ref(Date.now())
  let timer = null

  function start() {
    stop()
    timer = setInterval(() => {
      now.value = Date.now()
    }, TICK_MS)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  const maxHours = computed(() => Number(settings.value.max_online_hours) || 8)
  const hardCap = computed(() => Number(settings.value.hard_cap_online_hours) || 12)

  // Prefer the absolute server epoch (timezone-independent) over parsing the
  // naive datetime string, when the backend provides it.
  function startedEpochMs(l) {
    const epoch = Number(l && l.started_at_epoch)
    if (epoch && !isNaN(epoch)) return epoch * 1000
    return parseStartedToEpochMs(l && l.started_at)
  }

  function leaseDurations(list) {
    return (list || []).map((l) => {
      const started = startedEpochMs(l)
      const ms = started ? Math.max(0, now.value - started) : 0
      return {
        account: l.account,
        used_by: l.used_by,
        username: l.username,
        platform: l.platform,
        started_at: l.started_at,
        purpose: l.purpose,
        elapsedMs: ms,
        elapsedHours: ms / 3600000,
      }
    })
  }

  const myLeaseDurations = computed(() => leaseDurations(myActive.value))
  const allLeaseDurations = computed(() => leaseDurations(allActive.value))

  const longestHours = computed(() =>
    myLeaseDurations.value.reduce((m, l) => Math.max(m, l.elapsedHours), 0),
  )

  const overSoftCap = computed(() =>
    myLeaseDurations.value.some((l) => l.elapsedHours >= maxHours.value),
  )

  const overHardCap = computed(() =>
    myLeaseDurations.value.some((l) => l.elapsedHours >= hardCap.value),
  )

  // "Any" family — across ALL active leases (incl. other users). Drives the
  // sidebar "Đang hoạt động" tab warning when anyone's session is over time.
  const overAny = computed(() =>
    allLeaseDurations.value.filter((l) => l.elapsedHours >= maxHours.value || l.elapsedHours >= hardCap.value),
  )
  const overAnyCount = computed(() => overAny.value.length)
  const overSoftCapAny = computed(() => overAny.value.length > 0)

  /** The single longest-running lease (for the warning popup headline). */
  const longestLease = computed(() => {
    let best = null
    for (const l of myLeaseDurations.value) {
      if (!best || l.elapsedHours > best.elapsedHours) best = l
    }
    return best
  })

  return {
    now,
    maxHours,
    hardCap,
    myLeaseDurations,
    allLeaseDurations,
    longestHours,
    longestLease,
    overSoftCap,
    overHardCap,
    overAny,
    overAnyCount,
    overSoftCapAny,
    start,
    stop,
  }
}
