import { ref, reactive } from 'vue'

const toasts = ref([])
const confirmState = reactive({
  isOpen: false,
  message: '',
  resolve: null,
  reject: null
})

// Monotonic id source so two toasts created in the same millisecond tick
// (e.g. a batch of API failures) never collide — collisions broke removal.
let _seq = 0
const MAX_TOASTS = 5

export function useNotify() {
  const show = (message, type = 'info', duration = 3000) => {
    const id = Date.now() * 1000 + (++_seq % 1000)
    // Cap concurrent toasts so a runaway loop can't spam the DOM.
    if (toasts.value.length >= MAX_TOASTS) {
      toasts.value = toasts.value.slice(-(MAX_TOASTS - 1))
    }
    toasts.value.push({ id, message, type })

    if (duration > 0) {
      setTimeout(() => remove(id), duration)
    }
    return id
  }

  const remove = (id) => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  const success = (msg) => show(msg, 'success')
  const error = (msg) => show(msg, 'error')
  const info = (msg) => show(msg, 'info')
  const warn = (msg) => show(msg, 'warning')

  const confirm = (message) => {
    // Settle any prior pending confirm (resolve false) so its caller's
    // Promise doesn't leak forever when superseded by a new dialog.
    if (confirmState.isOpen && confirmState.resolve) {
      const prev = confirmState.resolve
      confirmState.isOpen = false
      confirmState.resolve = null
      confirmState.reject = null
      prev(false)
    }

    confirmState.message = message
    confirmState.isOpen = true

    return new Promise((resolve, reject) => {
      confirmState.resolve = (result) => {
        confirmState.isOpen = false
        confirmState.resolve = null
        confirmState.reject = null
        resolve(result)
      }
      confirmState.reject = reject
    })
  }

  /** Programmatic dismiss (overlay click / escape): resolves the pending
   * confirm as false so callers settle cleanly. */
  const dismissConfirm = () => {
    if (!confirmState.isOpen) return
    const r = confirmState.resolve
    confirmState.isOpen = false
    confirmState.resolve = null
    confirmState.reject = null
    if (r) r(false)
  }

  return {
    toasts,
    confirmState,
    success,
    error,
    info,
    warn,
    remove,
    confirm,
    dismissConfirm
  }
}
