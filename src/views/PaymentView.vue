<template>
  <div class="h-full">
  <PaginatedListLayout
    ref="listLayout"
    :total-items="totalItems"
    :current-page="currentPage"
    :total-pages="totalPages"
    :page-size="pageSize"
    @update:current-page="goToPage"
    @update:page-size="setPageSize"
  >
    <template #header>
      <PageHeader
        title="Thanh toán"
        subtitle="Kế toán quản lý AR/AP"
        :connected="connected"
        @refresh="loadData"
      />
    </template>

    <template #filters>
      <!-- Quick Stats Bar -->
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="bg-app-surface border border-app-border rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <div class="text-[9px] font-black text-emerald-600/70 uppercase tracking-widest">Phải thu (AR)</div>
            <div class="font-mono font-black text-lg text-emerald-600 mt-0.5">{{ formatMoney(arByCurrency['VND'] || 0, 'VND') }}</div>
          </div>
          <div class="text-right">
            <div class="text-[9px] text-app-text-muted uppercase tracking-widest">Số đơn</div>
            <div class="text-sm font-bold text-app-text-secondary mt-0.5">{{ sellDeliveredCount }}</div>
          </div>
        </div>
        <div class="bg-app-surface border border-app-border rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <div class="text-[9px] font-black text-red-600/70 uppercase tracking-widest">Phải trả (AP)</div>
            <div class="font-mono font-black text-lg text-red-600 mt-0.5">{{ formatMoney(apByCurrency['VND'] || 0, 'VND') }}</div>
          </div>
          <div class="text-right">
            <div class="text-[9px] text-app-text-muted uppercase tracking-widest">Số đơn</div>
            <div class="text-sm font-bold text-app-text-secondary mt-0.5">{{ payableCount }}</div>
          </div>
        </div>
      </div>

      <OrderListFilters
        :orders="orders"
        v-model:search="search"
        v-model:filter-game="filterGame"
        v-model:filter-item="filterItem"
        v-model:sort-order="sortOrder"
        :show-order-type-tabs="false"
        :show-order-type-filter="false"
        search-placeholder="Tìm mã đơn, tên KH/NCC, người thực hiện, ghi chú, số tiền..."
      />

      <UnderlineTab
        v-model="activeTab"
        :tabs="[
          { key: 'payable', label: 'Phải trả (AP)', count: payableCount || null },
          { key: 'receivable', label: 'Phải thu (AR)', count: sellDeliveredCount || null },
          { key: 'completed', label: 'Đã xử lý', count: completedCount || null },
        ]"
        class="mb-6"
      />

      <DateRangeFilter v-if="activeTab === 'completed'" v-model:date-from="completedFrom" v-model:date-to="completedTo" class="mb-4" />
    </template>

    <div class="max-w-6xl mx-auto px-4">
    <LoadingSpinner v-if="loading" text="Đang tải dữ liệu..." />

    <EmptyState v-else-if="orders.length === 0"
      :icon="activeTab === 'payable' ? '📭' : activeTab === 'receivable' ? '💸' : '✅'"
      :text="activeTab === 'payable' ? 'Không có đơn chờ thanh toán' : activeTab === 'receivable' ? 'Không có đơn chờ thu tiền' : 'Không có đơn đã xử lý'"
    />

    <!-- ===== AP Tab: Buy Orders (Payment Pending) ===== -->
    <div v-else-if="activeTab === 'payable'" class="space-y-6">
      <OrderCard
        v-for="order in orders"
        :key="order.name"
        :order="order"
        order-type="buy"
        @dblclick="goToDetail(order)"
        @edit-note="openNoteEditor"
      >
        <template #actions>
          <div class="flex items-center gap-3 flex-wrap">
            <AppButton v-if="canActOnOrder(order) && getOrderCurrency(order) === 'VND'" variant="primary" size="sm" pill @click.stop="openQrPayment(order)">💸 Thanh toán QR</AppButton>
            <AppButton v-if="canActOnOrder(order) && getOrderCurrency(order) !== 'VND'" variant="success" size="sm" pill @click.stop="completeBuyOrder(order)">💰 Thanh toán & Hoàn thành</AppButton>
            <AppButton v-if="canActOnOrder(order)" variant="warning" size="sm" pill @click.stop="convertToDebt(order)">📋 Tạo công nợ</AppButton>
            <AppButton v-if="isManagementOrAbove" variant="ghost" size="sm" pill @click.stop="openReassignTrader(order)">👤 Đổi người TT</AppButton>
            <AppButton variant="ghost" size="sm" pill @click.stop="goToDetail(order)">Chi tiết →</AppButton>
            <AppButton v-if="order.debt_status" variant="ghost" size="xs" pill @click.stop="goToDebtStatement(order.supplier, 'Supplier')">Xem công nợ →</AppButton>
          </div>
        </template>
      </OrderCard>
    </div>

    <!-- ===== AR Tab: Sell Orders (Delivered) ===== -->
    <div v-else-if="activeTab === 'receivable'" class="space-y-6">
      <OrderCard
        v-for="order in orders"
        :key="order.name"
        :order="order"
        order-type="sell"
        @dblclick="goToDetail(order)"
        @edit-note="openNoteEditor"
      >
        <template #actions>
          <div class="flex items-center gap-3 flex-wrap flex-1">
            <div v-if="order.outstanding_amount" class="flex items-center gap-1.5 text-xs">
              <span class="text-app-text-muted">Còn nợ:</span>
              <span class="font-black font-mono text-amber-600">{{ formatMoney(order.outstanding_amount, getOrderCurrency(order)) }}</span>
            </div>
            <div v-if="order.linked_sales_invoice" class="text-[9px] text-app-text-muted">
              SI: {{ order.linked_sales_invoice }}
            </div>
            <div v-if="order.payment_proof" class="text-[9px] text-indigo-600 font-bold">Có bằng chứng TT</div>
            <span v-if="order.workflow_state === 'Payment Pending'" class="text-[10px] text-amber-500 font-bold">Chờ xác nhận thanh toán</span>
          </div>
          <div class="flex items-center gap-3 flex-wrap">
            <AppButton v-if="order.workflow_state === 'Payment Pending' && canActOnOrder(order)" variant="primary" size="sm" pill :loading="processing === order.name"
              @click.stop="confirmSellPayment(order)">Xác nhận đã nhận tiền</AppButton>
            <template v-if="order.workflow_state !== 'Payment Pending'">
            <AppButton v-if="canActOnOrder(order)" variant="success" size="sm" pill :loading="processing === order.name"
              @click.stop="completeSellOrder(order)">✓ Hoàn thành</AppButton>
            <AppButton v-if="canActOnOrder(order) && order.workflow_state !== 'Outstanding'" variant="warning" size="sm" pill :loading="processing === order.name"
              @click.stop="convertSellToDebt(order)">📋 Tạo công nợ</AppButton>
            </template>
            <AppButton variant="ghost" size="sm" pill @click.stop="goToOrder('sell', order.name)">Chi tiết →</AppButton>
            <AppButton v-if="order.debt_status" variant="ghost" size="xs" pill @click.stop="goToDebtStatement(order.customer, 'Customer')">Xem công nợ →</AppButton>
          </div>
        </template>
      </OrderCard>
    </div>

    <!-- ===== Completed Tab ===== -->
    <div v-else class="space-y-6">
      <OrderCard
        v-for="order in orders"
        :key="order.name"
        :order="order"
        :order-type="order._orderType || 'buy'"
        @dblclick="goToDetail(order)"
        @edit-note="openNoteEditor"
      >
        <template #actions>
          <div class="flex items-center gap-3">
            <span class="text-[10px] text-emerald-600 font-bold">✓ Hoàn thành</span>
            <AppButton variant="ghost" size="sm" pill @click.stop="order._orderType === 'sell' ? goToOrder('sell', order.name) : goToDetail(order)">Chi tiết →</AppButton>
          </div>
        </template>
      </OrderCard>
    </div>
    </div>
  </PaginatedListLayout>

  <!-- QR Payment Modal -->
  <QrPaymentModal
    v-model:open="showQrModal"
    :loading="qrLoading"
    :qr-value="qrValue"
    :order="qrOrder"
    :bank-info="qrBankInfo"
    :description="qrDescription"
  >
    <template #qr-extra>
      <button v-if="qrBankInfo?.custom_payment_qr" @click="viewOriginalQr" class="w-full text-xs font-black uppercase tracking-widest text-indigo-600 hover:text-white flex items-center justify-center gap-3 py-4 px-6 bg-indigo-600/5 hover:bg-indigo-600 rounded-2xl transition-all active:scale-95 border border-indigo-600/10 hover:shadow-xl shadow-indigo-600/10 group">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        Xem mã QR gốc
      </button>
    </template>
    <template #actions>
      <div class="mt-10">
        <AppButton
          variant="success" size="lg" class="w-full !py-4 sm:!py-5 !text-base sm:!text-lg !rounded-xl sm:!rounded-[2rem]"
          :loading="processing === qrOrder?.name"
          :disabled="processing === qrOrder?.name"
          @click="markPaid(qrOrder)"
        >💰 XÁC NHẬN ĐÃ CHUYỂN KHOẢN</AppButton>
      </div>
    </template>
  </QrPaymentModal>

  <!-- Edit Note Modal -->
  <EditNoteModal
    v-model="showEditNoteModal"
    :order="editingOrder"
    @saved="loadData"
  />

  <!-- Original QR Lightbox -->
  <MediaLightbox
    v-model:open="showOriginalQr"
    :item="originalQrItem"
    show-pan-zoom
    :show-download="false"
  />

  <!-- Reassign Trader Modal -->
  <div v-if="showReassignModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="showReassignModal = false">
    <div class="bg-app-surface border border-app-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
      <div class="px-6 py-4 border-b border-app-border flex justify-between items-center">
        <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">Đổi người thanh toán</h3>
        <button @click="showReassignModal = false" class="text-app-text-muted hover:text-app-text-primary transition p-1 text-lg">✕</button>
      </div>
      <div class="px-6 py-4 space-y-3">
        <p class="text-xs text-app-text-muted">
          Đơn: <span class="font-bold text-app-text-primary">{{ reassignOrder?.name }}</span>
        </p>
        <div>
          <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Chọn người thanh toán mới</label>
          <SearchableSelect
            v-model="reassignTrader"
            :options="paymentUsers"
            placeholder="-- Chọn nhân viên --"
          />
        </div>
      </div>
      <div class="px-6 py-4 border-t border-app-border flex justify-end gap-2">
        <button @click="showReassignModal = false" class="px-4 py-2 rounded-xl text-xs font-bold text-app-text-muted hover:text-app-text-primary hover:bg-app-bg transition">Hủy</button>
        <AppButton variant="primary" size="sm" :loading="!!reassignLoading" @click="saveReassignTrader">Xác nhận</AppButton>
      </div>
    </div>
  </div>

  <ActionConfirmModal
    v-model="actionModal"
    :icon="actionModalData.icon"
    :title="actionModalData.title"
    :subtitle="actionModalData.subtitle"
    :order="actionModalData.order"
    :amount="actionModalData.amount"
    :amount-label="actionModalData.amountLabel"
    :order-status="actionModalData.orderStatus"
    :bank-label="isManagementOrAbove ? actionModalData.bankLabel : ''"
    :bank-options="isManagementOrAbove ? actionModalData.bankOptions : []"
    :confirm-text="actionModalData.confirmText"
    :confirm-variant="actionModalData.confirmVariant"
    :warning="actionModalData.warning"
    :loading="!!processing"
    @confirm="handleActionConfirm"
  />
  </div>
