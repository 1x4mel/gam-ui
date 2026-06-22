import { ref, computed } from 'vue'
import { getGamSession } from '../api/index.js'
import { useAccessGrants } from './useAccessGrants.js'

/**
 * GAM auth composable.
 *
 * Boot uses the consolidated `getGamSession()` endpoint (B4) — ONE round-trip
 * returns user + full_name + ALL roles + GAM role flags (falls back to the
 * legacy 2-call path if the endpoint is absent on older backends).
 *
 * `roles` holds ALL roles returned by the backend (app-agnostic). The co-tenant
 * site `erp.local` may also include trader-ui / erpnext roles — we only surface
 * GAM-specific computeds here and let the router guard on `GAM Admin` / `GAM Member`.
 */
const GAM_ADMIN = 'GAM Admin'
const GAM_MEMBER = 'GAM Member'

// Shared state across all components
const user = ref('')
const fullName = ref('')
const roles = ref([])
const lastFetched = ref(0)
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// In-flight boot promise — dedups concurrent fetchUser() callers (e.g. the
// router guard + App.vue mounting at once) so getGamSession fires only once.
let inflight = null

export function useAuth() {
  const isLoggedIn = computed(() => user.value && user.value !== 'Guest')

  const isGamAdmin = computed(() => roles.value.includes(GAM_ADMIN))
  const isGamMember = computed(() => roles.value.includes(GAM_MEMBER))
  /** Any valid GAM role (Admin or Member). */
  const isGamUser = computed(() => isGamAdmin.value || isGamMember.value)

  const isAdmin = computed(() =>
    user.value === 'Administrator' ||
    roles.value.includes('System Manager') ||
    roles.value.includes('Administrator')
  )

  async function fetchUser(force = false) {
    const now = Date.now()
    if (!force && user.value && user.value !== 'Guest' && (now - lastFetched.value) < CACHE_TTL) {
      return user.value
    }
    // Coalesce concurrent callers into the same boot round-trip.
    if (inflight) return inflight

    inflight = (async () => {
      const session = await getGamSession()
      user.value = session.user || 'Guest'
      fullName.value = session.full_name || ''
      roles.value = session.roles || []
      // Seed the L2 access-grant cache from the boot payload (single round-trip)
      // so the router guard + sidebar can read visibility synchronously.
      const { seed: seedAccess, setFrappeRoles } = useAccessGrants()
      setFrappeRoles(session.roles || [])
      seedAccess(session.access)
      lastFetched.value = Date.now()
      return user.value
    })()
    try {
      return await inflight
    } finally {
      inflight = null
    }
  }

  function clearAuth() {
    user.value = ''
    fullName.value = ''
    roles.value = []
    lastFetched.value = 0
    inflight = null
    // Drop the L2 access-grant cache so sidebar/nav entries derived from grants
    // do not leak across logout or into the next session.
    useAccessGrants().reset()
  }

  return {
    user,
    fullName,
    roles,
    isLoggedIn,
    isGamAdmin,
    isGamMember,
    isGamUser,
    isAdmin,
    fetchUser,
    clearAuth,
  }
}
