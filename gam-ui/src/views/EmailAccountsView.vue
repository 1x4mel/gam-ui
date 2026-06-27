<template>
  <div class="h-full flex flex-col overflow-hidden">
    <PageHeader title="Quản lý Email" subtitle="Email accounts trong hệ thống" icon="📬" :connected="connected" @refresh="loadAll" />

    <div class="flex-1 overflow-y-auto custom-scrollbar max-w-4xl mx-auto w-full pb-8">
      <!-- Unrecognized emails panel -->
      <div v-if="unrecognized.length" class="mb-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-[10px] font-black uppercase tracking-widest text-amber-500">⚠️ Email chưa nhận diện ({{ unrecognized.length }})</h3>
          <button @click="loadUnrecognized" class="text-[10px] text-app-text-muted hover:text-amber-500 font-bold">↻ Làm mới</button>
        </div>
        <div class="space-y-2">
          <div v-for="u in unrecognized" :key="u.name" class="bg-app-surface border border-app-border rounded-xl p-3 flex items-center gap-3">
            <span class="text-sm font-mono text-app-text-primary truncate flex-1">{{ u.candidate_address || u.email_from || u.email_account }}</span>
            <span v-if="u.detected_platform" class="text-[9px] uppercase font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{{ u.detected_platform }}</span>
            <span v-if="u.game" class="text-[9px] uppercase font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded truncate max-w-[120px]">{{ u.game }}</span>
            <span class="text-[9px] text-app-text-muted truncate max-w-[160px]">{{ u.email_subject }}</span>
            <button
              @click="addFromInbound(u)" :disabled="u.adding"
              class="text-[10px] font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition disabled:opacity-50 shrink-0"
            >
              {{ u.adding ? '...' : '+ Thêm' }}
            </button>
            <button
              @click="ignoreUnrecognized(u)" :disabled="u.ignoring"
              class="text-[10px] font-black uppercase tracking-widest text-app-text-secondary hover:text-amber-500 bg-app-bg px-3 py-1.5 rounded-lg transition disabled:opacity-50 shrink-0"
            >
              {{ u.ignoring ? '...' : 'Bỏ qua' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Filter + Add -->
      <div class="flex items-center gap-2 mb-3 px-1 flex-wrap">
        <div class="flex items-center gap-1 bg-app-surface border border-app-border rounded-xl p-1 flex-wrap">
          <button
            v-for="p in PROVIDER_FILTERS" :key="p.value" @click="providerFilter = p.value"
            class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition"
            :class="providerFilter === p.value ? 'bg-indigo-600 text-white' : 'text-app-text-muted hover:text-app-text-primary'"
          >
            {{ p.label }}
          </button>
        </div>
        <div class="flex-1 min-w-[140px] relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted text-sm">🔍</span>
          <input
            v-model="searchQuery" type="text" placeholder="Tìm email..."
            class="w-full pl-9 pr-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:border-indigo-600/50 text-sm"
          />
        </div>
        <button
          @click="openCreate"
          class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition shrink-0"
        >
          + Thêm
        </button>
      </div>

      <LoadingSpinner v-if="loading" size="md" />
      <EmptyState v-else-if="!filtered.length" icon="📬" text="Chưa có email nào" subtext="Thêm email account để hệ thống nhận diện code." />
      <div v-else class="space-y-2">
        <!-- Card: whole-card link to the email-account detail; inline actions
             stop propagation so Sửa/Tắt/Xoá don't navigate. -->
        <router-link
          v-for="e in filtered" :key="e.name" :to="`/admin/emails/${e.name}`"
          class="block bg-app-surface border border-app-border rounded-2xl p-4 hover:border-indigo-600/50 transition"
        >
          <div class="flex items-center gap-3">
            <span class="text-lg">{{ providerIcon(e.provider) }}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-black text-app-text-primary text-sm truncate">{{ e.address }}</span>
                <span class="text-[9px] uppercase font-black text-app-text-muted bg-app-bg px-1.5 py-0.5 rounded">{{ e.provider || 'Other' }}</span>
                <span v-if="!e.is_active" class="text-[9px] uppercase font-black text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">tắt</span>
                <span v-if="e.forward_verified" class="text-[9px] uppercase font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">✓ forward</span>
              </div>
              <p v-if="e.notes" class="text-[10px] text-app-text-muted mt-0.5 truncate">{{ e.notes }}</p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button @click.prevent="openEdit(e)" class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition">Sửa</button>
              <button @click.prevent="toggleActive(e)" class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition">{{ e.is_active ? 'Tắt' : 'Bật' }}</button>
              <button @click.prevent="remove(e)" class="text-[10px] text-red-400/80 hover:text-red-500 font-bold px-2 py-1 rounded-lg hover:bg-red-500/10 transition">Xoá</button>
            </div>
          </div>

          <!-- Dependency summary (platform vs game nodes) -->
          <div class="mt-3 pt-3 border-t border-app-border space-y-2">
            <div v-if="platformDeps(e).length" class="flex items-center gap-1.5 flex-wrap text-[10px]">
              <span class="font-black uppercase tracking-widest text-app-text-muted shrink-0">🖥️ Platform ({{ platformDeps(e).length }})</span>
              <span v-for="a in platformDeps(e)" :key="a.name" class="inline-flex items-center gap-1 bg-app-bg border border-app-border rounded-md px-1.5 py-0.5">
                <PlatformBadge :platform="a.platform" size="xs" />
                <span class="font-bold text-app-text-primary truncate max-w-[120px]">{{ a.username || a.name }}</span>
              </span>
            </div>
            <div v-if="gameDeps(e).length" class="flex items-center gap-1.5 flex-wrap text-[10px]">
              <span class="font-black uppercase tracking-widest text-app-text-muted shrink-0">🎮 Game ({{ gameDeps(e).length }})</span>
              <span v-for="a in gameDeps(e)" :key="a.name" class="inline-flex items-center gap-1 bg-app-bg border border-app-border rounded-md px-1.5 py-0.5">
                <PlatformBadge :platform="a.platform" size="xs" />
                <span class="font-bold text-app-text-primary truncate max-w-[120px]">{{ a.username || a.name }}</span>
              </span>
            </div>
            <p v-if="!platformDeps(e).length && !gameDeps(e).length" class="text-[10px] text-app-text-muted italic">Chưa có tài khoản nào dùng email này.</p>
          </div>

          <div class="mt-3 flex items-center justify-between text-[10px] text-app-text-muted">
            <span>📅 tạo {{ formatDate(e.creation) }}</span>
            <span class="text-indigo-600 font-bold">→ chi tiết</span>
          </div>
        </router-link>
      </div>
    </div>

    <!-- Create / edit (shared modal with password + TOTP + recovery editor) -->
    <EmailAccountFormModal
      :model-value="formOpen" :editing="editingName" :email="editingDoc"
      @update:model-value="onFormClose" @saved="onFormSaved"
    />

    <!-- Delete / blocked-linked-accounts modal (grouped platform vs game) -->
    <ModalWrapper v-if="deleteTarget" :model-value="true" size="md" @update:model-value="closeDelete">
      <template #header>
        <div class="px-8 pt-6 pb-2">
          <h2 class="text-base font-black text-app-text-primary">Xoá email</h2>
        </div>
      </template>
      <div class="px-8 pb-2 space-y-3">
        <p v-if="!blockedAccounts" class="text-sm text-app-text-secondary">
          Xoá email <span class="font-black text-app-text-primary">{{ deleteTarget.address }}</span>? Hành động này không thể hoàn tác.
        </p>
        <div v-else>
          <p class="text-sm text-red-500 font-black mb-1">⚠️ Không thể xoá</p>
          <p class="text-xs text-app-text-secondary mb-3">
            Email này đang liên kết với {{ blockedAccounts.length }} tài khoản. Mở từng tài khoản để đổi sang email khác (hoặc xoá tài khoản) trước khi xoá email.
          </p>
          <div class="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
            <router-link
              v-for="a in blockedAccounts" :key="a.name"
              :to="a.account_level === 'PLATFORM' ? `/platform-accounts/${a.name}` : `/accounts/${a.name}`"
              class="block bg-app-bg border border-app-border rounded-xl p-3 hover:border-indigo-600/40 transition"
            >
              <div class="flex items-center gap-2">
                <PlatformBadge :platform="a.platform" size="xs" />
                <span class="font-black text-app-text-primary text-sm flex-1 truncate">{{ a.username }}</span>
                <span v-if="a.account_level === 'PLATFORM'" class="text-[9px] text-indigo-400 font-black bg-indigo-500/10 px-1.5 py-0.5 rounded">PLATFORM</span>
                <span v-else class="text-[9px] text-amber-400 font-black bg-amber-500/10 px-1.5 py-0.5 rounded">GAME</span>
                <StatusBadge :status="a.status" />
              </div>
            </router-link>
          </div>
        </div>
      </div>
      <template #footer>
        <button
          @click="closeDelete"
          class="px-5 py-2.5 rounded-xl bg-app-bg border border-app-border text-app-text-secondary hover:text-app-text-primary text-[10px] font-black uppercase tracking-widest transition"
        >
          Đóng
        </button>
        <button
          v-if="!blockedAccounts" @click="confirmRemove" :disabled="deleting"
          class="px-6 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2"
        >
          <span v-if="deleting" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Xoá
        </button>
      </template>
    </ModalWrapper>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import ModalWrapper from '../components/ModalWrapper.vue'
import PlatformBadge from '../components/PlatformBadge.vue'
import StatusBadge from '../components/StatusBadge.vue'
import EmailAccountFormModal from '../components/EmailAccountFormModal.vue'
import { useRealtime } from '../composables/useRealtime.js'
import { useNotify } from '../composables/useNotify.js'
import { getList, frappeCall, updateDoc } from '../api/index.js'
import { formatDate } from '../utils/format.js'

defineOptions({ name: 'EmailAccountsView' })

const { connected } = useRealtime()
const { success, error: notifyError } = useNotify()

const PROVIDER_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'Gmail', label: 'Gmail' },
  { value: 'Outlook', label: 'Outlook' },
  { value: 'Hotmail', label: 'Hotmail' },
  { value: 'Proton', label: 'Proton' },
  { value: 'Yahoo', label: 'Yahoo' },
  { value: 'Other', label: 'Khác' },
]

