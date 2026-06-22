<template>
  <Transition name="fade">
    <div v-if="confirmState.isOpen" class="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/80 backdrop-blur-md" @click="cancel"></div>
      
      <div class="relative bg-app-surface border border-app-border rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden scale-in">
        <div class="p-8 text-center text-app-text-primary">
          <div class="w-16 h-16 bg-indigo-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/20">
            <span class="text-3xl">❓</span>
          </div>
          <h3 class="text-lg font-bold mb-4 tracking-tight">Xác nhận hành động</h3>
          <p class="text-app-text-muted text-sm leading-relaxed mb-8">
            {{ confirmState.message }}
          </p>

          <div class="flex gap-4">
            <AppButton variant="neutral" size="md" class="flex-1" @click="cancel">Hủy bỏ</AppButton>
            <AppButton variant="primary" size="md" class="flex-1" @click="confirm">Xác nhận</AppButton>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { useNotify } from '../composables/useNotify'
import AppButton from './AppButton.vue'

const { confirmState } = useNotify()

function confirm() {
  confirmState.resolve(true)
}

function cancel() {
  confirmState.resolve(false)
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.scale-in {
  animation: scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes scale-in {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
