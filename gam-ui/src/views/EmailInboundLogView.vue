<template>
  <div class="h-full flex flex-col overflow-hidden">
    <PageHeader title="Nhật ký Email đến" subtitle="Audit webhook Cloudflare → mã (OK/NO_MATCH/DUPLICATE...)" icon="📨" :connected="connected" @refresh="refresh" />

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
          v-model="queryFilter" type="text" placeholder="Lọc theo email gửi / tài khoản..."
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
      <EmptyState v-else-if="!items.length" icon="📨" text="Chưa có email nào" subtext="Webhook sẽ ghi log mỗi khi nhận email." />
      <div v-else class="max-w-4xl mx-auto pb-4 space-y-2">
        <div
          v-for="log in items" :key="log.name"
          class="bg-app-surface border border-app-border rounded-2xl overflow-hidden"
        >
          <button
            type="button"
            @click="toggle(log.name)"
            class="w-full p-4 flex items-center gap-3 flex-wrap text-left hover:bg-app-bg/40 transition"
          >
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
              :class="iconClass(log.status)"
            >
              {{ iconFor(log.status) }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-black text-app-text-primary text-sm truncate">
                {{ log.email_subject || '(không tiêu đề)' }}
              </p>
              <div class="flex items-center gap-2 text-[10px] text-app-text-muted mt-0.5 flex-wrap">
                <span v-if="log.email_from" class="truncate max-w-[180px]">📤 {{ log.email_from }}</span>
                <span v-if="log.email_account">📧 {{ log.email_account }}</span>
                <span v-if="log.matched_platform" class="font-bold text-indigo-400">🎮 {{ log.matched_platform }}</span>
                <span v-else-if="log.detected_platform" class="font-bold text-amber-400">🎮 {{ log.detected_platform }}</span>
                <span>🕐 {{ formatDateFull(log.received_at) }}</span>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <code v-if="log.email_code" class="text-xs font-black font-mono bg-app-bg px-2 py-1 rounded-lg">{{ log.email_code }}</code>
              <StatusBadge :status="log.status" />
              <span class="text-app-text-muted text-[10px] transition-transform" :class="{ 'rotate-180': expanded.has(log.name) }">▼</span>
            </div>
          </button>

          <!-- Expandable detail -->
          <div v-if="expanded.has(log.name)" class="px-4 pb-4 -mt-1 space-y-2 border-t border-app-border/60 pt-3">
            <div v-if="log.error_message" class="text-xs bg-red-500/10 text-red-400 rounded-lg p-2.5 font-medium">
              ⚠️ {{ log.error_message }}
            </div>
            <div v-if="bodies[log.name]" class="text-xs">
              <div class="flex items-center justify-between mb-1">
                <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest">Nội dung email</p>
                <div v-if="bodies[log.name].html" class="flex gap-1">
                  <button type="button" @click="bodies[log.name].mode = 'text'" class="px-2 py-0.5 rounded font-black uppercase tracking-wider text-[9px]" :class="bodies[log.name].mode === 'text' ? 'bg-indigo-600 text-white' : 'text-app-text-muted'">Văn bản</button>
                  <button type="button" @click="bodies[log.name].mode = 'html'" class="px-2 py-0.5 rounded font-black uppercase tracking-wider text-[9px]" :class="bodies[log.name].mode === 'html' ? 'bg-indigo-600 text-white' : 'text-app-text-muted'">HTML nguồn</button>
                </div>
              </div>
              <pre v-if="bodies[log.name].loading" class="whitespace-pre-wrap break-all bg-app-bg rounded-lg p-2.5 text-app-text-muted font-mono">Đang tải nội dung...</pre>
              <pre v-else-if="bodies[log.name].mode === 'text'" class="whitespace-pre-wrap break-all bg-app-bg rounded-lg p-2.5 text-app-text-secondary font-mono">{{ bodies[log.name].body || '(nội dung trống)' }}</pre>
              <pre v-else class="whitespace-pre-wrap break-all bg-app-bg rounded-lg p-2.5 text-app-text-secondary font-mono">{{ bodies[log.name].html || '(không có HTML)' }}</pre>
            </div>
            <div v-if="log.raw_snippet" class="text-xs">
              <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1">Raw snippet</p>
              <pre class="whitespace-pre-wrap break-all bg-app-bg rounded-lg p-2.5 text-app-text-secondary font-mono">{{ log.raw_snippet }}</pre>
            </div>
            <div class="grid grid-cols-2 gap-2 text-[10px] text-app-text-muted">
              <p v-if="log.message_id">Message-ID: <span class="font-mono">{{ log.message_id }}</span></p>
              <p v-if="log.gam_email">GAM Email: <span class="font-mono">{{ log.gam_email }}</span></p>
              <p v-if="log.matched_pattern">Pattern: <span class="font-mono">{{ log.matched_pattern }}</span></p>
              <p v-if="log.fetched_at">Fetched: {{ formatDateFull(log.fetched_at) }}</p>
            </div>
          </div>
        </div>
      </div>
    </PaginatedListLayout>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import DateRangeFilter from '../components/DateRangeFilter.vue'
import { useServerPaginatedList } from '../composables/useServerPaginatedList.js'
import { useRealtime } from '../composables/useRealtime.js'
import { getDoc, frappeCall } from '../api/index.js'
import { formatDateFull } from '../utils/format.js'

defineOptions({ name: 'EmailInboundLogView' })

const { connected } = useRealtime()

const STATUS_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'OK', label: 'OK' },
  { value: 'NO_MATCH', label: 'No match' },
  { value: 'DUPLICATE', label: 'Trùng' },
  { value: 'PARSE_ERROR', label: 'Lỗi parse' },
  { value: 'INACTIVE', label: 'Tắt' },
  { value: 'PAYLOAD_TRUNCATED', label: 'Cắt ngắn' },
]
const statusFilter = ref('')
const queryFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const expanded = reactive(new Set())