function providerIcon(p) {
  const map = { Gmail: '🔵', Outlook: '🟠', Hotmail: '🟠', Proton: '🟣', Yahoo: '🟣', Other: '📧' }
  return map[p] || '📧'
}

const emails = ref([])
const unrecognized = ref([])
const loading = ref(false)
const providerFilter = ref('')
const searchQuery = ref('')

// Grouped dependent-account summary per email (platform vs game nodes).
// One batched call avoids N+1 fetches across the whole list.
const depsBy = ref({})

function platformDeps(e) {
  return (depsBy.value[e.name] && depsBy.value[e.name].platform) || []
}
function gameDeps(e) {
  return (depsBy.value[e.name] && depsBy.value[e.name].game) || []
}

const filtered = computed(() => {
  let list = emails.value
  if (providerFilter.value) list = list.filter((e) => e.provider === providerFilter.value)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter((e) => (e.address || '').toLowerCase().includes(q))
  }
  return list
})

async function load() {
  loading.value = true
  try {
    emails.value = await getList('GAM Email', {
      fields: ['name', 'address', 'provider', 'notes', 'is_active', 'forward_verified', 'creation'],
      limit: 500,
      order_by: 'modified desc',
    })
    const names = emails.value.map((e) => e.name)
    depsBy.value = names.length
      ? await frappeCall('gam.api.get_email_dependencies', { email_names: JSON.stringify(names) })
      : {}
  } catch {
    emails.value = []
    depsBy.value = {}
  } finally {
    loading.value = false
  }
}

