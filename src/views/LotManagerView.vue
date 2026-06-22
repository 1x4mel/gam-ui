<template>
  <div class="h-full">
  <PaginatedListLayout
    ref="listLayout"
    :total-items="totalItems"
    :current-page="currentPage"
    :total-pages="totalPages"
    :page-size="pageSize"
    self-scroll
    @update:current-page="goToPage"
    @update:page-size="setPageSize"
  >
    <template #header>
      <PageHeader title="Quản lý Lot" subtitle="Theo dõi Currency Lot — nguồn gốc & tiêu thụ" />
    </template>

    <template #filters>
      <div class="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-app-surface border-b border-app-border">
        <input v-model="search" type="text" placeholder="Tìm lot, item, BO, sell order..." class="input-field !py-1.5 text-sm flex-1 min-w-[180px]" @input="debouncedSearch" />
        <select v-model="filterType" class="input-field !py-1.5 text-sm w-32" @change="fetchLots">
          <option value="">Tất cả loại</option>
          <option value="Buy">Buy</option>
          <option value="Flip">Flip</option>
        </select>
        <select v-model="filterArchived" class="input-field !py-1.5 text-sm w-36" @change="fetchLots">
          <option value="0">Đang hoạt động</option>
          <option value="1">Đã lưu trữ</option>
          <option value="">Tất cả</option>
        </select>
      </div>
    </template>

    <!-- Main content: table + detail panel -->
    <div class="flex-1 min-h-0 flex overflow-hidden">
      <!-- Left: Lot table -->
      <div class="flex-1 min-w-0 overflow-y-auto custom-scrollbar">
        <div v-if="loading" class="text-app-text-muted text-sm text-center py-12">Đang tải...</div>
        <table v-else-if="lots.length" class="w-full text-sm">
          <thead class="sticky top-0 bg-app-surface z-10 shadow-sm">
            <tr class="border-b border-app-border">
              <th class="text-left py-2.5 px-4 text-app-text-muted font-black uppercase tracking-wider text-[10px]">Lot</th>
              <th class="text-left py-2.5 px-3 text-app-text-muted font-black uppercase tracking-wider text-[10px]">Loại</th>
              <th class="text-left py-2.5 px-3 text-app-text-muted font-black uppercase tracking-wider text-[10px]">Item</th>
              <th class="text-left py-2.5 px-3 text-app-text-muted font-black uppercase tracking-wider text-[10px]">Account</th>
              <th class="text-right py-2.5 px-3 text-app-text-muted font-black uppercase tracking-wider text-[10px]">Còn lại</th>
              <th class="text-right py-2.5 px-3 text-app-text-muted font-black uppercase tracking-wider text-[10px]">Giá vốn/đv</th>
              <th class="text-left py-2.5 px-3 text-app-text-muted font-black uppercase tracking-wider text-[10px]">Mua từ</th>
              <th class="text-left py-2.5 px-3 text-app-text-muted font-black uppercase tracking-wider text-[10px]">Tạo lúc</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="lot in lots" :key="lot.name"
              class="border-b border-app-border/10 cursor-pointer transition-colors"
              :class="selectedLot?.name === lot.name ? 'bg-indigo-500/10 border-l-2 border-l-indigo-600' : 'hover:bg-app-bg/50'"
              @click="selectLot(lot)">
              <td class="py-2.5 px-4 font-bold text-indigo-600 whitespace-nowrap">{{ lot.name }}</td>
              <td class="py-2.5 px-3">
                <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider"
                  :class="lot.lot_type === 'Flip' ? 'bg-purple-500/10 text-purple-600' : lot.lot_type === 'Conversion' ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600'">
                  {{ lot.lot_type }}
                </span>
              </td>
              <td class="py-2.5 px-3 text-app-text-secondary">{{ cItemName(lot.currency_item) }}</td>
              <td class="py-2.5 px-3 text-app-text-secondary text-xs">{{ lot.game_account }}</td>
              <td class="py-2.5 px-3 text-right font-mono font-bold" :class="lot.qty_remaining > 0 ? 'text-app-text-primary' : 'text-app-text-muted'">
                {{ fmtNum(lot.qty_remaining) }}<span class="text-app-text-muted font-normal">/{{ fmtNum(lot.qty_initial) }}</span>
              </td>
              <td class="py-2.5 px-3 text-right font-mono">
                {{ fmtNum(lot.qty_initial > 0 ? lot.cost_native / lot.qty_initial : 0) }}
                <span class="text-app-text-muted text-[10px]">{{ lot.native_currency }}</span>
              </td>
              <td class="py-2.5 px-3">
                <router-link v-if="lot.source_buy_order" :to="`/order/buy/${lot.source_buy_order}`"
                  class="text-indigo-600 hover:text-indigo-400 font-bold text-xs transition-colors"
                  @click.stop>{{ lot.source_buy_order }}</router-link>
              </td>
              <td class="py-2.5 px-3 text-app-text-muted text-xs whitespace-nowrap">{{ formatDate(lot.creation) }}</td>
            </tr>
          </tbody>
        </table>
        <EmptyState v-else icon="🏷️" text="Không tìm thấy lot" />
      </div>

      <!-- Right: Detail panel -->
      <div v-if="selectedLot" class="lg:w-[400px] shrink-0 bg-app-surface border-l border-app-border overflow-y-auto custom-scrollbar">
        <div class="px-4 py-3 border-b border-app-border flex items-center justify-between">
          <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">{{ selectedLot.name }}</h3>
          <button @click="selectedLot = null" class="text-app-text-muted hover:text-app-text-primary text-lg transition-colors">&#10005;</button>
        </div>

        <div class="p-4 space-y-4">
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div><span class="text-app-text-muted text-[10px] font-black uppercase tracking-wider">Loại</span><p class="font-bold mt-1">{{ selectedLot.lot_type }}</p></div>
            <div><span class="text-app-text-muted text-[10px] font-black uppercase tracking-wider">Item</span><p class="font-bold mt-1">{{ cItemName(selectedLot.currency_item) }}</p></div>
            <div><span class="text-app-text-muted text-[10px] font-black uppercase tracking-wider">Account</span><p class="font-bold mt-1">{{ selectedLot.game_account }}</p></div>
            <div><span class="text-app-text-muted text-[10px] font-black uppercase tracking-wider">Context</span><p class="font-bold mt-1 text-xs truncate">{{ selectedLot.game_context }}</p></div>
            <div><span class="text-app-text-muted text-[10px] font-black uppercase tracking-wider">SL ban đầu</span><p class="font-mono font-bold mt-1">{{ fmtNum(selectedLot.qty_initial) }}</p></div>
            <div><span class="text-app-text-muted text-[10px] font-black uppercase tracking-wider">SL còn lại</span><p class="font-mono font-bold mt-1" :class="selectedLot.qty_remaining > 0 ? 'text-emerald-600' : 'text-red-500'">{{ fmtNum(selectedLot.qty_remaining) }}</p></div>
            <div><span class="text-app-text-muted text-[10px] font-black uppercase tracking-wider">Tổng giá</span><p class="font-mono font-bold mt-1">{{ fmtNum(selectedLot.cost_native) }} {{ selectedLot.native_currency }}</p></div>
            <div><span class="text-app-text-muted text-[10px] font-black uppercase tracking-wider">Giá/đv</span><p class="font-mono font-bold mt-1">{{ fmtNum(selectedLot.qty_initial > 0 ? selectedLot.cost_native / selectedLot.qty_initial : 0) }} {{ selectedLot.native_currency }}</p></div>
          </div>

          <div v-if="selectedLot.source_buy_order" class="border-t border-app-border/30 pt-3">
            <h4 class="text-app-text-muted text-[10px] font-black uppercase tracking-widest mb-2">Nguồn Buy Order</h4>
            <router-link :to="`/order/buy/${selectedLot.source_buy_order}`"
              class="inline-flex items-center gap-2 px-3 py-2 bg-indigo-500/10 text-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-500/20 transition-colors">
              {{ selectedLot.source_buy_order }} →
            </router-link>
          </div>

          <div class="border-t border-app-border/30 pt-3">
            <h4 class="text-app-text-muted text-[10px] font-black uppercase tracking-widest mb-2">
              Sell Orders tiêu thụ ({{ lotAllocations.length }})
            </h4>
            <div v-if="allocLoading" class="text-app-text-muted text-xs text-center py-3">Đang tải...</div>
            <div v-else-if="lotAllocations.length === 0" class="text-app-text-muted text-xs text-center py-3 opacity-50">Chưa được tiêu thụ</div>
            <div v-else class="space-y-2 max-h-[400px] overflow-y-auto">
              <div v-for="sa in lotAllocations" :key="sa.name"
                class="bg-app-bg border border-app-border/30 rounded-xl p-3 space-y-1">
                <div class="flex items-center justify-between">
                  <router-link :to="`/order/sell/${sa.sell_order}`"
                    class="text-indigo-600 hover:text-indigo-400 font-bold text-xs transition-colors">{{ sa.sell_order }}</router-link>
                  <span class="text-[10px] text-app-text-muted">#{{ sa.fifo_rank }}</span>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-app-text-secondary">SL: <b class="font-mono">{{ fmtNum(sa.qty_allocated) }}</b></span>
                  <span class="font-mono" :class="sa.margin_pct >= 0 ? 'text-emerald-600' : 'text-red-500'">
                    {{ sa.margin_pct >= 0 ? '+' : '' }}{{ fmtNum(sa.margin_pct, 1) }}%
                  </span>
                </div>
                <div class="text-[10px] text-app-text-muted">
                  COGS: {{ fmtNum(sa.cost_in_sell_currency) }} | Giá bán: {{ fmtNum(sa.sell_price_per_unit_native) }}/đv
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </PaginatedListLayout>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getList, frappeCall } from '../api/index.js'
import { useMetadata } from '../composables/useMetadata.js'
import { formatDate } from '../utils/format.js'
import PaginatedListLayout, { usePageSize } from '../components/PaginatedListLayout.vue'
import PageHeader from '../components/PageHeader.vue'
import EmptyState from '../components/EmptyState.vue'