</template>

<script setup>
defineOptions({ name: 'PaymentView' })
import { ref, computed, reactive, onActivated, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { debounce } from 'lodash-es'
import OrderCard from '../components/OrderCard.vue'
import AppButton from '../components/AppButton.vue'
import UnderlineTab from '../components/UnderlineTab.vue'
import SearchableSelect from '../components/SearchableSelect.vue'

import OrderListFilters from '../components/OrderListFilters.vue'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import EditNoteModal from '../components/EditNoteModal.vue'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import MediaLightbox from '../components/MediaLightbox.vue'
import QrPaymentModal from '../components/QrPaymentModal.vue'
import ActionConfirmModal from '../components/ActionConfirmModal.vue'
import DateRangeFilter from '../components/DateRangeFilter.vue'

import { getList, frappeCall, updateDoc, applyWorkflowAction } from '../api/index.js'
import { useAuth } from '../composables/useAuth.js'
import { useRealtimeSubscriptions } from '../composables/useRealtimeSubscriptions.js'
import { formatMoney, getOrderCurrency } from '../utils/format.js'
import { normalizeOrderInPlace } from '../utils/normalizeOrder.js'
import { syncArray } from '../utils/sync.js'
import { useNotify } from '../composables/useNotify.js'
import { useLatestLogs } from '../composables/useLatestLogs.js'
import { useBadgeCounts } from '../composables/useBadgeCounts.js'
import { useEditNote } from '../composables/useEditNote.js'
import { useOrderItems } from '../composables/useOrderItems.js'
import { useQrPayment } from '../composables/useQrPayment.js'
import { useMetadata } from '../composables/useMetadata.js'
import { usePageSize } from '../components/PaginatedListLayout.vue'
import { useScrollMemory } from '../composables/useScrollMemory.js'

const { showEditNoteModal, editingOrder, openNoteEditor } = useEditNote()
const { fetchOrderItems } = useOrderItems()

const router = useRouter()
const route = useRoute()
const { user, isAccountant, isPaymentAccountant, isManagementAccountant, isChiefAccountant, isAdmin } = useAuth()
const { success, error, info, warn, confirm } = useNotify()

const isManagementOrAbove = computed(() => isAdmin.value || isChiefAccountant.value || isManagementAccountant.value)

function canActOnOrder(order) {
  return isManagementOrAbove.value || order.assigned_trader === user.value
}

const { currencyItemMap } = useMetadata()
const { showQrModal, qrValue, qrLoading, qrOrder, qrBankInfo, qrDescription, getPaymentDesc, openQrPayment } = useQrPayment(error, currencyItemMap.value)
const { assignLatestLogs, refreshLatestLogs } = useLatestLogs(() => orders.value)
const { refreshBadges } = useBadgeCounts()
const { handleScrollRestoration } = useScrollMemory()

// Reassign trader
const paymentUsers = ref([])
const reassignLoading = ref('')
const showReassignModal = ref(false)
const reassignOrder = ref(null)
const reassignTrader = ref('')

async function loadPaymentUsers() {
  try {
    paymentUsers.value = (await frappeCall('gege_custom.gege_custom.utils.get_users_with_roles', { cba_role: 'Payment' }) || []).map(u => ({
      label: u.full_name || u.email,
      value: u.email,
      description: u.full_name ? u.email : '',
    }))
  } catch {}
}

function openReassignTrader(order) {
  reassignOrder.value = order
  reassignTrader.value = order.assigned_trader || ''
  showReassignModal.value = true
}

async function saveReassignTrader() {
  const order = reassignOrder.value
  if (!order || !reassignTrader.value) return
  reassignLoading.value = order.name
  try {
    const opts = (await frappeCall('gege_custom.gege_custom.utils.get_order_bank_account_options', { doctype: 'Buy Order', name: order.name }))
      .find(o => o.user === reassignTrader.value)
    const updates = { assigned_trader: reassignTrader.value }
    if (opts?.value) updates.paid_from_trader_account = opts.value
    await frappeCall('frappe.client.set_value', { doctype: 'Buy Order', name: order.name, fieldname: updates })
    Object.assign(order, updates)
    success('Đã đổi người thanh toán')
    showReassignModal.value = false
  } catch (e) {
    error('Lỗi: ' + (e.message || e))
  } finally {
    reassignLoading.value = ''
  }
}

onActivated(() => {
  if (isManagementOrAbove.value) loadPaymentUsers()
})

const activeTab = ref(route.query.tab || 'payable')
const showSummary = ref(false)
const loading = ref(false)
const processing = ref('')
const search = ref(route.query.q || '')
const sortOrder = ref(route.query.sort || 'desc')
const filterGame = ref(route.query.game || '')
const filterItem = ref(route.query.item || '')

const completedFrom = ref('')
const completedTo = ref('')

// --- Server-side pagination state ---
const orders = ref([])
const totalItems = ref(0)
const currentPage = ref(1)
const { pageSize, setPageSize } = usePageSize('payments', 10)
const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / pageSize.value)))
const listLayout = ref(null)
function getScrollContainer() { return listLayout.value?.scrollContainer || null }
function goToPage(page) {
  const p = Math.max(1, Math.min(page, totalPages.value))
  if (p !== currentPage.value) currentPage.value = p
}
function goToDetail(order) {
  router.push(`/order/${order._orderType || (order.name.startsWith('BO') ? 'buy' : 'sell')}/${order.name}`)
}

