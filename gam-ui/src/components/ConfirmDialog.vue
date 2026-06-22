<template>
  <ModalWrapper :model-value="true" size="sm" persistent :aria-label="title" @update:model-value="$emit('close')">
    <template #header>
      <div class="px-8 pt-8 pb-4 flex items-center justify-between">
        <h3 class="text-lg font-black text-app-text-primary uppercase tracking-tight">{{ title }}</h3>
        <button type="button" aria-label="Đóng" @click="$emit('close')" class="text-app-text-muted hover:text-app-text-primary p-1">✕</button>
      </div>
    </template>

    <div class="px-8 pb-2 space-y-3">
      <p v-if="message" class="text-sm text-app-text-secondary whitespace-pre-wrap">{{ message }}</p>
      <slot />
      <p v-if="error" class="text-xs text-red-500 font-medium">{{ error }}</p>
    </div>

    <template #footer>
      <button
        @click="$emit('close')"
        class="px-5 py-2.5 rounded-xl bg-app-bg border border-app-border text-app-text-secondary hover:text-app-text-primary text-[10px] font-black uppercase tracking-widest transition"
      >
        {{ cancelLabel }}
      </button>
      <button
        @click="$emit('confirm')" :disabled="loading"
        class="px-6 py-2.5 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2"
        :class="danger ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'"
      >
        <span v-if="loading" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
        {{ confirmLabel }}
      </button>
    </template>
  </ModalWrapper>
</template>

<script setup>
import ModalWrapper from './ModalWrapper.vue'

defineProps({
  title: { type: String, default: 'Xác nhận' },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Xác nhận' },
  cancelLabel: { type: String, default: 'Huỷ' },
  danger: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
defineEmits(['close', 'confirm'])
</script>
