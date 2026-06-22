<template>
  <div class="flex flex-wrap items-center gap-3 sm:gap-4 mb-4 sm:mb-6 overflow-x-hidden">
    <!-- Search (Enter to search, Escape to clear) -->
    <div class="relative w-full sm:w-64">
      <input
        ref="searchInputRef"
        :value="searchDraft"
        @input="onSearchInput($event.target.value)"
        @keydown.enter.prevent="commitSearch"
        @keydown.escape.prevent="clearSearch"
        type="text"
        :placeholder="searchPlaceholder"
        class="px-3 sm:px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary placeholder-app-text-muted/80 outline-none focus:border-indigo-500 transition w-full shadow-sm pr-8"
      />
      <button v-if="searchDraft" @click="clearSearch" class="absolute right-2 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text-primary transition text-sm">✕</button>
    </div>

    <!-- Game Filter -->
    <select
      v-if="showGameFilter"
      :value="filterGame"
      @change="$emit('update:filterGame', $event.target.value)"
      class="px-3 sm:px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500 transition shadow-sm cursor-pointer appearance-none min-w-0 sm:min-w-[140px]"
    >
      <option value="">Tất cả Game</option>
      <option v-for="g in computedGames" :key="g" :value="g">{{ g }}</option>
    </select>

    <!-- Item Filter -->
    <select
      v-if="showItemFilter"
      :value="filterItem"
      @change="$emit('update:filterItem', $event.target.value)"
      class="px-3 sm:px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500 transition shadow-sm cursor-pointer appearance-none min-w-0 sm:min-w-[140px]"
    >
      <option value="">Tất cả Item</option>
      <option v-for="i in computedItems" :key="i" :value="i">{{ currencyName(i, currencyItemMap) || i }}</option>
    </select>

    <!-- Order Type Filter (dropdown, only when showOrderTypeFilter) -->
    <select
      v-if="showOrderTypeFilter"
      :value="filterType"
      @change="$emit('update:filterType', $event.target.value)"
      class="px-3 sm:px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500 transition shadow-sm cursor-pointer appearance-none min-w-0 sm:min-w-[120px]"
    >
      <option value="">Tất cả phiếu</option>
      <option value="sell">Chỉ phiếu Bán Focus</option>
      <option value="buy">Chỉ phiếu Mua Focus</option>
    </select>

    <!-- Sort Filter -->
    <select
      :value="sortOrder"
      @change="$emit('update:sortOrder', $event.target.value)"
      class="px-3 sm:px-4 py-2 rounded-xl text-sm bg-app-surface border border-app-border text-app-text-primary outline-none focus:border-indigo-500 transition shadow-sm cursor-pointer appearance-none min-w-0 sm:min-w-[140px]"
    >
      <option value="desc">Mới nhất tới Cũ nhất</option>
      <option value="asc">Cũ nhất tới Mới nhất</option>
    </select>

    <!-- Date Range Filter -->
    <DateRangeFilter
      v-if="showDateFilter"
      :date-from="dateFrom"
      :date-to="dateTo"
      @update:date-from="$emit('update:dateFrom', $event)"
      @update:date-to="$emit('update:dateTo', $event)"
    />

    <!-- Tier 1: Order Type Tabs (Underline Style) -->
    <UnderlineTab
      v-if="showOrderTypeTabs"
      :model-value="filterType"
      @update:model-value="onTabChange"
      :tabs="orderTypeTabs.map(t => ({ ...t, count: orderTypeCount(t.key) || null }))"
      class="w-full mb-1 sm:mb-2"
    />

    <!-- Tier 2: Status Filter (Pill Style) -->
    <div v-if="statusOptions.length > 0" class="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full mb-1 sm:mb-2">
      <button
        v-for="st in statusOptions"
        :key="st.key"
        @click="$emit('update:filterStatus', st.key)"
        class="px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all duration-200 border whitespace-nowrap"
        :class="filterStatus === st.key
          ? 'bg-app-surface text-app-text-primary border-indigo-600 shadow-[inset_0_1px_rgba(255,255,255,0.1)] shadow-sm'
          : 'bg-transparent border-transparent text-app-text-muted hover:bg-app-surface hover:text-app-text-secondary'"
      >
        {{ st.label }}
        <span v-if="st.key && computedStatusCount(st.key) > 0" class="ml-1 opacity-80 text-[10px]">({{ computedStatusCount(st.key) }})</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { currencyName } from '../utils/format.js'
