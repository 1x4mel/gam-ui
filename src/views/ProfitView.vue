<template>
  <div class="h-full">
  <PaginatedListLayout
    ref="listLayout"
    :total-items="totalItems"
    :current-page="currentPage"
    :total-pages="totalPages"
    :page-size="pageSize"
    :self-scroll="true"
    @update:current-page="goToPage"
    @update:page-size="setPageSize"
  >
    <template #header>
      <PageHeader
        title="Lợi nhuận"
        subtitle="Bảng chốt lãi lỗ vận hành"
        icon="💰"
        :connected="connected"
        @refresh="onRefresh"
      />
    </template>

    <template #filters>
      <div class="flex flex-wrap items-center gap-3 sm:gap-4 mb-4 sm:mb-6 overflow-x-hidden">
        <UnderlineTab
          :model-value="activeTab"
          :tabs="[
            { key: 'detail', label: 'Chi tiết' },
            { key: 'by_item', label: 'Theo mặt hàng' },
          ]"
          @update:model-value="switchTab"
        />
      </div>

      <div class="flex flex-wrap items-center gap-3 sm:gap-4 mb-4 sm:mb-6 overflow-x-hidden">
        <select v-model="filterGame" class="px-3 sm:px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500 transition shadow-sm cursor-pointer appearance-none min-w-0 sm:min-w-[140px]">
          <option value="">Toàn bộ danh mục</option>
          <option v-for="g in games" :key="g" :value="g">{{ g }}</option>
        </select>

        <DateRangeFilter
          :date-from="filterFrom"
          :date-to="filterTo"
          @update:date-from="filterFrom = $event; onFilterChange()"
          @update:date-to="filterTo = $event; onFilterChange()"
        />
      </div>

      <!-- Summary Grid: per-currency cards -->
      <div class="max-w-6xl mx-auto">
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 mb-10">
        <div v-for="ct in currencyTotals" :key="ct.currency"
          class="bg-app-surface border border-app-border rounded-[2rem] p-4 sm:p-6 shadow-sm hover:shadow-xl transition-all duration-500">
          <div class="flex items-center justify-between mb-3">
            <p class="text-app-text-muted text-[10px] font-black uppercase tracking-widest opacity-40">{{ ct.currency }} Tổng</p>
            <span class="text-[9px] text-app-text-muted font-black opacity-30">{{ ct.snapshot_count || 0 }} PS / {{ ct.order_count || 0 }} đơn</span>
          </div>
          <p class="text-lg sm:text-2xl font-black font-mono tracking-tighter mb-3" :class="ct.total_profit >= 0 ? 'text-emerald-600' : 'text-red-500'">
            {{ formatMoney(ct.total_profit, ct.currency) }}
          </p>
          <div class="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <p class="text-app-text-muted font-black uppercase tracking-widest mb-0.5 opacity-40">Doanh thu</p>
              <p class="text-app-text-primary font-mono font-bold">{{ formatMoney(ct.total_revenue, ct.currency) }}</p>
            </div>
            <div>
              <p class="text-app-text-muted font-black uppercase tracking-widest mb-0.5 opacity-40">Giá vốn</p>
              <p class="text-orange-500 font-mono font-bold">{{ formatMoney(ct.total_cogs, ct.currency) }}</p>
            </div>
            <div>
              <p class="text-app-text-muted font-black uppercase tracking-widest mb-0.5 opacity-40">Chi phí</p>
              <p class="text-app-text-muted font-mono font-bold">{{ formatMoney(ct.total_fees, ct.currency) }}</p>
            </div>
            <div>
              <p class="text-app-text-muted font-black uppercase tracking-widest mb-0.5 opacity-40">Biên LN</p>
              <p class="font-mono font-black" :class="ct.margin_pct >= 0 ? 'text-emerald-600' : 'text-red-500'">
                {{ ct.margin_pct.toFixed(1) }}%
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </template>

    <div v-if="loading" class="h-full flex items-center justify-center">
      <LoadingSpinner />
    </div>

    <template v-else-if="totalItems === 0">
      <div class="h-full flex items-center justify-center">
        <EmptyState icon="💰" text="Không có dữ liệu lợi nhuận cho bộ lọc hiện tại" />
      </div>
    </template>

    <!-- TAB: Chi tiết (per-order) -->
    <template v-else-if="activeTab === 'detail'">
    <ResponsiveTable
      :min-width="800"
      outer-class="mx-2 sm:mx-4 shadow-sm"
      rounded="2xl sm:[2.5rem]"
      mobile-class="max-w-6xl mx-auto px-4 space-y-3"
    >
      <template #header>
        <th class="text-left py-6 px-4 sm:px-8 cursor-pointer hover:text-indigo-600 transition-colors" @click="sortBy('sell_order')">Mã đơn</th>
        <th class="text-left py-6 px-4 sm:px-8">Mặt hàng</th>
        <th class="text-right py-6 px-4 sm:px-8">TT</th>
        <th class="text-right py-6 px-4 sm:px-8 cursor-pointer hover:text-indigo-600 transition-colors" @click="sortBy('revenue_native')">Doanh thu</th>
        <th class="text-right py-6 px-4 sm:px-8 cursor-pointer hover:text-indigo-600 transition-colors" @click="sortBy('cogs_native')">Giá vốn</th>
        <th class="text-right py-6 px-4 sm:px-8">Chi phí</th>
        <th class="text-right py-6 px-4 sm:px-8 cursor-pointer hover:text-indigo-600 transition-colors" @click="sortBy('profit_native')">Lợi nhuận ròng</th>
        <th class="text-right py-6 px-4 sm:px-8 cursor-pointer hover:text-indigo-600 transition-colors" @click="sortBy('margin_pct')">Biên LN</th>
        <th class="text-right py-6 px-4 sm:px-8">Ngày chốt</th>
      </template>
      <template #body>
        <tr v-for="s in paginatedItems" :key="s.name"
          :id="s.sell_order"
          class="hover:bg-app-bg/50 transition-all duration-300 cursor-pointer group"
          @click="goToDetail(s.sell_order)">
          <td class="py-5 px-4 sm:px-8">
            <span class="text-indigo-600 font-black text-sm tracking-tight border-b border-indigo-600/20 group-hover:border-indigo-600 transition-all">{{ s.sell_order }}</span>
          </td>
          <td class="py-5 px-4 sm:px-8">
             <p class="text-app-text-primary font-black text-sm tracking-tight">{{ currencyName(s.currency_item, currencyItemMap) }}</p>
          </td>
          <td class="py-5 px-4 sm:px-8 text-right">
            <span class="text-[9px] font-black text-app-text-muted uppercase tracking-widest bg-app-bg px-1.5 py-0.5 rounded">{{ s.sell_currency || '—' }}</span>
          </td>
          <td class="py-5 px-4 sm:px-8 text-right font-mono text-app-text-primary font-black tracking-tighter">{{ formatMoney(s.revenue_native, s.sell_currency) }}</td>
          <td class="py-5 px-4 sm:px-8 text-right font-mono text-orange-500 font-black tracking-tighter opacity-80">{{ formatMoney(s.cogs_native, s.sell_currency) }}</td>
          <td class="py-5 px-4 sm:px-8 text-right font-mono text-app-text-muted font-black text-xs tracking-tighter">
            {{ formatMoney((s.channel_fee_native || 0) + (s.trader2_cost_native || 0) + (s.other_cost_native || 0), s.sell_currency) }}
          </td>
          <td class="py-5 px-4 sm:px-8 text-right font-mono font-black tracking-tighter text-base"
            :class="(s.profit_native || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'">
            {{ formatMoney(s.profit_native, s.sell_currency) }}
          </td>
          <td class="py-5 px-4 sm:px-8 text-right font-mono font-black"
            :class="s.margin_pct >= 0 ? 'text-emerald-600' : 'text-red-500'">
            {{ Number(s.margin_pct || 0).toFixed(1) }}%
          </td>
          <td class="py-5 px-4 sm:px-8 text-right">
             <p class="text-app-text-muted font-black uppercase text-[9px] tracking-tighter opacity-50">{{ formatDate(s.creation) }}</p>
          </td>
        </tr>
      </template>
      <template #mobile>
        <div
          v-for="s in paginatedItems" :key="s.name"
          class="bg-app-surface border border-app-border rounded-2xl p-4 shadow-sm active:scale-[0.99] transition-all cursor-pointer"
          @click="goToDetail(s.sell_order)"
        >
          <div class="flex items-center justify-between mb-3">
            <span class="text-indigo-600 font-black text-sm tracking-tight">{{ s.sell_order }}</span>
            <span class="text-app-text-muted text-[9px] font-black uppercase tracking-wider opacity-50">{{ formatDate(s.creation) }}</span>
          </div>
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="text-app-text-primary font-bold text-xs">{{ currencyName(s.currency_item, currencyItemMap) }}</span>
              <span class="text-[9px] font-black text-app-text-muted uppercase tracking-widest bg-app-bg px-1.5 py-0.5 rounded">{{ s.sell_currency }}</span>
            </div>
            <span class="font-mono font-black text-base" :class="(s.profit_native || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'">{{ formatMoney(s.profit_native, s.sell_currency) }}</span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <p class="text-app-text-muted font-black uppercase tracking-widest mb-0.5">Doanh thu</p>
              <p class="text-app-text-primary font-mono font-bold">{{ formatMoney(s.revenue_native, s.sell_currency) }}</p>
            </div>
            <div>
              <p class="text-app-text-muted font-black uppercase tracking-widest mb-0.5">COGS</p>
              <p class="text-orange-500 font-mono font-bold">{{ formatMoney(s.cogs_native, s.sell_currency) }}</p>
            </div>
            <div>
              <p class="text-app-text-muted font-black uppercase tracking-widest mb-0.5">Lợi suất</p>
              <p class="font-mono font-black" :class="s.margin_pct >= 0 ? 'text-emerald-600' : 'text-red-500'">{{ Number(s.margin_pct || 0).toFixed(1) }}%</p>
            </div>
          </div>
        </div>
      </template>
    </ResponsiveTable>
    </template>

    <!-- TAB: Theo mặt hàng (aggregated) -->
    <template v-else-if="activeTab === 'by_item'">
    <ResponsiveTable
      :min-width="900"
      outer-class="mx-2 sm:mx-4 shadow-sm"
      rounded="2xl sm:[2.5rem]"
      mobile-class="max-w-6xl mx-auto px-4 space-y-3"
    >
      <template #header>
        <th class="text-left py-6 px-4 sm:px-8">Mặt hàng</th>
        <th class="text-left py-6 px-4 sm:px-8">Game</th>
        <th class="text-right py-6 px-4 sm:px-8">TT</th>
        <th class="text-right py-6 px-4 sm:px-8">Doanh thu</th>
        <th class="text-right py-6 px-4 sm:px-8">Giá vốn đã bán</th>
        <th class="text-right py-6 px-4 sm:px-8">Lợi nhuận</th>
        <th class="text-right py-6 px-4 sm:px-8">Biên LN</th>
        <th class="text-right py-6 px-4 sm:px-8">SL bán</th>
      </template>
      <template #body>
        <tr v-for="item in paginatedItems" :key="item.currency_item + item.sell_currency"
          class="hover:bg-app-bg/50 transition-all duration-300">
          <td class="py-5 px-4 sm:px-8">
            <p class="text-app-text-primary font-black text-sm tracking-tight">{{ currencyName(item.currency_item, currencyItemMap) }}</p>
          </td>
          <td class="py-5 px-4 sm:px-8">
            <p class="text-app-text-muted text-xs font-bold">{{ item.game_title || '—' }}</p>
          </td>
          <td class="py-5 px-4 sm:px-8 text-right">
            <span class="text-[9px] font-black text-app-text-muted uppercase tracking-widest bg-app-bg px-1.5 py-0.5 rounded">{{ item.sell_currency || '—' }}</span>
          </td>
          <td class="py-5 px-4 sm:px-8 text-right font-mono text-app-text-primary font-black tracking-tighter">{{ formatMoney(item.total_revenue, item.sell_currency) }}</td>
          <td class="py-5 px-4 sm:px-8 text-right font-mono text-orange-500 font-black tracking-tighter opacity-80">{{ formatMoney(item.total_cogs, item.sell_currency) }}</td>
          <td class="py-5 px-4 sm:px-8 text-right font-mono font-black tracking-tighter text-base"
            :class="(item.total_profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'">
            {{ formatMoney(item.total_profit, item.sell_currency) }}
          </td>
          <td class="py-5 px-4 sm:px-8 text-right font-mono font-black"
            :class="(item.margin_pct || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'">
            {{ Number(item.margin_pct || 0).toFixed(1) }}%
          </td>
          <td class="py-5 px-4 sm:px-8 text-right font-mono text-app-text-muted font-bold text-xs">
            {{ Number(item.total_qty_sold || 0).toLocaleString('vi-VN') }}
            <span class="opacity-50">({{ item.order_count || 0 }})</span>
          </td>
        </tr>
      </template>
      <template #mobile>
        <div
          v-for="item in paginatedItems" :key="item.currency_item + item.sell_currency"
          class="bg-app-surface border border-app-border rounded-2xl p-4 shadow-sm"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="text-app-text-primary font-black text-sm">{{ currencyName(item.currency_item, currencyItemMap) }}</span>
              <span class="text-[9px] font-black text-app-text-muted uppercase tracking-widest bg-app-bg px-1.5 py-0.5 rounded">{{ item.sell_currency }}</span>
            </div>
            <span class="font-mono font-black text-base" :class="(item.total_profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'">{{ formatMoney(item.total_profit, item.sell_currency) }}</span>
          </div>
          <p class="text-app-text-muted text-[10px] font-bold mb-2">{{ item.game_title || '' }}</p>
          <div class="grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <p class="text-app-text-muted font-black uppercase tracking-widest mb-0.5">Doanh thu</p>
              <p class="text-app-text-primary font-mono font-bold">{{ formatMoney(item.total_revenue, item.sell_currency) }}</p>
            </div>
            <div>
              <p class="text-app-text-muted font-black uppercase tracking-widest mb-0.5">Giá vốn đã bán</p>
              <p class="text-orange-500 font-mono font-bold">{{ formatMoney(item.total_cogs, item.sell_currency) }}</p>
            </div>
            <div>
              <p class="text-app-text-muted font-black uppercase tracking-widest mb-0.5">Biên LN</p>
              <p class="font-mono font-black" :class="(item.margin_pct || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'">{{ Number(item.margin_pct || 0).toFixed(1) }}%</p>
            </div>
          </div>
          <div class="flex justify-between text-[10px] text-app-text-muted mt-2 font-bold">
            <span>SL bán: {{ Number(item.total_qty_sold || 0).toLocaleString('vi-VN') }}</span>
            <span>{{ item.order_count || 0 }} đơn</span>
          </div>
        </div>
      </template>
    </ResponsiveTable>
    </template>
  </PaginatedListLayout>
  </div>
