<template>
  <div class="w-full flex flex-col h-full">
    <div class="shrink-0 flex items-center gap-3 mb-4 bg-app-surface border border-app-border rounded-2xl p-3 sm:p-4 shadow-sm mx-2 mt-2">
      <BackButton @click="$router.push('/queue')" />
      <h2 class="text-base sm:text-lg font-black text-app-text-primary uppercase tracking-tight">Chuyển tiền</h2>
      <div class="flex-1" />
      <AppButton variant="primary" size="sm" @click="openCreate">+ Tạo lệnh</AppButton>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
      <!-- Tabs -->
      <div class="flex items-center gap-2 mb-4 px-1">
        <button v-for="t in tabs" :key="t.key" @click="activeTab = t.key"
          class="px-4 py-2 rounded-xl text-xs font-bold transition"
          :class="activeTab === t.key ? 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20' : 'text-app-text-muted hover:text-app-text-primary'">
          {{ t.label }}
          <span v-if="t.count > 0" class="ml-1 px-1.5 py-0.5 rounded-full text-xs"
            :class="activeTab === t.key ? 'bg-indigo-500/20' : 'bg-app-bg'">{{ t.count }}</span>
        </button>
      </div>

      <!-- Search -->
      <div class="px-1 mb-3">
        <input v-model="searchQuery" type="text" class="input-field !py-2.5 text-sm" placeholder="Tìm mã GD, mã tham chiếu, tên nhân viên..." />
      </div>

      <LoadingSpinner v-if="loading" class="flex items-center justify-center py-20" />
      <EmptyState v-else-if="filteredRows.length === 0" message="Không có giao dịch" />
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3 px-1">
        <div v-for="row in filteredRows" :key="row.name"
          class="bg-app-surface border border-app-border rounded-2xl p-4 sm:p-5 transition">

          <!-- Row 1: ref + status + type + date -->
          <div class="flex items-center gap-2 flex-wrap mb-3">
            <span class="text-sm font-bold text-app-text-primary font-mono">{{ row.payment_reference_code || row.name }}</span>
            <span class="text-[10px] font-bold text-app-text-muted font-mono">{{ row.name }}</span>
            <span class="text-xs font-bold px-2.5 py-1 rounded-full" :class="statusBadge(row).class">{{ statusBadge(row).label }}</span>
            <span v-if="row.transfer_type" class="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600">{{ row.transfer_type }}</span>
            <div class="flex-1" />
            <span class="text-sm text-app-text-muted">{{ formatDateTime(row.creation || row.transfer_date) }}</span>
          </div>

          <!-- Row 2: amount (big) -->
          <p class="text-2xl font-black mb-3" :class="Number(row.docstatus) === 1 ? 'text-emerald-600' : 'text-app-text-primary'">
            {{ formatNum(row.amount) }} <span class="text-sm font-bold">{{ row.currency }}</span>
          </p>

          <!-- Row 3: sender -> receiver -->
          <div class="flex items-center gap-3 min-w-0 bg-app-bg/50 rounded-xl px-4 py-3">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-bold text-app-text-primary truncate">{{ row.from_name || row.from_user }}</p>
              <p v-if="row.from_bank_no" class="text-xs text-app-text-muted font-mono truncate">{{ row.from_bank_no }}</p>
            </div>
            <span class="text-lg text-indigo-400 shrink-0">→</span>
            <div class="min-w-0 flex-1 text-right">
              <p class="text-sm font-bold text-app-text-primary truncate">{{ row.to_name || row.to_user }}</p>
              <p v-if="row.to_bank_no" class="text-xs text-app-text-muted font-mono truncate">{{ row.to_bank_no }}</p>
            </div>
          </div>

          <!-- Bank memo -->
          <div v-if="row.bank_memo" class="mt-3 flex items-center gap-2">
            <span class="text-xs font-black text-app-text-muted uppercase tracking-widest shrink-0">Nội dung CK:</span>
            <span class="text-sm font-mono font-bold text-indigo-600 bg-indigo-500/10 px-3 py-1.5 rounded-lg flex-1 truncate">{{ row.bank_memo }}</span>
            <button @click="copyMemo(row.bank_memo, row.name)"
              class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition"
              :class="copiedMemo === row.name ? 'bg-emerald-500/10 text-emerald-600' : 'bg-app-bg text-app-text-muted hover:text-app-text-primary'">
              {{ copiedMemo === row.name ? 'Đã copy' : 'Copy' }}
            </button>
            <button v-if="isAdmin" @click="openEditMemo(row)"
              class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 transition">
              Sửa
            </button>
          </div>

          <p v-if="row.note" class="text-sm text-app-text-muted mt-2 truncate">{{ row.note }}</p>

          <!-- Action buttons for Draft -->
          <div v-if="Number(row.docstatus) === 0" class="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-app-border/50">
            <template v-if="isSender(row) && !row.sender_confirmed">
              <button v-if="row.currency === 'VND'" @click="openQR(row)" class="flex-1 min-w-[100px] px-4 py-3 rounded-xl text-sm font-bold text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 transition">Quét QR</button>
              <button @click="confirmSent(row.name)" class="flex-1 min-w-[140px] px-4 py-3 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition">Đã chuyển xong</button>
            </template>
            <button v-if="isAdmin && !isSender(row) && !row.sender_confirmed && row.currency === 'VND'" @click="openQR(row)" class="flex-1 min-w-[100px] px-4 py-3 rounded-xl text-sm font-bold text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 transition">Quét QR</button>
            <button v-if="isReceiver(row) || (isAdmin && !isSender(row))" :disabled="!row.sender_confirmed" @click="confirmReceived(row.name)"
              class="flex-1 min-w-[160px] px-4 py-3 rounded-xl text-sm font-bold transition"
              :class="row.sender_confirmed ? 'text-white bg-emerald-600 hover:bg-emerald-700' : 'text-amber-500 bg-amber-500/10 cursor-not-allowed'">
              {{ row.sender_confirmed ? 'Xác nhận đã nhận tiền' : 'Chờ người gửi chuyển tiền' }}
            </button>
            <button v-if="(isReceiver(row) || isAdmin) && row.sender_confirmed" @click="reportNotReceived(row.name)"
              class="px-4 py-3 rounded-xl text-sm font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 transition">Chưa nhận được tiền</button>
            <button v-if="(isSender(row) || isReceiver(row) || isAdmin) && !row.sender_confirmed" @click="cancelTransfer(row.name)"
              class="px-4 py-3 rounded-xl text-sm font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 transition">Hủy</button>
          </div>

          <!-- Completed -->
          <div v-if="Number(row.docstatus) === 1" class="flex items-center gap-2 mt-3 pt-3 border-t border-app-border/50">
            <button v-if="row.currency === 'VND'" @click="openQR(row)" class="px-3 py-1.5 rounded-lg text-sm font-bold text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 transition">Xem QR</button>
            <span v-if="row.linked_journal_entry" class="text-sm text-app-text-muted">JE: {{ row.linked_journal_entry }}</span>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalCount > 0" class="flex flex-wrap items-center justify-between gap-3 px-1 py-4 text-xs text-app-text-muted">
        <span class="font-bold">{{ (currentPage - 1) * pageSize + 1 }}-{{ Math.min(currentPage * pageSize, totalCount) }} / {{ totalCount }}</span>
        <div class="flex items-center gap-1">
          <select v-model.number="pageSize" @change="onPageSizeChange" class="px-2 py-1 rounded-lg text-xs bg-app-surface border border-app-border text-app-text-primary outline-none cursor-pointer">
            <option v-for="s in [10, 20, 30, 50]" :key="s" :value="s">{{ s }} / trang</option>
          </select>
          <button v-for="p in visiblePages" :key="p" @click="goToPage(p)"
            class="min-w-[28px] h-7 rounded-lg text-xs font-bold transition"
            :class="p === currentPage ? 'bg-indigo-600 text-white' : 'bg-app-surface border border-app-border text-app-text-secondary hover:bg-indigo-500/10'">
            {{ p }}
          </button>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" @click.self="showCreateModal = false">
      <div class="bg-app-surface border border-app-border rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div class="px-8 py-6 border-b border-app-border flex justify-between items-center bg-app-bg/50">
          <h3 class="text-app-text-primary font-black text-lg uppercase tracking-tight">Tạo lệnh chuyển tiền</h3>
          <button @click="showCreateModal = false" class="text-app-text-muted hover:text-app-text-primary transition p-2 hover:bg-app-bg rounded-xl text-xl">&#10005;</button>
        </div>
        <div class="flex-1 overflow-y-auto p-8 space-y-6">
          <div v-if="createError" class="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-500 font-bold">{{ createError }}</div>

          <!-- Admin: searchable sender -->
          <div v-if="isAdmin" class="relative">
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-2 block">Người gửi <span class="text-red-500">*</span></label>
            <input :value="users.find(u => u.email === form.from_user)?.full_name || form.from_search || ''"
              @input="form.from_search = $event.target.value; form.from_user = ''"
              @focus="form.from_focus = true" @blur="blurFrom"
              type="text" class="input-field !py-3 text-sm" placeholder="Tìm nhân viên..." />
            <div v-if="form.from_focus && !form.from_user"
              class="absolute z-50 w-full mt-1 bg-app-surface border border-app-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
              <button v-for="u in filteredFromUsers" :key="u.email"
                @mousedown="selectFromUser(u)"
                class="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-500/10 transition flex items-center gap-2">
                <span class="font-bold text-app-text-primary">{{ u.full_name }}</span>
                <span class="text-app-text-muted text-xs">{{ u.email }}</span>
              </button>
            </div>
          </div>
          <!-- Non-admin: fixed sender = current user -->
          <div v-else>
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-2 block">Người gửi</label>
            <input :value="currentUserName" type="text" class="input-field !py-3 text-sm bg-app-bg" disabled />
          </div>

          <div v-if="form.from_user">
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-2 block">TK gửi</label>
            <SearchableSelect v-model="form.from_bank" :options="fromBankOpts" placeholder="Chọn TK gửi" compact />
          </div>

          <div class="relative">
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-2 block">Người nhận <span class="text-red-500">*</span></label>
            <input :value="users.find(u => u.email === form.to_user)?.full_name || form.to_search || ''"
              @input="form.to_search = $event.target.value; form.to_user = ''"
              @focus="form.to_focus = true" @blur="blurTo"
              type="text" class="input-field !py-3 text-sm" placeholder="Tìm nhân viên..." />
            <div v-if="form.to_focus && !form.to_user"
              class="absolute z-50 w-full mt-1 bg-app-surface border border-app-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
              <button v-for="u in filteredToUsers" :key="u.email"
                @mousedown="selectToUser(u)"
                class="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-500/10 transition flex items-center gap-2">
                <span class="font-bold text-app-text-primary">{{ u.full_name }}</span>
                <span class="text-app-text-muted text-xs">{{ u.email }}</span>
              </button>
            </div>
          </div>

          <div v-if="form.to_user">
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-2 block">TK nhận</label>
            <SearchableSelect v-model="form.to_bank" :options="toBankOpts" placeholder="Chọn TK nhận" compact />
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-2 block">Loại</label>
              <select v-model="form.transfer_type" class="input-field !py-3 text-sm">
                <option value="P2P Transfer">Chuyển tiền</option>
                <option value="Sell Deposit">Nộp tiền bán</option>
                <option value="Fund Reconciliation">Điều chỉnh</option>
                <option v-if="canCapitalTransfer" value="Capital Transfer">Luân chuyển vốn</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-2 block">Currency</label>
              <select v-model="form.currency" class="input-field !py-3 text-sm">
                <option value="VND">VND</option>
                <option value="USD">USD</option>
                <option value="CNY">CNY</option>
                      <option value="USDT">USDT</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-2 block">Số tiền</label>
              <input :value="fmtInput(form.amount)" @input="form.amount = parseAmount($event.target.value)" type="text" inputmode="numeric" class="input-field !py-3 text-sm" placeholder="0" />
            </div>
          </div>

          <div>
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-2 block">Ghi chú</label>
            <input v-model="form.note" type="text" class="input-field !py-3 text-sm" placeholder="Lý do chuyển..." />
          </div>
        </div>
        <div class="px-8 py-5 border-t border-app-border flex justify-end gap-3">
          <button @click="showCreateModal = false" class="px-5 py-2 rounded-xl text-sm font-bold text-app-text-muted hover:text-app-text-primary hover:bg-app-bg transition">Hủy</button>
          <AppButton variant="primary" size="sm" :loading="creating" @click="createTransfer">Tạo lệnh</AppButton>
        </div>
      </div>
    </div>

    <!-- QR Modal -->
    <div v-if="showQRModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" @click.self="showQRModal = false">
      <div class="bg-app-surface border border-app-border rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
        <div class="px-8 py-6 border-b border-app-border bg-app-bg/50">
          <h3 class="text-app-text-primary font-black text-lg uppercase tracking-tight text-center">Quét để chuyển tiền</h3>
        </div>
        <div class="p-8 space-y-5">
          <div v-if="qrData" class="flex flex-col items-center">
            <img :src="qrData.qr_url" alt="QR" class="w-56 h-56" />
            <p class="mt-3 text-sm font-bold text-app-text-primary">{{ qrData.to_name }}</p>
            <p class="text-xs text-app-text-muted font-mono">{{ qrData.account_number }}</p>
            <p class="text-lg font-black text-emerald-600 mt-1">{{ formatNum(qrData.amount) }} {{ qrData.currency }}</p>
            <p class="text-xs text-app-text-muted mt-1">Mã tham chiếu: {{ qrData.reference_code }}</p>
            <p class="text-xs text-indigo-600 font-mono font-bold mt-1 bg-indigo-500/10 px-3 py-1 rounded-lg">{{ qrData.memo }}</p>
          </div>
          <LoadingSpinner v-else class="flex items-center justify-center py-10" />
          <button @click="showQRModal = false" class="w-full px-5 py-2.5 rounded-xl text-sm font-bold text-app-text-muted hover:text-app-text-primary hover:bg-app-bg transition text-center">Đóng</button>
        </div>
      </div>
    </div>

    <!-- Edit Memo Modal -->
    <div v-if="editMemoRow" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" @click.self="editMemoRow = null">
      <div class="bg-app-surface border border-app-border rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        <div class="px-8 py-6 border-b border-app-border bg-app-bg/50">
          <h3 class="text-app-text-primary font-black text-base uppercase tracking-tight">Sửa nội dung CK</h3>
          <p class="text-xs text-app-text-muted mt-1">Mã tham chiếu: {{ editMemoRow.payment_reference_code }}</p>
        </div>
        <div class="p-8 space-y-5">
          <div v-if="editMemoError" class="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-500 font-bold">{{ editMemoError }}</div>
          <div>
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Nội dung CK mới</label>
            <input v-model="editMemoValue" type="text" class="input-field !py-2.5 text-sm font-mono" />
          </div>
          <div>
            <label class="text-xs font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Lý do sửa <span class="text-red-500">*</span></label>
            <input v-model="editMemoReason" type="text" class="input-field !py-2.5 text-sm" placeholder="VD: Sai nội dung khi chuyển..." />
          </div>
        </div>
        <div class="px-8 py-5 border-t border-app-border flex justify-end gap-3">
          <button @click="editMemoRow = null" class="px-5 py-2 rounded-xl text-sm font-bold text-app-text-muted hover:text-app-text-primary hover:bg-app-bg transition">Hủy</button>
          <button :disabled="editMemoSaving" @click="saveEditMemo" class="px-5 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition disabled:opacity-50">
            {{ editMemoSaving ? 'Đang lưu...' : 'Lưu' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import { frappeCall } from '../api/index.js'
import { useNotify } from '../composables/useNotify.js'
import { useAuth } from '../composables/useAuth.js'
import { normalizeName } from '../utils/format.js'
import AppButton from '../components/AppButton.vue'
import BackButton from '../components/BackButton.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import SearchableSelect from '../components/SearchableSelect.vue'

defineOptions({ name: 'FundTransferView' })

const { success, error: notifyError, confirm } = useNotify()
const { isAdmin, isChiefAccountant, user: currentUser } = useAuth()

const loading = ref(false)
const creating = ref(false)
const transfers = ref([])
const searchQuery = ref('')
const allUsers = ref([])
const users = ref([])
const activeTab = ref('all')
const showCreateModal = ref(false)
const showQRModal = ref(false)
const createError = ref('')
const qrData = ref(null)
const copiedMemo = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const totalCount = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize.value)))
let searchTimer = null

