<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" @click.self="$emit('close')">
    <div class="bg-app-surface border border-app-border rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

      <!-- Header -->
      <div class="px-8 py-6 border-b border-app-border flex justify-between items-center bg-app-bg/50">
        <div class="flex items-center gap-3">
          <div v-if="isEdit" class="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-sm font-black text-indigo-600">{{ avatarInitials }}</div>
          <div v-else class="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-lg">+</div>
          <h3 class="text-app-text-primary font-black text-lg uppercase tracking-tight">{{ isEdit ? 'Cập nhật' : 'Người dùng mới' }}</h3>
        </div>
        <button @click="$emit('close')" class="text-app-text-muted hover:text-app-text-primary transition p-2 hover:bg-app-bg rounded-xl text-xl">✕</button>
      </div>

      <!-- Success Panel (after create) -->
      <div v-if="showSuccess" class="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-5">
        <div class="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-3xl">✓</div>
        <h4 class="text-app-text-primary font-black text-lg">Đã tạo người dùng thành công!</h4>
        <p class="text-app-text-muted text-sm font-mono">{{ createdEmail }}</p>
        <div class="w-full bg-app-bg border border-app-border rounded-xl p-4 flex items-center justify-between gap-3">
          <code class="font-mono text-lg font-bold text-indigo-600 tracking-wider">{{ createdPassword }}</code>
          <button @click="copyPassword" class="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all" :class="copied ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'">
            {{ copied ? 'Đã copy!' : 'Copy' }}
          </button>
        </div>
        <p class="text-red-500 text-[10px] font-black uppercase tracking-widest">Mật khẩu chỉ hiển thị lần này. Vui lòng copy trước khi đóng.</p>
        <AppButton variant="primary" size="sm" @click="$emit('close')">Đóng</AppButton>
      </div>

      <!-- Form -->
      <template v-else>
        <div class="flex-1 overflow-y-auto p-8 space-y-5">
          <!-- Error -->
          <div v-if="error" class="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-500 font-bold">{{ error }}</div>

          <!-- Email -->
          <div>
            <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Email <span class="text-red-500">*</span></label>
            <input v-model="form.email" type="email" class="input-field !py-2.5 text-sm" placeholder="email@example.com" :disabled="isEdit" required />
          </div>

          <!-- Name -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Họ <span class="text-red-500">*</span></label>
              <input v-model="form.first_name" type="text" class="input-field !py-2.5 text-sm" placeholder="Họ" required />
            </div>
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Tên</label>
              <input v-model="form.last_name" type="text" class="input-field !py-2.5 text-sm" placeholder="Tên" />
            </div>
          </div>

          <!-- Roles -->
          <div>
            <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-2 block">Vai trò <span class="text-red-500">*</span></label>
            <div class="space-y-1.5">
              <label v-for="role in availableRoles" :key="role" class="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border" :class="form.roles.includes(role) ? 'bg-indigo-500/5 border-indigo-600/30' : 'bg-app-bg/50 border-app-border/40 hover:border-indigo-600/20'">
                <input type="checkbox" :value="role" v-model="form.roles" class="accent-indigo-600 w-4 h-4" />
                <div class="flex-1">
                  <span class="text-sm text-app-text-primary font-medium">{{ roleLabel(role) }}</span>
                </div>
                <span class="text-[9px] font-bold px-2 py-0.5 rounded-full" :class="roleBadgeClass(role)">{{ role }}</span>
              </label>
            </div>
          </div>

          <!-- Enabled (edit only) -->
          <div v-if="isEdit" class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-app-bg/50 border border-app-border/40">
            <input type="checkbox" v-model="form.enabled" class="accent-indigo-600 w-4 h-4" />
            <span class="text-sm text-app-text-primary font-medium">Hoạt động</span>
            <div class="flex-1" />
            <span class="text-[10px] font-bold px-2.5 py-1 rounded-full" :class="form.enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-400'">
              {{ form.enabled ? 'Bật' : 'Tắt' }}
            </span>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-8 py-5 border-t border-app-border flex justify-end gap-3">
          <button @click="$emit('close')" class="px-5 py-2 rounded-xl text-sm font-bold text-app-text-muted hover:text-app-text-primary hover:bg-app-bg transition">Hủy</button>
          <AppButton variant="primary" size="sm" :loading="saving" @click="save">
            {{ isEdit ? 'Cập nhật' : 'Tạo người dùng' }}
          </AppButton>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { getDoc, createDoc, updateDoc } from '../api/index.js'
