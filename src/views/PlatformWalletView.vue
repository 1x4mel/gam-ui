<template>
  <div class="w-full flex flex-col h-full">
    <div class="shrink-0 flex items-center gap-3 mb-4 bg-app-surface border border-app-border rounded-2xl p-3 sm:p-4 shadow-sm mx-2 mt-2">
      <BackButton @click="$router.push('/payments')" />
      <h2 class="text-base sm:text-lg font-black text-app-text-primary uppercase tracking-tight">Ví nền tảng</h2>
      <div class="flex-1" />
      <button v-if="canAdjust" @click="openAdjust"
        class="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 transition">⚙ Điều chỉnh</button>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
      <LoadingSpinner v-if="loading && entries.length === 0" class="flex items-center justify-center py-20" />
      <template v-else>
        <!-- Wallet cards -->
        <div v-if="wallets.length" :class="wallets.length <= 3 ? 'flex flex-wrap gap-3 mb-4 px-1' : 'grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 px-1'">
          <div v-for="w in wallets" :key="w.name"
            class="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 cursor-pointer transition"
            :class="[selectedChannel === w.channel ? 'ring-2 ring-indigo-500' : '', wallets.length <= 3 ? 'flex-1 min-w-[160px]' : '']"
            @click="selectedChannel = selectedChannel === w.channel ? '' : w.channel">
            <p class="text-xs font-black text-amber-600 uppercase tracking-widest mb-1">{{ w.channel }}</p>
            <p class="text-xl font-black text-app-text-primary">{{ formatNum(w.balance) }} <span class="text-sm">{{ w.currency }}</span></p>
          </div>
        </div>

        <!-- Filters -->
        <div class="flex items-center gap-2 mb-4 px-1 flex-wrap">
          <select v-model="selectedChannel" class="input-field !py-1.5 !px-3 text-sm w-36">
            <option value="">Tất cả nền tảng</option>
            <option v-for="w in wallets" :key="w.name" :value="w.channel">{{ w.channel }}</option>
          </select>
          <div class="flex items-center gap-1.5">
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest">Từ</label>
            <input v-model="fromDate" type="date" class="input-field !py-1.5 !px-3 text-sm w-36" />
          </div>
          <div class="flex items-center gap-1.5">
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest">Đến</label>
            <input v-model="toDate" type="date" class="input-field !py-1.5 !px-3 text-sm w-36" />
          </div>
          <div class="flex-1" />
          <span class="text-app-text-muted text-xs font-bold">{{ totalItems }} giao dịch</span>
        </div>

        <!-- Transaction list -->
        <EmptyState v-if="entries.length === 0 && !loading" message="Không có giao dịch nền tảng" />
        <div v-else class="px-1 space-y-2">
          <div v-for="e in entries" :key="e.name" class="bg-app-surface border border-app-border rounded-xl p-4">
            <div class="flex items-center justify-between mb-1.5">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold px-2.5 py-1 rounded-full"
                  :class="e.transaction_type === 'In' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'">
                  {{ e.transaction_type === 'In' ? 'Thu' : 'Chi' }}
                </span>
                <span class="text-xs font-bold px-2 py-1 rounded bg-blue-500/10 text-blue-600">{{ getChannel(e.bank_account) }}</span>
              </div>
              <span class="text-base font-black" :class="e.transaction_type === 'In' ? 'text-emerald-600' : 'text-red-500'">
                {{ e.transaction_type === 'In' ? '+' : '-' }}{{ formatNum(e.amount) }} <span class="text-xs">{{ e.currency }}</span>
              </span>
            </div>
            <p class="text-sm text-app-text-muted line-clamp-1">{{ e.description || e.reference_name }}</p>
            <div class="flex items-center justify-between mt-1.5">
              <span class="text-xs text-app-text-muted">{{ formatTime(e.timestamp) }}</span>
              <span class="text-xs text-app-text-primary font-bold">Số dư: {{ formatNum(e.balance_after) }}</span>
            </div>
          </div>
          <LoadingSpinner v-if="loading" class="flex items-center justify-center py-6" />
        </div>
    </template>
    </div>

    <!-- Pagination bar -->
    <div v-if="totalItems > 0" class="flex-shrink-0 border-t border-app-border bg-app-surface px-3 sm:px-4 py-2">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm text-app-text-muted">
        <div class="flex items-center gap-2">
          <span>{{ ((currentPage - 1) * pageSize) + 1 }}-{{ Math.min(currentPage * pageSize, totalItems) }} / {{ totalItems }}</span>
          <select
            :value="pageSize"
            @change="changePageSize(Number($event.target.value))"
            class="bg-app-bg border border-app-border rounded-lg px-2 py-1 text-app-text-primary text-xs"
          >
            <option v-for="opt in [10, 20, 30]" :key="opt" :value="opt">{{ opt }} / trang</option>
          </select>
        </div>
        <div class="flex items-center gap-1">
          <button @click="goToPage(currentPage - 1)" :disabled="currentPage <= 1"
            class="px-2 py-1 rounded-lg hover:bg-app-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <template v-for="p in visiblePages" :key="p">
            <span v-if="p === '...'" class="px-1 text-app-text-muted">...</span>
            <button v-else @click="goToPage(p)"
              class="w-7 h-7 rounded-lg text-xs font-bold transition-colors"
              :class="p === currentPage ? 'bg-indigo-600 text-white' : 'hover:bg-app-bg text-app-text-secondary'"
            >{{ p }}</button>
          </template>
          <button @click="goToPage(currentPage + 1)" :disabled="currentPage >= totalPages"
            class="px-2 py-1 rounded-lg hover:bg-app-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Adjust modal -->
    <div v-if="adjustOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" @click.self="adjustOpen = false">
      <div class="bg-app-surface border border-app-border rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div class="px-8 py-6 border-b border-app-border flex justify-between items-center bg-app-bg/50">
          <h3 class="text-app-text-primary font-black text-lg uppercase tracking-tight">Điều chỉnh nền tảng</h3>
          <button @click="adjustOpen = false" class="text-app-text-muted hover:text-app-text-primary transition p-2 hover:bg-app-bg rounded-xl text-xl">&#10005;</button>
        </div>
        <div class="flex-1 overflow-y-auto p-8 space-y-5">
          <div v-if="adjustError" class="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-500 font-bold">{{ adjustError }}</div>
          <div>
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Nền tảng <span class="text-red-500">*</span></label>
            <SearchableSelect v-model="adjustForm.wallet" :options="walletOpts" placeholder="-- Chọn nền tảng --" compact />
          </div>
          <div>
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Số tiền <span class="text-red-500">*</span></label>
            <input v-model="adjustForm.amount" type="number" step="0.01" class="input-field !py-2.5 text-sm" placeholder="Dương = tăng, âm = giảm" />
            <p class="text-xs text-app-text-muted mt-1">Nhập số dương để tăng, số âm để giảm số dư</p>
          </div>
          <div>
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Ghi chú</label>
            <input v-model="adjustForm.note" type="text" class="input-field !py-2.5 text-sm" placeholder="Lý do điều chỉnh..." />
          </div>
        </div>
        <div class="px-8 py-5 border-t border-app-border flex justify-end gap-3">
          <button @click="adjustOpen = false" class="px-5 py-2 rounded-xl text-sm font-bold text-app-text-muted hover:text-app-text-primary hover:bg-app-bg transition">Hủy</button>
          <button :disabled="adjustSaving" @click="saveAdjust" class="px-5 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition disabled:opacity-50">
            {{ adjustSaving ? 'Đang xử lý...' : 'Xác nhận' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { frappeCall } from '../api/index.js'
import { useNotify } from '../composables/useNotify.js'
import BackButton from '../components/BackButton.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import SearchableSelect from '../components/SearchableSelect.vue'

defineOptions({ name: 'PlatformWalletView' })

const { success, error: notifyError } = useNotify()

const loading = ref(false)
const canAdjust = ref(false)

const ADJUST_ROLES = ['System Manager', 'Game Currency Admin', 'Chief Accountant']

onMounted(async () => {
  try {
    const roles = await frappeCall('gege_custom.gege_custom.utils.get_current_user_roles')
    canAdjust.value = roles.some(r => ADJUST_ROLES.includes(r))
  } catch {}
  loadData()
})
const wallets = ref([])
const entries = ref([])
const selectedChannel = ref('')
const fromDate = ref('')
const toDate = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const totalItems = ref(0)

const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / pageSize.value)))