// Summary data from server
const summary = ref({ ar_by_currency: {}, ap_by_currency: {}, ar_count: 0, ap_count: 0 })
const payableCount = ref(0)
const sellDeliveredCount = ref(0)
const completedCount = ref(0)

// ActionConfirmModal state
const actionModal = ref(false)
const actionModalData = ref({
  icon: '', title: '', subtitle: '', order: null, amount: '', amountLabel: '',
  orderStatus: '', bankLabel: 'Tài khoản', bankOptions: [],
  confirmText: '', confirmVariant: 'primary', warning: '',
  actionType: '', bankAccount: '',
})

const showOriginalQr = ref(false)

const originalQrItem = computed(() => {
  if (!qrBankInfo.value?.custom_payment_qr) return null
  return { attachment: qrBankInfo.value.custom_payment_qr }
})

const arByCurrency = computed(() => summary.value.ar_by_currency || {})
const apByCurrency = computed(() => summary.value.ap_by_currency || {})
const activeCurrencies = computed(() => {
  const curs = new Set()
  for (const cur of Object.keys(arByCurrency.value)) curs.add(cur)
  for (const cur of Object.keys(apByCurrency.value)) curs.add(cur)
  return ['VND', 'USD', 'CNY'].filter(c => curs.has(c))
})
const netByCurrency = computed(() => {
  const map = {}
  for (const cur of activeCurrencies.value) {
    map[cur] = (arByCurrency.value[cur] || 0) - (apByCurrency.value[cur] || 0)
  }
  return map
})

