import { ref, computed, watch } from 'vue'

export function usePagination(sourceList, pageSizeRef) {
  const currentPage = ref(1)

  const totalPages = computed(() => {
    const size = pageSizeRef.value || 20
    const total = sourceList.value?.length || 0
    return Math.max(1, Math.ceil(total / size))
  })

  const paginatedItems = computed(() => {
    const list = sourceList.value || []
    const size = pageSizeRef.value || 20
    const page = currentPage.value
    const start = (page - 1) * size
    return list.slice(start, start + size)
  })

  watch(totalPages, (newTotal) => {
    if (currentPage.value > newTotal) {
      currentPage.value = newTotal
    }
  })

  // Only reset to page 1 when list is fully replaced (length drops to 0 or changes drastically),
  // not on realtime in-place updates (splice/unshift) which modify the array without replacing it.
  let prevLength = sourceList.value?.length || 0
  watch(sourceList, (newList) => {
    const newLength = newList?.length || 0
    // Reset if list was cleared or more than half the items changed (full refresh)
    if (newLength === 0 || Math.abs(newLength - prevLength) > prevLength * 0.5 + 2) {
      currentPage.value = 1
    }
    prevLength = newLength
  })

  function goToPage(page) {
    const p = Math.max(1, Math.min(page, totalPages.value))
    currentPage.value = p
  }

  function nextPage() {
    goToPage(currentPage.value + 1)
  }

  function prevPage() {
    goToPage(currentPage.value - 1)
  }

  return {
    currentPage,
    totalPages,
    paginatedItems,
    goToPage,
    nextPage,
    prevPage,
  }
}
