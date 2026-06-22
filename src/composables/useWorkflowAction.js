import { ref } from 'vue'
import { applyWorkflowAction } from '../api/index.js'
import { getOrderDoctype } from '../utils/format.js'

export function useWorkflowAction() {
  const processing = ref('')

  async function execute(order, action, { before, after, onError, extra } = {}) {
    if (processing.value) return
    processing.value = order.name
    try {
      if (before) before(order)
      const doctype = getOrderDoctype(order.name)
      await applyWorkflowAction(doctype, order.name, action, extra)
      if (after) await after(order)
    } catch (e) {
      if (onError) onError(e)
    } finally {
      processing.value = ''
    }
  }

  return { processing, execute }
}
