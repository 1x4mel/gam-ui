<template>
  <div class="h-full">
  <PaginatedListLayout
    ref="listLayout"
    :total-items="totalCount"
    :current-page="currentPage"
    :total-pages="totalPages"
    :page-size="pageSize"
    @update:current-page="goToPage"
    @update:page-size="setPageSize"
  >
    <template #header>
      <PageHeader
        :title="activeTab === 'attention' ? '⚠️ Cần Xử Lý' : activeTab === 'active' ? '⚡ Đang Hoạt Động' : '🕓 Lịch Sử'"
        subtitle="Quản lý đơn hàng toàn hệ thống"
        :connected="connected"
        @refresh="() => loadPage(false)"
      />
    </template>

    <template #filters>
      <OrderListFilters
        :orders="orders"
        v-model:search="search"
        v-model:filter-game="filterGame"
        v-model:filter-item="filterItem"
        v-model:filter-type="filterType"
        v-model:sort-order="sortOrder"
        v-model:filter-status="activeStatus"
        :show-order-type-tabs="true"
        :show-order-type-filter="false"
        :status-options="statusFilters"
        :status-counts="statusCounts"
        :order-type-counts="{ sell: sellCount, buy: buyCount }"
      />
    </template>

    <div class="max-w-6xl mx-auto px-4">
    <!-- Loading -->
    <LoadingSpinner v-if="loading" text="Đang tải..." />

    <!-- Empty -->
    <EmptyState v-else-if="orders.length === 0" icon="📭" text="Không có đơn nào" />

    <!-- Order List -->
    <div v-else class="space-y-4">
      <OrderCard
        v-for="order in orders"
        :key="order.name"
        :order="order"
        :order-type="getOrderType(order.name)"
        @edit-note="openNoteEditor"
      >
        <template #actions>
          <!-- Cancellation Requested: 2 buttons + detail -->
          <template v-if="order.status === 'Cancellation Requested'">
            <AppButton variant="danger-ghost" size="sm" pill :disabled="processing === order.name" @click.stop="approveCancel(order)">✅ Duyệt hủy</AppButton>
            <AppButton variant="warning-ghost" size="sm" pill :disabled="processing === order.name" @click.stop="rejectToQueue(order)">Không duyệt → Trả Queue</AppButton>
            <AppButton variant="ghost" size="sm" pill @click.stop="goToDetail(order)">Chi tiết →</AppButton>
          </template>
          <!-- Active: unclaim + detail -->
          <template v-else>
            <AppButton v-if="['Claimed', 'In Delivery', 'Receiving', 'Evidence Uploaded'].includes(order.status)"
              variant="warning-ghost" size="sm" pill :disabled="processing === order.name" @click.stop="rejectToQueue(order)">Thu hồi trả Queue</AppButton>
            <AppButton variant="ghost" size="sm" pill @click.stop="goToDetail(order)">Chi tiết →</AppButton>
          </template>
        </template>
      </OrderCard>
    </div>
    </div>
  </PaginatedListLayout>

  <!-- Edit Note Modal -->
  <EditNoteModal
    v-model="showEditNoteModal"
    :order="editingOrder"
    @saved="() => loadPage(true)"
  />
  </div>
</template>

