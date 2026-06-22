<template>
  <div class="w-full flex flex-col h-full">
    <div class="shrink-0 flex items-center gap-3 mb-4 bg-app-surface border border-app-border rounded-2xl p-3 sm:p-4 shadow-sm mx-2 mt-2">
      <BackButton @click="$router.push('/queue')" />
      <h2 class="text-base sm:text-lg font-black text-app-text-primary uppercase tracking-tight">Sổ cái</h2>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
      <div class="flex flex-col gap-2 mb-4 px-1">
        <div class="flex items-center gap-3">
          <div class="relative w-2/5 min-w-0">
            <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-app-text-muted pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input v-model="searchQuery" type="text" placeholder="Tìm REF, mã đơn hàng..." class="input-field w-full py-1.5 text-xs pl-8 pr-8" />
            <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full bg-app-text-muted/30 hover:bg-app-text-muted/50 transition text-app-text-muted">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="relative w-3/5">
            <SearchableSelect v-model="filters.bank_account" :async-search-fn="asyncBankSearch" :clearable="true" placeholder="Tất cả tài khoản" compact class="w-full" />
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <select v-model="filters.reference_doctype" class="input-field !py-2 text-sm w-40">
            <option value="">Tất cả loại</option>
            <option value="Daily Fund Transfer">Chuyển tiền</option>
            <option value="__platform__">GD Nền tảng</option>
            <option value="Sell Order">Bán hàng</option>
            <option value="Buy Order">Mua hàng</option>
          </select>
          <select v-model="filters.transaction_type" class="input-field !py-2 text-sm w-28">
            <option value="">Thu + Chi</option>
            <option value="In">Thu vào</option>
            <option value="Out">Chi ra</option>
          </select>
          <select v-model="filters.currency" class="input-field !py-2 text-sm w-24">
            <option value="">Tiền tệ</option>
            <option value="VND">VND</option>
            <option value="USD">USD</option>
            <option value="CNY">CNY</option>
                      <option value="USDT">USDT</option>
          </select>
          <span class="text-app-text-muted text-[10px] font-bold">{{ searchQuery ? searchFiltered.length : totalItems }} giao dịch</span>
          <button @click="exportCSV" :disabled="totalItems === 0" class="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 transition disabled:opacity-40">Xuất CSV</button>
          <div class="flex-1" />
          <div class="text-right">
            <p class="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Tổng thu: <span class="text-emerald-600">{{ formatNum(summary.totalIn) }}</span></p>
            <p class="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Tổng chi: <span class="text-red-500">{{ formatNum(summary.totalOut) }}</span></p>
          </div>
        </div>
      </div>

      <LoadingSpinner v-if="loading && entries.length === 0 && !searchQuery" class="flex items-center justify-center py-20" />
      <EmptyState v-else-if="entries.length === 0 && !loading" message="Không có giao dịch" />
      <ResponsiveTable v-else>
        <template #header>
          <th class="px-4 py-3">Mã REF</th>
          <th class="px-4 py-3">Thời gian</th>
          <th class="px-4 py-3">TK</th>
          <th class="px-4 py-3 text-center">Tiền tệ</th>
          <th class="px-4 py-3 text-center">Loại</th>
          <th class="px-4 py-3 text-right">Số tiền</th>
          <th class="px-4 py-3 text-right">Số dư</th>
          <th class="px-4 py-3">Tham chiếu</th>
          <th class="px-4 py-3">Mô tả</th>
        </template>
        <template #body>
          <tr v-for="e in searchFiltered" :key="e.name" class="hover:bg-app-bg/50 transition">
            <td class="px-4 py-3 text-xs font-mono font-bold text-indigo-600 whitespace-nowrap">{{ e.payment_reference_code || '—' }}</td>
            <td class="px-4 py-3 text-xs text-app-text-muted whitespace-nowrap">{{ formatTime(e.timestamp) }}</td>
            <td class="px-4 py-3 text-xs text-app-text-primary font-mono" :title="e.bank_account">{{ bankNameMap[e.bank_account] || e.bank_account }}</td>
            <td class="px-4 py-3 text-center">
              <span class="text-[9px] font-bold px-1.5 py-0.5 rounded" :class="currencyClass(e.currency)">{{ e.currency }}</span>
            </td>
            <td class="px-4 py-3 text-center">
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full"
                :class="e.transaction_type === 'In' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'">
                {{ e.transaction_type === 'In' ? 'Thu' : 'Chi' }}
              </span>
            </td>
            <td class="px-4 py-3 text-right text-sm font-bold" :class="e.transaction_type === 'In' ? 'text-emerald-600' : 'text-red-500'">
              {{ e.transaction_type === 'In' ? '+' : '-' }}{{ formatNum(e.amount) }}
            </td>
            <td class="px-4 py-3 text-right text-sm text-app-text-primary font-bold">{{ formatNum(e.balance_after) }}</td>
            <td class="px-4 py-3 text-xs">
              <span class="text-indigo-600 font-medium">{{ doctypeLabel(e.reference_doctype) }}</span>
              <router-link v-if="refLink(e)" :to="refLink(e)" class="text-app-text-muted ml-1 hover:text-indigo-500 transition-colors">{{ e.reference_name }}</router-link>
              <span v-else class="text-app-text-muted ml-1">{{ e.reference_name }}</span>
            </td>
            <td class="px-4 py-3 text-xs text-app-text-muted line-clamp-1">{{ e.description }}</td>
          </tr>
        </template>
        <template #mobile>
          <div v-for="e in searchFiltered" :key="e.name" class="bg-app-surface border border-app-border rounded-xl p-3 mb-2">
            <p v-if="e.payment_reference_code" class="text-[10px] font-mono font-bold text-indigo-600 mb-1">{{ e.payment_reference_code }}</p>
            <div class="flex items-center justify-between mb-1">
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full"
                :class="e.transaction_type === 'In' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'">
                {{ e.transaction_type === 'In' ? 'Thu' : 'Chi' }}
              </span>
              <span class="text-sm font-bold" :class="e.transaction_type === 'In' ? 'text-emerald-600' : 'text-red-500'">
                {{ e.transaction_type === 'In' ? '+' : '-' }}{{ formatNum(e.amount) }}
              </span>
            </div>
            <p class="text-xs text-app-text-muted line-clamp-1">
	              <template v-if="refLink(e)"><router-link :to="refLink(e)" class="hover:text-indigo-500 transition-colors">{{ e.reference_name }}</router-link></template>
	              <template v-else>{{ e.description || e.reference_name }}</template>
	            </p>
            <p class="text-[10px] text-app-text-muted mt-1">{{ formatTime(e.timestamp) }} · Số dư: {{ formatNum(e.balance_after) }}</p>
          </div>
        </template>
      </ResponsiveTable>
      <LoadingSpinner v-if="loading && entries.length > 0" class="flex items-center justify-center py-6" />
    </div>

    <!-- Pagination bar (outside scroll area) -->
    <div v-if="totalItems > 0" class="flex-shrink-0 border-t border-app-border bg-app-surface px-3 sm:px-4 py-2">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm text-app-text-muted">
        <div class="flex items-center gap-2">
          <span>{{ ((currentPage - 1) * pageSize) + 1 }}-{{ Math.min(currentPage * pageSize, totalItems) }} / {{ totalItems }}</span>
          <select :value="pageSize" @change="changePageSize(Number($event.target.value))"
            class="bg-app-bg border border-app-border rounded-lg px-2 py-1 text-app-text-primary text-xs">
            <option v-for="opt in [10, 20, 30, 50]" :key="opt" :value="opt">{{ opt }} / trang</option>
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
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { getList, frappeCall } from '../api/index.js'
import BackButton from '../components/BackButton.vue'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import SearchableSelect from '../components/SearchableSelect.vue'

