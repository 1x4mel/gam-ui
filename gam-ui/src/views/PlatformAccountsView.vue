<template>
  <div class="h-full flex flex-col overflow-hidden">
    <PageHeader
      title="Tài khoản Platform"
      subtitle="Tài khoản cấp Thân — cha của các tài khoản Game"
      icon="🖥️"
      :connected="connected"
      @refresh="load"
    />

    <div class="flex-1 overflow-y-auto custom-scrollbar max-w-4xl mx-auto w-full pb-8">
      <!-- Filters -->
      <div class="flex items-center gap-2 mb-3 px-1 flex-wrap">
        <!-- Platform chips -->
        <div class="flex items-center gap-1 bg-app-surface border border-app-border rounded-xl p-1 flex-wrap">
          <button
            v-for="p in PLATFORM_FILTERS" :key="p.value" @click="platformFilter = p.value"
            class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition"
            :class="platformFilter === p.value ? 'bg-indigo-600 text-white' : 'text-app-text-muted hover:text-app-text-primary'"
          >
            {{ p.label }}
          </button>
        </div>
        <!-- Status chips -->
        <div class="flex items-center gap-1 bg-app-surface border border-app-border rounded-xl p-1 flex-wrap">
          <button
            v-for="s in STATUS_FILTERS" :key="s.value" @click="statusFilter = s.value"
            class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition"
            :class="statusFilter === s.value ? 'bg-indigo-600 text-white' : 'text-app-text-muted hover:text-app-text-primary'"
          >
            {{ s.label }}
          </button>
        </div>
        <!-- Renewal due toggle -->
        <button
          @click="renewalDueOnly = !renewalDueOnly"
          class="px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1.5"
          :class="renewalDueOnly ? 'bg-red-500/15 text-red-400 border-red-500/40' : 'bg-app-surface text-app-text-muted border-app-border hover:text-app-text-primary'"
        >
          🔥 Sắp hết hạn
        </button>
        <!-- Search -->
        <div class="flex-1 min-w-[140px] relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted text-sm">🔍</span>
          <input
            v-model="searchQuery" type="text" placeholder="Tìm username..."
            class="w-full pl-9 pr-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:border-indigo-600/50 text-sm"
          />
        </div>
        <!-- Add -->
        <button
          @click="openCreate"
          class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition shrink-0"
        >
          + Thêm
        </button>
      </div>

      <LoadingSpinner v-if="loading" size="md" />
      <EmptyState v-else-if="!filtered.length" icon="🖥️" text="Chưa có Platform nào" subtext="Thêm tài khoản Platform làm cha cho các tài khoản Game." />
      <div v-else class="space-y-2">
        <div
          v-for="p in filtered" :key="p.name"
          class="bg-app-surface border border-app-border rounded-2xl p-4"
        >
          <div class="flex items-center gap-3">
            <span class="text-lg">{{ platformIcon(p.platform) }}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-black text-app-text-primary text-sm truncate">{{ p.username || p.name }}</span>
                <span class="text-[9px] uppercase font-black text-app-text-muted bg-app-bg px-1.5 py-0.5 rounded">{{ p.platform || '?' }}</span>
                <StatusBadge :status="p.status" />
                <span
                  v-if="renewalBadge(p).label"
                  class="text-[9px] uppercase font-black px-1.5 py-0.5 rounded"
                  :class="renewalBadge(p).cls"
                >
                  {{ renewalBadge(p).label }}
                </span>
              </div>
              <p class="text-[10px] text-app-text-muted mt-0.5 truncate">
                <span v-if="p.email_address">{{ p.email_address }} · </span>{{ p.children_count || 0 }} tài khoản Game
                <template v-if="p.billing_type && p.billing_type !== 'ONE_TIME' && p.active_until"> · hết hạn {{ formatDate(p.active_until) }}</template>
              </p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button
                v-if="p.billing_type && p.billing_type !== 'ONE_TIME'"
                @click="openRenew(p)"
                class="text-[10px] text-amber-500 hover:text-amber-400 font-bold px-2 py-1 rounded-lg hover:bg-amber-500/10 transition"
              >Gia hạn</button>
              <router-link
                :to="`/platform-accounts/${p.name}`"
                class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition"
              >Chi tiết</router-link>
              <button @click="openEdit(p)" class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition">Sửa</button>
              <button @click="askDelete(p)" class="text-[10px] text-red-400/80 hover:text-red-500 font-bold px-2 py-1 rounded-lg hover:bg-red-500/10 transition">Xoá</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create / Edit modal -->
    <ModalWrapper :model-value="formOpen" @update:model-value="closeForm">
      <template #header>
        <div class="px-8 pt-6 pb-2">
          <h2 class="text-base font-black text-app-text-primary">{{ editing ? 'Sửa Platform' : 'Thêm Platform' }}</h2>
        </div>
      </template>
      <div class="px-8 pb-2 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
        <!-- Platform -->
        <div>
          <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Platform</label>
          <div class="flex flex-wrap gap-1.5 mt-1.5">
            <button
              v-for="o in platformOptions" :key="o.value" @click="form.platform = o.value"
              class="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition flex items-center gap-1.5"
              :class="form.platform === o.value ? 'border-indigo-600 bg-indigo-600/10 text-indigo-400' : 'border-app-border text-app-text-muted hover:text-app-text-primary'"
            >
              <span>{{ o.icon || '🎮' }}</span>{{ o.label }}
            </button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Username</label>
            <input v-model="form.username" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50" />
          </div>
          <div>
            <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Status</label>
            <select v-model="form.status" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50">
              <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Password</label>
            <input v-model="form.account_password" type="password" :placeholder="editing ? '(để trống giữ nguyên)' : ''" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50" />
          </div>
          <div>
            <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">TOTP secret</label>
            <input v-model="form.totp_secret" type="password" :placeholder="editing ? '(để trống giữ nguyên)' : ''" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Email (Link)</label>
            <select v-model="form.email" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50">
              <option value="">— Không —</option>
              <option v-for="e in emailOptions" :key="e.value" :value="e.value">{{ e.label }}</option>
            </select>
          </div>
          <div>
            <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Nguồn (Source)</label>
            <input v-model="form.source" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50" />
          </div>
        </div>

        <div class="border-t border-app-border pt-3 space-y-3">
          <h3 class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">💳 Thanh toán / gia hạn</h3>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Loại phí</label>
              <select v-model="form.billing_type" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50">
                <option value="ONE_TIME">Một lần (ONE_TIME)</option>
                <option value="RENTAL">Thuê (RENTAL)</option>
                <option value="SUBSCRIPTION">Định kỳ (SUBSCRIPTION)</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Hiệu lực đến</label>
              <input v-model="form.active_until" type="date" :disabled="form.billing_type === 'ONE_TIME'" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50 disabled:opacity-50" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3" v-if="form.billing_type !== 'ONE_TIME'">
            <div>
              <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Cảnh báo trước (ngày)</label>
              <input v-model.number="form.renewal_lead_days" type="number" min="0" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50" />
            </div>
            <div>
              <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Chi phí gia hạn</label>
              <input v-model.number="form.renewal_cost" type="number" min="0" step="1000" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50" />
            </div>
            <div class="flex items-end">
              <label class="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-app-text-muted pb-2 cursor-pointer">
                <input v-model="form.auto_renew" type="checkbox" class="accent-indigo-600 w-4 h-4" /> Tự động
              </label>
            </div>
          </div>
        </div>

        <div>
          <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Ghi chú</label>
          <textarea v-model="form.notes" rows="2" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50"></textarea>
        </div>
        <p v-if="formError" class="text-[11px] font-bold text-red-400">{{ formError }}</p>
      </div>
      <template #footer>
        <div class="px-8 py-4 flex justify-end gap-2">
          <button @click="closeForm" class="px-4 py-2 rounded-xl bg-app-bg text-app-text-secondary hover:text-app-text-primary text-[10px] font-black uppercase tracking-widest transition">Huỷ</button>
          <button @click="submitForm" :disabled="formSaving" class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 inline-flex items-center gap-2">
            <span v-if="formSaving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ editing ? 'Cập nhật' : 'Thêm' }}
          </button>
        </div>
      </template>
    </ModalWrapper>

    <!-- Renewal modal -->
    <ModalWrapper :model-value="renewOpen" @update:model-value="closeRenew">
      <template #header>
        <div class="px-8 pt-6 pb-2">
          <h2 class="text-base font-black text-app-text-primary">Gia hạn {{ renewTarget?.username }}</h2>
          <p v-if="renewTarget?.active_until" class="text-[11px] text-app-text-muted italic mt-1">Hiệu lực hiện tại đến {{ formatDate(renewTarget.active_until) }}</p>
        </div>
      </template>
      <div class="px-8 pb-2 space-y-4">
        <div>
          <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Gia hạn theo</label>
          <div class="flex gap-1.5 mt-1.5">
            <button
              v-for="opt in RENEW_PERIODS" :key="opt.days" @click="applyRenewPeriod(opt.days)"
              class="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition"
              :class="renewPeriodSel === opt.days ? 'border-indigo-600 bg-indigo-600/10 text-indigo-400' : 'border-app-border text-app-text-muted hover:text-app-text-primary'"
            >
              +{{ opt.days }} ngày
            </button>
          </div>
        </div>
        <div>
          <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Hiệu lực đến (mới)</label>
          <input v-model="renewForm.new_active_until" type="date" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Chi phí</label>
            <input v-model.number="renewForm.renewal_cost" type="number" min="0" step="1000" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50" />
          </div>
          <div class="flex items-end">
            <label class="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-app-text-muted pb-2 cursor-pointer">
              <input v-model="renewForm.auto_renew" type="checkbox" class="accent-indigo-600 w-4 h-4" /> Tự động
            </label>
          </div>
        </div>
        <div>
          <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Ghi chú</label>
          <textarea v-model="renewForm.notes" rows="2" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50"></textarea>
        </div>
        <p v-if="renewError" class="text-[11px] font-bold text-red-400">{{ renewError }}</p>
      </div>
      <template #footer>
        <div class="px-8 py-4 flex justify-end gap-2">
          <button @click="closeRenew" class="px-4 py-2 rounded-xl bg-app-bg text-app-text-secondary hover:text-app-text-primary text-[10px] font-black uppercase tracking-widest transition">Huỷ</button>
          <button @click="submitRenew" :disabled="renewSaving" class="px-4 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 inline-flex items-center gap-2">
            <span v-if="renewSaving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            Gia hạn
          </button>
        </div>
      </template>
    </ModalWrapper>

    <!-- Delete confirm -->
    <ModalWrapper :model-value="!!deleteTarget" @update:model-value="deleteTarget = null">
      <template #header>
        <div class="px-8 pt-6 pb-2">
          <h2 class="text-base font-black text-app-text-primary">Xoá Platform</h2>
        </div>
      </template>
      <div class="px-8 pb-2 space-y-3">
        <p class="text-sm text-app-text-secondary">
          Xoá <span class="font-black text-app-text-primary">{{ deleteTarget?.username || deleteTarget?.name }}</span>?
          <span v-if="(deleteTarget?.children_count || 0) > 0" class="block mt-2 text-[11px] text-amber-400 font-bold">
            ⚠️ Platform này đang có {{ deleteTarget.children_count }} tài khoản Game con. Hãy gán lại parent trước khi xoá.
          </span>
        </p>
        <p v-if="deleteError" class="text-[11px] font-bold text-red-400">{{ deleteError }}</p>
      </div>
      <template #footer>
        <div class="px-8 py-4 flex justify-end gap-2">
          <button @click="deleteTarget = null" class="px-4 py-2 rounded-xl bg-app-bg text-app-text-secondary hover:text-app-text-primary text-[10px] font-black uppercase tracking-widest transition">Huỷ</button>
          <button @click="confirmDelete" :disabled="deleting" class="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 inline-flex items-center gap-2">
            <span v-if="deleting" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Xoá
          </button>
        </div>
      </template>
    </ModalWrapper>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import ModalWrapper from '../components/ModalWrapper.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { useRealtime } from '../composables/useRealtime.js'
