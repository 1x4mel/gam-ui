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
        :title="activeMain === 'queue' ? 'Hàng chờ' : activeMain === 'mine' ? 'Đơn của tôi' : activeMain === 'history' ? 'Lịch sử' : 'Vấn đề'"
        subtitle="Quản lý đơn theo thời gian thực"
        :connected="connected"
        @refresh="() => refresh()"
      />
    </template>

    <template #filters>
      <OrderListFilters
        :orders="orders"
        v-model:search="search"
        v-model:filter-game="filterGame"
        v-model:filter-item="filterItem"
        v-model:filter-type="activeSub"
        v-model:sort-order="sortOrder"
        v-model:filter-status="filterStatus"
        v-model:date-from="dateFrom"
        v-model:date-to="dateTo"
        :show-order-type-tabs="true"
        :show-date-filter="true"
        :status-options="statusTabs"
        :status-counts="statusCounts"
        :order-type-counts="{ sell: sellCount, buy: buyCount }"
        order-type-all-key="both"
      />
    </template>

    <div class="max-w-6xl mx-auto px-4">
    <!-- Loading -->
    <LoadingSpinner v-if="loading" text="Đang tải..." />

    <!-- Empty -->
    <EmptyState v-else-if="orders.length === 0" icon="📭" :text="emptyMessage" />

    <!-- Order List -->
    <div v-else class="space-y-4">
      <OrderCard
        v-for="order in orders"
          :key="order.name"
          :order="order"
          :order-type="getOrderType(order.name)"
          @edit-note="openNoteEditor"
          @drop-evidence="handleDropEvidence"
          @dblclick="goToDetail(order)"
          @items-updated="handleItemsUpdated"
        >
          <template #actions>
            <!-- ===== QUEUE: Claim ===== -->
            <template v-if="activeMain === 'queue'">
              <AppButton variant="primary" size="sm" pill :loading="processing === order.name" @click.stop="claimOrder(order)">📥 Nhận đơn</AppButton>
              <AppButton variant="ghost" size="sm" pill @click.stop="goToDetail(order)">Chi tiết →</AppButton>
            </template>

              <!-- ===== MY ORDERS: Status-based actions ===== -->
            <template v-else-if="activeMain === 'mine'">
              <template v-if="canActOnOrder(order) && order.name.startsWith('SO') && order.status === 'Claimed'">
                <AppButton variant="orange" size="sm" pill :loading="processing === order.name" @click.stop="openStartDelivery(order)">🚀 Bắt đầu giao</AppButton>
                <AppButton variant="danger-ghost" size="sm" pill :loading="processing === order.name" @click.stop="requestCancel(order)">Yêu cầu hủy</AppButton>
                <AppButton variant="warning-ghost" size="sm" pill :loading="processing === order.name" @click.stop="unclaimOrder(order)">Trả Queue</AppButton>
              </template>

              <template v-else-if="canActOnOrder(order) && order.name.startsWith('SO') && order.status === 'In Delivery'">
                <AppButton variant="primary" size="sm" pill @click.stop="openEvidence(order)">📸 Tải bằng chứng</AppButton>
                <AppButton variant="danger-ghost" size="sm" pill :loading="processing === order.name" @click.stop="requestCancel(order)">Yêu cầu hủy</AppButton>
                <AppButton variant="warning-ghost" size="sm" pill :loading="processing === order.name" @click.stop="unclaimOrder(order)">Trả Queue</AppButton>
              </template>

              <template v-else-if="canActOnOrder(order) && order.name.startsWith('SO') && order.status === 'Evidence Uploaded'">
                <AppButton variant="primary" size="sm" pill @click.stop="openEvidence(order)">📸 Thêm bằng chứng</AppButton>
                <AppButton variant="success" size="sm" pill :loading="processing === order.name" @click.stop="transition(order, 'Deliver')">✅ Đã giao</AppButton>
              </template>

              <template v-else-if="canActOnOrder(order) && order.name.startsWith('BO') && order.status === 'Claimed'">
                <AppButton variant="orange" size="sm" pill :loading="processing === order.name" @click.stop="transition(order, 'Start Receiving')">📦 Bắt đầu nhận</AppButton>
                <AppButton variant="danger-ghost" size="sm" pill :loading="processing === order.name" @click.stop="requestCancel(order)">Yêu cầu hủy</AppButton>
                <AppButton variant="warning-ghost" size="sm" pill :loading="processing === order.name" @click.stop="unclaimOrder(order)">Trả Queue</AppButton>
              </template>

              <template v-else-if="canActOnOrder(order) && order.name.startsWith('BO') && order.status === 'Receiving'">
                <AppButton variant="primary" size="sm" pill @click.stop="openEvidence(order)">📸 Tải bằng chứng</AppButton>
                <AppButton variant="warning-ghost" size="sm" pill :loading="processing === order.name" @click.stop="unclaimOrder(order)">Trả Queue</AppButton>
              </template>
              <template v-else-if="canActOnOrder(order) && order.name.startsWith('BO') && order.status === 'Evidence Uploaded'">
                <AppButton variant="primary" size="sm" pill @click.stop="openEvidence(order)">📸 Thêm bằng chứng</AppButton>
                <AppButton variant="success" size="sm" pill :loading="processing === order.name" @click.stop="transition(order, 'Mark Received')">✅ Đã nhận</AppButton>
              </template>

              <AppButton v-else-if="order.name.startsWith('SO') && (order.status === 'Evidence Uploaded' || order.status === 'Delivered') && (isAdmin || isAccountant)"
                variant="primary" size="sm" pill :loading="processing === order.name" @click.stop="transition(order, 'Complete')">✅ Xác nhận & Hoàn thành</AppButton>
              <AppButton v-else-if="order.status === 'Payment Pending' && (isAdmin || isAccountant)"
                variant="primary" size="sm" pill @click.stop="openQrPayment(order)">💸 Thanh toán QR</AppButton>

              <AppButton variant="ghost" size="sm" pill @click.stop="goToDetail(order)">Chi tiết →</AppButton>
            </template>

            <!-- ===== ISSUES: Cancellation Requested + View Detail ===== -->
            <template v-else-if="activeMain === 'issues'">
              <template v-if="order.status === 'Cancellation Requested'">
                <AppButton variant="danger" size="sm" pill :loading="processing === order.name" @click.stop="transition(order, 'Approve Cancel')">Duyệt hủy</AppButton>
                <AppButton variant="warning-ghost" size="sm" pill :loading="processing === order.name" @click.stop="transition(order, 'Reject to Queue')">Không duyệt → Queue</AppButton>
                <AppButton variant="ghost" size="sm" pill :loading="processing === order.name" @click.stop="transition(order, 'Reject Cancel')">Từ chối hủy</AppButton>
              </template>
              <AppButton variant="ghost" size="sm" pill @click.stop="goToDetail(order)">Chi tiết →</AppButton>
            </template>

            <!-- ===== HISTORY: View Evidence ===== -->
            <template v-else>
              <AppButton variant="ghost" size="sm" pill @click.stop="openViewEvidence(order)">📋 Bằng chứng</AppButton>
              <AppButton variant="ghost" size="sm" pill @click.stop="goToDetail(order)">Chi tiết →</AppButton>
            </template>
          </template>
        </OrderCard>
      </div>
    </div>
    </PaginatedListLayout>

    <!-- ============ VIEW EVIDENCE MODAL ============ -->
      <ModalWrapper v-model="viewEvidenceModal" size="md">
        <template #header>
          <div class="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-app-border">
            <h3 class="text-app-text-primary font-semibold text-sm truncate">
              Bằng chứng — {{ viewEvidenceOrder?.name }}
            </h3>
            <button @click="closeViewEvidence" class="text-app-text-muted hover:text-app-text-primary transition">
              ✕
            </button>
          </div>
        </template>

        <div class="p-4 sm:p-5">
          <div v-if="evidenceLoading" class="text-center py-8 text-app-text-muted text-sm">
            Đang tải...
          </div>
          <div v-else-if="evidenceList.length === 0" class="text-center py-8 text-app-text-muted text-sm">
            Không có bằng chứng
          </div>
          <div v-else class="space-y-4">
            <div
              v-for="ev in evidenceList"
              :key="ev.name"
              class="bg-app-bg border border-app-border rounded-lg overflow-hidden"
            >
              <!-- Preview -->
              <div
                v-if="ev.attachment && isImage(ev.attachment)"
                class="cursor-pointer relative group"
                @click="openLightbox(ev)"
              >
                <img
                  :src="ev.attachment"
                  class="w-full max-h-48 object-cover"
                />
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                  <span class="opacity-0 group-hover:opacity-100 text-white text-xs bg-black/50 px-3 py-1.5 rounded-lg transition">
                    Click để xem lớn
                  </span>
                </div>
              </div>
              <div
                v-else-if="ev.attachment && isVideo(ev.attachment)"
                class="cursor-pointer relative group"
                @click="openLightbox(ev)"
              >
                <video
                  :src="ev.attachment"
                  class="w-full max-h-48 object-cover"
                  muted
                />
                <div class="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <span class="text-white text-2xl">▶</span>
                </div>
              </div>
              <div
                v-else-if="ev.attachment"
                class="px-4 py-6 text-center text-app-text-muted"
              >
                📎 {{ ev.attachment.split('/').pop() }}
              </div>

              <!-- Meta -->
              <div class="px-4 py-2.5 flex items-center gap-3">
                <span class="text-xs px-1.5 py-0.5 rounded bg-app-surface border border-app-border text-app-text-secondary">{{ isImage(ev.attachment) ? 'Ảnh' : isVideo(ev.attachment) ? 'Video' : 'File' }}</span>
                <span v-if="ev.note" class="text-app-text-secondary text-xs truncate flex-1" v-html="linkify(ev.note)"></span>
                <span class="text-app-text-muted text-xs">{{ formatDate(ev.uploaded_at) }}</span>

                <!-- Download -->
                <a
                  v-if="ev.attachment"
                  :href="ev.attachment"
                  download
                  class="shrink-0 px-2 py-1 text-xs bg-app-surface hover:bg-indigo-500/10 text-app-text-secondary hover:text-indigo-600 rounded border border-app-border transition"
                  @click.stop
                >
                  Tải về
                </a>
              </div>
            </div>
          </div>
        </div>
      </ModalWrapper>

      <!-- ============ LIGHTBOX ============ -->
      <MediaLightbox v-model:open="lightboxOpen" :item="lightboxItem" />

      <!-- ============ UPLOAD EVIDENCE MODAL ============ -->
      <ModalWrapper v-model="evidenceModal" size="lg">
        <template #header>
          <h3 class="text-app-text-primary font-bold text-lg px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b border-app-border">
            Tải bằng chứng - {{ evidenceOrder?.name }}
          </h3>
        </template>

        <div class="p-4 sm:p-6">
          <!-- Loading order details -->
          <div v-if="evidenceOrderLoading" class="text-center py-8 text-app-text-muted">
            <div class="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Đang tải thông tin đơn hàng...
          </div>

          <EvidenceUploadModal
            v-else
            ref="uploadFormRef"
            :uploading="uploading"
            :error="uploadError"
            :existing-evidence="existingEvidence"
            accept=".jpg,.jpeg,.png,.mp4"
            @submit="handleEvidenceSubmit"
            @cancel="closeEvidence"
            @preview="openLightbox"
          >
            <template #prepend>
              <div v-if="evidenceOrder?.name?.startsWith('BO') && evidenceOrderItems.length > 0 && evidenceOrder.status !== 'Evidence Uploaded'" class="bg-app-bg border border-app-border rounded-xl p-5 mb-6 transition-colors duration-200">
                <label class="block text-[10px] text-app-text-muted mb-4 font-bold uppercase tracking-widest flex items-center gap-2 opacity-80">
                  <span class="w-2 h-2 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/20"></span> Thông tin nhận hàng (Bắt buộc)
                </label>
                <div class="overflow-x-auto rounded-xl border border-app-border">
                  <table class="w-full text-sm">
                    <thead class="bg-app-surface">
                      <tr class="text-app-text-muted text-[10px] uppercase font-bold tracking-wider border-b border-app-border">
                        <th class="text-left py-3 px-4 font-medium">Mặt hàng</th>
                        <th class="text-right py-3 px-4 font-medium whitespace-nowrap">SL Đặt</th>
                        <th class="text-right py-3 px-4 font-medium whitespace-nowrap border-l border-app-border">Thực nhận</th>
                        <th class="text-left py-3 px-4 font-medium min-w-[200px]">Kho nhận</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-app-border bg-app-surface/30">
                      <tr v-for="(item, i) in evidenceOrderItems" :key="i" class="hover:bg-app-surface transition">
                        <td class="py-3 px-4 text-app-text-primary font-medium">{{ currencyName(item.currency_item, currencyItemMap) }}</td>
                        <td class="py-3 px-4 text-right text-app-text-secondary font-mono">{{ formatQty(item.quantity) }}</td>
                        <td class="py-2.5 px-4 text-right border-l border-app-border">
                          <FormattedNumberInput v-model="item.received_quantity" input-class="w-full min-w-[80px] max-w-[140px] bg-app-surface border border-app-border rounded-lg px-3 py-2 text-sm text-app-text-primary text-right outline-none focus:border-indigo-500 transition float-right" placeholder="0" />
                        </td>
                        <td class="py-2.5 px-4 min-w-[280px]">
                          <div v-for="(alloc, aIdx) in item.allocations" :key="aIdx" class="flex items-center gap-2 mb-1">
                            <SearchableSelect
                              v-model="alloc.game_account"
                              :options="itemAccountOpts(item, aIdx)"
                              placeholder="-- Chọn Kho --"
                              compact
                              class="flex-1"
                            />
                            <FormattedNumberInput v-model="alloc.quantity" input-class="w-24 text-right bg-app-bg text-app-text-primary border border-app-border rounded px-2 py-1 text-sm" placeholder="0" />
                            <button v-if="item.allocations.length > 1" @click="item.allocations.splice(aIdx, 1)"
                              class="text-red-400 hover:text-red-300 text-xs">&#10005;</button>
                          </div>
                          <button @click="item.allocations.push({ game_account: '', quantity: 0 })"
                            class="text-xs text-indigo-400 hover:text-indigo-300 mt-1">+ Thêm tài khoản</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>
          </EvidenceUploadModal>
        </div>
      </ModalWrapper>

      <!-- ============ START DELIVERY (SELL) MODAL ============ -->
      <ModalWrapper v-model="startDeliveryModal" size="lg">
        <template #header>
          <h3 class="text-app-text-primary font-bold text-lg px-4 sm:px-8 pt-4 sm:pt-8 pb-4 border-b border-app-border">
            Bắt đầu giao hàng - {{ startDeliveryOrder?.name }}
          </h3>
        </template>

        <div class="p-4 sm:p-8">
          <div v-if="evidenceOrderLoading" class="text-center py-6 text-app-text-muted">
            <div class="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Đang kiểm tra tồn kho...
          </div>
          <div v-else class="space-y-4">
            <div v-for="(di, diIdx) in deliveryItems" :key="diIdx" class="bg-app-bg border border-app-border rounded-xl p-4">
              <div class="flex justify-between items-center mb-3">
                <span class="text-sm font-bold text-app-text-primary">{{ currencyName(di.currency_item, currencyItemMap) }}</span>
                <span class="text-xs text-app-text-muted font-mono">Cần giao: {{ formatQty(di.remaining_quantity ?? di.quantity) }}<span v-if="di.delivered_quantity > 0" class="text-amber-400"> / Đã giao: {{ formatQty(di.delivered_quantity) }}</span></span>
              </div>
              <!-- Multi-account allocation rows -->
              <div v-for="(alloc, aIdx) in deliveryAllocations[diIdx]" :key="aIdx" class="flex items-center gap-2 mb-1">
                <SearchableSelect
                  v-model="alloc.game_account"
                  :options="deliveryAccountOpts(diIdx, aIdx)"
                  :placeholder="'-- Chọn kho --'"
                  class="flex-1"
                />
                <FormattedNumberInput v-model="alloc.quantity" input-class="w-24 text-right bg-app-bg text-app-text-primary border border-app-border rounded px-2 py-1 text-sm" placeholder="0" />
                <button v-if="deliveryAllocations[diIdx].length > 1" @click="deliveryAllocations[diIdx].splice(aIdx, 1)"
                  class="text-red-400 hover:text-red-300 text-xs">&#10005;</button>
              </div>
              <button @click="deliveryAllocations[diIdx].push({ game_account: '', quantity: 0 })"
                class="text-xs text-indigo-400 hover:text-indigo-300 mt-1">+ Thêm nguồn</button>
            </div>

            <p v-if="uploadError" class="text-red-400 text-sm mt-2 font-medium bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg text-center">
              {{ uploadError }}
            </p>

            <div class="flex gap-4">
              <button @click="closeStartDelivery" class="flex-1 py-3.5 rounded-2xl btn-premium bg-app-surface text-app-text-muted hover:text-app-text-primary border border-app-border">Quay lại</button>
              <button @click="submitStartDelivery" :disabled="uploading" class="flex-1 py-3.5 rounded-2xl btn-premium bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white shadow-lg shadow-orange-600/20">
                {{ uploading ? 'Đang xử lý...' : 'Bắt đầu giao hàng' }}
              </button>
            </div>
          </div>
        </div>
      </ModalWrapper>

      <!-- Edit Legacy Note Modal -->
      <EditNoteModal
        v-model="showEditNoteModal"
        :order="editingOrder"
        @saved="() => refreshAndBadges()"
      />

      <!-- QR Payment Modal -->
      <QrPaymentModal
        v-model:open="showQrModal"
        :loading="qrLoading"
        :qr-value="qrValue"
        :order="qrOrder"
        :bank-info="qrBankInfo"
        :description="removeAccents(getPaymentDesc(qrOrder))"
      />

    <!-- Cancel Request Modal -->
    <ModalWrapper v-model="cancelModal" radius="2xl" :z-index="50">
      <div class="p-4 sm:p-8">
        <div class="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center text-2xl mx-auto mb-4 shadow-xl shadow-red-600/20">⚠️</div>
        <h3 class="text-app-text-primary font-black text-lg uppercase tracking-tight text-center mb-1">Yêu cầu hủy đơn hàng</h3>
        <p class="text-app-text-muted text-[10px] font-black uppercase tracking-widest text-center opacity-40 mb-5">{{ cancelOrder?.name }}</p>
        <CancelRequestModal
          ref="cancelModalRef"
          @confirm="handleCancelSubmit"
          @cancel="cancelModal = false"
        />
      </div>
    </ModalWrapper>

  </div>
