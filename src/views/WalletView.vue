<template>
  <div class="w-full flex flex-col h-full">
    <PageHeader title="Ví của tôi" subtitle="Quản lý số dư" :connected="connected" @refresh="loadWallet" />

    <div class="flex-1 overflow-y-auto custom-scrollbar px-2 pt-3 pb-2">
      <LoadingSpinner v-if="loading" class="flex items-center justify-center py-20" />
      <template v-else>
        <!-- Balance cards -->
        <div v-if="wallets.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5 px-1">
          <div v-for="w in wallets" :key="w.bank_account"
            class="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-5 cursor-pointer transition"
            :class="activeBankAccount === w.bank_account ? 'ring-2 ring-indigo-500' : ''"
            @click="activeBankAccount = w.bank_account">
            <div class="flex justify-between items-start mb-2">
              <p class="text-sm font-black text-indigo-600 uppercase tracking-widest leading-none">{{ w.label }}</p>
              <span class="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 font-bold uppercase tracking-wider leading-none shrink-0">{{ w.role }} ({{ w.currency }})</span>
            </div>
            <p class="text-2xl font-black text-app-text-primary">{{ formatNum(w.balance) }}</p>
            <div class="flex gap-4 mt-2 text-sm text-app-text-muted">
              <span>Thu: <span class="text-emerald-600 font-bold">{{ formatNum(w.total_in) }}</span></span>
              <span>Chi: <span class="text-red-500 font-bold">{{ formatNum(w.total_out) }}</span></span>
            </div>
          </div>
        </div>
        <EmptyState v-else message="Chưa có ví" />

        <!-- Filters -->
        <div class="flex items-center gap-2 mb-4 px-1 flex-wrap">
          <button v-if="canAdjust" @click="openDepositForm"
            class="px-3 py-1.5 rounded-lg text-sm font-bold text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 transition">⚙ Điều chỉnh</button>
          <input v-model="searchQuery" type="text" placeholder="Tìm mô tả, mã đơn..." class="input-field !py-1.5 !px-3 text-sm w-48" />
          <div class="flex items-center gap-1.5">
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest">Từ</label>
            <input v-model="fromDate" type="date" class="input-field !py-1.5 !px-3 text-sm w-36" />
          </div>
          <div class="flex items-center gap-1.5">
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest">Đến</label>
            <input v-model="toDate" type="date" class="input-field !py-1.5 !px-3 text-sm w-36" />
          </div>
          <button @click="resetAndLoad" class="px-3 py-1.5 rounded-lg text-sm font-bold text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 transition">Lọc</button>
          <button v-if="fromDate || toDate || searchQuery" @click="clearFilters" class="px-3 py-1.5 rounded-lg text-sm font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 transition">Xóa lọc</button>
          <div class="flex-1" />
          <span class="text-app-text-muted text-xs font-bold">{{ totalItems }} giao dịch</span>
        </div>

        <!-- Transaction list -->
        <EmptyState v-if="entries.length === 0" message="Không có giao dịch" />
        <div v-else class="px-1">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div v-for="e in entries" :key="e.name" class="bg-app-surface border border-app-border rounded-2xl p-4 sm:p-5">
              <div class="flex items-start justify-between gap-3 mb-2">
                <div class="flex flex-col gap-1">
                  <span class="text-sm font-black px-3 py-1 rounded-full w-fit"
                    :class="e.transaction_type === 'In' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'">
                    {{ e.transaction_type === 'In' ? 'Thu' : 'Chi' }}
                  </span>
                  <span class="text-sm font-bold text-app-text-primary">{{ e.currency }}</span>
                </div>
                <span class="text-lg font-black text-right" :class="e.transaction_type === 'In' ? 'text-emerald-600' : 'text-red-500'">
                  {{ e.transaction_type === 'In' ? '+' : '-' }}{{ formatNum(e.amount) }}
                </span>
              </div>
              <p class="text-sm text-app-text-muted line-clamp-2 mb-2">{{ e.description || e.reference_name }}</p>
              <div v-if="e.reference_name" class="flex items-center gap-1.5 mb-2">
                <span class="text-[10px] text-app-text-muted font-bold uppercase tracking-wider">
                  {{ e.reference_doctype === 'Sell Order' ? 'SO' : e.reference_doctype === 'Buy Order' ? 'BO' : e.reference_doctype }}
                </span>
                <RouterLink v-if="e.reference_doctype === 'Sell Order' || e.reference_doctype === 'Buy Order'"
                  :to="`/order/${getOrderType(e.reference_name)}/${e.reference_name}`"
                  class="text-xs font-bold text-indigo-600 hover:underline">
                  {{ e.reference_name }}
                </RouterLink>
                <span v-else class="text-xs font-bold text-app-text-secondary">{{ e.reference_name }}</span>
              </div>
              <div class="flex items-center justify-between pt-2 border-t border-app-border/50">
                <span class="text-sm text-app-text-muted">{{ formatTime(e.timestamp) }}</span>
                <span class="text-sm text-app-text-primary font-bold">Số dư: {{ formatNum(e.balance_after) }}</span>
              </div>
            </div>
          </div>
          <div class="mt-4">
            <PaginatedListLayout
              :total-items="totalItems"
              :current-page="currentPage"
              :total-pages="totalPages"
              :page-size="pageSize"
              :self-scroll="true"
              @update:current-page="goToPage"
              @update:page-size="setPageSize"
            />
          </div>
        </div>
      </template>
    </div>

    <!-- Deposit/Adjust modal -->
    <div v-if="depositOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" @click.self="depositOpen = false">
      <div class="bg-app-surface border border-app-border rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div class="px-8 py-6 border-b border-app-border flex justify-between items-center bg-app-bg/50">
          <h3 class="text-app-text-primary font-black text-lg uppercase tracking-tight">Điều chỉnh số dư ví</h3>
          <button @click="depositOpen = false" class="text-app-text-muted hover:text-app-text-primary transition p-2 hover:bg-app-bg rounded-xl text-xl">&#10005;</button>
        </div>
        <div class="flex-1 overflow-y-auto p-8 space-y-5">
          <div v-if="depositError" class="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-500 font-bold">{{ depositError }}</div>

          <div>
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Tiền tệ <span class="text-red-500">*</span></label>
            <SearchableSelect v-model="depositForm.currency" :options="depositCurrencyOpts" placeholder="-- Chọn tiền tệ --" compact />
          </div>

          <div>
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Tài khoản <span class="text-red-500">*</span></label>
            <SearchableSelect v-model="depositForm.bank_account" :options="accountOpts" placeholder="-- Tìm tài khoản --" compact />
          </div>

          <div v-if="selectedAccountBalance !== null">
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Số dư hiện tại</label>
            <input :value="formatNum(selectedAccountBalance)" readonly class="input-field !py-2.5 text-sm font-mono bg-app-bg/50 cursor-default" />
          </div>

          <div>
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Số tiền <span class="text-red-500">*</span></label>
            <input :value="formatDepositAmount" @input="onAmountInput" type="text" inputmode="decimal" class="input-field !py-2.5 text-sm font-mono" placeholder="Dương = tăng, âm = giảm" />
            <p class="text-xs text-app-text-muted mt-1">Nhập số dương để tăng, số âm để giảm số dư</p>
          </div>

          <div>
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Ghi chú</label>
            <input v-model="depositForm.note" type="text" class="input-field !py-2.5 text-sm" placeholder="Lý do điều chỉnh..." />
          </div>
        </div>
        <div class="px-8 py-5 border-t border-app-border flex justify-end gap-3">
          <button @click="depositOpen = false" class="px-5 py-2 rounded-xl text-sm font-bold text-app-text-muted hover:text-app-text-primary hover:bg-app-bg transition">Hủy</button>
          <button :disabled="depositSaving" @click="saveDeposit" class="px-5 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition disabled:opacity-50">
            {{ depositSaving ? 'Đang xử lý...' : 'Xác nhận' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { frappeCall } from '../api/index.js'
import { useNotify } from '../composables/useNotify.js'
import { useRealtimeSubscriptions } from '../composables/useRealtimeSubscriptions.js'
import { syncArray } from '../utils/sync.js'
import { getOrderType } from '../utils/format.js'
import PageHeader from '../components/PageHeader.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import SearchableSelect from '../components/SearchableSelect.vue'
import PaginatedListLayout from '../components/PaginatedListLayout.vue'

defineOptions({ name: 'WalletView' })

const { success, error: notifyError } = useNotify()

const loading = ref(false)
const walletData = ref({ currencies: [], wallets: [], recent_entries: [] })
const activeBankAccount = ref('')
const entries = ref([])
const fromDate = ref('')
const toDate = ref('')
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const totalItems = ref(0)

const wallets = computed(() => walletData.value.wallets || [])
const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / pageSize.value)))

