<template>
  <div class="h-full flex flex-col overflow-hidden">
    <PageHeader title="Sử dụng tài khoản" subtitle="Checkout / check-in lease — ai đang mượn tài khoản nào" icon="🔑" :connected="connected" @refresh="refresh" />

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <div class="flex flex-wrap items-center gap-1 bg-app-surface border border-app-border rounded-xl p-1">
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
          v-model="queryFilter" type="text" placeholder="Lọc theo user / tài khoản..."
          class="w-full pl-9 pr-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:border-indigo-600/50 text-sm"
          @input="onFilterInput"
        />
      </div>
      <DateRangeFilter v-model:date-from="dateFrom" v-model:date-to="dateTo" />
    </div>

    <PaginatedListLayout
      :total-items="totalItems"
      :current-page="currentPage"
      :total-pages="totalPages"
      :page-size="pageSize"
      @update:current-page="goToPage"
      @update:page-size="setPageSize"
    >
      <LoadingSpinner v-if="loading" size="lg" text="Đang tải..." />
      <EmptyState v-else-if="!items.length" icon="🔑" text="Chưa có phiên sử dụng nào" />
      <div v-else class="max-w-4xl mx-auto pb-4 space-y-2">
        <div
          v-for="u in items" :key="u.name"
          class="bg-app-surface border border-app-border rounded-2xl p-4 flex items-center gap-3 flex-wrap"
        >
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
            :class="statusFilter === '' || statusFilter === 'IN_USE' ? 'bg-blue-500/10' : 'bg-app-bg'"
          >
            🎮
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-black text-app-text-primary text-sm truncate">
              <router-link v-if="u.account" :to="`/accounts/${u.account}`" class="hover:text-indigo-500">{{ accountLabel(u.account) }}</router-link>
              <span v-if="accountGame(u.account)" class="text-indigo-400 font-normal text-xs">🎮 {{ accountGame(u.account) }}</span>
              <span v-if="!u.account" class="text-app-text-muted">—</span>
              <span class="text-app-text-muted font-normal"> · </span>
              <span class="text-app-text-secondary">{{ userName(u.used_by) }}</span>
            </p>
            <div class="flex items-center gap-2 text-[10px] text-app-text-muted mt-0.5 flex-wrap">
              <span v-if="u.purpose">🎯 {{ u.purpose }}</span>
              <span v-if="u.order_ref" class="font-mono">#{{ u.order_ref }}</span>
              <span>🚀 {{ formatDateFull(u.started_at) }}</span>
              <span>⏳ đến {{ formatDate(u.lease_until) }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <!-- Live countdown for active leases -->
            <span
              v-if="u.status === 'IN_USE'" class="text-[10px] font-black font-mono px-2 py-1 rounded-lg"
              :class="countdownClass(u.lease_until)"
            >
              {{ countdownLabel(u.lease_until) }}
            </span>
            <StatusBadge :status="u.status" />
          </div>
        </div>
      </div>
    </PaginatedListLayout>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import DateRangeFilter from '../components/DateRangeFilter.vue'
import { useServerPaginatedList } from '../composables/useServerPaginatedList.js'
import { useDocLabels } from '../composables/useDocLabels.js'
import { useRealtime } from '../composables/useRealtime.js'
import { getList, frappeCall } from '../api/index.js'
import { formatDate, formatDateFull, userName } from '../utils/format.js'

defineOptions({ name: 'AccountUsageView' })

const { connected } = useRealtime()

const STATUS_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'IN_USE', label: 'Đang mượn' },
  { value: 'EXPIRED', label: 'Hết hạn' },
  { value: 'RELEASED', label: 'Đã trả' },
  { value: 'FORCE_RELEASED', label: 'Buông ép' },
]
const statusFilter = ref('IN_USE')
const queryFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')

const FIELDS = [
  'name', 'account', 'status', 'used_by', 'purpose', 'order_ref',
  'started_at', 'lease_until', 'ended_at', 'end_reason', 'notes',
]

async function fetchUsages(page, pageSize) {
  const filters = []
  if (statusFilter.value) filters.push(['status', '=', statusFilter.value])
  if (dateFrom.value) filters.push(['started_at', '>=', `${dateFrom.value} 00:00:00`])
  if (dateTo.value) filters.push(['started_at', '<=', `${dateTo.value} 23:59:59`])
  const q = queryFilter.value.trim()
  if (q) {
    filters.push(['used_by', 'like', `%${q}%`])
  }

  const offset = (page - 1) * pageSize
  const [data, total] = await Promise.all([
    getList('GAM Account Usage', { fields: FIELDS, filters, limit: pageSize, offset, order_by: 'started_at desc' }),
    frappeCall('frappe.client.get_count', { doctype: 'GAM Account Usage', filters }).catch(() => 0),
  ])
  return { data, total }
}

const {
  items, totalItems, currentPage, totalPages, pageSize, setPageSize, loading, goToPage, refresh,
} = useServerPaginatedList('gam_account_usage', fetchUsages, { defaultSize: 30, watchSources: [statusFilter, dateFrom, dateTo] })

// Req #2 — resolve raw account IDs to human-readable account labels + game
const { accountLabel, accountGame } = useDocLabels(items, {
  'GAM Account': (r) => r.account || '',
})

watch(statusFilter, () => refresh())

let timer = null
function onFilterInput() {
  clearTimeout(timer)
  timer = setTimeout(() => { currentPage.value = 1; refresh() }, 350)
}

// --- Live countdown for IN_USE leases ---
const now = ref(Date.now())
let tick = null
onMounted(() => { tick = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => { if (tick) clearInterval(tick) })

function toMs(d) {
  if (!d) return NaN
  let str = String(d)
  if (str.includes(' ') && !str.includes('Z') && !str.includes('+')) str = str.replace(' ', 'T')
  return new Date(str).getTime()
}

function remainingMs(leaseUntil) {
  return toMs(leaseUntil) - now.value
}

function countdownLabel(leaseUntil) {
  const ms = remainingMs(leaseUntil)
  if (isNaN(ms)) return '—'
  if (ms <= 0) return 'QUÁ HẠN'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `còn ${h}h ${m}m`
  if (m > 0) return `còn ${m}m ${sec}s`
  return `còn ${sec}s`
}

function countdownClass(leaseUntil) {
  const ms = remainingMs(leaseUntil)
  if (isNaN(ms)) return 'bg-app-bg text-app-text-muted'
  if (ms <= 0) return 'bg-red-500/20 text-red-400'
  // less than 25% of a typical lease window remaining (< 15min) → warning
  if (ms < 15 * 60 * 1000) return 'bg-amber-500/20 text-amber-400'
  return 'bg-blue-500/20 text-blue-400'
}
</script>
