<template>
  <PaginatedListLayout
    ref="listLayout"
    :total-items="currentList.length"
    :current-page="currentPage"
    :total-pages="totalPages"
    :page-size="pageSize"
    @update:current-page="goToPage"
    @update:page-size="setPageSize"
  >
    <template #header>
      <PageHeader title="Sao kê công nợ" subtitle="Tra cứu lịch sử giao dịch theo khách hàng & đối tác" :connected="connected" @refresh="fetchPartyList" />
    </template>

    <template #filters>
      <!-- Summary Table -->
      <div v-if="partyList" class="bg-app-surface border border-app-border rounded-2xl overflow-hidden mb-4 shadow-sm">
        <table class="w-full text-sm">
          <thead class="bg-app-bg/50 border-b border-app-border">
            <tr>
              <th class="px-4 py-3 text-left text-[9px] font-black text-app-text-muted uppercase tracking-widest w-28"></th>
              <th v-for="cur in stmtActiveCurrencies" :key="cur" class="px-4 py-3 text-right text-[9px] font-black text-app-text-muted uppercase tracking-widest">{{ cur }}</th>
              <th class="px-4 py-3 text-right text-[9px] font-black text-app-text-muted uppercase tracking-widest">Số bên</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-app-border/30">
              <td class="px-4 py-3 text-[10px] font-black text-emerald-600 uppercase tracking-widest">Phải thu (AR)</td>
              <td v-for="cur in stmtActiveCurrencies" :key="cur" class="px-4 py-3 text-right font-mono font-black text-emerald-600">{{ formatMoney(totalReceivableByCur[cur] || 0, cur) }}</td>
              <td class="px-4 py-3 text-right text-xs text-app-text-muted font-bold">{{ (partyList.customers || []).length }}</td>
            </tr>
            <tr class="border-b border-app-border/30">
              <td class="px-4 py-3 text-[10px] font-black text-red-600 uppercase tracking-widest">Phải trả (AP)</td>
              <td v-for="cur in stmtActiveCurrencies" :key="cur" class="px-4 py-3 text-right font-mono font-black text-red-600">{{ formatMoney(totalPayableByCur[cur] || 0, cur) }}</td>
              <td class="px-4 py-3 text-right text-xs text-app-text-muted font-bold">{{ (partyList.suppliers || []).length }}</td>
            </tr>
            <tr>
              <td class="px-4 py-3 text-[10px] font-black text-indigo-600 uppercase tracking-widest">Số dư ròng</td>
              <td v-for="cur in stmtActiveCurrencies" :key="cur" class="px-4 py-3 text-right font-mono font-black text-base"
                :class="(stmtNetByCur[cur] || 0) >= 0 ? 'text-indigo-600' : 'text-red-600'">
                {{ formatMoney(stmtNetByCur[cur] || 0, cur) }}
              </td>
              <td class="px-4 py-3 text-right text-xs text-app-text-muted/40">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Search -->
      <div class="flex flex-wrap items-center gap-3 mb-4 sm:mb-6 overflow-x-hidden">
        <div class="flex-1 min-w-[200px] relative">
          <input v-model="searchQuery" type="text" placeholder="Tìm khách hàng / đối tác..."
            class="input-field pl-9" />
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>

      <!-- Tabs -->
      <UnderlineTab
        v-model="activeTab"
        :tabs="[
          { key: 'receivable', label: 'Khách hàng', count: filteredCustomers.length || null },
          { key: 'payable', label: 'Đối tác', count: filteredSuppliers.length || null },
        ]"
        class="mb-4"
      />
    </template>

    <div class="max-w-6xl mx-auto px-4">
    <LoadingSpinner v-if="loading" />

    <!-- Desktop Table -->
    <template v-else-if="currentList.length > 0">
      <ResponsiveTable :min-width="700">
        <template #header>
          <th class="text-left text-[9px] font-black text-app-text-muted uppercase tracking-widest px-4 py-3">Tên</th>
          <th class="text-center text-[9px] font-black text-app-text-muted uppercase tracking-widest px-4 py-3">Trạng thái</th>
          <th class="text-right text-[9px] font-black text-app-text-muted uppercase tracking-widest px-4 py-3">Giao dịch</th>
          <th class="text-right text-[9px] font-black text-app-text-muted uppercase tracking-widest px-4 py-3">Công nợ</th>
          <th class="text-right text-[9px] font-black text-app-text-muted uppercase tracking-widest px-4 py-3">Tạm ứng</th>
          <th class="text-right text-[9px] font-black text-app-text-muted uppercase tracking-widest px-4 py-3">Gần nhất</th>
          <th class="px-4 py-3 w-10"></th>
        </template>

        <template #body>
          <tr v-for="p in paginatedItems" :key="p.party" :id="p.party"
            class="border-t border-app-border/50 hover:bg-app-bg/30 transition-colors cursor-pointer"
            @click="goToStatement(p.party, activeTab === 'receivable' ? 'Customer' : 'Supplier')">
            <td class="px-4 py-3">
              <span class="text-sm font-black text-app-text-primary">{{ p.display_name }}</span>
            </td>
            <td class="px-4 py-3 text-center">
              <span v-if="p.has_balance"
                class="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                :class="activeTab === 'receivable' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'">
                {{ activeTab === 'receivable' ? 'Còn nợ' : 'Chưa thanh toán' }}
              </span>
              <span v-else class="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Đã trả đủ</span>
            </td>
            <td class="px-4 py-3 text-right text-xs text-app-text-muted">{{ p.tx_count }}</td>
            <td class="px-4 py-3 text-right">
              <span class="text-sm font-black font-mono" :class="p.outstanding > 0 ? (activeTab === 'receivable' ? 'text-emerald-600' : 'text-red-600') : 'text-app-text-muted'">
                {{ formatByCur(p.by_currency) }}
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <span v-if="p.advance_balance > 0" class="text-[10px] font-black font-mono text-indigo-600">{{ formatMoney(p.advance_balance, p.currency) }}</span>
              <span v-else class="text-[10px] text-app-text-muted">—</span>
            </td>
            <td class="px-4 py-3 text-right text-xs text-app-text-muted">{{ p.last_tx_date }}</td>
            <td class="px-4 py-3">
              <svg class="w-4 h-4 text-app-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            </td>
          </tr>
        </template>

        <template #mobile>
          <div v-for="p in paginatedItems" :key="'m-' + p.party"
            class="bg-app-surface border border-app-border rounded-2xl p-4 shadow-sm hover:border-indigo-500/30 transition-colors cursor-pointer flex items-center gap-4"
            @click="goToStatement(p.party, activeTab === 'receivable' ? 'Customer' : 'Supplier')">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-sm font-black text-app-text-primary truncate">{{ p.display_name }}</p>
                <span v-if="p.has_balance"
                  class="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                  :class="activeTab === 'receivable' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'">
                  {{ activeTab === 'receivable' ? 'Còn nợ' : 'Chưa thanh toán' }}
                </span>
                <span v-else class="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Đã trả đủ</span>
              </div>
              <p class="text-[10px] text-app-text-muted mt-0.5">{{ p.tx_count }} giao dịch &middot; Gần nhất: {{ p.last_tx_date }}</p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-sm font-black font-mono" :class="p.outstanding > 0 ? (activeTab === 'receivable' ? 'text-emerald-600' : 'text-red-600') : 'text-app-text-muted'">
                {{ formatByCur(p.by_currency) }}
              </p>
              <p v-if="p.outstanding > 0" class="text-[9px] text-app-text-muted">{{ activeTab === 'receivable' ? 'công ty cần thu' : 'công ty cần trả' }}</p>
              <p v-if="p.advance_balance > 0" class="text-[9px] text-indigo-600 font-bold mt-0.5">Tạm ứng: {{ formatMoney(p.advance_balance, p.currency) }}</p>
            </div>
            <svg class="w-4 h-4 text-app-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
          </div>
        </template>
      </ResponsiveTable>
    </template>

    <EmptyState v-else
      icon="📋"
      :text="activeTab === 'receivable' ? 'Không có khách hàng' : 'Không có đối tác'"
    />
    </div>
  </PaginatedListLayout>
