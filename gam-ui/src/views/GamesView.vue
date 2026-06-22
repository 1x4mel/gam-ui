<template>
  <div class="h-full flex flex-col overflow-hidden">
    <PageHeader title="Game & DLC" subtitle="Quản lý Game · Server · DLC · Tuỳ chọn" icon="🎯" :connected="connected" @refresh="refresh" />

    <!-- Tabs -->
    <div class="flex items-center gap-1 border-b border-app-border mb-4 flex-wrap">
      <button
        v-for="t in TABS" :key="t.key"
        @click="activeTab = t.key"
        class="px-4 py-2.5 text-[11px] font-black uppercase tracking-wider border-b-2 transition -mb-px"
        :class="activeTab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-app-text-muted hover:text-app-text-primary'"
      >
        {{ t.icon }} {{ t.label }}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar max-w-4xl mx-auto w-full">
      <!-- Games tab -->
      <div v-if="activeTab === 'games'" class="space-y-2 pb-8">
        <div class="flex justify-end mb-3">
          <button @click="openForm('game')" class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition">+ Thêm Game</button>
        </div>
        <LoadingSpinner v-if="loadingGames" size="md" />
        <EmptyState v-else-if="!games.length" icon="🎯" text="Chưa có game" />
        <div v-else class="space-y-2">
          <div v-for="g in games" :key="g.name" class="bg-app-surface border border-app-border rounded-2xl p-4 flex items-center gap-3">
            <span class="text-xl">🎮</span>
            <div class="flex-1 min-w-0">
              <p class="font-black text-app-text-primary text-sm truncate">{{ g.game_name }}</p>
              <p class="text-[10px] text-app-text-muted">{{ g.publisher || '—' }}</p>
            </div>
            <StatusBadge :status="g.is_active ? 'Available' : 'Expired'" />
            <button @click="toggleActive('GAM Game', g)" class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition">{{ g.is_active ? 'Tắt' : 'Bật' }}</button>
            <button @click="openForm('game', g)" class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition">Sửa</button>
            <button @click="deleteEntity('GAM Game', g)" class="text-[10px] text-red-400/80 hover:text-red-500 font-bold px-2 py-1 rounded-lg hover:bg-red-500/10 transition">Xoá</button>
          </div>
        </div>
      </div>

      <!-- Servers tab -->
      <div v-if="activeTab === 'servers'" class="space-y-2 pb-8">
        <div class="flex justify-end mb-3">
          <button @click="openForm('server')" class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition">+ Thêm Server</button>
        </div>
        <LoadingSpinner v-if="loadingServers" size="md" />
        <EmptyState v-else-if="!servers.length" icon="🌐" text="Chưa có server" />
        <div v-else class="space-y-2">
          <div v-for="s in servers" :key="s.name" class="bg-app-surface border border-app-border rounded-2xl p-4 flex items-center gap-3">
            <span class="text-xl">🌐</span>
            <div class="flex-1 min-w-0">
              <p class="font-black text-app-text-primary text-sm truncate">{{ gameName(s.game) }} · {{ s.server_name }}</p>
              <p class="text-[10px] text-app-text-muted">{{ s.notes || '—' }}</p>
            </div>
            <StatusBadge :status="s.is_active ? 'Available' : 'Expired'" />
            <button @click="toggleActive('GAM Game Server', s)" class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition">{{ s.is_active ? 'Tắt' : 'Bật' }}</button>
            <button @click="openForm('server', s)" class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition">Sửa</button>
            <button @click="deleteEntity('GAM Game Server', s)" class="text-[10px] text-red-400/80 hover:text-red-500 font-bold px-2 py-1 rounded-lg hover:bg-red-500/10 transition">Xoá</button>
          </div>
        </div>
      </div>

      <!-- DLC tab -->
      <div v-if="activeTab === 'dlc'" class="space-y-2 pb-8">
        <div class="flex justify-end mb-3">
          <button @click="openForm('dlc')" class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition">+ Thêm DLC</button>
        </div>
        <LoadingSpinner v-if="loadingDlcs" size="md" />
        <EmptyState v-else-if="!dlcs.length" icon="🧩" text="Chưa có DLC" />
        <div v-else class="space-y-2">
          <div v-for="d in dlcs" :key="d.name" class="bg-app-surface border border-app-border rounded-2xl p-4 flex items-center gap-3">
            <span class="text-xl">🧩</span>
            <div class="flex-1 min-w-0">
              <p class="font-black text-app-text-primary text-sm truncate">{{ d.dlc_name }}</p>
              <p class="text-[10px] text-app-text-muted">{{ gameName(d.game) }}{{ d.release_date ? ' · ' + formatDate(d.release_date) : '' }}</p>
            </div>
            <button @click="openForm('dlc', d)" class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition">Sửa</button>
            <button @click="deleteEntity('GAM DLC', d)" class="text-[10px] text-red-400/80 hover:text-red-500 font-bold px-2 py-1 rounded-lg hover:bg-red-500/10 transition">Xoá</button>
          </div>
        </div>
      </div>

      <!-- Configurable list options tabs (Platform / Role / Status) -->
      <div v-if="isListTab" class="space-y-2 pb-8">
        <div class="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <p class="text-[11px] text-app-text-muted">
            Tuỳ chỉnh danh sách <span class="font-black text-app-text-primary">{{ currentCategory }}</span>. Thay đổi tại đây sẽ áp dụng cho form tài khoản, bộ lọc và badge toàn ứng dụng.
          </p>
          <button @click="openOptionCreate" class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition">+ Thêm</button>
        </div>
        <LoadingSpinner v-if="loadingOptions" size="md" />
        <EmptyState v-else-if="!listOptions.length" icon="🏷️" text="Chưa có tuỳ chọn" />
        <div v-else class="space-y-2">
          <div v-for="o in listOptions" :key="o.name || o.value" class="bg-app-surface border border-app-border rounded-2xl p-4 flex items-center gap-3">
            <span class="text-xl w-7 text-center">{{ o.icon || '•' }}</span>
            <span class="w-3 h-3 rounded-full shrink-0 border border-black/10" :class="optionColorClass(o.color)"></span>
            <div class="flex-1 min-w-0">
              <p class="font-black text-app-text-primary text-sm truncate">
                {{ o.label }}
                <span class="text-app-text-muted font-mono text-[10px] font-normal">({{ o.value }})</span>
                <span v-if="!o.name" class="text-[9px] text-amber-500 font-black ml-1">mặc định</span>
              </p>
              <p class="text-[10px] text-app-text-muted">
                <template v-if="currentCategory === 'Platform'">code-platform: <span class="font-mono">{{ o.code_platform || '—' }}</span></template>
                <template v-else>thứ tự: {{ o.sort_order || 0 }}</template>
              </p>
            </div>
            <template v-if="o.name">
              <button @click="openOptionEdit(o)" class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition">Sửa</button>
              <button @click="deleteOption(o)" class="text-[10px] text-red-400/80 hover:text-red-500 font-bold px-2 py-1 rounded-lg hover:bg-red-500/10 transition">Xoá</button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Create modal (game / server / dlc) -->
    <ModalWrapper v-if="formType" :model-value="true" size="md" persistent @update:model-value="formType = ''">
      <template #header>
        <div class="px-8 pt-8 pb-4 flex items-center justify-between">
          <h3 class="text-lg font-black text-app-text-primary uppercase tracking-tight">{{ formTitle }}</h3>
          <button @click="formType = ''" class="text-app-text-muted hover:text-app-text-primary p-1">✕</button>
        </div>
      </template>
      <div class="px-8 pb-2 space-y-4">
        <template v-if="formType === 'game'">
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Tên game *</label>
            <input v-model="form.game_name" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="Diablo 4" />
          </div>
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Publisher</label>
            <input v-model="form.publisher" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="Blizzard" />
          </div>
        </template>
        <template v-if="formType === 'server'">
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Game *</label>
            <SearchableSelect v-model="form.game" :options="gameOptions" placeholder="Chọn game" />
          </div>
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Tên server *</label>
            <input v-model="form.server_name" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="VD: Asia #1, Server Chim Sẻ, ..." />
          </div>
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Ghi chú</label>
            <input v-model="form.notes" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="Optional" />
          </div>
        </template>
        <template v-if="formType === 'dlc'">
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Game *</label>
            <SearchableSelect v-model="form.game" :options="gameOptions" placeholder="Chọn game" />
          </div>
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Tên DLC *</label>
            <input v-model="form.dlc_name" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="Vessel of Hatred" />
          </div>
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Ngày ra mắt</label>
            <input v-model="form.release_date" type="date" class="w-full input-field px-3 py-2.5 text-sm" />
          </div>
        </template>
        <p v-if="formError" class="text-xs text-red-500 font-medium">{{ formError }}</p>
      </div>
      <template #footer>
        <button @click="formType = ''" class="px-5 py-2.5 rounded-xl bg-app-bg border border-app-border text-app-text-secondary hover:text-app-text-primary text-[10px] font-black uppercase tracking-widest transition">Huỷ</button>
        <button @click="submitForm" :disabled="formSaving" class="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2">
          <span v-if="formSaving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Lưu
        </button>
      </template>
    </ModalWrapper>

    <!-- List-option create/edit modal -->
    <ModalWrapper v-if="optionFormOpen" :model-value="true" size="md" persistent @update:model-value="optionFormOpen = false">
      <template #header>
        <div class="px-8 pt-8 pb-4 flex items-center justify-between">
          <h3 class="text-lg font-black text-app-text-primary uppercase tracking-tight">
            {{ optionEditing ? 'Sửa' : 'Thêm' }} {{ currentCategory }}
          </h3>
          <button @click="optionFormOpen = false" class="text-app-text-muted hover:text-app-text-primary p-1">✕</button>
        </div>
      </template>
      <div class="px-8 pb-2 space-y-4">
        <div>
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Nhãn *</label>
          <input v-model="optionForm.label" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="Steam" />
        </div>
        <div>
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Value <span class="normal-case font-medium opacity-50">(để trống để tự sinh từ nhãn)</span></label>
          <input v-model="optionForm.value" type="text" class="w-full input-field px-3 py-2.5 text-sm font-mono" placeholder="STEAM" />
        </div>
        <div v-if="currentCategory === 'Platform'">
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Code platform <span class="normal-case font-medium opacity-50">(dùng để khớp email code)</span></label>
          <select v-model="optionForm.code_platform" class="w-full input-field px-3 py-2.5 text-sm">
            <option v-for="c in CODE_PLATFORM_OPTS" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Icon (emoji)</label>
            <input v-model="optionForm.icon" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="🎮" />
          </div>
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Thứ tự</label>
            <input v-model.number="optionForm.sort_order" type="number" class="w-full input-field px-3 py-2.5 text-sm" placeholder="0" />
          </div>
        </div>
        <div>
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-2">Màu</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in COLORS" :key="c" type="button" @click="optionForm.color = c"
              class="w-8 h-8 rounded-lg border-2 transition"
              :class="[optionColorClass(c), optionForm.color === c ? 'border-white ring-2 ring-indigo-500' : 'border-transparent']"
            ></button>
          </div>
        </div>
        <p v-if="optionError" class="text-xs text-red-500 font-medium">{{ optionError }}</p>
      </div>
      <template #footer>
        <button @click="optionFormOpen = false" class="px-5 py-2.5 rounded-xl bg-app-bg border border-app-border text-app-text-secondary hover:text-app-text-primary text-[10px] font-black uppercase tracking-widest transition">Huỷ</button>
        <button @click="submitOption" :disabled="optionSaving" class="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2">
          <span v-if="optionSaving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Lưu
        </button>
      </template>
    </ModalWrapper>

    <!-- Generic confirm dialog -->
    <ConfirmDialog
      v-if="confirmState.open" :title="confirmState.title" :message="confirmState.message"
      danger confirm-label="Xoá" @close="confirmState.open = false" @confirm="runConfirm"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import ModalWrapper from '../components/ModalWrapper.vue'
