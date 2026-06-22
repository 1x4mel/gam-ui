import { ref } from 'vue'
import { frappeCall } from '../api/index.js'

export function usePartyStatement() {
  const statement = ref(null)
  const loading = ref(false)

  async function fetchStatement(partyType, party, fromDate, toDate) {
    loading.value = true
    try {
      const result = await frappeCall('gege_custom.gege_custom.api.debt.get_party_statement', {
        party_type: partyType,
        party: party,
        from_date: fromDate || '',
        to_date: toDate || '',
      })
      statement.value = result
      return result
    } finally {
      loading.value = false
    }
  }

  return { statement, loading, fetchStatement }
}
