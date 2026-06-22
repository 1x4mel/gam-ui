import { ref } from 'vue'
import { frappeCall } from '../api/index.js'

/**
 * Account lease lifecycle — "hotel metaphor" (Req #4).
 *
 * IMPORTANT — terminology flip (backend method names are UNCHANGED):
 *   UI "Checkin"  (start using)  →  checkout_account()  →  status IN_USE
 *   UI "Checkout" (finish, auto-duration)  →  checkin_account()  →  status RELEASED
 *   UI "Force Checkout" (admin reclaim)    →  admin_force_release()  →  FORCE_RELEASED
 *
 * Backend:
 *  - gam.api.checkout_account(account, purpose, lease_minutes?, order_ref?, notes?)
 *    → creates a GAM Account Usage (status=IN_USE, ignore_permissions) and returns
 *      the usage doc. lease_minutes is OPTIONAL — when omitted the server uses the
 *      GAM Settings `hard_cap_online_hours` so forgotten leases still auto-release.
 *  - gam.api.checkin_account(account, end_reason, notes)
 *    → releases the active lease (status=RELEASED) and returns the usage doc.
 *  - gam.api.admin_force_release(account, reason?) — GAM Admin / System Manager only.
 */
export function useCheckout() {
  const loading = ref(false)
  const error = ref('')

  /**
   * Checkin = START using (backend checkout_account).
   * `leaseMinutes` is optional; omit it so the server applies the hard cap.
   */
  async function checkout({ account, purpose = '', leaseMinutes = null, orderRef = '', notes = '' }) {
    loading.value = true
    error.value = ''
    try {
      const payload = {
        account,
        purpose: purpose || 'LOGIN',
        notes: notes || undefined,
      }
      // Only send lease_minutes/order_ref when explicitly provided (keep the
      // start modal minimal: just Purpose + Notes).
      if (leaseMinutes != null && leaseMinutes !== '') payload.lease_minutes = leaseMinutes
      if (orderRef) payload.order_ref = orderRef
      return await frappeCall('gam.api.checkout_account', payload)
    } catch (e) {
      error.value = e.message || 'Checkin thất bại'
      throw e
    } finally {
      loading.value = false
    }
  }

  /** Checkout = FINISH using (backend checkin_account). Duration auto-computed server-side. */
  async function checkin({ account, endReason = 'DONE', notes = '' }) {
    loading.value = true
    error.value = ''
    try {
      return await frappeCall('gam.api.checkin_account', {
        account,
        end_reason: endReason,
        notes: notes || undefined,
      })
    } catch (e) {
      error.value = e.message || 'Checkout thất bại'
      throw e
    } finally {
      loading.value = false
    }
  }

  /** Force Checkout = admin reclaim an active lease held by someone else. */
  async function forceRelease({ account, reason = '' }) {
    loading.value = true
    error.value = ''
    try {
      return await frappeCall('gam.api.admin_force_release', {
        account,
        reason: reason || undefined,
      })
    } catch (e) {
      error.value = e.message || 'Force checkout thất bại'
      throw e
    } finally {
      loading.value = false
    }
  }

  return { loading, error, checkout, checkin, forceRelease }
}
