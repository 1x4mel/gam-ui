<template>
  <div class="mb-4 sm:mb-6 flex flex-wrap items-center justify-between gap-3">
    <div class="min-w-0">
      <h2 class="text-base sm:text-xl font-black text-app-text-primary uppercase tracking-tight flex items-center gap-2">
        <span v-if="icon" class="text-base sm:text-xl leading-none">{{ icon }}</span>
        <span class="truncate">{{ title }}</span>
      </h2>
      <p v-if="subtitle" class="text-app-text-muted text-[11px] sm:text-xs mt-0.5 sm:mt-1 font-medium italic">{{ subtitle }}</p>
    </div>
    <div class="flex items-center gap-2 sm:gap-2.5 shrink-0">
      <slot name="actions" />
      <button
        @click="$emit('refresh')"
        class="px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl btn-premium bg-app-surface border border-app-border text-app-text-muted hover:text-app-text-primary shadow-sm flex items-center gap-2 text-[9px] sm:text-[10px]"
      >
        <span class="w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]" :class="connected ? 'bg-emerald-500' : 'bg-app-text-muted'"></span>
        Refresh
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '' },
  connected: { type: Boolean, default: false },
})
defineEmits(['refresh'])
</script>
