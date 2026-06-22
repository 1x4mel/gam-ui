<template>
  <div class="min-w-0">
    <p
      class="text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-2"
      :class="labelClass"
    >
      {{ label }}
    </p>
    <p class="truncate" :class="value ? valueClass : 'text-app-text-muted'">
      <slot>{{ value || '—' }}</slot>
    </p>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '' },
  valueClass: { type: String, default: 'text-app-text-primary text-sm font-black' },
  labelClass: { type: String, default: 'opacity-30' },
})
</script>
