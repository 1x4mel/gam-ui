import { ref, computed } from 'vue'
import { getList, frappeCall } from '../api/index.js'

/**
 * Shared GAM reference data (games, emails, servers, dlcs) for dropdowns/forms.
 *
 * Loaded once and cached module-level so every view/form reuses the same data.
 * Per Design §3.4, selects only `is_active = 1` records for create/edit forms.
 *
 * Platform / Account Status / Account Role lists are now configurable via the
 * `GAM List Option` doctype. They are loaded from `gam.api.get_list_options`
 * and fall back to the hardcoded defaults below (pre-migration safety).
 */

// ---- Hardcoded fallbacks (mirror gam.api._default_list_options) -------------
const FALLBACK_OPTIONS = {
  Platform: [
    { value: 'STEAM', label: 'Steam', code_platform: 'STEAM', icon: '🎮', color: 'blue' },
    { value: 'BATTLENET', label: 'Battle.net', code_platform: 'BATTLENET', icon: '⚔️', color: 'indigo' },
    { value: 'EPIC', label: 'Epic', code_platform: 'EPIC', icon: '🛍️', color: 'slate' },
    { value: 'XBOX', label: 'Xbox', code_platform: 'XBOX', icon: '🎯', color: 'emerald' },
    { value: 'STANDALONE', label: 'Standalone', code_platform: 'POE', icon: '🕹️', color: 'amber' },
  ],
  'Account Status': [
    { value: 'ACTIVE', label: 'Active', code_platform: '', icon: '✅', color: 'emerald' },
    { value: 'INACTIVE', label: 'Inactive', code_platform: '', icon: '⏸️', color: 'slate' },
    { value: 'SUSPENDED', label: 'Suspended', code_platform: '', icon: '⛔', color: 'amber' },
    { value: 'BANNED', label: 'Banned', code_platform: '', icon: '🚫', color: 'red' },
  ],
  'Account Role': [
    { value: 'BOOSTER', label: 'Booster', code_platform: '', icon: '🚀', color: 'indigo' },
    { value: 'TRADER', label: 'Trader', code_platform: '', icon: '💱', color: 'emerald' },
    { value: 'ITEM', label: 'Item', code_platform: '', icon: '📦', color: 'amber' },
  ],
}

const EMAIL_PROVIDERS = ['Gmail', 'Outlook', 'Proton', 'Yahoo', 'Other']
const REGIONS = ['AMERICAS', 'ASIA', 'EUROPE', 'GLOBAL']

/** Static Tailwind class map (literal strings so the JIT keeps them). */
export const OPTION_COLOR_CLASSES = {
  blue: 'bg-blue-500/15 text-blue-400',
  indigo: 'bg-indigo-500/15 text-indigo-400',
  emerald: 'bg-emerald-500/15 text-emerald-400',
  amber: 'bg-amber-500/15 text-amber-400',
  red: 'bg-red-500/15 text-red-400',
  slate: 'bg-slate-500/15 text-slate-400',
  gray: 'bg-gray-500/15 text-gray-400',
  orange: 'bg-orange-500/15 text-orange-400',
}

export function optionColorClass(color) {
  return OPTION_COLOR_CLASSES[(color || '').toLowerCase()] || OPTION_COLOR_CLASSES.gray
}

const games = ref([])
const emails = ref([])
const servers = ref([])
const dlcs = ref([])
const loaded = ref(false)
const loading = ref(false)

// configurable list options (all categories, from GAM List Option)
const listOptions = ref([])
const listOptionsLoaded = ref(false)
const listOptionsLoading = ref(false)

// games-per-role: distinct games that actually have role+game bindings, grouped
// by Account Role value - drives the sidebar role sections. Aggregated from the
// first-class GAM Account Role Game table (gam.api.get_role_game_sections).
const gamesByRole = ref({})
const gamesByRoleLoaded = ref(false)
const gamesByRoleLoading = ref(false)

/** Options for a category: loaded rows if available, else hardcoded fallback. */
function optionsFor(category) {
  const rows = listOptions.value.filter(o => o.category === category)
  if (rows.length || listOptionsLoaded.value) return rows
  return FALLBACK_OPTIONS[category] || []
}

const platformOptions = computed(() => optionsFor('Platform'))
const statusOptions = computed(() => optionsFor('Account Status'))
const roleOptions = computed(() => optionsFor('Account Role'))

