import { ref, computed } from 'vue'
import { frappeCall } from '../api/index.js'

const queueCount = ref(0)
const paymentsCount = ref(0)
const receivableCount = ref(0)
const overdueDebtCount = ref(0)
const t1AttentionCount = ref(0)
const t1ActiveCount = ref(0)
const myOrdersCount = ref(0)
const warningCount = ref(0)
const hasWarnings = computed(() => warningCount.value > 0)
const loading = ref(false)
let pendingTimer = null
let isPending = false

async function fetchBadges() {
  isPending = false
  loading.value = true
  try {
    const data = await frappeCall('gege_custom.gege_custom.api.badges.get_badge_counts')
    queueCount.value = data.queueCount || 0
    paymentsCount.value = data.paymentsCount || 0
    receivableCount.value = data.receivableCount || 0
    overdueDebtCount.value = data.overdueDebtCount || 0
    t1AttentionCount.value = data.t1AttentionCount || 0
    t1ActiveCount.value = data.t1ActiveCount || 0
    myOrdersCount.value = data.myOrdersCount || 0
    warningCount.value = data.warningCount || 0
  } catch { /* ignore */ } finally {
    loading.value = false
  }
}

function refreshBadges() {
  if (isPending) return
  isPending = true
  clearTimeout(pendingTimer)
  pendingTimer = setTimeout(fetchBadges, 3000)
}

function refreshBadgesNow() {
  clearTimeout(pendingTimer)
  isPending = false
  return fetchBadges()
}

export function useBadgeCounts() {
  return {
    queueCount,
    paymentsCount,
    receivableCount,
    overdueDebtCount,
    t1AttentionCount,
    t1ActiveCount,
    myOrdersCount,
    warningCount,
    hasWarnings,
    refreshBadges,
    refreshBadgesNow,
  }
}
