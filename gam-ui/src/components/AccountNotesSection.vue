<template>
  <div class="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">💬 Ghi chú cộng tác</h3>
      <span class="text-[10px] text-app-text-muted">{{ notes.length }} ghi chú</span>
    </div>

    <!-- Add note -->
    <div class="mb-5">
      <textarea
        v-model="draft" rows="2" placeholder="Viết ghi chú cho người dùng khác..."
        class="w-full px-3 py-2 rounded-xl bg-app-bg border border-app-border text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:border-indigo-600/50 text-sm resize-y"
        :disabled="saving"
      ></textarea>
      <div class="flex justify-end mt-2">
        <button
          @click="submit" :disabled="saving || !draft.trim()"
          class="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition active:scale-95 disabled:opacity-50"
        >
          {{ saving ? '...' : '+ Thêm ghi chú' }}
        </button>
      </div>
    </div>

    <LoadingSpinner v-if="loading && !notes.length" size="sm" text="Đang tải ghi chú..." />
    <p v-else-if="!notes.length" class="text-xs text-app-text-muted italic">Chưa có ghi chú nào.</p>

    <!-- Notes list -->
    <div v-else class="space-y-3">
      <div
        v-for="n in notes" :key="n.name"
        class="bg-app-bg border border-app-border rounded-xl p-4 group"
      >
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <div class="flex items-center gap-2 text-[10px] text-app-text-muted">
            <span class="font-black text-app-text-secondary">👤 {{ userName(n.note_by) }}</span>
            <span>· {{ formatDateFull(n.created_at) }}</span>
          </div>
          <button
            v-if="canDelete(n)" @click="remove(n)"
            class="text-[10px] text-red-400/70 hover:text-red-500 opacity-0 group-hover:opacity-100 transition font-black uppercase tracking-wider"
          >
            🗑 Xoá
          </button>
        </div>
        <p class="text-sm text-app-text-secondary whitespace-pre-wrap">{{ n.content }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import LoadingSpinner from './LoadingSpinner.vue'
import { frappeCall } from '../api/index.js'
import { formatDateFull, userName } from '../utils/format.js'
import { useNotify } from '../composables/useNotify.js'

defineOptions({ name: 'AccountNotesSection' })

const props = defineProps({
  accountName: { type: String, required: true },
  currentUser: { type: String, default: '' },
  isAdmin: { type: Boolean, default: false },
})

const { success, error } = useNotify()

const loading = ref(false)
const saving = ref(false)
const notes = ref([])
const draft = ref('')

async function load() {
  if (!props.accountName) return
  loading.value = true
  try {
    notes.value = await frappeCall('gam.api.get_account_notes', { account: props.accountName }) || []
  } catch (e) {
    console.error('[AccountNotesSection] load failed:', e)
    notes.value = []
  } finally {
    loading.value = false
  }
}

watch(() => props.accountName, load, { immediate: true })

async function submit() {
  const content = draft.value.trim()
  if (!content) return
  saving.value = true
  try {
    const created = await frappeCall('gam.api.add_account_note', {
      account: props.accountName,
      content,
    })
    notes.value.unshift(created)
    draft.value = ''
    success('Đã thêm ghi chú')
  } catch (e) {
    error(e.message || 'Không thể thêm ghi chú')
  } finally {
    saving.value = false
  }
}

async function remove(n) {
  try {
    await frappeCall('gam.api.delete_account_note', { name: n.name })
    notes.value = notes.value.filter((x) => x.name !== n.name)
    success('Đã xoá ghi chú')
  } catch (e) {
    error(e.message || 'Không thể xoá ghi chú')
  }
}

function canDelete(n) {
  return props.isAdmin || (props.currentUser && n.note_by === props.currentUser)
}

defineExpose({ refresh: load })
</script>