const tabCounts = ref({ pending: 0, sent: 0, completed: 0, failed: 0 })

const form = ref({
  from_user: '', from_search: '', from_focus: false,
  to_user: '', to_search: '', to_focus: false,
  currency: 'VND', amount: '', transfer_type: 'P2P Transfer', note: '',
  from_bank: '', to_bank: '',
})

const fromBankOpts = ref([])
const toBankOpts = ref([])
const bankRoleMap = ref({})

// Capital Transfer: both sender and receiver must be Chief Accountant
const canCapitalTransfer = computed(() => {
  if (!isChiefAccountant.value && !isAdmin.value) return false
  const from = form.value.from_user
  const to = form.value.to_user
  if (!from && !to) return true
  const isChief = email => allUsers.value.find(u => u.email === email)?.roles?.includes('Chief Accountant')
  if (from && to) return isChief(from) && isChief(to)
  return isChief(from || to)
})

watch(canCapitalTransfer, val => {
  if (!val && form.value.transfer_type === 'Capital Transfer') {
    form.value.transfer_type = 'P2P Transfer'
  }
})

async function loadUserBankAccounts(userEmail) {
  if (!userEmail) return { accounts: [], roleMap: {} }
  try {
    const data = await frappeCall('gege_custom.gege_custom.doctype.cashier_bank_account.cashier_bank_account.get_employee_bank_account_data', { user: userEmail })
    const roleMap = {}
    const roleLabels = { payment: 'TK Chi', receiving: 'TK Thu', personal: 'TK Cá nhân' }
    for (const roleAssignments of Object.values(data?.role_assignments || {})) {
      for (const [role, bankAccount] of Object.entries(roleAssignments)) {
        if (bankAccount && roleLabels[role]) {
          if (!roleMap[bankAccount]) roleMap[bankAccount] = []
          if (!roleMap[bankAccount].includes(roleLabels[role])) roleMap[bankAccount].push(roleLabels[role])
        }
      }
    }
    bankRoleMap.value = { ...bankRoleMap.value, [userEmail]: roleMap }
    return { accounts: Object.values(data?.accounts || {}), roleMap }
  } catch { return { accounts: [], roleMap: {} } }
}

