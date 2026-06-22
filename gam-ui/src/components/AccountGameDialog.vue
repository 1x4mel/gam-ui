<template>
  <ModalWrapper :model-value="true" size="md" persistent @update:model-value="$emit('close')">
    <template #header>
      <div class="px-8 pt-8 pb-4 flex items-center justify-between">
        <h3 class="text-lg font-black text-app-text-primary uppercase tracking-tight">🎮 Thêm Game</h3>
        <button @click="$emit('close')" class="text-app-text-muted hover:text-app-text-primary p-1">✕</button>
      </div>
    </template>

    <div class="px-8 pb-2 space-y-4">
      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Game *</label>
        <SearchableSelect v-model="form.game" :options="gameOptions" placeholder="Chọn game" @update:model-value="onGameChange" />
      </div>

      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Role *</label>
        <select v-model="form.role" class="w-full input-field px-3 py-2.5 text-sm">
          <option value="">— Chọn role —</option>
          <option v-for="r in roleOptions" :key="r.value" :value="r.value">{{ r.label }}</option>
        </select>
      </div>

      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Server</label>
        <SearchableSelect v-model="form.server" :options="serverOptions" placeholder="Chọn server (optional)" clearable />
      </div>

      <div v-if="dlcOptions.length">
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">DLC</label>
        <div class="flex flex-wrap gap-1.5">
          <label
            v-for="d in dlcOptions" :key="d.value"
            class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer transition"
            :class="form.dlcs.includes(d.value) ? 'bg-indigo-600/15 border-indigo-600/40 text-indigo-400' : 'border-app-border text-app-text-secondary hover:border-indigo-600/30'"
          >
            <input type="checkbox" :value="d.value" v-model="form.dlcs" class="w-3 h-3 accent-indigo-600" />
            {{ d.label }}
          </label>
        </div>
      </div>

      <label class="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" v-model="form.is_main" class="w-4 h-4 rounded accent-indigo-600" />
        <span class="text-sm text-app-text-secondary font-medium">★ Game chính (Main)</span>
      </label>

      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Ghi chú</label>
        <input v-model="form.notes" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="Optional" />
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
        @click="submit" :disabled="saving || !form.game"
        class="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2"
      >
        <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
        Thêm
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

const props = defineProps({ accountName: { type: String, required: true } })
const emit = defineEmits(['close', 'saved'])

const { games, servers, roleOptions, dlcsForGame, load } = useGamMetadata()
const { success } = useNotify()

const form = ref({ game: '', role: '', server: '', is_main: 0, notes: '', dlcs: [] })
const saving = ref(false)
const error = ref('')

const gameOptions = computed(() => games.value.map(g => ({ value: g.name, label: g.game_name, description: g.publisher })))
const serverOptions = computed(() => {
  if (!form.value.game) return []
  return servers.value.filter(s => s.game === form.value.game).map(s => ({ value: s.name, label: s.region, description: s.game }))
})
const dlcOptions = computed(() => {
  if (!form.value.game) return []
  return dlcsForGame(form.value.game).map(d => ({ value: d.name, label: d.dlc_name }))
})
function onGameChange() {
  // reset server and drop DLCs that no longer belong to the newly picked game
  form.value.server = ''
  const valid = new Set(dlcsForGame(form.value.game).map(d => d.name))
  form.value.dlcs = form.value.dlcs.filter(d => valid.has(d))
}

async function submit() {
  if (!form.value.game) {
    error.value = 'Vui lòng chọn game'
    return
  }
  if (!form.value.role) {
    error.value = 'Vui lòng chọn role cho game'
    return
  }
  saving.value = true
  error.value = ''
  try {
    await frappeCall('gam.api.add_account_role_game', {
      account: props.accountName,
      role: form.value.role,
      game: form.value.game,
      server: form.value.server || undefined,
      is_main: form.value.is_main ? 1 : 0,
      notes: form.value.notes || undefined,
      dlcs: form.value.dlcs && form.value.dlcs.length ? JSON.stringify(form.value.dlcs) : undefined,
    })
    success('Đã thêm game')
    emit('saved')
  } catch (e) {
    error.value = e.message || 'Thêm game thất bại'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
