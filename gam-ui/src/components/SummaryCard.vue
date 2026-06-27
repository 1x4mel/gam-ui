<template>
  <div class="bg-app-surface border border-app-border rounded-2xl p-4 shadow-sm">
    <p class="text-[9px] text-app-text-muted font-black uppercase tracking-widest mb-1">{{ label }}</p>
    <!-- Plain integer unless a currency is explicitly passed (these cards hold
         counts — events, logins, IPs — which must never render as money). -->
    <p class="text-lg font-black font-mono tracking-tighter" :class="color">{{ currency ? formatMoney(value, currency) : formatQty(value) }}</p>
    <slot name="extra" />
  </div>
</template>

<script setup>
import { formatMoney, formatQty } from '../utils/format.js'

defineProps({
  label: { type: String, required: true },
  value: { type: Number, default: 0 },
  // Empty by default → integer formatting. Pass e.g. `currency="VND"` only for
  // cards that genuinely show money.
  currency: { type: String, default: '' },
  color: { type: String, default: 'text-app-text-primary' },
  bold: { type: Boolean, default: false },
})
</script>