const canAdjust = ref(false)
const ADJUST_ROLES = ['System Manager', 'Game Currency Admin', 'Chief Accountant']
onMounted(async () => {
  try {
    const roles = await frappeCall('gege_custom.gege_custom.utils.get_current_user_roles')
    canAdjust.value = roles.some(r => ADJUST_ROLES.includes(r))
  } catch {}
})

function resetAndLoad() {
  currentPage.value = 1
  entries.value = []
  totalItems.value = 0
  loadEntries()
}

function goToPage(page) {
  currentPage.value = page
  loadEntries()
}

function setPageSize(size) {
  pageSize.value = size
  resetAndLoad()
}

function clearFilters() {
  fromDate.value = ''
  toDate.value = ''
  searchQuery.value = ''
  resetAndLoad()
}

async function loadWallet() {
  loading.value = true
  try {
    walletData.value = await frappeCall('gege_custom.gege_custom.utils.get_employee_wallet')
    if (walletData.value.wallets?.length && !wallets.value.find(w => w.bank_account === activeBankAccount.value)) {
      activeBankAccount.value = wallets.value[0].bank_account
    }
    await loadEntries()
  } catch (e) {
    console.error('Failed to load wallet:', e)
  } finally {
    loading.value = false
  }
}

async function loadEntries() {
  try {
    const offset = (currentPage.value - 1) * pageSize.value
    const params = { limit: pageSize.value, offset }
    if (activeBankAccount.value) params.bank_account = activeBankAccount.value
    if (fromDate.value) params.from_date = fromDate.value
    if (toDate.value) params.to_date = toDate.value
    if (searchQuery.value) params.search = searchQuery.value

    const data = await frappeCall('gege_custom.gege_custom.utils.get_employee_wallet', params) || {}
    syncArray(entries.value, data.recent_entries || [])
    totalItems.value = data.total_count || 0
    if (data.wallets?.length) {
      walletData.value.wallets = data.wallets
    }
  } catch (e) {
    console.error('Failed to load entries:', e)
  }
}