<script setup>
defineOptions({ name: 'T1OrdersView' })
import { ref, computed, watch, onActivated, onDeactivated, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { debounce } from 'lodash-es'
import OrderCard from '../components/OrderCard.vue'
import AppButton from '../components/AppButton.vue'
import OrderListFilters from '../components/OrderListFilters.vue'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import EditNoteModal from '../components/EditNoteModal.vue'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import { frappeCall } from '../api/index.js'
import { normalizeOrderInPlace } from '../utils/normalizeOrder.js'
import { useAuth } from '../composables/useAuth.js'
import { useNotify } from '../composables/useNotify.js'
import { useRealtimeSubscriptions } from '../composables/useRealtimeSubscriptions.js'
import { useOrderUrlSync } from '../composables/useOrderUrlSync.js'
import { useEditNote } from '../composables/useEditNote.js'
import { useWorkflowAction } from '../composables/useWorkflowAction.js'
import { getOrderType } from '../utils/format.js'
import { useMetadata } from '../composables/useMetadata.js'

const router = useRouter()
const route = useRoute()
const { user } = useAuth()
const { fetchMetadata } = useMetadata()
const { success, error } = useNotify()
const { showEditNoteModal, editingOrder, openNoteEditor } = useEditNote()

const loading = ref(false)
const orders = ref([])
const totalCount = ref(0)
const statusCounts = ref({})
const sellCount = ref(0)
const buyCount = ref(0)
const currentPage = ref(1)
const pageSize = ref(30)
const activeStatus = ref(route.query.status || '')
const search = ref(route.query.q || '')
const filterGame = ref(route.query.game || '')
const filterItem = ref(route.query.item || '')
const filterType = ref(route.query.type || '')
const sortOrder = ref(route.query.sort || 'desc')
const { processing, execute } = useWorkflowAction()

const listLayout = ref(null)
const getScrollContainer = () => listLayout.value?.scrollContainer

// Detect active tab from route name
const activeTab = ref('active')
watch(() => route.name, (newName) => {
  if (newName === 'T1AttentionView') activeTab.value = 'attention'
  else if (newName === 'T1HistoryView') activeTab.value = 'history'
  else if (newName === 'T1ActiveView') activeTab.value = 'active'
}, { immediate: true })

// Reload when tab changes
watch(activeTab, () => { currentPage.value = 1; loadPage(false) })

const statusFilters = computed(() => {
  if (activeTab.value === 'attention') {
    return [
      { key: '', label: 'Tất cả Cần xử lý' },
      { key: 'Cancellation Requested', label: 'Yêu cầu Hủy' },
    ]
  }
  if (activeTab.value === 'active') {
    return [
      { key: '', label: 'Tất cả Đang chạy' },
      { key: 'Queued', label: 'Chờ nhận' },
      { key: 'Pending ML', label: 'Chờ ML duyệt' },
      { key: 'Claimed', label: 'Đã nhận' },
      { key: 'In Delivery', label: 'Đang giao' },
      { key: 'Receiving', label: 'Đang nhận' },
      { key: 'Evidence Uploaded', label: 'Đã nộp bằng chứng' },
      { key: 'Payment Pending', label: 'Chờ Kế Toán' },
      { key: 'Outstanding', label: 'Công nợ' },
      { key: 'Delivered', label: 'Đã giao' },
    ]
  }
  return [
    { key: '', label: 'Tất cả Lịch sử' },
    { key: 'Completed', label: 'Hoàn thành' },
    { key: 'Cancelled', label: 'Đã hủy' },
    { key: 'Failed', label: 'Thất bại' },
    { key: 'Disputed', label: 'Tranh chấp' },
  ]
})

useOrderUrlSync({
  storageKey: 'gege_t1_filters',
  routeNames: ['T1AttentionView', 'T1ActiveView', 'T1HistoryView'],
  params: { activeStatus, search, filterGame, filterItem, filterType, sortOrder },
  queryMap: { search: 'q', sortOrder: 'sort', activeStatus: 'status' },
  defaults: { sortOrder: 'desc', filterType: '' },
})

const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize.value)))

function goToPage(page) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  loadPage(true)
}

function setPageSize(size) {
  pageSize.value = size
  currentPage.value = 1
  loadPage(false)
}

let _loadPromise = null
async function loadPage(isBackground = false) {
  if (!user.value || user.value === 'Guest') return
  if (_loadPromise) return _loadPromise
  _loadPromise = (async () => {
    if (!isBackground) loading.value = true
    try {
      const result = await frappeCall('gege_custom.gege_custom.utils.get_t1_orders', {
        tab: activeTab.value,
        page: currentPage.value,
        page_size: pageSize.value,
        search: search.value || undefined,
        game: filterGame.value || undefined,
        status: activeStatus.value || undefined,
        order_type: filterType.value || undefined,
      })
      const data = result.data || []
      data.forEach(o => normalizeOrderInPlace(o, o._is_buy ? 'buy' : 'sell'))
      orders.value = data
      totalCount.value = result.total_count || 0
      statusCounts.value = result.status_counts || {}
      sellCount.value = result.sell_count || 0
      buyCount.value = result.buy_count || 0
    } catch (e) {
      console.error('T1OrdersView loadPage error:', e)
    } finally {
      loading.value = false
      _loadPromise = null
    }
  })()
  return _loadPromise
}

