<template>
  <div class="flex items-center gap-1 bg-app-bg/50 border-b border-app-border rounded-t-xl px-2 py-1.5 overflow-x-auto scrollbar-hide">
    <button type="button"
      v-for="tab in tabs"
      :key="tab.id"
      @click="$emit('select', tab.id)"
      class="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide transition-all shrink-0 max-w-[180px]"
      :class="tab.id === activeTabId
        ? 'bg-indigo-600 text-white shadow-sm'
        : 'bg-app-bg text-app-text-muted hover:text-app-text-primary hover:bg-app-surface border border-app-border'"
    >
      <!-- Status dot -->
      <span class="w-2 h-2 rounded-full shrink-0"
        :class="statusDot(tab.status)"></span>
      <!-- Label -->
      <span class="truncate">{{ tab.label }}</span>
      <!-- Close button -->
      <button type="button"
        @click.stop="$emit('close', tab.id)"
        class="ml-1 w-4 h-4 flex items-center justify-center rounded transition-all"
        :class="tab.id === activeTabId
          ? 'text-white/60 hover:text-white hover:bg-white/20'
          : 'text-app-text-muted/40 hover:text-red-500 hover:bg-red-500/10'"
      >×</button>
    </button>
    <!-- Add tab button -->
    <button type="button"
      @click="$emit('add')"
      :disabled="tabs.length >= maxTabs"
      class="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-bold transition-all shrink-0"
      :class="tabs.length >= maxTabs
        ? 'text-app-text-muted/20 cursor-not-allowed'
        : 'text-indigo-500 hover:bg-indigo-500/10 hover:text-indigo-600'"
    >+</button>
  </div>
</template>

<script setup>
defineProps({
  tabs: { type: Array, required: true },
  activeTabId: { type: String, required: true },
  maxTabs: { type: Number, default: 10 },
})

defineEmits(['select', 'close', 'add'])

function statusDot(status) {
  if (status === 'submitted') return 'bg-blue-400'
  if (status === 'ready') return 'bg-emerald-400'
  if (status === 'filling') return 'bg-amber-400'
  return 'bg-gray-400'
}
</script>
