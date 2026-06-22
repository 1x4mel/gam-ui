<template>
  <div class="h-full flex flex-col overflow-hidden">
    <PageHeader title="Cài đặt tài khoản" subtitle="Hồ sơ · mật khẩu · tuỳ chọn cá nhân" icon="⚙️" :connected="connected" @refresh="load" />

    <div class="flex-1 overflow-y-auto custom-scrollbar">
      <div class="max-w-3xl mx-auto w-full space-y-6 pb-8">
        <!-- Profile -->
        <div class="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm">
          <div class="flex items-center gap-4 mb-5">
            <div class="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-lg font-black shrink-0 shadow-lg shadow-indigo-600/20">
              {{ initials }}
            </div>
            <div class="min-w-0">
              <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight truncate">{{ displayName }}</h3>
              <span
                class="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                :class="roleBadgeClass"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="roleDotClass"></span>
                {{ roleLabel }}
              </span>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Email / Tên đăng nhập</label>
              <input :value="user" type="text" readonly class="w-full input-field px-3 py-2.5 text-sm opacity-70 cursor-not-allowed" />
            </div>
            <div>
              <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Họ và tên</label>
              <input v-model="profileForm.full_name" type="text" class="w-full input-field px-3 py-2.5 text-sm" placeholder="Nguyễn Văn A" />
            </div>
            <p v-if="profileError" class="text-xs text-red-500 font-medium">{{ profileError }}</p>
            <div class="flex justify-end">
              <button @click="saveProfile" :disabled="profileSaving" class="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2">
                <span v-if="profileSaving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Lưu hồ sơ
              </button>
            </div>
          </div>
        </div>

        <!-- Change password -->
        <div class="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm">
          <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight mb-1">Đổi mật khẩu</h3>
          <p class="text-app-text-muted text-[11px] mb-4">Nhập mật khẩu hiện tại và mật khẩu mới để cập nhật.</p>
          <div class="space-y-4">
            <div>
              <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Mật khẩu hiện tại</label>
              <input
                v-model="pwdForm.old_password" :type="showOld ? 'text' : 'password'" autocomplete="current-password"
                class="w-full input-field px-3 py-2.5 pr-10 text-sm" placeholder="••••••••"
              />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Mật khẩu mới</label>
                <input
                  v-model="pwdForm.new_password" :type="showNew ? 'text' : 'password'" autocomplete="new-password"
                  class="w-full input-field px-3 py-2.5 pr-10 text-sm" placeholder="Tối thiểu 6 ký tự"
                />
              </div>
              <div>
                <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Xác nhận mật khẩu mới</label>
                <input
                  v-model="pwdForm.confirm" :type="showNew ? 'text' : 'password'" autocomplete="new-password"
                  class="w-full input-field px-3 py-2.5 pr-10 text-sm" placeholder="Nhập lại mật khẩu mới"
                />
              </div>
            </div>
            <div class="flex items-center justify-between flex-wrap gap-3">
              <label class="flex items-center gap-2 text-[10px] text-app-text-muted uppercase font-black tracking-widest cursor-pointer select-none">
                <input type="checkbox" v-model="showNew" class="accent-indigo-600" @click="showOld = showNew" />
                Hiện mật khẩu
              </label>
              <p v-if="pwdError" class="text-xs text-red-500 font-medium order-3 sm:order-2 w-full sm:w-auto sm:ml-auto">{{ pwdError }}</p>
              <button @click="changePassword" :disabled="pwdSaving" class="order-2 sm:order-3 px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2">
                <span v-if="pwdSaving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Cập nhật mật khẩu
              </button>
            </div>
          </div>
        </div>

        <!-- Preferences -->
        <div class="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm">
          <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight mb-4">Tuỳ chọn hiển thị</h3>
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p class="text-app-text-primary text-sm font-bold">Giao diện</p>
              <p class="text-app-text-muted text-[11px]">Chuyển giữa chế độ sáng và tối.</p>
            </div>
            <div class="flex items-center gap-1.5 bg-app-bg border border-app-border rounded-xl p-1">
              <button
                @click="setTheme('light')"
                class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition flex items-center gap-1.5"
                :class="!isDark ? 'bg-indigo-600 text-white' : 'text-app-text-muted hover:text-app-text-primary'"
              >
                ☀️ Sáng
              </button>
              <button
                @click="setTheme('dark')"
                class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition flex items-center gap-1.5"
                :class="isDark ? 'bg-indigo-600 text-white' : 'text-app-text-muted hover:text-app-text-primary'"
              >
                🌙 Tối
              </button>
            </div>
          </div>
        </div>

        <!-- Security -->
        <div class="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm">
          <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight mb-4">Bảo mật</h3>
          <div class="flex items-start gap-3">
            <span class="text-xl shrink-0">🔐</span>
            <div class="min-w-0">
              <p class="text-app-text-primary text-sm font-bold">Xác thực hai yếu tố (2FA)</p>
              <p class="text-app-text-muted text-[11px] mt-1 leading-relaxed">
                Bảo vệ thêm cho tài khoản bằng mã OTP (TOTP). Tính năng này sẽ được kích hoạt ở giai đoạn B4.
                Liên hệ quản trị viên nếu cần bật sớm.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { useRealtime } from '../composables/useRealtime.js'