</template>

<script setup>
defineOptions({ name: 'ProfitView' })
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { debounce } from 'lodash-es'
import { getList, frappeCall } from '../api/index.js'
import { useMetadata } from '../composables/useMetadata.js'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import DateRangeFilter from '../components/DateRangeFilter.vue'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import UnderlineTab from '../components/UnderlineTab.vue'
import { usePageSize } from '../components/PaginatedListLayout.vue'
import { useRealtimeSubscriptions } from '../composables/useRealtimeSubscriptions.js'
import { formatMoney, currencyName, formatDate, GAME_TITLES } from '../utils/format.js'
import { syncArray } from '../utils/sync.js'

const router = useRouter()
const { currencyItemMap, fetchMetadata } = useMetadata()

const loading = ref(false)
const activeTab = ref('detail')
const snapshots = ref([])
const itemSummary = ref([])
const currencyTotals = ref([])
const filterGame = ref('')
const filterFrom = ref('')
const filterTo = ref('')
const sortField = ref('sell_order')
const sortAsc = ref(false)
const itemSortField = ref('total_profit')
const itemSortAsc = ref(false)

// Read tab from URL once on mount, fallback to 'detail'
onMounted(() => {
  const urlTab = new URLSearchParams(window.location.search).get('tab')
  if (urlTab === 'by_item') activeTab.value = 'by_item'
})

