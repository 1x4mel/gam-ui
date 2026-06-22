<template>
  <span
    v-if="role" class="inline-flex items-center gap-1.5 font-black shrink-0 border border-black/5"
    :class="[colorClass, sizeClass]"
  >
    <span class="text-[0.85em] leading-none">{{ icon }}</span>
    <span>{{ displayLabel }}</span>
  </span>
  <span v-else class="text-app-text-muted text-[9px] font-bold uppercase tracking-wider">No role</span>
</template>

<script setup>
import { computed } from 'vue'
import { useGamMetadata, optionColorClass } from '../composables/useGamMetadata.js'

const props = defineProps({
  role: { type: String, default: '' },
  size: { type: String, default: 'sm' }, // 'xs' | 'sm' | 'lg'
})

// Hardcoded fallback (used before metadata loads, or for unknown values).
const FALLBACK = {
  BOOSTER: { icon: '🚀', label: 'Booster', color: 'indigo' },
  TRADER: { icon: '💱', label: 'Trader', color: 'emerald' },
  ITEM: { icon: '📦', label: 'Item', color: 'amber' },
}

const { roleMeta } = useGamMetadata()

const resolved = computed(() => {
  const key = (props.role || '').toUpperCase()
  const m = roleMeta(key)
  if (m) return { icon: m.icon || '🏷️', label: m.label || props.role, color: m.color }
  const fb = FALLBACK[key]
  if (fb) return fb
  return { icon: '🏷️', label: props.role, color: 'gray' }
})

const icon = computed(() => resolved.value.icon)
const displayLabel = computed(() => resolved.value.label)
const colorClass = computed(() => optionColorClass(resolved.value.color))

const sizeClass = computed(() => {
  if (props.size === 'lg') return 'px-3.5 py-1.5 rounded-xl text-[11px] uppercase tracking-widest'
  if (props.size === 'xs') return 'px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider'
  return 'px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider'
})
</script>
