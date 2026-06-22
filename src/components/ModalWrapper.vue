<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4"
        :style="{ zIndex: zIndex }"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="!persistent && $emit('update:modelValue', false)"
        ></div>

        <!-- Modal Panel -->
        <div
          class="relative bg-app-surface border border-app-border shadow-2xl w-full sm:mx-4 flex flex-col max-h-[95vh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl transition-all duration-300"
          :class="[sizeClass, radiusClass]"
        >
          <!-- Header -->
          <div v-if="$slots.header">
            <slot name="header" />
          </div>

          <!-- Body -->
          <div class="overflow-y-auto flex-1">
            <slot />
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="px-8 pb-8 pt-4 flex gap-4 justify-end">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  size: { type: String, default: 'md', validator: v => ['sm', 'md', 'lg', 'xl', 'full'].includes(v) },
  radius: { type: String, default: '' },
  zIndex: { type: Number, default: 50 },
  persistent: { type: Boolean, default: false },
})

defineEmits(['update:modelValue'])

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'sm:max-w-sm'
  if (props.size === 'lg') return 'sm:max-w-2xl'
  if (props.size === 'xl') return 'sm:max-w-4xl'
  if (props.size === 'full') return 'sm:max-w-6xl'
  return 'sm:max-w-lg'
})

const radiusClass = computed(() => {
  if (props.radius) return `sm:rounded-${props.radius}`
  return ''
})
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: translateY(100%);
}
@media (min-width: 640px) {
  .modal-enter-from > div:last-child,
  .modal-leave-to > div:last-child {
    transform: scale(0.95);
  }
}
</style>