// Debounced search reload
const debouncedSearchLoad = debounce(() => { currentPage.value = 1; loadPage(false) }, 500)
watch(search, () => debouncedSearchLoad())
watch([filterGame, filterItem, filterType, activeStatus], () => { currentPage.value = 1; loadPage(false) })

function goToDetail(order) {
  const type = order._is_buy ? 'buy' : 'sell'
  router.push({ path: `/order/${type}/${order.name}` })
}

// --- Inline Actions for Cancel Approval ---
function approveCancel(order) {
  execute(order, 'Approve Cancel', {
    after: async () => { await loadPage(true); success('Đã chấp nhận hủy đơn') },
    onError: e => error('Lỗi: ' + e.message),
  })
}

function rejectToQueue(order) {
  const action = order.status === 'Cancellation Requested' ? 'Reject to Queue' : 'Unclaim'
  execute(order, action, {
    after: async () => { await loadPage(true); success('Thao tác thành công') },
    onError: e => error('Lỗi: ' + e.message),
  })
}

// --- Realtime: smart local updates, no full reload ---
const TAB_STATUSES = {
  attention: ['Cancellation Requested'],
  active: ['Queued', 'Pending ML', 'Claimed', 'In Delivery', 'Receiving', 'Evidence Uploaded', 'Payment Pending', 'Outstanding', 'Delivered'],
  history: ['Completed', 'Cancelled', 'Failed', 'Disputed', 'Refunded', 'Partially Refunded'],
}
function statusBelongsToCurrentTab(status) {
  return (TAB_STATUSES[activeTab.value] || TAB_STATUSES.active).includes(status)
}

async function fetchSingleOrder(name, isBuy) {
  try {
    const doctype = isBuy ? 'Buy Order' : 'Sell Order'
    let order
    if (isBuy) {
      const rows = frappe.db.sql === undefined ? [] : []
      const result = await frappeCall('frappe.client.get_list', {
        doctype,
        fields: ['name', 'status', 'creation', 'modified', 'owner', 'supplier', 'assigned_trader', 'claimed_by', 'game_context', 'buy_channel', 'transaction_currency', 'grand_total_native', 'game_account', 'notes', 'debt_status', 'outstanding_amount_native', 'is_negotiation', 'negotiation_status', 'price_set_by', 'price_set_at'],
        filters: [['name', '=', name]],
        limit: 1,
      })
      if (!result.length) return
      order = result[0]
    } else {
      const result = await frappeCall('frappe.client.get_list', {
        doctype,
        fields: ['name', 'workflow_state', 'creation', 'modified', 'owner', 'customer', 'claimed_by', 'game_context', 'sell_channel', 'sale_currency', 'earning_native', 'order_url', 'customer_btag_snapshot', 'customer_ingame_name_snapshot', 'notes', 'order_item_title', 'order_quantity', 'debt_status', 'outstanding_amount_native', 'is_negotiation', 'negotiation_status', 'price_set_by', 'price_set_at'],
        filters: [['name', '=', name]],
        limit: 1,
      })
      if (!result.length) return
      order = result[0]
      order.status = order.workflow_state
    }
    order._doctype = doctype
    order._is_buy = isBuy
    normalizeOrderInPlace(order, isBuy ? 'buy' : 'sell')

    // Fetch items
    const itemDoctype = isBuy ? 'Buy Order Item' : 'Sell Order Item'
    const itemFields = isBuy
      ? ['parent', 'currency_item', 'quantity', 'unit_price', 'target_game_account']
      : ['parent', 'currency_item', 'quantity', 'unit_price']
    const items = await frappeCall('frappe.client.get_list', {
      doctype: itemDoctype, fields: itemFields,
      filters: [['parent', '=', name]], limit: 50,
    })
    // Enrich currency_item_name
    if (items.length) {
      const ciIds = [...new Set(items.map(i => i.currency_item).filter(Boolean))]
      if (ciIds.length) {
        const ciMap = {}
        const ciRows = await frappeCall('frappe.client.get_list', {
          doctype: 'Currency Item', fields: ['name', 'item_name'],
          filters: [['name', 'in', ciIds]],
        })
        ciRows.forEach(c => { ciMap[c.name] = c.item_name })
        items.forEach(i => { if (i.currency_item) i.currency_item_name = ciMap[i.currency_item] })
      }
    }
    order.items = items

    // Party info
    const party = order.supplier || order.customer
    if (party) {
      const partyDoctype = isBuy ? 'Supplier' : 'Customer'
      const partyFields = isBuy
        ? ['name', 'supplier_name', 'custom_facebook_url', 'custom_discord_url']
        : ['name', 'customer_name', 'custom_facebook_url', 'custom_discord_url']
      try {
        const pDoc = await frappeCall('frappe.client.get_list', {
          doctype: partyDoctype, fields: partyFields,
          filters: [['name', '=', party]], limit: 1,
        })
        if (pDoc.length) {
          const p = pDoc[0]
          order._partyInfo = { name: p.supplier_name || p.customer_name || p.name, url: p.custom_facebook_url || p.custom_discord_url || '' }
        }
      } catch {}
    }

    // Prepend to list
    orders.value.unshift(order)
    totalCount.value += 1
  } catch (e) {
    console.error('fetchSingleOrder error:', e)
  }
}

