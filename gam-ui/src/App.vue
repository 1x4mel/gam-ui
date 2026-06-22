<template>
  <router-view />
  <ToastProvider />
  <ConfirmProvider />

  <!-- Session Expired Modal -->
  <div v-if="sessionExpired" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
    <div class="relative bg-app-surface border border-app-border rounded-[2rem] p-10 max-w-md w-full shadow-2xl text-center">
      <div class="w-16 h-16 bg-red-600/10 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">🔒</div>
      <h3 class="text-xl font-black text-app-text-primary uppercase tracking-tight mb-2">Phiên làm việc hết hạn</h3>
      <p class="text-app-text-muted text-sm mb-8">Bạn đã bị đăng xuất do phiên hết hạn. Vui lòng đăng nhập lại để tiếp tục.</p>
      <button @click="goLogin" class="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-sm shadow-lg shadow-indigo-600/20 transition-all active:scale-95">
        Đăng nhập lại
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import ToastProvider from './components/ToastProvider.vue'
import ConfirmProvider from './components/ConfirmProvider.vue'
import { useTheme } from './composables/useTheme.js'
import { onSessionExpired, offSessionExpired } from './api/index.js'

// Initialise theme watcher so .dark class is applied immediately.
useTheme()

const sessionExpired = ref(false)

function handleSessionExpired() {
  sessionExpired.value = true
}

function goLogin() {
  router.push('/login')
}

import { useRouter } from 'vue-router'
const router = useRouter()

onMounted(() => {
  onSessionExpired(handleSessionExpired)
})

onUnmounted(() => {
  offSessionExpired(handleSessionExpired)
})
</script>
