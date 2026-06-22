<template>
  <PaginatedListLayout
    ref="listLayout"
    :total-items="currentParties.length"
    :current-page="currentPage"
    :total-pages="totalPages"
    :page-size="pageSize"
    @update:current-page="goToPage"
    @update:page-size="setPageSize"
  >
    <template #header>
      <PageHeader title="Công nợ" subtitle="Quản lý AR/AP" :connected="connected" @refresh="fetchDebts" />
    </template>

    <template #filters>
      <!-- Summary Table -->
      <div v-if="debts" class="bg-app-surface border border-app-border rounded-2xl overflow-hidden mb-4 shadow-sm">
        <table class="w-full text-sm">
          <thead class="bg-app-bg/50 border-b border-app-border">
            <tr>
              <th class="px-4 py-3 text-left text-[9px] font-black text-app-text-muted uppercase tracking-widest w-28"></th>
              <th v-for="cur in debtActiveCurrencies" :key="cur" class="px-4 py-3 text-right text-[9px] font-black text-app-text-muted uppercase tracking-widest">{{ cur }}</th>
              <th class="px-4 py-3 text-right text-[9px] font-black text-app-text-muted uppercase tracking-widest">Số bên</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-app-border/30">
              <td class="px-4 py-3 text-[10px] font-black text-emerald-600 uppercase tracking-widest">Phải thu (AR)</td>
              <td v-for="cur in debtActiveCurrencies" :key="cur" class="px-4 py-3 text-right font-mono font-black text-emerald-600">{{ formatMoney(debts.total_receivable_by_cur?.[cur] || 0, cur) }}</td>
              <td class="px-4 py-3 text-right text-xs text-app-text-muted font-bold">{{ (debts.receivable || []).length }}</td>
            </tr>
            <tr class="border-b border-app-border/30">
              <td class="px-4 py-3 text-[10px] font-black text-red-600 uppercase tracking-widest">Phải trả (AP)</td>
              <td v-for="cur in debtActiveCurrencies" :key="cur" class="px-4 py-3 text-right font-mono font-black text-red-600">{{ formatMoney(debts.total_payable_by_cur?.[cur] || 0, cur) }}</td>
              <td class="px-4 py-3 text-right text-xs text-app-text-muted font-bold">{{ (debts.payable || []).length }}</td>
            </tr>
            <tr>
              <td class="px-4 py-3 text-[10px] font-black text-indigo-600 uppercase tracking-widest">Số dư ròng</td>
              <td v-for="cur in debtActiveCurrencies" :key="cur" class="px-4 py-3 text-right font-mono font-black text-base"
                :class="(debtNetByCurrency[cur] || 0) >= 0 ? 'text-indigo-600' : 'text-red-600'">
                {{ formatMoney(debtNetByCurrency[cur] || 0, cur) }}
              </td>
              <td v-if="totalAdvance > 0" class="px-4 py-3 text-right">
                <span class="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Tạm ứng {{ formatMoney(totalAdvance) }} ({{ partiesWithAdvance }} bên)</span>
              </td>
              <td v-else class="px-4 py-3 text-right text-xs text-app-text-muted/40">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Search + Date Filters + Actions -->
      <div class="flex flex-wrap items-center gap-3 mb-4 sm:mb-6 overflow-x-hidden">
        <div class="flex-1 min-w-[200px] relative">
          <input v-model="searchQuery" type="text" placeholder="Tìm khách hàng / đối tác..."
            class="input-field pl-9" />
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <div class="flex items-center gap-2">
          <input v-model="dateFrom" type="date" class="input-field !py-1.5 !px-2 text-xs" />
          <span class="text-app-text-muted text-xs">&rarr;</span>
          <input v-model="dateTo" type="date" class="input-field !py-1.5 !px-2 text-xs" />
          <button v-if="dateFrom || dateTo" @click="dateFrom = ''; dateTo = ''" class="text-app-text-muted hover:text-app-text-primary text-xs px-1">&#x2715;</button>
        </div>
        <AppButton variant="ghost" size="sm" pill @click="exportCSV">Xuất CSV</AppButton>
      </div>

      <!-- Tabs -->
      <UnderlineTab
        v-model="activeTab"
        :tabs="[
          { key: 'receivable', label: 'Phải thu (AR)', count: partyCount('receivable') },
          { key: 'payable', label: 'Phải trả (AP)', count: partyCount('payable') },
        ]"
        class="mb-4"
      />
    </template>

    <div class="max-w-6xl mx-auto px-4">
    <LoadingSpinner v-if="loading" />

    <template v-else-if="currentParties.length > 0">
      <ResponsiveTable :min-width="800">
        <template #header>
          <th class="text-left text-[9px] font-black text-app-text-muted uppercase tracking-widest px-4 py-3">Tên</th>
          <th class="text-left text-[9px] font-black text-app-text-muted uppercase tracking-widest px-4 py-3">Aging</th>
          <th class="text-right text-[9px] font-black text-app-text-muted uppercase tracking-widest px-4 py-3">Số đơn</th>
          <th class="text-right text-[9px] font-black text-app-text-muted uppercase tracking-widest px-4 py-3">Công nợ</th>
          <th class="text-right text-[9px] font-black text-app-text-muted uppercase tracking-widest px-4 py-3">Tạm ứng</th>
          <th class="text-right text-[9px] font-black text-app-text-muted uppercase tracking-widest px-4 py-3">Quá hạn</th>
          <th class="px-4 py-3 w-10"></th>
        </template>

        <template #body>
          <tr v-for="group in paginatedItems" :key="groupKey(group)" :id="groupKey(group)"
            class="hover:bg-app-bg/30 transition-colors cursor-pointer"
            @click="goToStatement(group)">
            <td class="px-4 py-3">
              <span class="text-sm font-black text-app-text-primary">{{ groupPartyName(group) }}</span>
            </td>
            <td class="px-4 py-2">
              <div v-if="group.aging_buckets" class="flex flex-wrap gap-1">
                <span v-if="group.aging_buckets.current > 0"
                  class="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  HT: {{ formatMoney(group.aging_buckets.current, group.currency) }}
                </span>
                <span v-if="group.aging_buckets.d1_30 > 0"
                  class="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  1-30d: {{ formatMoney(group.aging_buckets.d1_30, group.currency) }}
                </span>
                <span v-if="group.aging_buckets.d31_60 > 0"
                  class="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  31-60d: {{ formatMoney(group.aging_buckets.d31_60, group.currency) }}
                </span>
                <span v-if="group.aging_buckets.d61_90 > 0"
                  class="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
                  61-90d: {{ formatMoney(group.aging_buckets.d61_90, group.currency) }}
                </span>
                <span v-if="group.aging_buckets.over90 > 0"
                  class="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 animate-pulse">
                  >90d: {{ formatMoney(group.aging_buckets.over90, group.currency) }}
                </span>
              </div>
            </td>
            <td class="px-4 py-3 text-right text-xs text-app-text-muted">{{ group.order_count }}</td>
            <td class="px-4 py-3 text-right">
              <span class="text-sm font-black font-mono"
                :class="activeTab === 'receivable' ? 'text-emerald-600' : 'text-red-600'">
                {{ formatByCur(group.by_currency) }}
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <span v-if="group.advance_balance > 0" class="text-[10px] font-black font-mono text-indigo-600">
                {{ formatMoney(group.advance_balance, group.currency) }}
              </span>
              <span v-else class="text-[10px] text-app-text-muted">—</span>
            </td>
            <td class="px-4 py-3 text-right">
              <span v-if="group.aging_max > 0" class="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                :class="group.aging_max > 30 ? 'bg-red-100 text-red-700 animate-pulse' : group.aging_max > 14 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'">
                {{ group.aging_max > 30 ? '⚠ ' : '' }}{{ group.aging_max }}d
              </span>
              <span v-else class="text-[10px] text-app-text-muted">—</span>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-1" @click.stop>
                <AppButton variant="ghost" size="xs" pill @click="goToStatement(group)">Sao kê</AppButton>
                <AppButton variant="success" size="xs" pill @click="openPayment(group)">{{ activeTab === 'receivable' ? 'Thu tiền' : 'Thanh toán' }}</AppButton>
              </div>
            </td>
          </tr>
        </template>

        <template #mobile>
          <div v-for="group in paginatedItems" :key="'m-' + groupKey(group)"
            class="bg-app-surface border border-app-border rounded-2xl p-4 shadow-sm hover:border-indigo-500/30 transition-colors cursor-pointer"
            @click="goToStatement(group)">
            <div class="flex items-start gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-sm font-black text-app-text-primary truncate">{{ groupPartyName(group) }}</p>
                </div>
                <p class="text-[10px] text-app-text-muted mt-0.5">{{ group.order_count }} đơn hàng</p>
                <!-- Aging badges -->
                <div v-if="group.aging_buckets" class="flex flex-wrap gap-1 mt-1.5">
                  <span v-if="group.aging_buckets.d1_30 > 0"
                    class="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    1-30d: {{ formatMoney(group.aging_buckets.d1_30, group.currency) }}
                  </span>
                  <span v-if="group.aging_buckets.d31_60 > 0"
                    class="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    31-60d: {{ formatMoney(group.aging_buckets.d31_60, group.currency) }}
                  </span>
                  <span v-if="group.aging_buckets.d61_90 > 0"
                    class="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
                    61-90d: {{ formatMoney(group.aging_buckets.d61_90, group.currency) }}
                  </span>
                  <span v-if="group.aging_buckets.over90 > 0"
                    class="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 animate-pulse">
                    >90d: {{ formatMoney(group.aging_buckets.over90, group.currency) }}
                  </span>
                </div>
              </div>
              <div class="text-right shrink-0">
                <p class="text-sm font-black font-mono"
                  :class="activeTab === 'receivable' ? 'text-emerald-600' : 'text-red-600'">
                  {{ formatByCur(group.by_currency) }}
                </p>
                <p class="text-[9px] text-app-text-muted">{{ activeTab === 'receivable' ? 'cần thu' : 'cần trả' }}</p>
                <p v-if="group.advance_balance > 0" class="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 mt-1 inline-block">
                  Tạm ứng {{ formatMoney(group.advance_balance, group.currency) }}
                </p>
                <p v-if="group.aging_max > 0" class="text-[9px] font-bold mt-0.5"
                  :class="group.aging_max > 30 ? 'text-red-600 animate-pulse' : group.aging_max > 14 ? 'text-amber-600' : 'text-app-text-muted'">
                  Quá hạn: {{ group.aging_max }} ngày
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2 mt-3 pt-3 border-t border-app-border/50" @click.stop>
              <AppButton variant="ghost" size="xs" pill class="flex-1" @click="goToStatement(group)">Sao kê</AppButton>
              <AppButton variant="success" size="xs" pill class="flex-1" @click="openPayment(group)">{{ activeTab === 'receivable' ? 'Thu tiền' : 'Thanh toán' }}</AppButton>
            </div>
          </div>
        </template>
      </ResponsiveTable>
    </template>

    <EmptyState v-else
      :icon="activeTab === 'receivable' ? '💰' : '💳'"
      :text="activeTab === 'receivable' ? 'Không có công nợ phải thu' : 'Không có công nợ phải trả'"
    />
    </div>

    <!-- Payment Modal -->
    <DebtPaymentModal
      v-model="showPaymentModal"
      :party="paymentParty"
      :side="paymentSide"
      :currency="paymentCurrency"
      @saved="onPaymentSaved"
    />

    <!-- Allocate Advance Modal -->
    <AllocateAdvanceModal
      v-model="showAllocateModal"
      :group="allocateGroup"
      @saved="fetchDebts"
    />
  </PaginatedListLayout>
