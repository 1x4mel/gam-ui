<template>
  <div class="h-full flex flex-col overflow-hidden">
    <PageHeader :title="title" :subtitle="subtitle" icon="🎮" :connected="connected" @refresh="refresh" />

    <!-- Toolbar: search-only. The (role, game) scope is fixed by the URL path,
         so there are no platform/role/status chips here — scope is shown as a
         static badge, not a clearable filter. -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-600/10 border border-indigo-600/20 text-indigo-500 text-xs font-black uppercase tracking-wider">
        <span>{{ gameName ? '🎮' : '🗂️' }}</span>
        <span>{{ scopeLabel }}</span>
      </div>
      <div class="flex-1 min-w-[180px] relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted text-sm">🔍</span>
        <input
          v-model="searchQuery" type="text" placeholder="Tìm username..."
          class="w-full pl-9 pr-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:border-indigo-600/50 text-sm"
          @input="onSearchInput"
        />
      </div>
    </div>

    <PaginatedListLayout
      :total-items="totalItems"
      :current-page="currentPage"
      :total-pages="totalPages"
      :page-size="pageSize"
      @update:current-page="goToPage"
      @update:page-size="setPageSize"
    >
      <LoadingSpinner v-if="loading" size="lg" text="Đang tải tài khoản..." />
      <EmptyState
        v-else-if="!items.length" icon="🎮" text="Không có tài khoản"
        :subtext="`Chưa có tài khoản nào${gameName ? ' cho ' + gameName : ''} phù hợp.`"
      />
      <div v-else class="space-y-2 max-w-4xl mx-auto pb-4">
        <AccountCard
          v-for="acc in items" :key="acc.name" :account="acc" mode="operate"
          :can-force="canForce" :now="serverNow" :settings="settings" :current-user-id="user"
          @start="startLease(acc)" @end="endLease(acc)" @force="openForce(acc)"
        />
      </div>
    </PaginatedListLayout>

    <!-- Start lease ("Checkin") -->
    <CheckoutModal v-if="checkoutTarget" :account-name="checkoutTarget.name" @close="closeCheckout" @done="onCheckoutDone" />
    <!-- Admin reclaim -->
    <ForceCheckoutModal
      v-if="forceTarget" :account-name="forceTarget.account" :used-by="forceTarget.used_by"
      :purpose="forceTarget.purpose" @close="forceTarget = null" @done="onForceDone"
    />
  </div>
</template>

