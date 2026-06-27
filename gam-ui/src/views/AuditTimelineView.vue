<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Header rendered by the Activity hub when embedded; kept for standalone use. -->
    <PageHeader v-if="!embedded" title="Audit Timeline" subtitle="Ai đã làm gì, với tài khoản/game nào, từ IP nào, khi nào" icon="🛡️" :connected="connected" @refresh="loadAll" />

    <div class="flex-1 overflow-y-auto custom-scrollbar max-w-6xl mx-auto w-full pb-8">
      <!-- Summary cards -->
      <div v-if="summary" class="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <SummaryCard label="Tổng sự kiện" :value="summary.total" icon="📊" />
        <SummaryCard label="Login" :value="summary.by_action?.LOGIN || 0" icon="🔑" />
        <SummaryCard label="Lấy code" :value="summary.by_action?.CODE_REQUEST || 0" icon="📝" />
        <SummaryCard label="Reveal/Copy" :value="(summary.by_action?.REVEAL || 0) + (summary.by_action?.COPY || 0)" icon="🔓" />
        <SummaryCard label="IP khác nhau" :value="summary.distinct_ips" icon="🌐" />
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <div class="flex items-center gap-1 bg-app-surface border border-app-border rounded-xl p-1">
          <button v-for="a in ACTION_FILTERS" :key="a.value" @click="actionFilter = a.value"
            class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition"
            :class="actionFilter === a.value ? 'bg-indigo-600 text-white' : 'text-app-text-muted hover:text-app-text-primary'">
            {{ a.label }}
          </button>
        </div>
        <div class="flex-1 min-w-[140px] relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted text-sm">👤</span>
          <input v-model="userFilter" placeholder="User..." class="w-full pl-9 pr-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text-primary text-sm" />
        </div>
        <div class="min-w-[140px] relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted text-sm">🎮</span>
          <input v-model="accountFilter" placeholder="Account ID..." class="w-full pl-9 pr-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text-primary text-sm" />
        </div>
        <div class="min-w-[120px] relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted text-sm">🌐</span>
          <input v-model="ipFilter" placeholder="IP..." class="w-full pl-9 pr-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text-primary text-sm" />
        </div>
        <button @click="anomalyOnly = !anomalyOnly; page = 1; loadAll()"
          class="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition"
          :class="anomalyOnly ? 'bg-rose-600 text-white' : 'bg-app-surface border border-app-border text-app-text-muted hover:text-rose-400'">
          ⚠️ Bất thường
        </button>
        <DateRangeFilter v-model:date-from="dateFrom" v-model:date-to="dateTo" />
        <button @click="exportCsv" :disabled="exporting"
          class="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 shrink-0">
          {{ exporting ? '...' : '⬇ CSV' }}
        </button>
      </div>

      <PaginatedListLayout :total-items="total" :current-page="page" :total-pages="totalPages" :page-size="pageSize"
        @update:current-page="(p) => { page = p; loadAll() }" @update:page-size="(s) => { pageSize = s; page = 1; loadAll() }">
        <LoadingSpinner v-if="loading" size="lg" text="Đang tải audit..." />
        <EmptyState v-else-if="!events.length" icon="🛡️" text="Chưa có sự kiện" />
        <div v-else class="pb-4 space-y-1.5">
          <div v-for="e in events" :key="e.source_doctype + ':' + e.source_name"
            class="bg-app-surface border border-app-border rounded-xl p-3 flex items-center gap-3 flex-wrap">
            <div class="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
              :class="actionStyle(e.action).bg">
              {{ actionStyle(e.action).icon }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold text-app-text-primary truncate">
                {{ userName(e.user) }}
                <span class="text-app-text-muted font-normal">·</span>
                <span :class="actionStyle(e.action).text" class="font-black">{{ actionLabel(e.action) }}</span>
                <span v-if="e.account_username" class="text-app-text-secondary font-normal">· {{ e.account_username }}</span>
              </p>
              <div class="flex items-center gap-3 text-[10px] text-app-text-muted mt-0.5 flex-wrap">
                <span v-if="e.detail" class="font-mono">{{ e.detail }}</span>
                <span v-if="e.game">🎮 {{ e.game }}</span>
                <span v-if="e.platform">🖥️ {{ e.platform }}</span>
                <span v-if="e.anomaly && e.anomaly.length" class="text-rose-400 font-black">⚠ {{ e.anomaly.join(',') }}</span>
                <span v-if="e.ip_address">🌐 {{ e.ip_address }}</span>
                <span v-if="e.device">💻 {{ e.device }}</span>
                <span v-if="e.duration != null">⏱ {{ humanDuration(e.duration) }}</span>
                <span>🕐 {{ formatDateFull(e.event_time) }}</span>
                <button v-if="e.usage_lease" @click="openSession(e.usage_lease)"
                  class="text-indigo-400 hover:underline font-bold">phiên ▸</button>
              </div>
            </div>
            <StatusBadge v-if="e.status" :status="e.status" />
          </div>
        </div>
      </PaginatedListLayout>
    </div>

    <!-- Session drawer -->
    <div v-if="drawerOpen" class="fixed inset-0 z-50 flex justify-end" @click.self="drawerOpen = false">
      <div class="w-full max-w-md h-full bg-app-surface border-l border-app-border overflow-y-auto p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-black uppercase tracking-widest text-app-text-primary">Phiên {{ sessionLease }}</h3>
          <button @click="drawerOpen = false" class="text-app-text-muted hover:text-app-text-primary">✕</button>
        </div>
        <LoadingSpinner v-if="sessionLoading" size="md" />
        <EmptyState v-else-if="!sessionEvents.length" icon="🗂️" text="Không có sự kiện trong phiên" />
        <div v-else class="space-y-1.5">
          <div v-for="s in sessionEvents" :key="s.source_doctype + ':' + s.source_name"
            class="bg-app-bg border border-app-border rounded-lg p-2 text-xs">
            <p class="font-bold">{{ actionLabel(s.action) }} · {{ userName(s.user) }}</p>
            <p class="text-app-text-muted">{{ s.detail || '' }} · {{ formatDateFull(s.event_time) }} · {{ s.ip_address || '—' }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import SummaryCard from '../components/SummaryCard.vue'
import DateRangeFilter from '../components/DateRangeFilter.vue'
import { useRealtime } from '../composables/useRealtime.js'
import { frappeCall } from '../api/index.js'
import { formatDateFull, userName } from '../utils/format.js'

defineOptions({ name: 'AuditTimelineView' })
defineProps({ embedded: { type: Boolean, default: false } })
const { connected } = useRealtime()
// Exposed so the Activity hub's shared Refresh button can trigger a reload.
defineExpose({ reload: () => loadAll() })

const ACTION_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'CODE_REQUEST', label: 'Code' },
  { value: 'REVEAL', label: 'Reveal' },
  { value: 'COPY', label: 'Copy' },
]
const actionFilter = ref('')
const userFilter = ref('')
const accountFilter = ref('')
const ipFilter = ref('')
const anomalyOnly = ref(false)
const dateFrom = ref('')
const dateTo = ref('')

