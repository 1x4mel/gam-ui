<template>
  <div
    :id="order.name"
    class="rounded-2xl overflow-hidden transition-all duration-300 flex flex-col shadow-sm relative group hover:shadow-lg border-l-4"
    :class="[
      orderType === 'buy' ? 'bg-blue-500/[0.03] border-l-blue-600 border-t border-r border-b border-blue-500/20 hover:border-blue-400/40' : 'bg-orange-500/[0.03] border-l-orange-600 border-t border-r border-b border-orange-500/20 hover:border-orange-400/40',
      isDragOver && canDropEvidence ? 'ring-2 ring-indigo-500 border-indigo-500' : '',
    ]"
    @dragover.prevent="canDropEvidence && (isDragOver = true)"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <!-- Drop overlay -->
    <div v-if="isDragOver && canDropEvidence"
      class="absolute inset-0 z-30 bg-indigo-600/20 backdrop-blur-sm flex items-center justify-center rounded-2xl">
      <div class="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl">
        📸 Thả file để tải bằng chứng
      </div>
    </div>

    <!-- HEADER -->
    <div class="px-4 sm:px-5 py-2.5 border-b flex items-center justify-between gap-3 flex-wrap"
      :class="orderType === 'buy' ? 'border-blue-500/15 bg-blue-500/[0.04]' : 'border-orange-500/15 bg-orange-500/[0.04]'">
      <div class="flex items-center gap-2 sm:gap-3 min-w-0">
        <span class="text-[10px] px-2 py-0.5 rounded font-black tracking-widest shrink-0"
          :class="orderType === 'buy' ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white'">
          {{ orderType === 'buy' ? 'BUY' : 'SELL' }}
        </span>
        <span v-if="order.game_context && gameTitle && order.game_context !== gameTitle"
          class="text-[9px] px-1.5 py-0.5 rounded font-black tracking-wide shrink-0 bg-amber-500/10 text-amber-600 border border-amber-500/20">
          {{ order.game_context }}
        </span>
        <StatusBadge :status="order.status" />
        <span v-if="order.is_negotiation && order.negotiation_status === 'Pending'"
          class="text-[9px] px-1.5 py-0.5 rounded font-black tracking-wide shrink-0 bg-amber-500/15 text-amber-600 border border-amber-500/25">
          Chờ ML
        </span>
        <span v-if="order.is_negotiation && order.negotiation_status === 'Confirmed'"
          class="text-[9px] px-1.5 py-0.5 rounded font-black tracking-wide shrink-0 bg-emerald-500/15 text-emerald-600 border border-emerald-500/25">
          ML duyệt
        </span>
        <span class="text-app-text-muted text-[10px] font-mono">{{ order.name }}</span>
        <div v-if="timerData"
          class="flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-mono font-bold"
          :class="timerData.color + ' border-current/10'">
          ⏱ {{ timerData.formatted }}
        </div>
      </div>

      <div class="flex items-center gap-2.5 shrink-0 flex-wrap">
        <div class="flex items-center gap-1.5 text-[10px] text-app-text-muted font-bold uppercase tracking-widest">
          <div class="flex items-center gap-1" :title="'Người tạo: ' + (order.owner || '')">
            <span class="opacity-50 text-[9px]">Tạo</span>
            <span class="text-app-text-secondary capitalize">{{ userName(order.owner) }}</span>
          </div>
          <template v-if="order.claimed_by">
            <span class="text-app-border">|</span>
            <div class="flex items-center gap-1" :title="'Người nhận: ' + order.claimed_by">
              <span class="opacity-50 text-[9px]">Nhận</span>
              <span class="text-app-text-secondary capitalize">{{ userName(order.claimed_by) }}</span>
            </div>
          </template>
          <template v-if="order.assigned_trader">
            <span class="text-app-border">|</span>
            <div class="flex items-center gap-1" :title="'Người thanh toán: ' + order.assigned_trader">
              <span class="opacity-50 text-[9px]">TT</span>
              <span class="text-app-text-secondary capitalize">{{ userName(order.assigned_trader) }}</span>
            </div>
          </template>
          <template v-if="order.price_set_by">
            <span class="text-app-border">|</span>
            <div class="flex items-center gap-1" :title="'ML duyết giá lúc ' + (order.price_set_at || '')">
              <span class="opacity-50 text-[9px]">ML</span>
              <span class="text-app-text-secondary capitalize">{{ userName(order.price_set_by) }}</span>
            </div>
          </template>
        </div>
        <span class="font-app-text-primary font-mono text-sm font-black px-2 py-0.5 rounded-lg"
          :class="orderType === 'buy' ? 'text-blue-700 bg-blue-500/10' : 'text-orange-700 bg-orange-500/10'">
          {{ formatMoney(orderType === 'buy' ? order.total_vnd : order.gross_sale_vnd, orderType === 'buy' ? order.transaction_currency : order.sale_currency) }}
        </span>
        <span class="text-[10px] text-app-text-muted opacity-70">{{ formatDate(order.creation) }}</span>
      </div>
    </div>

    <!-- MAIN BODY -->
    <div class="p-4 sm:p-5 pb-3 sm:pb-4 flex-1">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- COLUMN 1 (2/3): IDENTIFICATION & ITEMS -->
        <div class="space-y-3 border-b md:border-b-0 md:border-r border-app-border/50 pb-3 md:pb-0 md:pr-4 md:col-span-2">
          <!-- Channel | External ID | Customer/Supplier -->
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <span class="text-app-text-muted uppercase text-[9px] font-black tracking-widest w-14 shrink-0">{{ orderType === 'buy' ? 'NCC' : 'KHÁCH' }}:</span>
            <template v-if="orderType === 'buy' && partyUrl">
              <a :href="partyUrl" target="_blank" rel="noopener" @click.stop
                class="font-bold underline decoration-blue-400/50 underline-offset-2 hover:text-blue-400 hover:decoration-blue-400 transition-colors"
                :class="orderType === 'buy' ? 'text-blue-700' : 'text-orange-700'">
                {{ channel }} <span class="text-app-text-muted mx-1">|</span> <span class="text-app-text-secondary">{{ displayName }}</span>
              </a>
            </template>
            <template v-else-if="orderType === 'sell' && order.order_url">
              <a :href="order.order_url" target="_blank" rel="noopener" @click.stop
                class="font-bold underline decoration-orange-400/50 underline-offset-2 hover:text-orange-400 hover:decoration-orange-400 transition-colors"
                :class="orderType === 'sell' ? 'text-orange-700' : 'text-blue-700'">
                {{ channel }} <span class="text-app-text-muted mx-1">|</span> <span class="text-app-text-secondary">{{ displayName }}</span>
              </a>
            </template>
            <template v-else>
              <span class="font-bold" :class="orderType === 'buy' ? 'text-blue-700' : 'text-orange-700'">
                {{ channel }} <span class="text-app-text-muted mx-1">|</span> <span class="text-app-text-secondary">{{ displayName }}</span>
              </span>
            </template>
          </div>

          <!-- Item Summary (non-editing) -->
          <div v-if="!isEditingItems">
            <div v-if="order.order_item_title || order.items?.length || order.currency_item" class="flex-1 min-w-0">
              <!-- Title matched with items -->
              <div v-if="order.order_item_title && (!order.items?.length || isTitleMatched)"
                class="flex items-baseline gap-2 flex-wrap">
                <span class="text-lg sm:text-xl font-black tracking-tight"
                  :class="orderType === 'buy' ? 'text-blue-700' : 'text-orange-700'">{{ order.order_item_title }}</span>
                <span v-if="order.order_quantity" class="text-base sm:text-lg font-black text-app-text-primary"> x {{ Number(order.order_quantity).toLocaleString('vi-VN') }}</span>
                <button v-if="canEditItems" @click.stop="startEditItems" class="text-indigo-500 hover:text-indigo-400 shrink-0 text-sm">✏️</button>
              </div>
              <!-- Item list (not matched) -->
              <div v-else-if="order.items && order.items.length > 0 && !isTitleMatched" class="space-y-1">
                <div v-for="(item, idx) in order.items" :key="idx" class="flex items-baseline gap-2 flex-wrap">
                  <span class="text-base sm:text-lg font-black tracking-tight"
                    :class="orderType === 'buy' ? 'text-blue-700' : 'text-orange-700'">{{ itemName(item) }}</span>
                  <span class="text-sm sm:text-base font-black text-app-text-primary">x {{ Number(item.quantity || 0).toLocaleString('vi-VN') }}</span>
                  <button v-if="canEditItems && idx === 0" @click.stop="startEditItems" class="text-indigo-500 hover:text-indigo-400 shrink-0 text-sm">✏️</button>
                </div>
              </div>
              <!-- Single currency_item fallback -->
              <div v-else-if="order.currency_item && !order.order_item_title"
                class="flex items-baseline gap-2 flex-wrap">
                <span class="text-lg sm:text-xl font-black tracking-tight"
                  :class="orderType === 'buy' ? 'text-blue-700' : 'text-orange-700'">{{ itemName(order) }}</span>
                <span class="text-base sm:text-lg font-black text-app-text-primary">x {{ Number(order.quantity || 0).toLocaleString('vi-VN') }}</span>
              </div>
            </div>
            <!-- Add items button -->
            <div v-else-if="canEditItems" class="flex items-center gap-2">
              <button @click.stop="startEditItems" class="text-indigo-500 hover:text-indigo-400 flex items-center gap-1 text-sm font-bold">
                <span class="text-app-text-muted uppercase text-[9px] font-black tracking-widest">Chưa có items</span>
                <span>✏️</span>
              </button>
            </div>
          </div>

          <!-- INLINE EDIT ITEMS -->
          <div v-if="isEditingItems" class="text-[11px] space-y-1" @click.stop>
            <div v-for="(item, idx) in editedItems" :key="idx" class="flex items-center gap-1">
              <SearchableSelect :model-value="item.currency_item" @update:model-value="val => onItemSelect(idx, val)" :options="rowItemOpts(idx)" placeholder="Mặt hàng" class="flex-1 min-w-0 !text-[10px]" compact />
              <input v-model.number="item.quantity" type="number" min="1" step="any"
                class="w-16 text-right bg-app-bg text-app-text-primary border border-app-border rounded px-1.5 py-0.5 text-[10px] font-mono font-bold outline-none focus:border-indigo-600" placeholder="SL" />
              <input v-model.number="item.unit_price" type="number" min="0" step="any"
                class="w-20 text-right bg-app-bg text-app-text-primary border border-app-border rounded px-1.5 py-0.5 text-[10px] font-mono font-bold outline-none focus:border-indigo-600" placeholder="Đơn giá" />
              <button v-if="editedItems.length > 1" type="button" @click.stop="editedItems.splice(idx, 1)" class="text-red-400 hover:text-red-300 text-[10px] px-0.5">&#10005;</button>
            </div>
            <div class="flex items-center gap-2 pt-0.5">
              <button type="button" @click.stop="addEditRow" class="text-[9px] font-bold text-indigo-500 hover:text-indigo-400 uppercase tracking-widest">+ Thêm</button>
              <div class="ml-auto flex items-center gap-1">
                <button type="button" @click.stop="saveEditItems" :disabled="savingItems" class="text-[9px] font-bold text-emerald-600 hover:text-emerald-500 uppercase tracking-widest disabled:opacity-40">{{ savingItems ? '...' : 'Lưu' }}</button>
                <button type="button" @click.stop="cancelEditItems" class="text-[9px] font-bold text-app-text-muted hover:text-app-text-secondary uppercase tracking-widest">Huỷ</button>
              </div>
            </div>
          </div>

          <!-- Player Ingame / BTag -->
          <div v-if="orderType === 'sell' && order.customer_btag_snapshot"
            class="flex items-center gap-2 group/btag">
            <span class="text-app-text-muted uppercase text-[9px] font-black tracking-widest w-14 shrink-0">BTAG:</span>
            <span class="font-mono font-bold text-app-text-secondary text-sm flex-1">{{ order.customer_btag_snapshot }}</span>
            <button @click.stop="copyBtag"
              class="shrink-0 px-3 py-2 text-xs font-black uppercase tracking-wider rounded-xl border transition-all active:scale-95"
              :class="btagCopied ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : 'bg-orange-500/10 text-orange-600 border-orange-500/30 hover:bg-orange-500/20'">
              {{ btagCopied ? 'COPIED' : 'COPY' }}
            </button>
          </div>
          <CopyRow v-if="orderType === 'sell' && order.customer_handle_snapshot" label="INGAME" :value="order.customer_handle_snapshot" copy-title="Sao chép Ingame" color="secondary" />
          <CopyRow v-if="orderType === 'buy' && order.target_game_account" label="TAGET" :value="order.target_game_account" copy-title="Sao chép tài khoản đích" color="secondary" />
        </div>

        <!-- COLUMN 2 (1/3): NOTES & LOGS -->
        <div class="space-y-3 flex flex-col pt-1 md:pt-0">
          <!-- Legacy Note -->
          <div class="px-3 py-2 bg-yellow-500/5 border-l-4 border-yellow-500/50 rounded-r-xl text-[10px] flex items-start justify-between group/note transition-all hover:bg-yellow-500/10 mt-2">
            <div class="flex-1 min-w-0">
              <span class="text-yellow-600 uppercase tracking-widest font-black mr-2">Ghi chú:</span>
              <span v-if="order.note" class="text-app-text-secondary text-[15px] font-medium leading-relaxed break-all" v-html="linkify(stripHtml(order.note).substring(0, 200)) + (order.note.length > 200 ? '...' : '')"></span>
              <span v-else class="text-app-text-muted/40 italic">Chưa có ghi chú</span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <CopyButton v-if="order.note" :text="stripHtml(order.note)" title="Copy Ghi chú" color-class="text-yellow-500" copied-color-class="text-emerald-600 bg-emerald-50!" />
              <button v-if="isTrader1 || isAdmin" @click.stop="$emit('edit-note', order)"
                class="opacity-0 group-hover/note:opacity-100 p-1 hover:bg-yellow-500/20 rounded-lg transition text-yellow-500"
                title="Sửa ghi chú">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
            </div>
          </div>

          <!-- Latest Activity -->
          <div v-if="order.latest_activity" class="flex justify-between items-center gap-3 bg-app-bg/50 px-3 py-2 rounded-xl border border-app-border group-hover:bg-app-bg transition-colors">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-[9px] w-5 h-5 flex items-center justify-center shrink-0 border border-app-border rounded-full shadow-sm bg-app-surface font-black" :class="logStyle(order.latest_activity.action)">{{ logIcon(order.latest_activity.action) }}</span>
              <div class="flex flex-col min-w-0">
                <span class="text-[9px] text-app-text-muted font-medium flex items-center gap-1.5">
                  <span class="text-app-text-primary font-black">{{ userName(order.latest_activity.owner) || 'System' }}</span>
                  <span class="text-app-text-muted/50">•</span>
                  <span class="uppercase tracking-widest font-black text-[8px]" :class="logColor(order.latest_activity.action)">{{ order.latest_activity.action }}</span>
                </span>
                <span class="text-app-text-secondary font-bold text-[10px]" :title="stripHtml(order.latest_activity.note)" v-html="linkify(stripHtml(order.latest_activity.note))"></span>
              </div>
            </div>
            <span class="text-[8px] text-app-text-muted font-black uppercase tracking-wider shrink-0 opacity-70">{{ formatTimeAgo(order.latest_activity.creation) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- CANCEL REASON -->
    <div v-if="cancelReason" class="px-4 sm:px-5 py-2.5 border-b border-red-500/20 bg-red-500/[0.04] flex items-start gap-2.5">
      <span class="text-xs mt-0.5 shrink-0">🚫</span>
      <div class="flex-1 min-w-0">
        <span class="text-red-500 text-[9px] font-black uppercase tracking-widest">Lý do hủy:</span>
        <span class="text-app-text-secondary text-[11px] font-medium leading-relaxed break-all ml-1" v-html="linkify(cancelReason)"></span>
      </div>
      <span class="text-[9px] text-app-text-muted shrink-0 mt-0.5">{{ userName(order.cancel_reason?.owner) }}</span>
    </div>

    <!-- ACTIONS STRIP -->
    <div v-if="$slots.actions" class="px-4 sm:px-5 py-3 sm:py-4 border-t flex items-center gap-2 sm:gap-3 justify-end flex-wrap transition-colors"
      :class="orderType === 'buy' ? 'border-blue-500/15 bg-blue-500/[0.02] group-hover:bg-blue-500/[0.05]' : 'border-orange-500/15 bg-orange-500/[0.02] group-hover:bg-orange-500/[0.05]'"
      @click.stop
      @dblclick="$emit('dblclick', order)">
      <slot name="actions"></slot>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuth } from '../composables/useAuth.js'
import { useMetadata } from '../composables/useMetadata.js'
import { frappeCall } from '../api/index.js'
import CopyButton from './CopyButton.vue'
import CopyRow from './CopyRow.vue'
import SearchableSelect from './SearchableSelect.vue'
import { formatMoney, formatDate, userName, currencyName, formatTimeAgo, stripHtml, linkify } from '../utils/format.js'
import StatusBadge from './StatusBadge.vue'
import { logIcon, logStyle, logColor } from '../utils/logHelpers.js'

const props = defineProps({
  order: { type: Object, required: true },
  orderType: { type: String, required: true },
})

const emit = defineEmits(['edit-note', 'drop-evidence', 'dblclick', 'items-updated'])

const { isTrader1, isAdmin, isTrader2, isOpsManager, user: currentUser } = useAuth()
const { currencyItemMap, currencyItems, gameContexts } = useMetadata()
const isDragOver = ref(false)

// Inline edit items
const isEditingItems = ref(false)
const editedItems = ref([])
const savingItems = ref(false)

const canDropEvidence = computed(() => {
  if (!isTrader2.value) return false
  const s = props.order.status
  if (props.order.name.startsWith('SO')) return ['In Delivery', 'Evidence Uploaded'].includes(s)
  if (props.order.name.startsWith('BO')) return ['Receiving', 'Evidence Uploaded'].includes(s)
  return false
})

function onDragLeave(e) {
  const card = e.currentTarget
  const related = e.relatedTarget
  if (!related || !card.contains(related)) {
    isDragOver.value = false
  }
}

function onDrop(e) {
  isDragOver.value = false
  if (!canDropEvidence.value) return
  const files = e.dataTransfer?.files
  if (!files || !files.length) return
  emit('drop-evidence', { order: props.order, files: Array.from(files) })
}

const btagCopied = ref(false)
let btagTimer = null
function copyBtag() {
  const text = props.order.customer_btag_snapshot || ''
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text)
  } else {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  btagCopied.value = true
  clearTimeout(btagTimer)
  btagTimer = setTimeout(() => { btagCopied.value = false }, 1500)
}