</template>

<script setup>
defineOptions({ name: 'OrdersView' })
import { ref, computed, onActivated, watch } from 'vue'
import { useRoute } from 'vue-router'
import OrderCard from '../components/OrderCard.vue'
import AppButton from '../components/AppButton.vue'
import OrderListFilters from '../components/OrderListFilters.vue'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import EditNoteModal from '../components/EditNoteModal.vue'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'
import QrPaymentModal from '../components/QrPaymentModal.vue'
import MediaLightbox from '../components/MediaLightbox.vue'
import ModalWrapper from '../components/ModalWrapper.vue'
import SearchableSelect from '../components/SearchableSelect.vue'
import FormattedNumberInput from '../components/FormattedNumberInput.vue'
import { getList, getLoggedInUser, getDoc, updateDoc, createDoc, applyWorkflowAction, frappeCall } from '../api/index.js'
import { normalizeOrderInPlace } from '../utils/normalizeOrder.js'
import { useAuth } from '../composables/useAuth.js'
import { useRealtimeSubscriptions } from '../composables/useRealtimeSubscriptions.js'
import { formatQty, formatDate, isImage, isVideo, currencyName, getOrderDoctype, getOrderType, linkify } from '../utils/format.js'
import { syncArray } from '../utils/sync.js'
import { removeAccents } from '../utils/vietqr.js'
import { useNotify } from '../composables/useNotify.js'
import { useBadgeCounts } from '../composables/useBadgeCounts.js'
import { useEvidenceUpload } from '../composables/useEvidenceUpload.js'
import EvidenceUploadModal from '../components/EvidenceUploadModal.vue'
import CancelRequestModal from '../components/CancelRequestModal.vue'
import { useMetadata } from '../composables/useMetadata.js'
import { useOrderUrlSync } from '../composables/useOrderUrlSync.js'
import { useQrPayment } from '../composables/useQrPayment.js'
import { useEditNote } from '../composables/useEditNote.js'
import { useOrdersPaginated } from '../composables/useOrdersPaginated.js'
import { useWorkflowAction } from '../composables/useWorkflowAction.js'