const events = ref([])
const summary = ref(null)
const total = ref(0)
const page = ref(1)
const pageSize = ref(30)
const totalPages = ref(1)
const loading = ref(false)
const exporting = ref(false)

// drawer
const drawerOpen = ref(false)
const sessionLease = ref('')
const sessionLoading = ref(false)
const sessionEvents = ref([])

let debounce = null
function filters() {
  return {
    action: actionFilter.value,
    user: userFilter.value.trim(),
    account: accountFilter.value.trim(),
    ip: ipFilter.value.trim(),
    date_from: dateFrom.value,
    date_to: dateTo.value,
    anomaly: anomalyOnly.value ? '1' : '',
  }
}

async function loadAll() {
  loading.value = true
  try {
    const res = await frappeCall('gam.api.get_audit_timeline', {
      filters: JSON.stringify(filters()), page: page.value, page_size: pageSize.value,
    })
    events.value = res.events || []
    summary.value = res.summary || null
    total.value = res.total || 0
    totalPages.value = Math.max(1, Math.ceil(total.value / pageSize.value))
  } finally {
    loading.value = false
  }
}

async function openSession(lease) {
  drawerOpen.value = true
  sessionLease.value = lease
  sessionLoading.value = true
  sessionEvents.value = []
  try {
    // reconstruct: same usage_lease (or the lease itself) across the whole stream
    const res = await frappeCall('gam.api.get_audit_timeline', {
      filters: JSON.stringify({}), page: 1, page_size: 500,
    })
    sessionEvents.value = (res.events || []).filter(
      (e) => e.usage_lease === lease || e.source_name === lease
    )
  } finally {
    sessionLoading.value = false
  }
}

async function exportCsv() {
  exporting.value = true
  try {
    const res = await frappeCall('gam.api.export_audit_timeline', { filters: JSON.stringify(filters()) })
    const rows = res.events || []
    const headers = ['time', 'user', 'action', 'account', 'game', 'platform', 'detail', 'ip', 'device', 'status', 'session']
    const csv = [headers.join(',')]
    for (const e of rows) {
      csv.push([
        e.event_time, e.user, e.action, e.account_username, e.game, e.platform,
        e.detail, e.ip_address, e.device, e.status, e.usage_lease,
      ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    }
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    exporting.value = false
  }
}

function actionLabel(a) {
  return ({ LOGIN: 'Đăng nhập/Checkout', CODE_REQUEST: 'Lấy code', REVEAL: 'Xem mật khẩu', COPY: 'Copy mật khẩu' })[a] || a
}
function actionStyle(a) {
  return ({
    LOGIN: { icon: '🔑', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    CODE_REQUEST: { icon: '📝', bg: 'bg-indigo-500/10', text: 'text-indigo-400' },
    REVEAL: { icon: '👁', bg: 'bg-amber-500/10', text: 'text-amber-400' },
    COPY: { icon: '📋', bg: 'bg-rose-500/10', text: 'text-rose-400' },
  })[a] || { icon: '•', bg: 'bg-app-bg', text: 'text-app-text-secondary' }
}
function humanDuration(sec) {
  if (sec == null) return ''
  const m = Math.round(sec / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h${m % 60}m`
}

watch([actionFilter, userFilter, accountFilter, ipFilter, dateFrom, dateTo], () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => { page.value = 1; loadAll() }, 300)
})
loadAll()
</script>
