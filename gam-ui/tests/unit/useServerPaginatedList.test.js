import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'

// useServerPaginatedList imports usePageSize from a .vue (needs the Vue compiler
// we deliberately avoid in the test config) + useScrollMemory. Mock both so the
// composable runs in pure node.
vi.mock('../../src/components/PaginatedListLayout.vue', () => ({
  usePageSize: (_viewKey, defaultSize) => {
    const pageSize = ref(defaultSize)
    return { pageSize, setPageSize: vi.fn((v) => { pageSize.value = v }) }
  },
}))

vi.mock('../../src/composables/useScrollMemory.js', () => ({
  useScrollMemory: () => ({
    setLastViewed: vi.fn(),
    handleScrollRestoration: vi.fn(),
  }),
}))

import { useServerPaginatedList } from '../../src/composables/useServerPaginatedList.js'

const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms))

describe('useServerPaginatedList (P2.2)', () => {
  it('exposes an error state (instead of a silent []) when the fetch rejects', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('boom'))
    const list = useServerPaginatedList('err', fetchFn, { defaultSize: 10 })

    await wait() // let the immediate fetch settle
    expect(list.error.value).toBeInstanceOf(Error)
    expect(list.items.value).toEqual([])
    expect(list.loading.value).toBe(false)
  })

  it('discards a stale result when a newer fetch wins the race', async () => {
    let resolveFirst
    let resolveSecond
    const fetchFn = vi.fn(() => {
      if (fetchFn.mock.calls.length === 1) {
        return new Promise((r) => { resolveFirst = () => r({ data: ['stale'], total: 1 }) })
      }
      return new Promise((r) => { resolveSecond = () => r({ data: ['fresh'], total: 1 }) })
    })

    const list = useServerPaginatedList('race', fetchFn, { defaultSize: 10 })
    list.refresh() // kick off a second (newer) fetch

    // Resolve the newer fetch first → it should populate the list.
    resolveSecond()
    await wait()
    expect(list.items.value).toEqual(['fresh'])

    // Now resolve the older fetch — it must NOT clobber the fresh result.
    resolveFirst()
    await wait()
    expect(list.items.value).toEqual(['fresh'])
  })

  it('loads data normally on a successful fetch', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: [{ name: 'a' }], total: 1 })
    const list = useServerPaginatedList('ok', fetchFn, { defaultSize: 10 })

    await wait()
    expect(list.items.value).toEqual([{ name: 'a' }])
    expect(list.totalItems.value).toBe(1)
    expect(list.error.value).toBeNull()
  })
})
