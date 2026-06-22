import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'
import { useScrollMemory } from '../composables/useScrollMemory.js'
import AppLayout from '../components/AppLayout.vue'

const routes = [
  { path: '/login', component: () => import('../views/LoginView.vue') },
  {
    path: '/',
    component: AppLayout,
    meta: { auth: true },
    children: [
      { path: '', component: () => import('../views/HomeView.vue'), name: 'HomeView' },
      {
        path: 'queue',
        component: () => import('../views/OrdersView.vue'),
        name: 'QueueView',
        alias: ['orders', 'dashboard', 'home'],
        meta: { roles: ['Trader2'] }
      },
      { path: 'my-orders', component: () => import('../views/OrdersView.vue'), name: 'MyOrdersView', meta: { roles: ['Trader2'] } },
      { path: 'history', component: () => import('../views/OrdersView.vue'), name: 'HistoryView', meta: { roles: ['Trader2'] } },
      { path: 'issues', component: () => import('../views/OrdersView.vue'), name: 'IssuesView' },
      { path: 'order/:type/:name', component: () => import('../views/OrderDetailView.vue'), name: 'OrderDetailView' },
      { path: 'conversion/:name', component: () => import('../views/ConversionDetailView.vue'), name: 'ConversionDetailView' },
      { path: 'inventory', component: () => import('../views/InventoryView.vue'), name: 'InventoryView' },
      { path: 'flip', component: () => import('../views/FlipSessionList.vue'), name: 'FlipSessionList', meta: { auth: true } },
      { path: 'flip/new', component: () => import('../views/FlipSessionCreate.vue'), name: 'FlipSessionCreate', meta: { auth: true } },
      { path: 'flip/:name', component: () => import('../views/FlipSessionDetail.vue'), name: 'FlipSessionDetail', meta: { auth: true } },
      { path: 'prices', component: () => import('../views/PriceTableView.vue'), name: 'PriceTableView' },
      { path: 'ml-negotiation', component: () => import('../views/MLNegotiationView.vue'), name: 'MLNegotiationView', meta: { roles: ['Market Leader'] } },
      { path: 'inventory-logs', component: () => import('../views/InventoryLogsView.vue'), name: 'InventoryLogsView' },
      { path: 'lots', component: () => import('../views/LotManagerView.vue'), name: 'LotManagerView' },
      { path: 'create', component: () => import('../views/CreateOrderView.vue'), name: 'CreateOrderView', meta: { roles: ['Trader1'] } },
      { path: 'profit', component: () => import('../views/ProfitView.vue'), name: 'ProfitView', meta: { roles: ['Chief Accountant'] } },
      { path: 'payments', component: () => import('../views/PaymentView.vue'), name: 'PaymentView', meta: { roles: ['Payment Accountant', 'Management Accountant', 'Chief Accountant'] } },
      { path: 'platform-wallet', component: () => import('../views/PlatformWalletView.vue'), name: 'PlatformWalletView', meta: { roles: ['Payment Accountant', 'Management Accountant', 'Chief Accountant'] } },
      { path: 'customers', component: () => import('../views/CustomersView.vue'), name: 'CustomersView', meta: { roles: ['Payment Accountant', 'Management Accountant', 'Chief Accountant'] } },
      { path: 'suppliers', component: () => import('../views/SuppliersView.vue'), name: 'SuppliersView', meta: { roles: ['Payment Accountant', 'Management Accountant', 'Chief Accountant'] } },
      { path: 'debts', component: () => import('../views/DebtView.vue'), name: 'DebtView', meta: { roles: ['Management Accountant', 'Chief Accountant'] } },
      { path: 'statements', component: () => import('../views/StatementsView.vue'), name: 'StatementsView', meta: { roles: ['Management Accountant', 'Chief Accountant'] } },
      { path: 'debts/statement/:partyType/:party', component: () => import('../views/PartyStatementView.vue'), name: 'PartyStatementView', meta: { roles: ['Management Accountant', 'Chief Accountant'] } },
      { path: 'logs', component: () => import('../views/SystemLogsView.vue'), name: 'SystemLogsView', meta: { admin: true } },
      { path: 't1-attention', component: () => import('../views/T1OrdersView.vue'), name: 'T1AttentionView', meta: { roles: ['Trader1'] } },
      { path: 't1-active', component: () => import('../views/T1OrdersView.vue'), name: 'T1ActiveView', meta: { roles: ['Trader1'] } },
      { path: 't1-history', component: () => import('../views/T1OrdersView.vue'), name: 'T1HistoryView', meta: { roles: ['Trader1'] } },
      { path: 'warnings', component: () => import('../views/WarningView.vue'), name: 'WarningView' },
      { path: 'account', component: () => import('../views/AccountSettingsView.vue'), name: 'AccountSettingsView' },
      { path: 'account/wallet', component: () => import('../views/WalletView.vue'), name: 'WalletView' },
      { path: 'transfers', component: () => import('../views/FundTransferView.vue'), name: 'FundTransferView' },
      { path: 'admin/users', component: () => import('../views/AdminUsersView.vue'), name: 'AdminUsersView', meta: { roles: ['Ops Manager', 'Game Currency Admin'] } },
      { path: 'admin/game-data', component: () => import('../views/AdminGameDataView.vue'), name: 'AdminGameDataView', meta: { roles: ['Ops Manager', 'Game Currency Admin'] } },
      { path: 'admin/bank-accounts', component: () => import('../views/CashierBankAccountView.vue'), name: 'CashierBankAccountView', meta: { roles: ['Ops Manager', 'Game Currency Admin'] } },
      { path: 'admin/sessions', redirect: '/queue' },
      { path: 'admin/platform-transactions', redirect: '/platform-wallet' },
      { path: 'admin/ledger', component: () => import('../views/AccountLedgerView.vue'), name: 'AccountLedgerView', meta: { roles: ['Chief Accountant'] } },
      { path: 'admin/transfers', redirect: '/transfers' },
      { path: ':pathMatch(.*)*', component: () => import('../views/NotFoundView.vue'), name: 'NotFoundView' },
    ]
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (to.path === from.path) {
      return false
    }

    // Disable native Y-scroll restoration if we have an active Anchor ID to focus on
    const { lastViewedObjectId } = useScrollMemory()
    if (lastViewedObjectId.value && (['QueueView', 'MyOrdersView', 'HistoryView', 'IssuesView', 'T1AttentionView', 'T1ActiveView', 'T1HistoryView'].includes(to.name))) {
      return false
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        if (savedPosition) {
          resolve(savedPosition)
        } else {
          resolve({ top: 0 })
        }
      }, 250)
    })
  }
})

