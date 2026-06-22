<template>
  <div class="h-full flex flex-col overflow-hidden">
    <PageHeader title="Yêu cầu mã" subtitle="Lịch sử yêu cầu verification code" icon="📝" :connected="connected" @refresh="refresh" />

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
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
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted text-sm">👤</span>
        <input
          v-model="userFilter" type="text" placeholder="Lọc theo user..."
          class="w-full pl-9 pr-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:border-indigo-600/50 text-sm"
          @input="onFilterInput"
        />
      </div>
      <div class="min-w-[180px] relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted text-sm">📧</span>
        <input
          v-model="emailFilter" type="text" placeholder="Lọc theo email..."
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
      <LoadingSpinner v-if="loading" size="lg" text="Đang tải log..." />
      <EmptyState v-else-if="!items.length" icon="📝" text="Chưa có bản ghi" />
      <div v-else class="max-w-4xl mx-auto pb-4 space-y-2">
        <div
          v-for="log in items" :key="log.name"
          class="bg-app-surface border border-app-border rounded-2xl p-4 flex items-center gap-3 flex-wrap"
        >
          <div class="flex-1 min-w-0">
            <p class="font-black text-app-text-primary text-sm truncate">
              {{ userName(log.requested_by) }}
              <span v-if="log.platform" class="text-app-text-muted font-normal">·</span>
              <span v-if="log.platform" class="text-app-text-secondary">{{ log.platform }}</span>
            </p>
            <div class="flex items-center gap-3 text-[10px] text-app-text-muted mt-0.5 flex-wrap">
              <span v-if="log.target_email">📧 {{ emailLabel(log.target_email) }}</span>
              <span v-if="log.target_account">🎮 {{ accountLabel(log.target_account) }}</span>
              <span v-if="accountGame(log.target_account)" class="text-indigo-400">{{ accountGame(log.target_account) }}</span>
              <span>🕐 {{ formatDateFull(log.requested_at) }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <code v-if="log.code_value" class="text-sm font-black font-mono bg-app-bg px-2 py-1 rounded-lg">{{ log.code_value }}</code>
            <StatusBadge :status="statusBadgeFor(log.status)" />
          </div>
        </div>
      </div>
    </PaginatedListLayout>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
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
import { formatDateFull, userName } from '../utils/format.js'

defineOptions({ name: 'CodeRequestLogView' })

const { connected } = useRealtime()

const STATUS_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'FULFILLED', label: 'Đã cấp' },
  { value: 'NO_CODE', label: 'Không có' },
  { value: 'EXPIRED', label: 'Hết hạn' },
]
const statusFilter = ref('')
const userFilter = ref('')
const emailFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')

const FIELDS = ['name', 'requested_by', 'email_code', 'target_email', 'target_account', 'platform', 'code_value', 'status', 'requested_at']

async function fetchLogs(page, pageSize) {
  const filters = []
  if (statusFilter.value) filters.push(['status', '=', statusFilter.value])
  if (userFilter.value.trim()) filters.push(['requested_by', 'like', `%${userFilter.value.trim()}%`])
  if (emailFilter.value.trim()) filters.push(['target_email', 'like', `%${emailFilter.value.trim()}%`])
  if (dateFrom.value) filters.push(['requested_at', '>=', `${dateFrom.value} 00:00:00`])
  if (dateTo.value) filters.push(['requested_at', '<=', `${dateTo.value} 23:59:59`])

  const offset = (page - 1) * pageSize
  const [data, total] = await Promise.all([
    getList('GAM Code Request Log', { fields: FIELDS, filters, limit: pageSize, offset, order_by: 'requested_at desc' }),
    frappeCall('frappe.client.get_count', { doctype: 'GAM Code Request Log', filters }).catch(() => 0),
  ])
  return { data, total }
}

const {
  items, totalItems, currentPage, totalPages, pageSize, setPageSize, loading, goToPage, refresh,
} = useServerPaginatedList('gam_code_request_log', fetchLogs, { defaultSize: 30, watchSources: [statusFilter, dateFrom, dateTo] })

// Req #3 — resolve raw doc-name IDs to human-readable account/email labels + game
const { accountLabel, accountGame, emailLabel } = useDocLabels(items, {
  'GAM Account': (r) => r.target_account || '',
  'GAM Email': (r) => r.target_email || '',
})

watch(statusFilter, () => refresh())

let timer = null
function onFilterInput() {
  clearTimeout(timer)
  timer = setTimeout(() => { currentPage.value = 1; refresh() }, 350)
}

function statusBadgeFor(s) {
  if (s === 'FULFILLED') return 'Used'
  if (s === 'NO_CODE') return 'Pending'
  if (s === 'EXPIRED') return 'Expired'
  return s
}
</script>
