<template>
  <div class="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">📋 Lịch sử hoạt động</h3>
      <button
        @click="load" :disabled="loading"
        class="text-[10px] text-app-text-muted hover:text-app-text-primary uppercase font-black tracking-wider transition disabled:opacity-50"
      >
        {{ loading ? '...' : '↻ Làm mới' }}
      </button>
    </div>

    <LoadingSpinner v-if="loading && !events.length" size="sm" text="Đang tải hoạt động..." />
    <p v-else-if="!events.length" class="text-xs text-app-text-muted italic">Chưa có hoạt động nào.</p>

    <!-- Timeline (scroll-capped: Req #3 — scrollbar instead of growing infinitely) -->
    <ol v-else class="gam-activity-scroll relative border-l border-app-border ml-2 space-y-4 max-h-80 overflow-y-auto pr-2">
      <li v-for="e in events" :key="e.type + '-' + e.name" class="ml-4">
        <span
          class="absolute -left-[7px] flex items-center justify-center w-3.5 h-3.5 rounded-full ring-2 ring-app-surface"
          :class="iconBg(e.type)"
        >{{ '' }}</span>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm">{{ iconFor(e.type) }}</span>
          <span class="font-black text-app-text-primary text-sm">{{ e.title }}</span>
          <StatusBadge v-if="e.status && showStatus(e)" :status="statusBadgeFor(e)" size="sm" />
        </div>
        <div class="flex items-center gap-2 text-[10px] text-app-text-muted mt-1 flex-wrap">
          <span v-if="e.user">👤 {{ userName(e.user) }}</span>
          <span v-if="e.detail">· {{ e.detail }}</span>
        </div>
        <p class="text-[10px] text-app-text-muted mt-0.5">
          🕐 {{ formatDateFull(e.timestamp) }}
          <span v-if="e.end_timestamp"> → {{ formatDateFull(e.end_timestamp) }}</span>
        </p>
      </li>
    </ol>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import LoadingSpinner from './LoadingSpinner.vue'
import StatusBadge from './StatusBadge.vue'
import { frappeCall } from '../api/index.js'
import { formatDateFull, userName } from '../utils/format.js'

defineOptions({ name: 'AccountActivitySection' })

const props = defineProps({
  accountName: { type: String, required: true },
})

const loading = ref(false)
const events = ref([])

async function load() {
  if (!props.accountName) return
  loading.value = true
  try {
    const res = await frappeCall('gam.api.get_account_activity', { account: props.accountName, limit: 50 })
    events.value = res?.data || []
  } catch (e) {
    console.error('[AccountActivitySection] load failed:', e)
    events.value = []
  } finally {
    loading.value = false
  }
}

watch(() => props.accountName, load, { immediate: true })

defineExpose({ refresh: load })

function iconFor(type) {
  if (type === 'usage') return '🎮'
  if (type === 'code_request') return '📝'
  if (type === 'reveal') return '👁'
  return '•'
}

function iconBg(type) {
  if (type === 'usage') return 'bg-blue-500'
  if (type === 'code_request') return 'bg-amber-500'
  if (type === 'reveal') return 'bg-indigo-500'
  return 'bg-app-text-muted'
}

function showStatus(e) {
  // reveal status is just REVEAL/COPY — not very useful as a badge
  return e.type !== 'reveal'
}

function statusBadgeFor(e) {
  if (e.type === 'usage') return e.status
  if (e.type === 'code_request') {
    if (e.status === 'FULFILLED') return 'Used'
    if (e.status === 'NO_CODE') return 'Pending'
    if (e.status === 'EXPIRED') return 'Expired'
  }
  return e.status
}
</script>

<style scoped>
/* Slim scrollbar for the activity timeline (Req #3). */
.gam-activity-scroll::-webkit-scrollbar {
  width: 6px;
}
.gam-activity-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.gam-activity-scroll::-webkit-scrollbar-thumb {
  background: var(--app-border, rgba(0, 0, 0, 0.15));
  border-radius: 9999px;
}
.gam-activity-scroll {
  scrollbar-width: thin;
}
</style>
