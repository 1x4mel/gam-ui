<template>
  <div class="flex flex-col h-full" @dragover.prevent="$emit('dragover', $event)" @dragleave.prevent="$emit('dragleave', $event)" @drop.prevent="$emit('drop', $event)">
    <div v-if="$slots.toolbar" class="flex-shrink-0 pb-4">
      <div :class="[maxWidth, 'mx-auto px-4']">
        <slot name="toolbar" />
      </div>
    </div>

    <div ref="scrollContainer" class="flex-1 overflow-auto min-h-0 custom-scrollbar">
      <div :class="[maxWidth, 'mx-auto px-4']">
        <LoadingSpinner v-if="loading" size="lg" :text="loadingText" />
        <slot v-else />
      </div>
    </div>

    <slot name="modals" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import LoadingSpinner from './LoadingSpinner.vue'

defineProps({
  loading: { type: Boolean, default: false },
  loadingText: { type: String, default: '' },
  maxWidth: { type: String, default: 'max-w-4xl' },
})


defineEmits(["dragover", "dragleave", "drop"])
const scrollContainer = ref(null)

defineExpose({ scrollContainer })
</script>
