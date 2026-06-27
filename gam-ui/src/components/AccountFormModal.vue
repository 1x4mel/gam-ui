<template>
  <ModalWrapper :model-value="true" size="lg" persistent @update:model-value="$emit('close')">
    <template #header>
      <div class="px-8 pt-8 pb-4 flex items-center justify-between">
        <h3 class="text-lg font-black text-app-text-primary uppercase tracking-tight">
          {{ isEdit ? 'Sửa Tài khoản' : 'Thêm Tài khoản' }}
        </h3>
        <button @click="$emit('close')" class="text-app-text-muted hover:text-app-text-primary p-1">✕</button>
      </div>
    </template>

    <div class="px-8 pb-2 space-y-4">
      <!-- Platform -->
      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Platform *</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="p in platformOptions" :key="p.value" @click="form.platform = p.value"
            class="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition flex items-center gap-1.5"
            :class="form.platform === p.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-app-bg text-app-text-secondary border-app-border hover:border-indigo-600/40'"
          >
            <span>{{ p.icon }}</span>
            <span>{{ p.label }}</span>
          </button>
        </div>
      </div>

      <!-- Username -->
      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Username *</label>
        <input
          v-model="form.username" type="text"
          class="w-full input-field px-3 py-2.5 text-sm" placeholder="Tên đăng nhập"
        />
      </div>

      <!-- Password -->
      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">
          Mật khẩu <span v-if="isEdit" class="normal-case font-medium opacity-50">(để trống nếu không đổi)</span>
        </label>
        <input
          v-model="form.account_password" type="text"
          class="w-full input-field px-3 py-2.5 text-sm font-mono" placeholder="••••••••"
        />
      </div>

      <!-- TOTP -->
      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">
          2FA / TOTP secret <span v-if="isEdit" class="normal-case font-medium opacity-50">(để trống nếu không đổi)</span>
        </label>
        <input
          v-model="form.totp_secret" type="text"
          class="w-full input-field px-3 py-2.5 text-sm font-mono" placeholder="Secret key (optional)"
        />
      </div>

      <!-- IGN / Btag — game-account-only fields (only shown when this node is a GAME account). -->
      <div v-if="isGameNode" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">IGN</label>
          <input
            v-model="form.ign" type="text"
            class="w-full input-field px-3 py-2.5 text-sm" placeholder="In-Game Name"
          />
        </div>
        <div>
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Btag</label>
          <input
            v-model="form.btag" type="text"
            class="w-full input-field px-3 py-2.5 text-sm" placeholder="Name#1234"
          />
        </div>
      </div>

      <!-- Email -->
      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Email liên kết *</label>
        <SearchableSelect v-model="form.email" :options="emailOptions" placeholder="Chọn email" clearable />
      </div>

      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Trạng thái</label>
        <select v-model="form.status" class="w-full input-field px-3 py-2.5 text-sm">
          <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
        </select>
      </div>

      <!-- Source -->
      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Nguồn</label>
        <input v-model="form.source" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="Shop A" />
      </div>

      <!-- Notes -->
      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Ghi chú</label>
        <textarea v-model="form.notes" rows="2" class="w-full input-field px-3 py-2.5 text-sm" placeholder="Ghi chú (optional)"></textarea>
      </div>

      <!-- Games (repeatable: game + server + is_main + DLCs) -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest">Games</label>
          <button
            type="button" @click="addGameRow"
            class="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 text-[10px] font-black uppercase tracking-wider hover:bg-indigo-500/20 transition"
          >
            ＋ Game
          </button>
        </div>
        <div class="space-y-3">
          <div
            v-for="(row, idx) in form.games" :key="idx"
            class="rounded-xl border border-app-border bg-app-bg p-3 space-y-2.5"
          >
            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <span class="block text-[10px] text-app-text-muted font-bold mb-1">Game</span>
                <SearchableSelect
                  v-model="row.game" :options="gameOptions" placeholder="Chọn game"
                  compact @update:model-value="onGameChange(row)"
                />
              </div>
              <div>
                <span class="block text-[10px] text-app-text-muted font-bold mb-1">Role *</span>
                <select v-model="row.role" class="w-full input-field px-3 py-2 text-sm">
                  <option value="">— Chọn role —</option>
                  <option v-for="r in roleOptions" :key="r.value" :value="r.value">{{ r.label }}</option>
                </select>
              </div>
            </div>
            <div v-if="row.game">
              <span class="block text-[10px] text-app-text-muted font-bold mb-1">Server</span>
              <SearchableSelect v-model="row.server" :options="serverOptionsFor(row)" placeholder="(optional)" clearable compact />
            </div>
            <div v-if="dlcOptionsFor(row).length" class="flex flex-wrap gap-1.5">
              <label
                v-for="d in dlcOptionsFor(row)" :key="d.value"
                class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer transition"
                :class="row.dlcs.includes(d.value) ? 'bg-indigo-600/15 border-indigo-600/40 text-indigo-400' : 'border-app-border text-app-text-secondary hover:border-indigo-600/30'"
              >
                <input type="checkbox" :value="d.value" v-model="row.dlcs" class="w-3 h-3 accent-indigo-600" />
                {{ d.label }}
              </label>
            </div>
            <div class="flex items-center gap-3">
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" :checked="!!row.is_main" @change="setMain(idx, $event.target.checked)" class="w-3.5 h-3.5 accent-indigo-600" />
                <span class="text-[10px] font-black text-app-text-secondary">★ MAIN</span>
              </label>
              <input v-model="row.notes" type="text" class="flex-1 input-field px-2.5 py-1.5 text-xs" placeholder="Ghi chú game (optional)" />
              <button
                type="button" @click="removeGameRow(idx)"
                class="text-[10px] text-red-400/80 hover:text-red-500 font-bold px-1.5 py-1 rounded-lg hover:bg-red-500/10 transition"
              >
                ✕
              </button>
            </div>
          </div>
          <p v-if="!form.games.length" class="text-[11px] text-app-text-muted italic">Chưa có game. Bấm “＋ Game” để gán game / server / DLC.</p>
        </div>
      </div>

      <p v-if="error" class="text-xs text-red-500 font-medium">{{ error }}</p>
    </div>

    <template #footer>
      <button
        @click="$emit('close')"
        class="px-5 py-2.5 rounded-xl bg-app-bg border border-app-border text-app-text-secondary hover:text-app-text-primary text-[10px] font-black uppercase tracking-widest transition"
      >
        Huỷ
      </button>
      <button
        @click="submit" :disabled="saving || !form.platform || !form.username"
        class="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2"
      >
        <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
        {{ isEdit ? 'Cập nhật' : 'Lưu' }}
      </button>
    </template>
  </ModalWrapper>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import ModalWrapper from './ModalWrapper.vue'