const route = useRoute()
const { isAdmin, isAccountant, isOpsManager, user: authUser } = useAuth()
const { success, error, warn, info, confirm } = useNotify()
const { gameAccounts: allGameAccounts, gameContexts, currencyItemMap, fetchMetadata } = useMetadata()
const { showQrModal, qrValue, qrLoading, qrOrder, qrBankInfo, getPaymentDesc, openQrPayment } = useQrPayment(error)
const { showEditNoteModal, editingOrder, openNoteEditor } = useEditNote()
const { refreshBadges, refreshBadgesNow } = useBadgeCounts()

const startDeliveryModal = ref(false)
const startDeliveryOrder = ref(null)

// --- State ---
const activeMain = ref('queue')
watch(() => route.name, (newName) => {
  if (newName === 'MyOrdersView') activeMain.value = 'mine'
  else if (newName === 'HistoryView') activeMain.value = 'history'
  else if (newName === 'IssuesView') activeMain.value = 'issues'
  else if (newName === 'QueueView') activeMain.value = 'queue'
}, { immediate: true })

const activeSub = ref(route.query.sub || 'both')
const { processing, execute } = useWorkflowAction()
const currentUser = ref('')

// --- Server-side pagination via dedicated API ---
const search = ref(route.query.q || '')
const filterGame = ref(route.query.game || '')
const filterItem = ref(route.query.item || '')
const sortOrder = ref(route.query.sort || 'desc')
const filterStatus = ref(route.query.status || '')
const dateFrom = ref(route.query.from || '')
const dateTo = ref(route.query.to || '')