import SearchableSelect from '../components/SearchableSelect.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useRealtime } from '../composables/useRealtime.js'
import { useNotify } from '../composables/useNotify.js'
import { useGamMetadata, optionColorClass } from '../composables/useGamMetadata.js'
import { getList, createDoc, updateDoc, deleteDoc, frappeCall } from '../api/index.js'
import { formatDate } from '../utils/format.js'

defineOptions({ name: 'GamesView' })

const { connected } = useRealtime()
const { success, error: notifyError } = useNotify()
const { loadListOptions } = useGamMetadata()

const TABS = [
  { key: 'games', label: 'Game', icon: '🎮' },
  { key: 'servers', label: 'Server', icon: '🌐' },
  { key: 'dlc', label: 'DLC', icon: '🧩' },
  { key: 'platforms', label: 'Platform', icon: '🎮' },
  { key: 'roles', label: 'Role', icon: '🏷️' },
  { key: 'statuses', label: 'Status', icon: '📊' },
]
const LIST_CATEGORIES = {
  platforms: 'Platform',
  roles: 'Account Role',
  statuses: 'Account Status',
}
const COLORS = ['blue', 'indigo', 'emerald', 'amber', 'red', 'slate', 'orange', 'gray']
const CODE_PLATFORM_OPTS = ['STEAM', 'BATTLENET', 'POE', 'EPIC', 'XBOX', 'OTHER']

