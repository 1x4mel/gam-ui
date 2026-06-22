<template>
  <div class="w-full flex flex-col h-full">
    <div class="shrink-0 flex items-center gap-3 mb-4 bg-app-surface border border-app-border rounded-2xl p-3 sm:p-4 shadow-sm mx-2 mt-2">
      <BackButton @click="$router.push('/queue')" />
      <h2 class="text-base sm:text-lg font-black text-app-text-primary uppercase tracking-tight">Đổi mật khẩu</h2>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
      <div class="max-w-xl mx-auto space-y-4">

        <!-- User Info (read-only) -->
        <div class="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center text-white text-lg font-bold shrink-0 shadow-lg shadow-indigo-600/20">
              {{ initials }}
            </div>
            <div>
              <p class="text-app-text-primary font-bold">{{ fullName }}</p>
              <p class="text-app-text-muted text-xs">{{ user }}</p>
              <p class="text-app-text-muted text-[10px] font-black uppercase tracking-widest mt-0.5">{{ roleLabel }}</p>
            </div>
          </div>
        </div>

        <!-- Change Password Card -->
        <div class="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm space-y-5">
          <h3 class="text-[12px] font-black uppercase tracking-[0.2em] text-app-text-primary flex items-center gap-2">
            <span class="p-1.5 bg-orange-600/10 rounded text-orange-600">🔒</span> Đổi mật khẩu
          </h3>

          <div class="space-y-4">
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Mật khẩu hiện tại</label>
              <input v-model="passwordForm.old_password" type="password" class="input-field !py-2.5 text-sm" placeholder="Nhập mật khẩu hiện tại" />
            </div>
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Mật khẩu mới</label>
              <input v-model="passwordForm.new_password" type="password" class="input-field !py-2.5 text-sm" placeholder="Nhập mật khẩu mới" />
            </div>
            <div>
              <label class="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5 block">Xác nhận mật khẩu mới</label>
              <input v-model="passwordForm.confirm_password" type="password" class="input-field !py-2.5 text-sm" placeholder="Nhập lại mật khẩu mới" />
            </div>
          </div>

          <div v-if="passwordError" class="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-500 font-bold">
            {{ passwordError }}
          </div>

          <div class="flex justify-end">
            <AppButton variant="orange" size="sm" :loading="changingPassword" @click="changePassword">
              Đổi mật khẩu
            </AppButton>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '../composables/useAuth.js'
import { getDoc, frappeCall } from '../api/index.js'
import { useNotify } from '../composables/useNotify.js'
import AppButton from '../components/AppButton.vue'
import BackButton from '../components/BackButton.vue'

defineOptions({ name: 'AccountSettingsView' })

const { user, roles } = useAuth()
const { success, error: notifyError } = useNotify()

const fullName = ref('')
const changingPassword = ref(false)
const passwordError = ref('')

const passwordForm = ref({
  old_password: '',
  new_password: '',
  confirm_password: '',
})

const initials = computed(() => {
  const name = fullName.value || user.value || ''
  return name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
})

const roleLabel = computed(() => {
  if (roles.value.includes('System Manager')) return 'System Manager'
  if (roles.value.includes('Payment Accountant')) return 'Kế toán thanh toán'
  if (roles.value.includes('Management Accountant')) return 'Kế toán vận hành'
  if (roles.value.includes('Chief Accountant')) return 'Kế toán trưởng'
  if (roles.value.includes('Trader1')) return 'Trader 1'
  if (roles.value.includes('Trader2')) return 'Trader 2'
  if (roles.value.includes('Ops Manager')) return 'Vận hành'
  return roles.value[0] || 'User'
})

onMounted(async () => {
  if (!user.value) return
  try {
    const doc = await getDoc('User', user.value)
    fullName.value = doc.full_name || ''
  } catch {}
})

async function changePassword() {
  passwordError.value = ''
  const { old_password, new_password, confirm_password } = passwordForm.value

  if (!old_password || !new_password || !confirm_password) {
    passwordError.value = 'Vui lòng điền đầy đủ các trường'
    return
  }
  if (new_password !== confirm_password) {
    passwordError.value = 'Mật khẩu xác nhận không khớp'
    return
  }

  changingPassword.value = true
  try {
    await frappeCall('frappe.core.doctype.user.user.update_password', {
      old_password,
      new_password,
      logout_all_sessions: 0,
    })
    success('Đổi mật khẩu thành công')
    passwordForm.value = { old_password: '', new_password: '', confirm_password: '' }
  } catch (e) {
    const msg = e.message || 'Đổi mật khẩu thất bại'
    passwordError.value = msg.replace(/<[^>]*>/g, '').trim()
  } finally {
    changingPassword.value = false
  }
}
</script>