import { useNotify } from '../composables/useNotify.js'
import { useGamMetadata } from '../composables/useGamMetadata.js'
import { frappeCall } from '../api/index.js'

defineOptions({ name: 'PlatformAccountsView' })

const { connected, on: onRt, off: offRt } = useRealtime()
const { success, error: notifyError } = useNotify()
const { platformOptions, statusOptions, platformMeta, emails, load: loadMeta } = useGamMetadata()

// ---- List ----
const items = ref([])
const loading = ref(false)

const PLATFORM_FILTERS = computed(() => [{ value: '', label: 'Tất cả' }, ...platformOptions.value.map(o => ({ value: o.value, label: o.label }))])
const STATUS_FILTERS = computed(() => [{ value: '', label: 'Tất cả' }, ...statusOptions.value.map(o => ({ value: o.value, label: o.label }))])

const platformFilter = ref('')
const statusFilter = ref('')
const renewalDueOnly = ref(false)
const searchQuery = ref('')

const filtered = computed(() => {
  let list = items.value
  if (platformFilter.value) list = list.filter((p) => p.platform === platformFilter.value)
  if (statusFilter.value) list = list.filter((p) => p.status === statusFilter.value)
  if (renewalDueOnly.value) list = list.filter((p) => p.renewal_state === 'DUE' || p.renewal_state === 'OVERDUE')
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter((p) => (p.username || '').toLowerCase().includes(q) || (p.email_address || p.email || '').toLowerCase().includes(q))
  }
  return list
})