const games = GAME_TITLES

// Server-side pagination
const { pageSize, setPageSize } = usePageSize('profit', 20)
const currentPage = ref(1)
const detailTotalItems = ref(0)

const totalItems = computed(() =>
  activeTab.value === 'detail' ? detailTotalItems.value : sortedItemSummary.value.length
)
const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / pageSize.value)))

function goToPage(page) {
  const p = Math.max(1, Math.min(page, totalPages.value))
  if (p !== currentPage.value) currentPage.value = p
}

const listLayout = ref(null)

// Sorting
const sorted = computed(() => {
  const data = [...snapshots.value]
  data.sort((a, b) => {
    const va = a[sortField.value] || 0
    const vb = b[sortField.value] || 0
    if (typeof va === 'string') return sortAsc.value ? va.localeCompare(vb) : vb.localeCompare(va)
    return sortAsc.value ? va - vb : vb - va
  })
  return data
})

const sortedItemSummary = computed(() => {
  const data = [...itemSummary.value]
  data.sort((a, b) => {
    const va = a[itemSortField.value] || 0
    const vb = b[itemSortField.value] || 0
    if (typeof va === 'string') return itemSortAsc.value ? va.localeCompare(vb) : vb.localeCompare(va)
    return itemSortAsc.value ? va - vb : vb - va
  })
  return data
})

