<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header slot (sticky) -->
    <div v-if="$slots.header" class="flex-shrink-0 overflow-hidden">
      <slot name="header" />
    </div>

    <!-- Filters slot (sticky) -->
    <div v-if="$slots.filters" class="flex-shrink-0 sticky top-0 z-10 bg-app-bg overflow-hidden">
      <slot name="filters" />
    </div>

    <!-- Scrollable content area -->
    <div v-if="selfScroll" class="flex-1 min-h-0 min-w-0 overflow-hidden">
      <slot />
    </div>
    <div v-else ref="scrollContainer" class="flex-1 overflow-auto min-h-0 custom-scrollbar" data-scroll-container>
      <slot />
    </div>

    <!-- Pagination bar -->
    <div v-if="totalItems > 0" class="flex-shrink-0 border-t border-app-border bg-app-surface px-3 sm:px-4 py-2">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm text-app-text-muted">
        <div class="flex items-center gap-2">
          <span>{{ ((currentPage - 1) * pageSize) + 1 }}-{{ Math.min(currentPage * pageSize, totalItems) }} / {{ totalItems }}</span>
          <select
            :value="pageSize"
            @change="$emit('update:pageSize', Number($event.target.value))"
            class="bg-app-bg border border-app-border rounded-lg px-2 py-1 text-app-text-primary text-xs"
          >
            <option v-for="opt in pageSizeOptions" :key="opt" :value="opt">{{ opt }} / trang</option>
          </select>
        </div>
        <div class="flex items-center gap-1">
          <button
            @click="$emit('update:currentPage', currentPage - 1)"
            :disabled="currentPage <= 1"
            class="px-2 py-1 rounded-lg hover:bg-app-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <template v-for="p in visiblePages" :key="p">
            <span v-if="p === '...'" class="px-1 text-app-text-muted">...</span>
            <button
              v-else
              @click="$emit('update:currentPage', p)"
              class="w-7 h-7 rounded-lg text-xs font-bold transition-colors"
              :class="p === currentPage ? 'bg-indigo-600 text-white' : 'hover:bg-app-bg text-app-text-secondary'"
            >{{ p }}</button>
          </template>
          <button
            @click="$emit('update:currentPage', currentPage + 1)"
            :disabled="currentPage >= totalPages"
            class="px-2 py-1 rounded-lg hover:bg-app-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue'

export const PAGE_SIZE_OPTIONS = [10, 20, 30]

export function usePageSize(viewKey, defaultSize = 10) {
  const storageKey = `pageSize_${viewKey}`
  const saved = localStorage.getItem(storageKey)
  const pageSize = ref(saved ? parseInt(saved, 10) : defaultSize)
  watch(pageSize, (val) => {
    localStorage.setItem(storageKey, val)
  })
  function setPageSize(size) {
    pageSize.value = size
  }
  return { pageSize, setPageSize, pageSizeOptions: PAGE_SIZE_OPTIONS }
}
</script>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  totalItems: { type: Number, default: 0 },
  currentPage: { type: Number, default: 1 },
  totalPages: { type: Number, default: 1 },
  pageSize: { type: Number, default: 10 },
  pageSizeOptions: { type: Array, default: () => [10, 20, 30] },
  selfScroll: { type: Boolean, default: false },
})

defineEmits(['update:currentPage', 'update:pageSize'])

const scrollContainer = ref(null)

const visiblePages = computed(() => {
  const total = props.totalPages
  const current = props.currentPage
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages = []
  pages.push(1)
  if (current > 3) pages.push('...')
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
})

defineExpose({ scrollContainer })
</script>