function formatBankLabel(account, roleMap, direction) {
  const roles = roleMap[account.bank_account] || []
  let prefix = ''
  if (direction === 'from') {
    prefix = roles.includes('TK Chi') ? 'TK Chi - ' : roles[0] ? `${roles[0]} - ` : ''
  } else if (direction === 'to') {
    prefix = roles.includes('TK Thu') ? 'TK Thu - ' : roles[0] ? `${roles[0]} - ` : ''
  }
  const bankName = account.bank || account.holder || ''
  return `${prefix}${bankName} (${account.account_no})`
}

async function loadFromBanks() {
  const { accounts, roleMap } = await loadUserBankAccounts(form.value.from_user)
  const cur = form.value.currency
  const filtered = accounts.filter(a => a.currency === cur)
  fromBankOpts.value = filtered.map(a => ({ value: a.bank_account, label: formatBankLabel(a, roleMap, 'from') }))
  if (filtered.length === 1) form.value.from_bank = filtered[0].bank_account
  else form.value.from_bank = ''
}

async function loadToBanks() {
  const { accounts, roleMap } = await loadUserBankAccounts(form.value.to_user)
  const cur = form.value.currency
  const filtered = accounts.filter(a => a.currency === cur)
  toBankOpts.value = filtered.map(a => ({ value: a.bank_account, label: formatBankLabel(a, roleMap, 'to') }))
  if (filtered.length === 1) form.value.to_bank = filtered[0].bank_account
  else form.value.to_bank = ''
}