import { useNotify } from '../composables/useNotify.js'
import { useAuth } from '../composables/useAuth.js'
import { useTheme } from '../composables/useTheme.js'
import { getDoc, updateDoc, frappeCall } from '../api/index.js'

defineOptions({ name: 'AccountSettingsView' })

const { connected } = useRealtime()
const { success, error: notifyError } = useNotify()
const { user, isGamAdmin, isAdmin } = useAuth()
const { isDark, setTheme } = useTheme()

// ---- Profile ----
const profileForm = ref({ full_name: '' })
const profileSaving = ref(false)
const profileError = ref('')

const displayName = computed(() => profileForm.value.full_name || (user.value ? user.value.split('@')[0] : ''))
const initials = computed(() => (displayName.value || '?').slice(0, 2).toUpperCase())

const roleLabel = computed(() => {
  if (isGamAdmin.value) return 'GAM Admin'
  if (isAdmin.value) return 'Administrator'
  return 'GAM Member'
})
const roleBadgeClass = computed(() =>
  isGamAdmin.value || isAdmin.value
    ? 'bg-indigo-500/15 text-indigo-600'
    : 'bg-emerald-500/15 text-emerald-600'
)
const roleDotClass = computed(() =>
  isGamAdmin.value || isAdmin.value ? 'bg-indigo-500' : 'bg-emerald-500'
)

async function load() {
  profileError.value = ''
  try {
    if (!user.value || user.value === 'Guest') return
    const doc = await getDoc('User', user.value)
    profileForm.value.full_name = doc?.full_name || ''
  } catch {
    // Backend may not be ready; fall back to username-derived name.
    profileForm.value.full_name = user.value ? user.value.split('@')[0] : ''
  }
}

async function saveProfile() {
  if (!profileForm.value.full_name || !profileForm.value.full_name.trim()) {
    profileError.value = 'Nhập họ và tên'
    return
  }
  profileSaving.value = true
  profileError.value = ''
  try {
    // Frappe's User controller derives `full_name` from `first_name` (+ `last_name`)
    // on every save (`set_full_name`), so writing `full_name` directly is a silent
    // no-op server-side. To actually change the displayed name we must write the
    // parts. We treat the single "Họ và tên" field as the full display name → put
    // it all in `first_name` and clear `last_name`, so the derived `full_name`
    // equals exactly what the user typed.
    const name = profileForm.value.full_name.trim()
    await updateDoc('User', user.value, { first_name: name, last_name: '' })
    success('Đã cập nhật hồ sơ')
  } catch (e) {
    profileError.value = e.message || 'Cập nhật thất bại'
    notifyError(e.message || 'Cập nhật thất bại')
  } finally {
    profileSaving.value = false
  }
}

// ---- Change password ----
const pwdForm = ref({ old_password: '', new_password: '', confirm: '' })
const pwdSaving = ref(false)
const pwdError = ref('')
const showOld = ref(false)
const showNew = ref(false)

async function changePassword() {
  pwdError.value = ''
  const { old_password, new_password, confirm } = pwdForm.value
  if (!old_password) return (pwdError.value = 'Nhập mật khẩu hiện tại')
  if (!new_password || new_password.length < 6) return (pwdError.value = 'Mật khẩu mới tối thiểu 6 ký tự')
  if (new_password !== confirm) return (pwdError.value = 'Xác nhận mật khẩu không khớp')

  pwdSaving.value = true
  try {
    // Built-in Frappe method (not gam.*); verifies old_password server-side.
    await frappeCall('frappe.core.doctype.user.user.update_password', {
      new_password: new_password,
      old_password: old_password,
    })
    success('Đã đổi mật khẩu')
    pwdForm.value = { old_password: '', new_password: '', confirm: '' }
    showOld.value = false
    showNew.value = false
  } catch (e) {
    pwdError.value = e.message || 'Đổi mật khẩu thất bại'
    notifyError(e.message || 'Đổi mật khẩu thất bại')
  } finally {
    pwdSaving.value = false
  }
}

onMounted(load)
</script>