import { useMetadata } from '../composables/useMetadata.js'
import UnderlineTab from './UnderlineTab.vue'
import DateRangeFilter from './DateRangeFilter.vue'

const searchInputRef = ref(null)
const searchDraft = ref('')
const { currencyItemMap, currencyItems, gameContexts, fetchMetadata } = useMetadata()
fetchMetadata()

function onSearchInput(val) {
  searchDraft.value = val
}

function commitSearch() {
  emit('update:search', searchDraft.value)
}

function clearSearch() {
  searchDraft.value = ''
  emit('update:search', '')
}

const props = defineProps({
  // Data source for computing unique games/items and counts
  orders: { type: Array, default: () => [] },
  // Filter values (v-model)
  search: { type: String, default: '' },
  filterGame: { type: String, default: '' },
  filterItem: { type: String, default: '' },
  filterType: { type: String, default: '' },
  sortOrder: { type: String, default: 'desc' },
  filterStatus: { type: String, default: '' },
  // Display options
  showGameFilter: { type: Boolean, default: true },
  showItemFilter: { type: Boolean, default: true },
  showOrderTypeFilter: { type: Boolean, default: false },
  showOrderTypeTabs: { type: Boolean, default: false },
  showDateFilter: { type: Boolean, default: false },
  orderTypeAllKey: { type: String, default: '' },
  statusOptions: { type: Array, default: () => [] },
  searchPlaceholder: { type: String, default: 'Tìm mã đơn, khách, kênh, tiền... (Enter)' },
  // Date range
  dateFrom: { type: String, default: '' },
  dateTo: { type: String, default: '' },
  // Server-side counts (override local counting from paginated data)
  statusCounts: { type: Object, default: () => ({}) },
  orderTypeCounts: { type: Object, default: () => ({}) },
})

const emit = defineEmits([
  'update:search',
  'update:filterGame',
  'update:filterItem',
  'update:filterType',
  'update:sortOrder',
  'update:filterStatus',
  'update:dateFrom',
  'update:dateTo',
])

// Sync draft with parent search value
watch(() => props.search, (val) => {
  if (val !== searchDraft.value) searchDraft.value = val || ''
})

function onTabChange(key) {
  emit('update:filterType', key)
  emit('update:filterStatus', '')
}

// Support both '' and 'both' as "all orders" keys
const orderTypeTabs = computed(() => {
  const allKey = props.orderTypeAllKey
  return [
    { key: allKey, label: 'Tất cả đơn' },
    { key: 'sell', label: 'Đơn bán' },
    { key: 'buy', label: 'Đơn mua' },
  ]
})

function isAllType(key) {
  return !key || key === 'both'
}

const computedGames = computed(() => {
  return gameContexts.value.map(c => c.name).filter(Boolean).sort()
})

const computedItems = computed(() => {
  let items = currencyItems.value
  if (props.filterGame) {
    const gc = gameContexts.value.find(c => c.name === props.filterGame)
    if (gc) items = items.filter(i => i.game_title === gc.game_title)
  }
  return items.map(i => i.name).filter(Boolean).sort()
})

function orderTypeCount(key) {
  if (isAllType(key)) {
    const { sell, buy } = props.orderTypeCounts
    if (sell != null || buy != null) return (sell || 0) + (buy || 0)
    return props.orders.length
  }
  if (props.orderTypeCounts[key] != null) return props.orderTypeCounts[key]
  if (key === 'sell') return props.orders.filter(o => o.name.startsWith('SO')).length
  if (key === 'buy') return props.orders.filter(o => o.name.startsWith('BO')).length
  return 0
}

function computedStatusCount(statusKey) {
  if (!statusKey) return 0
  // Server returns {"Claimed": 5, "In Delivery": 3, ...} for the current category+sub
  if (props.statusCounts[statusKey] != null) return props.statusCounts[statusKey]
  // Fallback: count from paginated data
  let source = props.orders
  if (props.filterType === 'sell') {
    source = source.filter(o => o.name.startsWith('SO'))
  } else if (props.filterType === 'buy') {
    source = source.filter(o => o.name.startsWith('BO'))
  }
  return source.filter(o => o.status === statusKey).length
}
</script>