defineOptions({ name: 'AccountLedgerView' })

const loading = ref(false)
const entries = ref([])
const bankAccounts = ref([])
const currentPage = ref(1)
const pageSize = ref(20)
const totalItems = ref(0)
const filters = ref({ bank_account: '', transaction_type: '', currency: '', reference_doctype: '' })
const searchQuery = ref('')
const platformWalletIds = ref([])

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

const bankNameMap = computed(() => {
  const m = {}
  for (const b of bankAccounts.value) m[b.name] = b.account_name
  return m
})

const searchFiltered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return entries.value
  return entries.value.filter(e =>
    [e.payment_reference_code, e.bank_account, bankNameMap.value[e.bank_account], e.reference_name, e.reference_doctype, String(e.amount), String(e.balance_after), e.description]
      .some(v => v && String(v).toLowerCase().includes(q))
  )
})

let allBankOptionsCache = null
async function asyncBankSearch(term) {
  const like = term ? `%${term}%` : null

  const cashierAccounts = await getList('Cashier Bank Account', {
    fields: ['bank_account', 'user'],
    filters: [like ? ['user', 'like', like] : undefined, ['is_active', '=', 1]].filter(Boolean),
    limit: 100,
  })
  const bankUserMap = {}
  cashierAccounts.forEach(a => { if (a.bank_account) bankUserMap[a.bank_account] = a.user })

  const bankFilters = like
    ? [['account_name', 'like', like], ['account', 'like', like], ['name', 'like', like]]
    : undefined
  const bankResults = await getList('Bank Account', {
    fields: ['name', 'account_name', 'account'],
    ...(bankFilters ? { or_filters: bankFilters } : {}),
    limit: 100,
  })
  const cashierBankIds = [...new Set(cashierAccounts.map(a => a.bank_account).filter(Boolean))]
  const allIds = [...new Set([...cashierBankIds, ...bankResults.map(b => b.name)])]
  if (!allIds.length) return []
  const fullList = await getList('Bank Account', {
    fields: ['name', 'account_name', 'account', 'is_company_account'],
    filters: [['name', 'in', allIds]],
    limit: 200,
  })
  return fullList.map(b => ({
    value: b.name,
    label: `${b.account_name || b.name}${bankUserMap[b.name] ? ` (${bankUserMap[b.name]})` : ''}`,
  }))
}

