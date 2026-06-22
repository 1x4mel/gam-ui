<template>
  <div class="text-center py-16 text-app-text-muted">
    <p class="text-4xl mb-3">{{ icon }}</p>
    <p class="font-black uppercase tracking-widest text-[11px]">{{ text }}</p>
    <p v-if="subtext" class="text-xs mt-2 opacity-60">{{ subtext }}</p>
  </div>
</template>

<script setup>
defineProps({
  icon: { type: String, default: '📭' },
  text: { type: String, default: 'Không có dữ liệu' },
  subtext: { type: String, default: '' },
})
</script>