function selectFromUser(u) {
  form.value.from_user = u.email
  form.value.from_search = u.full_name || u.email
  form.value.from_focus = false
  loadFromBanks()
}

function selectToUser(u) {
  form.value.to_user = u.email
  form.value.to_search = u.full_name || u.email
  form.value.to_focus = false
  loadToBanks()
}

watch(() => form.value.currency, () => {
  if (form.value.from_user) loadFromBanks()
  if (form.value.to_user) loadToBanks()
})

const tabs = computed(() => [
  { key: 'all', label: 'Tất cả', count: totalCount.value },
  { key: 'pending', label: 'Chờ chuyển', count: tabCounts.value.pending },
  { key: 'sent', label: 'Đã chuyển', count: tabCounts.value.sent },
  { key: 'completed', label: 'Hoàn thành', count: tabCounts.value.completed },
  { key: 'failed', label: 'Thất bại', count: tabCounts.value.failed },
])

const filteredRows = computed(() => transfers.value)

function statusBadge(row) {
  const ds = Number(row.docstatus)
  if (ds === 1) return { label: 'Hoàn thành', class: 'bg-emerald-500/10 text-emerald-600' }
  if (ds === 2) return { label: 'Thất bại', class: 'bg-red-500/10 text-red-500' }
  if (row.sender_confirmed) return { label: 'Đã chuyển', class: 'bg-blue-500/10 text-blue-600' }
  return { label: 'Chờ chuyển', class: 'bg-amber-500/10 text-amber-600' }
}