const INTERNAL_TYPES = new Set(['Daily Fund Transfer', 'Wallet Adjustment', 'Journal Entry'])

const summary = computed(() => {
  let totalIn = 0, totalOut = 0
  for (const e of searchFiltered.value) {
    if (INTERNAL_TYPES.has(e.reference_doctype)) continue
    if (e.transaction_type === 'In') totalIn += e.amount
    else totalOut += e.amount
  }
  return { totalIn, totalOut }
})

function buildFilters() {
  const f = filters.value
  const conditions = []
  if (f.bank_account) conditions.push(['bank_account', '=', f.bank_account])
  if (f.transaction_type) conditions.push(['transaction_type', '=', f.transaction_type])
  if (f.currency) conditions.push(['currency', '=', f.currency])
  if (f.reference_doctype) {
    if (f.reference_doctype === '__platform__') {
      const pw = platformWalletIds.value
      if (pw.length) conditions.push(['bank_account', 'in', pw])
      else conditions.push(['bank_account', '=', '__none__'])
    } else {
      conditions.push(['reference_doctype', '=', f.reference_doctype])
    }
  }
  return conditions.length ? conditions : undefined
}

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
      const filterConditions = buildFilters()
      const offset = (currentPage.value - 1) * pageSize.value
      const [data, count] = await Promise.all([
        getList('Account Ledger Entry', {
          fields: ['name', 'timestamp', 'bank_account', 'currency', 'transaction_type', 'amount', 'balance_after', 'reference_doctype', 'reference_name', 'description', 'payment_reference_code', 'user', 'cashier_session'],
          filters: filterConditions,
          limit: pageSize.value,
          offset,
          order_by: 'timestamp desc',
        }),
        frappeCall('frappe.client.get_count', {
          doctype: 'Account Ledger Entry',
          filters: filterConditions || [],
        }),
      ])

      entries.value = data
      if (typeof count === 'number') totalItems.value = count

      // Load bank account names for new entries
      const uniqueBanks = [...new Set(data.map(e => e.bank_account).filter(Boolean))]
      const existingBankIds = new Set(bankAccounts.value.map(b => b.name))
      const newBanks = uniqueBanks.filter(id => !existingBankIds.has(id))
      if (newBanks.length) {
        const bankList = await getList('Bank Account', { fields: ['name', 'account_name', 'account', 'is_company_account', 'custom_is_platform_wallet'], filters: [['name', 'in', newBanks]], limit: 200 })
        bankAccounts.value = [...bankAccounts.value, ...bankList]
      }
    } catch (e) {
      if (fetchId !== id) return
      console.error('Failed to load:', e)
    } finally {
      if (fetchId !== id) return
      loading.value = false
      _loadPromise = null
    }
  })()
  return _loadPromise
}

