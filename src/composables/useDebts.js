import { ref } from 'vue'
import { frappeCall } from '../api/index.js'

const debtsCache = ref(null)
const loading = ref(false)

export function useDebts() {
  async function fetchDebts() {
    loading.value = true
    try {
      const result = await frappeCall('gege_custom.gege_custom.api.debt.get_debts_by_party')
      debtsCache.value = result
      return result
    } finally {
      loading.value = false
    }
  }

  return { debts: debtsCache, loading, fetchDebts }
}
