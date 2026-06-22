<template>
  <AppLayout>
    <div class="max-w-5xl mx-auto">
      <!-- Header -->
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-white">Orders</h2>
          <p class="text-gray-500 text-sm mt-1">Quản lý đơn mua / bán</p>
        </div>
        <button
          @click="loadAll"
          class="px-3 py-2 rounded-lg text-sm bg-gray-800 text-gray-400 hover:text-white transition flex items-center gap-2"
        >
          <span class="w-2 h-2 rounded-full" :class="connected ? 'bg-green-400' : 'bg-gray-600'"></span>
          Refresh
        </button>
      </div>

      <!-- Main Tabs: Queue | My Orders | History -->
      <div class="mb-4 flex gap-2">
        <button
          v-for="main in mainTabs"
          :key="main.key"
          @click="activeMain = main.key"
          class="px-5 py-2.5 rounded-lg text-sm font-medium transition"
          :class="activeMain === main.key
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-800 text-gray-400 hover:text-white'"
        >
          {{ main.icon }} {{ main.label }}
          <span
            v-if="mainCount(main.key) > 0 && main.key !== 'history'"
            class="ml-1.5 bg-indigo-500 text-white text-xs px-1.5 py-0.5 rounded-full"
          >
            {{ mainCount(main.key) }}
          </span>
        </button>

        <div class="ml-auto flex items-center gap-2">
          <input
            v-if="activeMain === 'history'"
            v-model="search"
            type="text"
            placeholder="Tìm theo mã đơn..."
            class="px-3 py-2 rounded-lg text-sm bg-gray-800 border border-gray-700 text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition w-48"
          />
        </div>
      </div>

      <!-- Sub Tabs: Sell / Buy -->
      <div class="flex gap-2 mb-4">
        <button
          v-for="sub in subTabs"
          :key="sub.key"
          @click="activeSub = sub.key"
          class="px-4 py-2 rounded-lg text-sm font-medium transition"
          :class="activeSub === sub.key
            ? 'bg-gray-700 text-white'
            : 'bg-gray-800/50 text-gray-500 hover:text-white'"
        >
          {{ sub.label }}
          <span
            v-if="subCount(activeMain, sub.key) > 0 && activeMain !== 'history'"
            class="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
            :class="activeSub === sub.key ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-400'"
          >
            {{ subCount(activeMain, sub.key) }}
          </span>
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-16 text-gray-500">
        Đang tải...
      </div>

      <!-- Empty -->
      <div v-else-if="currentList.length === 0" class="text-center py-16 text-gray-600">
        <p class="text-4xl mb-3">📭</p>
        <p>{{ emptyMessage }}</p>
      </div>

      <!-- ============ QUEUE LIST ============ -->
      <div v-else-if="activeMain === 'queue'" class="space-y-3">
        <div
          v-for="order in currentList"
          :key="order.name"
          class="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition cursor-pointer"
          @click="router.push(`/order/${activeSub === 'sell' ? 'sell' : 'buy'}/${order.name}`)"
        >
          <div class="flex items-start gap-4">
            <!-- Left: Info -->
            <div class="flex-1 min-w-0 space-y-0.5">
              <div class="flex items-center gap-2">
                <span class="text-white font-semibold text-sm">{{ order.name }}</span>
                <span class="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Queued</span>
              </div>
              <div class="text-gray-500 text-xs">
                {{ order.sell_channel || order.buy_channel }}
                <template v-if="activeSub === 'sell'">
                  <span v-if="order.customer_name_snapshot || order.customer" class="text-gray-600 mx-1">•</span>
                  {{ order.customer_name_snapshot || order.customer }}
                </template>
                <template v-else>
                  <span v-if="order.supplier" class="text-gray-600 mx-1">•</span>
                  {{ order.supplier }}
                </template>
              </div>
              <div class="text-gray-400 text-xs">
                {{ order.game_context }}
                <span class="text-gray-600 mx-1">•</span>
                <span class="text-indigo-400">{{ itemsSummary(order) }}</span>
              </div>
            </div>
            <!-- Right: Price + Action -->
            <div class="shrink-0 flex items-center gap-4">
              <span class="text-white text-sm font-medium">{{ formatMoney(activeSub === 'sell' ? order.gross_sale_vnd : order.total_vnd) }}</span>
              <button
                @click="claimOrder(order)"
                :disabled="claiming === order.name"
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
              >
                {{ claiming === order.name ? '...' : 'Claim' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ MY ORDERS LIST ============ -->
      <div v-else-if="activeMain === 'mine'" class="space-y-3">
        <div
          v-for="order in currentList"
          :key="order.name"
          class="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition cursor-pointer"
          @click="router.push(`/order/${activeSub === 'sell' ? 'sell' : 'buy'}/${order.name}`)"
        >
          <div class="flex items-start gap-4">
            <!-- Left: Info -->
            <div class="flex-1 min-w-0 space-y-0.5">
              <div class="flex items-center gap-2">
                <span class="text-white font-semibold text-sm">{{ order.name }}</span>
                <span class="text-xs px-2 py-0.5 rounded-full" :class="statusBadge(order.status)">
                  {{ order.status }}
                </span>
              </div>
              <div class="text-gray-500 text-xs">
                {{ order.sell_channel || order.buy_channel }}
                <template v-if="activeSub === 'sell'">
                  <span v-if="order.customer_name_snapshot || order.customer" class="text-gray-600 mx-1">•</span>
                  {{ order.customer_name_snapshot || order.customer }}
                  <span v-if="order.customer_btag_snapshot" class="text-gray-600 ml-1">({{ order.customer_btag_snapshot }})</span>
                </template>
                <template v-else>
                  <span v-if="order.supplier" class="text-gray-600 mx-1">•</span>
                  {{ order.supplier }}
                </template>
              </div>
              <div class="text-gray-400 text-xs">
                {{ order.game_context }}
                <span class="text-gray-600 mx-1">•</span>
                <span class="text-indigo-400">{{ itemsSummary(order) }}</span>
              </div>
            </div>
            <!-- Right: Price + Action -->
            <div class="shrink-0 flex items-center gap-4">
              <span class="text-white text-sm font-medium">{{ formatMoney(activeSub === 'sell' ? order.gross_sale_vnd : order.total_vnd) }}</span>
              <button
                v-if="activeSub === 'sell' && order.status === 'Claimed'"
                @click="transition(order, 'In Delivery')"
                :disabled="transitioning === order.name"
                class="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
              >
                {{ transitioning === order.name ? '...' : 'Start Delivery' }}
              </button>
              <button
                v-else-if="activeSub === 'sell' && order.status === 'In Delivery'"
                @click="openEvidence(order)"
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition"
              >
                Upload Evidence
              </button>
              <button
                v-else-if="activeSub === 'buy' && order.status === 'Claimed'"
                @click="transition(order, 'Receiving')"
                :disabled="transitioning === order.name"
                class="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
              >
                {{ transitioning === order.name ? '...' : 'Start Receiving' }}
              </button>
              <button
                v-else-if="activeSub === 'buy' && order.status === 'Receiving'"
                @click="openEvidence(order)"
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition"
              >
                Upload Evidence
              </button>
              <span
                v-else-if="order.status === 'Evidence Uploaded'"
                class="px-3 py-2 bg-green-500/20 text-green-400 text-sm font-medium rounded-lg"
              >
                Chờ verify
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ ISSUES LIST ============ -->
      <div v-else-if="activeMain === 'issues'" class="space-y-3">
        <div
          v-for="order in currentList"
          :key="order.name"
          class="bg-gray-900 border border-red-900/50 rounded-xl p-4 hover:border-red-700/50 transition cursor-pointer relative overflow-hidden"
          @click="router.push(`/order/${activeSub === 'sell' ? 'sell' : 'buy'}/${order.name}`)"
        >
          <div class="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>
          <div class="flex items-start gap-4">
            <!-- Left: Info -->
            <div class="flex-1 min-w-0 space-y-0.5 ml-2">
              <div class="flex items-center gap-2">
                <span class="text-white font-semibold text-sm">{{ order.name }}</span>
                <span class="text-xs px-2 py-0.5 rounded-full" :class="statusBadge(order.status)">
                  {{ order.status }}
                </span>
                <span v-if="order.claimed_by" class="text-gray-600 text-xs">by {{ userName(order.claimed_by) }}</span>
              </div>
              <div class="text-gray-500 text-xs mt-1">
                 {{ order.sell_channel || order.buy_channel }}
                 <span class="text-gray-600 mx-1">•</span>
                 {{ activeSub === 'sell' ? (order.customer_name_snapshot || 'Khách') : (order.supplier || 'Supplier') }}
              </div>
              <div class="text-gray-400 text-xs mt-1">
                {{ order.game_context }}
                <span class="text-gray-600 mx-1">•</span>
                <span class="text-indigo-400">{{ itemsSummary(order) }}</span>
              </div>
            </div>
            <!-- Right -->
            <div class="shrink-0 flex flex-col items-end gap-2">
              <span class="text-white text-sm font-medium">{{ formatMoney(activeSub === 'sell' ? order.gross_sale_vnd : order.total_vnd) }}</span>
              <span class="text-gray-500 text-xs">{{ formatDate(order.creation) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ HISTORY LIST ============ -->
      <div v-else-if="activeMain === 'history'" class="space-y-3">
        <div
          v-for="order in filteredHistory"
          :key="order.name"
          class="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition cursor-pointer"
          @click="router.push(`/order/${order.name.startsWith('SO') ? 'sell' : 'buy'}/${order.name}`)"
        >
          <div class="flex items-start gap-4">
            <!-- Left: Info -->
            <div class="flex-1 min-w-0 space-y-0.5">
              <div class="flex items-center gap-2">
                <span class="text-white font-semibold text-sm">{{ order.name }}</span>
                <span class="text-xs px-2 py-0.5 rounded-full" :class="statusBadge(order.status)">
                  {{ order.status }}
                </span>
                <span class="text-gray-600 text-xs">{{ userName(order.claimed_by) }}</span>
              </div>
              <div class="text-gray-500 text-xs">
                {{ order.sell_channel || order.buy_channel }}
                <template v-if="activeSub === 'sell' && (order.customer_name_snapshot || order.customer)">
                  <span class="text-gray-600 mx-1">•</span>
                  {{ order.customer_name_snapshot || order.customer }}
                </template>
                <template v-if="activeSub === 'buy' && order.supplier">
                  <span class="text-gray-600 mx-1">•</span>
                  {{ order.supplier }}
                </template>
              </div>
              <div class="text-gray-400 text-xs">
                {{ order.game_context }}
                <span class="text-gray-600 mx-1">•</span>
                <span class="text-indigo-400">{{ itemsSummary(order) }}</span>
              </div>
            </div>
            <!-- Right: Price + Date + Evidence -->
            <div class="shrink-0 flex items-center gap-4">
              <span class="text-white text-sm font-medium">{{ formatMoney(activeSub === 'sell' ? order.gross_sale_vnd : order.total_vnd) }}</span>
              <span class="text-gray-500 text-xs w-28 text-right">{{ formatDate(order.creation) }}</span>
              <button
                @click="openViewEvidence(order)"
                class="px-3 py-2 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition"
              >
                Bằng chứng
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ VIEW EVIDENCE MODAL ============ -->
      <div
        v-if="viewEvidenceModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
        @click.self="closeViewEvidence"
      >
        <div class="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4 overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-3 border-b border-gray-800">
            <h3 class="text-white font-semibold text-sm">
              Bằng chứng — {{ viewEvidenceOrder?.name }}
            </h3>
            <button @click="closeViewEvidence" class="text-gray-500 hover:text-white transition">
              ✕
            </button>
          </div>

          <!-- Body -->
          <div class="p-5 max-h-[70vh] overflow-y-auto">
            <div v-if="evidenceLoading" class="text-center py-8 text-gray-500 text-sm">
              Đang tải...
            </div>
            <div v-else-if="evidenceList.length === 0" class="text-center py-8 text-gray-600 text-sm">
              Không có bằng chứng
            </div>
            <div v-else class="space-y-4">
              <div
                v-for="ev in evidenceList"
                :key="ev.name"
                class="bg-gray-800 rounded-lg overflow-hidden"
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
                  class="px-4 py-6 text-center text-gray-500"
                >
                  📎 {{ ev.attachment.split('/').pop() }}
                </div>

                <!-- Meta -->
                <div class="px-4 py-2.5 flex items-center gap-3">
                  <span class="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">{{ ev.evidence_type }}</span>
                  <span v-if="ev.note" class="text-gray-400 text-xs truncate flex-1">{{ ev.note }}</span>
                  <span class="text-gray-600 text-xs">{{ formatDate(ev.uploaded_at) }}</span>

                  <!-- Download -->
                  <a
                    v-if="ev.attachment"
                    :href="ev.attachment"
                    download
                    class="shrink-0 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition"
                    @click.stop
                  >
                    Tải về
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ LIGHTBOX ============ -->
      <div
        v-if="lightboxOpen"
        class="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
        @click.self="closeLightbox"
      >
        <button
          @click="closeLightbox"
          class="absolute top-4 right-4 text-white/60 hover:text-white text-2xl z-10 transition"
        >
          ✕
        </button>

        <!-- Image -->
        <img
          v-if="lightboxItem && isImage(lightboxItem.attachment)"
          :src="lightboxItem.attachment"
          class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
          @click.stop
        />

        <!-- Video -->
        <video
          v-else-if="lightboxItem && isVideo(lightboxItem.attachment)"
          :src="lightboxItem.attachment"
          controls
          autoplay
          class="max-w-[90vw] max-h-[90vh] rounded-lg"
          @click.stop
        />

        <!-- Download bar -->
        <div
          v-if="lightboxItem"
          class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-gray-900/80 backdrop-blur px-4 py-2 rounded-lg border border-gray-700"
          @click.stop
        >
          <span class="text-gray-400 text-xs">{{ lightboxItem.evidence_type }}</span>
          <span v-if="lightboxItem.note" class="text-gray-500 text-xs truncate max-w-48">{{ lightboxItem.note }}</span>
          <a
            :href="lightboxItem.attachment"
            download
            class="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
          >
            Tải về
          </a>
        </div>
      </div>

      <!-- ============ UPLOAD EVIDENCE MODAL ============ -->
      <div
        v-if="evidenceModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        @click.self="closeEvidence"
      >
        <div class="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md mx-4 p-6">
          <h3 class="text-white font-bold text-lg mb-4">
            Upload Evidence - {{ evidenceOrder?.name }}
          </h3>
          <div class="space-y-4">
            <div>
              <label class="block text-xs text-gray-400 mb-1.5">Evidence Type</label>
              <select v-model="evidenceType" class="input-field">
                <option value="Screenshot">Screenshot</option>
                <option value="Video">Video</option>
                <option value="Chat">Chat</option>
                <option value="Note">Note</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1.5">File</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.mp4"
                @change="onFileChange"
                class="block w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700 file:cursor-pointer file:transition"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1.5">Note (optional)</label>
              <textarea v-model="evidenceNote" rows="3" class="input-field resize-none" placeholder="Ghi chú thêm..."></textarea>
            </div>
            <p v-if="evidenceError" class="text-red-400 text-sm">{{ evidenceError }}</p>
            <div class="flex gap-3">
              <button @click="closeEvidence" class="flex-1 py-2.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition">
                Huỷ
              </button>
              <button @click="submitEvidence" :disabled="uploading" class="flex-1 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition">
                {{ uploading ? 'Đang upload...' : 'Upload' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { debounce } from 'lodash-es'
import AppLayout from '../components/AppLayout.vue'
import { getList, frappeCall, getLoggedInUser, csrfToken } from '../api/index.js'
import { useAuth } from '../composables/useAuth.js'
import { useRealtime } from '../composables/useRealtime.js'
import { formatQty, formatMoney, formatDate, statusBadge, isImage, isVideo, userName, currencyName } from '../utils/format.js'
import { useMetadata } from '../composables/useMetadata.js'

const router = useRouter()
const { connected, subscribe, unsubscribe } = useRealtime()
const { isOpsManager, isAdmin } = useAuth()
const { currencyItemMap, fetchMetadata } = useMetadata()

// --- State ---
const activeMain = ref('queue')
const activeSub = ref('sell')
const loading = ref(false)
const claiming = ref('')
const transitioning = ref('')
const currentUser = ref('')
const search = ref('')

// Queue data
const queueSell = ref([])
const queueBuy = ref([])
// My Orders data
const mineSell = ref([])
const mineBuy = ref([])
// History data
const histSell = ref([])
const histBuy = ref([])
// Issues data
const issueSell = ref([])
const issueBuy = ref([])

// Evidence modal
const evidenceModal = ref(false)
const evidenceOrder = ref(null)
const evidenceType = ref('Screenshot')
const evidenceFile = ref(null)
const evidenceNote = ref('')
const evidenceError = ref('')
const uploading = ref(false)

// History expand + evidence
const viewEvidenceModal = ref(false)
const viewEvidenceOrder = ref(null)
const evidenceList = ref([])
const evidenceLoading = ref(false)

// Lightbox
const lightboxOpen = ref(false)
const lightboxItem = ref(null)

// --- Tabs ---
const mainTabs = computed(() => {
  const tabs = [
    { key: 'queue',   icon: '📋', label: 'Queue' },
    { key: 'mine',    icon: '⚡', label: 'My Orders' },
    { key: 'history', icon: '🕓', label: 'History' },
  ]
  if (isOpsManager.value || isAdmin.value) {
    tabs.splice(2, 0, { key: 'issues', icon: '⚠️', label: 'Issues' })
  }
  return tabs
})

const subTabs = [
  { key: 'sell', label: 'Sell Orders' },
  { key: 'buy',  label: 'Buy Orders' },
]

// --- Computed ---
const currentList = computed(() => {
  if (activeMain.value === 'queue') return activeSub.value === 'sell' ? queueSell.value : queueBuy.value
  if (activeMain.value === 'mine') return activeSub.value === 'sell' ? mineSell.value : mineBuy.value
  if (activeMain.value === 'issues') return activeSub.value === 'sell' ? issueSell.value : issueBuy.value
  return activeSub.value === 'sell' ? histSell.value : histBuy.value
})

const filteredHistory = computed(() => {
  if (activeMain.value !== 'history' || !search.value) return currentList.value
  const q = search.value.toLowerCase()
  return currentList.value.filter(o => o.name.toLowerCase().includes(q))
})

const emptyMessage = computed(() => {
  if (activeMain.value === 'queue') return 'Không có đơn nào trong queue'
  if (activeMain.value === 'mine') return 'Không có đơn nào đang xử lý'
  if (activeMain.value === 'issues') return 'Tuyệt vời, không có sự cố nào!'
  return 'Không có đơn nào trong lịch sử'
})

function mainCount(main) {
  const sell = main === 'queue' ? queueSell : main === 'mine' ? mineSell : main === 'issues' ? issueSell : histSell
  const buy = main === 'queue' ? queueBuy : main === 'mine' ? mineBuy : main === 'issues' ? issueBuy : histBuy
  return sell.value.length + buy.value.length
}

function subCount(main, sub) {
  if (main === 'queue') return sub === 'sell' ? queueSell.value.length : queueBuy.value.length
  if (main === 'mine') return sub === 'sell' ? mineSell.value.length : mineBuy.value.length
  if (main === 'issues') return sub === 'sell' ? issueSell.value.length : issueBuy.value.length
  return sub === 'sell' ? histSell.value.length : histBuy.value.length
}

// --- Helpers (imported from utils/format.js) ---

function itemsSummary(order) {
  // If child table items exist, show summary from items
  if (order.items && order.items.length > 0) {
    const first = order.items[0]
    const name = currencyName(first.currency_item, currencyItemMap.value)
    const qty = Number(first.quantity || 0).toLocaleString('vi-VN')
    if (order.items.length > 1) {
      return `${name} · ${qty} +${order.items.length - 1} more`
    }
    return `${name} · ${qty}`
  }
  // Fallback to legacy single fields
  return `${currencyName(order.currency_item, currencyItemMap.value)} · ${Number(order.quantity || 0).toLocaleString('vi-VN')}`
}

// --- Data Loading ---
async function loadAll() {
  if (!currentUser.value) return
  loading.value = true
  try {
    const promises = [
      getList('Sell Order', {
        fields: ['name', 'sell_channel', 'game_context', 'currency_item',
                 'quantity', 'gross_sale_vnd', 'customer',
                 'customer_name_snapshot', 'customer_btag_snapshot', 'status',
                 'items'],
        filters: [['status', '=', 'Queued']],
      }),
      getList('Buy Order', {
        fields: ['name', 'buy_channel', 'game_context', 'currency_item',
                 'quantity', 'total_vnd', 'supplier', 'status',
                 'items'],
        filters: [['status', '=', 'Queued']],
      }),
      getList('Sell Order', {
        fields: ['name', 'sell_channel', 'game_context', 'currency_item',
                 'quantity', 'gross_sale_vnd', 'customer',
                 'customer_name_snapshot', 'customer_btag_snapshot',
                 'status', 'claimed_by', 'items'],
        filters: [
          ['status', 'in', ['Claimed', 'In Delivery', 'Evidence Uploaded']],
          ['claimed_by', '=', currentUser.value],
        ],
      }),
      getList('Buy Order', {
        fields: ['name', 'buy_channel', 'game_context', 'currency_item',
                 'quantity', 'total_vnd', 'supplier',
                 'status', 'claimed_by', 'items'],
        filters: [
          ['status', 'in', ['Claimed', 'Receiving', 'Evidence Uploaded']],
          ['claimed_by', '=', currentUser.value],
        ],
      }),
      getList('Sell Order', {
        fields: ['name', 'sell_channel', 'game_context', 'currency_item',
                 'quantity', 'gross_sale_vnd', 'customer_name_snapshot',
                 'status', 'creation', 'claimed_by', 'items'],
        filters: [
          ['status', 'in', ['Completed', 'Failed', 'Cancelled', 'Disputed']],
          ['claimed_by', '=', currentUser.value],
        ],
        limit: 100,
      }),
      getList('Buy Order', {
        fields: ['name', 'buy_channel', 'game_context', 'currency_item',
                 'quantity', 'total_vnd', 'supplier',
                 'status', 'creation', 'claimed_by', 'items'],
        filters: [
          ['status', 'in', ['Completed', 'Failed', 'Cancelled', 'Payment Pending', 'Disputed']],
          ['claimed_by', '=', currentUser.value],
        ],
        limit: 100,
      }),
    ]

    let isIndex = -1, ibIndex = -1
    if (isOpsManager.value || isAdmin.value) {
      promises.push(getList('Sell Order', {
        fields: ['name', 'sell_channel', 'game_context', 'currency_item',
                 'quantity', 'gross_sale_vnd', 'customer_name_snapshot',
                 'status', 'creation', 'claimed_by', 'items'],
        filters: [['status', 'in', ['Failed', 'Cancelled', 'Disputed']]],
        limit: 100,
      }))
      isIndex = promises.length - 1
      
      promises.push(getList('Buy Order', {
        fields: ['name', 'buy_channel', 'game_context', 'currency_item',
                 'quantity', 'total_vnd', 'supplier',
                 'status', 'creation', 'claimed_by', 'items'],
        filters: [['status', 'in', ['Failed', 'Cancelled', 'Disputed']]],
        limit: 100,
      }))
      ibIndex = promises.length - 1
    }

    const results = await Promise.all(promises)
    queueSell.value = results[0]
    queueBuy.value = results[1]
    mineSell.value = results[2]
    mineBuy.value = results[3]
    histSell.value = results[4]
    histBuy.value = results[5]
    if (isIndex !== -1) issueSell.value = results[isIndex]
    if (ibIndex !== -1) issueBuy.value = results[ibIndex]
  } finally {
    loading.value = false
  }
}

// --- Actions ---
async function claimOrder(order) {
  claiming.value = order.name
  try {
    const doctype = activeSub.value === 'sell' ? 'Sell Order' : 'Buy Order'
    const res = await fetch(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(order.name)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Frappe-CSRF-Token': csrfToken(),
      },
      credentials: 'include',
      body: JSON.stringify({
        status: 'Claimed',
        workflow_state: 'Claimed',
        claimed_by: currentUser.value,
      }),
    })
    const data = await res.json()
    if (data.exc) throw new Error(data.exc)
    await loadAll()
  } catch (e) {
    alert('Lỗi: ' + e.message)
  } finally {
    claiming.value = ''
  }
}

async function transition(order, newState) {
  transitioning.value = order.name
  try {
    const doctype = activeSub.value === 'sell' ? 'Sell Order' : 'Buy Order'
    const res = await fetch(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(order.name)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Frappe-CSRF-Token': csrfToken(),
      },
      credentials: 'include',
      body: JSON.stringify({ status: newState, workflow_state: newState }),
    })
    const data = await res.json()
    if (data.exc) throw new Error(data.exc)
    await loadAll()
  } catch (e) {
    alert('Lỗi: ' + e.message)
  } finally {
    transitioning.value = ''
  }
}

// --- View Evidence Modal ---
async function openViewEvidence(order) {
  viewEvidenceOrder.value = order
  viewEvidenceModal.value = true
  evidenceLoading.value = true
  evidenceList.value = []
  try {
    const doctype = activeSub.value === 'sell' ? 'Sell Order' : 'Buy Order'
    evidenceList.value = await getList('Order Evidence', {
      fields: ['name', 'evidence_type', 'attachment', 'note', 'status', 'uploaded_by', 'uploaded_at'],
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

function closeLightbox() {
  lightboxOpen.value = false
  lightboxItem.value = null
}

// --- Evidence Modal ---
function openEvidence(order) {
  evidenceOrder.value = order
  evidenceType.value = 'Screenshot'
  evidenceFile.value = null
  evidenceNote.value = ''
  evidenceError.value = ''
  evidenceModal.value = true
}

function closeEvidence() {
  evidenceModal.value = false
  evidenceOrder.value = null
}

function onFileChange(e) {
  evidenceFile.value = e.target.files[0] || null
}

async function uploadFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('is_private', '0')
  const res = await fetch('/api/method/upload_file', {
    method: 'POST',
    headers: { 'X-Frappe-CSRF-Token': csrfToken() },
    credentials: 'include',
    body: formData,
  })
  const data = await res.json()
  return data.message?.file_url
}

async function submitEvidence() {
  evidenceError.value = ''
  if (!evidenceFile.value) {
    evidenceError.value = 'Vui lòng chọn file'
    return
  }
  uploading.value = true
  try {
    const fileUrl = await uploadFile(evidenceFile.value)
    if (!fileUrl) throw new Error('Upload file thất bại')

    const doctype = activeSub.value === 'sell' ? 'Sell Order' : 'Buy Order'
    const res = await fetch('/api/resource/Order Evidence', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Frappe-CSRF-Token': csrfToken(),
      },
      credentials: 'include',
      body: JSON.stringify({
        reference_doctype: doctype,
        reference_name: evidenceOrder.value.name,
        evidence_type: evidenceType.value,
        attachment: fileUrl,
        note: evidenceNote.value,
        status: 'Uploaded',
      }),
    })
    const data = await res.json()
    if (data.exc) throw new Error(data.exc)

    closeEvidence()
    await loadAll()
  } catch (e) {
    evidenceError.value = 'Lỗi: ' + e.message
  } finally {
    uploading.value = false
  }
}

const debouncedLoadAll = debounce(loadAll, 1000)

// --- Init ---
onMounted(async () => {
  currentUser.value = await getLoggedInUser()
  fetchMetadata()
  await loadAll()
  subscribe('Sell Order', debouncedLoadAll)
  subscribe('Buy Order', debouncedLoadAll)
})

onUnmounted(() => {
  unsubscribe('Sell Order')
  unsubscribe('Buy Order')
})
</script>

<style scoped>
.input-field {
  width: 100%;
  background: #1f2937;
  border: 1px solid #374151;
  color: white;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.15s;
}
.input-field:focus { border-color: #6366f1; }
.input-field option { background: #1f2937; }
</style>