const activeTab = ref('games')
const isListTab = computed(() => activeTab.value in LIST_CATEGORIES)
const currentCategory = computed(() => LIST_CATEGORIES[activeTab.value] || '')

const games = ref([])
const servers = ref([])
const dlcs = ref([])
const loadingGames = ref(false)
const loadingServers = ref(false)
const loadingDlcs = ref(false)

const gameOptions = computed(() => games.value.map(g => ({ value: g.name, label: g.game_name })))
function gameName(link) {
  return games.value.find(g => g.name === link)?.game_name || link || '—'
}

async function refresh() {
  const [g, s, d] = [loadGames(), loadServers(), loadDlcs()]
  await Promise.all([g, s, d])
  if (isListTab.value) loadOptions()
}
async function loadGames() {
  loadingGames.value = true
  try {
    games.value = await getList('GAM Game', { fields: ['name', 'game_name', 'publisher', 'is_active'], limit: 500, order_by: 'game_name asc' })
  } catch { games.value = [] } finally { loadingGames.value = false }
}
async function loadServers() {
  loadingServers.value = true
  try {
    servers.value = await getList('GAM Game Server', { fields: ['name', 'game', 'server_name', 'is_active', 'notes'], limit: 500, order_by: 'server_name asc' })
  } catch { servers.value = [] } finally { loadingServers.value = false }
}
async function loadDlcs() {
  loadingDlcs.value = true
  try {
    dlcs.value = await getList('GAM DLC', { fields: ['name', 'dlc_name', 'game', 'release_date'], limit: 500, order_by: 'dlc_name asc' })
  } catch { dlcs.value = [] } finally { loadingDlcs.value = false }
}