async function loadUnrecognized() {
  try {
    unrecognized.value = await frappeCall('gam.api.get_unrecognized_emails')
  } catch {
    unrecognized.value = []
  }
}

async function loadAll() {
  await Promise.all([load(), loadUnrecognized()])
}

async function addFromInbound(u) {
  u.adding = true
  try {
    const res = await frappeCall('gam.api.add_email_from_inbound', {
      inbound_name: u.name,
      provider: 'Other',
    })
    success(`Đã thêm ${res.address}`)
    await loadAll()
  } catch (e) {
    notifyError(e.message || 'Thêm thất bại')
  } finally {
    u.adding = false
  }
}

async function ignoreUnrecognized(u) {
  u.ignoring = true
  try {
    await frappeCall('gam.api.ignore_unrecognized_email', { inbound_name: u.name })
    success('Đã bỏ qua')
    await loadUnrecognized()
  } catch (e) {
    notifyError(e.message || 'Bỏ qua thất bại')
  } finally {
    u.ignoring = false
  }
}

async function toggleActive(e) {
  try {
    await updateDoc('GAM Email', e.name, { is_active: e.is_active ? 0 : 1 })
    e.is_active = e.is_active ? 0 : 1
    success('Đã cập nhật')
  } catch (err) {
    notifyError(err.message || 'Cập nhật thất bại')
  }
}

// ---- Delete (routes through gam.api.delete_email_account) ----
const deleteTarget = ref(null)     // email being deleted
const blockedAccounts = ref(null)  // null = awaiting confirm; array = blocked list
const deleting = ref(false)

function remove(e) {
  deleteTarget.value = e
  blockedAccounts.value = null
}

function closeDelete() {
  if (deleting.value) return
  deleteTarget.value = null
  blockedAccounts.value = null
}

async function confirmRemove() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    const res = await frappeCall('gam.api.delete_email_account', { email_name: deleteTarget.value.name })
    if (res.blocked) {
      blockedAccounts.value = res.linked_accounts || []
    } else {
      const u = res.unlinked || {}
      const detached = (u.code_request_log || 0) + (u.email_code || 0) + (u.inbound_log || 0)
      success(detached > 0
        ? `Đã xoá email. Đã gỡ liên kết ${detached} bản ghi lịch sử (địa chỉ vẫn được lưu lại).`
        : 'Đã xoá')
      deleteTarget.value = null
      blockedAccounts.value = null
      load()
    }
  } catch (err) {
    notifyError(err.message || 'Xoá thất bại')
  } finally {
    deleting.value = false
  }
}

// ---- Create / edit form (shared modal handles the actual save) ----
const formOpen = ref(false)
const editingName = ref(null)  // email name when editing, null when creating
const editingDoc = ref(null)   // email doc to prefill the modal on edit

function openCreate() {
  editingName.value = null
  editingDoc.value = null
  formOpen.value = true
}
function openEdit(e) {
  editingName.value = e.name
  // The modal only needs the editable fields; pass the row straight through.
  editingDoc.value = e
  formOpen.value = true
}
function onFormClose() {
  formOpen.value = false
}
function onFormSaved() {
  formOpen.value = false
  load()
}

onMounted(loadAll)
</script>
