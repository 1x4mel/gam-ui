<template>
  <DetailPageLayout :loading="loading" loading-text="Đang tải sao kê...">
    <template #toolbar>
      <BackButton @click="router.push('/statements')" />
    </template>

    <template v-if="statement">
      <PageHeader
        :title="`Sao kê — ${statement.party_info.display_name}`"
        :subtitle="side === 'receivable'
          ? 'Khách hàng nợ công ty (Phải thu)'
          : 'Công ty nợ đối tác (Phải trả)'"
        :connected="connected"
        @refresh="loadData"
      />

      <!-- Summary: Per-currency breakdown -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div class="bg-app-surface border border-app-border rounded-2xl p-3 shadow-sm">
          <p class="text-[9px] text-app-text-muted font-black uppercase tracking-widest mb-2">Nợ đầu kỳ</p>
          <div v-for="cur in currencies" :key="'op-'+cur" class="flex items-baseline justify-between gap-1">
            <span class="text-[9px] font-bold text-app-text-muted">{{ cur }}</span>
            <span class="text-sm font-black font-mono text-app-text-muted">{{ formatMoney(openingByCur[cur] || 0, cur) }}</span>
          </div>
        </div>
        <div class="bg-app-surface border border-app-border rounded-2xl p-3 shadow-sm">
          <p class="text-[9px] text-app-text-muted font-black uppercase tracking-widest mb-2">Phát sinh thêm</p>
          <div v-for="cur in currencies" :key="'nd-'+cur" class="flex items-baseline justify-between gap-1">
            <span class="text-[9px] font-bold text-app-text-muted">{{ cur }}</span>
            <span class="text-sm font-black font-mono text-amber-600">{{ formatMoney(newDebtByCur[cur] || 0, cur) }}</span>
          </div>
        </div>
        <div class="bg-app-surface border border-app-border rounded-2xl p-3 shadow-sm">
          <p class="text-[9px] text-app-text-muted font-black uppercase tracking-widest mb-2">{{ side === 'receivable' ? 'Khách đã trả' : 'CT đã trả' }}</p>
          <div v-for="cur in currencies" :key="'pd-'+cur" class="flex items-baseline justify-between gap-1">
            <span class="text-[9px] font-bold text-app-text-muted">{{ cur }}</span>
            <span class="text-sm font-black font-mono text-blue-600">{{ formatMoney(paidByCur[cur] || 0, cur) }}</span>
          </div>
        </div>
        <div class="bg-app-surface border border-app-border rounded-2xl p-3 shadow-sm">
          <p class="text-[9px] text-app-text-muted font-black uppercase tracking-widest mb-2">Còn nợ</p>
          <div v-for="cur in currencies" :key="'cl-'+cur" class="flex items-baseline justify-between gap-1">
            <span class="text-[9px] font-bold text-app-text-muted">{{ cur }}</span>
            <span class="text-sm font-black font-mono"
              :class="closingByCur[cur] > 0 ? (side === 'receivable' ? 'text-emerald-600' : 'text-red-600') : 'text-app-text-muted'">
              {{ formatMoney(closingByCur[cur] || 0, cur) }}
            </span>
          </div>
          <div v-if="hasClosingAdvance" class="mt-2 pt-2 border-t border-app-border/50">
            <p class="text-[9px] text-purple-600 font-bold mb-1">Tạm ứng chưa PG</p>
            <div v-for="cur in currencies" :key="'ca-'+cur" class="flex items-baseline justify-between gap-1">
              <span class="text-[9px] font-bold text-purple-400">{{ cur }}</span>
              <span class="text-sm font-black font-mono text-purple-600">{{ formatMoney(closingAdvanceByCur[cur] || 0, cur) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex items-center gap-3 mb-4">
        <DateRangeFilter v-model:dateFrom="filterFrom" v-model:dateTo="filterTo" />
        <div class="flex gap-1">
          <AppButton v-for="p in periodPresets" :key="p.label" variant="ghost" size="xs" pill
            :class="isPresetActive(p) ? '!bg-indigo-600 !text-white' : ''"
            @click="applyPreset(p)">{{ p.label }}</AppButton>
        </div>
        <AppButton variant="ghost" size="sm" pill @click="exportCSV">Xuất CSV</AppButton>
        <AppButton variant="primary" size="sm" pill @click="exportPDF">Xuất PDF</AppButton>
      </div>

      <!-- Transactions Table -->
      <EmptyState v-if="statement.transactions.length === 0" icon="📋" text="Không có giao dịch trong khoảng thời gian này" />

      <ResponsiveTable v-else :min-width="850" mobile-class="space-y-3">
        <template #header>
          <th class="text-left text-[9px] font-black text-app-text-muted uppercase tracking-widest px-3 py-3">Ngày</th>
          <th class="text-left text-[9px] font-black text-app-text-muted uppercase tracking-widest px-3 py-3">Diễn giải</th>
          <th class="text-left text-[9px] font-black text-app-text-muted uppercase tracking-widest px-3 py-3">Chứng từ</th>
          <th class="text-left text-[9px] font-black text-app-text-muted uppercase tracking-widest px-3 py-3">Đơn hàng</th>
          <th class="text-right text-[9px] font-black text-app-text-muted uppercase tracking-widest px-3 py-3">Nợ thêm</th>
          <th class="text-right text-[9px] font-black text-app-text-muted uppercase tracking-widest px-3 py-3">{{ side === 'receivable' ? 'Khách trả' : 'CT đã trả' }}</th>
          <th class="text-right text-[9px] font-black text-app-text-muted uppercase tracking-widest px-3 py-3">Còn nợ</th>
        </template>

        <template #body>
          <!-- Opening Balance Row -->
          <tr class="bg-app-bg/50">
            <td class="px-3 py-2 text-xs text-app-text-muted">{{ statement.from_date }}</td>
            <td class="px-3 py-2 text-xs font-bold text-app-text-muted" colspan="3">Nợ đầu kỳ</td>
            <td class="px-3 py-2"></td>
            <td class="px-3 py-2"></td>
            <td class="px-3 py-2 text-right text-xs font-mono">
	              <div v-for="cur in currencies" :key="'opb-'+cur" class="font-black text-app-text-muted">
	                {{ formatMoney(openingByCur[cur] || 0, cur) }}
	              </div>
	            </td>
          </tr>
          <tr v-if="hasOpeningAdvance" class="bg-purple-500/5">
            <td class="px-3 py-1"></td>
            <td class="px-3 py-1 text-xs font-bold text-purple-600" colspan="3">Tạm ứng đầu kỳ</td>
            <td class="px-3 py-1"></td>
            <td class="px-3 py-1"></td>
            <td class="px-3 py-1 text-right text-xs font-mono">
              <div v-for="cur in currencies" :key="'opa-'+cur" class="font-black text-purple-600">
                {{ formatMoney(openingAdvanceByCur[cur] || 0, cur) }}
              </div>
            </td>
          </tr>

          <template v-for="tx in statement.transactions" :key="tx.voucher_no + tx.date">
            <tr class="border-t border-app-border/30 hover:bg-app-bg/30 transition-colors">
              <td class="px-3 py-2.5 text-xs text-app-text-muted">{{ tx.date }}</td>
              <td class="px-3 py-2.5">
                <span class="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                  :class="txLabel(tx).cls">
                  {{ txLabel(tx).text }}
                </span>
              </td>
              <td class="px-3 py-2.5 text-xs font-bold text-app-text-primary cursor-pointer hover:underline"
                @click="goToOrder(tx.order_no)">
                {{ tx.voucher_no }}
              </td>
              <td class="px-3 py-2.5 text-xs text-app-text-primary">
                <span v-if="tx.order_no" class="cursor-pointer hover:underline" @click="goToOrder(tx.order_no)">{{ tx.order_no }}</span>
                <span v-else-if="tx.reference_no" class="text-app-text-muted">{{ tx.reference_no }}</span>
                <span v-else class="text-app-text-muted">—</span>
              </td>
              <td class="px-3 py-2.5 text-right text-xs font-bold font-mono"
                :class="txNewDebt(tx) > 0 ? 'text-amber-600' : ''">
                {{ txNewDebt(tx) > 0 ? formatMoney(txNewDebt(tx), txCur(tx)) : '' }}
              </td>
              <td class="px-3 py-2.5 text-right text-xs font-bold font-mono"
                :class="txPaid(tx) > 0 ? 'text-blue-600' : ''">
                {{ txPaid(tx) > 0 ? formatMoney(txPaid(tx), txCur(tx)) : '' }}
              </td>
              <td class="px-3 py-2.5 text-right text-xs font-black font-mono"
                :class="tx.balance > 0 ? (side === 'receivable' ? 'text-emerald-600' : 'text-red-600') : 'text-app-text-muted'">
                {{ formatMoney(tx.balance, txCur(tx)) }}
              </td>
            </tr>
            <!-- Allocation sub-line for PE -->
            <tr v-if="tx.allocated_to_invoice" class="border-t-0 bg-app-bg/20">
              <td class="px-3 py-1"></td>
              <td class="px-3 py-1"></td>
              <td class="px-3 py-1 text-[10px] text-app-text-muted" colspan="2">
                ↳ cho {{ tx.allocated_to_invoice }}
              </td>
              <td class="px-3 py-1"></td>
              <td class="px-3 py-1 text-right text-[10px] font-mono text-blue-500">{{ formatMoney(tx.allocated_amount, txCur(tx)) }}</td>
              <td class="px-3 py-1 text-right">
                <button class="text-[8px] font-black text-red-400 hover:text-red-600 transition px-1"
                  @click.stop="deallocateEntry(tx)">Hủy PG</button>
              </td>
            </tr>
            <!-- Unallocated remainder sub-row -->
            <tr v-if="tx.unallocated_amount > 0 && tx.allocated_amount > 0" class="border-t-0 bg-purple-500/5">
              <td class="px-3 py-1"></td>
              <td class="px-3 py-1"></td>
              <td class="px-3 py-1 text-[10px] text-purple-600" colspan="2">↳ chưa phân bổ (tạm ứng)</td>
              <td class="px-3 py-1"></td>
              <td class="px-3 py-1 text-right text-[10px] font-mono text-purple-500">{{ formatMoney(tx.unallocated_amount, txCur(tx)) }}</td>
              <td class="px-3 py-1"></td>
            </tr>
          </template>

          <!-- Closing Balance Row -->
          <tr class="border-t-2 border-app-border bg-app-bg/50">
            <td class="px-3 py-2.5 text-xs text-app-text-muted">{{ statement.to_date }}</td>
            <td class="px-3 py-2.5 text-xs font-black text-app-text-primary" colspan="3">Tổng cộng</td>
            <td class="px-3 py-2.5 text-right text-xs font-mono">
              <div v-for="cur in currencies" :key="'tnd-'+cur" class="font-black text-amber-600">
                {{ (newDebtByCur[cur] || 0) > 0 ? formatMoney(newDebtByCur[cur], cur) : '' }}
              </div>
            </td>
            <td class="px-3 py-2.5 text-right text-xs font-mono">
              <div v-for="cur in currencies" :key="'tpd-'+cur" class="font-black text-blue-600">
                {{ (paidByCur[cur] || 0) > 0 ? formatMoney(paidByCur[cur], cur) : '' }}
              </div>
            </td>
            <td class="px-3 py-2.5 text-right text-xs font-mono">
              <div v-for="cur in currencies" :key="'tcl-'+cur" class="font-black"
                :class="closingByCur[cur] > 0 ? (side === 'receivable' ? 'text-emerald-600' : 'text-red-600') : 'text-app-text-muted'">
                {{ formatMoney(closingByCur[cur] || 0, cur) }}
              </div>
            </td>
          </tr>
          <tr v-if="hasClosingAdvance" class="bg-purple-500/5">
            <td class="px-3 py-1"></td>
            <td class="px-3 py-1 text-xs font-bold text-purple-600" colspan="3">Tạm ứng chưa phân bổ</td>
            <td class="px-3 py-1"></td>
            <td class="px-3 py-1"></td>
            <td class="px-3 py-1 text-right text-xs font-mono">
              <div v-for="cur in currencies" :key="'cla-'+cur" class="font-black text-purple-600">
                {{ formatMoney(closingAdvanceByCur[cur] || 0, cur) }}
              </div>
            </td>
          </tr>
        </template>

        <template #mobile>
          <!-- Opening Balance -->
          <div class="bg-app-surface border border-app-border rounded-xl p-3 text-xs space-y-1">
            <div class="flex justify-between" v-for="cur in currencies" :key="'mop-'+cur">
              <span class="font-black text-app-text-muted">Nợ đầu kỳ ({{ cur }}):</span>
              <span class="font-black font-mono">{{ formatMoney(openingByCur[cur] || 0, cur) }}</span>
            </div>
            <template v-if="hasOpeningAdvance">
              <div class="flex justify-between text-purple-600" v-for="cur in currencies" :key="'mopa-'+cur">
                <span class="font-bold">Tạm ứng đầu kỳ ({{ cur }}):</span>
                <span class="font-black font-mono">{{ formatMoney(openingAdvanceByCur[cur] || 0, cur) }}</span>
              </div>
            </template>
          </div>

          <div v-for="tx in statement.transactions" :key="tx.voucher_no + tx.date"
            class="bg-app-surface border border-app-border rounded-xl p-3 space-y-1.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-black px-1.5 py-0.5 rounded-full" :class="txLabel(tx).cls">
                  {{ txLabel(tx).text }}
                </span>
                <span class="text-xs font-bold text-app-text-primary">{{ tx.voucher_no }}</span>
              </div>
              <span class="text-[10px] text-app-text-muted">{{ tx.date }}</span>
            </div>
            <div v-if="tx.order_no || tx.reference_no" class="text-[10px] text-app-text-muted">
              <span v-if="tx.order_no">Đơn hàng: {{ tx.order_no }}</span>
              <span v-if="tx.reference_no" class="ml-2">Ref: {{ tx.reference_no }}</span>
            </div>
            <div v-if="tx.allocated_to_invoice" class="text-[10px] text-blue-500 flex items-center gap-2">
              <span>↳ Phân bổ cho {{ tx.allocated_to_invoice }}: {{ formatMoney(tx.allocated_amount, txCur(tx)) }}</span>
              <button class="text-[8px] font-black text-red-400 hover:text-red-600 transition" @click.stop="deallocateEntry(tx)">Hủy PG</button>
            </div>
            <div v-if="tx.unallocated_amount > 0 && tx.allocated_amount > 0" class="text-[10px] text-purple-500">
              ↳ Chưa phân bổ (tạm ứng): {{ formatMoney(tx.unallocated_amount, txCur(tx)) }}
            </div>
            <div class="flex items-center justify-between pt-1 border-t border-app-border/30">
              <div class="flex gap-3">
                <span v-if="txNewDebt(tx) > 0" class="text-xs font-bold font-mono text-amber-600">
                  +{{ formatMoney(txNewDebt(tx), txCur(tx)) }}
                </span>
                <span v-if="txPaid(tx) > 0" class="text-xs font-bold font-mono text-blue-600">
                  -{{ formatMoney(txPaid(tx), txCur(tx)) }}
                </span>
              </div>
              <div class="text-right">
                <span class="text-[9px] text-app-text-muted mr-1">còn nợ</span>
                <span class="text-xs font-black font-mono"
                  :class="tx.balance > 0 ? (side === 'receivable' ? 'text-emerald-600' : 'text-red-600') : 'text-app-text-muted'">
                  {{ formatMoney(tx.balance, txCur(tx)) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Closing Balance -->
          <div class="bg-app-surface border-2 border-app-border rounded-xl p-3 text-xs space-y-1">
            <div class="flex items-center justify-between" v-for="cur in currencies" :key="'mcl-'+cur">
              <span class="font-black text-app-text-primary">Còn nợ {{ cur }}:</span>
              <span class="font-black font-mono"
                :class="closingByCur[cur] > 0 ? (side === 'receivable' ? 'text-emerald-600' : 'text-red-600') : 'text-app-text-muted'">
                {{ formatMoney(closingByCur[cur] || 0, cur) }}
              </span>
            </div>
            <template v-if="hasClosingAdvance">
              <div class="flex items-center justify-between text-purple-600" v-for="cur in currencies" :key="'mcla-'+cur">
                <span class="font-bold">Tạm ứng chưa PG ({{ cur }}):</span>
                <span class="font-black font-mono">{{ formatMoney(closingAdvanceByCur[cur] || 0, cur) }}</span>
              </div>
            </template>
          </div>
        </template>
      </ResponsiveTable>
    </template>
  </DetailPageLayout>
</template>

<script setup>
defineOptions({ name: 'PartyStatementView' })
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { debounce } from 'lodash-es'
import DetailPageLayout from '../components/DetailPageLayout.vue'
import BackButton from '../components/BackButton.vue'
import PageHeader from '../components/PageHeader.vue'
import DateRangeFilter from '../components/DateRangeFilter.vue'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import AppButton from '../components/AppButton.vue'
import EmptyState from '../components/EmptyState.vue'
import { usePartyStatement } from '../composables/usePartyStatement.js'
import { useRealtimeSubscriptions } from '../composables/useRealtimeSubscriptions.js'
import { frappeCall } from '../api/index.js'
import { useNotify } from '../composables/useNotify.js'
import { formatMoney } from '../utils/format.js'
import { getOrderType } from '../utils/format.js'

const router = useRouter()
const { success, error, confirm } = useNotify()
const route = useRoute()
const { statement, loading, fetchStatement } = usePartyStatement()

const partyType = computed(() => route.params.partyType)
const party = computed(() => decodeURIComponent(route.params.party))
const side = computed(() => statement.value?.party_info?.side || 'receivable')
const currency = computed(() => statement.value?.party_info?.currency || 'VND')
const currencies = computed(() => statement.value?.party_info?.currencies || [currency.value])

// Per-currency data from backend
const openingByCur = computed(() => statement.value?.opening_by_cur || {})
const closingByCur = computed(() => statement.value?.closing_by_cur || {})
const newDebtByCur = computed(() => statement.value?.new_debt_by_cur || {})
const paidByCur = computed(() => statement.value?.paid_by_cur || {})
const openingAdvanceByCur = computed(() => statement.value?.opening_advance_by_cur || {})
const closingAdvanceByCur = computed(() => statement.value?.closing_advance_by_cur || {})

const hasOpeningAdvance = computed(() => Object.values(openingAdvanceByCur.value).some(v => v > 0))
const hasClosingAdvance = computed(() => Object.values(closingAdvanceByCur.value).some(v => v > 0))

// Legacy single-currency (used by export functions)
const openingAdvance = computed(() => statement.value?.opening_advance || 0)
const openingDebt = computed(() => (statement.value?.opening_balance || 0) - openingAdvance.value)
const closingAdvance = computed(() => statement.value?.closing_advance || 0)
const closingDebt = computed(() => (statement.value?.closing_balance || 0) - closingAdvance.value)

// Computed summary values
const newDebt = computed(() => {
  if (!statement.value) return 0
  const txs = statement.value.transactions
  return txs.reduce((sum, tx) => sum + txNewDebt(tx), 0)
})
const totalPaid = computed(() => {
  if (!statement.value) return 0
  const txs = statement.value.transactions
  return txs.reduce((sum, tx) => sum + txPaid(tx), 0)
})

function txNewDebt(tx) {
  if (side.value === 'receivable') return tx.debit || 0
  return tx.credit || 0
}

function txPaid(tx) {
  if (side.value === 'receivable') return tx.credit || 0
  return tx.debit || 0
}

function txLabel(tx) {
  const isInvoice = tx.voucher_type === 'Sales Invoice' || tx.voucher_type === 'Purchase Invoice'
  const isReceivable = side.value === 'receivable'

  if (isInvoice) {
    return {
      text: isReceivable ? 'Xuất hóa đơn' : 'Nhập hóa đơn',
      cls: 'bg-blue-100 text-blue-700',
    }
  }
  // Payment Entry — tạm ứng hoàn toàn hoặc một phần
  if (tx.unallocated_amount > 0 && tx.allocated_amount === 0) {
    return {
      text: isReceivable ? 'Khách tạm ứng' : 'Tạm ứng cho NCC',
      cls: 'bg-purple-100 text-purple-700',
    }
  }
  // Thanh toán có phân bổ (có thể vẫn còn dư unallocated)
  if (tx.allocated_amount > 0 && tx.unallocated_amount > 0) {
    return {
      text: isReceivable ? 'Thanh toán + tạm ứng dư' : 'Thanh toán + tạm ứng dư',
      cls: 'bg-teal-100 text-teal-700',
    }
  }
  return {
    text: isReceivable ? 'Khách thanh toán' : 'Đã thanh toán',
    cls: 'bg-green-100 text-green-700',
  }
}

const thirtyDaysAgo = () => {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

const filterFrom = ref(route.query.from || thirtyDaysAgo())
const filterTo = ref(route.query.to || new Date().toISOString().slice(0, 10))

// Period presets
const periodPresets = computed(() => {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const today = now.toISOString().slice(0, 10)
  const startOfMonth = new Date(y, m, 1).toISOString().slice(0, 10)
  const startOfPrevMonth = new Date(y, m - 1, 1).toISOString().slice(0, 10)
  const endOfPrevMonth = new Date(y, m, 0).toISOString().slice(0, 10)
  const quarterStart = [0, 1, 2].includes(m) ? new Date(y, 0, 1) : [3, 4, 5].includes(m) ? new Date(y, 3, 1) : [6, 7, 8].includes(m) ? new Date(y, 6, 1) : new Date(y, 9, 1)
  return [
    { label: 'Tháng này', from: startOfMonth, to: today },
    { label: 'Tháng trước', from: startOfPrevMonth, to: endOfPrevMonth },
    { label: 'Quý này', from: quarterStart.toISOString().slice(0, 10), to: today },
  ]
})

function applyPreset(p) {
  filterFrom.value = p.from
  filterTo.value = p.to
}

function isPresetActive(p) {
  return filterFrom.value === p.from && filterTo.value === p.to
}

function loadData() {
  if (!partyType.value || !party.value) return
  fetchStatement(partyType.value, party.value, filterFrom.value, filterTo.value)
}

watch([filterFrom, filterTo], () => {
  router.replace({ query: { from: filterFrom.value, to: filterTo.value } })
  loadData()
})

watch(() => [route.params.partyType, route.params.party], () => {
  loadData()
})

onMounted(() => loadData())

async function deallocateEntry(tx) {
  if (!(await confirm(`Hủy phân bổ ${formatMoney(tx.allocated_amount, currency.value)} cho ${tx.allocated_to_invoice}?`))) return
  try {
    await frappeCall('gege_custom.gege_custom.api.debt.cancel_allocation', {
      payment_entry: tx.voucher_no,
      allocated_to_invoice: tx.allocated_to_invoice,
      amount: tx.allocated_amount,
    })
    success('Đã hủy phân bổ')
    loadData()
  } catch (e) {
    error('Lỗi hủy phân bổ: ' + (e.message || e))
  }
}

const debouncedLoadData = debounce(loadData, 2000)
const { connected } = useRealtimeSubscriptions(
  {
    'Sales Invoice': debouncedLoadData,
    'Purchase Invoice': debouncedLoadData,
    'Payment Entry': debouncedLoadData,
  },
  { onMount: () => {} },
)

function goToOrder(orderNo) {
  if (!orderNo) return
  router.push(`/order/${getOrderType(orderNo)}/${orderNo}`)
}

function txCur(tx) {
  return tx.currency || currency.value
}

function formatByCur(byCurrency) {
  if (!byCurrency || typeof byCurrency !== 'object') return ''
  const entries = Object.entries(byCurrency).filter(([, v]) => Math.abs(v) > 0.001)
  if (!entries.length) return ''
  return entries.map(([cur, val]) => formatMoney(val, cur)).join(' + ')
}

function exportCSV() {
  if (!statement.value) return
  const info = statement.value.party_info
  const isReceivable = side.value === 'receivable'
  const rows = []
  rows.push(`Sao ke cong no: ${info.display_name} (${isReceivable ? 'Khach hang no cong ty' : 'Cong ty no doi tac'})`)
  rows.push(`Tu ngay: ${statement.value.from_date} - Den ngay: ${statement.value.to_date}`)
  rows.push('')
  rows.push('Ngay,Diễn giải,Chứng từ,Đơn hàng,Tham chiếu,Tiền tệ,Nợ thêm,Đã trả,Còn nợ')
  for (const cur of currencies.value) {
    const ob = openingByCur.value[cur] || 0
    rows.push(`${statement.value.from_date},Nợ đầu kỳ (${cur}),,,,,,${ob}`)
  }
  for (const tx of statement.value.transactions) {
    const label = txLabel(tx).text
    const newD = txNewDebt(tx)
    const paid = txPaid(tx)
    rows.push([tx.date, label, tx.voucher_no, tx.order_no, tx.reference_no, txCur(tx), newD, paid, tx.balance].join(','))
  }
  for (const cur of currencies.value) {
    const cb = closingByCur.value[cur] || 0
    rows.push(`${statement.value.to_date},Tổng cộng (${cur}),,,,,${newDebtByCur.value[cur] || 0},${paidByCur.value[cur] || 0},${cb}`)
  }

  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `statement-${info.name}-${statement.value.from_date}-${statement.value.to_date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportPDF() {
  if (!statement.value) return
  const info = statement.value.party_info
  const isReceivable = side.value === 'receivable'
  const txRows = statement.value.transactions.map(tx => {
    const label = txLabel(tx).text
    const nd = txNewDebt(tx)
    const pd = txPaid(tx)
    const tc = txCur(tx)
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b">${tx.date}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:11px">${label}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:700">${tx.voucher_no}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px">${tx.order_no || '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace;color:${nd > 0 ? '#d97706' : 'inherit'}">${nd > 0 ? formatMoney(nd, tc) : ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace;color:${pd > 0 ? '#2563eb' : 'inherit'}">${pd > 0 ? formatMoney(pd, tc) : ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-family:monospace;font-weight:900">${formatMoney(tx.balance, tc)}</td>
    </tr>`
  }).join('')

  const summaryCards = currencies.value.map(cur => {
    const ob = openingByCur.value[cur] || 0
    const nd = newDebtByCur.value[cur] || 0
    const pd = paidByCur.value[cur] || 0
    const cb = closingByCur.value[cur] || 0
    const clColor = cb > 0 ? (isReceivable ? '#059669' : '#dc2626') : '#64748b'
    return `<div class="currency-section">
      <div style="font-size:10px;font-weight:900;color:#6366f1;margin-bottom:8px">${cur}</div>
      <div class="summary">
        <div class="summary-card"><div class="label">Nợ đầu kỳ</div><div class="value">${formatMoney(ob, cur)}</div></div>
        <div class="summary-card"><div class="label">Phát sinh</div><div class="value" style="color:#d97706">${formatMoney(nd, cur)}</div></div>
        <div class="summary-card"><div class="label">${isReceivable ? 'Khách đã trả' : 'CT đã trả'}</div><div class="value" style="color:#2563eb">${formatMoney(pd, cur)}</div></div>
        <div class="summary-card"><div class="label">Còn nợ</div><div class="value" style="color:${clColor}">${formatMoney(cb, cur)}</div></div>
      </div>
    </div>`
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sao kê ${info.display_name}</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;max-width:900px;margin:0 auto;padding:40px 20px}
    h1{font-size:20px;margin:0}h2{font-size:12px;color:#64748b;font-weight:400;margin:4px 0 24px}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th{padding:8px;text-align:left;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;border-bottom:2px solid #e2e8f0}
    .summary{display:flex;gap:16px;margin:8px 0;flex-wrap:wrap}
    .summary-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;flex:1;min-width:120px}
    .summary-card .label{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#64748b}
    .summary-card .value{font-size:16px;font-weight:900;font-family:monospace;margin-top:4px}
    .currency-section{margin-bottom:16px}
    .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8}
    @media print{body{padding:20px}}
  </style></head><body>
  <h1>Sao kê công nợ — ${info.display_name}</h1>
  <h2>${isReceivable ? 'Khách hàng nợ công ty (Phải thu)' : 'Công ty nợ đối tác (Phải trả)'} &middot; ${statement.value.from_date} → ${statement.value.to_date}</h2>
  ${summaryCards}
  <table>
    <thead><tr><th>Ngày</th><th>Diễn giải</th><th>Chứng từ</th><th>Đơn hàng</th><th style="text-align:right">Nợ thêm</th><th style="text-align:right">Đã trả</th><th style="text-align:right">Còn nợ</th></tr></thead>
    <tbody>
      <tr style="background:#f8fafc"><td style="padding:6px 8px;font-size:12px;color:#64748b">${statement.value.from_date}</td><td colspan="3" style="padding:6px 8px;font-size:12px;font-weight:700;color:#64748b">Nợ đầu kỳ</td><td></td><td></td><td style="padding:6px 8px;font-size:12px;text-align:right;font-family:monospace;font-weight:900;color:#64748b">${formatByCur(openingByCur.value)}</td></tr>
      ${txRows}
      <tr style="background:#f8fafc;border-top:2px solid #e2e8f0"><td style="padding:8px;font-size:12px;color:#64748b">${statement.value.to_date}</td><td colspan="3" style="padding:8px;font-size:12px;font-weight:900">Tổng cộng</td><td style="padding:8px;font-size:12px;text-align:right;font-family:monospace;font-weight:900;color:#d97706">${formatByCur(newDebtByCur.value)}</td><td style="padding:8px;font-size:12px;text-align:right;font-family:monospace;font-weight:900;color:#2563eb">${formatByCur(paidByCur.value)}</td><td style="padding:8px;font-size:12px;text-align:right;font-family:monospace;font-weight:900">${formatByCur(closingByCur.value)}</td></tr>
    </tbody>
  </table>
  <div class="footer">Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} &middot; GEGE Game Currency Trading</div>
  <script>window.onload=function(){window.print()}<\/script>
  </body></html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
}
</script>
