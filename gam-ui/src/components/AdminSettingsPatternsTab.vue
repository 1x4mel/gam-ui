<template>
  <!--
    AdminSettingsPatternsTab — the "Code Patterns" tab embedded inside
    AdminSettingsView. Extracted from the former standalone CodePatternsView so
    the rules that recognise + extract email codes (which are tightly coupled to
    the Game/Platform config in the same Settings hub) live one click away.

    Stateless layout: the parent supplies the PageHeader + scroll container, so
    this component renders only its body (list + test panel + modal).
  -->
  <div class="pb-8">
    <div class="flex justify-end mb-3 px-1">
      <button @click="openCreate" class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition">+ Thêm Pattern</button>
    </div>
    <LoadingSpinner v-if="loading" size="md" />
    <EmptyState v-else-if="!patterns.length" icon="🧩" text="Chưa có pattern nào" subtext="Thêm quy tắc để hệ thống nhận diện + trích mã theo từng game." />
    <div v-else class="space-y-2">
      <div v-for="p in patterns" :key="p.name" class="bg-app-surface border border-app-border rounded-2xl p-4">
        <div class="flex items-center gap-3">
          <span class="text-xl">🧩</span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-black text-app-text-primary text-sm">{{ p.platform }}</span>
              <span v-if="p.game" class="text-[10px] text-indigo-400 font-bold">🎮 {{ gameName(p.game) }}</span>
              <span v-if="!p.is_active" class="text-[9px] uppercase font-black text-app-text-muted bg-app-bg px-1.5 py-0.5 rounded">tắt</span>
            </div>
            <p class="text-[10px] text-app-text-muted mt-0.5 font-mono truncate">{{ p.sender_pattern || '(không lọc sender)' }}</p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button @click="openEdit(p)" class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition">Sửa</button>
            <button @click="toggleActive(p)" class="text-[10px] text-app-text-muted hover:text-indigo-600 font-bold px-2 py-1 rounded-lg hover:bg-app-bg transition">{{ p.is_active ? 'Tắt' : 'Bật' }}</button>
            <button @click="remove(p)" class="text-[10px] text-red-400/80 hover:text-red-500 font-bold px-2 py-1 rounded-lg hover:bg-red-500/10 transition">Xoá</button>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-[10px]">
          <div v-if="p.subject_keywords" class="bg-app-bg rounded-lg p-2">
            <p class="text-app-text-muted uppercase font-black tracking-widest mb-0.5">Từ khoá subject</p>
            <p class="text-app-text-secondary break-words">{{ p.subject_keywords }}</p>
          </div>
          <div class="bg-app-bg rounded-lg p-2">
            <p class="text-app-text-muted uppercase font-black tracking-widest mb-0.5">Code regex</p>
            <p class="text-app-text-secondary font-mono break-all">{{ p.code_regex }}</p>
          </div>
          <div class="bg-app-bg rounded-lg p-2 flex gap-4">
            <span><span class="text-app-text-muted">TTL:</span> {{ p.ttl_minutes }}ph</span>
            <span><span class="text-app-text-muted">Ưu tiên:</span> {{ p.priority }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════ Test panel ═══════════════════════ -->
    <div class="mt-6 bg-app-surface border border-app-border rounded-2xl p-4">
      <div class="flex items-center gap-2 mb-3">
        <span class="text-base">🧪</span>
        <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">Test pattern</h3>
        <span class="text-[10px] text-app-text-muted">— dán email mẫu để xem pattern nào khớp & mã trích được</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">From (người gửi)</label>
          <input v-model="test.from" type="text" class="w-full input-field px-3 py-2.5 text-sm font-mono" placeholder="noreply@steampowered.com" />
        </div>
        <div>
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Subject (tiêu đề)</label>
          <input v-model="test.subject" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="Steam Guard Code" />
        </div>
      </div>
      <div class="mt-2">
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Body (nội dung email)</label>
        <textarea v-model="test.body" rows="3" class="w-full input-field px-3 py-2.5 text-sm font-mono resize-y" placeholder="Your Steam Guard code is ABC12 …"></textarea>
      </div>
      <div class="flex justify-end mt-2">
        <button @click="runTest" :disabled="testing" class="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2">
          <span v-if="testing" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Chạy test
        </button>
      </div>
      <div v-if="testResult" class="mt-3 rounded-xl p-3" :class="testResult.matched ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/30'">
        <template v-if="testResult.matched">
          <p class="text-[10px] uppercase font-black tracking-widest text-emerald-600 mb-1">✓ Khớp</p>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span class="text-app-text-secondary">Platform: <span class="font-black text-app-text-primary">{{ testResult.platform || '—' }}</span></span>
            <span class="text-app-text-secondary">Mã: <span class="font-mono font-black text-emerald-600">{{ testResult.code || '—' }}</span></span>
            <span class="text-app-text-secondary">Pattern: <span class="font-mono text-app-text-primary">{{ testResult.pattern_name }}</span></span>
          </div>
        </template>
        <template v-else>
          <p class="text-[10px] uppercase font-black tracking-widest text-amber-600 mb-1">✗ Không khớp pattern nào</p>
          <p class="text-xs text-app-text-secondary">Platform phát hiện (nếu có): <span class="font-bold text-app-text-primary">{{ testResult.detected_platform || '—' }}</span></p>
        </template>
      </div>
      <p v-if="testError" class="mt-2 text-xs text-red-500 font-medium">{{ testError }}</p>
    </div>

    <ModalWrapper :model-value="formOpen" @update:model-value="formOpen = false">
      <template #header>
        <div class="px-8 pt-6 pb-2">
          <h2 class="text-base font-black text-app-text-primary">{{ editing ? 'Sửa Pattern' : 'Thêm Pattern' }}</h2>
        </div>
      </template>
      <div class="px-8 pb-2 space-y-3">
        <div>
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Platform *</label>
          <select v-model="form.platform" class="w-full input-field px-3 py-2.5 text-sm">
            <option v-for="opt in PLATFORMS" :key="opt" :value="opt">{{ opt }}</option>
          </select>
        </div>
        <div>
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Game (tuỳ chọn)</label>
          <SearchableSelect v-model="form.game" :options="gameOptions" placeholder="Chọn game liên quan" />
        </div>
        <div>
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Sender pattern (regex) *</label>
          <input v-model="form.sender_pattern" type="text" class="w-full input-field px-3 py-2.5 text-sm font-mono" placeholder="@grindinggear\.com" />
        </div>
        <div>
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Từ khoá subject (cách nhau bởi dấu phẩy)</label>
          <input v-model="form.subject_keywords" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="code,verification,login" />
        </div>
        <div>
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Code regex (nhóm 1 = mã) *</label>
          <input v-model="form.code_regex" type="text" class="w-full input-field px-3 py-2.5 text-sm font-mono" placeholder="([0-9A-Za-z]{3}-[0-9A-Za-z]{3}-[0-9A-Za-z]{4})" />
          <p class="text-[9px] text-app-text-muted mt-1">Regex chạy trên body email. Dùng dấu ngoặc () để bọc phần mã cần trích xuất.</p>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">TTL (phút)</label>
            <input v-model.number="form.ttl_minutes" type="number" min="1" class="w-full input-field px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Ưu tiên</label>
            <input v-model.number="form.priority" type="number" class="w-full input-field px-3 py-2.5 text-sm" />
          </div>
          <div class="flex items-end">
            <label class="flex items-center gap-2 text-[10px] text-app-text-muted uppercase font-black tracking-widest cursor-pointer">
              <input v-model="form.is_active" type="checkbox" class="w-4 h-4 accent-indigo-600" /> Hoạt động
            </label>
          </div>
        </div>
        <p v-if="formError" class="text-xs text-red-500 font-medium">{{ formError }}</p>
      </div>
      <template #footer>
        <button @click="formOpen = false" class="px-5 py-2.5 rounded-xl bg-app-bg border border-app-border text-app-text-secondary hover:text-app-text-primary text-[10px] font-black uppercase tracking-widest transition">Huỷ</button>
        <button @click="submit" :disabled="formSaving" class="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2">
          <span v-if="formSaving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Lưu
        </button>
      </template>
    </ModalWrapper>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import LoadingSpinner from './LoadingSpinner.vue'
import EmptyState from './EmptyState.vue'
import ModalWrapper from './ModalWrapper.vue'
import SearchableSelect from './SearchableSelect.vue'
import { useNotify } from '../composables/useNotify.js'
import { getList, createDoc, updateDoc, deleteDoc, frappeCall } from '../api/index.js'

defineOptions({ name: 'AdminSettingsPatternsTab' })

// `games` is shared from the parent (AdminSettingsView already loads the full
// GAM Game list for its Game & DLC tab). When not supplied, the tab falls back
// to loading its own copy so it stays usable standalone.
const props = defineProps({
  games: { type: Array, default: () => [] },
})

const { success, error: notifyError } = useNotify()

const PLATFORMS = ['STEAM', 'BATTLENET', 'POE', 'OTHER']

const patterns = ref([])
const localGames = ref([])
const loading = ref(false)

// Prefer the shared games prop; fall back to the locally fetched list.
const resolvedGames = computed(() => (props.games && props.games.length ? props.games : localGames.value))

const gameOptions = computed(() => [
  { value: '', label: '(không)' },
  ...resolvedGames.value.map((g) => ({ value: g.name, label: g.game_name })),
])
function gameName(link) {
  if (!link) return ''
  return resolvedGames.value.find((g) => g.name === link)?.game_name || link
}

async function load() {
  loading.value = true
  try {
    const fetches = [
      getList('GAM Code Pattern', {
        fields: ['name', 'platform', 'game', 'sender_pattern', 'subject_keywords', 'code_regex', 'ttl_minutes', 'priority', 'is_active'],
        limit: 500,
        order_by: 'priority desc',
      }),
    ]
    // Only fetch games locally when the parent didn't provide them.
    if (!props.games || !props.games.length) {
      fetches.push(getList('GAM Game', { fields: ['name', 'game_name'], limit: 500, order_by: 'game_name asc' }))
    }
    const [p, g] = await Promise.all(fetches)
    patterns.value = p
    if (g) localGames.value = g
  } catch {
    patterns.value = []
  } finally {
    loading.value = false
  }
}

async function toggleActive(p) {
  try {
    await updateDoc('GAM Code Pattern', p.name, { is_active: p.is_active ? 0 : 1 })
    p.is_active = p.is_active ? 0 : 1
    success('Đã cập nhật')
  } catch (e) {
    notifyError(e.message || 'Cập nhật thất bại')
  }
}

async function remove(p) {
  if (!confirm(`Xoá pattern "${p.platform}" (${p.sender_pattern})?`)) return
  try {
    await deleteDoc('GAM Code Pattern', p.name)
    success('Đã xoá')
    load()
  } catch (e) {
    notifyError(e.message || 'Xoá thất bại')
  }
}

// ---- Create / edit form ----
const formOpen = ref(false)
const editing = ref(null) // pattern name when editing, null when creating
const form = ref({})
const formSaving = ref(false)
const formError = ref('')

function emptyForm() {
  return { platform: 'STEAM', game: '', sender_pattern: '', subject_keywords: '', code_regex: '', ttl_minutes: 15, priority: 0, is_active: true }
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
    platform: p.platform,
    game: p.game || '',
    sender_pattern: p.sender_pattern || '',
    subject_keywords: p.subject_keywords || '',
    code_regex: p.code_regex || '',
    ttl_minutes: p.ttl_minutes ?? 15,
    priority: p.priority ?? 0,
    is_active: !!p.is_active,
  }
  formOpen.value = true
}