const {
  items: orders,
  totalItems,
  currentPage,
  totalPages,
  pageSize,
  setPageSize,
  loading,
  statusCounts,
  sellCount,
  buyCount,
  goToPage,
  refresh,
  handleScrollRestoration,
  goToDetail,
} = useOrdersPaginated({
  category: activeMain,
  sub: activeSub,
  filters: {
    search,
    filterGame,
    filterItem,
    filterStatus,
    dateFrom,
    dateTo,
    sortOrder,
  },
})
const listLayout = ref(null)

// --- Local scroll helpers for optimistic updates ---
function getScrollPos() {
  const el = document.querySelector('[data-scroll-container]') || document.scrollingElement
  return el ? (el === window ? window.scrollY : el.scrollTop) : 0
}

function setScrollPos(pos) {
  const el = document.querySelector('[data-scroll-container]') || document.scrollingElement
  if (el && el !== window) el.scrollTop = pos
  else if (el === window) window.scrollTo(0, pos)
}

function canActOnOrder(order) {
  if (isAdmin.value || isAccountant.value || isOpsManager.value) return true
  const s = order.status
  if (s === 'Queued') return true
  if (s === 'Cancellation Requested') return false
  return order.claimed_by === currentUser.value
}

useOrderUrlSync({
  routeNames: ['QueueView', 'MyOrdersView', 'HistoryView', 'IssuesView'],
  params: { activeSub, search, filterGame, filterItem, sortOrder, filterStatus, dateFrom, dateTo },
  queryMap: { search: 'q', sortOrder: 'sort', dateFrom: 'from', dateTo: 'to' },
  defaults: { activeSub: 'both', sortOrder: 'desc' },
})

// --- Status category map for real-time updates ---
const statusCategories = {
  queue: new Set(['Queued']),
  mine: new Set(['Claimed', 'In Delivery', 'Evidence Uploaded', 'Receiving', 'Cancellation Requested']),
  issues: new Set(['Failed', 'Cancelled', 'Disputed', 'Refunded', 'Cancellation Requested']),
  history: new Set(['Completed', 'Failed', 'Cancelled', 'Disputed', 'Refunded', 'Outstanding', 'Delivered', 'Payment Pending']),
}

function statusBelongsToCurrentCategory(status) {
  const cat = statusCategories[activeMain.value]
  return cat ? cat.has(status) : false
}

// --- Evidence count for In Delivery orders ---
async function loadEvidenceCounts() {
  const inDelivery = orders.value.filter(o =>
    (o.status || o.workflow_state || '') === 'In Delivery'
  )
  if (inDelivery.length === 0) return

  const names = inDelivery.map(o => o.name)
  try {
    const evidences = await getList('Order Evidence', {
      fields: ['reference_name'],
      filters: [['reference_name', 'in', names]],
      limit: 500,
    })
    const countMap = {}
    evidences.forEach(e => {
      countMap[e.reference_name] = (countMap[e.reference_name] || 0) + 1
    })
    evidenceCountMap.value = countMap
  } catch {}
}

function refreshAndBadges() {
  refresh()
  refreshBadgesNow()
}

// --- Actions with optimistic local updates ---
function claimOrder(order) {
  execute(order, 'Claim', {
    after: () => {
      // Optimistic: remove from local array, adjust total
      const idx = orders.value.findIndex(o => o.name === order.name)
      if (idx !== -1) {
        const savedScroll = getScrollPos()
        orders.value.splice(idx, 1)
        totalItems.value = Math.max(0, totalItems.value - 1)
        setScrollPos(savedScroll)
      }
      refreshBadgesNow()
      success(`Đã nhận xử lý đơn ${order.name}`)
    },
    onError: e => error('Lỗi: ' + (e.message || e)),
  })
}

