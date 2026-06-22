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
          @click="onBackdrop"
        ></div>

        <!-- Modal Panel (P2.8b: role=dialog + aria-modal + focus-trap + Escape) -->
        <div
          ref="rootEl"
          role="dialog"
          aria-modal="true"
          :aria-label="ariaLabel"
          tabindex="-1"
          class="relative bg-app-surface border border-app-border shadow-2xl w-full sm:mx-4 flex flex-col max-h-[95vh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl transition-all duration-300 outline-none"
          :class="[sizeClass, radiusClass]"
          @keydown="onKeydown"
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
// Base modal shell. P2.8b accessibility hardening:
//  - role="dialog" + aria-modal="true" so screen readers announce a dialog.
//  - Escape closes (unless `persistent`); backdrop click closes (unless `persistent`).
//  - Focus trap: Tab/Shift-Tab cycle within the dialog only.
//  - On open, focus moves into the dialog (first focusable element, else the panel).
//  - On close, focus is restored to the element that opened the modal (the trigger),
//    including when the component is torn down while still open (onScopeDispose).
import { computed, ref, watch, nextTick, onScopeDispose } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  size: { type: String, default: 'md', validator: v => ['sm', 'md', 'lg', 'xl', 'full'].includes(v) },
  radius: { type: String, default: '' },
  zIndex: { type: Number, default: 50 },
  persistent: { type: Boolean, default: false },
  /** Accessible name for the dialog. Required for screen readers when the header
   *  is not associated via aria-labelledby. Parents should pass a meaningful label. */
  ariaLabel: { type: String, default: 'Hộp thoại' },
})

const emit = defineEmits(['update:modelValue'])

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

const rootEl = ref(null)
let lastFocused = null

/** Visible, focusable descendants of the dialog (the focus-trap boundary set). */
function getFocusable() {
  const root = rootEl.value
  if (!root) return []
  const nodes = root.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
  )
  return [...nodes].filter(el => el.offsetParent !== null)
}

function close() {
  if (props.persistent) return
  emit('update:modelValue', false)
}

function onBackdrop() {
  close()
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    // Only swallow Escape when the dialog actually owns focus (it opened a new
    // focus context); otherwise let it bubble (e.g. a child combobox dismissing).
    close()
    return
  }
  if (e.key !== 'Tab') return
  const f = getFocusable()
  if (f.length === 0) {
    // Nothing inside is focusable — keep focus on the panel itself.
    e.preventDefault()
    rootEl.value?.focus()
    return
  }
  const first = f[0]
  const last = f[f.length - 1]
  const active = document.activeElement
  if (e.shiftKey && (active === first || active === rootEl.value)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      // Remember the trigger so we can hand focus back on close.
      lastFocused = document.activeElement
      await nextTick()
      const f = getFocusable()
      if (f.length) f[0].focus()
      else rootEl.value?.focus()
    } else {
      restoreFocus()
    }
  }
)

function restoreFocus() {
  if (lastFocused && typeof lastFocused.focus === 'function') {
    lastFocused.focus()
  }
  lastFocused = null
}

// If a parent unmounts the modal mid-open (e.g. v-if on a wrapper), still hand
// focus back to the trigger instead of stranding it on the now-removed dialog.
onScopeDispose(() => {
  restoreFocus()
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