const now = ref(Date.now())
let globalTimer = null

onMounted(() => {
  globalTimer = setInterval(() => { now.value = Date.now() }, 1000)
})

onUnmounted(() => {
  if (globalTimer) clearInterval(globalTimer)
})

const timerData = computed(() => {
  if (['Completed', 'Failed', 'Cancelled'].includes(props.order.status)) return null

  let targetStr = props.order.creation
  if (!targetStr) return null

  const dtStr = (typeof targetStr === 'string' && !targetStr.includes('Z') && !targetStr.includes('+'))
    ? targetStr.replace(' ', 'T') + '+07:00'
    : targetStr

  const targetTime = new Date(dtStr).getTime()
  if (isNaN(targetTime)) return null

  const diffSeconds = Math.max(0, Math.floor((now.value - targetTime) / 1000))

  const h = Math.floor(diffSeconds / 3600)
  const m = Math.floor((diffSeconds % 3600) / 60)
  const s = diffSeconds % 60

  const formatted = h > 0
    ? `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`

  let color = 'text-app-text-muted bg-app-bg border-app-border scale-[0.98]'
  if (diffSeconds < 300) {
    color = 'text-emerald-400 bg-emerald-500/10'
  } else if (diffSeconds < 900) {
    color = 'text-orange-400 bg-orange-500/10'
  } else {
    color = 'text-red-400 bg-red-500/10 font-bold animate-pulse'
  }

  return { formatted, color }
})

