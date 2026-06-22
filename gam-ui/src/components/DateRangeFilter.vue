<template>
  <div class="w-full sm:w-auto flex flex-col sm:flex-row gap-1.5 sm:gap-2 items-stretch sm:items-center bg-app-surface border border-app-border rounded-xl px-3 sm:px-4 py-2 sm:py-1.5 transition-all">
    <div class="flex items-center gap-2">
      <span class="text-[10px] font-black text-app-text-muted uppercase tracking-widest opacity-50 shrink-0">Từ</span>
      <input
        :value="dateFrom"
        @change="$emit('update:dateFrom', $event.target.value)"
        type="date"
        class="bg-transparent text-[11px] sm:text-xs font-bold text-app-text-primary outline-none cursor-pointer flex-1 min-w-0"
      />
    </div>
    <div class="flex items-center gap-2">
      <span class="text-[10px] font-black text-app-text-muted uppercase tracking-widest opacity-50 shrink-0">Đến</span>
      <input
        :value="dateTo"
        @change="$emit('update:dateTo', $event.target.value)"
        type="date"
        class="bg-transparent text-[11px] sm:text-xs font-bold text-app-text-primary outline-none cursor-pointer flex-1 min-w-0"
      />
    </div>
  </div>
</template>

<script setup>
defineProps({
  dateFrom: { type: String, default: '' },
  dateTo: { type: String, default: '' },
})
defineEmits(['update:dateFrom', 'update:dateTo'])
</script>
