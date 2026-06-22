<template>
  <div class="flex flex-col items-center justify-center" :class="wrapperClass">
    <div
      class="border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"
      :class="spinnerClass"
    ></div>
    <p v-if="text" class="text-app-text-muted text-xs font-black uppercase tracking-[0.2em] mt-4">{{ text }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  size: { type: String, default: 'md', validator: v => ['sm', 'md', 'lg'].includes(v) },
  text: { type: String, default: '' },
})

const spinnerClass = computed(() => {
  if (props.size === 'sm') return 'w-4 h-4 border-2'
  if (props.size === 'lg') return 'w-12 h-12 border-4'
  return 'w-10 h-10 border-4'
})

const wrapperClass = computed(() => {
  if (props.size === 'sm') return 'py-2'
  return 'py-20'
})
</script>
