<template>
  <div class="h-full flex flex-col overflow-hidden">
    <PageHeader :title="`Hồ sơ: ${userName(userNameParam)}`" subtitle="Lịch sử hoạt động của user" icon="👤" :connected="connected" @refresh="loadAll" />
    <div class="flex-1 overflow-y-auto custom-scrollbar max-w-4xl mx-auto w-full pb-8">
      <div v-if="summary" class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <SummaryCard label="Sự kiện" :value="summary.total" icon="📊" />
        <SummaryCard label="Login" :value="summary.by_action?.LOGIN || 0" icon="🔑" />
        <SummaryCard label="Lấy code" :value="summary.by_action?.CODE_REQUEST || 0" icon="📝" />
        <SummaryCard label="Reveal/Copy" :value="(summary.by_action?.REVEAL || 0) + (summary.by_action?.COPY || 0)" icon="🔓" />
      </div>
      <LoadingSpinner v-if="loading" size="lg" text="Đang tải..." />
      <EmptyState v-else-if="!events.length" icon="👤" text="User chưa có hoạt động" />
      <div v-else class="space-y-1.5">
        <div v-for="e in events" :key="e.source_doctype + ':' + e.source_name"
          class="bg-app-surface border border-app-border rounded-xl p-3 flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 bg-app-bg">{{ actionIcon(e.action) }}</div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-app-text-primary truncate">
              <span class="text-indigo-400">{{ actionLabel(e.action) }}</span>
              <span v-if="e.account_username" class="text-app-text-secondary font-normal">· {{ e.account_username }}</span>
            </p>
            <p class="text-[10px] text-app-text-muted mt-0.5 flex gap-3 flex-wrap">
              <span v-if="e.detail" class="font-mono">{{ e.detail }}</span>
              <span v-if="e.game">🎮 {{ e.game }}</span>
              <span v-if="e.ip_address">🌐 {{ e.ip_address }}</span>
              <span>🕐 {{ formatDateFull(e.event_time) }}</span>
            </p>
          </div>
          <StatusBadge v-if="e.status" :status="e.status" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import SummaryCard from '../components/SummaryCard.vue'
import { useRealtime } from '../composables/useRealtime.js'
import { frappeCall } from '../api/index.js'
import { formatDateFull, userName } from '../utils/format.js'

defineOptions({ name: 'AuditUserView' })
const route = useRoute()
const { connected } = useRealtime()
const userNameParam = computed(() => String(route.params.name || ''))

const events = ref([])
const summary = ref(null)
const loading = ref(false)

async function loadAll() {
  loading.value = true
  try {
    const res = await frappeCall('gam.api.get_audit_timeline', {
      filters: JSON.stringify({ user: userNameParam.value }), page: 1, page_size: 200,
    })
    events.value = res.events || []
    summary.value = res.summary || null
  } finally {
    loading.value = false
  }
}
function actionLabel(a) {
  return ({ LOGIN: 'Đăng nhập/Checkout', CODE_REQUEST: 'Lấy code', REVEAL: 'Xem mật khẩu', COPY: 'Copy mật khẩu' })[a] || a
}
function actionIcon(a) {
  return ({ LOGIN: '🔑', CODE_REQUEST: '📝', REVEAL: '👁', COPY: '📋' })[a] || '•'
}
loadAll()
</script>