function goToOrder(type, name) {
  router.push(`/order/${type}/${name}`)
}

function goToDebtStatement(party, partyType) {
  router.push(`/debts/statement/${partyType}/${encodeURIComponent(party)}`)
}

function viewOriginalQr() {
  if (qrBankInfo.value?.custom_payment_qr) {
    showOriginalQr.value = true
  }
}

const BUY_ORDER_FIELDS = [
  'name', 'owner', 'creation', 'supplier', 'game_context', 'transaction_currency', 'grand_total_native',
  'status', 'workflow_state', 'linked_payment_entry', 'buy_channel',
  'assigned_trader', 'claimed_by', 'notes', 'payment_confirmed_by', 'payment_confirmed_at', 'payment_reconciled_by',
  'linked_purchase_invoice', 'outstanding_amount_native', 'debt_status',
  'payment_method', 'payment_reference_code', 'supplier_bank_account_idx',
]

const SELL_ORDER_FIELDS = [
  'name', 'owner', 'creation', 'customer', 'customer_btag_snapshot', 'customer_ingame_name_snapshot',
  'game_context', 'sale_currency', 'sell_items',
  'workflow_state', 'sell_channel', 'linked_sales_invoice', 'debt_status',
  'assigned_trader', 'claimed_by', 'notes', 'payment_proof', 'payment_reconciled_by', 'withdraw_fee_native', 'channel_fee_native', 'other_cost_native',
  'earning_native',
]

