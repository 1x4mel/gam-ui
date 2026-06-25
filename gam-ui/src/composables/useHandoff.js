import { ref } from 'vue'
import { frappeCall } from '../api/index.js'

/**
 * useHandoff — shift handoff (bàn giao ca) + online session chain telemetry.
 *
 * Backend:
 *  - gam.api.handoff_account(account, to_user, order_ref?, notes?, force?)
 *      → {new_lease, chain_online_seconds, cap_hours}. Atomic close of the
 *        holder's lease + open of the receiver's lease on the SAME chain
 *        (no online gap). The receiver must have L2 access to the account.
 *  - gam.api.get_chain_online(account)
 *      → {chain_online_seconds, cap_hours, cap_seconds, remaining_seconds,
 *         over_cap, percent}.
 *  - gam.api.get_handoff_candidates(account)
 *      → [{name, full_name}] enabled GAM users with access (excludes holder).
 *  - gam.api.decline_handoff(account) → reopens the chain for the prev holder.
 *
 * UI terminology:
 *   "Bàn giao ca" (handoff) = chuyển account đang checkin cho user khác tiếp tục
 *   dùng mà account không logout giữa chừng. Chain = chuỗi online liên tục.
 */
export function useHandoff() {
  const loading = ref(false)
  const error = ref('')

  async function handoff({ account, toUser, orderRef = '', notes = '', force = false }) {
    loading.value = true
    error.value = ''
    try {
      const payload = { account, to_user: toUser }
      if (orderRef) payload.order_ref = orderRef
      if (notes) payload.notes = notes
      if (force) payload.force = 1
      return await frappeCall('gam.api.handoff_account', payload)
    } catch (e) {
      error.value = e.message || 'Bàn giao ca thất bại'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function getChainOnline(account) {
    return frappeCall('gam.api.get_chain_online', { account })
  }

  async function getCandidates(account) {
    return frappeCall('gam.api.get_handoff_candidates', { account })
  }

  async function decline({ account }) {
    loading.value = true
    error.value = ''
    try {
      return await frappeCall('gam.api.decline_handoff', { account })
    } catch (e) {
      error.value = e.message || 'Từ chối ca thất bại'
      throw e
    } finally {
      loading.value = false
    }
  }

  return { loading, error, handoff, getChainOnline, getCandidates, decline }
}
