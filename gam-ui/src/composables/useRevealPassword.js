import { ref, onUnmounted } from 'vue'
import { frappeCall } from '../api/index.js'

/**
 * Reveal / copy a Frappe Password field with an audit trail.
 *
 * Backend: `gam.api.reveal_password(doctype, name, fieldname, action)` returns
 * `{ password }` and writes a GAM Reveal Log row (IP, User-Agent, etc.).
 *
 * Per Design §5.6 the plaintext is cached locally (60s) so toggling hide/show
 * does not call the API twice, and a copy uses action="COPY".
 */
const CACHE_TTL = 60 * 1000 // 60s

export function useRevealPassword() {
  // Cache keyed by `${doctype}|${name}|${fieldname}` → { value, expiresAt }
  const cache = new Map()
  const timers = new Map()

  const loading = ref(false)
  const error = ref('')

  function cacheKey(doctype, name, fieldname) {
    return `${doctype}|${name}|${fieldname}`
  }

  function clearCache(key) {
    cache.delete(key)
    if (timers.has(key)) {
      clearTimeout(timers.get(key))
      timers.delete(key)
    }
  }

  function setCached(key, value) {
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL })
    if (timers.has(key)) clearTimeout(timers.get(key))
    timers.set(key, setTimeout(() => clearCache(key), CACHE_TTL))
  }

  function getCached(key) {
    const entry = cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      clearCache(key)
      return null
    }
    return entry.value
  }

  async function reveal(doctype, name, fieldname) {
    const key = cacheKey(doctype, name, fieldname)
    const cached = getCached(key)
    if (cached !== null) return cached

    loading.value = true
    error.value = ''
    try {
      const res = await frappeCall('gam.api.reveal_password', {
        doctype, name, fieldname, action: 'REVEAL',
      })
      const value = res?.password ?? ''
      setCached(key, value)
      return value
    } catch (e) {
      error.value = e.message || 'Không xem được mật khẩu'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function copy(doctype, name, fieldname) {
    loading.value = true
    error.value = ''
    try {
      const res = await frappeCall('gam.api.reveal_password', {
        doctype, name, fieldname, action: 'COPY',
      })
      const value = res?.password ?? ''
      // also refresh cache so a subsequent reveal is free
      setCached(cacheKey(doctype, name, fieldname), value)
      return value
    } catch (e) {
      error.value = e.message || 'Không copy được mật khẩu'
      throw e
    } finally {
      loading.value = false
    }
  }

  function forget(doctype, name, fieldname) {
    clearCache(cacheKey(doctype, name, fieldname))
  }

  function clearAll() {
    for (const key of [...timers.keys()]) clearCache(key)
  }

  onUnmounted(clearAll)

  return { loading, error, reveal, copy, forget, clearAll }
}