function isSender(row) {
  return row.from_user === currentUser.value
}

function isReceiver(row) {
  return row.to_user === currentUser.value
}

function matchUsers(list, query) {
  const q = normalizeName(query || '').trim()
  if (!q) return list
  const scored = list.map(u => {
    const name = normalizeName(u.full_name || '')
    const email = normalizeName(u.email)
    let score = 0
    if (email === q) score = 1000
    else if (name === q) score = 900
    else if (email.startsWith(q)) score = 800 + (q.length / email.length) * 100
    else if (name.startsWith(q)) score = 700 + (q.length / name.length) * 100
    else if (email.includes(q)) score = 500 + (q.length / email.length) * 100
    else if (name.includes(q)) score = 400 + (q.length / name.length) * 100
    else return null
    return { ...u, _score: score }
  }).filter(Boolean)
  scored.sort((a, b) => b._score - a._score)
  return scored
}

const filteredFromUsers = computed(() => matchUsers(users.value.filter(u => {
  if (u.email === form.value.to_user) return false
  if (u.currencies?.length && !u.currencies.includes(form.value.currency)) return false
  return true
}), form.value.from_search))
const filteredToUsers = computed(() => matchUsers(users.value.filter(u => {
  if (u.email === form.value.from_user) return false
  if (u.currencies?.length && !u.currencies.includes(form.value.currency)) return false
  return true
}), form.value.to_search))

