import { ref, computed } from 'vue'
import { frappeCall } from '../api/index.js'

/**
 * useAccessGrants — client cache for the L2 (fine-scoping) access layer.
 *
 * Seeded once from the boot session (`getGamSession().access`) so the router
 * guard and AppLayout can read it synchronously, with a `load()` fallback that
 * re-fetches `gam.api.get_my_access_grants` (e.g. after an admin edits grants).
 *
 * Semantics mirror the backend `has_access`:
 *  - admins (`is_admin`) bypass everything (see all role/game + sections);
 *  - otherwise a (scope, key) is allowed if it is in `grants`;
 *  - if the user has ZERO grants AND `default_policy === 'match_role'`, fall
 *    back to the legacy behaviour (role/game visibility by Frappe role) — see
 *    `roleFallsBackTo` / `hasRoleGame`.
 */
const APP = 'GAM'

const access = ref({ is_admin: false, default_policy: 'match_role', grants: [] })
const loaded = ref(false)

function _key(scope, key) {
  return `${scope}|${key}`
}

const isAdmin = computed(() => !!access.value.is_admin)
const defaultPolicy = computed(() => access.value.default_policy || 'match_role')
const grantKeys = computed(() => new Set((access.value.grants || []).map(g => _key(g.scope, g.key))))
const hasAnyGrant = computed(() => (access.value.grants || []).length > 0)

/** Seed the cache from the boot session payload (no extra round-trip). */
function seed(payload) {
  if (payload && typeof payload === 'object') {
    access.value = {
      is_admin: !!payload.is_admin,
      default_policy: payload.default_policy || 'match_role',
      grants: Array.isArray(payload.grants) ? payload.grants : [],
    }
  }
  loaded.value = true
}

/** Force-refresh from the server (e.g. after editing grants in the matrix UI). */
async function load() {
  try {
    const res = await frappeCall('gam.api.get_my_access_grants', { app: APP })
    seed(res)
  } catch {
    // backend may predate the grant endpoints → empty grants, legacy fallback
    loaded.value = true
  }
  return access.value
}

function reset() {
  access.value = { is_admin: false, default_policy: 'match_role', grants: [] }
  loaded.value = false
}

/** Generic (scope, key) check. */
function hasAccess(scope, key) {
  if (isAdmin.value) return true
  if (grantKeys.value.has(_key(scope, key))) return true
  // match_role fallback only when the user has no explicit grants at all
  if (!hasAnyGrant.value && defaultPolicy.value === 'match_role') {
    if (scope === 'SECTION') return true
    // ROLE_GAME fallback is resolved with the user's Frappe roles below
  }
  return false
}

/** ROLE_GAME convenience: does the session user see `role` (+ optional `game`)?
 *  `label` (the GAM List Option label) is only consulted under the match_role
 *  fallback so legacy users whose Frappe role matches the option LABEL keep
 *  their visibility (mirrors backend _frappe_role_matches_role_value, which
 *  matches role VALUE or its List Option LABEL against the user's Frappe roles). */
function hasRoleGame(role, game = '', label = '') {
  if (isAdmin.value) return true
  const key = _key('ROLE_GAME', `${role}|${game}`)
  if (grantKeys.value.has(key)) return true
  // match_role fallback: legacy behaviour = whole role visible if the user's
  // Frappe roles contain the role value OR its GAM List Option label.
  if (!hasAnyGrant.value && defaultPolicy.value === 'match_role') {
    return roleMatchesFrappeRole(role) || (label ? roleMatchesFrappeRole(label) : false)
  }
  return false
}

function canSection(sectionKey) {
  return hasAccess('SECTION', sectionKey)
}

// --- match_role fallback helpers -------------------------------------------
let _frappeRoles = []

function setFrappeRoles(roles) {
  _frappeRoles = Array.isArray(roles) ? roles.map(r => String(r)) : []
}

function roleMatchesFrappeRole(roleValue) {
  if (!roleValue) return false
  const lowered = new Set(_frappeRoles.map(r => r.toLowerCase()))
  return lowered.has(String(roleValue).toLowerCase())
}

export function useAccessGrants() {
  return {
    access,
    isAdmin,
    defaultPolicy,
    grantKeys,
    hasAnyGrant,
    seed,
    load,
    reset,
    hasAccess,
    hasRoleGame,
    canSection,
    setFrappeRoles,
  }
}