// Marketplace channels are fetched from Channel doctype
const marketplaceChannelNames = ref(new Set())
async function loadMarketplaceChannels() {
  try {
    const chs = await getList('Channel', {
      fields: ['name'],
      filters: [['is_active', '=', 1], ['custom_is_business_platform', '=', 1]],
      limit: 50,
    })
    marketplaceChannelNames.value = new Set(chs.map(c => c.name))
  } catch (e) { console.error(e) }
}
function isMarketplace(order) {
  const ch = order.buy_channel || order.sell_channel
  return marketplaceChannelNames.value.has(ch)
}

let _loadPromise = null
async function loadData(isBackground = false) {
  if (_loadPromise) return _loadPromise
  _loadPromise = (async () => {
    if (!marketplaceChannelNames.value.size) await loadMarketplaceChannels()
    if (!isAccountant.value && !isAdmin.value) return
    try {
      summary.value = await frappeCall('gege_custom.gege_custom.utils.get_payment_summary')
      await loadTabData()
    } catch (e) {
      console.error('loadData error:', e)
    } finally {
      _loadPromise = null
    }
  })()
  return _loadPromise
}

let fetchId = 0
async function loadTabData() {
  const id = ++fetchId
  loading.value = true
  try {
    const offset = (currentPage.value - 1) * pageSize.value
    const limit = pageSize.value
    const ob = `creation ${sortOrder.value}`
    const exCh = marketplaceChannelNames.value
    const exList = exCh.size ? [...exCh] : null

    let data = []

    // Counts for all tabs
    const countBuyPending = [['status', '=', 'Payment Pending']]
    const countSellDelivered = [['workflow_state', 'in', ['Delivered', 'Evidence Uploaded', 'Outstanding', 'Payment Pending']], ['is_debt_order', '=', 0]]
    const countBuyCompleted = [['status', '=', 'Completed']]
    const countSellCompleted = [['workflow_state', '=', 'Completed'], ['is_debt_order', '=', 0]]

    if (exList) {
      countBuyPending.push(['buy_channel', 'not in', exList])
      countSellDelivered.push(['sell_channel', 'not in', exList])
      countBuyCompleted.push(['buy_channel', 'not in', exList])
      countSellCompleted.push(['sell_channel', 'not in', exList])
    }

    if (isPaymentAccountant.value && !isManagementOrAbove.value) {
      countSellDelivered.push(['assigned_trader', '=', user.value])
    }

    try {
      const [cBP, cSD, cBC, cSC] = await Promise.all([
        frappeCall('gege_custom.gege_custom.utils.get_count', { doctype: 'Buy Order', filters: countBuyPending }),
        frappeCall('gege_custom.gege_custom.utils.get_count', { doctype: 'Sell Order', filters: countSellDelivered }),
        frappeCall('gege_custom.gege_custom.utils.get_count', { doctype: 'Buy Order', filters: countBuyCompleted }),
        frappeCall('gege_custom.gege_custom.utils.get_count', { doctype: 'Sell Order', filters: countSellCompleted }),
      ])
      payableCount.value = cBP || 0
      sellDeliveredCount.value = cSD || 0
      completedCount.value = (cBC || 0) + (cSC || 0)
    } catch {}

    if (activeTab.value === 'payable') {
      let filters = [['status', '=', 'Payment Pending']]
      if (filterGame.value) filters.push(['game_context', '=', filterGame.value])
      if (exList) filters.push(['buy_channel', 'not in', exList])
      const extraFilters = []
      if (search.value) {
        const supplierMatch = await searchLink('Supplier', search.value)
        if (supplierMatch.length) extraFilters.push(['supplier', 'in', supplierMatch])
      }
      const orFilters = buildSearchOr('Buy Order', extraFilters)
      const [d, c] = await Promise.all([
        getList('Buy Order', { fields: BUY_ORDER_FIELDS, filters, or_filters: orFilters, limit, offset, order_by: ob }),
        frappeCall('gege_custom.gege_custom.utils.get_count', { doctype: 'Buy Order', filters, or_filters: orFilters }),
      ])
      data = d
      data.forEach(o => { normalizeOrderInPlace(o, 'buy'); o._orderType = 'buy' })
      totalItems.value = c || 0
      payableCount.value = totalItems.value
    } else if (activeTab.value === 'receivable') {
      let filters = [['workflow_state', 'in', ['Delivered', 'Evidence Uploaded', 'Outstanding', 'Payment Pending']], ['is_debt_order', '=', 0]]
      if (filterGame.value) filters.push(['game_context', '=', filterGame.value])
      if (exList) filters.push(['sell_channel', 'not in', exList])
      if (isPaymentAccountant.value && !isManagementOrAbove.value) filters.push(['assigned_trader', '=', user.value])
      const extraFilters = []
      if (search.value) {
        const customerMatch = await searchLink('Customer', search.value)
        if (customerMatch.length) extraFilters.push(['customer', 'in', customerMatch])
      }
      const orFilters = buildSearchOr('Sell Order', extraFilters)
      const [d, c] = await Promise.all([
        getList('Sell Order', { fields: SELL_ORDER_FIELDS, filters, or_filters: orFilters, limit, offset, order_by: ob }),
        frappeCall('gege_custom.gege_custom.utils.get_count', { doctype: 'Sell Order', filters, or_filters: orFilters }),
      ])
      data = d
      data.forEach(o => { normalizeOrderInPlace(o, 'sell'); o._orderType = 'sell' })
      totalItems.value = c || 0
      sellDeliveredCount.value = totalItems.value
    } else {
      // Completed: both buy and sell
      let buyFilters = [['status', '=', 'Completed']]
      let sellFilters = [['workflow_state', '=', 'Completed'], ['is_debt_order', '=', 0]]

      if (exList) buyFilters.push(['buy_channel', 'not in', exList])
      if (exList) sellFilters.push(['sell_channel', 'not in', exList])

      if (filterGame.value) {
        buyFilters.push(['game_context', '=', filterGame.value])
        sellFilters.push(['game_context', '=', filterGame.value])
      }
      if (completedFrom.value) {
        buyFilters.push(['creation', '>=', completedFrom.value])
        sellFilters.push(['creation', '>=', completedFrom.value])
      }
      if (completedTo.value) {
        buyFilters.push(['creation', '<=', completedTo.value + 'T23:59:59'])
        sellFilters.push(['creation', '<=', completedTo.value + 'T23:59:59'])
      }

      const buyExtra = []
      const sellExtra = []
      if (search.value) {
        const [sMatch, cMatch] = await Promise.all([
          searchLink('Supplier', search.value),
          searchLink('Customer', search.value),
        ])
        if (sMatch.length) buyExtra.push(['supplier', 'in', sMatch])
        if (cMatch.length) sellExtra.push(['customer', 'in', cMatch])
      }
      const buyOr = buildSearchOr('Buy Order', buyExtra)
      const sellOr = buildSearchOr('Sell Order', sellExtra)
      const fetchLimit = limit + offset
      const [buyData, sellData, buyCount, sellCount] = await Promise.all([
        getList('Buy Order', { fields: BUY_ORDER_FIELDS, filters: buyFilters, or_filters: buyOr, limit: fetchLimit, order_by: ob }),
        getList('Sell Order', { fields: SELL_ORDER_FIELDS, filters: sellFilters, or_filters: sellOr, limit: fetchLimit, order_by: ob }),
        frappeCall('gege_custom.gege_custom.utils.get_count', { doctype: 'Buy Order', filters: buyFilters, or_filters: buyOr }),
        frappeCall('gege_custom.gege_custom.utils.get_count', { doctype: 'Sell Order', filters: sellFilters, or_filters: sellOr }),
      ])
      buyData.forEach(o => { normalizeOrderInPlace(o, 'buy'); o._orderType = 'buy' })
      sellData.forEach(o => { normalizeOrderInPlace(o, 'sell'); o._orderType = 'sell' })

      const sortDir = sortOrder.value === 'asc' ? 1 : -1
      const merged = [...buyData, ...sellData].sort((a, b) => sortDir * (new Date(a.creation) - new Date(b.creation)))
      totalItems.value = (buyCount || 0) + (sellCount || 0)
      completedCount.value = totalItems.value
      data = merged.slice(offset, offset + limit)
    }

    // Client-side item filter
    if (filterItem.value) {
      await fetchOrderItemsFor(data)
      const itemLower = filterItem.value.toLowerCase()
      data = data.filter(o =>
        (o.items || []).some(i => (i.currency_item || '').toLowerCase().includes(itemLower))
      )
    }

    // Fetch items for orders that don't have them
    const buyNoItems = data.filter(o => o.name.startsWith('BO') && !o.items)
    const sellNoItems = data.filter(o => o.name.startsWith('SO') && !o.items)
    if (buyNoItems.length || sellNoItems.length) {
      await Promise.all([
        fetchOrderItems(buyNoItems, 'Buy Order'),
        fetchOrderItems(sellNoItems, 'Sell Order'),
      ])
    }

    // Fetch party social links
    const sellCustomers = [...new Set(data.filter(o => o.name.startsWith('SO')).map(o => o.customer).filter(Boolean))]
    const buySuppliers = [...new Set(data.filter(o => o.name.startsWith('BO')).map(o => o.supplier).filter(Boolean))]
    const parties = [...new Set([...sellCustomers, ...buySuppliers])]
    if (parties.length) {
      try {
        const partyInfo = await frappeCall('gege_custom.gege_custom.utils.get_party_social_links', { parties })
        for (const o of data) {
          if (o.name.startsWith('SO') && o.customer && partyInfo[o.customer]) o._partyInfo = partyInfo[o.customer]
          if (o.name.startsWith('BO') && o.supplier && partyInfo[o.supplier]) o._partyInfo = partyInfo[o.supplier]
        }
      } catch (e) { console.error('get_party_social_links error:', e) }
    }

    syncArray(orders.value, data)
    await assignLatestLogs()
  } catch (e) {
    if (fetchId !== id) return
    console.error('loadTabData error:', e)
    syncArray(orders.value, [])
    totalItems.value = 0
  } finally {
    if (fetchId !== id) return
    loading.value = false
  }
}

