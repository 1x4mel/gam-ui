import { watch } from 'vue'
import { useRoute } from 'vue-router'

/**
 * Sync reactive refs to localStorage for filter persistence.
 * Replaces the old URL query param approach with localStorage-based storage.
 *
 * @param {Object} options
 * @param {string} [options.storageKey] - localStorage key (default: 'gege_order_filters')
 * @param {string[]} options.routeNames - Only sync when route.name is in this list
 * @param {Object} options.params - Map of refName -> ref to sync
 * @param {Object} [options.queryMap] - Map of refName -> storage key (default: same as refName) - kept for API compat
 * @param {Object} [options.defaults] - Map of refName -> default value (omitted from storage when equal)
 */
export function useOrderUrlSync({ storageKey = 'gege_order_filters', routeNames, params, queryMap = {}, defaults = {} }) {
  const route = useRoute()

  const paramEntries = Object.entries(params)

  function loadFromStorage() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '{}')
      paramEntries.forEach(([key, ref]) => {
        if (stored[key] !== undefined && stored[key] !== null) {
          ref.value = stored[key]
        } else if (defaults[key]) {
          ref.value = defaults[key]
        }
      })
    } catch {}
  }

  function saveToStorage() {
    try {
      const data = {}
      paramEntries.forEach(([key, ref]) => {
        const val = ref.value
        const def = defaults[key] || ''
        if (val && val !== def) {
          data[key] = val
        }
      })
      localStorage.setItem(storageKey, JSON.stringify(data))
    } catch {}
  }

  if (routeNames.includes(route.name)) loadFromStorage()

  const refs = paramEntries.map(([, ref]) => ref)
  watch(refs, () => {
    if (routeNames.includes(route.name)) saveToStorage()
  })

  return {}
}

export { useOrderUrlSync as useUrlSync }