const displayName = computed(() => {
  if (props.orderType === 'buy') return props.order._partyInfo?.name || props.order.supplier || '—'
  return props.order.customer_name_snapshot || props.order.customer || '—'
})

const channel = computed(() => {
  return props.orderType === 'buy'
    ? (props.order.buy_channel || '—')
    : (props.order.sell_channel || '—')
})

const partyUrl = computed(() => props.order._partyInfo?.url || '')

function stripGamePrefix(str) {
  return str.replace(/^(D4|PoE\s*1|PoE\s*2|Diablo\s*4|Path\s*of\s*Exile\s*1|Path\s*of\s*Exile\s*2)\s*/i, '').trim()
}

const isTitleMatched = computed(() => {
  const order = props.order
  if (!order.order_item_title || !order.items || order.items.length === 0) return false
  const title = order.order_item_title.toUpperCase().trim()
  return order.items.every(item => {
    const name = itemName(item).toUpperCase().trim()
    const stripped = stripGamePrefix(name).toUpperCase().trim()
    return title.includes(name) || name.includes(title) || (stripped && (title.includes(stripped) || stripped.length >= 3 && title.replace(/[^A-Z0-9]/g, '').includes(stripped.replace(/[^A-Z0-9]/g, ''))))
  })
})

function itemName(item) {
  return item.currency_item_name ? item.currency_item_name : currencyName(item.currency_item, currencyItemMap.value)
}