import SearchableSelect from './SearchableSelect.vue'
import { useGamMetadata } from '../composables/useGamMetadata.js'
import { useNotify } from '../composables/useNotify.js'
import { frappeCall } from '../api/index.js'

const props = defineProps({
  account: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])

const { platformOptions, statusOptions, roleOptions, emails, games, serversForGame, dlcsForGame, load } = useGamMetadata()
const { success, error: notifyError } = useNotify()

const isEdit = computed(() => !!props.account?.name)

const isGameNode = computed(() => (props.account?.account_level || 'GAME') === 'GAME')

const form = ref({
  platform: props.account?.platform || 'STEAM',
  username: props.account?.username || '',
  account_password: '',
  totp_secret: '',
  email: props.account?.email || '',
  source: props.account?.source || '',
  status: props.account?.status || 'ACTIVE',
  notes: props.account?.notes || '',
  ign: props.account?.ign || '',
  btag: props.account?.btag || '',
  games: (props.account?.role_games || []).map(g => ({
    game: g.game || '',
    role: g.role || '',
    server: g.server || '',
    is_main: g.is_main ? 1 : 0,
    notes: g.notes || '',
    dlcs: (g.dlcs || []).map(d => d.dlc).filter(Boolean),
  })),
})

const saving = ref(false)
const error = ref('')

