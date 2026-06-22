import { ref } from 'vue'
import { frappeCall } from '../api/index.js'

const partyListCache = ref(null)
const loading = ref(false)

export function usePartyList() {
  async function fetchPartyList() {
    loading.value = true
    try {
      const result = await frappeCall('gege_custom.gege_custom.api.debt.get_all_party_statements')
      partyListCache.value = result
      return result
    } finally {
      loading.value = false
    }
  }

  return { partyList: partyListCache, loading, fetchPartyList }
}
