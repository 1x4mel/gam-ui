import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePageSize } from '../components/PaginatedListLayout.vue'
import { usePagination } from './usePagination.js'
import { useScrollMemory } from './useScrollMemory.js'
import { getOrderType } from '../utils/format.js'

export function usePaginatedList(viewKey, sourceList, { defaultSize = 20 } = {}) {
  const router = useRouter()
  const { pageSize, setPageSize } = usePageSize(viewKey, defaultSize)
  const { currentPage, totalPages, paginatedItems, goToPage } = usePagination(sourceList, pageSize)
  const { setLastViewed, handleScrollRestoration } = useScrollMemory()

  const listLayout = ref(null)
  function getScrollContainer() {
    return listLayout.value?.scrollContainer || null
  }

  function goToDetail(order) {
    setLastViewed(order.name)
    router.push(`/order/${getOrderType(order.name)}/${order.name}`)
  }

  return {
    pageSize, setPageSize,
    currentPage, totalPages, paginatedItems, goToPage,
    listLayout, getScrollContainer,
    setLastViewed, handleScrollRestoration, goToDetail,
  }
}