function handleRealtimeUpdate(data) {
  if (!data.name) return
  const isBuy = data._is_buy != null ? data._is_buy : data.doctype === 'Buy Order'
  const newStatus = data.status || data.workflow_state
  const idx = orders.value.findIndex(o => o.name === data.name)

  if (idx !== -1) {
    // Order exists in list
    if (newStatus && !statusBelongsToCurrentTab(newStatus)) {
      // Status changed out of current tab — remove
      orders.value.splice(idx, 1)
      totalCount.value = Math.max(0, totalCount.value - 1)
    } else if (data.items && data.items.length) {
      // Enriched payload: full in-place update (0 API calls)
      const order = orders.value[idx]
      if (newStatus) { order.status = newStatus; order.workflow_state = newStatus }
      if (data.claimed_by != null) order.claimed_by = data.claimed_by
      if (data.assigned_trader) order.assigned_trader = data.assigned_trader
      if (data.game_account) order.game_account = data.game_account
      if (data.notes !== undefined) order.notes = data.notes
      if (data.is_negotiation != null) order.is_negotiation = data.is_negotiation
      if (data.negotiation_status) order.negotiation_status = data.negotiation_status
      if (data.price_set_by) order.price_set_by = data.price_set_by
      if (data.price_set_at) order.price_set_at = data.price_set_at
      order.items = data.items
      normalizeOrderInPlace(order, isBuy ? 'buy' : 'sell')
    } else {
      // Basic payload: update only available fields
      if (newStatus) { orders.value[idx].status = newStatus; orders.value[idx].workflow_state = newStatus }
      if (data.claimed_by != null) orders.value[idx].claimed_by = data.claimed_by
      if (data.assigned_trader) orders.value[idx].assigned_trader = data.assigned_trader
    }
  } else {
    // New order not in list
    if (newStatus && statusBelongsToCurrentTab(newStatus)) {
      if (data.items && data.items.length) {
        // Enriched payload: construct order directly (0 API calls)
        const order = { ...data, _doctype: data.doctype, _is_buy: isBuy }
        if (data.workflow_state && !data.status) order.status = data.workflow_state
        normalizeOrderInPlace(order, isBuy ? 'buy' : 'sell')
        orders.value.unshift(order)
        totalCount.value += 1
      } else {
        // Fallback: fetch full data (legacy)
        fetchSingleOrder(data.name, isBuy)
      }
    }
  }
}

const { connected, on: onRealtime } = useRealtimeSubscriptions(
  {
    'Sell Order': handleRealtimeUpdate,
    'Buy Order': handleRealtimeUpdate,
  },
)
if (onRealtime) onRealtime('gege_order_update', handleRealtimeUpdate)

onActivated(() => {
  fetchMetadata()
  loadPage(true)
})
</script>
