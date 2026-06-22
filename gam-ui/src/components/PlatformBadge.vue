<template>
  <span
    class="inline-flex items-center gap-1.5 font-black shrink-0 border border-black/5"
    :class="[colorClass, sizeClass]"
  >
    <span class="text-[0.85em] leading-none">{{ icon }}</span>
    <span>{{ displayLabel }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { useGamMetadata, optionColorClass } from '../composables/useGamMetadata.js'

const props = defineProps({
  platform: { type: String, default: '' },
  size: { type: String, default: 'sm' }, // 'xs' | 'sm' | 'lg'
})

// Hardcoded fallback (used before metadata loads, or for unknown values).
const META = {
  STEAM: { icon: '🎮', label: 'Steam', color: 'blue' },
  BATTLENET: { icon: '⚔️', label: 'Battle.net', color: 'indigo' },
  XBOX: { icon: '🎯', label: 'Xbox', color: 'emerald' },
  EPIC: { icon: '🛍️', label: 'Epic', color: 'slate' },
  STANDALONE: { icon: '🕹️', label: 'Standalone', color: 'amber' },
  POE: { icon: '🔮', label: 'POE', color: 'orange' },
  OTHER: { icon: '📨', label: 'Other', color: 'gray' },
}

const { platformMeta } = useGamMetadata()

const resolved = computed(() => {
  const key = (props.platform || '').toUpperCase()
  const m = platformMeta(key)
  if (m) return { icon: m.icon || '🎮', label: m.label || props.platform, color: m.color }
  const fb = META[key]
  if (fb) return fb
  return { icon: '🎮', label: props.platform || '—', color: 'gray' }
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
