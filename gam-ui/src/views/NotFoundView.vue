<template>
  <div class="h-full flex items-center justify-center p-4">
    <div class="text-center max-w-sm">
      <div class="text-7xl mb-4">🎮</div>
      <h1 class="text-app-text-primary font-black text-xl sm:text-2xl uppercase tracking-tight mt-2 mb-1.5">Trang không tồn tại</h1>
      <p class="text-app-text-muted text-sm mb-6">Trang bạn đang tìm không tồn tại hoặc bạn không có quyền truy cập.</p>
      <AppButton variant="primary" size="lg" @click="router.push('/')">Về Dashboard</AppButton>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'NotFoundView' })
import { useRouter } from 'vue-router'
import AppButton from '../components/AppButton.vue'
const router = useRouter()
</script>
