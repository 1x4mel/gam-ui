<template>
  <div class="w-full flex flex-col h-full">
    <!-- Header -->
    <div class="shrink-0 flex items-center gap-3 mb-4 bg-app-surface border border-app-border rounded-2xl p-3 sm:p-4 shadow-sm mx-2 mt-2">
      <BackButton @click="$router.push('/logs')" />
      <h2 class="text-base sm:text-lg font-black text-app-text-primary uppercase tracking-tight">TK Ngân hàng nhân viên</h2>
      <div class="flex-1" />
      <AppButton variant="primary" size="sm" @click="openForm(null)">+ Thêm tài khoản</AppButton>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
      <!-- Search -->
      <div class="flex items-center gap-3 mb-4 px-1">
        <input v-model="search" type="text" placeholder="Tìm nhân viên..." class="input-field !py-2 text-sm flex-1 max-w-xs" />
        <span class="text-app-text-muted text-xs font-bold">{{ filteredRows.length }} dòng</span>
      </div>

      <LoadingSpinner v-if="loading" class="flex items-center justify-center py-20" />
      <EmptyState v-else-if="filteredRows.length === 0" message="Chưa có tài khoản ngân hàng" />

      <div v-else class="px-1">
        <!-- Desktop: table rows -->
        <div class="hidden sm:block">
          <div class="grid grid-cols-[1fr_2fr_80px] gap-2 px-4 py-3 text-xs font-black text-app-text-muted uppercase tracking-widest border-b border-app-border/50">
            <span>Nhân viên</span><span>Tài khoản</span><span></span>
          </div>
          <div v-for="row in filteredRows" :key="row.user"
            class="grid grid-cols-[1fr_2fr_80px] gap-2 px-4 py-4 items-center border-b border-app-border/30 hover:bg-app-bg/50 transition">
            <!-- Name -->
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-sm font-black text-indigo-600 shrink-0">{{ (userName(row.user) || '?')[0].toUpperCase() }}</div>
              <p class="text-sm font-bold text-app-text-primary truncate">{{ userName(row.user) }}</p>
            </div>
            <!-- All accounts -->
            <div class="space-y-2">
              <div v-for="c in row.currencies" :key="c.currency" class="flex items-center gap-3 text-sm">
                <span class="text-xs font-black px-2.5 py-1 rounded-full shrink-0" :class="currencyBadge(c.currency)">{{ c.currency }}</span>
                <div class="min-w-0 flex-1 grid grid-cols-2 gap-3">
                  <div class="min-w-0 space-y-0.5">
                    <div class="min-w-0">
                      <span class="text-blue-600 font-bold">Chi </span>
                      <template v-if="c.payment">
                        <span v-if="c.payment.label" class="text-indigo-500 font-bold text-xs mr-1">[{{ c.payment.label }}]</span>
                        <span class="font-mono font-bold text-app-text-primary">{{ c.payment.account_no }}</span>
                        <span class="text-app-text-muted ml-1 text-xs">{{ c.payment.bank }}</span>
                      </template>
                      <span v-else class="text-red-400">—</span>
                    </div>
                    <div v-if="c.payment && balances[c.payment.bank_account] != null" class="pl-4">
                      <span class="text-emerald-600 font-black text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-md">{{ formatMoney(balances[c.payment.bank_account], c.currency) }}</span>
                    </div>
                  </div>
                  <div class="min-w-0 space-y-0.5">
                    <div class="min-w-0">
                      <span class="text-emerald-600 font-bold">Thu </span>
                      <template v-if="c.receiving">
                        <span v-if="c.receiving.label" class="text-indigo-500 font-bold text-xs mr-1">[{{ c.receiving.label }}]</span>
                        <span class="font-mono font-bold text-app-text-primary">{{ c.receiving.account_no }}</span>
                        <span class="text-app-text-muted ml-1 text-xs">{{ c.receiving.bank }}</span>
                      </template>
                      <span v-else class="text-red-400">—</span>
                    </div>
                    <div v-if="c.receiving && balances[c.receiving.bank_account] != null" class="pl-4">
                      <span class="text-emerald-600 font-black text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-md">{{ formatMoney(balances[c.receiving.bank_account], c.currency) }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="row.currencies.length === 0" class="text-xs text-app-text-muted">Chưa có tài khoản</div>
            </div>
            <!-- Actions -->
            <div class="flex gap-1 justify-end">
              <button @click="openForm(row.user)" class="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 hover:bg-indigo-500/10 transition">Sửa</button>
              <button @click="handleDelete(row)" class="px-3 py-1.5 rounded-lg text-xs font-bold text-red-500 hover:bg-red-500/10 transition">Xóa</button>
            </div>
          </div>
        </div>
        <!-- Mobile: compact cards per user -->
        <div class="sm:hidden space-y-2">
          <div v-for="row in filteredRows" :key="row.user"
            class="bg-app-surface border border-app-border rounded-xl p-4">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-sm font-black text-indigo-600">{{ (userName(row.user) || '?')[0].toUpperCase() }}</div>
                <span class="text-sm font-bold text-app-text-primary">{{ userName(row.user) }}</span>
              </div>
              <div class="flex gap-1">
                <button @click="openForm(row.user)" class="px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-600 hover:bg-indigo-500/10">Sửa</button>
                <button @click="handleDelete(row)" class="px-2.5 py-1 rounded-lg text-xs font-bold text-red-500 hover:bg-red-500/10">Xóa</button>
              </div>
            </div>
            <div v-for="c in row.currencies" :key="c.currency" class="mb-3 last:mb-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs font-black px-2 py-0.5 rounded-full" :class="currencyBadge(c.currency)">{{ c.currency }}</span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-sm pl-1">
                <div class="space-y-0.5">
                  <div>
                    <span class="text-blue-600 font-bold">Chi </span>
                    <template v-if="c.payment">
                      <span v-if="c.payment.label" class="text-indigo-500 font-bold text-xs mr-1">[{{ c.payment.label }}]</span>
                      <span class="font-mono font-bold text-app-text-primary">{{ c.payment.account_no }}</span>
                    </template>
                    <span v-else class="text-red-400">—</span>
                  </div>
                  <div v-if="c.payment && balances[c.payment.bank_account] != null" class="pl-4">
                    <span class="text-emerald-600 font-black text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-md">{{ formatMoney(balances[c.payment.bank_account], c.currency) }}</span>
                  </div>
                </div>
                <div class="space-y-0.5">
                  <div>
                    <span class="text-emerald-600 font-bold">Thu </span>
                    <template v-if="c.receiving">
                      <span v-if="c.receiving.label" class="text-indigo-500 font-bold text-xs mr-1">[{{ c.receiving.label }}]</span>
                      <span class="font-mono font-bold text-app-text-primary">{{ c.receiving.account_no }}</span>
                    </template>
                    <span v-else class="text-red-400">—</span>
                  </div>
                  <div v-if="c.receiving && balances[c.receiving.bank_account] != null" class="pl-4">
                    <span class="text-emerald-600 font-black text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-md">{{ formatMoney(balances[c.receiving.bank_account], c.currency) }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="row.currencies.length === 0" class="text-xs text-app-text-muted">Chưa có tài khoản</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════ MODAL ═══════════════════ -->
    <div v-if="formOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" @click.self="formOpen = false">
      <div class="bg-app-surface border border-app-border rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <!-- Header -->
        <div class="px-8 py-5 border-b border-app-border flex justify-between items-center bg-app-bg/50">
          <h3 class="text-app-text-primary font-black text-lg uppercase tracking-tight">{{ editingUser ? 'Cập nhật' : 'Thêm tài khoản' }}</h3>
          <button @click="formOpen = false" class="text-app-text-muted hover:text-app-text-primary transition p-2 hover:bg-app-bg rounded-xl text-xl">✕</button>
        </div>

        <!-- User selector -->
        <div class="px-8 pt-5 pb-3 border-b border-app-border/50">
          <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Nhân viên <span class="text-red-500">*</span></label>
          <div v-if="editingUser" class="text-sm font-bold text-app-text-primary py-2">{{ userName(editingUser) }}</div>
          <SearchableSelect v-else v-model="selectedUser" :options="userOptions" placeholder="-- Chọn nhân viên --" />
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-app-border shrink-0">
          <button @click="activeTab = 'accounts'" class="flex-1 px-4 py-3 text-xs font-black uppercase tracking-widest transition"
            :class="activeTab === 'accounts' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-app-text-muted hover:text-app-text-primary'">Tài khoản</button>
          <button @click="activeTab = 'roles'" class="flex-1 px-4 py-3 text-xs font-black uppercase tracking-widest transition"
            :class="activeTab === 'roles' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-app-text-muted hover:text-app-text-primary'">Phân quyền</button>
        </div>

        <!-- Tab content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-4">
          <!-- TAB 1: Accounts -->
          <template v-if="activeTab === 'accounts'">
            <div v-for="(acc, idx) in accounts" :key="idx" class="bg-app-bg/50 border border-app-border/50 rounded-xl p-4 space-y-3">
              <div class="flex items-center justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <input v-model="acc.label" type="text" placeholder="Nhãn (VD: ACB chính, WeChat CNY)" class="input-field !py-1 text-xs w-full" />
                  <p v-if="acc.account_no || acc.bank" class="text-xs text-app-text-muted mt-1 truncate">
                    <span class="font-mono font-bold">{{ acc.account_no || '???' }}</span>
                    <span class="mx-1">–</span>
                    <span>{{ acc.bank || '???' }}</span>
                  </p>
                </div>
                <button @click="removeAccount(idx)" class="text-red-400 hover:text-red-600 transition px-1 shrink-0" title="Xóa">✕</button>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-1 block">Loại tiền</label>
                  <SearchableSelect v-model="acc.currency" :options="currencyOptions" placeholder="-- Chọn --" compact />
                </div>
                <div>
                  <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-1 block">Số tài khoản</label>
                  <input v-model="acc.account_no" type="text" class="input-field !py-1 text-xs font-mono" placeholder="Nhập STK / ID..." />
                </div>
                <div>
                  <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-1 block">Ngân hàng / Nền tảng</label>
                  <SearchableSelect v-model="acc.bank" :options="bankOptions" placeholder="-- Chọn --" compact @change="onBankChange(acc)" />
                </div>
                <div>
                  <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-1 block">Mã BIN</label>
                  <input v-model="acc.bin" type="text" class="input-field !py-1 text-xs font-mono" placeholder="VD: 970416" />
                </div>
                <div class="col-span-2">
                  <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-1 block">Chủ tài khoản</label>
                  <input v-model="acc.holder" type="text" class="input-field !py-1 text-xs" placeholder="Tên chủ TK..." />
                </div>
              </div>
              <div v-if="acc.currency === 'VND'" class="flex justify-end">
                <button type="button" @click="openQrScanner(idx)" class="px-3 py-1 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm">📷 Quét QR</button>
              </div>
            </div>
            <button @click="addAccount" class="w-full py-2.5 rounded-xl text-xs font-bold text-indigo-600 border border-dashed border-indigo-300 hover:bg-indigo-500/5 transition">+ Thêm tài khoản</button>
          </template>

          <!-- TAB 2: Role assignments -->
          <template v-if="activeTab === 'roles'">
            <div v-if="currenciesInAccounts.length === 0" class="text-center py-8 text-app-text-muted text-xs">
              Chưa có tài khoản nào. Thêm tài khoản ở tab "Tài khoản" trước.
            </div>
            <div v-for="cur in currenciesInAccounts" :key="cur" class="bg-app-bg/50 border border-app-border/50 rounded-xl p-4 space-y-3">
              <div class="flex items-center gap-2">
                <span class="text-xs font-black px-2 py-0.5 rounded-full" :class="currencyBadge(cur)">{{ cur }}</span>
                <span class="text-xs text-app-text-muted font-bold">{{ accountsOfCurrency(cur).length }} tài khoản</span>
              </div>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="text-xs font-black text-blue-600 uppercase tracking-widest mb-1 block">TK Chi</label>
                  <SearchableSelect v-model="roleAssignments[cur].payment" :options="accountOptsForCurrency(cur)" placeholder="-- Chọn --" compact />
                </div>
                <div>
                  <label class="text-xs font-black text-emerald-600 uppercase tracking-widest mb-1 block">TK Thu</label>
                  <SearchableSelect v-model="roleAssignments[cur].receiving" :options="accountOptsForCurrency(cur)" placeholder="-- Chọn --" compact />
                </div>
                <div>
                  <label class="text-xs font-black text-amber-600 uppercase tracking-widest mb-1 block">TK Cá nhân</label>
                  <SearchableSelect v-model="roleAssignments[cur].personal" :options="accountOptsForCurrency(cur)" placeholder="-- Chọn --" compact />
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Error -->
        <div v-if="formError" class="px-6 py-2 shrink-0">
          <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-500 font-bold">{{ formError }}</div>
        </div>

        <!-- Footer -->
        <div class="px-8 py-5 border-t border-app-border flex justify-end gap-3 shrink-0">
          <button @click="formOpen = false" class="px-5 py-2 rounded-xl text-sm font-bold text-app-text-muted hover:text-app-text-primary hover:bg-app-bg transition">Hủy</button>
          <AppButton variant="primary" size="sm" :loading="formSaving" @click="saveForm">Lưu</AppButton>
        </div>
      </div>
    </div>

    <!-- QR Scanner -->
    <QrScannerModal :is-open="qrOpen" @close="qrOpen = false" @scanned="onQrScanned" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { getList, frappeCall } from '../api/index.js'
import { useNotify } from '../composables/useNotify.js'
import { formatMoney } from '../utils/format.js'
import AppButton from '../components/AppButton.vue'
import BackButton from '../components/AppButton.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import SearchableSelect from '../components/SearchableSelect.vue'
import QrScannerModal from '../components/QrScannerModal.vue'

defineOptions({ name: 'CashierBankAccountView' })

const { success, error: notifyError, confirm } = useNotify()

// ─── State ───
const employeeData = ref([])
const users = ref([])
const balances = ref({})
const loading = ref(false)
const search = ref('')
const formOpen = ref(false)
const editingUser = ref(null)
const selectedUser = ref('')
const formSaving = ref(false)
const formError = ref('')
const activeTab = ref('accounts')
const accounts = ref([])
const roleAssignments = ref({})
const qrOpen = ref(false)
const scanIdx = ref(0)
const bankList = ref([])

// ─── Constants ───
const currencyOptions = [
  { label: 'VND', value: 'VND' },
  { label: 'USD', value: 'USD' },
  { label: 'CNY', value: 'CNY' },
]

// ─── Computed ───
const bankBinMap = computed(() => {
  const m = {}
  for (const b of bankList.value) m[b.name] = b.custom_bank_bin || ''
  return m
})

const bankOptions = computed(() =>
  bankList.value.map(b => ({ label: b.bank_name || b.name, value: b.name }))
)

function onBankChange(acc) {
  acc.bin = bankBinMap.value[acc.bank] || ''
}

const userOptions = computed(() =>
  users.value.map(u => ({ label: u.email, value: u.email, description: u.full_name && u.full_name !== u.email ? u.full_name : '' }))
)

const userMap = computed(() => {
  const m = {}
  for (const u of users.value) m[u.email] = u.full_name || u.email
  return m
})

function userName(email) { return userMap.value[email] || email }

function currencyBadge(c) {
  if (c === 'VND') return 'bg-blue-500/10 text-blue-600'
  if (c === 'CNY') return 'bg-red-500/10 text-red-600'
  return 'bg-amber-500/10 text-amber-600'
}

// 1 row per user with nested currencies
const listRows = computed(() => {
  return employeeData.value.map(ud => {
    const ra = ud.role_assignments || {}
    const accts = ud.accounts || []
    const seen = new Set()
    const currencies = []
    for (const [cur, roles] of Object.entries(ra)) {
      seen.add(cur)
      currencies.push({
        currency: cur,
        payment: roles.payment ? accts.find(a => a.bank_account === roles.payment) || null : null,
        receiving: roles.receiving ? accts.find(a => a.bank_account === roles.receiving) || null : null,
      })
    }
    for (const a of accts) {
      if (!seen.has(a.currency)) {
        currencies.push({ currency: a.currency, payment: null, receiving: null })
        seen.add(a.currency)
      }
    }
    return { user: ud.user, currencies }
  })
})

const filteredRows = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return listRows.value
  return listRows.value.filter(r => {
    const n = userName(r.user).toLowerCase()
    return n.includes(q) || (r.user || '').toLowerCase().includes(q)
  })
})