// backward-compatible string arrays (now data-driven)
const PLATFORMS = computed(() => platformOptions.value.map(o => o.value))
const ACCOUNT_STATUS = computed(() => statusOptions.value.map(o => o.value))
const ACCOUNT_ROLES = computed(() => roleOptions.value.map(o => o.value))
const CODE_PLATFORMS = computed(() => {
  const set = []
  for (const o of platformOptions.value) {
    if (o.code_platform && !set.includes(o.code_platform)) set.push(o.code_platform)
  }
  return set
})

/** Look up a rich option object {label, value, icon, color, ...} by value. */
function optionFor(category, value) {
  const v = (value || '').toString()
  const rows = optionsFor(category)
  return (
    rows.find(o => o.value === v) ||
    rows.find(o => o.value === v.toUpperCase()) ||
    null
  )
}

const platformMeta = value => optionFor('Platform', value)
const roleMeta = value => optionFor('Account Role', value)
const statusMeta = value => optionFor('Account Status', value)

async function loadListOptions(force = false) {
  if (listOptionsLoaded.value && !force) return
  if (listOptionsLoading.value) return
  listOptionsLoading.value = true
  try {
    const rows = await frappeCall('gam.api.get_list_options', {})
    listOptions.value = Array.isArray(rows) ? rows : []
    listOptionsLoaded.value = true
  } catch (e) {
    console.error('[useGamMetadata] loadListOptions error', e)
    // keep using fallbacks
    listOptionsLoaded.value = true
  } finally {
    listOptionsLoading.value = false
  }
}

async function loadGamesByRole(force = false) {
  if (gamesByRoleLoaded.value && !force) return
  if (gamesByRoleLoading.value) return
  gamesByRoleLoading.value = true
  try {
    const data = await frappeCall('gam.api.get_role_game_sections', {})
    gamesByRole.value = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {}
    gamesByRoleLoaded.value = true
  } catch (e) {
    console.error('[useGamMetadata] loadGamesByRole error', e)
    gamesByRole.value = {}
    gamesByRoleLoaded.value = true
  } finally {
    gamesByRoleLoading.value = false
  }
}

/** Games (with live counts) for a given Account Role value. */
function gamesForRole(roleValue) {
  if (!roleValue) return []
  return gamesByRole.value[roleValue] || []
}

async function load(force = false) {
  if (loaded.value && !force) return
  if (loading.value) return
  loading.value = true
  try {
    const [g, e, s, d] = await Promise.all([
      getList('GAM Game', { fields: ['name', 'game_name', 'publisher', 'is_active'], filters: [['is_active', '=', 1]], limit: 500, order_by: 'game_name asc' }),
      getList('GAM Email', { fields: ['name', 'address', 'provider', 'is_active'], filters: [['is_active', '=', 1]], limit: 500, order_by: 'address asc' }),
      getList('GAM Game Server', { fields: ['name', 'game', 'server_name', 'is_active'], filters: [['is_active', '=', 1]], limit: 500, order_by: 'server_name asc' }),
      getList('GAM DLC', { fields: ['name', 'dlc_name', 'game'], limit: 500, order_by: 'dlc_name asc' }),
    ])
    games.value = g
    emails.value = e
    servers.value = s
    dlcs.value = d
    loaded.value = true
    // load configurable lists in parallel-ish (non-blocking, has fallbacks)
    loadListOptions(force)
  } catch (e) {
    console.error('[useGamMetadata] load error', e)
  } finally {
    loading.value = false
  }
}

/** Servers for a given game link. */
function serversForGame(gameName) {
  if (!gameName) return servers.value
  return servers.value.filter(s => s.game === gameName)
}

/** DLCs for a given game link (GAM DLC.game is scoped per game). */
function dlcsForGame(gameName) {
  if (!gameName) return dlcs.value
  return dlcs.value.filter(d => d.game === gameName)
}

export function useGamMetadata() {
  return {
    // configurable lists (rich)
    platformOptions,
    statusOptions,
    roleOptions,
    // configurable lists (string arrays, backward compatible)
    PLATFORMS,
    ACCOUNT_STATUS,
    ACCOUNT_ROLES,
    CODE_PLATFORMS,
    EMAIL_PROVIDERS,
    REGIONS,
    // lookups
    platformMeta,
    roleMeta,
    statusMeta,
    optionFor,
    optionColorClass,
    // classic reference data
    games,
    emails,
    servers,
    dlcs,
    loading,
    loaded,
    load,
    loadListOptions,
    // games-per-role (sidebar role sections)
    gamesByRole,
    gamesByRoleLoaded,
    loadGamesByRole,
    gamesForRole,
    serversForGame,
    dlcsForGame,
  }
}
