<template>
  <button type="button"
    class="px-2 py-1 text-[8px] font-black uppercase bg-app-bg text-app-text-muted border border-app-border rounded transition-all"
    :class="colorClass"
    @click.stop="$emit('click')">
    {{ label }}
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  color: { type: String, default: 'indigo' },
})

defineEmits(['click'])

const colorMap = {
  indigo: 'hover:bg-indigo-600 hover:text-white',
  orange: 'hover:bg-orange-600 hover:text-white',
  emerald: 'hover:bg-emerald-600 hover:text-white',
}
const colorClass = computed(() => colorMap[props.color] || colorMap.indigo)
</script>