function transition(order, action) {
  execute(order, action, {
    after: async () => {
      await refresh()
      refreshBadgesNow()
      success('Thao tác thành công')
    },
    onError: e => error('Lỗi: ' + (e.message || e)),
  })
}

function requestCancel(order) {
  if (order.status === 'Cancellation Requested') return warn('Đơn hàng đã được yêu cầu hủy rồi')
  cancelOrder.value = order
  cancelModalRef.value?.reset()
  cancelModal.value = true
}

async function handleCancelSubmit({ reason, files }) {
  const order = cancelOrder.value
  if (!order) return
  try {
    // Upload evidence files (optional)
    if (files?.length) {
      for (const f of files) {
        const uploaded = await uploadFileOnly(f)
        if (uploaded?.file_url) {
          const doctype = order.name.startsWith('SO') ? 'Sell Order' : 'Buy Order'
          await createDoc('Order Evidence', {
            reference_doctype: doctype,
            reference_name: order.name,
            attachment: uploaded.file_url,
            note: '[Hủy đơn] ' + reason,
          })
        }
      }
    }
    // Save cancel reason log
    const doctype = order.name.startsWith('SO') ? 'Sell Order' : 'Buy Order'
    await createDoc('Order Log', {
      reference_doctype: doctype,
      reference_name: order.name,
      action: 'Cancel Request',
      note: reason,
    })
    // Execute workflow action
    await new Promise((resolve, reject) => {
      execute(order, 'Request Cancel', {
        extra: { cancel_reason: reason },
        after: () => resolve(),
        onError: e => reject(e),
      })
    })
    cancelModal.value = false
    await refresh()
    refreshBadgesNow()
    success('Đã gửi yêu cầu hủy')
  } catch (e) {
    error('Lỗi: ' + (e.message || e))
  }
}

function unclaimOrder(order) {
  execute(order, 'Unclaim', {
    after: () => {
      // Optimistic: remove from local array, adjust total
      const idx = orders.value.findIndex(o => o.name === order.name)
      if (idx !== -1) {
        const savedScroll = getScrollPos()
        orders.value.splice(idx, 1)
        totalItems.value = Math.max(0, totalItems.value - 1)
        setScrollPos(savedScroll)
      }
      refreshBadgesNow()
      success('Đã trả đơn về Queue')
    },
    onError: e => error('Lỗi: ' + (e.message || e)),
  })
}

// --- View Evidence Modal ---
async function openViewEvidence(order) {
  viewEvidenceOrder.value = order
  viewEvidenceModal.value = true
  evidenceLoading.value = true
  evidenceList.value = []
  try {
    const doctype = getOrderDoctype(order.name)
    evidenceList.value = await getList('Order Evidence', {
      fields: ['name', 'attachment', 'note', 'status', 'uploaded_by', 'uploaded_at'],
      filters: [
        ['reference_doctype', '=', doctype],
        ['reference_name', '=', order.name],
      ],
      limit: 20,
    })
  } finally {
    evidenceLoading.value = false
  }
}

function closeViewEvidence() {
  viewEvidenceModal.value = false
  viewEvidenceOrder.value = null
}

function openLightbox(ev) {
  lightboxItem.value = ev
  lightboxOpen.value = true
}

// --- Evidence Modal ---
async function openEvidence(order) {
  evidenceOrder.value = order
  uploadFormRef.value?.reset()
  evidenceOrderItems.value = []
  existingEvidence.value = []
  sellDeliveryAccount.value = ''
  gameAccounts.value = []
  evidenceModal.value = true
  evidenceOrderLoading.value = true

  try {
    const oType = getOrderType(order.name)
    const doctype = getOrderDoctype(order.name)
    const fullOrder = await getDoc(doctype, order.name)
    normalizeOrderInPlace(fullOrder, oType)

    // For Buy Order: populate items with defaults
    if (oType === 'buy' && fullOrder.items) {
      evidenceOrderItems.value = fullOrder.items.map(item => ({
        name: item.name,
        currency_item: item.currency_item,
        quantity: item.quantity,
        unit_price: item.unit_price,
        received_quantity: item.received_quantity || item.quantity,
        allocations: [{ game_account: item.target_game_account || '', quantity: item.received_quantity || item.quantity }],
      }))
    }

    // For Sell Order: pre-fill delivery account from items
    if (oType === 'sell') {
      sellDeliveryAccount.value = fullOrder.items?.[0]?.target_game_account || ''
    }

    // Fetch game accounts based on order type
    if (fullOrder.game_context) {
      if (oType === 'sell') {
        // Query accounts for each item's currency_item
        const sellItemFilters = (fullOrder.items || []).map(i =>
          getList('Inventory Position', {
            fields: ['game_account', 'qty_available', 'currency_item'],
            filters: [
              ['game_context', '=', fullOrder.game_context],
              ['currency_item', '=', i.currency_item],
              ['qty_available', '>=', i.quantity || 0],
              ['is_active', '=', 1]
            ],
            limit: 0
          })
        )
        const sellInvResults = await Promise.all(sellItemFilters)
        const seen = new Set()
        const accounts = []
        sellInvResults.flat().forEach(pos => {
          const existing = accounts.find(a => a.name === pos.game_account)
          if (existing) {
            existing.qty_available += Number(pos.qty_available || 0)
          } else if (!seen.has(pos.game_account)) {
            seen.add(pos.game_account)
            accounts.push({ name: pos.game_account, account_name: pos.game_account, qty_available: Number(pos.qty_available || 0) })
          }
        })
        gameAccounts.value = accounts
      } else {
        await fetchMetadata()
        gameAccounts.value = allGameAccounts.value.filter(a => a.game_title === order.game_title || a.game_title === order.game_context)

        // In case filtering by name/context didn't work, we try to find by looking up context
        if (gameAccounts.value.length === 0 && order.game_context) {
           const gc = gameContexts.value.find(g => g.name === order.game_context)
           if (gc) {
               gameAccounts.value = allGameAccounts.value.filter(a => a.game_title === gc.game_title)
           }
        }

        evidenceOrder.value = order
      }
    }

    // Fetch existing evidence for this order
    existingEvidence.value = await getList('Order Evidence', {
      fields: ['name', 'attachment', 'uploaded_by', 'uploaded_at', 'note'],
      filters: [
        ['reference_doctype', '=', doctype],
        ['reference_name', '=', order.name],
      ],
      limit: 50,
    })
  } catch (e) {
    uploadError.value = 'Không thể tải thông tin đơn hàng: ' + e.message
  } finally {
    evidenceOrderLoading.value = false
  }
}

