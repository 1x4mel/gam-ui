import { ref, computed, watch } from 'vue'
import { usePageSize } from '../components/PaginatedListLayout.vue'
import { useScrollMemory } from './useScrollMemory.js'

/**
 * Server-side pagination composable.
 *
 * @param {string} viewKey - Key for localStorage page size persistence
 * @param {Function} fetchFn - Async function (page, pageSize) => { data: [], total: number }
 * @param {Object} options
 * @param {number} options.defaultSize - Default page size (default: 10)
 * @param {Array} options.watchSources - Vue refs to watch; triggers refresh on change
 *
 * (Domain routing was removed during the F0 fork — views handle their own
 * detail navigation via useScrollMemory + router.push.)
 */
export function useServerPaginatedList(viewKey, fetchFn, { defaultSize = 10, watchSources = [] } = {}) {
  const { pageSize, setPageSize } = usePageSize(viewKey, defaultSize)

  const currentPage = ref(1)
  const totalItems = ref(0)
  const items = ref([])
  const loading = ref(false)
  const error = ref(null)

  const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / pageSize.value)))

  function goToPage(page) {
    const p = Math.max(1, Math.min(page, totalPages.value))
    if (p !== currentPage.value) {
      currentPage.value = p
    }
  }

  // Monotonic fetch id so a slow in-flight request can never overwrite the
  // result of a faster newer one (rapid filter/page-size changes).
  let fetchId = 0

  async function refresh() {
    const myId = ++fetchId
    loading.value = true
    error.value = null
    try {
      const result = await fetchFn(currentPage.value, pageSize.value)
      // A newer fetch was kicked off after this one started — drop the stale
      // result so it can't clobber the latest view.
      if (myId !== fetchId) return
      items.value = result.data
      totalItems.value = result.total
    } catch (e) {
      if (myId !== fetchId) return
      error.value = e
      items.value = []
      totalItems.value = 0
      console.error('[useServerPaginatedList] fetch error:', e)
    } finally {
      if (myId === fetchId) loading.value = false
    }
  }

  // Re-fetch when page or page size changes.
  // `immediate: true` is required so the first page loads on mount — the views
  // relying on this composable do not call refresh() themselves on initial load,
  // so without this the list would stay empty until a filter/page-size change.
  watch([currentPage, pageSize], () => refresh(), { immediate: true })

  // Re-fetch when watched sources (filters, tab, etc.) change; reset to page 1
  if (watchSources.length) {
    watch(watchSources, () => {
      currentPage.value = 1
      refresh()
    }, { deep: true })
  }

  const { setLastViewed, handleScrollRestoration } = useScrollMemory()

  return {
    items,
    totalItems,
    currentPage,
    totalPages,
    pageSize,
    setPageSize,
    loading,
    error,
    goToPage,
    refresh,
    retry: refresh,
    setLastViewed,
    handleScrollRestoration,
  }
}
