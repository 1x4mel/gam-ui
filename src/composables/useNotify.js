import { ref, reactive } from 'vue'

const toasts = ref([])
const confirmState = reactive({
  isOpen: false,
  message: '',
  resolve: null,
  reject: null
})

export function useNotify() {
  const show = (message, type = 'info', duration = 3000) => {
    const id = Date.now()
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
    confirmState.message = message
    confirmState.isOpen = true
    
    return new Promise((resolve) => {
      confirmState.resolve = (result) => {
        confirmState.isOpen = false
        resolve(result)
      }
    })
  }

  return {
    toasts,
    confirmState,
    success,
    error,
    info,
    warn,
    remove,
    confirm
  }
}
