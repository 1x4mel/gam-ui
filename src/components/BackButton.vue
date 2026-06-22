<template>
  <button @click="$emit('click')"
    class="p-2.5 bg-app-bg border border-app-border rounded-xl text-app-text-muted hover:text-app-text-primary transition-all shadow-sm active:scale-95 group">
    <svg class="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
    </svg>
  </button>
</template>

<script setup>
defineEmits(['click'])
</script>
