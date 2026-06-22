import { ref, watch } from 'vue'

export const PAGE_SIZE_OPTIONS = [10, 20, 30]

export function usePageSize(viewKey, defaultSize = 10) {
  const storageKey = `pageSize_${viewKey}`

  const saved = localStorage.getItem(storageKey)
  const pageSize = ref(saved ? parseInt(saved, 10) : defaultSize)

  watch(pageSize, (val) => {
    localStorage.setItem(storageKey, val)
  })

  function setPageSize(size) {
    pageSize.value = size
  }

  return {
    pageSize,
    setPageSize,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  }
}