// Tab 2 helpers
const currenciesInAccounts = computed(() =>
  [...new Set(accounts.value.map(a => a.currency).filter(Boolean))]
)

function accountsOfCurrency(cur) { return accounts.value.filter(a => a.currency === cur) }

function accountOptsForCurrency(cur) {
  const accs = accountsOfCurrency(cur).map(a => {
    const idx = accounts.value.indexOf(a)
    const val = a.bank_account || `idx:${idx}`
    return {
      label: a.label
        ? `${a.label} – ${a.account_no || '???'} (${a.bank || '???'})`
        : `${a.account_no || '???'} – ${a.bank || '???'}`,
      value: val,
    }
  })
  return [{ label: '— Bỏ chọn —', value: '' }, ...accs]
}

// ─── Account management ───
function mkAccount() {
  return { bank_account: '', account_no: '', bank: '', bin: '', holder: '', currency: 'VND', label: '' }
}

function addAccount() { accounts.value.push(mkAccount()) }

function removeAccount(idx) {
  const removed = accounts.value.splice(idx, 1)[0]
  const key = removed.bank_account || `idx:${idx}`
  for (const ra of Object.values(roleAssignments.value)) {
    if (ra.payment === key) ra.payment = ''
    if (ra.receiving === key) ra.receiving = ''
    if (ra.personal === key) ra.personal = ''
  }
}

