<template>
  <div class="h-full">
  <PaginatedListLayout
    ref="listLayout"
    :total-items="currentRows.length"
    :current-page="currentPage"
    :total-pages="totalPages"
    :page-size="pageSize"
    :self-scroll="true"
    @update:current-page="goToPage"
    @update:page-size="setPageSize"
  >
    <template #header>
      <PageHeader
        title="Nhật ký hệ thống"
        subtitle="Luồng công việc, Hoạt động, Lịch sử, Lỗi"
        :connected="connected"
        @refresh="loadTab(activeTab)"
      />
    </template>

    <template #filters>
      <UnderlineTab
        v-model="activeTab"
        :tabs="tabs"
        @update:model-value="switchTab"
        class="mb-4 sm:mb-6"
      />

      <div class="flex flex-wrap items-center gap-3 sm:gap-4 mb-4 sm:mb-6 overflow-x-hidden">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="searchPlaceholder"
          class="w-full sm:w-64 px-3 sm:px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary placeholder-app-text-muted/80 outline-none focus:border-indigo-500 transition shadow-sm"
          @input="debouncedLoad"
        />
        <DateRangeFilter
          :date-from="dateFrom"
          :date-to="dateTo"
          @update:date-from="dateFrom = $event; reloadCurrent()"
          @update:date-to="dateTo = $event; reloadCurrent()"
        />
        <select
          v-if="activeTab === 'workflow'"
          v-model="filterDoctype"
          class="px-3 sm:px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500 transition shadow-sm cursor-pointer appearance-none min-w-0 sm:min-w-[140px]"
          @change="reloadCurrent"
        >
          <option value="">Tất cả loại tài liệu</option>
          <option value="Sell Order">Đơn bán</option>
          <option value="Buy Order">Đơn mua</option>
          <option value="Inventory Position">Vị trí kho</option>
          <option value="Order Evidence">Bằng chứng đơn hàng</option>
          <option value="Customer">Khách hàng</option>
          <option value="Supplier">Nhà cung cấp</option>
          <option value="Channel">Kênh</option>
          <option value="Game Account">Tài khoản Game</option>
          <option value="Currency Item">Mặt hàng</option>
        </select>
        <select
          v-if="activeTab === 'activity'"
          v-model="filterOp"
          class="px-3 sm:px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500 transition shadow-sm cursor-pointer appearance-none min-w-0 sm:min-w-[140px]"
          @change="reloadCurrent"
        >
          <option value="">Tất cả thao tác</option>
          <option value="Login">Đăng nhập</option>
          <option value="Logout">Đăng xuất</option>
        </select>
        <select
          v-if="activeTab === 'workflow'"
          v-model="filterStatus"
          class="px-3 sm:px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500 transition shadow-sm cursor-pointer appearance-none min-w-0 sm:min-w-[140px]"
          @change="reloadCurrent"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="Open">Mở</option>
          <option value="Completed">Hoàn thành</option>
        </select>
      </div>
    </template>

    <div v-if="loading && currentRows.length === 0" class="h-full flex items-center justify-center">
      <LoadingSpinner text="Đang truy xuất nhật ký..." />
    </div>
    <div v-else-if="currentRows.length === 0" class="h-full flex items-center justify-center">
      <EmptyState icon="📋" text="Không tìm thấy dữ liệu nhật ký phù hợp" />
    </div>

    <!-- WORKFLOW LOG -->
    <template v-else-if="activeTab === 'workflow'">
    <div class="hidden md:block mx-2 sm:mx-4">
      <ResponsiveTable :min-width="700" outer-class="shadow-sm" rounded="3xl">
        <template #header>
          <th class="text-left py-4 px-3 sm:px-6">Thời gian</th>
          <th class="text-left py-4 px-3">Tài liệu</th>
          <th class="text-left py-4 px-3">Trạng thái luồng</th>
          <th class="text-left py-4 px-3">Hoàn thành bởi</th>
          <th class="text-left py-4 px-3 sm:px-6">Trạng thái</th>
        </template>
        <template #body>
          <tr v-for="row in paginatedItems" :key="row.name" class="hover:bg-indigo-600/[0.02] transition-colors group">
            <td class="py-4 px-3 sm:px-6 text-app-text-muted text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{{ formatDate(row.creation) }}</td>
            <td class="py-4 px-3 text-[11px] font-black">
              <span class="text-indigo-600 uppercase">{{ row.reference_doctype }}</span>
              <span class="text-app-text-secondary ml-1.5 opacity-60">{{ row.reference_name }}</span>
            </td>
            <td class="py-4 px-3">
              <span class="text-[9px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-lg bg-orange-600/10 text-orange-600 border border-orange-600/10 shadow-sm">{{ row.workflow_state }}</span>
            </td>
            <td class="py-4 px-3 text-app-text-primary text-[11px] font-bold">{{ userName(row.completed_by) || 'Hệ thống' }}</td>
            <td class="py-4 px-3 sm:px-6">
              <span :class="workflowRowStatus(row)" class="text-[9px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-lg shadow-sm">{{ workflowRowStatusLabel(row) }}</span>
            </td>
          </tr>
        </template>
      </ResponsiveTable>
    </div>
    <LoadMoreButton :has-more="hasMore.workflow" :loading="loading" :item-count="currentRows.length" @load-more="loadMore" class="mx-2 sm:mx-4" />
    <!-- Mobile Cards -->
    <div data-scroll class="md:hidden h-full overflow-auto custom-scrollbar px-3 sm:px-4 space-y-2">
      <div v-for="row in paginatedItems" :key="row.name"
        class="bg-app-surface border border-app-border rounded-2xl p-3 shadow-sm"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="text-indigo-600 text-[10px] font-black uppercase tracking-tight">{{ row.reference_doctype }}</span>
          <span class="text-app-text-muted text-[9px] font-black uppercase tracking-tighter">{{ formatDate(row.creation).split(' ')[0] }}</span>
        </div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-app-text-secondary text-[11px] font-medium truncate">{{ row.reference_name }}</span>
          <span class="text-[9px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-lg bg-orange-600/10 text-orange-600 border border-orange-600/10 whitespace-nowrap">{{ row.workflow_state }}</span>
        </div>
        <div class="flex items-center justify-between text-[10px]">
          <span class="text-app-text-primary font-bold">{{ userName(row.completed_by) || 'Hệ thống' }}</span>
          <span :class="workflowRowStatus(row)" class="text-[9px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-lg shadow-sm">{{ workflowRowStatusLabel(row) }}</span>
        </div>
      </div>
      <LoadMoreButton :has-more="hasMore.workflow" :loading="loading" :item-count="currentRows.length" @load-more="loadMore" />
    </div>
    </template>

    <!-- ACTIVITY LOG -->
    <template v-else-if="activeTab === 'activity'">
    <div class="hidden md:block mx-2 sm:mx-4">
      <ResponsiveTable :min-width="700" outer-class="shadow-sm" rounded="3xl">
        <template #header>
          <th class="text-left py-4 px-3 sm:px-6">Thời gian</th>
          <th class="text-left py-4 px-3">Người dùng</th>
          <th class="text-left py-4 px-3">Chủ đề</th>
          <th class="text-left py-4 px-3">Tham chiếu</th>
          <th class="text-left py-4 px-3">Thao tác</th>
          <th class="text-left py-4 px-3 sm:px-6">Trạng thái</th>
        </template>
        <template #body>
          <tr v-for="row in paginatedItems" :key="row.name" class="hover:bg-indigo-600/[0.02] transition-colors group">
            <td class="py-4 px-3 sm:px-6 text-app-text-muted text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{{ formatDate(row.communication_date || row.creation) }}</td>
            <td class="py-4 px-3 text-app-text-primary text-[11px] font-black underline decoration-indigo-600/20 underline-offset-4">{{ userName(row.user) }}</td>
            <td class="py-4 px-3 text-app-text-secondary text-[11px] font-medium max-w-xs truncate italic">"{{ row.subject }}"</td>
            <td class="py-4 px-3 text-[10px] font-black whitespace-nowrap">
              <span v-if="row.reference_doctype" class="text-indigo-600 uppercase">{{ row.reference_doctype }}</span>
              <span v-if="row.reference_name" class="text-app-text-muted ml-1.5 opacity-60">{{ row.reference_name }}</span>
            </td>
            <td class="py-4 px-3">
              <span v-if="row.operation" class="text-[9px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-lg bg-blue-600/10 text-blue-600 border border-blue-600/10">{{ row.operation }}</span>
              <span v-else class="text-app-text-muted opacity-30">—</span>
            </td>
            <td class="py-4 px-3 sm:px-6">
              <span :class="activityStatusColor(row.status)" class="text-[9px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-lg shadow-sm border border-current/10">{{ row.status || '—' }}</span>
            </td>
          </tr>
        </template>
      </ResponsiveTable>
    </div>
    <LoadMoreButton :has-more="hasMore.activity" :loading="loading" :item-count="currentRows.length" @load-more="loadMore" class="mx-2 sm:mx-4" />
    <!-- Mobile Cards -->
    <div data-scroll class="md:hidden h-full overflow-auto custom-scrollbar px-3 sm:px-4 space-y-2">
      <div v-for="row in paginatedItems" :key="row.name"
        class="bg-app-surface border border-app-border rounded-2xl p-3 shadow-sm"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="text-app-text-primary text-[11px] font-black">{{ userName(row.user) }}</span>
          <span class="text-app-text-muted text-[9px] font-black uppercase tracking-tighter">{{ formatDate(row.communication_date || row.creation).split(' ')[0] }}</span>
        </div>
        <p class="text-app-text-secondary text-[11px] font-medium italic truncate mb-2">"{{ row.subject }}"</p>
        <div class="flex items-center justify-between text-[10px]">
          <span v-if="row.reference_doctype" class="text-indigo-600 font-black uppercase tracking-tight">{{ row.reference_doctype }}</span>
          <span :class="activityStatusColor(row.status)" class="text-[9px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-lg shadow-sm border border-current/10">{{ row.status || '—' }}</span>
        </div>
      </div>
      <LoadMoreButton :has-more="hasMore.activity" :loading="loading" :item-count="currentRows.length" @load-more="loadMore" />
    </div>
    </template>

    <!-- VERSION HISTORY -->
    <div v-else-if="activeTab === 'version'" data-scroll class="h-full overflow-auto custom-scrollbar mx-2 sm:mx-4">
        <div class="space-y-4">
          <div
            v-for="row in paginatedItems"
            :key="row.name"
            class="bg-app-surface border border-app-border rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
          >
            <div
              class="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 px-4 sm:px-8 py-4 sm:py-5 cursor-pointer hover:bg-indigo-600/[0.02] transition-all group"
              @click="toggleExpand(row.name)"
            >
              <div class="flex flex-col gap-1 shrink-0">
                <span class="text-app-text-muted text-[10px] font-black uppercase tracking-widest">{{ formatDate(row.creation).split(' ')[0] }}</span>
                <span class="text-app-text-muted text-[10px] font-black opacity-60">{{ formatDate(row.creation).split(' ')[1] }}</span>
              </div>
              <div class="flex flex-col gap-1 shrink-0">
                <span class="text-app-text-primary text-[11px] font-black truncate">{{ userName(row.owner) }}</span>
                <span class="text-app-text-muted text-[9px] font-black uppercase tracking-widest opacity-60">Người sửa</span>
              </div>
              <div class="flex flex-col gap-1 shrink-0">
                <span class="text-indigo-600 text-[11px] font-black uppercase tracking-tight">{{ row.ref_doctype }}</span>
                <span class="text-app-text-secondary text-[11px] font-medium opacity-60 truncate">{{ row.docname }}</span>
              </div>
              <div class="flex-1 flex justify-end items-center gap-6">
                <span class="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-emerald-600/10 text-emerald-600 border border-emerald-600/10 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">{{ countChanges(row.data) }} Thay đổi</span>
                <span class="text-app-text-muted text-xs group-hover:text-indigo-600 transition-colors transform group-hover:translate-y-0.5">{{ expandedRows.has(row.name) ? '▲' : '▼' }}</span>
              </div>
            </div>
            <div v-if="expandedRows.has(row.name)" class="border-t border-app-border px-4 sm:px-10 py-4 sm:py-8 bg-app-bg/20 space-y-3 scale-in-top">
              <div v-if="parseChanges(row.data).length === 0" class="text-app-text-muted text-xs font-black uppercase tracking-widest text-center py-4 opacity-60 italic">Không có thay đổi nào được ghi nhận</div>
              <div v-for="(c, i) in parseChanges(row.data)" :key="i" class="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-6 py-3 px-3 sm:px-6 rounded-xl sm:rounded-2xl bg-app-surface border border-app-border/50 shadow-sm hover:border-indigo-600/20 transition-all">
                <div class="shrink-0 sm:w-40">
                  <span class="text-indigo-600 text-[10px] font-black uppercase tracking-widest block">{{ c.field }}</span>
                  <span class="text-[8px] text-app-text-muted font-black uppercase tracking-[0.2em] opacity-60 mt-1">Thuộc tính</span>
                </div>
                <div class="flex-1 min-w-0 flex items-center gap-4">
                  <div class="flex-1 min-w-0 bg-red-600/[0.03] border border-red-600/10 px-4 py-2 rounded-xl">
                    <span class="text-red-700 text-[11px] font-bold block truncate">{{ c.old || '(TRỐNG)' }}</span>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-app-text-muted opacity-30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  <div class="flex-1 min-w-0 bg-emerald-600/[0.03] border border-emerald-600/10 px-4 py-2 rounded-xl">
                    <span class="text-emerald-700 text-[11px] font-black block truncate">{{ c.new || '(TRỐNG)' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <LoadMoreButton :has-more="hasMore.version" :loading="loading" :item-count="currentRows.length" @load-more="loadMore" />
    </div>

    <!-- ERROR LOG -->
    <div v-else-if="activeTab === 'error'" data-scroll class="h-full overflow-auto custom-scrollbar mx-2 sm:mx-4">
        <div class="space-y-4">
          <div
            v-for="row in paginatedItems"
            :key="row.name"
            class="bg-app-surface border border-app-border rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
          >
            <div
              class="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 px-4 sm:px-8 py-4 sm:py-5 cursor-pointer hover:bg-red-600/[0.02] transition-all group"
              @click="toggleExpand(row.name)"
            >
              <div class="flex flex-col gap-1 shrink-0">
                <span class="text-app-text-muted text-[10px] font-black uppercase tracking-widest">{{ formatDate(row.creation).split(' ')[0] }}</span>
                <span class="text-app-text-muted text-[10px] font-black opacity-60">{{ formatDate(row.creation).split(' ')[1] }}</span>
              </div>
              <span class="text-red-600 text-[11px] font-black flex-1 truncate font-mono uppercase tracking-tight">{{ row.method }}</span>
              <div v-if="row.reference_doctype" class="flex flex-col gap-1 shrink-0 sm:items-end">
                <span class="text-indigo-600 text-[10px] font-black uppercase tracking-tight">{{ row.reference_doctype }}</span>
                <span class="text-app-text-muted text-[10px] font-bold opacity-60">{{ row.reference_name }}</span>
              </div>
              <span class="text-app-text-muted text-xs group-hover:text-red-600 transition-colors transform group-hover:translate-y-0.5">{{ expandedRows.has(row.name) ? '▲' : '▼' }}</span>
            </div>
            <div v-if="expandedRows.has(row.name)" class="border-t border-red-600/10 px-4 sm:px-8 py-4 sm:py-8 bg-red-600/[0.02] scale-in-top">
              <div class="bg-app-bg border border-red-600/10 rounded-xl sm:rounded-[2rem] p-4 sm:p-8 shadow-inner">
                <h4 class="text-[10px] font-black text-red-600 uppercase tracking-[0.3em] mb-4 flex items-center gap-3">
                  <span class="p-2 bg-red-600/10 rounded-xl">🚫</span>
                  Dấu vết lỗi / Tín hiệu lỗi
                </h4>
                <pre class="text-[11px] text-red-700/80 whitespace-pre-wrap break-all max-h-96 overflow-y-auto font-mono leading-relaxed bg-red-600/[0.02] p-3 sm:p-6 rounded-xl sm:rounded-2xl border border-red-600/5">{{ row.error }}</pre>
              </div>
            </div>
          </div>
        </div>
        <LoadMoreButton :has-more="hasMore.error" :loading="loading" :item-count="currentRows.length" @load-more="loadMore" />
    </div>
  </PaginatedListLayout>
  </div>
</template>

<script setup>
defineOptions({ name: 'SystemLogsView' })
import { ref, computed, watch, onActivated } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getList } from '../api/index.js'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import DateRangeFilter from '../components/DateRangeFilter.vue'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import LoadMoreButton from '../components/LoadMoreButton.vue'
import UnderlineTab from '../components/UnderlineTab.vue'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import { usePaginatedList } from '../composables/usePaginatedList.js'
import { useRealtimeSubscriptions } from '../composables/useRealtimeSubscriptions.js'
import { useUrlSync } from '../composables/useOrderUrlSync.js'
import { debounce } from 'lodash-es'
import { formatDateFull as formatDate, userName } from '../utils/format.js'

const router = useRouter()
const route = useRoute()

const SERVER_PAGE_SIZE = 100

const tabs = [
  { key: 'workflow', icon: '🔄', label: 'Luồng công việc' },
  { key: 'activity', icon: '📝', label: 'Hoạt động' },
  { key: 'version',  icon: '📄', label: 'Lịch sử thay đổi' },
  { key: 'error',    icon: '❌', label: 'Nhật ký lỗi' },
]

const validTabs = ['workflow', 'activity', 'version', 'error']
const activeTab = ref(validTabs.includes(route.query.tab) ? route.query.tab : 'workflow')
const loading = ref(false)
const searchQuery = ref('')
const filterOp = ref('')
const filterDoctype = ref('')
const filterStatus = ref('')
const dateFrom = ref('')
const dateTo = ref('')

useUrlSync({
  routeNames: ['SystemLogsView'],
  params: { searchQuery, filterOp, filterDoctype, filterStatus, dateFrom, dateTo },
  queryMap: { searchQuery: 'q', filterOp: 'op', filterDoctype: 'doctype', filterStatus: 'status', dateFrom: 'from', dateTo: 'to' },
})

watch(() => route.query, (q) => {
  const tab = q.tab || 'workflow'
  if (validTabs.includes(tab)) activeTab.value = tab
})

const dataMap = {
  workflow: ref([]),
  activity: ref([]),
  version: ref([]),
  error: ref([]),
}

const offsetMap = { workflow: 0, activity: 0, version: 0, error: 0 }
const hasMore = ref({ workflow: false, activity: false, version: false, error: false })
const remainCount = ref({ workflow: 0, activity: 0, version: 0, error: 0 })

const expandedRows = ref(new Set())

const currentRows = computed(() => dataMap[activeTab.value]?.value ?? [])

const { pageSize, setPageSize, currentPage, totalPages, paginatedItems, goToPage, listLayout, getScrollContainer, setLastViewed, handleScrollRestoration } = usePaginatedList('system-logs', currentRows)

const searchPlaceholder = computed(() => {
  if (activeTab.value === 'activity') return 'Tìm theo chủ đề...'
  if (activeTab.value === 'version') return 'Tìm theo tên tài liệu...'
  if (activeTab.value === 'workflow') return 'Tìm theo tên tài liệu...'
  return 'Tìm theo phương thức...'
})

function activityStatusColor(status) {
  if (status === 'Success') return 'bg-emerald-600/10 text-emerald-600'
  if (status === 'Failed') return 'bg-red-600/10 text-red-600'
  return 'bg-app-bg text-app-text-muted opacity-40'
}

const terminalStates = ['Completed', 'Failed', 'Cancelled']

function workflowRowStatus(row) {
  if (row.status === 'Completed') return 'bg-emerald-600/10 text-emerald-600'
  if (terminalStates.includes(row.workflow_state)) return 'bg-emerald-600/10 text-emerald-600'
  return 'bg-yellow-600/10 text-yellow-600'
}

function workflowRowStatusLabel(row) {
  if (row.status === 'Completed') return 'Hoàn thành'
  if (terminalStates.includes(row.workflow_state)) return 'Hoàn thành'
  return 'Mở'
}

function parseChanges(dataStr) {
  if (!dataStr) return []
  try {
    const data = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr
    return (data.changed || []).map(([field, oldVal, newVal]) => ({ field, old: String(oldVal), new: String(newVal) }))
  } catch {
    return []
  }
}

function countChanges(dataStr) {
  return parseChanges(dataStr).length
}

function toggleExpand(name) {
  const s = new Set(expandedRows.value)
  if (s.has(name)) s.delete(name)
  else s.add(name)
  expandedRows.value = s
}

function buildFilters(tab) {
  const filters = []
  if (searchQuery.value) {
    const q = `%${searchQuery.value}%`
    if (tab === 'activity') filters.push(['subject', 'like', q])
    else if (tab === 'version') filters.push(['docname', 'like', q])
    else if (tab === 'workflow') filters.push(['reference_name', 'like', q])
    else if (tab === 'error') filters.push(['method', 'like', q])
  }
  if (filterDoctype.value && tab === 'workflow') filters.push(['reference_doctype', '=', filterDoctype.value])
  if (tab === 'activity' && filterOp.value) filters.push(['operation', '=', filterOp.value])
  if (tab === 'workflow' && filterStatus.value) filters.push(['status', '=', filterStatus.value])
  if (dateFrom.value) filters.push(['creation', '>=', dateFrom.value.replace('T', ' ')])
  if (dateTo.value) filters.push(['creation', '<=', dateTo.value.replace('T', ' ') + ':59'])
  return filters.length ? filters : undefined
}

function switchTab(key) {
  activeTab.value = key
  router.push({ query: { tab: key } })
  searchQuery.value = ''
  filterDoctype.value = ''
  filterOp.value = ''
  filterStatus.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  expandedRows.value = new Set()
  offsetMap[key] = 0
  hasMore.value[key] = false
  remainCount.value[key] = 0
  dataMap[key].value = []
  loadTab(key)
}

function reloadCurrent() {
  const key = activeTab.value
  offsetMap[key] = 0
  hasMore.value[key] = false
  remainCount.value[key] = 0
  dataMap[key].value = []
  loadTab(key)
}

const debouncedLoad = debounce(() => reloadCurrent(), 400)

async function loadTab(tab) {
  loading.value = true
  const offset = offsetMap[tab]
  try {
    const filters = buildFilters(tab)
    const limit = SERVER_PAGE_SIZE + 1

    let result
    if (tab === 'activity') {
      result = await getList('Activity Log', {
        fields: ['name', 'subject', 'user', 'full_name', 'operation', 'status', 'reference_doctype', 'reference_name', 'communication_date', 'creation'],
        filters, limit, offset,
      })
    } else if (tab === 'version') {
      result = await getList('Version', {
        fields: ['name', 'ref_doctype', 'docname', 'data', 'owner', 'creation'],
        filters, limit, offset,
      })
    } else if (tab === 'workflow') {
      result = await getList('Workflow Action', {
        fields: ['name', 'reference_doctype', 'reference_name', 'workflow_state', 'completed_by', 'status', 'creation'],
        filters, limit, offset,
      })
    } else if (tab === 'error') {
      result = await getList('Error Log', {
        fields: ['name', 'method', 'error', 'reference_doctype', 'reference_name', 'creation'],
        filters, limit, offset,
      })
    }

    if (result) {
      const hasMoreRows = result.length > SERVER_PAGE_SIZE
      if (hasMoreRows) result = result.slice(0, SERVER_PAGE_SIZE)

      if (offset === 0) {
        dataMap[tab].value = result
      } else {
        dataMap[tab].value = [...dataMap[tab].value, ...result]
      }

      offsetMap[tab] = dataMap[tab].value.length
      hasMore.value[tab] = hasMoreRows
      remainCount.value[tab] = hasMoreRows ? '+' : 0
    }
  } catch (e) {
    console.error('Failed to load logs:', e)
  } finally {
    loading.value = false
  }
}

function loadMore() {
  loadTab(activeTab.value)
}

function onRealtimeUpdate() {
  reloadCurrent()
}

const { connected } = useRealtimeSubscriptions(
  {
    'Activity Log': onRealtimeUpdate,
    'Version': onRealtimeUpdate,
    'Workflow Action': onRealtimeUpdate,
    'Error Log': onRealtimeUpdate,
  },
  { onMount: () => loadTab('workflow') }
)

onActivated(() => {
  loadTab(activeTab.value)
})
</script>
