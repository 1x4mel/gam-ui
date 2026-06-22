import { ref } from 'vue'
import { usePageSize } from '../components/PaginatedListLayout.vue'
import { usePagination } from './usePagination.js'
import { useScrollMemory } from './useScrollMemory.js'

/**
 * Client-side pagination helper over an already-loaded list.
 * (Domain routing was removed during the F0 fork — views handle their own
 * detail navigation via useScrollMemory + router.push.)
 */
export function usePaginatedList(viewKey, sourceList, { defaultSize = 20 } = {}) {
  const { pageSize, setPageSize } = usePageSize(viewKey, defaultSize)
  const { currentPage, totalPages, paginatedItems, goToPage } = usePagination(sourceList, pageSize)
  const { setLastViewed, handleScrollRestoration } = useScrollMemory()

  const listLayout = ref(null)
  function getScrollContainer() {
    return listLayout.value?.scrollContainer || null
  }

  return {
    pageSize, setPageSize,
    currentPage, totalPages, paginatedItems, goToPage,
    listLayout, getScrollContainer,
    setLastViewed, handleScrollRestoration,
  }
}
