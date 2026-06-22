<template>
  <div class="h-full flex flex-col overflow-hidden">
    <PageHeader title="Nhật ký Reveal" subtitle="Lịch sử xem / copy mật khẩu" icon="🔓" :connected="connected" @refresh="refresh" />

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <div class="flex items-center gap-1 bg-app-surface border border-app-border rounded-xl p-1">
        <button
          v-for="a in ACTION_FILTERS" :key="a.value"
          @click="actionFilter = a.value"
          class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition"
          :class="actionFilter === a.value ? 'bg-indigo-600 text-white' : 'text-app-text-muted hover:text-app-text-primary'"
        >
          {{ a.label }}
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
      <EmptyState v-else-if="!items.length" icon="🔓" text="Chưa có bản ghi" />
      <div v-else class="max-w-4xl mx-auto pb-4 space-y-2">
        <div
          v-for="log in items" :key="log.name"
          class="bg-app-surface border border-app-border rounded-2xl p-4 flex items-center gap-3 flex-wrap"
        >
          <div class="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-lg shrink-0">
            {{ log.action === 'COPY' ? '📋' : '👁' }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-black text-app-text-primary text-sm truncate">
              {{ userName(log.viewed_by) }}
              <span class="text-app-text-muted font-normal">·</span>
              <span class="text-app-text-secondary">{{ shortDoctype(log.target_doctype) }}</span>
              <span class="text-app-text-muted font-normal">·</span>
              <span class="text-app-text-secondary">{{ targetInfo(log).label }}</span>
              <span v-if="targetInfo(log).game" class="text-indigo-400 font-normal">🎮 {{ targetInfo(log).game }}</span>
            </p>
            <p class="text-[10px] text-app-text-muted">
              {{ log.fieldname || '—' }} · IP {{ log.ip_address || '—' }} · {{ formatDateFull(log.viewed_at) }}
            </p>
          </div>
          <span
            class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
            :class="log.action === 'COPY' ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'"
          >
            {{ log.action }}
          </span>
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
import DateRangeFilter from '../components/DateRangeFilter.vue'
import { useServerPaginatedList } from '../composables/useServerPaginatedList.js'
import { useDocLabels } from '../composables/useDocLabels.js'
import { useRealtime } from '../composables/useRealtime.js'
import { getList, frappeCall } from '../api/index.js'
import { formatDateFull, userName } from '../utils/format.js'

defineOptions({ name: 'RevealLogView' })

const { connected } = useRealtime()

const ACTION_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'REVEAL', label: 'Reveal' },
  { value: 'COPY', label: 'Copy' },
]
const actionFilter = ref('')
const userFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')

const FIELDS = ['name', 'action', 'viewed_by', 'target_doctype', 'target_name', 'fieldname', 'ip_address', 'viewed_at']

async function fetchLogs(page, pageSize) {
  const filters = []
  if (actionFilter.value) filters.push(['action', '=', actionFilter.value])
  if (userFilter.value.trim()) filters.push(['viewed_by', 'like', `%${userFilter.value.trim()}%`])
  if (dateFrom.value) filters.push(['viewed_at', '>=', `${dateFrom.value} 00:00:00`])
  if (dateTo.value) filters.push(['viewed_at', '<=', `${dateTo.value} 23:59:59`])

  const offset = (page - 1) * pageSize
  const [data, total] = await Promise.all([
    getList('GAM Reveal Log', { fields: FIELDS, filters, limit: pageSize, offset, order_by: 'viewed_at desc' }),
    frappeCall('frappe.client.get_count', { doctype: 'GAM Reveal Log', filters }).catch(() => 0),
  ])
  return { data, total }
}

const {
  items, totalItems, currentPage, totalPages, pageSize, setPageSize, loading, goToPage, refresh,
} = useServerPaginatedList('gam_reveal_log', fetchLogs, { defaultSize: 30, watchSources: [actionFilter, dateFrom, dateTo] })

// Req #2 — resolve raw doc-name IDs to human-readable account/email labels + game
const { accountLabel, accountGame, emailLabel } = useDocLabels(items, {
  'GAM Account': (r) => (r.target_doctype === 'GAM Account' ? r.target_name : ''),
  'GAM Email': (r) => (r.target_doctype === 'GAM Email' ? r.target_name : ''),
})

function targetInfo(log) {
  if (log.target_doctype === 'GAM Account') {
    return { label: accountLabel(log.target_name), game: accountGame(log.target_name) }
  }
  return { label: emailLabel(log.target_name), game: '' }
}

watch(actionFilter, () => refresh())

let timer = null
function onFilterInput() {
  clearTimeout(timer)
  timer = setTimeout(() => { currentPage.value = 1; refresh() }, 350)
}

function shortDoctype(dt) {
  return (dt || '').replace('GAM ', '')
}
</script>