<script setup>
/**
 * RoleGameAccountsView — the operational, member-facing role|game view.
 *
 * This is the dedicated home for the old `/accounts?role=X&game=Y` filter. It is
 * scope-locked: (role, game) come from the PATH (`/role/:role/game/:game` or
 * `/role/:role`), never from a mutable filter, so the scope cannot drift.
 *
 * It is task-oriented: the toolbar is search-only, the account cards surface an
 * inline Checkin/Checkout CTA, and admin CRUD chrome is intentionally absent
 * (admins still reach create/edit/delete via the `/accounts` back-office).
 *
 * Data + realtime + lease wiring are reused (no backend change): get_accounts_list
 * already filters by role+game and enforces has_access server-side; the live lease
 * state comes from the shared useActiveUsage singleton.
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import AccountCard from '../components/AccountCard.vue'
import CheckoutModal from '../components/CheckoutModal.vue'
import ForceCheckoutModal from '../components/ForceCheckoutModal.vue'
import { useServerPaginatedList } from '../composables/useServerPaginatedList.js'
import { useAuth } from '../composables/useAuth.js'
import { useRealtime } from '../composables/useRealtime.js'
import { useGamMetadata } from '../composables/useGamMetadata.js'
import { useActiveUsage } from '../composables/useActiveUsage.js'
import { useElapsedTimer } from '../composables/useElapsedTimer.js'
import { useCheckout } from '../composables/useCheckout.js'
import { useNotify } from '../composables/useNotify.js'
import { frappeCall } from '../api/index.js'

defineOptions({ name: 'RoleGameAccountsView' })

const route = useRoute()
const { connected, on: onRt, off: offRt } = useRealtime()
const { isGamAdmin, isAdmin, user } = useAuth()
const { roleOptions, games, gamesByRole, loadGamesByRole, load: loadMeta } = useGamMetadata()
const { leaseFor, settings, serverTimeMs } = useActiveUsage()
const { serverNow, start: startTimer, stop: stopTimer, syncClock } = useElapsedTimer()
const { checkin } = useCheckout()
const { success, error: notifyError } = useNotify()

const canForce = computed(() => isGamAdmin.value || isAdmin.value)

// ---- scope (from path params, not query) ----
const roleParam = computed(() => route.params.role)
const gameParam = computed(() => route.params.game || '')

const roleLabel = computed(() => {
  const o = roleOptions.value.find(x => x.value === roleParam.value)
  return o?.label || roleParam.value
})
const gameName = computed(() => {
  if (!gameParam.value) return ''
  const g = games.value.find(x => x.name === gameParam.value)
  return g?.game_name || gameParam.value
})
const title = computed(() => gameName.value || `Tất cả ${roleLabel.value}`)
const subtitle = computed(() => `${roleLabel.value}${totalItems.value != null ? ` · ${totalItems.value} tài khoản` : ''}`)
const scopeLabel = computed(() => (gameName.value ? `${gameName.value} · ${roleLabel.value}` : roleLabel.value))

// ---- search (only mutable filter) ----
const searchQuery = ref('')
let searchTimer = null
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { currentPage.value = 1; refresh() }, 350)
}

async function fetchAccounts(page, pageSize) {
  // role + game are scope, taken from the path. The server enforces has_access
  // on this exact (role, game) key, so a member cannot see beyond their grant.
  const filters = { role: roleParam.value }
  if (gameParam.value) filters.game = gameParam.value
  if (searchQuery.value.trim()) filters.username = searchQuery.value.trim()
  const res = await frappeCall('gam.api.get_accounts_list', {
    filters,
    limit_start: (page - 1) * pageSize,
    limit_page_length: pageSize,
  })
  return { data: res?.data || [], total: res?.total || 0 }
}

const {
  items, totalItems, currentPage, totalPages, pageSize, setPageSize, loading, goToPage, refresh,
} = useServerPaginatedList('gam_role_accounts', fetchAccounts, {
  defaultSize: 20,
  watchSources: [searchQuery, roleParam, gameParam],
})

// ---- sidebar badge self-heal ----
// The per-game badge count in the sidebar (gamesByRole) is a module-level
// singleton refreshed ONLY via the `gam_role_sections_changed` realtime event.
// If that event never reached this client (dropped websocket, direct DB edit,
// stale tab opened before the change), the badge drifts from the live list —
// the "badge shows 1 but list shows 0" phantom-account symptom. Whenever the
// authoritative list for this (role, game) lands, reconcile: if the cached
// count differs from the real total, force-refresh the sidebar cache so the
// badge corrects itself the instant the affected section is opened.
watch(totalItems, (total) => {
  if (total == null || !gameParam.value) return        // only per-game sections carry a badge
  if (searchQuery.value.trim()) return                  // search shrinks the list, not the badge
  const section = gamesByRole.value[roleParam.value]
  if (!Array.isArray(section)) return                   // cache not loaded for this role yet
  const cached = section.find((g) => g.game === gameParam.value)
  const cachedCount = cached ? cached.count : 0
  if (cachedCount !== total) loadGamesByRole(true)
})

// ---- lease actions (operate mode) ----
const checkoutTarget = ref(null)
function startLease(acc) { checkoutTarget.value = acc }
function closeCheckout() { checkoutTarget.value = null }
function onCheckoutDone() {
  success('Đã checkin')
  closeCheckout()
  refresh()
}

async function endLease(acc) {
  try {
    await checkin({ account: acc.name, endReason: 'DONE' })
    success('Đã checkout')
    refresh()
  } catch (e) {
    notifyError(e.message || 'Checkout thất bại')
  }
}

const forceTarget = ref(null)
function openForce(acc) {
  const l = leaseFor(acc.name)
  forceTarget.value = { account: acc.name, used_by: l?.used_by, purpose: l?.purpose }
}
function onForceDone() {
  forceTarget.value = null
  refresh()
}

// Re-fetch when any account's usage changes (refreshes rested + lock state).
function onAccountChanged() { refresh() }

// One realtime clock for every card on the page (same pattern as AccountListView).
watch(serverTimeMs, (v) => { if (v) syncClock(v) })

onMounted(() => {
  loadMeta()
  startTimer()
  if (serverTimeMs.value) syncClock(serverTimeMs.value)
  onRt('gam_account_changed', onAccountChanged)
})

onUnmounted(() => {
  offRt('gam_account_changed', onAccountChanged)
  stopTimer()
})
</script>