const visiblePages = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = [1]
  if (current > 3) pages.push('...')
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
})

const channelMap = computed(() => {
  const m = {}
  for (const w of wallets.value) m[w.name] = w.channel
  return m
})

function getChannel(bankAccount) {
  return channelMap.value[bankAccount] || ''
}

const walletOpts = computed(() =>
  wallets.value.map(w => ({
    value: w.name,
    label: `${w.channel} — ${formatNum(w.balance)} ${w.currency}`,
  }))
)

function goToPage(page) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  loadData()
}

function changePageSize(size) {
  pageSize.value = size
  currentPage.value = 1
  loadData()
}

let fetchId = 0
let _loadPromise = null
async function loadData() {
  if (_loadPromise) return _loadPromise
  _loadPromise = (async () => {
    const id = ++fetchId
    loading.value = true
    try {
      const params = {
        limit: pageSize.value,
        offset: (currentPage.value - 1) * pageSize.value,
      }
      if (selectedChannel.value) params.channel = selectedChannel.value
      if (fromDate.value) params.from_date = fromDate.value
      if (toDate.value) params.to_date = toDate.value

      const [walletData, result] = await Promise.all([
        currentPage.value === 1 ? frappeCall('gege_custom.gege_custom.utils.get_platform_bank_accounts') : Promise.resolve(wallets.value),
        frappeCall('gege_custom.gege_custom.utils.get_platform_ale_entries', params),
      ])

      if (currentPage.value === 1) wallets.value = walletData

      if (result && typeof result === 'object' && 'entries' in result) {
        entries.value = result.entries
        totalItems.value = result.total
      } else {
        entries.value = Array.isArray(result) ? result : []
        totalItems.value = entries.value.length
      }
    } catch (e) {
      if (fetchId !== id) return
      console.error('Failed to load platform data:', e)
    } finally {
      if (fetchId !== id) return
      loading.value = false
      _loadPromise = null
    }
  })()
  return _loadPromise
}