function closeEvidence() {
  evidenceModal.value = false
  evidenceOrder.value = null
  evidenceOrderItems.value = []
  existingEvidence.value = []
  gameAccounts.value = []
}

async function openStartDelivery(order) {
  startDeliveryOrder.value = order
  uploadError.value = ''
  deliveryItems.value = []
  deliveryAllocations.value = []
  startDeliveryModal.value = true
  evidenceOrderLoading.value = true

  try {
    const fullOrder = await getDoc('Sell Order', order.name)
    normalizeOrderInPlace(fullOrder, 'sell')
    const items = fullOrder.items || []

    if (!items.length) {
      uploadError.value = 'Đơn hàng chưa có sản phẩm. Vui lòng thêm items trước khi giao hàng.'
      evidenceOrderLoading.value = false
      return
    }

    const newDeliveryItems = []
    for (const item of items) {
      const invRes = await getList('Inventory Position', {
        fields: ['game_account', 'qty_available', 'currency_item'],
        filters: [
          ['game_context', '=', fullOrder.game_context],
          ['currency_item', '=', item.currency_item],
          ['qty_available', '>', 0],
          ['is_active', '=', 1]
        ],
        limit: 0
      })
      // Aggregate by game_account (multiple lots = one entry per account)
      const accountMap = {}
      for (const pos of invRes) {
        if (!accountMap[pos.game_account]) accountMap[pos.game_account] = 0
        accountMap[pos.game_account] += Number(pos.qty_available || 0)
      }
      const accountOpts = Object.entries(accountMap)
        .sort((a, b) => b[1] - a[1])
        .map(([ga, qty]) => ({
          value: ga,
          label: `${ga} | Còn: ${qty.toLocaleString('vi-VN')}`,
          qty_available: qty,
        }))
      const deliveredQty = Number(item.delivered_quantity || 0)
      // Also count qty from previous delivery allocations
      let prevAllocQty = 0
      try {
        const prevAllocs = JSON.parse(item.delivery_allocations_json || '[]')
        prevAllocQty = prevAllocs.reduce((s, a) => s + (Number(a.quantity) || 0), 0)
      } catch {}
      const remainingQty = Number(item.quantity) - Math.max(deliveredQty, prevAllocQty)
      if (remainingQty <= 0) continue
      newDeliveryItems.push({
        currency_item: item.currency_item,
        quantity: item.quantity,
        delivered_quantity: deliveredQty,
        remaining_quantity: remainingQty,
        unit_price: item.unit_price,
        item_name: item.name,
        accountOpts,
      })
    }
    deliveryItems.value = newDeliveryItems
    deliveryAllocations.value = newDeliveryItems.map(item => {
      const bestAccount = item.accountOpts?.[0]?.value || ''
      return [{ game_account: bestAccount, quantity: item.remaining_quantity }]
    })
  } catch (e) {
    uploadError.value = 'Không thể tải thông tin tồn kho: ' + e.message
  } finally {
    evidenceOrderLoading.value = false
  }
}

function closeStartDelivery() {
  startDeliveryModal.value = false
  startDeliveryOrder.value = null
  deliveryItems.value = []
  deliveryAllocations.value = []
}

async function submitStartDelivery() {
  if (!deliveryItems.value.length) {
    uploadError.value = 'Đơn hàng chưa có sản phẩm. Vui lòng thêm items trước khi giao hàng.'
    return
  }

  // Validate all allocations have game accounts and quantities > 0
  for (let idx = 0; idx < deliveryItems.value.length; idx++) {
    const allocs = deliveryAllocations.value[idx] || []
    const item = deliveryItems.value[idx]
    if (allocs.length === 0 || allocs.some(a => !a.game_account)) {
      uploadError.value = `Vui lòng chọn kho cho ${currencyName(item.currency_item, currencyItemMap.value)}`
      return
    }
    if (allocs.some(a => !a.quantity || a.quantity <= 0)) {
      uploadError.value = `Vui lòng nhập số lượng > 0 cho ${currencyName(item.currency_item, currencyItemMap.value)}`
      return
    }
    const usedSet = new Set()
    for (const a of allocs) {
      if (usedSet.has(a.game_account)) {
        uploadError.value = `${currencyName(item.currency_item, currencyItemMap.value)}: Kho ${a.game_account} bị trùng — mỗi phân bổ phải chọn kho khác nhau`
        return
      }
      usedSet.add(a.game_account)
    }
    const totalQty = allocs.reduce((s, a) => s + (Number(a.quantity) || 0), 0)
    const remainingQty = item.remaining_quantity || item.quantity
    if (totalQty > remainingQty) {
      uploadError.value = `${currencyName(item.currency_item, currencyItemMap.value)}: Tổng SL phân bổ (${totalQty}) vượt quá SL cần giao (${remainingQty})`
      return
    }
    // Validate each allocation doesn't exceed available qty in that warehouse
    const accountAvailMap = {}
    for (const opt of (item.accountOpts || [])) {
      accountAvailMap[opt.value] = opt.qty_available || 0
    }
    for (const a of allocs) {
      const avail = accountAvailMap[a.game_account] ?? 0
      if (Number(a.quantity) > avail) {
        uploadError.value = `${currencyName(item.currency_item, currencyItemMap.value)}: Kho ${a.game_account} chỉ còn ${avail.toLocaleString('vi-VN')}, không đủ giao ${Number(a.quantity).toLocaleString('vi-VN')}`
        return
      }
    }
  }

  uploading.value = true
  uploadError.value = ''
  try {
    startDeliveryOrder.value.status = 'In Delivery'
    startDeliveryOrder.value.workflow_state = 'In Delivery'

    const orderName = startDeliveryOrder.value.name

    // Fetch full order to get item row names
    const fullOrder = await getDoc('Sell Order', orderName)
    const existingItems = fullOrder?.sell_items || []

    // Build items payload with delivery_allocations_json
    const itemsPayload = deliveryItems.value.map((di, idx) => {
      const match = existingItems.find(ei => ei.currency_item === di.currency_item)
      const allocs = deliveryAllocations.value[idx]
      return {
        name: match?.name,
        currency_item: di.currency_item,
        quantity: di.quantity,
        delivered_quantity: match?.delivered_quantity || 0,
        unit_price: di.unit_price || match?.unit_price || 0,
        target_game_account: allocs[0]?.game_account || '',
        delivery_allocations_json: JSON.stringify(allocs.filter(a => a.game_account && a.quantity > 0)),
      }
    })

    // Step 1: Save items only via custom API (bypasses permissions)
    await frappeCall('gege_custom.gege_custom.utils.update_sell_order_delivery_allocations', {
      name: orderName,
      sell_items: JSON.stringify(itemsPayload),
    })

    // Step 2: Transition state via workflow action
    await applyWorkflowAction('Sell Order', orderName, 'Start Delivery')

    closeStartDelivery()
    await refresh()
    refreshBadgesNow()
  } catch (e) {
    uploadError.value = 'Lỗi: ' + e.message
  } finally {
    uploading.value = false
  }
}

