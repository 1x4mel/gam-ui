<template>
  <div class="h-full flex flex-col overflow-hidden">
    <PageHeader title="Mã Code" subtitle="Verification code mới nhận" icon="🔑" :connected="connected" @refresh="refresh" />

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <div class="flex items-center gap-1 bg-app-surface border border-app-border rounded-xl p-1">
        <button
          v-for="p in PLATFORMS_FILTER" :key="p.value"
          @click="platformFilter = p.value"
          class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition"
          :class="platformFilter === p.value ? 'bg-indigo-600 text-white' : 'text-app-text-muted hover:text-app-text-primary'"
        >
          {{ p.label }}
        </button>
      </div>
      <div class="flex items-center gap-1 bg-app-surface border border-app-border rounded-xl p-1">
        <button
          v-for="s in STATUS_FILTER" :key="s.value"
          @click="statusFilter = s.value"
          class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition"
          :class="statusFilter === s.value ? 'bg-indigo-600 text-white' : 'text-app-text-muted hover:text-app-text-primary'"
        >
          {{ s.label }}
        </button>
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
      <LoadingSpinner v-if="loading" size="lg" text="Đang tải mã..." />
      <EmptyState v-else-if="!items.length" icon="📭" text="Không có mã nào" subtext="Mã verification code mới sẽ xuất hiện ở đây." />
      <div v-else class="space-y-2 max-w-4xl mx-auto pb-4">
        <router-link
          v-for="code in items" :key="code.name" :to="`/codes/${code.name}`"
          class="block bg-app-surface border border-app-border rounded-2xl p-4 hover:border-indigo-600/50 transition"
        >
          <div class="flex items-center gap-3 flex-wrap">
            <PlatformBadge :platform="code.platform" />
            <code class="text-lg font-black font-mono tracking-[0.15em] text-app-text-primary bg-app-bg px-2.5 py-1 rounded-lg">
              {{ code.code }}
            </code>
            <StatusBadge :status="code.status" />
            <div class="ml-auto text-right">
              <p class="text-[10px] text-app-text-muted">{{ formatDate(code.received_at) }}</p>
              <p v-if="code.expires_at" class="text-[10px] font-bold" :class="expiryClass(code.expires_at)">
                {{ expiryLabel(code.expires_at) }}
              </p>
            </div>
          </div>
          <div v-if="platformEmail(code) || code.email_subject" class="mt-2 flex items-center gap-3 text-[10px] text-app-text-muted">
            <span v-if="platformEmail(code)" class="truncate">📧 {{ platformEmail(code) }}</span>
            <span v-if="code.email_subject" class="truncate italic">"{{ code.email_subject }}"</span>
          </div>
        </router-link>
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
import PlatformBadge from '../components/PlatformBadge.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { useServerPaginatedList } from '../composables/useServerPaginatedList.js'
import { useRealtime } from '../composables/useRealtime.js'
import { frappeCall } from '../api/index.js'
import { formatDate, humanizeCountdown } from '../utils/format.js'

defineOptions({ name: 'EmailListView' })

const { connected } = useRealtime()

const PLATFORMS_FILTER = [
  { value: '', label: 'Tất cả' },
  { value: 'STEAM', label: 'Steam' },
  { value: 'BATTLENET', label: 'BNet' },
  { value: 'POE', label: 'POE' },
  { value: 'OTHER', label: 'Other' },
]
const STATUS_FILTER = [
  { value: '', label: 'Tất cả' },
  { value: 'AVAILABLE', label: 'Chờ' },
  { value: 'CLAIMED', label: 'Đã lấy' },
  { value: 'EXPIRED', label: 'Hết hạn' },
]

const platformFilter = ref('')
const statusFilter = ref('')

async function fetchCodes(page, pageSize) {
  const filters = []
  if (platformFilter.value) filters.push(['platform', '=', platformFilter.value])
  if (statusFilter.value) filters.push(['status', '=', statusFilter.value])

  // L2-scoped whitelist: admins see all codes, members only their granted
  // scope. Replaces the raw REST get_list/get_count (A3).
  const res = await frappeCall('gam.api.get_email_codes', {
    filters: JSON.stringify(filters),
    limit_start: (page - 1) * pageSize,
    limit_page_length: pageSize,
    order_by: 'received_at desc',
  })
  return { data: res?.data || [], total: res?.total || 0 }
}

const {
  items, totalItems, currentPage, totalPages, pageSize, setPageSize, loading, goToPage, refresh,
} = useServerPaginatedList('gam_email_codes', fetchCodes, { defaultSize: 20, watchSources: [platformFilter, statusFilter] })

watch(platformFilter, () => refresh())
watch(statusFilter, () => refresh())

// Prefer the real platform account address (the email registered on the game
// platform, e.g. merisede3379@hotmail.com) resolved via the GAM Email link.
// Falls back to the raw inbound inbox ``email_address`` (gam@gegeteam.xyz) only
// when the code was not matched to a GAM Email doc.
function platformEmail(code) {
  return code.platform_email || code.email_address || ''
}

function expiryLabel(expiresAt) {
  return humanizeCountdown(expiresAt).label
}

function expiryClass(expiresAt) {
  const s = humanizeCountdown(expiresAt).severity
  return s === 'expired' ? 'text-red-500' : s === 'soon' ? 'text-amber-500' : 'text-emerald-500'
}
</script>
