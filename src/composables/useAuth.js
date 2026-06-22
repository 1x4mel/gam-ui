import { ref, computed } from 'vue'
import { getLoggedInUser, getRoles } from '../api/index.js'

// Shared state across all components
const user = ref('')
const roles = ref([])
const lastFetched = ref(0)
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function useAuth() {
  const isLoggedIn = computed(() => user.value && user.value !== 'Guest')
  const isTrader1 = computed(() => roles.value.includes('Trader1'))
  const isTrader2 = computed(() => roles.value.includes('Trader2'))
  const isChiefAccountant = computed(() => roles.value.includes('Chief Accountant'))
  const isManagementAccountant = computed(() => roles.value.includes('Management Accountant'))
  const isPaymentAccountant = computed(() => roles.value.includes('Payment Accountant'))
  const isAccountant = computed(() => isChiefAccountant.value || isManagementAccountant.value || isPaymentAccountant.value)
  const isMarketLeader = computed(() => roles.value.includes('Market Leader'))
  const isOpsManager = computed(() => roles.value.includes('Ops Manager'))
  const isGameCurrencyAdmin = computed(() => roles.value.includes('Game Currency Admin'))
  const isAdmin = computed(() =>
    user.value === 'Administrator' ||
    roles.value.includes('System Manager') ||
    roles.value.includes('Administrator')
  )

  async function fetchUser(force = false) {
    const now = Date.now()
    if (!force && user.value && user.value !== 'Guest' && (now - lastFetched.value) < CACHE_TTL) {
      return user.value
    }

    const [u, r] = await Promise.all([
      getLoggedInUser(),
      getRoles(),
    ])
    user.value = u || 'Guest'
    roles.value = r || []
    lastFetched.value = now
    return user.value
  }

  function clearAuth() {
    user.value = ''
    roles.value = []
    lastFetched.value = 0
  }

  return {
    user,
    roles,
    isLoggedIn,
    isTrader1,
    isTrader2,
    isChiefAccountant,
    isManagementAccountant,
    isPaymentAccountant,
    isOpsManager,
    isGameCurrencyAdmin,
    isAccountant,
    isMarketLeader,
    isAdmin,
    fetchUser,
    clearAuth,
  }
}