function doctypeLabel(dt) {
  const map = {
    'Daily Fund Transfer': 'Chuyển tiền',
    'Platform Transaction': 'GD Nền tảng',
    'Sell Order': 'Bán hàng',
    'Buy Order': 'Mua hàng',
  }
  return map[dt] || dt || ''
}

function refLink(e) {
  if (e.reference_doctype === 'Buy Order') return `/order/buy/${e.reference_name}`
  if (e.reference_doctype === 'Sell Order') return `/order/sell/${e.reference_name}`
  return ''
}

function currencyClass(cur) {
  const map = { VND: 'bg-blue-500/10 text-blue-600', USD: 'bg-emerald-500/10 text-emerald-600', CNY: 'bg-purple-500/10 text-purple-600' }
  return map[cur] || 'bg-gray-500/10 text-gray-600'
}

function formatTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatNum(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}

function exportCSV() {
  if (!totalItems.value) return
  // Use dynamic import or direct fetch to avoid blocking UI
  getList('Account Ledger Entry', {
    fields: ['name', 'timestamp', 'bank_account', 'currency', 'transaction_type', 'amount', 'balance_after', 'reference_doctype', 'reference_name', 'description', 'payment_reference_code', 'user', 'cashier_session'],
    filters: buildFilters(),
    limit: 0,
    order_by: 'timestamp desc',
  }).then(data => {
    const header = 'Mã REF,Thời gian,Loại GD,TK,Thu/Chi,Số tiền,Tiền tệ,Số dư,Ghi chú,Người VH,Ca'
    const rows = data.map(e => [
      csvEscape(e.payment_reference_code || ''),
      csvEscape(formatTime(e.timestamp)),
      csvEscape(doctypeLabel(e.reference_doctype)),
      csvEscape(bankNameMap.value[e.bank_account] || e.bank_account || ''),
      csvEscape(e.transaction_type === 'In' ? 'Thu' : 'Chi'),
      e.amount || 0,
      csvEscape(e.currency || ''),
      e.balance_after || 0,
      csvEscape((e.description || '').replace(/,/g, ' ')),
      csvEscape(e.user || ''),
      csvEscape(e.cashier_session || ''),
    ].join(','))
    const blob = new Blob(['﻿' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `so-cai-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }).catch(e => {
    console.error('Export failed:', e)
  })
}

function csvEscape(val) {
  if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
    return '"' + val.replace(/"/g, '""') + '"'
  }
  return val
}

// Reset page when filters change
watch(filters, () => { currentPage.value = 1; loadData() }, { deep: true })

onMounted(async () => {
  try {
    platformWalletIds.value = (await getList('Platform Wallet', { fields: ['bank_account'], limit: 100 }))
      .map(w => w.bank_account).filter(Boolean)
  } catch {}
  loadData()
})
</script>
