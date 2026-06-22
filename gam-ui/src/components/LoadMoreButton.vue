<template>
  <div>
    <AppButton
      v-if="hasMore && !loading"
      variant="neutral" size="md" class="w-full mt-6 !py-4"
      @click="$emit('loadMore')"
    >
      {{ label }}
    </AppButton>
    <div v-if="loading && itemCount > 0" class="text-center py-6 text-app-text-muted text-[10px] font-black uppercase tracking-widest animate-pulse">{{ loadingText }}</div>
  </div>
</template>

<script setup>
import AppButton from './AppButton.vue'

defineProps({
  hasMore: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  itemCount: { type: Number, default: 0 },
  label: { type: String, default: 'Tải thêm dữ liệu' },
  loadingText: { type: String, default: 'Đang tải...' },
})

defineEmits(['loadMore'])
</script>
