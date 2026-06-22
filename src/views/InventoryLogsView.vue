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
    @update:page-size="changePageSize"
  >
    <template #header>
      <PageHeader
        title="Nhật ký kho"
        subtitle="Lịch sử thay đổi tồn kho"
        :connected="connected"
        @refresh="reloadCurrent"
      />
    </template>

    <template #filters>
      <div class="flex flex-wrap items-center gap-3 sm:gap-4 mb-4 sm:mb-6 overflow-x-hidden">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Tìm theo đơn hàng, note..."
          class="w-full sm:w-64 px-3 sm:px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary placeholder-app-text-muted/80 outline-none focus:border-indigo-500 transition shadow-sm"
          @input="debouncedLoad"
        />

        <select
          v-model="filterType"
          class="px-3 sm:px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500 transition shadow-sm cursor-pointer appearance-none min-w-0 sm:min-w-[140px]"
          @change="reloadCurrent"
        >
          <option value="">Tất cả loại</option>
          <option value="In">📥 Nhập</option>
          <option value="Out">📤 Xuất</option>
          <option value="Conversion">💱 Đổi currency</option>
          <option value="Flip">🔄 Flip</option>
          <option value="Adjustment">⚖️ Điều chỉnh</option>
          <option value="Transfer">🔄 Chuyển kho</option>
        </select>

        <select
          v-model="filterAccount"
          class="px-3 sm:px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500 transition shadow-sm cursor-pointer appearance-none min-w-0 sm:min-w-[140px]"
          @change="reloadCurrent"
        >
          <option value="">Tất cả tài khoản</option>
          <option v-for="acc in accountOptions" :key="acc" :value="acc">{{ acc }}</option>
        </select>

        <select
          v-model="filterUser"
          class="px-3 sm:px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500 transition shadow-sm cursor-pointer appearance-none min-w-0 sm:min-w-[140px]"
          @change="reloadCurrent"
        >
          <option value="">Tất cả người dùng</option>
          <option v-for="u in userOptions" :key="u" :value="u">{{ userName(u) }}</option>
        </select>

        <DateRangeFilter
          :date-from="dateFrom"
          :date-to="dateTo"
          @update:date-from="dateFrom = $event; reloadCurrent()"
          @update:date-to="dateTo = $event; reloadCurrent()"
        />
      </div>

      <UnderlineTab
        v-model="activeGame"
        :tabs="gameTitles.map(g => ({ key: g, label: g, icon: gameIcon(g) }))"
        class="mb-4 sm:mb-6"
      />
    </template>

    <div v-if="loading && rows.length === 0" class="h-full flex items-center justify-center">
      <LoadingSpinner text="Đang tải nhật ký kho..." />
    </div>
    <div v-else-if="rows.length === 0" class="h-full flex items-center justify-center">
      <EmptyState icon="📋" text="Không tìm thấy dữ liệu thay đổi kho" />
    </div>

    <template v-else>
    <ResponsiveTable
      :min-width="1000"
      outer-class="mx-2 sm:mx-4 shadow-sm"
      rounded="2xl sm:3xl"
      mobile-class="px-3 sm:px-4 space-y-2"
    >
      <template #header>
        <th class="text-left py-4 px-3 w-[130px]">Thời gian</th>
        <th class="text-left py-4 px-3 w-[88px]">Loại</th>
        <th class="text-left py-4 px-3 w-[120px]">Mặt hàng</th>
        <th class="text-left py-4 px-3 w-36">Ngữ cảnh</th>
        <th class="text-left py-4 px-3 w-32">Tài khoản</th>
        <th class="text-right py-4 px-3 w-24">Tổng trước</th>
        <th class="text-right py-4 px-3 w-24">Tổng sau</th>
        <th class="text-right py-4 px-3 w-28">Thay đổi</th>
        <th class="text-right py-4 px-3 w-28">Đơn giá</th>
        <th class="text-left py-4 px-3 w-28">Lot</th>
        <th class="text-left py-4 px-3 w-40">Tham chiếu</th>
        <th class="text-left py-4 px-3 w-28">Người dùng</th>
        <th class="text-left py-4 px-3">Ghi chú</th>
      </template>
      <template #body>
        <tr
          v-for="row in paginatedItems"
          :key="row.name"
          class="hover:bg-indigo-600/[0.02] transition-colors"
        >
          <td class="py-3.5 px-3 w-[130px] whitespace-nowrap">
            <div class="text-app-text-muted text-[10px] font-black uppercase tracking-widest">{{ formatDate(row.moved_at).split(' ')[0] }}</div>
            <div class="text-app-text-muted text-[10px] font-black opacity-60">{{ formatDate(row.moved_at).split(' ')[1] }}</div>
          </td>
          <td class="py-3.5 px-3 w-[88px]">
            <span :class="typeBadge(row.movement_type)" class="text-[9px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-lg shadow-sm border border-current/10 whitespace-nowrap">
              {{ typeIcon(row.movement_type) }} {{ typeLabel(row.movement_type) }}
            </span>
          </td>
          <td class="py-3.5 px-3 w-[120px]">
            <span class="text-app-text-primary font-bold truncate block">{{ row.itemName }}</span>
            <span v-if="row.unitLabel" class="text-app-text-muted text-[10px] ml-1.5 font-black uppercase opacity-50">({{ row.unitLabel }})</span>
          </td>
          <td class="py-3.5 px-3 text-app-text-secondary text-[11px] font-medium">
            {{ row.contextLabel || '—' }}
          </td>
          <td class="py-3.5 px-3 text-app-text-primary text-[11px] font-bold">
            {{ row.game_account || '—' }}
          </td>
          <td class="py-3.5 px-3 text-right font-mono text-app-text-muted">
            {{ formatQty(row.total_before ?? row.qty_before) }}
          </td>
          <td class="py-3.5 px-3 text-right font-mono text-app-text-primary font-bold">
            {{ formatQty(row.total_after ?? row.qty_after) }}
          </td>
          <td class="py-3.5 px-3 text-right font-mono">
            <span :class="row.qty > 0 ? 'text-emerald-600 font-black' : row.qty < 0 ? 'text-red-600 font-black' : 'text-app-text-muted'">
              {{ row.qty > 0 ? '+' : '' }}{{ formatQty(row.qty) }}
            </span>
          </td>
          <td class="py-3.5 px-3 text-right text-app-text-muted font-bold font-mono opacity-80">
            {{ row.lotCost ? formatMoney(row.lotCost.unit_cost, row.lotCost.currency) : '—' }}
          </td>
          <td class="py-3.5 px-3">
            <span v-if="typeof row.lot === 'string' && row.lot.includes('lots')" class="text-[10px] font-mono font-bold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-md">
              {{ row.lot }}
            </span>
            <span v-else-if="row.lot" class="text-[10px] font-mono font-bold text-app-text-secondary bg-app-bg px-2 py-0.5 rounded-md">{{ row.lot }}</span>
            <span v-else class="text-app-text-muted opacity-40">—</span>
          </td>
          <td class="py-3.5 px-3">
            <router-link
              v-if="row.reference_doctype && isOrderRef(row.reference_doctype)"
              :to="orderLink(row.reference_doctype, row.reference_name)"
              class="text-[10px] font-black uppercase tracking-tight hover:underline"
            >
              <span class="text-indigo-600">{{ orderTypeShort(row.reference_doctype, row.movement_type) }}</span>
              <span class="text-app-text-secondary ml-1 opacity-60">{{ row.reference_name }}</span>
            </router-link>
            <span v-else :class="refBadge(row)" class="text-[9px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-lg shadow-sm border border-current/10 whitespace-nowrap">
              {{ refLabel(row) }}
            </span>
          </td>
          <td class="py-3.5 px-3 text-app-text-primary text-[11px] font-bold">
            {{ userName(row.moved_by) }}
          </td>
          <td class="py-3.5 px-3 text-app-text-secondary text-[11px] max-w-[200px] truncate italic opacity-70">
            {{ row.note || '' }}
          </td>
        </tr>
      </template>
      <template #mobile>
        <div v-for="row in paginatedItems" :key="row.name"
          class="bg-app-surface border border-app-border rounded-2xl p-3 shadow-sm"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2 min-w-0">
              <span :class="typeBadge(row.movement_type)" class="text-[8px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-md border border-current/10 whitespace-nowrap">
                {{ typeIcon(row.movement_type) }} {{ typeLabel(row.movement_type) }}
              </span>
              <span class="text-app-text-primary font-bold text-xs truncate">{{ row.itemName }}</span>
            </div>
            <span class="text-app-text-muted text-[9px] font-black uppercase tracking-tighter whitespace-nowrap ml-2">{{ formatDate(row.moved_at).split(' ')[0] }}</span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-[10px] mb-2">
            <div>
              <p class="text-app-text-muted font-black uppercase tracking-widest mb-0.5 opacity-50">Tổng trước</p>
              <p class="text-app-text-secondary font-mono font-bold">{{ formatQty(row.total_before ?? row.qty_before) }}</p>
            </div>
            <div>
              <p class="text-app-text-muted font-black uppercase tracking-widest mb-0.5 opacity-50">Tổng sau</p>
              <p class="text-app-text-primary font-mono font-bold">{{ formatQty(row.total_after ?? row.qty_after) }}</p>
            </div>
            <div>
              <p class="text-app-text-muted font-black uppercase tracking-widest mb-0.5 opacity-50">Thay đổi</p>
              <p class="font-mono font-black" :class="row.qty > 0 ? 'text-emerald-600' : row.qty < 0 ? 'text-red-600' : 'text-app-text-muted'">
                {{ row.qty > 0 ? '+' : '' }}{{ formatQty(row.qty) }}
              </p>
            </div>
          </div>
          <div class="flex items-center justify-between text-[10px]">
            <div class="flex items-center gap-2 min-w-0">
              <router-link
                v-if="row.reference_doctype && isOrderRef(row.reference_doctype)"
                :to="orderLink(row.reference_doctype, row.reference_name)"
                class="text-indigo-600 font-black uppercase tracking-tight hover:underline truncate"
              >
                {{ orderTypeShort(row.reference_doctype, row.movement_type) }} {{ row.reference_name }}
              </router-link>
              <span v-else class="text-app-text-muted font-bold">{{ row.game_account || '—' }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="typeof row.lot === 'string' && row.lot.includes('lots')" class="text-[9px] font-mono font-bold text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded-md">
                {{ row.lot }}
              </span>
              <span class="text-app-text-muted font-bold whitespace-nowrap">{{ userName(row.moved_by) }}</span>
            </div>
          </div>
          <p v-if="row.note" class="text-app-text-muted text-[10px] italic opacity-60 mt-1 truncate">{{ row.note }}</p>
        </div>
        <div v-if="loading" class="flex justify-center py-4">
          <LoadingSpinner text="Đang tải..." />
        </div>
      </template>
    </ResponsiveTable>
    </template>
  </PaginatedListLayout>
  </div>
</template>

<script setup>
defineOptions({ name: 'InventoryLogsView' })
import { ref, computed, onActivated, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getList, frappeCall } from '../api/index.js'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import UnderlineTab from '../components/UnderlineTab.vue'
import DateRangeFilter from '../components/DateRangeFilter.vue'
import EmptyState from '../components/EmptyState.vue'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import { useRealtimeSubscriptions } from '../composables/useRealtimeSubscriptions.js'
import { useMetadata } from '../composables/useMetadata.js'
import { usePageSize } from '../components/PaginatedListLayout.vue'
import { debounce } from 'lodash-es'
import { formatQty, formatMoney, formatDateFull as formatDate, userName, gameIcon, GAME_TITLES } from '../utils/format.js'

const router = useRouter()
const { currencyItems, gameContexts, fetchMetadata, currencyItemMap, contextMap } = useMetadata()

const gameTitles = GAME_TITLES

const loading = ref(false)
const rows = ref([])
const totalItems = ref(0)
const activeGame = ref('Diablo 4')
const searchQuery = ref('')
const filterType = ref('')
const filterAccount = ref('')
const filterUser = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const lotCostMap = ref({})

const { pageSize, setPageSize } = usePageSize('inventory-logs', 20)
const currentPage = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / pageSize.value)))
const listLayout = ref(null)