// Sync roleAssignments when currencies in accounts change
watch(currenciesInAccounts, curs => {
  const next = {}
  for (const c of curs) {
    next[c] = roleAssignments.value[c] || { payment: '', receiving: '', personal: '' }
  }
  roleAssignments.value = next
}, { deep: true })

// ─── QR ───
function openQrScanner(idx) { scanIdx.value = idx; qrOpen.value = true }

function onQrScanned(data) {
  const a = accounts.value[scanIdx.value]
  if (!a) return
  if (data.accountNumber) a.account_no = data.accountNumber
  if (data.accountName) a.holder = data.accountName
  if (data.bankBin) a.bin = data.bankBin
  if (data.bankName) a.bank = data.bankName
  if (!data.bankName && data.provider) a.bank = data.provider
}

// ─── Form ───
function openForm(user) {
  formError.value = ''
  activeTab.value = 'accounts'
  editingUser.value = user || null
  selectedUser.value = ''

  if (user) {
    const ud = employeeData.value.find(d => d.user === user)
    if (ud) {
      accounts.value = (ud.accounts || []).map(a => ({ ...a }))
      const ra = {}
      for (const [cur, roles] of Object.entries(ud.role_assignments || {})) {
        ra[cur] = { payment: roles.payment || '', receiving: roles.receiving || '', personal: roles.personal || '' }
      }
      roleAssignments.value = ra
    } else {
      accounts.value = [mkAccount()]
      roleAssignments.value = {}
    }
  } else {
    accounts.value = [mkAccount()]
    roleAssignments.value = {}
  }
  formOpen.value = true
}