let fetchId = 0
async function loadData() {
  const id = ++fetchId
  loading.value = true
  try {
    const offset = (currentPage.value - 1) * pageSize.value
    const data = await frappeCall('gege_custom.gege_custom.doctype.daily_fund_transfer.daily_fund_transfer.get_transfers', {
      status: activeTab.value === 'all' ? undefined : activeTab.value,
      search: searchQuery.value.trim() || undefined,
      limit: pageSize.value,
      offset,
    })
    transfers.value = data.data || []
    totalCount.value = data.total_count || 0
  } catch (e) {
    if (fetchId !== id) return
    console.error('Failed to load:', e)
  } finally {
    if (fetchId !== id) return
    loading.value = false
  }
}

async function loadCounts() {
  try {
    tabCounts.value = await frappeCall('gege_custom.gege_custom.doctype.daily_fund_transfer.daily_fund_transfer.get_transfer_counts') || {}
  } catch {}
}

async function loadUsers() {
  try {
    const usersWithRoles = await frappeCall('gege_custom.gege_custom.utils.get_users_with_roles')
    const withName = u => ({ email: u.email, full_name: u.full_name || u.email, currencies: u.currencies || [], roles: u.roles || [] })
    allUsers.value = (Array.isArray(usersWithRoles) ? usersWithRoles : [])
      .filter(u => u.roles.some(r => ['Payment Accountant', 'Management Accountant', 'Chief Accountant', 'Trader1', 'Trader2'].includes(r)))
      .map(withName)
    users.value = allUsers.value
  } catch {}
}

