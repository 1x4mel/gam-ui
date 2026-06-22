<template>
  <div class="min-h-screen bg-app-bg flex items-center justify-center p-6 relative overflow-hidden">
    <!-- Decorative background elements -->
    <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/5 rounded-full blur-[120px]"></div>

    <div class="bg-app-surface/60 backdrop-blur-xl border border-app-border rounded-[3rem] p-12 w-full max-w-sm shadow-2xl flex flex-col relative z-10">
      <div class="mb-12 text-center">
        <div class="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto mb-6 flex items-center justify-center text-3xl shadow-xl shadow-indigo-600/20 rotate-3 transform hover:rotate-0 transition-transform duration-500">
          💼
        </div>
        <h1 class="text-3xl font-black text-app-text-primary tracking-tighter uppercase">Trader UI</h1>
        <p class="text-app-text-muted text-[10px] font-black uppercase tracking-[0.3em] mt-2 opacity-50">Game Currency ERP</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-2.5 px-1 opacity-60">Tên đăng nhập / Email</label>
          <input
            v-model="form.usr"
            type="text"
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

      <div class="mt-12 text-center opacity-30">
        <p class="text-[9px] font-black text-app-text-muted uppercase tracking-widest leading-loose">
          Chỉ dành cho nhân viên được ủy quyền<br>
          © 2026 Trader Interface
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../api/index.js'

const router = useRouter()
const form = ref({ usr: '', pwd: '' })
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  loading.value = true
  error.value = ''
  try {
    const res = await login(form.value.usr, form.value.pwd)
    if (res.message === 'Logged In') {
      router.push('/')
    } else {
      error.value = 'Sai email hoặc mật khẩu'
    }
  } catch {
    error.value = 'Không thể kết nối ERPNext'
  } finally {
    loading.value = false
  }
}
</script>