async function handleEvidenceSubmit({ files, file, type, note }) {
  const isSellOrder = evidenceOrder.value.name.startsWith('SO')
  const doctype = isSellOrder ? 'Sell Order' : 'Buy Order'
  const isSupplemental = evidenceOrder.value.status === 'Evidence Uploaded'

  // Validate items for buy orders (skip for supplemental — items already saved)
  if (!isSellOrder && !isSupplemental) {
    for (const item of evidenceOrderItems.value) {
      if (!item.received_quantity || item.received_quantity <= 0) {
        uploadError.value = 'Vui lòng nhập đủ Thực nhận (> 0) cho tất cả items'
        return
      }
      const hasEmptyAccount = item.allocations.some(a => !a.game_account)
      if (hasEmptyAccount) {
        uploadError.value = 'Vui lòng chọn Kho cho tất cả phân bổ'
        return
      }
      const usedSet = new Set()
      for (const a of item.allocations) {
        if (usedSet.has(a.game_account)) {
          uploadError.value = `Tài khoản ${a.game_account} bị trùng — mỗi phân bổ phải chọn kho khác nhau`
          return
        }
        usedSet.add(a.game_account)
      }
      const totalAlloc = item.allocations.reduce((s, a) => s + (Number(a.quantity) || 0), 0)
      if (totalAlloc !== (Number(item.received_quantity) || 0)) {
        uploadError.value = `Tổng SL phân bổ (${totalAlloc}) phải bằng SL thực nhận (${item.received_quantity})`
        return
      }
    }
  }

  // Step 1: Update buy order items first (skip for supplemental — items already saved)
  if (!isSellOrder && !isSupplemental) {
    const itemsPayload = evidenceOrderItems.value.map(r => ({
      name: r.name,
      currency_item: r.currency_item,
      quantity: r.quantity,
      unit_price: r.unit_price,
      received_quantity: r.received_quantity,
      target_game_account: r.allocations[0]?.game_account || '',
      receive_allocations_json: JSON.stringify(r.allocations.filter(a => a.game_account && a.quantity > 0)),
    }))
    try {
      await updateDoc('Buy Order', evidenceOrder.value.name, { buy_items: itemsPayload })
    } catch (e) {
      console.error('Update BO items failed:', e)
      uploadError.value = 'Lỗi cập nhật items: ' + (e.message || e)
      return
    }
  }

  // Step 2: Upload files and create Order Evidence(s)
  const fileArray = files || (file ? [file] : [])
  console.log('Starting multi-file upload:', fileArray.length, 'files')

  const result = await submitEvidence({
    files: fileArray, type, note,
    referenceDoctype: doctype,
    referenceName: evidenceOrder.value.name,
    channel: evidenceOrder.value.buy_channel || evidenceOrder.value.sell_channel,
  })
  if (result) {
    await refresh()
    refreshBadgesNow()
    closeEvidence()
    uploadFormRef.value?.reset()
  }
}

// Handle items-updated from OrderCard inline edit
async function handleItemsUpdated(order) {
  try {
    const items = await frappeCall('gege_custom.gege_custom.utils.get_order_items', {
      parent_doctype: order.name.startsWith('BO') ? 'Buy Order' : 'Sell Order',
      parent_names: [order.name],
    })
    if (items.length) {
      order.items = items.map(i => ({
        currency_item: i.currency_item,
        currency_item_name: i.get?.('currency_item_name'),
        quantity: i.quantity,
        unit_price: i.unit_price,
      }))
    }
  } catch (e) {
    console.error('handleItemsUpdated error:', e)
  }
}

// --- Real-time: intelligent local updates ---
function handleRealtimeUpdate(data) {
  console.log('[RT] handleRealtimeUpdate', data.doctype, data.name, data.status || data.workflow_state, data.items ? 'enriched' : 'basic')
  if (!data.name) return
  const isBuyOrder = data._is_buy != null ? data._is_buy : data.doctype === 'Buy Order'
  const newStatus = data.status || data.workflow_state
  const idx = orders.value.findIndex(o => o.name === data.name)

  if (idx !== -1) {
    // Order exists in current list
    if (newStatus && !statusBelongsToCurrentCategory(newStatus)) {
      // Status changed to a different category — remove from list
      const savedScroll = getScrollPos()
      orders.value.splice(idx, 1)
      totalItems.value = Math.max(0, totalItems.value - 1)
      setScrollPos(savedScroll)
      refreshBadges()
    } else if (data.items && data.items.length) {
      // Enriched payload: full in-place update (0 API calls)
      const order = orders.value[idx]
      if (newStatus) { order.status = newStatus; order.workflow_state = newStatus }
      if (data.claimed_by != null) order.claimed_by = data.claimed_by
      if (data.claimed_at) order.claimed_at = data.claimed_at
      if (data.assigned_trader) order.assigned_trader = data.assigned_trader
      if (data.game_account) order.game_account = data.game_account
      if (data.notes !== undefined) order.notes = data.notes
      order.items = data.items
      normalizeOrderInPlace(order, isBuyOrder ? 'buy' : 'sell')
    } else {
      // Basic payload: update only available fields
      if (newStatus) {
        orders.value[idx].status = newStatus
        orders.value[idx].workflow_state = newStatus
      }
      if (data.claimed_by != null) {
        orders.value[idx].claimed_by = data.claimed_by
      }
      if (data.claimed_at) {
        orders.value[idx].claimed_at = data.claimed_at
      }
      if (data.assigned_trader) {
        orders.value[idx].assigned_trader = data.assigned_trader
      }
    }
  } else {
    // Order not in current list — maybe it belongs here now
    if (newStatus && statusBelongsToCurrentCategory(newStatus)) {
      if (data.items && data.items.length) {
        // Enriched payload: construct order directly (0 API calls)
        const order = { ...data, order_type: isBuyOrder ? 'buy' : 'sell' }
        if (data.workflow_state && !data.status) order.status = data.workflow_state
        normalizeOrderInPlace(order, isBuyOrder ? 'buy' : 'sell')
        orders.value.unshift(order)
        totalItems.value += 1
      } else {
        // Fallback: fetch full data (legacy)
        fetchSingleOrder(data.name, isBuyOrder ? 'buy' : 'sell')
      }
      refreshBadges()
    }
  }
}

