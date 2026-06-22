<template>
  <div class="min-h-screen bg-app-bg flex items-center justify-center p-6 relative overflow-hidden">
    <!-- Decorative background elements -->
    <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/5 rounded-full blur-[120px]"></div>

    <div class="bg-app-surface/60 backdrop-blur-xl border border-app-border rounded-[3rem] p-12 w-full max-w-sm shadow-2xl flex flex-col relative z-10">
      <div class="mb-12 text-center">
        <div class="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto mb-6 flex items-center justify-center text-3xl shadow-xl shadow-indigo-600/20 rotate-3 transform hover:rotate-0 transition-transform duration-500">
          🎮
        </div>
        <h1 class="text-3xl font-black text-app-text-primary tracking-tighter uppercase">GAM</h1>
        <p class="text-app-text-muted text-[10px] font-black uppercase tracking-[0.3em] mt-2 opacity-50">Game Account Manager</p>
      </div>

      <!-- Step 1: credentials -->
      <form v-if="step === 'password'" @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-2.5 px-1 opacity-60">Tên đăng nhập / Email</label>
          <input
            v-model="form.usr"
            type="text"
            autocomplete="username"
            placeholder="admin@example.com"
            class="w-full bg-app-surface border border-app-border text-app-text-primary rounded-2xl px-5 py-4 text-sm font-medium outline-none focus:border-indigo-600 transition-all"
            required
          />
        </div>
        <div>
          <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-2.5 px-1 opacity-60">Mật khẩu</label>
          <input
            v-model="form.pwd"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            class="w-full bg-app-surface border border-app-border text-app-text-primary rounded-2xl px-5 py-4 text-sm font-medium outline-none focus:border-indigo-600 transition-all"
            required
          />
        </div>

        <p v-if="error" class="text-red-500 text-[11px] font-black uppercase tracking-widest text-center bg-red-500/10 py-3 rounded-xl border border-red-500/10">{{ error }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl py-4 transition-all shadow-xl shadow-indigo-600/20 active:scale-[0.98] mt-4"
        >
          {{ loading ? 'Đang xác thực...' : '🚀 Bắt đầu' }}
        </button>
      </form>

      <!-- Step 2: 2FA verification code -->
      <form v-else @submit.prevent="handleVerifyOtp" class="space-y-6">
        <div class="text-center">
          <div class="w-12 h-12 mx-auto mb-4 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-2xl">🔐</div>
          <p class="text-sm font-bold text-app-text-primary">Xác thực 2 bước</p>
          <p class="text-[11px] text-app-text-muted mt-2 leading-relaxed">{{ otpPrompt }}</p>
          <p v-if="otpSetupNote" class="text-[10px] font-bold text-amber-500/90 mt-3 bg-amber-500/10 border border-amber-500/10 rounded-xl px-3 py-2 leading-relaxed">
            {{ otpSetupNote }}
          </p>
        </div>

        <div>
          <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-2.5 px-1 opacity-60">Mã xác thực (6 số)</label>
          <input
            ref="otpInput"
            v-model="form.otp"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="[0-9]{4,8}"
            maxlength="8"
            placeholder="••••••"
            class="w-full bg-app-surface border border-app-border text-app-text-primary rounded-2xl px-5 py-4 text-center text-2xl font-black tracking-[0.5em] outline-none focus:border-indigo-600 transition-all"
            required
          />
        </div>

        <p v-if="error" class="text-red-500 text-[11px] font-black uppercase tracking-widest text-center bg-red-500/10 py-3 rounded-xl border border-red-500/10">{{ error }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl py-4 transition-all shadow-xl shadow-indigo-600/20 active:scale-[0.98] mt-4"
        >
          {{ loading ? 'Đang kiểm tra...' : '✓ Xác nhận' }}
        </button>

        <button type="button" @click="backToPassword" class="w-full text-[10px] font-black text-app-text-muted uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity mt-2">
          ← Quay lại
        </button>
      </form>

      <div class="mt-12 text-center opacity-30">
        <p class="text-[9px] font-black text-app-text-muted uppercase tracking-widest leading-loose">
          Chỉ dành cho nhân viên được ủy quyền<br>
          © 2026 Game Account Manager
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../api/index.js'

const router = useRouter()
const form = ref({ usr: '', pwd: '', otp: '' })
const loading = ref(false)
const error = ref('')

// 2FA state
const step = ref('password') // 'password' | 'otp'
const verification = ref(null)
const tmpId = ref(null)
const otpInput = ref(null)

const otpPrompt = computed(() => {
  const v = verification.value
  if (v && v.prompt) return v.prompt
  if (v && v.method === 'SMS') return 'Nhập mã đã được gửi qua SMS của bạn.'
  if (v && v.method === 'Email') return 'Nhập mã đã được gửi đến email đăng ký của bạn.'
  return 'Mở ứng dụng xác thực (Google Authenticator / Authy) và nhập mã 6 số hiện tại.'
})

// When the account hasn't finished OTP-app setup yet, Frappe emails a one-time
// setup link; surface that so the user knows to check their mailbox.
const otpSetupNote = computed(() => {
  const v = verification.value
  if (!v) return ''
  if (v.method === 'OTP App' && v.setup === false) {
    return 'Chưa thiết lập ứng dụng xác thực — kiểm tra email để quét mã QR lần đầu, sau đó nhập mã tại đây.'
  }
  return ''
})

function isLoggedMessage(msg) {
  return msg === 'Logged In' || msg === 'No App'
}

async function handleLogin() {
  loading.value = true
  error.value = ''
  try {
    const res = await login(form.value.usr, form.value.pwd)
    if (isLoggedMessage(res.message)) {
      router.push('/')
      return
    }
    // 2FA challenge: Frappe returns { verification, tmp_id } (no session yet).
    if (!res.exc && (res.verification || res.tmp_id)) {
      verification.value = res.verification || {}
      tmpId.value = res.tmp_id || null
      form.value.otp = ''
      step.value = 'otp'
      await nextTick()
      otpInput.value?.focus()
      return
    }
    if (res.message === 'Password Reset') {
      error.value = 'Mật khẩu đã hết hạn, vui lòng đặt lại'
    } else {
      error.value = 'Sai email hoặc mật khẩu'
    }
  } catch {
    error.value = 'Không thể kết nối máy chủ'
  } finally {
    loading.value = false
  }
}

async function handleVerifyOtp() {
  if (!form.value.otp) return
  loading.value = true
  error.value = ''
  try {
    const res = await login(form.value.usr, form.value.pwd, form.value.otp, tmpId.value)
    if (isLoggedMessage(res.message)) {
      router.push('/')
      return
    }
    // Server re-issued a fresh challenge (e.g. tmp_id rotated) — keep going.
    if (!res.exc && (res.verification || res.tmp_id)) {
      if (res.tmp_id) tmpId.value = res.tmp_id
      error.value = 'Mã không đúng, vui lòng thử lại'
      form.value.otp = ''
      await nextTick()
      otpInput.value?.focus()
      return
    }
    error.value = 'Mã xác thực không đúng hoặc đã hết hạn'
    form.value.otp = ''
  } catch {
    error.value = 'Mã xác thực không đúng hoặc đã hết hạn'
  } finally {
    loading.value = false
  }
}

function backToPassword() {
  step.value = 'password'
  verification.value = null
  tmpId.value = null
  form.value.otp = ''
  error.value = ''
}
</script>
