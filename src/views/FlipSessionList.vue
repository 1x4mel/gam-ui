<template>
  <div class="h-full">
    <PaginatedListLayout
      ref="listLayout"
      :total-items="filtered.length"
      :current-page="currentPage"
      :total-pages="totalPages"
      :page-size="pageSize"
      @update:current-page="goToPage"
      @update:page-size="setPageSize"
    >
      <template #header>
        <PageHeader title="Flip Sessions" subtitle="Quản lý phiên Flip đa vòng" connected @refresh="fetchSessions" />
      </template>
      <template #filters>
        <div class="px-4 pt-3 pb-2 flex flex-wrap items-center gap-3">
          <input v-model="search" type="text" placeholder="Tìm session..." class="bg-app-surface border border-app-border rounded-xl px-4 py-2 text-sm text-app-text-primary outline-none focus:border-indigo-600 w-48">
          <select v-model="statusFilter" class="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-sm text-app-text-primary outline-none">
            <option value="">Tất cả trạng thái</option>
            <option value="Open">Open</option>
            <option value="Paused">Paused</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <div class="flex-1" />
          <router-link to="/flip/new">
            <AppButton variant="primary" size="sm">+ Tạo Session</AppButton>
          </router-link>
        </div>
      </template>
      <template #default>
        <div class="max-w-5xl mx-auto px-4 pb-6">
          <LoadingSpinner v-if="loading" text="Đang tải..." />
          <EmptyState v-else-if="paginatedItems.length === 0" icon="🔄" text="Chưa có Flip Session nào" />
          <div v-else class="space-y-3">
            <div v-for="session in paginatedItems" :key="session.name"
              class="bg-app-surface border border-app-border rounded-2xl p-4 hover:border-indigo-600/40 cursor-pointer transition-all"
              @click="goToDetail(session)">
              <div class="flex flex-wrap items-center gap-3 mb-2">
                <span :class="[statusColor(session.status), 'text-[10px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-lg border border-current/10']">{{ session.status }}</span>
                <span class="text-app-text-primary font-black text-sm">{{ session.name }}</span>
                <span class="text-app-text-muted text-xs">{{ session.game_account }}</span>
                <span v-if="session.game_context" class="text-[10px] text-app-text-muted bg-app-bg px-2 py-0.5 rounded-lg">{{ session.game_context }}</span>
                <span class="flex-1" />
                <span class="text-[10px] text-app-text-muted">{{ formatDate(session.session_date) }}</span>
              </div>
              <div class="flex items-center gap-4 text-xs text-app-text-muted">
                <span>Round: <b class="text-app-text-primary">{{ session.round_count || 0 }}</b></span>
                <span v-if="session.total_cost_input">Cost: <b class="text-app-text-primary">{{ formatMoney(session.total_cost_input, session.output_currency) }}</b></span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </PaginatedListLayout>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getList } from '../api/index.js'
import { useNotify } from '../composables/useNotify.js'
import AppButton from '../components/AppButton.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import { formatMoney, formatDate } from '../utils/format.js'
import PageHeader from '../components/PageHeader.vue'
import { usePageSize } from '../components/PaginatedListLayout.vue'
import { usePagination } from '../composables/usePagination.js'

const router = useRouter()
const { error } = useNotify()
const loading = ref(false)
const sessions = ref([])
const search = ref('')
const statusFilter = ref('')
const { pageSize, setPageSize } = usePageSize('flipSessions', 20)

const filtered = computed(() => {
  let list = sessions.value
  if (statusFilter.value) list = list.filter(s => s.status === statusFilter.value)
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.game_account || '').toLowerCase().includes(q) ||
      (s.game_context || '').toLowerCase().includes(q)
    )
  }
  return list
})

const { currentPage, totalPages, paginatedItems, goToPage } = usePagination(filtered, pageSize)

function statusColor(status) {
  const map = { Open: 'text-emerald-600', Paused: 'text-amber-600', Completed: 'text-blue-600', Cancelled: 'text-red-600' }
  return map[status] || 'text-app-text-muted'
}

function goToDetail(session) {
  router.push(`/flip/${session.name}`)
}

async function fetchSessions() {
  loading.value = true
  try {
    sessions.value = await getList('Flip Session', {
      fields: ['name', 'session_date', 'game_account', 'game_context', 'status', 'output_currency', 'total_cost_input', 'round_count', 'opened_at', 'completed_at'],
      limit: 500,
      order_by: 'session_date desc',
    })
  } catch (e) {
    error('Lỗi tải Flip Sessions: ' + (e.message || e))
  } finally {
    loading.value = false
  }
}

onMounted(() => { fetchSessions() })
</script>