async function fetchOrderItemsFor(orders) {
  const buyOrders = orders.filter(o => o.name.startsWith('BO'))
  const sellOrders = orders.filter(o => o.name.startsWith('SO'))
  await Promise.all([
    fetchOrderItems(buyOrders, 'Buy Order'),
    fetchOrderItems(sellOrders, 'Sell Order'),
  ])
}

async function searchLink(doctype, txt) {
  if (!txt) return []
  try {
    const params = { doctype, txt, page_length: 50 }
    if (doctype === 'Supplier') params.searchfields = 'name\nsupplier_name'
    return (await frappeCall('frappe.desk.search.search_link', params) || []).map(r => r.value)
  } catch { return [] }
}

function buildSearchOr(doctype, extraFilters = []) {
  if (!search.value) return null
  const t = `%${search.value}%`
  const isNumeric = !isNaN(search.value) && search.value.trim() !== ''
  const commonFields = ['name', 'game_context', 'assigned_trader', 'claimed_by', 'notes']
  const fields = doctype === 'Sell Order'
    ? [...commonFields, 'customer', 'customer_btag_snapshot', 'customer_ingame_name_snapshot', 'sell_channel']
    : [...commonFields, 'supplier', 'buy_channel', 'payment_reconciled_by']
  const orFilters = fields.map(f => [f, 'like', t])
  if (isNumeric) {
    const numericFields = doctype === 'Sell Order'
      ? ['earning_native']
      : ['grand_total_native', 'outstanding_amount_native']
    orFilters.push(...numericFields.map(f => [f, 'like', t]))
  }
  for (const f of extraFilters) orFilters.push(f)
  return orFilters
}

