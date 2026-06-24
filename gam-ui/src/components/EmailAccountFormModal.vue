<template>
  <ModalWrapper :model-value="modelValue" @update:model-value="close">
    <template #header>
      <div class="px-8 pt-6 pb-2">
        <h2 class="text-base font-black text-app-text-primary">{{ editing ? 'Sửa Email' : 'Thêm Email' }}</h2>
      </div>
    </template>
    <div class="px-8 pb-2 space-y-3">
      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Địa chỉ email *</label>
        <input v-model="form.address" type="email" class="w-full input-field px-3 py-2.5 text-sm" placeholder="user@example.com" :disabled="!!editing" />
        <p v-if="editing" class="text-[9px] text-app-text-muted mt-1">Không thể thay đổi địa chỉ email đã tạo.</p>
      </div>
      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Provider</label>
        <select v-model="form.provider" class="w-full input-field px-3 py-2.5 text-sm">
          <option v-for="opt in PROVIDERS" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">
            Mật khẩu email <span v-if="editing" class="normal-case opacity-50">(để trống = không đổi)</span>
          </label>
          <input v-model="form.email_password" type="password" class="w-full input-field px-3 py-2.5 text-sm" placeholder="••••••••" autocomplete="new-password" />
        </div>
        <div>
          <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">
            Mã OTP / 2FA (TOTP) <span v-if="editing" class="normal-case opacity-50">(để trống = không đổi)</span>
          </label>
          <input v-model="form.totp_secret" type="password" class="w-full input-field px-3 py-2.5 text-sm" placeholder="JBSWY3DP..." autocomplete="new-password" />
        </div>
      </div>

      <!-- Recovery emails editor -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="text-[10px] text-app-text-muted uppercase font-black tracking-widest">Email khôi phục</label>
          <button type="button" @click="addRecovery" class="text-[10px] text-indigo-600 hover:underline font-bold">+ Thêm dòng</button>
        </div>
        <div v-if="form.recovery_emails.length" class="space-y-2">
          <div v-for="(r, i) in form.recovery_emails" :key="i" class="flex items-center gap-2">
            <input v-model="r.address" type="email" placeholder="recovery@example.com" class="flex-1 input-field px-3 py-2 text-sm" />
            <input v-model="r.label" type="text" placeholder="Nhãn (tuỳ chọn)" class="w-32 input-field px-3 py-2 text-sm" />
            <button type="button" @click="removeRecovery(i)" class="text-[10px] text-red-400/80 hover:text-red-500 font-bold px-2 py-1 rounded-lg hover:bg-red-500/10 transition shrink-0">✕</button>
          </div>
        </div>
        <p v-else class="text-[10px] text-app-text-muted italic">Chưa có email khôi phục.</p>
      </div>

      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Ghi chú</label>
        <textarea v-model="form.notes" rows="2" class="w-full input-field px-3 py-2.5 text-sm" placeholder="Thông tin thêm..."></textarea>
      </div>
      <div class="flex gap-6 flex-wrap">
        <label class="flex items-center gap-2 text-[10px] text-app-text-muted uppercase font-black tracking-widest cursor-pointer">
          <input v-model="form.is_active" type="checkbox" class="w-4 h-4 accent-indigo-600" /> Hoạt động
        </label>
        <label class="flex items-center gap-2 text-[10px] text-app-text-muted uppercase font-black tracking-widest cursor-pointer">
          <input v-model="form.forward_verified" type="checkbox" class="w-4 h-4 accent-indigo-600" /> Đã xác minh forward
        </label>
      </div>
      <p v-if="formError" class="text-xs text-red-500 font-medium">{{ formError }}</p>
    </div>
    <template #footer>
      <button @click="close" class="px-5 py-2.5 rounded-xl bg-app-bg border border-app-border text-app-text-secondary hover:text-app-text-primary text-[10px] font-black uppercase tracking-widest transition">Huỷ</button>
      <button @click="submit" :disabled="formSaving" class="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2">
        <span v-if="formSaving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Lưu
      </button>
    </template>
  </ModalWrapper>
</template>

<script setup>
import { ref, watch } from 'vue'
import ModalWrapper from './ModalWrapper.vue'
import { useNotify } from '../composables/useNotify.js'
import { frappeCall } from '../api/index.js'

defineOptions({ name: 'EmailAccountFormModal' })

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** GAM Email doc name when editing, null when creating. */
  editing: { type: String, default: null },
  /** Optional email doc to prefill on edit. */
  email: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'saved'])

const { success } = useNotify()
const { error: notifyError } = useNotify()

const PROVIDERS = ['Gmail', 'Outlook', 'Hotmail', 'Proton', 'Yahoo', 'Other']

const form = ref({})
const formSaving = ref(false)
const formError = ref('')

function emptyForm() {
  return {
    address: '',
    provider: 'Gmail',
    email_password: '',
    totp_secret: '',
    recovery_emails: [],
    notes: '',
    is_active: true,
    forward_verified: false,
  }
}

function reset() {
  formError.value = ''
  if (props.editing && props.email) {
    form.value = {
      address: props.email.address || '',
      provider: props.email.provider || 'Other',
      email_password: '',
      totp_secret: '',
      recovery_emails: (props.email.recovery_emails || []).map((r) => ({ address: r.address || '', label: r.label || '' })),
      notes: props.email.notes || '',
      is_active: !!props.email.is_active,
      forward_verified: !!props.email.forward_verified,
    }
  } else {
    form.value = emptyForm()
  }
}

// Re-initialise every time the modal opens or the target email changes.
watch(() => [props.modelValue, props.editing], ([open]) => {
  if (open) reset()
}, { immediate: true })

function addRecovery() {
  form.value.recovery_emails.push({ address: '', label: '' })
}
function removeRecovery(i) {
  form.value.recovery_emails.splice(i, 1)
}

function close() {
  if (formSaving.value) return
  emit('update:modelValue', false)
}

async function submit() {
  if (!form.value.address || !form.value.address.includes('@')) {
    formError.value = 'Nhập địa chỉ email hợp lệ'
    return
  }
  formSaving.value = true
  formError.value = ''
  try {
    const values = {
      address: form.value.address,
      provider: form.value.provider,
      notes: form.value.notes || '',
      is_active: form.value.is_active ? 1 : 0,
      forward_verified: form.value.forward_verified ? 1 : 0,
      // Full replace of the child table so add/remove persists.
      recovery_emails: form.value.recovery_emails,
    }
    if (form.value.email_password) values.email_password = form.value.email_password
    if (form.value.totp_secret) values.totp_secret = form.value.totp_secret
    const res = await frappeCall('gam.api.save_email_account', {
      values: JSON.stringify(values),
      name: props.editing || undefined,
    })
    success(props.editing ? 'Đã lưu' : 'Đã tạo')
    emit('update:modelValue', false)
    emit('saved', res)
  } catch (e) {
    formError.value = e.message || 'Lưu thất bại'
    notifyError(e.message || 'Lưu thất bại')
  } finally {
    formSaving.value = false
  }
}
</script>