watch(activeGame, (game) => {
  router.push({ query: { game } })
  reloadCurrent()
})

const accountOptions = computed(() => {
  const set = new Set()
  for (const r of rows.value) {
    if (r.game_account) set.add(r.game_account)
  }
  return [...set].sort()
})

const userOptions = computed(() => {
  const set = new Set()
  for (const r of rows.value) {
    if (r.owner) set.add(r.owner)
  }
  return [...set].sort()
})

function typeBadge(type) {
  if (type === 'In') return 'bg-emerald-500/10 text-emerald-600'
  if (type === 'Out') return 'bg-red-500/10 text-red-600'
  if (type === 'Adjustment' || type === 'Adjustment Write-off') return 'bg-orange-500/10 text-orange-600'
  if (type === 'Transfer In' || type === 'Transfer Out') return 'bg-indigo-500/10 text-indigo-600'
  if (type === 'Conversion In' || type === 'Conversion Out') return 'bg-blue-500/10 text-blue-600'
  if (type === 'Flip In' || type === 'Flip Out') return 'bg-amber-500/10 text-amber-600'
  return 'bg-gray-500/10 text-gray-600'
}

function typeIcon(type) {
  if (type === 'In') return '📥'
  if (type === 'Out') return '📤'
  if (type === 'Adjustment' || type === 'Adjustment Write-off') return '⚖️'
  if (type === 'Transfer In' || type === 'Transfer Out') return '🔄'
  if (type === 'Conversion In' || type === 'Conversion Out') return '💱'
  if (type === 'Flip In' || type === 'Flip Out') return '🔁'
  return '📦'
}