const canEditItems = computed(() => {
  if (!props.order) return false
  const locked = ['Completed', 'Failed', 'Cancelled', 'Disputed', 'Refunded', 'Outstanding']
  if (locked.includes(props.order.status)) return false
  return !!(isTrader1.value || isAdmin.value || isOpsManager.value || (isTrader2.value && props.order.claimed_by === currentUser.value))
})

const refPrices = ref({})

const itemOpts = computed(() => {
  let items = currencyItems.value
  if (props.order?.game_context) {
    const gc = gameContexts.value.find(g => g.name === props.order.game_context)
    if (gc) items = items.filter(i => i.game_title === gc.game_title)
  }
  return items.map(i => ({ label: i.item_name || i.name, value: i.name }))
})

function rowItemOpts(idx) {
  const taken = new Set(editedItems.value.map((it, i) => i !== idx ? it.currency_item : null).filter(Boolean))
  return itemOpts.value.filter(o => !taken.has(o.value) || o.value === editedItems.value[idx]?.currency_item)
}

async function startEditItems() {
  editedItems.value = (props.order.items || []).map(i => ({
    name: i.name,
    currency_item: i.currency_item,
    quantity: i.quantity,
    unit_price: i.unit_price,
  }))
  isEditingItems.value = true
  // Fetch reference prices
  if (props.order.game_context) {
    try {
      refPrices.value = await frappeCall('gege_custom.gege_custom.api.flip_session.get_reference_prices', {
        game_context: props.order.game_context,
      }) || {}
    } catch {}
  }
}