async function toggleActive(doctype, doc) {
  try {
    await updateDoc(doctype, doc.name, { is_active: doc.is_active ? 0 : 1 })
    doc.is_active = doc.is_active ? 0 : 1
    success('Đã cập nhật')
  } catch (e) { notifyError(e.message || 'Cập nhật thất bại') }
}

// ---- Create / edit form (game / server / dlc) ----
const formType = ref('')
const editingId = ref('')
const formTitle = computed(() => {
  const base = formType.value === 'game' ? 'Game' : formType.value === 'server' ? 'Server' : 'DLC'
  return (editingId.value ? 'Sửa ' : 'Thêm ') + base
})
const form = ref({})
const formSaving = ref(false)
const formError = ref('')

function openForm(type, doc) {
  formType.value = type
  formError.value = ''
  editingId.value = doc?.name || ''
  if (doc) {
    form.value = { ...doc }
  } else if (type === 'game') {
    form.value = { game_name: '', publisher: '' }
  } else if (type === 'server') {
    form.value = { game: '', server_name: '', notes: '' }
  } else {
    form.value = { game: '', dlc_name: '', release_date: '' }
  }
}

async function submitForm() {
  const t = formType.value
  if (t === 'game' && !form.value.game_name) return (formError.value = 'Nhập tên game')
  if (t === 'server' && (!form.value.game || !form.value.server_name)) return (formError.value = 'Chọn game và nhập tên server')
  if (t === 'dlc' && (!form.value.game || !form.value.dlc_name)) return (formError.value = 'Chọn game và nhập tên DLC')

  formSaving.value = true
  formError.value = ''
  try {
    const doctype = t === 'game' ? 'GAM Game' : t === 'server' ? 'GAM Game Server' : 'GAM DLC'
    const payload = { ...form.value }
    // Clean optionals + strip read-only system fields before sending.
    if (!payload.release_date) delete payload.release_date
    if (!payload.publisher) delete payload.publisher
    if (!payload.notes) delete payload.notes
    delete payload.name
    delete payload.creation
    delete payload.modified
    delete payload.owner
    delete payload.modified_by
    if (editingId.value) {
      await updateDoc(doctype, editingId.value, payload)
      success('Đã cập nhật')
    } else {
      payload.is_active = 1
      await createDoc(doctype, payload)
      success('Đã tạo')
    }
    formType.value = ''
    editingId.value = ''
    refresh()
  } catch (e) {
    formError.value = e.message || 'Lưu thất bại'
  } finally {
    formSaving.value = false
  }
}

