import { ref, computed, unref, watch, onActivated, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { debounce } from 'lodash-es'
import { frappeCall } from '../api/index.js'
import { normalizeOrderInPlace } from '../utils/normalizeOrder.js'
import { syncArray } from '../utils/sync.js'
import { getOrderType } from '../utils/format.js'
import { usePageSize } from './usePageSize.js'
import { useScrollMemory } from './useScrollMemory.js'

export function useOrdersPaginated({ category, sub, filters, defaultSize = 20 }) {
  const router = useRouter()
  let { pageSize, setPageSize } = usePageSize('orders', defaultSize)
  const currentPage = ref(1)
  const totalItems = ref(0)
  const items = ref([])
  const loading = ref(false)
  const statusCounts = ref({})
  const sellCount = ref(0)
  const buyCount = ref(0)
  const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / pageSize.value)))

  function goToPage(page) {
    const p = Math.max(1, Math.min(page, totalPages.value))
    if (p !== currentPage.value) currentPage.value = p
  }

  let fetchPromise = null

  function getScrollContainer() {
    return document.querySelector('[data-scroll-container]') || document.scrollingElement || window
  }

  async function refresh({ preserveScroll = true } = {}) {
    if (fetchPromise) return fetchPromise

    let savedScroll = 0
    if (preserveScroll) {
      const el = getScrollContainer()
      savedScroll = el === window ? window.scrollY : el.scrollTop
    }

    loading.value = true
    fetchPromise = (async () => {
      try {
        const result = await frappeCall('gege_custom.gege_custom.api.orders.get_orders', {
          category: unref(category),
          sub: unref(sub),
          page: currentPage.value,
          page_size: pageSize.value,
          search: unref(filters.search) || undefined,
          filter_game: unref(filters.filterGame) || undefined,
          filter_item: unref(filters.filterItem) || undefined,
          filter_status: unref(filters.filterStatus) || undefined,
          date_from: unref(filters.dateFrom) || undefined,
          date_to: unref(filters.dateTo) || undefined,
          sort_order: unref(filters.sortOrder) || 'desc',
        })

        const data = result.data || []
        for (const order of data) {
          normalizeOrderInPlace(order, order.order_type)
        }
        syncArray(items.value, data)
        totalItems.value = result.total || 0
        statusCounts.value = result.status_counts || {}
        sellCount.value = result.sell_count || 0
        buyCount.value = result.buy_count || 0
      } catch (e) {
        console.error('[useOrdersPaginated] fetch error:', e)
      } finally {
        loading.value = false
        fetchPromise = null
        if (preserveScroll) {
          await nextTick()
          const el = getScrollContainer()
          if (el === window) {
            window.scrollTo(0, savedScroll)
          } else {
            el.scrollTop = savedScroll
          }
        }
      }
    })()

    return fetchPromise
  }

  const debouncedRefresh = debounce(() => refresh(), 300)

  watch([currentPage, pageSize], () => refresh())
  watch([category, sub, filters.search, filters.filterGame, filters.filterItem, filters.filterStatus, filters.dateFrom, filters.dateTo, filters.sortOrder], () => {
    currentPage.value = 1
    if (unref(filters.search)) {
      debouncedRefresh()
    } else {
      refresh({ preserveScroll: false })
    }
  })

  const { setLastViewed, handleScrollRestoration } = useScrollMemory()

  function goToDetail(order) {
    setLastViewed(order.name)
    const type = order.order_type || getOrderType(order.name)
    router.push({ name: 'OrderDetailView', params: { type, name: order.name } })
  }

  onActivated(() => refresh())

  return {
    items,
    totalItems,
    currentPage,
    totalPages,
    pageSize,
    setPageSize,
    loading,
    statusCounts,
    sellCount,
    buyCount,
    goToPage,
    refresh,
    handleScrollRestoration,
    goToDetail,
  }
}
