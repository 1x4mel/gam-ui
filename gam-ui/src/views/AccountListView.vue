<template>
  <div class="h-full flex flex-col overflow-hidden">
    <PageHeader title="Tài khoản" subtitle="Tài khoản game" icon="🎮" :connected="connected" @refresh="refresh">
      <template #actions>
        <button
          v-if="canCreate" @click="showCreate = true"
          class="px-4 py-2 sm:py-2.5 rounded-xl btn-premium bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
        >
          <span>+</span> <span class="hidden sm:inline">Thêm</span>
        </button>
      </template>
    </PageHeader>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <div class="flex items-center gap-1 bg-app-surface border border-app-border rounded-xl p-1 flex-wrap">
        <button
          v-for="p in PLATFORM_FILTERS" :key="p.value"
          @click="platformFilter = p.value"
          class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition"
          :class="platformFilter === p.value ? 'bg-indigo-600 text-white' : 'text-app-text-muted hover:text-app-text-primary'"
        >
          {{ p.label }}
        </button>
      </div>
      <div class="flex items-center gap-1 bg-app-surface border border-app-border rounded-xl p-1 flex-wrap">
        <button
          v-for="r in ROLE_FILTERS" :key="r.value"
          @click="roleFilter = r.value"
          class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition"
          :class="roleFilter === r.value ? 'bg-indigo-600 text-white' : 'text-app-text-muted hover:text-app-text-primary'"
        >
          {{ r.label }}
        </button>
      </div>
      <div class="flex items-center gap-1 bg-app-surface border border-app-border rounded-xl p-1">
        <button
          v-for="s in STATUS_FILTERS" :key="s.value"
          @click="statusFilter = s.value"
          class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition"
          :class="statusFilter === s.value ? 'bg-indigo-600 text-white' : 'text-app-text-muted hover:text-app-text-primary'"
        >
          {{ s.label }}
        </button>
      </div>
      <div class="flex-1 min-w-[180px] relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted text-sm">🔍</span>
        <input
          v-model="searchQuery" type="text" placeholder="Tìm username..."
          class="w-full pl-9 pr-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:border-indigo-600/50 text-sm"
          @input="onSearchInput"
        />
      </div>
      <div v-if="gameFilter" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-600/15 text-indigo-400 text-xs font-bold">
        🎮 {{ gameFilterLabel }}
        <button @click="clearGameFilter" class="hover:text-indigo-200">✕</button>
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
      <EmptyState v-else-if="!items.length" icon="🎮" text="Không có tài khoản" subtext="Chưa có tài khoản game nào phù hợp bộ lọc." />
      <div v-else class="space-y-2 max-w-4xl mx-auto pb-4">
        <!-- Shared card. Admin back-office shows CRUD actions (canManage);
             the operate role|game view reuses the same card in mode="operate". -->
        <AccountCard
          v-for="acc in items" :key="acc.name" :account="acc" mode="admin" :can-manage="canCreate"
          :now="serverNow" :settings="settings" :current-user-id="user"
          @edit="openEdit(acc)" @delete="askDelete(acc)"
        />
      </div>
    </PaginatedListLayout>

    <!-- Create modal (admin) -->
    <AccountFormModal v-if="showCreate" @close="showCreate = false" @saved="onCreated" />
    <!-- Edit modal (admin) -->
    <AccountFormModal v-if="showEdit" :account="editTarget" @close="closeEdit" @saved="onEdited" />
    <!-- Delete confirm (admin) -->
    <ConfirmDialog
      v-if="deleteTarget" title="Xoá tài khoản"
      :message="`Xoá tài khoản «${deleteTarget.username}»? Mọi liên kết và lịch sử sử dụng sẽ bị xoá theo. Hành động này không thể hoàn tác.`"
      confirm-label="Xoá" danger :loading="deleting" :error="deleteError"
      @close="closeDelete" @confirm="confirmDelete"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import AccountCard from '../components/AccountCard.vue'
import AccountFormModal from '../components/AccountFormModal.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useServerPaginatedList } from '../composables/useServerPaginatedList.js'
import { useAuth } from '../composables/useAuth.js'
import { useRealtime } from '../composables/useRealtime.js'
import { useGamMetadata } from '../composables/useGamMetadata.js'
import { useActiveUsage } from '../composables/useActiveUsage.js'
import { useElapsedTimer } from '../composables/useElapsedTimer.js'
import { useNotify } from '../composables/useNotify.js'
import { frappeCall } from '../api/index.js'

defineOptions({ name: 'AccountListView' })

const route = useRoute()
const { connected, on: onRt, off: offRt } = useRealtime()
const { isGamAdmin, isAdmin, user } = useAuth()
const { settings, serverTimeMs } = useActiveUsage()
const { serverNow, start: startTimer, stop: stopTimer, syncClock } = useElapsedTimer()
const { platformOptions, statusOptions, roleOptions, games, load: loadMeta, loadGamesByRole } = useGamMetadata()
const { success } = useNotify()
const canCreate = computed(() => isGamAdmin.value || isAdmin.value)

