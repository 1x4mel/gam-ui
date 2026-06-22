<template>
  <div class="bg-app-surface border border-app-border rounded-2xl p-4 shadow-sm">
    <p class="text-[9px] text-app-text-muted font-black uppercase tracking-widest mb-1">{{ label }}</p>
    <p class="text-lg font-black font-mono tracking-tighter" :class="color">{{ formatMoney(value, currency) }}</p>
    <slot name="extra" />
  </div>
</template>

<script setup>
import { formatMoney } from '../utils/format.js'

defineProps({
  label: { type: String, required: true },
  value: { type: Number, default: 0 },
  currency: { type: String, default: 'VND' },
  color: { type: String, default: 'text-app-text-primary' },
  bold: { type: Boolean, default: false },
})
</script>