async function saveForm() {
  formError.value = ''
  const user = editingUser.value || selectedUser.value
  if (!user) { formError.value = 'Chọn nhân viên'; return }

  formSaving.value = true
  try {
    const raList = currenciesInAccounts.value.map(cur => {
      const ra = roleAssignments.value[cur] || {}
      return {
        currency: cur,
        payment_bank_account: ra.payment || '',
        receiving_bank_account: ra.receiving || '',
        personal_bank_account: ra.personal || '',
      }
    })

    await frappeCall(
      'gege_custom.gege_custom.doctype.cashier_bank_account.cashier_bank_account.save_employee_bank_account_data',
      {
        user,
        accounts: JSON.stringify(accounts.value),
        role_assignments: JSON.stringify(raList),
      }
    )
    success('Đã lưu')
    await loadData()
    formOpen.value = false
  } catch (e) {
    formError.value = (e.message || 'Lỗi').replace(/<[^>]*>/g, '').trim()
  } finally {
    formSaving.value = false
  }
}

async function handleDelete(row) {
  const ok = await confirm(`Xóa toàn bộ tài khoản ngân hàng của ${userName(row.user)}?`)
  if (!ok) return
  try {
    await frappeCall(
      'gege_custom.gege_custom.doctype.cashier_bank_account.cashier_bank_account.delete_user_bank_accounts',
      { user: row.user }
    )
    success('Đã xóa')
    await loadData()
  } catch (e) {
    notifyError('Xóa thất bại: ' + (e.message || '').replace(/<[^>]*>/g, '').trim())
  }
}

// ─── Data loading ───
async function loadData() {
  loading.value = true
  try {
    const [data, userList, banks, balData] = await Promise.all([
      frappeCall('gege_custom.gege_custom.doctype.cashier_bank_account.cashier_bank_account.get_employee_bank_account_data'),
      getList('User', { fields: ['name', 'email', 'full_name'], limit: 500 }),
      frappeCall('gege_custom.gege_custom.doctype.cashier_bank_account.cashier_bank_account.get_banks'),
      frappeCall('gege_custom.gege_custom.doctype.cashier_bank_account.cashier_bank_account.get_bank_account_balances'),
    ])
    employeeData.value = data || []
    users.value = (userList || []).filter(u => u.email !== 'Administrator' && u.email !== 'Guest')
    bankList.value = banks || []
    balances.value = balData || {}
  } catch (e) {
    console.error('Failed to load:', e)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>