// Handle dynamic import failures — reload the page
function isChunkLoadError(message) {
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Expected a JavaScript') ||
    message.includes('error loading dynamically imported module')
  )
}

let hasChunkError = false
function handleChunkError() {
  if (hasChunkError) return
  hasChunkError = true
  window.location.reload()
}

router.onError((error) => {
  const msg = error.message || ''
  if (isChunkLoadError(msg)) {
    handleChunkError()
  }
})

router.beforeEach(async (to) => {
  if (to.matched.some(record => record.meta.auth)) {
    const { fetchUser, isAdmin, roles } = useAuth()
    const user = await fetchUser()
    if (!user || user === 'Guest') return '/login'
    if (
      (to.meta.admin && !isAdmin.value) ||
      (to.meta.roles && to.meta.roles.length > 0 && !(roles.value.some(r => to.meta.roles.includes(r)) || isAdmin.value))
    ) {
      return { name: 'NotFoundView' }
    }
  }
})

// Handle API 403 errors globally — redirect to not found
import { onSessionExpired } from '../api/index.js'
let hasListener = false
function setupPermissionGuard() {
  if (hasListener) return
  hasListener = true
  const { clearAuth } = useAuth()
  onSessionExpired(() => {
    clearAuth()
    router.push('/login')
  })
}
setupPermissionGuard()

export default router
