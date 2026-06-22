<template>
  <span
    class="font-black shrink-0 shadow-sm border border-black/5"
    :class="[statusBadge(status), sizeClass]"
  >{{ status }}</span>
</template>

<script setup>
import { computed } from 'vue'
import { statusBadge } from '../utils/format.js'

const props = defineProps({
  status: { type: String, required: true },
  size: { type: String, default: 'sm' },
})

const sizeClass = computed(() => {
  if (props.size === 'lg') return 'text-[10px] px-3.5 py-1.5 rounded-xl uppercase tracking-widest'
  return 'text-[9px] px-2 py-0.5 rounded-full tracking-wider'
})
</script>