const emailOptions = computed(() =>
  emails.value.map(e => ({ value: e.name, label: e.address, description: e.provider }))
)

// ---- Games child rows ----
const gameOptions = computed(() => games.value.map(g => ({ value: g.name, label: g.game_name, description: g.publisher })))
function serverOptionsFor(row) {
  if (!row.game) return []
  return serversForGame(row.game).map(s => ({ value: s.name, label: s.server_name || s.name }))
}
function dlcOptionsFor(row) {
  if (!row.game) return []
  return dlcsForGame(row.game).map(d => ({ value: d.name, label: d.dlc_name }))
}
function addGameRow() {
  form.value.games.push({ game: '', role: '', server: '', is_main: 0, notes: '', dlcs: [] })
}
function removeGameRow(idx) {
  form.value.games.splice(idx, 1)
}
function setMain(idx, checked) {
  form.value.games.forEach((r, i) => { r.is_main = (i === idx && checked) ? 1 : 0 })
}
function onGameChange(row) {
  // reset server and drop DLCs that no longer belong to the newly picked game
  row.server = ''
  const valid = new Set(dlcsForGame(row.game).map(d => d.name))
  row.dlcs = row.dlcs.filter(d => valid.has(d))
}

async function submit() {
  if (!form.value.platform || !form.value.username || !form.value.email) {
    error.value = 'Vui lòng điền platform, username và email'
    return
  }
  // one role per (account, game): every game row must carry a role
  const rows = (form.value.games || []).filter(r => r.game)
  const missingRole = rows.find(r => !r.role)
  if (missingRole) {
    error.value = 'Mỗi game phải được gán role (Trader / Booster / Item ...)'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const payload = { ...form.value }
    // Preserve the account's tier on edit (PLATFORM stays PLATFORM, GAME stays
    // GAME). Without this, save_account defaults account_level to GAME and would
    // silently downgrade a PLATFORM node when edited through this modal.
    payload.account_level = props.account?.account_level || 'GAME'
    delete payload.role
    // drop empty password fields so Frappe doesn't store/overwrite blanks
    if (!payload.account_password) delete payload.account_password
    if (!payload.totp_secret) delete payload.totp_secret
    if (!payload.notes) delete payload.notes
    delete payload.games
    // build first-class (role, game) binding payload
    const roleGamesPayload = rows.map(r => ({
      game: r.game,
      role: r.role,
      server: r.server || undefined,
      is_main: r.is_main ? 1 : 0,
      notes: r.notes || undefined,
      dlcs: (r.dlcs || []).filter(Boolean),
    }))
    // edit => always send (replace/clear); create => only when non-empty
    if (isEdit.value || roleGamesPayload.length) payload.role_games = roleGamesPayload
    else delete payload.role_games
    const args = { values: JSON.stringify(payload) }
    if (isEdit.value) args.name = props.account.name
    const res = await frappeCall('gam.api.save_account', args)
    success(isEdit.value ? 'Đã cập nhật tài khoản' : 'Đã tạo tài khoản')
    emit('saved', res.name)
  } catch (e) {
    error.value = e.message || 'Lưu tài khoản thất bại'
    notifyError(error.value)
  } finally {
    saving.value = false
  }
}

// Force-refresh reference data on open so a game/email created moments ago
// (e.g. via the Games admin page or a REST seed) is immediately pickable —
// `load()` is otherwise cached module-level from the AppLayout boot, which a
// client-side route into the form (no full reload) would leave stale.
onMounted(() => load(true))
</script>