</template>

<script setup>
defineOptions({ name: 'StatementsView' })
import { ref, computed, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import { debounce } from 'lodash-es'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import PageHeader from '../components/PageHeader.vue'
import UnderlineTab from '../components/UnderlineTab.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import { formatMoney } from '../utils/format.js'
import { usePartyList } from '../composables/usePartyList.js'
import { useRealtimeSubscriptions } from '../composables/useRealtimeSubscriptions.js'
import { usePaginatedList } from '../composables/usePaginatedList.js'

const router = useRouter()
const { partyList, loading, fetchPartyList } = usePartyList()
const activeTab = ref('receivable')
const searchQuery = ref('')

const totalReceivable = computed(() =>
  (partyList.value?.customers || []).reduce((sum, c) => sum + (c.outstanding || 0), 0)
)
const totalPayable = computed(() =>
  (partyList.value?.suppliers || []).reduce((sum, s) => sum + (s.outstanding || 0), 0)
)

const totalReceivableByCur = computed(() => {
  const byCur = {}
  for (const c of partyList.value?.customers || []) {
    if (c.by_currency) {
      for (const [cur, val] of Object.entries(c.by_currency)) {
        byCur[cur] = (byCur[cur] || 0) + val
      }
    }
  }
  return byCur
})

const totalPayableByCur = computed(() => {
  const byCur = {}
  for (const s of partyList.value?.suppliers || []) {
    if (s.by_currency) {
      for (const [cur, val] of Object.entries(s.by_currency)) {
        byCur[cur] = (byCur[cur] || 0) + val
      }
    }
  }
  return byCur
})

const stmtActiveCurrencies = computed(() => {
  const curs = new Set()
  for (const cur of Object.keys(totalReceivableByCur.value)) curs.add(cur)
  for (const cur of Object.keys(totalPayableByCur.value)) curs.add(cur)
  return ['VND', 'USD', 'CNY'].filter(c => curs.has(c))
})

const stmtNetByCur = computed(() => {
  const map = {}
  for (const cur of stmtActiveCurrencies.value) {
    const ar = totalReceivableByCur.value[cur] || 0
    const ap = totalPayableByCur.value[cur] || 0
    map[cur] = ar - ap
  }
  return map
})

function matchSearch(p) {
  if (!searchQuery.value) return true
  const q = searchQuery.value.toLowerCase()
  return (p.display_name || '').toLowerCase().includes(q) || (p.party || '').toLowerCase().includes(q)
}

const filteredCustomers = computed(() =>
  (partyList.value?.customers || []).filter(matchSearch)
)
const filteredSuppliers = computed(() =>
  (partyList.value?.suppliers || []).filter(matchSearch)
)

const currentList = computed(() =>
  activeTab.value === 'receivable' ? filteredCustomers.value : filteredSuppliers.value
)

const {
  pageSize, setPageSize, currentPage, totalPages, paginatedItems, goToPage,
  listLayout, getScrollContainer, handleScrollRestoration, setLastViewed,
} = usePaginatedList('statements', currentList)

function goToStatement(party, partyType) {
  setLastViewed(party)
  router.push(`/debts/statement/${partyType}/${encodeURIComponent(party)}`)
}

function formatByCur(byCurrency) {
  if (!byCurrency || typeof byCurrency !== 'object') return formatMoney(0)
  const entries = Object.entries(byCurrency).filter(([, v]) => v > 0)
  if (!entries.length) return '—'
  return entries.map(([cur, val]) => formatMoney(val, cur)).join(', ')
}

const debouncedFetch = debounce(fetchPartyList, 2000)

const { connected } = useRealtimeSubscriptions(
  {
    'Buy Order': debouncedFetch,
    'Sell Order': debouncedFetch,
    'Payment Entry': debouncedFetch,
    'Sales Invoice': debouncedFetch,
    'Purchase Invoice': debouncedFetch,
  },
  { onMount: () => fetchPartyList() }
)

onActivated(() => {
  handleScrollRestoration({ container: getScrollContainer() })
  fetchPartyList()
})
</script>
