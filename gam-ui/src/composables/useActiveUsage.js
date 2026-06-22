import { ref, computed } from 'vue'
import { frappeCall } from '../api/index.js'

/**
 * useActiveUsage — shared (singleton) state for "Đang hoạt động" (active leases).
 *
 * Backend:
 *  - gam.api.get_my_active_usage()  → leases held by the session user (IN_USE)
 *  - gam.api.get_active_usage()     → ALL active leases (any GAM user)
 *  - gam.api.get_gam_settings()     → thresholds {max_online_hours, min_rested_hours,
 *                                      hard_cap_online_hours, block_logout_with_active_lease}
 *
 * Realtime: backend emits `gam_account_changed` {account, action, user} on
 * checkin / checkout / note. We debounce-refresh so every client sees lock
 * changes within ~0.4s without hammering the server.
 *
 * State lives at module scope so the sidebar badge, the Active view, and the
 * per-account lock indicators all share one source of truth. Exactly one
 * component (the always-mounted AppLayout) should call bindRealtime().
 */
const myActive = ref([])
const allActive = ref([])
// Accounts đang "nghỉ" (cooling) sau checkout, chưa đủ min_rested_hours.
// Drives: section "Đang nghỉ" + bộ đếm countdown realtime.
const resting = ref([])
const settings = ref({
  max_online_hours: 8,
  min_rested_hours: 8,
  hard_cap_online_hours: 12,
  block_logout_with_active_lease: 1,
})
// DB-server clock at the moment of the last successful refresh (epoch ms).
// The realtime elapsed timer adds this as a clock offset so it is immune to
// browser-vs-server clock skew (the root cause of the old "0s" bug).
const serverTimeMs = ref(null)
const lastUpdated = ref(null)
const loading = ref(false)

let boundHandler = null // stored ref so off() can remove the exact listener
let debounceTimer = null
let refreshInFlight = null

// Normalise the (now wrapped) {server_epoch_now_ms, leases} shape while keeping
// back-compat with older backends that returned a bare array.
function unwrap(payload) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'leases' in payload) {
    return { leases: payload.leases || [], serverMs: Number(payload.server_epoch_now_ms) || null }
  }
  return { leases: Array.isArray(payload) ? payload : [], serverMs: null }
}

async function refresh() {
  // Collapse concurrent refreshes (realtime burst + manual) into one round-trip.
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    loading.value = true
    try {
      const [mine, all, s, rest] = await Promise.all([
        frappeCall('gam.api.get_my_active_usage').catch(() => []),
        frappeCall('gam.api.get_active_usage').catch(() => []),
        frappeCall('gam.api.get_gam_settings').catch(() => null),
        frappeCall('gam.api.get_resting_usage').catch(() => null),
      ])
      const mineU = unwrap(mine)
      const allU = unwrap(all)
      myActive.value = mineU.leases
      allActive.value = allU.leases
      resting.value = (rest && Array.isArray(rest.resting)) ? rest.resting : []
      // Prefer the "all" server clock (authoritative). Either will do; fall back
      // to the resting endpoint's clock.
      serverTimeMs.value =
        allU.serverMs || mineU.serverMs || (rest && Number(rest.server_epoch_now_ms)) || null
      if (s && typeof s === 'object') settings.value = { ...settings.value, ...s }
      lastUpdated.value = new Date()
    } finally {
      loading.value = false
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

function scheduleRefresh() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { refresh() }, 350)
}

/** Subscribe to `gam_account_changed`. Idempotent — safe to call once at boot. */
function bindRealtime(realtime) {
  if (!realtime || boundHandler) return
  boundHandler = () => scheduleRefresh()
  realtime.on('gam_account_changed', boundHandler)
}

/** Unsubscribe (only needed if the boot component is torn down). */
function unbindRealtime(realtime) {
  if (!realtime || !boundHandler) return
  realtime.off('gam_account_changed', boundHandler)
  boundHandler = null
}

export function useActiveUsage() {
  const myCount = computed(() => myActive.value.length)
  const adminCount = computed(() => allActive.value.length)

  /** Find the active lease (if any) for a given account name. */
  function leaseFor(account) {
    if (!account) return null
    return allActive.value.find((u) => u.account === account) || null
  }

  /** Find the resting (cooling) row (if any) for a given account name. */
  function restingFor(account) {
    if (!account) return null
    return resting.value.find((u) => u.account === account) || null
  }

  /** True if `account` is currently checked in by the session user `me`. */
  function isMine(account, me) {
    const l = leaseFor(account)
    return !!(l && me && l.used_by === me)
  }

  /** True if `account` is checked in by SOMEONE OTHER than `me` (→ lock/dim). */
  function isLockedByOther(account, me) {
    const l = leaseFor(account)
    return !!(l && l.used_by && me && l.used_by !== me)
  }

  return {
    myActive,
    allActive,
    resting,
    settings,
    serverTimeMs,
    lastUpdated,
    loading,
    myCount,
    adminCount,
    refresh,
    bindRealtime,
    unbindRealtime,
    leaseFor,
    restingFor,
    isMine,
    isLockedByOther,
  }
}