// Re-fetch when page or size changes
watch([currentPage, pageSize], () => loadTabData())
watch([activeTab, filterGame, filterItem, search, sortOrder, completedFrom, completedTo], () => {
  if (currentPage.value === 1) loadTabData()
  currentPage.value = 1
})

async function openActionModal({ order, actionType, icon, title, subtitle, confirmText, confirmVariant, bankLabel, bankDoctype, warning }) {
  const cur = getOrderCurrency(order)
  const rawAmt = order.name?.startsWith('BO')
    ? (order.total_vnd || order.grand_total_native)
    : (order.earning_vnd || order.gross_sale_vnd)
  const amt = rawAmt ? formatMoney(rawAmt, cur) : ''
  let bankOptions = []

  if (bankDoctype) {
    try {
      const opts = await frappeCall('gege_custom.gege_custom.utils.get_order_bank_account_options', {
        doctype: bankDoctype, name: order.name,
      })
      bankOptions = opts.map(o => ({ label: o.label, value: o.value }))
    } catch {}
  }

  actionModalData.value = {
    icon, title, subtitle: subtitle || '',
    order, amount: amt,
    amountLabel: order.name?.startsWith('BO') ? 'Số tiền' : 'Thực nhận',
    orderStatus: order.workflow_state || order.status || '',
    bankLabel: bankLabel || 'Tài khoản',
    bankOptions,
    confirmText: confirmText || 'Xác nhận',
    confirmVariant: confirmVariant || 'primary',
    warning: warning || '',
    actionType,
    bankAccount: order.paid_from_trader_account || '',
  }
  actionModal.value = true
}

async function handleActionConfirm({ bankAccount }) {
  const d = actionModalData.value
  const order = d.order
  if (!order) return

  actionModal.value = false
  processing.value = order.name
  try {
    if (d.actionType === 'markPaid') {
      const acct = bankAccount || order.paid_from_trader_account
      if (isManagementOrAbove.value && !acct) { error('Vui lòng chọn tài khoản thanh toán'); return }
      const result = await frappeCall('gege_custom.gege_custom.api.debt.pay_buy_order_now', {
        buy_order_name: order.name, bank_account: acct || '',
      })
      success(`Thanh toán thành công! PI: ${result.purchase_invoice}, PE: ${result.payment_entry}`)
      showQrModal.value = false
    } else if (d.actionType === 'completeBuy') {
      const result = await frappeCall('gege_custom.gege_custom.api.debt.pay_buy_order_now', {
        buy_order_name: order.name, bank_account: bankAccount,
      })
      success(`Thanh toán & hoàn thành! PE: ${result.payment_entry || 'OK'}`)
    } else if (d.actionType === 'confirmSellPayment') {
      if (bankAccount) await updateDoc('Sell Order', order.name, { paid_to_trader_account: bankAccount })
      await applyWorkflowAction('Sell Order', order.name, 'Confirm Payment')
      success('Đã xác nhận thanh toán — đơn chuyển sang Queue')
    } else if (d.actionType === 'completeSell') {
      const params = { sell_order_name: order.name }
      if (bankAccount) params.bank_account = bankAccount
      const result = await frappeCall('gege_custom.gege_custom.api.debt.complete_sell_order', params)
      const parts = ['Đã hoàn thành!']
      if (result.sales_invoice) parts.push(`SI: ${result.sales_invoice}`)
      if (result.payment_entry) parts.push(`PE: ${result.payment_entry}`)
      if (result.advance_consumed) parts.push(`(đã tự động trừ tạm ứng ${formatMoney(result.advance_consumed, 'VND')})`)
      success(parts.join(' '))
    } else if (d.actionType === 'convertBuyDebt') {
      const result = await frappeCall('gege_custom.gege_custom.api.debt.convert_buy_order_to_debt', {
        buy_order_name: order.name,
      })
      success(`Đã tạo công nợ! PI: ${result.purchase_invoice}${result.advance_consumed ? ` (đã tự động trừ tạm ứng ${formatMoney(result.advance_consumed, 'VND')})` : ''}`)
    } else if (d.actionType === 'convertSellDebt') {
      const result = await frappeCall('gege_custom.gege_custom.api.debt.convert_sell_order_to_debt', {
        sell_order_name: order.name,
      })
      success(`Đã tạo công nợ! SI: ${result.sales_invoice}${result.advance_consumed ? ` (đã tự động trừ tạm ứng ${formatMoney(result.advance_consumed, 'VND')})` : ''}`)
    }
    await loadData()
    refreshBadges()
  } catch (e) {
    error('Lỗi: ' + (e.message || e))
  } finally {
    processing.value = ''
  }
}