const route = useRoute()
const { currencyItemMap, fetchMetadata } = useMetadata()

const loading = ref(false)
const lots = ref([])
const totalItems = ref(0)
const currentPage = ref(1)
const { pageSize, setPageSize } = usePageSize('lots', 20)
const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / pageSize.value)))
const listLayout = ref(null)
const search = ref('')
const filterType = ref('')
const filterArchived = ref('0')
const selectedLot = ref(null)
const lotAllocations = ref([])
const allocLoading = ref(false)

let searchTimer = null

function goToPage(p) {
  const clamped = Math.max(1, Math.min(p, totalPages.value))
  if (clamped !== currentPage.value) {
    currentPage.value = clamped
    fetchLots()
  }
}

function debouncedSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    fetchLots()
  }, 400)
}

function fmtNum(v, decimals = 2) {
  if (v == null || isNaN(v)) return ''
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals })
}

function cItemName(id) {
  if (!id) return ''
  return currencyItemMap.value?.[id]?.item_name || id
}

async function fetchLots() {
  loading.value = true
  try {
    await fetchMetadata()

    const filters = []
    if (filterType.value) filters.push(['lot_type', '=', filterType.value])
    if (filterArchived.value !== '') filters.push(['is_archived', '=', parseInt(filterArchived.value)])

    const q = search.value.trim().toLowerCase()

    if (q) {
      const allocs = await getList('Sale Allocation', {
        fields: ['lot'],
        filters: [['sell_order', 'like', `%${q}%`]],
        limit: 500,
      })
      const sellLotNames = [...new Set(allocs.map(a => a.lot))]

      if (sellLotNames.length > 0) {
        filters.push(['name', 'in', sellLotNames])
      } else {
        filters.push(['name', 'like', `%${q}%`])
      }
    }

    const start = (currentPage.value - 1) * pageSize.value

    const count = await frappeCall('gege_custom.gege_custom.utils.get_count', {
      doctype: 'Currency Lot',
      filters: filters.length ? filters : [],
    })
    totalItems.value = count || 0

    lots.value = await getList('Currency Lot', {
      fields: ['name', 'lot_type', 'currency_item', 'game_account', 'game_context',
        'qty_initial', 'qty_remaining', 'cost_native', 'native_currency',
        'source_buy_order', 'is_archived', 'creation'],
      filters: filters.length ? filters : undefined,
      offset: start,
      limit: pageSize.value,
      order_by: 'creation desc',
    })
  } catch (e) {
    console.error('Failed to load lots:', e)
  } finally {
    loading.value = false
  }
}

async function selectLot(lot) {
  selectedLot.value = lot
  lotAllocations.value = []
  allocLoading.value = true
  try {
    lotAllocations.value = await getList('Sale Allocation', {
      fields: ['name', 'sell_order', 'lot', 'fifo_rank', 'qty_allocated',
        'cost_native_of_lot', 'cost_in_sell_currency', 'sell_price_per_unit_native',
        'revenue_native', 'gross_profit_native', 'margin_pct'],
      filters: [['lot', '=', lot.name]],
      limit: 200,
      order_by: 'creation asc',
    })
  } catch (e) {
    console.error('Failed to load allocations:', e)
  } finally {
    allocLoading.value = false
  }
}

watch(() => route.query.lot, (lotName) => {
  if (lotName && lots.value.length) {
    const match = lots.value.find(l => l.name === lotName)
    if (match) selectLot(match)
  }
}, { immediate: false })

onMounted(async () => {
  await fetchLots()
  if (route.query.lot) {
    const match = lots.value.find(l => l.name === route.query.lot)
    if (match) selectLot(match)
  }
})
</script>
