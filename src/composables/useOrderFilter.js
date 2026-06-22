import { computed } from 'vue'
import { matchesSearch } from './useOrderSearch.js'

/**
 * Shared filter + sort logic for order list views.
 *
 * @param {import('vue').Ref<Array>} sourceList  - reactive ref holding the raw order array
 * @param {Object} filters - object of reactive refs
 * @param {import('vue').Ref<string>} [filters.search]       - universal search query
 * @param {import('vue').Ref<string>} [filters.filterGame]   - game_context filter
 * @param {import('vue').Ref<string>} [filters.filterItem]   - currency_item filter (incl. child items)
 * @param {import('vue').Ref<string>} [filters.sortOrder]    - 'desc' | 'asc'  (by creation date)
 * @param {Array<(item: object) => boolean>} [filters.extraFilters] - additional filter functions
 * @returns {{ filteredList: import('vue').ComputedRef<Array> }}
 */
export function useOrderFilter(sourceList, filters) {
  const filteredList = computed(() => {
    let list = sourceList.value

    // 1. Game filter
    if (filters.filterGame?.value) {
      list = list.filter(o => o.game_context === filters.filterGame.value)
    }

    // 2. Item filter (top-level or child items)
    if (filters.filterItem?.value) {
      const item = filters.filterItem.value
      list = list.filter(o =>
        o.currency_item === item ||
        (o.items || []).some(i => i.currency_item === item),
      )
    }

    // 3. Universal search
    if (filters.search?.value) {
      list = list.filter(o => matchesSearch(o, filters.search.value))
    }

    // 4. Extra filters (view-specific)
    if (filters.extraFilters) {
      for (const fn of filters.extraFilters) {
        list = list.filter(fn)
      }
    }

    // 5. Sort by latest activity
    const order = filters.sortOrder?.value || 'desc'
    list.sort((a, b) => {
      const ta = a.latest_activity?.creation
      const tb = b.latest_activity?.creation
      let diff
      if (ta && tb) diff = new Date(tb) - new Date(ta)
      else if (ta) diff = -1
      else if (tb) diff = 1
      else diff = new Date(b.creation) - new Date(a.creation)
      return order === 'desc' ? diff : -diff
    })

    return list
  })

  return { filteredList }
}
