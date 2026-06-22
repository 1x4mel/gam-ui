import { ref, onUnmounted } from 'vue'
import { generateTotp, totpWindowInfo } from '../utils/totp.js'

/**
 * Live TOTP code generator (Design §5.6 / §8.2 step 5).
 *
 * `getSecret` is an async resolver that returns the *decrypted* `totp_secret`.
 * It is typically backed by [`useRevealPassword`](../composables/useRevealPassword.js)
 * so the audited `gam.api.reveal_password` call happens exactly once and the
 * value is cached; the audited secret never has to be fetched again while the
 * widget stays open.
 *
 * The composable recomputes the 6-digit code whenever the time-step window
 * rolls over and exposes a smooth 1s countdown + progress for the UI.
 *
 * @param {() => Promise<string>} getSecret async resolver → plaintext secret
 * @param {{ period?: number, digits?: number }} [options]
 */
export function useTotpCode(getSecret, options = {}) {
  const period = options.period ?? 30
  const digits = options.digits ?? 6

  const code = ref('')
  const secondsLeft = ref(period)
  const progress = ref(1)
  const loading = ref(false)
  const error = ref('')
  const running = ref(false)

  let timer = null
  let lastCounter = -1
  /** Cached in-flight secret promise so the audited API call is made once. */
  let secretPromise = null

  function ensureSecret() {
    if (secretPromise) return secretPromise
    loading.value = true
    error.value = ''
    secretPromise = Promise.resolve(getSecret()).finally(() => {
      loading.value = false
    })
    return secretPromise
  }

  async function tick() {
    const info = totpWindowInfo(period)
    secondsLeft.value = info.secondsLeft
    progress.value = info.progress
    if (info.counter === lastCounter) return // same window → keep cached code
    lastCounter = info.counter
    try {
      const secret = await ensureSecret()
      code.value = secret ? await generateTotp(secret, { period, digits }) : ''
    } catch (e) {
      error.value = e?.message || 'Không lấy được mã TOTP'
      secretPromise = null // allow retry on next window
    }
  }

  function start() {
    if (running.value) return
    running.value = true
    tick()
    timer = setInterval(tick, 1000)
  }

  function stop() {
    running.value = false
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  /** Stop, clear the code and reset the secret cache so a fresh reveal is required. */
  function reset() {
    stop()
    lastCounter = -1
    secretPromise = null
    code.value = ''
    error.value = ''
  }

  // Clear the cached secret + interval on unmount so the audited TOTP secret
  // does not linger in memory once the widget leaves the DOM.
  onUnmounted(reset)

  return { code, secondsLeft, progress, loading, error, running, start, stop, reset }
}