async function markPaid(order) {
  showQrModal.value = false
  await Promise.resolve()
  openActionModal({ order, actionType: 'markPaid', icon: '💳', title: 'Xác nhận thanh toán',
    subtitle: 'Xác nhận đã chuyển khoản cho đơn hàng', confirmText: 'Xác nhận thanh toán',
    bankLabel: 'Tài khoản thanh toán', bankDoctype: 'Buy Order' })
}

async function completeBuyOrder(order) {
  if (isMarketplace(order)) {
    openActionModal({ order, actionType: 'completeBuy', icon: '✅', title: 'Hoàn thành & Thanh toán',
      subtitle: 'Thanh toán qua ví nền tảng', confirmText: 'Hoàn thành', warning: 'Sẽ tự động thanh toán qua ví nền tảng' })
  } else {
    openActionModal({ order, actionType: 'completeBuy', icon: '✅', title: 'Hoàn thành & Thanh toán',
      subtitle: 'Chọn tài khoản thanh toán', confirmText: 'Hoàn thành',
      bankLabel: 'Tài khoản thanh toán', bankDoctype: 'Buy Order' })
  }
}

async function convertToDebt(order) {
  openActionModal({ order, actionType: 'convertBuyDebt', icon: '📋', title: 'Tạo công nợ',
    subtitle: 'Đơn sẽ chuyển sang theo dõi công nợ', confirmText: 'Tạo công nợ',
    confirmVariant: 'warning' })
}

async function convertSellToDebt(order) {
  openActionModal({ order, actionType: 'convertSellDebt', icon: '📋', title: 'Tạo công nợ',
    subtitle: 'Khách hàng sẽ theo dõi công nợ', confirmText: 'Tạo công nợ',
    confirmVariant: 'warning' })
}

async function completeSellOrder(order) {
  if (isMarketplace(order)) {
    openActionModal({ order, actionType: 'completeSell', icon: '✅', title: 'Hoàn thành đơn bán',
      subtitle: 'Tiền sẽ vào ví nền tảng', confirmText: 'Hoàn thành',
      warning: 'Sẽ tự động nhận tiền qua ví nền tảng' })
  } else {
    openActionModal({ order, actionType: 'completeSell', icon: '✅', title: 'Hoàn thành đơn bán',
      subtitle: 'Chọn tài khoản nhận tiền', confirmText: 'Hoàn thành',
      bankLabel: 'Tài khoản nhận tiền', bankDoctype: 'Sell Order' })
  }
}

async function confirmSellPayment(order) {
  if (order.assigned_trader === user.value) {
    processing.value = order.name
    try {
      await applyWorkflowAction('Sell Order', order.name, 'Confirm Payment')
      success('Đã xác nhận thanh toán — đơn chuyển sang Queue')
      await loadData()
      refreshBadges()
    } catch (e) {
      error('Lỗi: ' + (e.message || e))
    } finally {
      processing.value = ''
    }
    return
  }
  openActionModal({ order, actionType: 'confirmSellPayment', icon: '💰', title: 'Xác nhận đã nhận tiền',
    subtitle: `Xác nhận nhận tiền thay cho ${order.assigned_trader || '—'}`, confirmText: 'Xác nhận',
    bankLabel: 'Tài khoản nhận tiền', bankDoctype: 'Sell Order' })
}

const debouncedLoadData = debounce(loadData, 5000)

const { connected } = useRealtimeSubscriptions(
  {
    'Buy Order': () => {},
    'Sell Order': () => {},
    'Payment Entry': () => {},
    'Order Log': () => {},
  },
  { onMount: () => new Promise(resolve => setTimeout(async () => { await loadData(); resolve() }, 100)) }
)

onActivated(async () => {
  if (isAccountant.value || isAdmin.value) {
    loadData(true)
    refreshLatestLogs()
  }
  handleScrollRestoration({ container: getScrollContainer() })
})
</script>