function clearFilters() {
  fromDate.value = ''
  toDate.value = ''
  selectedChannel.value = ''
  currentPage.value = 1
}

watch(selectedChannel, () => { currentPage.value = 1; loadData() })
watch(fromDate, () => { currentPage.value = 1; loadData() })
watch(toDate, () => { currentPage.value = 1; loadData() })

// Adjust modal
const adjustOpen = ref(false)
const adjustSaving = ref(false)
const adjustError = ref('')
const adjustForm = ref({ wallet: '', amount: '', note: '' })

function openAdjust() {
  adjustError.value = ''
  adjustForm.value = { wallet: '', amount: '', note: '' }
  adjustOpen.value = true
}

async function saveAdjust() {
  adjustError.value = ''
  const f = adjustForm.value
  if (!f.wallet) { adjustError.value = 'Chọn nền tảng'; return }
  if (!f.amount || Number(f.amount) === 0) { adjustError.value = 'Nhập số tiền'; return }

  const pw = wallets.value.find(w => w.name === f.wallet)
  if (!pw) { adjustError.value = 'Không tìm thấy ví'; return }

  adjustSaving.value = true
  try {
    await frappeCall('gege_custom.gege_custom.utils.adjust_wallet_balance', {
      bank_account: pw.name,
      currency: pw.currency,
      amount: Number(f.amount),
      note: f.note || `Điều chỉnh nền tảng ${pw.channel}`,
    })
    success('Đã điều chỉnh số dư nền tảng')
    adjustOpen.value = false
    await loadData()
  } catch (e) {
    adjustError.value = (e.message || 'Lỗi').replace(/<[^>]*>/g, '').trim()
  } finally {
    adjustSaving.value = false
  }
}

function formatTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatNum(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}

</script>