async function fetchSingleOrder(name, type) {
  try {
    const fields = type === 'buy'
      ? 'name,buy_channel,game_context,supplier,transaction_currency,grand_total_native,outstanding_amount_native,debt_status,status,creation,modified,notes,owner,claimed_by,claimed_at,assigned_trader,payment_confirmed_by,payment_confirmed_at,payment_reconciled_by'
      : 'name,sell_channel,game_context,customer,customer_btag_snapshot,customer_ingame_name_snapshot,sale_currency,external_order_id,order_url,order_item_title,order_quantity,withdraw_fee_native,channel_fee_native,other_cost_native,workflow_state,creation,modified,notes,owner,claimed_by,claimed_at,assigned_trader,is_debt_order,earning_native,payment_method,payment_reference_code,payment_reconciled_by'

    const result = await getList(type === 'buy' ? 'Buy Order' : 'Sell Order', {
      fields: fields.split(','),
      filters: [['name', '=', name]],
      limit: 1,
    })
    if (!result.length) return
    const order = result[0]
    order.order_type = type
    normalizeOrderInPlace(order, type)
    order.status = order.workflow_state || order.status
    orders.value.unshift(order)
    totalItems.value += 1
  } catch (e) {
    console.error('fetchSingleOrder error:', e)
  }
}

// --- Computed ---
const gameAccountOpts = computed(() => {
  return gameAccounts.value.map(a => {
    let label = a.account_name || a.name
    if (a.qty_available !== undefined) {
      label += ` | Có sẵn: ${formatQty(a.qty_available)}`
    }
    return { label, value: a.name }
  })
})

function itemAccountOpts(item, currentIdx) {
  const usedAccounts = item.allocations
    .filter((_, i) => i !== currentIdx)
    .map(a => a.game_account)
    .filter(Boolean)
  return gameAccountOpts.value.filter(opt => !usedAccounts.includes(opt.value))
}

function deliveryAccountOpts(diIdx, currentIdx) {
  const di = deliveryItems.value[diIdx]
  if (!di) return []
  const allocs = deliveryAllocations.value[diIdx] || []
  const usedAccounts = allocs
    .filter((_, i) => i !== currentIdx)
    .map(a => a.game_account)
    .filter(Boolean)
  return (di.accountOpts || []).filter(opt => !usedAccounts.includes(opt.value))
}

const statusTabs = computed(() => {
  if (activeMain.value === 'queue') return []
  if (activeMain.value === 'mine') {
    return [
      { key: '', label: 'Tất cả' },
      { key: 'Claimed', label: 'Đã nhận' },
      { key: 'In Delivery', label: 'Đang giao' },
      { key: 'Evidence Uploaded', label: 'Đã upload BC' },
      { key: 'Cancellation Requested', label: 'Yêu cầu hủy' },
    ]
  }
  if (activeMain.value === 'history') {
    return [
      { key: '', label: 'Tất cả' },
      { key: 'Completed', label: 'Hoàn thành' },
      { key: 'Outstanding', label: 'Công nợ' },
      { key: 'Evidence Uploaded', label: 'Chờ duyệt' },
      { key: 'Payment Pending', label: 'Chờ thanh toán' },
      { key: 'Cancelled', label: 'Đã hủy' },
      { key: 'Failed', label: 'Thất bại' },
      { key: 'Disputed', label: 'Tranh chấp' },
      { key: 'Refunded', label: 'Đã hoàn tiền' },
    ]
  }
  if (activeMain.value === 'issues') {
    return [
      { key: '', label: 'Tất cả' },
      { key: 'Cancellation Requested', label: 'Yêu cầu hủy' },
      { key: 'Disputed', label: 'Tranh chấp' },
      { key: 'Refunded', label: 'Đã hoàn tiền' },
      { key: 'Failed', label: 'Thất bại' },
      { key: 'Cancelled', label: 'Đã hủy' },
    ]
  }
  return []
})

const emptyMessage = computed(() => {
  if (activeMain.value === 'queue') return 'Không có đơn nào trong queue'
  if (activeMain.value === 'mine') return 'Không có đơn nào đang xử lý'
  if (activeMain.value === 'issues') return 'Tuyệt vời, không có sự cố nào!'
  return 'Không có đơn nào trong lịch sử'
})

// --- Modal state ---
// Evidence modal
const evidenceModal = ref(false)
const evidenceOrder = ref(null)
const uploadFormRef = ref(null)
const evidenceOrderLoading = ref(false)
const evidenceOrderItems = ref([])
const existingEvidence = ref([])
const gameAccounts = ref([])
const sellDeliveryAccount = ref('')
const deliveryItems = ref([])
const deliveryAllocations = ref([])

// History expand + evidence
const viewEvidenceModal = ref(false)
const viewEvidenceOrder = ref(null)
const evidenceList = ref([])
const evidenceLoading = ref(false)
const evidenceCountMap = ref({})

// Cancel modal
const cancelModal = ref(false)
const cancelOrder = ref(null)
const cancelModalRef = ref(null)

// Lightbox
const lightboxOpen = ref(false)
const lightboxItem = ref(null)

// Drop evidence: files to pre-populate in upload modal
const pendingDroppedFiles = ref(null)

const { uploading, uploadError, submitEvidence, uploadFileOnly } = useEvidenceUpload()

// --- Realtime subscriptions ---
const { connected, on: onRealtime } = useRealtimeSubscriptions(
  {
    'Sell Order': handleRealtimeUpdate,
    'Buy Order': handleRealtimeUpdate,
  },
  {
    onMount: async () => {
      currentUser.value = await getLoggedInUser()
    },
  }
)

if (onRealtime) {
  onRealtime('gege_order_update', handleRealtimeUpdate)
}

// --- Init ---
onActivated(async () => {
  handleScrollRestoration({ container: null })
  await fetchMetadata()
  refresh()
})

// --- Drop Evidence (drag & drop from OrderCard) ---
async function handleDropEvidence({ order, files }) {
  if (!files || !files.length) return
  pendingDroppedFiles.value = files
  await openEvidence(order)
  // After modal opens, add the dropped files
  if (uploadFormRef.value && pendingDroppedFiles.value) {
    uploadFormRef.value.addFiles(pendingDroppedFiles.value)
    pendingDroppedFiles.value = null
  }
}

</script>

<style scoped>
</style>