function typeLabel(type) {
  if (type === 'In') return 'Nhập'
  if (type === 'Out') return 'Xuất'
  if (type === 'Adjustment') return 'Điều chỉnh'
  if (type === 'Adjustment Write-off') return 'Thanh lý'
  if (type === 'Transfer In') return 'Nhận chuyển'
  if (type === 'Transfer Out') return 'Chuyển đi'
  if (type === 'Conversion In') return 'Conv vào'
  if (type === 'Conversion Out') return 'Conv ra'
  if (type === 'Flip In') return 'Flip vào'
  if (type === 'Flip Out') return 'Flip ra'
  return type
}

function isOrderRef(doctype) {
  return doctype === 'Buy Order' || doctype === 'Sell Order' || doctype === 'Trade Conversion'
}

function refBadge(row) {
  if (row.movement_type === 'Adjustment') return 'bg-amber-500/10 text-amber-600'
  if (row.movement_type === 'Transfer') return 'bg-cyan-500/10 text-cyan-600'
  return 'bg-gray-500/10 text-gray-500'
}

function refLabel(row) {
  if (row.movement_type === 'Adjustment') return '⚖ Adjustment'
  if (row.movement_type === 'Transfer') return '↔ Transfer'
  return 'Thủ công'
}

function orderTypeShort(doctype, movementType) {
  if (doctype === 'Buy Order') return 'BO'
  if (doctype === 'Sell Order') return 'SO'
  if (doctype === 'Trade Conversion') return movementType?.includes('Flip') ? 'Flip' : 'Conv'
  return doctype
}

