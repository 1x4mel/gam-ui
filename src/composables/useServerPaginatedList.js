import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePageSize } from '../components/PaginatedListLayout.vue'
import { useScrollMemory } from './useScrollMemory.js'
import { getOrderType } from '../utils/format.js'

/**
 * Server-side pagination composable.
 * Replaces usePaginatedList for views that fetch paginated data from the server.
 *
 * @param {string} viewKey - Key for localStorage page size persistence
 * @param {Function} fetchFn - Async function (page, pageSize) => { data: [], total: number }
 * @param {Object} options
 * @param {number} options.defaultSize - Default page size (default: 10)
 * @param {Array} options.watchSources - Vue refs to watch; triggers refresh on change
 */
export function useServerPaginatedList(viewKey, fetchFn, { defaultSize = 10, watchSources = [] } = {}) {
  const router = useRouter()
  const { pageSize, setPageSize } = usePageSize(viewKey, defaultSize)

  const currentPage = ref(1)
  const totalItems = ref(0)
  const items = ref([])
  const loading = ref(false)

  const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / pageSize.value)))

  function goToPage(page) {
    const p = Math.max(1, Math.min(page, totalPages.value))
    if (p !== currentPage.value) {
      currentPage.value = p
    }
  }

  async function refresh() {
    loading.value = true
    try {
      const result = await fetchFn(currentPage.value, pageSize.value)
      items.value = result.data
      totalItems.value = result.total
    } catch (e) {
      console.error('[useServerPaginatedList] fetch error:', e)
    } finally {
      loading.value = false
    }
  }

  // Re-fetch when page or page size changes
  watch([currentPage, pageSize], () => refresh())

  // Re-fetch when watched sources (filters, tab, etc.) change; reset to page 1
  if (watchSources.length) {
    watch(watchSources, () => {
      currentPage.value = 1
      refresh()
    }, { deep: true })
  }

  const { setLastViewed, handleScrollRestoration } = useScrollMemory()

  function goToDetail(order) {
    setLastViewed(order.name)
    router.push(`/order/${getOrderType(order.name)}/${order.name}`)
  }

  return {
    items,
    totalItems,
    currentPage,
    totalPages,
    pageSize,
    setPageSize,
    loading,
    goToPage,
    refresh,
    setLastViewed,
    handleScrollRestoration,
    goToDetail,
  }
}