// Tab switching: reset page and reload
watch(activeTab, () => {
  if (currentPage.value === 1) { loadData(); loadCounts() }
  currentPage.value = 1
})

// Search debounce
watch(searchQuery, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (currentPage.value === 1) loadData()
    currentPage.value = 1
  }, 300)
})

// Page change
watch(currentPage, () => loadData())

function goToPage(p) {
  currentPage.value = p
}

function onPageSizeChange() {
  if (currentPage.value === 1) loadData()
  currentPage.value = 1
}

const visiblePages = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  return [...new Set([1, 2, current - 1, current, current + 1, total - 1, total])].filter(p => p >= 1 && p <= total).sort((a, b) => a - b)
})

onBeforeUnmount(() => clearTimeout(searchTimer))

function openCreate() {
  createError.value = ''
  if (isAdmin.value) {
    form.value = {
      from_user: '', from_search: '', from_focus: false,
      to_user: '', to_search: '', to_focus: false,
      currency: 'VND', amount: '', transfer_type: 'P2P Transfer', note: '',
      from_bank: '', to_bank: '',
    }
    fromBankOpts.value = []
    toBankOpts.value = []
  } else {
    form.value = {
      from_user: currentUser.value, from_search: '', from_focus: false,
      to_user: '', to_search: '', to_focus: false,
      currency: 'VND', amount: '', transfer_type: 'P2P Transfer', note: '',
      from_bank: '', to_bank: '',
    }
    fromBankOpts.value = []
    toBankOpts.value = []
    loadFromBanks()
  }
  showCreateModal.value = true
}

async function createTransfer() {
  createError.value = ''
  if (!form.value.from_user) { createError.value = 'Vui lòng chọn người gửi'; return }
  if (!form.value.to_user) { createError.value = 'Vui lòng chọn người nhận'; return }
  if (form.value.from_user === form.value.to_user) { createError.value = 'Người gửi và người nhận không được trùng nhau'; return }
  if (!form.value.amount || Number(form.value.amount) <= 0) { createError.value = 'Vui lòng nhập số tiền'; return }
  creating.value = true
  try {
    await frappeCall('gege_custom.gege_custom.doctype.daily_fund_transfer.daily_fund_transfer.create_transfer', {
      from_user: form.value.from_user,
      to_user: form.value.to_user,
      currency: form.value.currency,
      amount: form.value.amount,
      transfer_type: form.value.transfer_type,
      note: form.value.note,
      from_bank: form.value.from_bank || undefined,
      to_bank: form.value.to_bank || undefined,
    })
    success('Đã tạo lệnh chuyển tiền')
    showCreateModal.value = false
    await loadData()
    loadCounts()
    activeTab.value = 'pending'
  } catch (e) {
    createError.value = (e.message || 'Có lỗi xảy ra').replace(/<[^>]*>/g, '').trim()
  } finally {
    creating.value = false
  }
}

async function openQR(row) {
  showQRModal.value = true
  qrData.value = null
  try {
    qrData.value = await frappeCall('gege_custom.gege_custom.doctype.daily_fund_transfer.daily_fund_transfer.get_transfer_qr', { name: row.name })
  } catch (e) {
    notifyError((e.message || 'Lỗi tạo QR').replace(/<[^>]*>/g, '').trim())
    showQRModal.value = false
  }
}