function onItemSelect(idx, val) {
  editedItems.value[idx].currency_item = val
  if (!val) return
  const existing = props.order.items?.find(i => i.currency_item === val)
  if (existing?.unit_price) {
    editedItems.value[idx].unit_price = existing.unit_price
    return
  }
  const ref = refPrices.value[val]
  if (ref && ref > 0) editedItems.value[idx].unit_price = ref
}

function cancelEditItems() {
  isEditingItems.value = false
  editedItems.value = []
}
function addEditRow() {
  editedItems.value.push({ currency_item: '', quantity: 1, unit_price: 0 })
}

async function saveEditItems() {
  const valid = editedItems.value.filter(i => i.currency_item && i.quantity > 0)
  if (!valid.length) return
  savingItems.value = true
  try {
    const items = valid.map(i => ({
      name: i.name || undefined,
      currency_item: i.currency_item,
      quantity: i.quantity,
      unit_price: i.unit_price,
    }))
    if (props.orderType === 'buy') {
      await frappeCall('gege_custom.gege_custom.utils.update_buy_order_items', {
        name: props.order.name,
        buy_items: JSON.stringify(items),
      })
    } else {
      await frappeCall('gege_custom.gege_custom.utils.update_sell_order_items', {
        name: props.order.name,
        sell_items: JSON.stringify(items),
      })
    }
    isEditingItems.value = false
    editedItems.value = []
    emit('items-updated', props.order)
  } catch (e) {
    console.error('Save items error:', e)
  } finally {
    savingItems.value = false
  }
}

const gameTitle = computed(() => {
  const ctx = props.order.game_context || ''
  if (ctx.startsWith('D4')) return 'Diablo 4'
  if (ctx.startsWith('PoE1')) return 'Path of Exile 1'
  if (ctx.startsWith('PoE2')) return 'Path of Exile 2'
  const items = props.order.items
  if (items?.length) {
    const ci = items[0].currency_item || ''
    if (ci.includes('D4') || ci.includes('Diablo')) return 'Diablo 4'
    if (ci.includes('PoE1') || ci.includes('PoE 1')) return 'Path of Exile 1'
    if (ci.includes('PoE2') || ci.includes('PoE 2')) return 'Path of Exile 2'
  }
  return ctx || ''
})

const cancelReason = computed(() => {
  const s = props.order.status || props.order.workflow_state || ''
  if (s !== 'Cancelled' && s !== 'Cancellation Requested') return ''
  return props.order.cancel_reason?.note || ''
})
</script>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