// Detail tab: already paginated from server, just sort client-side
// By_item tab: client-side pagination on aggregated data
const paginatedItems = computed(() => {
  if (activeTab.value === 'detail') return sorted.value
  const start = (currentPage.value - 1) * pageSize.value
  return sortedItemSummary.value.slice(start, start + pageSize.value)
})

function sortBy(field) {
  if (sortField.value === field) {
    sortAsc.value = !sortAsc.value
  } else {
    sortField.value = field
    sortAsc.value = false
  }
}

function goToDetail(orderName) {
  try { localStorage.setItem('lastViewed_profit', orderName) } catch {}
  router.push(`/order/sell/${orderName}`)
}

// Tab switching
function switchTab(tab) {
  activeTab.value = tab
  if (currentPage.value === 1) {
    if (tab === 'by_item') loadItemSummary()
    else loadData()
  }
  currentPage.value = 1
}

function onFilterChange() {
  if (currentPage.value === 1) {
    if (activeTab.value === 'by_item') loadItemSummary()
    else loadData()
  }
  currentPage.value = 1
}

function onRefresh() {
  if (activeTab.value === 'by_item') loadItemSummary()
  else loadData()
}

// Data loading
watch([filterGame, filterFrom, filterTo], () => {
  if (currentPage.value === 1) {
    if (activeTab.value === 'by_item') loadItemSummary()
    else loadData()
  }
  currentPage.value = 1
})

