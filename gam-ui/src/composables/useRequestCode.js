import { ref, computed, onUnmounted } from 'vue'
import { frappeCall } from '../api/index.js'
import { toEpochMs } from '../utils/format.js'

/**
 * Request a verification code for a GAM Email / GAM Account.
 *
 * Backend: `gam.api.request_code(email_name, account_name, platform)` atomically
 * claims the freshest AVAILABLE GAM Email Code, writes a Code Request Log and
 * returns `{ status: 'ok', code, platform, expires_at }` or `{ status: 'no_code' }`.
 *
 * Per Design §5.7 the returned code is shown large with a live countdown to
 * `expires_at`, and is CLAIMED so other members see "no code".
 */
export function useRequestCode() {
  const loading = ref(false)
  const error = ref('')
  const result = ref(null) // { status, code, platform, expires_at, claimed_at }

  const hasCode = computed(() => result.value?.status === 'ok' && !!result.value?.code)

  let countdownTimer = null
  const remainingSeconds = ref(0)

  function startCountdown(expiresAt) {
    stopCountdown()
    if (!expiresAt) return
    const tick = () => {
      const ms = toEpochMs(expiresAt) - Date.now()
      remainingSeconds.value = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0
      if (remainingSeconds.value <= 0) stopCountdown()
    }
    tick()
    countdownTimer = setInterval(tick, 1000)
  }

  function stopCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }

  async function request({ emailName, accountName, platform } = {}) {
    loading.value = true
    error.value = ''
    try {
      const res = await frappeCall('gam.api.request_code', {
        email_name: emailName || undefined,
        account_name: accountName || undefined,
        platform: platform || undefined,
      })
      result.value = res
      if (res?.status === 'ok' && res?.expires_at) startCountdown(res.expires_at)
      return res
    } catch (e) {
      error.value = e.message || 'Không lấy được mã'
      throw e
    } finally {
      loading.value = false
    }
  }

  function reset() {
    result.value = null
    error.value = ''
    remainingSeconds.value = 0
    stopCountdown()
  }

  onUnmounted(stopCountdown)

  return { loading, error, result, hasCode, remainingSeconds, request, reset }
}
