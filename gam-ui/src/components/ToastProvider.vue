<template>
  <div class="fixed top-6 right-6 z-[200] flex flex-col gap-3 w-80 pointer-events-none">
    <TransitionGroup name="toast">
      <div 
        v-for="toast in toasts" 
        :key="toast.id"
        class="pointer-events-auto bg-app-surface border border-app-border rounded-2xl p-4 shadow-2xl flex items-start gap-3 backdrop-blur-xl group overflow-hidden"
        :class="borderClass(toast.type)"
      >
        <!-- Icon -->
        <div class="shrink-0 mt-0.5">
          <span v-if="toast.type === 'success'" class="text-emerald-400">✨</span>
          <span v-else-if="toast.type === 'error'" class="text-rose-400">🚫</span>
          <span v-else-if="toast.type === 'warning'" class="text-amber-400">⚠️</span>
          <span v-else class="text-indigo-400">ℹ️</span>
        </div>

        <!-- Content -->
        <div class="flex-1">
          <p class="text-xs font-bold text-app-text-primary leading-tight">{{ toast.message }}</p>
        </div>

        <!-- Close -->
        <button @click="remove(toast.id)" class="text-app-text-muted hover:text-app-text-primary transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
        </button>

        <!-- Progress bar -->
        <div class="absolute bottom-0 left-0 h-0.5 bg-current opacity-20 animate-progress" :class="textClass(toast.type)"></div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { useNotify } from '../composables/useNotify'

const { toasts, remove } = useNotify()

function borderClass(type) {
  switch (type) {
    case 'success': return 'border-emerald-500/30'
    case 'error': return 'border-rose-500/30'
    case 'warning': return 'border-amber-500/30'
    default: return 'border-indigo-500/30'
  }
}

function textClass(type) {
  switch (type) {
    case 'success': return 'text-emerald-500'
    case 'error': return 'text-rose-500'
    case 'warning': return 'text-amber-500'
    default: return 'text-indigo-500'
  }
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(30px) scale(0.9);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

@keyframes progress {
  from { width: 100%; }
  to { width: 0%; }
}
.animate-progress {
  animation: progress 3s linear forwards;
}
</style>
