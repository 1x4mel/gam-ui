<template>
  <div class="h-full flex flex-col">
    <!-- Desktop: Table -->
    <div
      ref="scrollRef"
      class="flex-1 overflow-auto bg-app-surface border border-app-border custom-scrollbar transition-all hover:shadow-xl"
      :class="[desktopClass, outerClass, roundedClass]"
      data-scroll
    >
      <table class="w-full text-sm" :style="minWidth ? { minWidth: `${minWidth}px` } : {}">
        <thead>
          <tr class="sticky top-0 z-10 text-app-text-muted text-[10px] font-black uppercase tracking-[0.2em] border-b border-app-border bg-app-surface">
            <slot name="header" />
          </tr>
        </thead>
        <tbody class="divide-y divide-app-border/30">
          <slot name="body" />
        </tbody>
      </table>
      <slot name="after-table" />
    </div>
    <!-- Mobile: Slot -->
    <div v-if="$slots.mobile" class="md:hidden flex-1 overflow-auto custom-scrollbar" :class="mobileClass" data-scroll>
      <slot name="mobile" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, useSlots } from 'vue'

const props = defineProps({
  minWidth: { type: Number, default: 0 },
  outerClass: { type: String, default: '' },
  rounded: { type: String, default: '2xl' },
  mobileClass: { type: String, default: '' },
})

const slots = useSlots()
const roundedClass = computed(() => `rounded-${props.rounded}`)
const desktopClass = computed(() => slots.mobile ? 'hidden md:block' : '')

const scrollRef = ref(null)
defineExpose({ scrollRef })
</script>