async function load() {
  loading.value = true
  try {
    items.value = await frappeCall('gam.api.get_platform_accounts')
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

// ---- Helpers ----
function platformIcon(platform) {
  return platformMeta(platform)?.icon || '🖥️'
}
function formatDate(s) {
  if (!s) return '—'
  const d = new Date(s.endsWith('Z') ? s : s + 'T00:00:00')
  return d.toLocaleDateString('vi-VN')
}
function renewalBadge(p) {
  const st = p.renewal_state
  if (st === 'OVERDUE') return { label: '🔴 Quá hạn', cls: 'bg-red-500/15 text-red-400' }
  if (st === 'DUE') return { label: '🟠 Sắp hết hạn', cls: 'bg-amber-500/15 text-amber-400' }
  if (st === 'OK') return { label: '🟢 Còn hạn', cls: 'bg-emerald-500/15 text-emerald-400' }
  return { label: '', cls: '' }
}

// ---- Create / edit form ----
const emailOptions = computed(() => emails.value.map((e) => ({ value: e.name, label: e.address })))

const formOpen = ref(false)
const editing = ref(null)
const form = ref({})
const formSaving = ref(false)
const formError = ref('')

function emptyForm() {
  return {
    platform: 'STEAM',
    username: '',
    account_password: '',
    totp_secret: '',
    email: '',
    source: '',
    status: 'ACTIVE',
    notes: '',
    billing_type: 'ONE_TIME',
    active_until: '',
    renewal_lead_days: 3,
    auto_renew: false,
    renewal_cost: null,
  }
}
function openCreate() {
  editing.value = null
  formError.value = ''
  form.value = emptyForm()
  formOpen.value = true
}
function openEdit(p) {
  editing.value = p.name
  formError.value = ''
  form.value = {
    platform: p.platform || 'STEAM',
    username: p.username || '',
    account_password: '',
    totp_secret: '',
    email: p.email || '',
    source: p.source || '',
    status: p.status || 'ACTIVE',
    notes: p.notes || '',
    billing_type: p.billing_type || 'ONE_TIME',
    active_until: p.active_until ? p.active_until.slice(0, 10) : '',
    renewal_lead_days: p.renewal_lead_days ?? 3,
    auto_renew: !!p.auto_renew,
    renewal_cost: p.renewal_cost ?? null,
  }
  formOpen.value = true
}
function closeForm() {
  if (formSaving.value) return
  formOpen.value = false
}
function toBackendBool(v) {
  if (v === true) return 1
  if (v === false) return 0
  return v
}
async function submitForm() {
  if (!form.value.platform || !form.value.username || !form.value.email) {
    formError.value = 'Vui lòng điền platform, username và email'
    return
  }
  if (form.value.billing_type !== 'ONE_TIME' && !form.value.active_until) {
    formError.value = 'Vui lòng chọn ngày hết hạn cho loại phí định kỳ'
    return
  }
  formSaving.value = true
  formError.value = ''
  try {
    const payload = {
      account_level: 'PLATFORM',
      platform: form.value.platform,
      username: form.value.username,
      email: form.value.email || undefined,
      source: form.value.source || undefined,
      status: form.value.status,
      billing_type: form.value.billing_type,
      active_until: form.value.billing_type !== 'ONE_TIME' && form.value.active_until ? form.value.active_until : undefined,
      renewal_lead_days: form.value.billing_type !== 'ONE_TIME' ? form.value.renewal_lead_days : undefined,
      auto_renew: form.value.billing_type !== 'ONE_TIME' ? toBackendBool(form.value.auto_renew) : undefined,
      renewal_cost: form.value.billing_type !== 'ONE_TIME' ? form.value.renewal_cost : undefined,
    }
    if (form.value.account_password) payload.account_password = form.value.account_password
    if (form.value.totp_secret) payload.totp_secret = form.value.totp_secret
    if (form.value.notes) payload.notes = form.value.notes

    const args = { values: JSON.stringify(payload) }
    if (editing.value) args.name = editing.value
    await frappeCall('gam.api.save_account', args)
    success(editing.value ? 'Đã cập nhật Platform' : 'Đã tạo Platform')
    formOpen.value = false
    await load()
  } catch (e) {
    formError.value = e.message || 'Lưu thất bại'
    notifyError(formError.value)
  } finally {
    formSaving.value = false
  }
}

// ---- Renewal ----
const RENEW_PERIODS = [
  { days: 7 }, { days: 30 }, { days: 90 }, { days: 180 }, { days: 365 },
]
const renewOpen = ref(false)
const renewTarget = ref(null)
const renewPeriodSel = ref(null)
const renewForm = ref({})
const renewSaving = ref(false)
const renewError = ref('')

function openRenew(p) {
  renewTarget.value = p
  renewPeriodSel.value = null
  renewError.value = ''
  renewForm.value = {
    new_active_until: p.active_until ? p.active_until.slice(0, 10) : new Date().toISOString().slice(0, 10),
    renewal_cost: p.renewal_cost ?? null,
    auto_renew: !!p.auto_renew,
    notes: '',
  }
  renewOpen.value = true
}
function closeRenew() {
  if (renewSaving.value) return
  renewOpen.value = false
}
function applyRenewPeriod(days) {
  renewPeriodSel.value = days
  const base = renewTarget.value?.active_until
    ? new Date(base.endsWith('Z') ? base : base + 'T00:00:00')
    : new Date()
  const next = new Date(base.getTime() + days * 86400000)
  renewForm.value.new_active_until = next.toISOString().slice(0, 10)
}
async function submitRenew() {
  if (!renewForm.value.new_active_until) {
    renewError.value = 'Chọn ngày hiệu lực mới'
    return
  }
  renewSaving.value = true
  renewError.value = ''
  try {
    await frappeCall('gam.api.renew_account', {
      account: renewTarget.value.name,
      new_active_until: renewForm.value.new_active_until,
      renewal_cost: renewForm.value.renewal_cost ?? undefined,
      auto_renew: toBackendBool(renewForm.value.auto_renew),
      notes: renewForm.value.notes || undefined,
    })
    success('Đã gia hạn')
    renewOpen.value = false
    await load()
  } catch (e) {
    renewError.value = e.message || 'Gia hạn thất bại'
    notifyError(renewError.value)
  } finally {
    renewSaving.value = false
  }
}

// ---- Delete ----
const deleteTarget = ref(null)
const deleting = ref(false)
const deleteError = ref('')
function askDelete(p) {
  deleteTarget.value = p
  deleteError.value = ''
}
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await frappeCall('gam.api.delete_account', { name: deleteTarget.value.name })
    success('Đã xoá')
    deleteTarget.value = null
    await load()
  } catch (e) {
    deleteError.value = e.message || 'Xoá thất bại'
  } finally {
    deleting.value = false
  }
}

// ---- Realtime live refresh ----
function onRenewalsChanged() {
  load()
}
function onAccountChanged(payload) {
  // Only the platform name in payload matters here; a refresh is cheap.
  if (!payload || !payload.account || items.value.some((p) => p.name === payload.account)) load()
}

onMounted(() => {
  loadMeta(true)
  load()
  onRt('gam_renewals_changed', onRenewalsChanged)
  onRt('gam_account_changed', onAccountChanged)
})
onUnmounted(() => {
  offRt('gam_renewals_changed', onRenewalsChanged)
  offRt('gam_account_changed', onAccountChanged)
})
</script>