function orderLink(doctype, name) {
  if (doctype === 'Trade Conversion') return `/conversion/${name}`
  const type = doctype === 'Buy Order' ? 'buy' : 'sell'
  return `/order/${type}/${name}`
}

function buildFilters() {
  const filters = []
  if (searchQuery.value) {
    filters.push(['reference_name', 'like', `%${searchQuery.value}%`])
  }
  if (filterType.value) {
    if (filterType.value === 'Transfer') {
      filters.push(['movement_type', 'in', ['Transfer In', 'Transfer Out']])
    } else if (filterType.value === 'Conversion') {
      filters.push(['movement_type', 'in', ['Conversion In', 'Conversion Out']])
    } else if (filterType.value === 'Flip') {
      filters.push(['movement_type', 'in', ['Flip In', 'Flip Out']])
    } else {
      filters.push(['movement_type', '=', filterType.value])
    }
  }
  if (filterAccount.value) {
    filters.push(['game_account', '=', filterAccount.value])
  }
  if (filterUser.value) {
    filters.push(['owner', '=', filterUser.value])
  }
  if (dateFrom.value) {
    filters.push(['creation', '>=', dateFrom.value.replace('T', ' ')])
  }
  if (dateTo.value) {
    filters.push(['creation', '<=', dateTo.value.replace('T', ' ') + ':59'])
  }
  if (activeGame.value) {
    const items = currencyItems.value.filter(i => i.game_title === activeGame.value).map(i => i.name)
    if (items.length > 0) {
      filters.push(['currency_item', 'in', items])
    }
  }
  return filters.length ? filters : undefined
}