function deleteEntity(doctype, doc) {
  const label = doc.game_name || doc.server_name || doc.dlc_name || doc.name
  confirmState.value = {
    open: true,
    title: `Xoá ${label}`,
    message: `Xoá «${label}»? Hành động này không thể hoàn tác.`,
    onConfirm: async () => {
      try {
        await deleteDoc(doctype, doc.name)
        success('Đã xoá')
        refresh()
      } catch (e) {
        notifyError(e.message || 'Xoá thất bại')
      }
    },
  }
}

// ---- Configurable list options (Platform / Role / Status) ----
const listOptions = ref([])
const loadingOptions = ref(false)

async function loadOptions() {
  if (!currentCategory.value) return
  loadingOptions.value = true
  try {
    listOptions.value = await frappeCall('gam.api.get_list_options', { category: currentCategory.value })
  } catch {
    listOptions.value = []
  } finally {
    loadingOptions.value = false
  }
}

const optionFormOpen = ref(false)
const optionEditing = ref(null)
const optionForm = ref({})
const optionSaving = ref(false)
const optionError = ref('')

function openOptionCreate() {
  optionEditing.value = null
  optionError.value = ''
  optionForm.value = {
    label: '', value: '',
    code_platform: currentCategory.value === 'Platform' ? 'STEAM' : '',
    icon: '', color: 'indigo', sort_order: 0, is_active: 1,
  }
  optionFormOpen.value = true
}
function openOptionEdit(o) {
  optionEditing.value = o.name
  optionError.value = ''
  optionForm.value = {
    label: o.label || '', value: o.value || '',
    code_platform: o.code_platform || '',
    icon: o.icon || '', color: o.color || 'gray',
    sort_order: o.sort_order || 0, is_active: 1,
  }
  optionFormOpen.value = true
}

async function submitOption() {
  if (!optionForm.value.label) return (optionError.value = 'Nhập nhãn')
  optionSaving.value = true
  optionError.value = ''
  try {
    const values = { ...optionForm.value, category: currentCategory.value }
    await frappeCall('gam.api.save_list_option', {
      values: JSON.stringify(values),
      name: optionEditing.value || undefined,
    })
    success('Đã lưu')
    optionFormOpen.value = false
    await loadOptions()
    loadListOptions(true) // refresh app-wide cache (forms, badges, filters)
  } catch (e) {
    optionError.value = e.message || 'Lưu thất bại'
  } finally {
    optionSaving.value = false
  }
}

const confirmState = ref({ open: false, title: '', message: '', onConfirm: null })
function runConfirm() {
  const fn = confirmState.value.onConfirm
  confirmState.value.open = false
  fn?.()
}
function deleteOption(o) {
  confirmState.value = {
    open: true,
    title: `Xoá ${currentCategory.value}`,
    message: `Xoá tuỳ chọn «${o.label}»? Các tài khoản đang dùng giá trị này sẽ giữ nguyên giá trị cũ.`,
    onConfirm: async () => {
      try {
        const res = await frappeCall('gam.api.delete_list_option', { name: o.name })
        success(res.in_use?.length
          ? `Đã xoá. Lưu ý: ${res.in_use.length} tài khoản vẫn còn giá trị "${o.value}".`
          : 'Đã xoá')
        await loadOptions()
        loadListOptions(true)
      } catch (e) {
        notifyError(e.message || 'Xoá thất bại')
      }
    },
  }
}

watch(activeTab, (v) => {
  if (LIST_CATEGORIES[v]) loadOptions()
})

onMounted(refresh)
</script>