</template>

<script setup>
defineOptions({ name: 'DebtView' })
import { ref, computed, watch, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import { debounce } from 'lodash-es'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import PageHeader from '../components/PageHeader.vue'
import UnderlineTab from '../components/UnderlineTab.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import AppButton from '../components/AppButton.vue'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import DebtPaymentModal from '../components/DebtPaymentModal.vue'
import AllocateAdvanceModal from '../components/AllocateAdvanceModal.vue'
import { formatMoney } from '../utils/format.js'
import { useDebts } from '../composables/useDebts.js'
import { useRealtimeSubscriptions } from '../composables/useRealtimeSubscriptions.js'
import { usePaginatedList } from '../composables/usePaginatedList.js'

function normalizeText(str) {
  return (str || '').toLowerCase().normalize('NFC')
}

const router = useRouter()
const { debts, loading, fetchDebts } = useDebts()
const showPaymentModal = ref(false)
const paymentParty = ref(null)
const paymentSide = ref('payable')
const paymentCurrency = computed(() => paymentParty.value?.currency || 'VND')
const showAllocateModal = ref(false)
const allocateGroup = ref(null)
const searchQuery = ref('')
const dateFrom = ref('')
const dateTo = ref('')

const debtActiveCurrencies = computed(() => {
  if (!debts.value) return []
  const curs = new Set()
  for (const cur of Object.keys(debts.value.total_receivable_by_cur || {})) curs.add(cur)
  for (const cur of Object.keys(debts.value.total_payable_by_cur || {})) curs.add(cur)
  return ['VND', 'USD', 'CNY'].filter(c => curs.has(c))
})
const debtNetByCurrency = computed(() => {
  if (!debts.value) return {}
  const map = {}
  for (const cur of debtActiveCurrencies.value) {
    const ar = debts.value.total_receivable_by_cur?.[cur] || 0
    const ap = debts.value.total_payable_by_cur?.[cur] || 0
    map[cur] = ar - ap
  }
  return map
})

const tabInitialized = ref(false)
const activeTab = ref('receivable')

watch(debts, (val) => {
  if (!tabInitialized.value && val) {
    const hasPayable = (val.payable || []).length > 0
    const hasReceivable = (val.receivable || []).length > 0
    if (hasPayable && !hasReceivable) activeTab.value = 'payable'
    tabInitialized.value = true
  }
})

const currentParties = computed(() => {
  let list = debts.value?.[activeTab.value] || []
  // Date range filter
  if (dateFrom.value || dateTo.value) {
    const from = dateFrom.value ? new Date(dateFrom.value) : null
    const to = dateTo.value ? new Date(dateTo.value + 'T23:59:59') : null
    list = list.filter(g => (g.orders || []).some(o => {
      const d = new Date(o.creation)
      return (!from || d >= from) && (!to || d <= to)
    }))
  }
  // Text search
  if (!searchQuery.value) return list
  const q = normalizeText(searchQuery.value)
  return list.filter(g => {
    const name = normalizeText(g.supplier_name || g.customer_name || '')
    const id = normalizeText(g.supplier || g.customer || '')
    return name.includes(q) || id.includes(q)
  })
})

const totalAdvance = computed(() => {
  if (!debts.value) return 0
  const all = [...(debts.value.receivable || []), ...(debts.value.payable || [])]
  return all.reduce((s, g) => s + (g.advance_balance || 0), 0)
})
const partiesWithAdvance = computed(() => {
  if (!debts.value) return 0
  const all = [...(debts.value.receivable || []), ...(debts.value.payable || [])]
  return all.filter(g => (g.advance_balance || 0) > 0).length
})

const {
  pageSize, setPageSize, currentPage, totalPages, paginatedItems, goToPage,
  listLayout, getScrollContainer, handleScrollRestoration, setLastViewed,
} = usePaginatedList('debts', currentParties)

function groupKey(group) {
  return group.supplier || group.customer
}

function groupPartyName(group) {
  return group.supplier_name || group.customer_name || groupKey(group)
}

function goToStatement(group) {
  const partyId = groupKey(group)
  const partyType = group.supplier ? 'Supplier' : 'Customer'
  router.push(`/debts/statement/${partyType}/${encodeURIComponent(partyId)}`)
}

function formatByCur(byCurrency) {
  if (!byCurrency || typeof byCurrency !== 'object') return formatMoney(0)
  const entries = Object.entries(byCurrency).filter(([, v]) => v > 0)
  if (!entries.length) return '—'
  return entries.map(([cur, val]) => formatMoney(val, cur)).join(', ')
}

function partyCount(side) {
  return (debts.value?.[side] || []).length || null
}

function openPayment(group) {
  paymentParty.value = group
  paymentSide.value = activeTab.value
  showPaymentModal.value = true
}

function onPaymentSaved() {
  fetchDebts()
}

function exportCSV() {
  if (!debts.value) return
  const rows = []
  rows.push('Loại,Bên,Đơn hàng,Invoice,Số tiền,Tồn,Dữ nợ ngày')

  const sections = [
    { key: 'receivable', label: 'Khoản phải thu', nameField: 'customer_name', partyField: 'customer' },
    { key: 'payable', label: 'Khoản phải trả', nameField: 'supplier_name', partyField: 'supplier' },
  ]
  for (const sec of sections) {
    for (const group of debts.value[sec.key] || []) {
      for (const order of group.orders) {
        const invoiceField = sec.key === 'receivable' ? order.linked_sales_invoice : order.linked_purchase_invoice
        rows.push([
          sec.label,
          group[sec.nameField] || group[sec.partyField],
          order.name,
          invoiceField || '',
          order.invoice_total || order.outstanding_amount_native || 0,
          order.invoice_outstanding || order.outstanding_amount_native || 0,
          order.aging_days || 0,
        ].join(','))
      }
    }
  }

  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `aging-report-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const debouncedFetchDebts = debounce(fetchDebts, 5000)

const { connected } = useRealtimeSubscriptions(
  {
    'Buy Order': debouncedFetchDebts,
    'Sell Order': debouncedFetchDebts,
    'Payment Entry': debouncedFetchDebts,
  },
  { onMount: () => fetchDebts() }
)

onActivated(() => {
  handleScrollRestoration({ container: getScrollContainer() })
  fetchDebts()
})
</script>
