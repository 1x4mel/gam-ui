<template>
  <ModalWrapper :model-value="true" size="md" persistent @update:model-value="$emit('close')">
    <template #header>
      <div class="px-8 pt-8 pb-4 flex items-center justify-between">
        <h3 class="text-lg font-black text-app-text-primary uppercase tracking-tight">🔗 Thêm Liên kết</h3>
        <button @click="$emit('close')" class="text-app-text-muted hover:text-app-text-primary p-1">✕</button>
      </div>
    </template>

    <div class="px-8 pb-2 space-y-4">
      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Tài khoản đích *</label>
        <SearchableSelect v-model="form.target_account" :options="accountOptions" placeholder="Chọn tài khoản" />
      </div>

      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Loại liên kết</label>
        <input v-model="form.link_type" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="VD: STEAM_TO_BNET" />
      </div>

      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Ngày hết hạn</label>
        <input v-model="form.expiry_date" type="datetime-local" class="w-full input-field px-3 py-2.5 text-sm" />
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
        @click="submit" :disabled="saving || !form.target_account"
        class="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2"
      >
        <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
        Liên kết
      </button>
    </template>
  </ModalWrapper>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import ModalWrapper from './ModalWrapper.vue'
import SearchableSelect from './SearchableSelect.vue'
import { useNotify } from '../composables/useNotify.js'
import { getList, createDoc } from '../api/index.js'

const props = defineProps({ accountName: { type: String, required: true } })
const emit = defineEmits(['close', 'saved'])

const { success } = useNotify()

const form = ref({ target_account: '', link_type: '', expiry_date: '' })
const saving = ref(false)
const error = ref('')
const accountOptions = ref([])

async function loadAccounts() {
  try {
    const list = await getList('GAM Account', {
      fields: ['name', 'platform', 'username', 'status'],
      filters: [['status', '=', 'ACTIVE'], ['name', '!=', props.accountName]],
      limit: 300,
      order_by: 'username asc',
    })
    accountOptions.value = list.map(a => ({ value: a.name, label: a.username, description: a.platform }))
  } catch {
    accountOptions.value = []
  }
}

async function submit() {
  if (!form.value.target_account) {
    error.value = 'Vui lòng chọn tài khoản đích'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const values = {
      source_account: props.accountName,
      target_account: form.value.target_account,
      link_type: form.value.link_type || undefined,
      status: 'ACTIVE',
    }
    if (form.value.expiry_date) values.expiry_date = form.value.expiry_date
    await createDoc('GAM Account Link', values)
    success('Đã tạo liên kết')
    emit('saved')
  } catch (e) {
    error.value = e.message || 'Tạo liên kết thất bại'
  } finally {
    saving.value = false
  }
}

onMounted(loadAccounts)
</script>
