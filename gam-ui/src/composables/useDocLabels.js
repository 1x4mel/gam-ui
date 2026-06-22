import { ref, watch } from 'vue'
import { frappeCall } from '../api/index.js'

/**
 * Batch-resolve human-readable labels for GAM doc-name IDs (Req #2 / #3).
 *
 * Watches a reactive list of row objects, collects the unique GAM Account and
 * GAM Email doc names found via configurable extractor functions, calls
 * `gam.api.resolve_doc_names` once for the names that are not yet cached, and
 * exposes fast synchronous lookup helpers for use in templates.
 *
 * @param {import('vue').Ref<Array>} items - reactive list of row objects
 * @param {Object} extractors - maps doctype → function(row) => name|''
 *   e.g. { 'GAM Account': r => r.account, 'GAM Email': r => r.target_email }
 * @returns {{ labels, labelFor, accountMeta, accountLabel, accountGame, emailLabel }}
 */
export function useDocLabels(items, extractors = {}) {
  // Structure: { 'GAM Account': { '<name>': { label, platform, main_game_name } },
  //              'GAM Email': { '<name>': { label } } }
  const labels = ref({})

  function collectMissing() {
    const found = {}
    const rows = items.value || []
    for (const row of rows) {
      for (const [dt, fn] of Object.entries(extractors)) {
        const name = fn(row)
        if (!name) continue
        if (!found[dt]) found[dt] = new Set()
        found[dt].add(name)
      }
    }
    const payload = {}
    for (const [dt, set] of Object.entries(found)) {
      const cached = labels.value[dt] || {}
      const missing = [...set].filter((n) => !cached[n])
      if (missing.length) payload[dt] = missing
    }
    return payload
  }

  async function resolve() {
    const payload = collectMissing()
    if (!Object.keys(payload).length) return
    try {
      const res = await frappeCall('gam.api.resolve_doc_names', { mappings: payload })
      if (!res) return
      const merged = { ...labels.value }
      for (const [dt, map] of Object.entries(res)) {
        merged[dt] = { ...(merged[dt] || {}), ...map }
      }
      labels.value = merged
    } catch (e) {
      console.error('[useDocLabels] resolve failed:', e)
    }
  }

  // `items.value` is replaced wholesale on each fetch, so even a shallow watch
  // fires reliably. `deep` covers in-place mutations too.
  watch(items, resolve, { deep: true, immediate: true })

  /** Generic label lookup (falls back to the raw name). */
  function labelFor(doctype, name) {
    if (!name) return ''
    const dt = labels.value[doctype]
    return dt && dt[name] && dt[name].label ? dt[name].label : name
  }

  /** Returns the full account meta object or null. */
  function accountMeta(name) {
    if (!name) return null
    const dt = labels.value['GAM Account']
    return (dt && dt[name]) || null
  }

  /** Account username (falls back to raw name). */
  function accountLabel(name) {
    const m = accountMeta(name)
    return (m && m.label) || name || ''
  }

  /** Main game name for an account (or ''). */
  function accountGame(name) {
    const m = accountMeta(name)
    return (m && m.main_game_name) || ''
  }

  /** Email address label (falls back to raw name). */
  function emailLabel(name) {
    if (!name) return ''
    const dt = labels.value['GAM Email']
    return dt && dt[name] && dt[name].label ? dt[name].label : name
  }

  return { labels, labelFor, accountMeta, accountLabel, accountGame, emailLabel }
}