import { useNotify } from '../composables/useNotify.js'
import AppButton from './AppButton.vue'

const props = defineProps({
  isOpen: Boolean,
  userEmail: { type: String, default: null },
})
const emit = defineEmits(['close', 'saved'])

const { success, error: notifyError } = useNotify()

const availableRoles = [
  'Trader1', 'Trader2',
  'Payment Accountant', 'Management Accountant', 'Chief Accountant',
  'Ops Manager',
]

const roleLabels = {
  'Trader1': 'Trader 1',
  'Trader2': 'Trader 2',
  'Payment Accountant': 'Kế toán thanh toán',
  'Management Accountant': 'Kế toán vận hành',
  'Chief Accountant': 'Kế toán trưởng',
  'Ops Manager': 'Vận hành',
}

const isEdit = computed(() => !!props.userEmail)

const avatarInitials = computed(() => {
  const f = form.value.first_name || ''
  const l = form.value.last_name || ''
  if (f && l) return (f[0] + l[0]).toUpperCase()
  if (f) return f[0].toUpperCase()
  return '?'
})

const form = ref({ email: '', first_name: '', last_name: '', roles: [], enabled: true })
const saving = ref(false)
const error = ref('')
const showSuccess = ref(false)
const createdEmail = ref('')
const createdPassword = ref('')
const copied = ref(false)

watch(() => props.isOpen, async (open) => {
  error.value = ''
  showSuccess.value = false
  copied.value = false
  if (!open) return

  if (props.userEmail) {
    try {
      const doc = await getDoc('User', props.userEmail)
      form.value = {
        email: doc.email,
        first_name: doc.first_name || '',
        last_name: doc.last_name || '',
        roles: (doc.roles || []).map(r => r.role).filter(r => availableRoles.includes(r)),
        enabled: doc.enabled !== 0,
      }
    } catch (e) {
      notifyError('Không thể tải thông tin user')
    }
  } else {
    form.value = { email: '', first_name: '', last_name: '', roles: [], enabled: true }
  }
})

function generatePassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pw = ''
  for (let i = 0; i < len; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  return pw
}

function roleLabel(role) {
  return roleLabels[role] || role
}

function roleBadgeClass(role) {
  const map = {
    'Trader1': 'bg-indigo-500/10 text-indigo-600',
    'Trader2': 'bg-purple-500/10 text-purple-600',
    'Payment Accountant': 'bg-emerald-500/10 text-emerald-600',
    'Management Accountant': 'bg-emerald-500/10 text-emerald-600',
    'Chief Accountant': 'bg-teal-500/10 text-teal-600',
    'Ops Manager': 'bg-amber-500/10 text-amber-600',
  }
  return map[role] || 'bg-app-bg text-app-text-muted'
}

async function save() {
  error.value = ''
  if (!form.value.email || !form.value.first_name) { error.value = 'Email và Họ là bắt buộc'; return }
  if (form.value.roles.length === 0) { error.value = 'Chọn ít nhất 1 vai trò'; return }

  saving.value = true
  try {
    if (isEdit.value) {
      await updateDoc('User', props.userEmail, {
        first_name: form.value.first_name,
        last_name: form.value.last_name,
        enabled: form.value.enabled ? 1 : 0,
        roles: form.value.roles.map(r => ({ role: r })),
      })
      success('Đã cập nhật người dùng')
    } else {
      const password = generatePassword()
      await createDoc('User', {
        email: form.value.email,
        first_name: form.value.first_name,
        last_name: form.value.last_name || undefined,
        new_password: password,
        send_welcome_email: 0,
        roles: form.value.roles.map(r => ({ role: r })),
      })
      createdEmail.value = form.value.email
      createdPassword.value = password
      showSuccess.value = true
    }
    emit('saved')
  } catch (e) {
    const msg = (e && e.message) || 'Lỗi không xác định'
    error.value = msg.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').trim().slice(0, 300)
  } finally {
    saving.value = false
  }
}

function copyPassword() {
  const text = createdPassword.value
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
  } else {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  copied.value = true
}
</script>