async function confirmSent(name) {
  try {
    await frappeCall('gege_custom.gege_custom.doctype.daily_fund_transfer.daily_fund_transfer.confirm_sent', { name })
    success('Đã xác nhận chuyển tiền')
    await loadData()
    loadCounts()
  } catch (e) {
    notifyError((e.message || 'Lỗi').replace(/<[^>]*>/g, '').trim())
  }
}

async function confirmReceived(name) {
  try {
    await frappeCall('gege_custom.gege_custom.doctype.daily_fund_transfer.daily_fund_transfer.confirm_received', { name })
    success('Đã xác nhận nhận tiền. Giao dịch được ghi vào sổ cái.')
    await loadData()
    loadCounts()
  } catch (e) {
    notifyError((e.message || 'Lỗi').replace(/<[^>]*>/g, '').trim())
  }
}

async function reportNotReceived(name) {
  if (!(await confirm('Bạn chắc chắn chưa nhận được tiền? Lệnh chuyển sẽ bị hủy.'))) return
  try {
    await frappeCall('gege_custom.gege_custom.doctype.daily_fund_transfer.daily_fund_transfer.report_not_received', {
      name,
      reason: 'Người nhận báo chưa nhận được tiền',
    })
    success('Đã hủy lệnh chuyển')
    await loadData()
    loadCounts()
  } catch (e) {
    notifyError((e.message || 'Lỗi').replace(/<[^>]*>/g, '').trim())
  }
}

async function cancelTransfer(name) {
  try {
    await frappeCall('gege_custom.gege_custom.doctype.daily_fund_transfer.daily_fund_transfer.cancel_transfer', { name })
    success('Đã hủy lệnh')
    await loadData()
    loadCounts()
  } catch (e) {
    notifyError((e.message || 'Lỗi').replace(/<[^>]*>/g, '').trim())
  }
}

function formatNum(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('vi-VN')
}

function fmtInput(v) {
  if (!v && v !== 0) return ''
  return Number(v).toLocaleString('vi-VN')
}

function parseAmount(val) {
  const num = Number(String(val).replace(/\D/g, ''))
  return num || ''
}

function formatDateTime(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt)) return d
  const pad = v => String(v).padStart(2, '0')
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

function copyMemo(memo, rowName) {
  navigator.clipboard?.writeText(memo)
  copiedMemo.value = rowName
  setTimeout(() => { copiedMemo.value = '' }, 2000)
}

function blurFrom() { setTimeout(() => { form.from_focus = false }, 150) }
function blurTo() { setTimeout(() => { form.to_focus = false }, 150) }

const editMemoRow = ref(null)
const editMemoValue = ref('')
const editMemoReason = ref('')
const editMemoError = ref('')
const editMemoSaving = ref(false)

function openEditMemo(row) {
  editMemoRow.value = row
  editMemoValue.value = row.bank_memo || ''
  editMemoReason.value = ''
  editMemoError.value = ''
}

async function saveEditMemo() {
  editMemoError.value = ''
  if (!editMemoValue.value.trim()) { editMemoError.value = 'Nội dung CK không được để trống'; return }
  if (!editMemoReason.value.trim()) { editMemoError.value = 'Nhập lý do sửa'; return }
  editMemoSaving.value = true
  try {
    await frappeCall('gege_custom.gege_custom.doctype.daily_fund_transfer.daily_fund_transfer.edit_bank_memo', {
      name: editMemoRow.value.name,
      bank_memo: editMemoValue.value.trim(),
      reason: editMemoReason.value.trim(),
    })
    success('Đã cập nhật nội dung CK')
    editMemoRow.value.bank_memo = editMemoValue.value.trim()
    editMemoRow.value = null
  } catch (e) {
    editMemoError.value = (e.message || 'Lỗi').replace(/<[^>]*>/g, '').trim()
  } finally {
    editMemoSaving.value = false
  }
}

const currentUserName = computed(() => {
  const u = users.value.find(u => u.email === currentUser.value)
  return u?.full_name || currentUser.value
})

onMounted(() => {
  loadData()
  loadCounts()
  loadUsers()
})
</script>
