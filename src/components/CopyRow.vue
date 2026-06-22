<template>
  <div class="flex flex-wrap items-center gap-2 text-[11px] group/copy">
    <span v-if="label" class="text-app-text-muted uppercase text-[9px] font-black tracking-widest w-14 shrink-0">{{ label }}:</span>
    <div class="flex-1 min-w-0">
      <slot>
        <span class="font-mono font-bold" :class="value ? valueColor : 'text-app-text-muted'">{{ value || '—' }}</span>
      </slot>
    </div>
    <CopyButton v-if="value && copyable" :text="String(value)" :title="copyTitle" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import CopyButton from './CopyButton.vue'

const props = defineProps({
  label: { type: String, default: '' },
  value: { type: [String, Number], default: '' },
  copyable: { type: Boolean, default: true },
  copyTitle: { type: String, default: 'Copy' },
  color: { type: String, default: 'indigo' },
})

const valueColor = computed(() => {
  const map = { indigo: 'text-indigo-600', emerald: 'text-emerald-600', secondary: 'text-app-text-secondary' }
  return map[props.color] || 'text-indigo-600'
})
</script>