function enrichRows(data) {
  return data.map(r => {
    const ci = currencyItemMap.value[r.currency_item] || {}
    const ctx = contextMap.value[r.game_context] || {}
    const parts = [ctx.season_or_league, ctx.mode].filter(Boolean)
    return {
      ...r,
      itemName: ci.item_name || r.currency_item,
      unitLabel: ci.unit_label || '',
      contextLabel: parts.length > 0 ? parts.join(' - ') : r.game_context || '',
      gameTitle: ci.game_title || '',
      lotCost: r.lot && lotCostMap.value[r.lot] || null,
    }
  })
}

const displayRows = computed(() => {
  const groupMap = new Map()
  const ordered = []

  for (const row of rows.value) {
    const key = row.reference_name || row.name
    if (!row.reference_name || row.reference_name === '') {
      ordered.push({ ...row })
      continue
    }
    if (!groupMap.has(key)) {
      const header = { children: [] }
      groupMap.set(key, header)
      ordered.push(header)
    }
    groupMap.get(key).children.push(row)
  }

  return ordered.map(item => {
    if (!item.children) return item
    const children = item.children
    const first = children[0]
    const last = children[children.length - 1]
    return {
      name: first.name,
      moved_at: first.moved_at,
      movement_type: first.movement_type,
      itemName: first.itemName,
      unitLabel: first.unitLabel,
      contextLabel: first.contextLabel,
      game_account: first.game_account,
      qty: children.reduce((s, c) => s + (c.qty || 0), 0),
      total_before: last.total_before,
      total_after: first.total_after,
      lot: children.length === 1 ? children[0].lot : `${children.length} lots`,
      reference_doctype: first.reference_doctype,
      reference_name: first.reference_name,
      moved_by: first.moved_by,
      note: first.note,
      lotCost: first.lotCost,
    }
  })
})

const paginatedItems = computed(() => displayRows.value)

function goToPage(page) {
  const p = Math.max(1, Math.min(page, totalPages.value))
  if (p !== currentPage.value) {
    currentPage.value = p
    loadData()
  }
}

function changePageSize(size) {
  setPageSize(size)
  currentPage.value = 1
  loadData()
}

async function loadData() {
  loading.value = true
  try {
    await fetchMetadata()

    const offset = (currentPage.value - 1) * pageSize.value
    const result = await getList('Inventory Movement', {
      fields: [
        'name', 'movement_type', 'reference_doctype', 'reference_name',
        'game_account', 'currency_item', 'game_context',
        'qty', 'qty_before', 'qty_after', 'total_before', 'total_after', 'note', 'moved_at', 'moved_by', 'lot',
      ],
      filters: buildFilters(),
      limit: pageSize.value,
      offset,
      order_by: 'creation desc',
    })

    // Batch fetch lot costs for new records
    const lots = result.map(r => r.lot).filter(Boolean).filter(l => lotCostMap.value[l] == null)
    if (lots.length) {
      try {
        const costs = await frappeCall('gege_custom.gege_custom.utils.get_lot_costs', { lots: [...new Set(lots)] })
        Object.assign(lotCostMap.value, costs)
      } catch (e) { console.error('get_lot_costs failed:', e) }
    }
    rows.value = enrichRows(result)
    totalItems.value = await frappeCall('gege_custom.gege_custom.utils.get_inventory_movement_count', { filters: buildFilters() }) || rows.value.length
  } catch (e) {
    console.error('Failed to load inventory logs:', e)
  } finally {
    loading.value = false
  }
}

function reloadCurrent() {
  currentPage.value = 1
  loadData()
}

const debouncedLoad = debounce(() => reloadCurrent(), 400)

function onRealtimeUpdate() {
  loadData()
}

const { connected } = useRealtimeSubscriptions(
  { 'Inventory Movement': onRealtimeUpdate },
  { onMount: loadData }
)

onActivated(() => {
  loadData()
})
</script>