/** Re-fetch the list when any account's usage changes (refreshes rested + lock server fields). */
function onAccountChanged() {
  refresh()
}

// data-driven filters (with an "all" sentinel), backed by GAM List Option
const PLATFORM_FILTERS = computed(() => [{ value: '', label: 'Tất cả' }, ...platformOptions.value.map(o => ({ value: o.value, label: o.label }))])
const ROLE_FILTERS = computed(() => [{ value: '', label: 'Tất cả' }, ...roleOptions.value.map(o => ({ value: o.value, label: o.label }))])
const STATUS_FILTERS = computed(() => [{ value: '', label: 'Tất cả' }, ...statusOptions.value.map(o => ({ value: o.value, label: o.label }))])

const platformFilter = ref('')
const roleFilter = ref('')
const statusFilter = ref('')
const searchQuery = ref('')
const gameFilter = ref('')
const showCreate = ref(false)

async function fetchAccounts(page, pageSize) {
  // Custom whitelist endpoint returns accounts WITH their games expanded
  // (child tables are NOT returned by frappe.client.get_list, so the cards
  // could never show the assigned games). It also resolves the game filter
  // server-side in the same query.
  const filters = {}
  if (platformFilter.value) filters.platform = platformFilter.value
  if (roleFilter.value) filters.role = roleFilter.value
  if (statusFilter.value) filters.status = statusFilter.value
  if (searchQuery.value.trim()) filters.username = searchQuery.value.trim()
  if (gameFilter.value) filters.game = gameFilter.value

  const offset = (page - 1) * pageSize
  const res = await frappeCall('gam.api.get_accounts_list', {
    filters,
    limit_start: offset,
    limit_page_length: pageSize,
  })
  return { data: res?.data || [], total: res?.total || 0 }
}

const {
  items, totalItems, currentPage, totalPages, pageSize, setPageSize, loading, goToPage, refresh,
} = useServerPaginatedList('gam_accounts', fetchAccounts, { defaultSize: 20, watchSources: [platformFilter, roleFilter, statusFilter, gameFilter] })
// NOTE: filter watches are NOT redeclared here — useServerPaginatedList already
// deep-watches `watchSources`, resets currentPage → 1 and refreshes. Re-watching
// here caused a double-fetch on every filter change (P2.3). Only searchQuery uses
// a manual debounced watch below (it is intentionally NOT in watchSources).

let searchTimer = null
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    refresh()
  }, 350)
}

const gameFilterLabel = computed(() => {
  if (!gameFilter.value) return ''
  const g = games.value.find(x => x.name === gameFilter.value)
  return g ? g.game_name : gameFilter.value
})
function clearGameFilter() {
  gameFilter.value = ''
}

function onCreated() {
  showCreate.value = false
  refresh()
  // Reflow the dynamic role/game sidebar sections live (no manual reload).
  loadGamesByRole(true)
}

// ---- Edit ----
const showEdit = ref(false)
const editTarget = ref(null)
function openEdit(acc) {
  editTarget.value = acc
  showEdit.value = true
}
function closeEdit() {
  showEdit.value = false
  editTarget.value = null
}
function onEdited() {
  closeEdit()
  refresh()
  // Reflow the dynamic role/game sidebar sections live (no manual reload).
  loadGamesByRole(true)
}

// ---- Delete (routes through gam.api.delete_account) ----
const deleteTarget = ref(null)
const deleting = ref(false)
const deleteError = ref('')
function askDelete(acc) {
  deleteTarget.value = acc
  deleteError.value = ''
}
function closeDelete() {
  if (deleting.value) return
  deleteTarget.value = null
  deleteError.value = ''
}
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    const res = await frappeCall('gam.api.delete_account', { name: deleteTarget.value.name })
    if (res.blocked) {
      deleteError.value = `Không thể xoá: tài khoản đang được sử dụng bởi ${res.in_use_by || 'người khác'}.`
    } else {
      success('Đã xoá')
      deleteTarget.value = null
      refresh()
      // Reflow the dynamic role/game sidebar sections live (no manual reload).
      loadGamesByRole(true)
    }
  } catch (e) {
    deleteError.value = e.message || 'Xoá thất bại'
  } finally {
    deleting.value = false
  }
}

// One realtime clock for every card on the page. serverTimeMs is re-anchored
// by useActiveUsage on each (debounced) usage refresh, so the per-card elapsed
// timer stays aligned with the DB server's auto-release sweep.
watch(serverTimeMs, (v) => { if (v) syncClock(v) })

onMounted(() => {
  loadMeta()
  startTimer()
  if (serverTimeMs.value) syncClock(serverTimeMs.value)
  // role/game now live under /role/... (old URLs redirect there), so only the
  // platform deep-link filter is seeded from the query here.
  if (route.query.platform) {
    platformFilter.value = String(route.query.platform)
  }
  // Live lock state: re-fetch when any account's usage changes.
  onRt('gam_account_changed', onAccountChanged)
})

onUnmounted(() => {
  offRt('gam_account_changed', onAccountChanged)
  stopTimer()
})
</script>
