import { onMounted, onUnmounted } from 'vue'
import { useRealtime } from './useRealtime.js'

export function useRealtimeSubscriptions(subscriptions, { onMount } = {}) {
  // subscriptions: { 'DocType': callback }
  // onMount: async function to call before subscribing (e.g., loadData)
  const { connected, subscribe, unsubscribe, on, off } = useRealtime()

  onMounted(async () => {
    if (onMount) await onMount()
    Object.entries(subscriptions).forEach(([doctype, callback]) => {
      subscribe(doctype, callback)
    })
  })

  onUnmounted(() => {
    Object.keys(subscriptions).forEach(doctype => {
      unsubscribe(doctype)
    })
  })

  return { connected, on, off }
}
