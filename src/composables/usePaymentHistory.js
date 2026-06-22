import { ref, watch } from 'vue'
import { getList } from '../api/index.js'

export function usePaymentHistory(order, invoiceField) {
  const paymentHistory = ref([])

  async function loadPaymentHistory() {
    const invoiceName = typeof invoiceField === 'function' ? invoiceField() : invoiceField
    if (!invoiceName) { paymentHistory.value = []; return }
    try {
      const refs = await getList('Payment Entry Reference', {
        fields: ['parent as name', 'parenttype', 'allocated_amount'],
        filters: [['reference_name', '=', invoiceName], ['docstatus', '=', 1]],
        limit: 20,
      })
      if (!refs.length) { paymentHistory.value = []; return }
      const peNames = [...new Set(refs.map(r => r.name))]
      const pes = await getList('Payment Entry', {
        fields: ['name', 'paid_amount', 'posting_date', 'reference_no'],
        filters: [['name', 'in', peNames], ['docstatus', '=', 1]],
        limit: 20,
      })
      paymentHistory.value = pes
    } catch { paymentHistory.value = [] }
  }

  const unwatch = watch(
    () => typeof invoiceField === 'function' ? invoiceField() : invoiceField,
    () => loadPaymentHistory(),
    { immediate: true }
  )

  return { paymentHistory, loadPaymentHistory }
}