watch(activeBankAccount, () => { if (wallets.value.length) resetAndLoad() })
watch(fromDate, () => { if (wallets.value.length) resetAndLoad() })
watch(toDate, () => { if (wallets.value.length) resetAndLoad() })
watch(searchQuery, () => { if (wallets.value.length) resetAndLoad() })

// Deposit/adjust modal
const depositOpen = ref(false)
const depositSaving = ref(false)
const depositError = ref('')
const depositForm = ref({ bank_account: '', currency: 'VND', amount: '', note: '' })
const adjustableAccounts = ref([])

const formatDepositAmount = computed(() => {
  const raw = depositForm.value.amount
  if (raw === '' || raw === undefined || raw === null) return ''
  const num = String(raw).replace(/\./g, '').replace(',', '.')
  const isNeg = num.startsWith('-')
  const parts = num.replace('-', '').split('.')
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const result = parts.length > 1 ? `${intPart}.${parts[1]}` : intPart
  return isNeg ? `-${result}` : result
})

function onAmountInput(e) {
  const raw = e.target.value.replace(/[^\d.-]/g, '')
  depositForm.value.amount = raw
}

watch(() => depositForm.value.currency, () => {
  depositForm.value.bank_account = ''
})

const depositCurrencies = computed(() => {
  const curs = new Set(adjustableAccounts.value.map(a => a.currency))
  return ['VND', 'USD', 'CNY'].filter(c => curs.has(c))
})

const depositCurrencyOpts = computed(() =>
  depositCurrencies.value.map(c => ({ value: c, label: c }))
)

const accountOpts = computed(() => {
  const cur = depositForm.value.currency
  return adjustableAccounts.value
    .filter(a => a.currency === cur)
    .map(a => ({ value: a.value, label: a.label }))
})

const selectedAccountBalance = computed(() => {
  const ba = depositForm.value.bank_account
  if (!ba) return null
  const found = adjustableAccounts.value.find(a => a.value === ba)
  return found?.balance ?? null
})

async function openDepositForm() {
  depositError.value = ''
  depositForm.value = { bank_account: '', currency: 'VND', amount: '', note: '' }
  depositOpen.value = true
  try {
    adjustableAccounts.value = await frappeCall('gege_custom.gege_custom.utils.get_adjustable_bank_accounts', {})
    if (depositCurrencies.value.length && !depositCurrencies.value.includes('VND')) {
      depositForm.value.currency = depositCurrencies.value[0]
    }
  } catch (e) {
    console.error('Failed to load bank accounts:', e)
  }
}

async function saveDeposit() {
  depositError.value = ''
  const f = depositForm.value
  if (!f.bank_account) { depositError.value = 'Chọn tài khoản'; return }
  const rawAmount = String(f.amount).replace(/\./g, '').replace(',', '.')
  const numAmount = Number(rawAmount)
  if (!numAmount) { depositError.value = 'Nhập số tiền (dương hoặc âm)'; return }

  depositSaving.value = true
  try {
    await frappeCall('gege_custom.gege_custom.utils.adjust_wallet_balance', {
      bank_account: f.bank_account,
      currency: f.currency,
      amount: numAmount,
      note: f.note,
    })
    success('Đã điều chỉnh số dư')
    depositOpen.value = false
    await loadWallet()
  } catch (e) {
    depositError.value = (e.message || 'Lỗi').replace(/<[^>]*>/g, '').trim()
  } finally {
    depositSaving.value = false
  }
}

function formatTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatNum(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}

const { connected } = useRealtimeSubscriptions(
  { 'Account Ledger Entry': () => loadEntries() },
  { onMount: loadWallet }
)
</script>