function toggle(name) {
  if (expanded.has(name)) {
    expanded.delete(name)
  } else {
    expanded.add(name)
    loadBody(name)
  }
}

// Lazy-load the full email body/html only when a row is expanded (keeps the list
// query light — bodies can be large). HTML is rendered as escaped source, never
// via v-html, to avoid XSS/phishing from arbitrary inbound mail.
const bodies = reactive({})
async function loadBody(name) {
  if (bodies[name]) return
  bodies[name] = { body: '', html: '', loading: true, mode: 'text' }
  try {
    const doc = await getDoc('GAM Email Inbound Log', name)
    bodies[name].body = doc.email_body || ''
    bodies[name].html = doc.email_html || ''
  } catch {
    bodies[name].body = '(không tải được nội dung)'
  } finally {
    bodies[name].loading = false
  }
}

async function fetchLogs(page, pageSize) {
  const filters = []
  if (statusFilter.value) filters.push(['status', '=', statusFilter.value])
  if (dateFrom.value) filters.push(['received_at', '>=', `${dateFrom.value} 00:00:00`])
  if (dateTo.value) filters.push(['received_at', '<=', `${dateTo.value} 23:59:59`])
  const q = queryFilter.value.trim()
  // Search across the sender + the gam email account address.
  if (q) {
    filters.push(['email_from', 'like', `%${q}%`])
  }

  // L2-scoped whitelist: admins see all logs, members only those attached to
  // an email they can access. Replaces the raw REST get_list/get_count (A3).
  const res = await frappeCall('gam.api.get_email_inbound_logs', {
    filters: JSON.stringify(filters),
    limit_start: (page - 1) * pageSize,
    limit_page_length: pageSize,
    order_by: 'received_at desc',
  })
  return { data: res?.data || [], total: res?.total || 0 }
}

const {
  items, totalItems, currentPage, totalPages, pageSize, setPageSize, loading, goToPage, refresh,
} = useServerPaginatedList('gam_email_inbound_log', fetchLogs, { defaultSize: 30, watchSources: [statusFilter, dateFrom, dateTo] })

watch(statusFilter, () => refresh())

let timer = null
function onFilterInput() {
  clearTimeout(timer)
  timer = setTimeout(() => { currentPage.value = 1; refresh() }, 350)
}

function iconFor(s) {
  if (s === 'OK') return '✅'
  if (s === 'DUPLICATE') return '♻️'
  if (s === 'NO_MATCH') return '❓'
  if (s === 'PARSE_ERROR') return '⚠️'
  if (s === 'INACTIVE') return '🚫'
  if (s === 'PAYLOAD_TRUNCATED') return '✂️'
  return '📨'
}
function iconClass(s) {
  if (s === 'OK') return 'bg-emerald-500/10'
  if (s === 'DUPLICATE') return 'bg-indigo-500/10'
  if (s === 'NO_MATCH') return 'bg-amber-500/10'
  if (s === 'PARSE_ERROR' || s === 'INACTIVE') return 'bg-red-500/10'
  if (s === 'PAYLOAD_TRUNCATED') return 'bg-yellow-500/10'
  return 'bg-app-bg'
}
</script>