async function submit() {
  if (!form.value.sender_pattern) return (formError.value = 'Nhập sender pattern (regex)')
  if (!form.value.code_regex) return (formError.value = 'Nhập code regex')
  formSaving.value = true
  formError.value = ''
  try {
    const payload = {
      platform: form.value.platform,
      sender_pattern: form.value.sender_pattern,
      code_regex: form.value.code_regex,
      ttl_minutes: form.value.ttl_minutes || 15,
      priority: form.value.priority || 0,
      is_active: form.value.is_active ? 1 : 0,
    }
    if (form.value.game) payload.game = form.value.game
    if (form.value.subject_keywords) payload.subject_keywords = form.value.subject_keywords
    if (editing.value) {
      await updateDoc('GAM Code Pattern', editing.value, payload)
      success('Đã lưu')
    } else {
      await createDoc('GAM Code Pattern', payload)
      success('Đã tạo')
    }
    formOpen.value = false
    load()
  } catch (e) {
    formError.value = e.message || 'Lưu thất bại'
  } finally {
    formSaving.value = false
  }
}

// ---- Test pattern panel ----
const test = ref({ from: '', subject: '', body: '' })
const testing = ref(false)
const testResult = ref(null)
const testError = ref('')

async function runTest() {
  testing.value = true
  testError.value = ''
  testResult.value = null
  try {
    testResult.value = await frappeCall('gam.api.test_code_pattern', {
      sender: test.value.from,
      subject: test.value.subject,
      body: test.value.body,
    })
  } catch (e) {
    testError.value = e.message || 'Test thất bại'
  } finally {
    testing.value = false
  }
}

// Allow the parent's PageHeader "refresh" button to reload patterns too.
defineExpose({ reload: load })

onMounted(load)
</script>