watch([currentPage, pageSize], () => {
  if (activeTab.value === 'detail') loadData()
})

async function loadCurrencyTotals() {
  try {
    const args = {}
    if (filterGame.value) args.game_title = filterGame.value
    if (filterFrom.value) args.from_date = filterFrom.value
    if (filterTo.value) args.to_date = filterTo.value
    const result = await frappeCall(
      'gege_custom.gege_custom.api.profit.get_item_profit_summary', args
    )
    currencyTotals.value = result.currency_totals || []
  } catch (e) {
    console.error('Load summary totals error', e)
  }
}

function buildDetailFilters() {
  const filters = [['status', 'in', ['Calculated', 'Partially Refunded']]]
  if (filterGame.value) {
    filters.push(['currency_item', 'like', filterGame.value + '%'])
  }
  if (filterFrom.value) {
    filters.push(['creation', '>=', filterFrom.value.slice(0, 10)])
  }
  if (filterTo.value) {
    filters.push(['creation', '<=', filterTo.value.slice(0, 10) + ' 23:59:59'])
  }
  return filters
}

async function loadData() {
  if (snapshots.value.length === 0) loading.value = true
  try {
    const filters = buildDetailFilters()
    const offset = (currentPage.value - 1) * pageSize.value

    const [data, count] = await Promise.all([
      getList('Profit Snapshot', {
        fields: [
          'name', 'sell_order', 'currency_item', 'game_account', 'status',
          'revenue_native', 'cogs_native',
          'trader2_cost_native', 'channel_fee_native', 'other_cost_native',
          'profit_native', 'margin_pct', 'sell_currency',
          'calculated_at', 'creation',
        ],
        filters,
        limit: pageSize.value,
        offset,
        order_by: 'creation desc',
      }),
      frappeCall('frappe.client.get_count', {
        doctype: 'Profit Snapshot',
        filters,
      }),
      loadCurrencyTotals(),
    ])

    syncArray(snapshots.value, data)
    detailTotalItems.value = count || 0
  } catch (e) {
    console.error('Load profit error', e)
  } finally {
    loading.value = false
  }
}

async function loadItemSummary() {
  if (itemSummary.value.length === 0) loading.value = true
  try {
    const args = {}
    if (filterGame.value) args.game_title = filterGame.value
    if (filterFrom.value) args.from_date = filterFrom.value
    if (filterTo.value) args.to_date = filterTo.value

    const [result] = await Promise.all([
      frappeCall('gege_custom.gege_custom.api.profit.get_item_profit_summary', args),
      loadCurrencyTotals(),
    ])
    itemSummary.value = result.items || []
    currencyTotals.value = result.currency_totals || []
  } catch (e) {
    console.error('Load item profit error', e)
  } finally {
    loading.value = false
  }
}

const debouncedReload = debounce(() => {
  if (activeTab.value === 'by_item') loadItemSummary()
  else loadData()
}, 2000)

const { connected } = useRealtimeSubscriptions(
  { 'Profit Snapshot': debouncedReload },
  { onMount: async () => { await fetchMetadata(), loadData() } }
)
</script>
