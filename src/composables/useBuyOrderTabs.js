import { ref, computed, watch, onUnmounted } from 'vue'
import { debounce } from 'lodash-es'

const STORAGE_KEY = 'trader1_buy_tabs'
const MAX_TABS = 10

function generateId() {
  return 'tab_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

function createDefaultTab() {
  return {
    id: generateId(),
    label: 'Đơn mới',
    status: 'new', // new | filling | ready | submitted
    submittedOrderName: null,
    createdAt: Date.now(),
    buyForm: { buy_channel: '', supplier: '', transaction_currency: 'VND', assigned_trader: '', game_account: '' },
    orderItems: [],
    gameContext: '',
    note: '',
    newSupplierName: '',
  }
}

export function useBuyOrderTabs() {
  const tabs = ref([createDefaultTab()])
  const activeTabId = ref(tabs.value[0].id)

  const activeBuyTab = computed(() =>
    tabs.value.find(t => t.id === activeTabId.value) || null
  )

  function createTab() {
    if (tabs.value.length >= MAX_TABS) return null
    const tab = createDefaultTab()
    tabs.value.push(tab)
    activeTabId.value = tab.id
    return tab.id
  }

  function closeTab(id) {
    const idx = tabs.value.findIndex(t => t.id === id)
    if (idx === -1) return
    tabs.value.splice(idx, 1)
    if (tabs.value.length === 0) {
      const fresh = createDefaultTab()
      tabs.value.push(fresh)
      activeTabId.value = fresh.id
    } else if (activeTabId.value === id) {
      activeTabId.value = tabs.value[Math.min(idx, tabs.value.length - 1)].id
    }
  }

  function switchToTab(id) {
    if (tabs.value.some(t => t.id === id)) {
      activeTabId.value = id
    }
  }

  function markTabSubmitted(id, orderName) {
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      tab.status = 'submitted'
      tab.submittedOrderName = orderName
      tab.label = orderName
    }
  }

  function updateTabLabel(id, label) {
    const tab = tabs.value.find(t => t.id === id)
    if (tab && tab.status !== 'submitted') {
      tab.label = label || 'Đơn mới'
    }
  }

  function isTabDirty(id) {
    const tab = tabs.value.find(t => t.id === id)
    if (!tab) return false
    const bf = tab.buyForm
    if (bf.buy_channel || bf.supplier !== '' && bf.supplier !== '__new__') return true
    if (tab.orderItems.some(i => i.currency_item || i.quantity > 0)) return true
    if (tab.gameContext || tab.note) return true
    return false
  }

  // --- localStorage ---
  function saveToStorage() {
    try {
      const data = { tabs: tabs.value, activeTabId: activeTabId.value }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch { /* quota exceeded — ignore */ }
  }

  function restoreFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      if (!data?.tabs?.length) return
      // Cleanup submitted tabs older than 5 minutes
      const cutoff = Date.now() - 5 * 60 * 1000
      const valid = data.tabs.filter(t =>
        t.status !== 'submitted' || t.createdAt > cutoff
      )
      // Auto-close submitted tabs after restore
      const live = valid.filter(t => t.status !== 'submitted')
      if (live.length > 0) {
        tabs.value = live
        activeTabId.value = live.some(t => t.id === data.activeTabId)
          ? data.activeTabId
          : live[0].id
      }
    } catch { /* corrupt data — ignore */ }
  }

  const debouncedSave = debounce(saveToStorage, 500)

  watch(tabs, debouncedSave, { deep: true })
  watch(activeTabId, debouncedSave)

  return {
    tabs,
    activeTabId,
    activeBuyTab,
    createTab,
    closeTab,
    switchToTab,
    markTabSubmitted,
    updateTabLabel,
    isTabDirty,
    saveToStorage,
    restoreFromStorage,
  }
}
