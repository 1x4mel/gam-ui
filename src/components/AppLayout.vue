<template>
  <div class="h-screen bg-app-bg text-app-text-primary flex overflow-hidden transition-colors duration-200">
    <!-- Mobile backdrop -->
    <div v-if="sidebarOpen" class="fixed inset-0 bg-black/60 z-40 md:hidden" @click="sidebarOpen = false"></div>

    <!-- Desktop hover trigger strip (hidden when pinned) -->
    <div v-if="!sidebarPinned" class="hidden md:block fixed left-0 top-0 w-4 h-full z-40 cursor-pointer"
      @mouseenter="cancelClose(); sidebarHover = true"></div>

    <!-- Sidebar -->
    <aside
      :class="[
        'w-60 bg-app-surface border-r border-app-border flex flex-col fixed h-full z-50 transition-transform duration-150',
        (sidebarOpen || sidebarHover || sidebarPinned) ? 'translate-x-0' : '-translate-x-full',
      ]"
      @mouseenter="cancelClose(); sidebarHover = true"
      @mouseleave="scheduleCloseSidebar"
      @wheel.stop
      @click="cancelClose(); sidebarHover = true"
    >
      <div class="px-5 py-5 border-b border-app-border flex items-center justify-between">
        <div>
          <h1 class="text-app-text-primary font-bold text-lg tracking-tight">⚡ Trader UI</h1>
          <p class="text-app-text-muted text-xs mt-0.5">Game Currency ERP</p>
        </div>
        <div class="flex items-center gap-1">
          <button @click="togglePin"
            class="hidden md:flex w-7 h-7 items-center justify-center rounded-md transition text-sm"
            :class="sidebarPinned ? 'bg-indigo-600 text-white' : 'text-app-text-muted hover:bg-indigo-500/10 hover:text-indigo-600'"
            :title="sidebarPinned ? 'Bỏ ghim' : 'Ghim sidebar'">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path v-if="sidebarPinned" d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
              <path v-else d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" opacity=".3"/>
              <path v-if="!sidebarPinned" d="M2 17h4l3 3v-3h3v-2H2v2z" opacity=".7"/>
            </svg>
          </button>
          <button @click="sidebarOpen = false" class="md:hidden text-app-text-secondary hover:text-app-text-primary p-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto overscroll-y-contain">        <!-- Inventory Section -->
        <template v-if="showInventory">
          <p class="text-app-text-muted text-[10px] px-3 pb-1 pt-1 uppercase font-bold tracking-widest">Kho</p>
          <router-link to="/warnings" @click="sidebarOpen = false"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition relative overflow-hidden"
            :class="[
              $route.path === '/warnings' ? 'bg-indigo-600 text-white' :
              hasWarnings ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'text-app-text-secondary hover:bg-indigo-500/10 hover:text-indigo-600'
            ]">
            <span class="text-base" :class="{ 'animate-pulse': hasWarnings }">⚠️</span>
            <span>Cảnh báo</span>
            <span v-if="warningCount > 0"
              class="ml-auto bg-white text-red-600 text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center shadow-sm">
              {{ warningCount > 999 ? '999+' : warningCount }}
            </span>
            <div v-if="hasWarnings" class="absolute inset-0 bg-white/10 animate-pulse pointer-events-none"></div>
          </router-link>
          <router-link v-for="item in inventoryNav" :key="item.to" :to="item.to" @click="sidebarOpen = false"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
            :class="$route.path === item.to ? 'bg-indigo-600 text-white' : 'text-app-text-secondary hover:bg-indigo-500/10 hover:text-indigo-600'">
            <span class="text-base">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </router-link>
        </template>
        <!-- Trader 2 Section -->
        <template v-if="showTrader2">
          <p class="text-app-text-muted text-[10px] px-3 pb-1 pt-3 uppercase font-bold tracking-widest">Trader 2</p>
          <router-link v-for="item in trader2Nav" :key="item.to" :to="item.to" @click="sidebarOpen = false"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
            :class="$route.path === item.to ? 'bg-indigo-600 text-white' : 'text-app-text-secondary hover:bg-indigo-500/10 hover:text-indigo-600'">
            <span class="text-base">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
            <!-- Queue badge -->
            <span v-if="item.to === '/queue' && queueCount > 0"
              class="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">
              {{ queueCount > 999 ? '999+' : queueCount }}
            </span>
            <!-- My Orders badge -->
            <span v-if="item.to === '/my-orders' && myOrdersCount > 0"
              class="ml-auto bg-indigo-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">
              {{ myOrdersCount > 999 ? '999+' : myOrdersCount }}
            </span>
          </router-link>
        </template>
        <!-- Market Leader Section -->
        <template v-if="showMarketLeader">
          <p class="text-app-text-muted text-[10px] px-3 pb-1 pt-3 uppercase font-bold tracking-widest">Market Leader</p>
          <router-link to="/ml-negotiation" @click="sidebarOpen = false"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
            :class="$route.path === '/ml-negotiation' ? 'bg-indigo-600 text-white' : 'text-app-text-secondary hover:bg-indigo-500/10 hover:text-indigo-600'">
            <span class="text-base">🤝</span>
            <span>Đơn Thương lượng</span>
          </router-link>
        </template>
        <!-- Trader 1 Section -->
        <template v-if="showTrader1">
          <p class="text-app-text-muted text-[10px] px-3 pb-1 pt-3 uppercase font-bold tracking-widest">Trader 1</p>
          <router-link v-for="item in trader1Nav" :key="item.to" :to="item.to" @click="sidebarOpen = false"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
            :class="$route.path === item.to ? 'bg-indigo-600 text-white' : 'text-app-text-secondary hover:bg-indigo-500/10 hover:text-indigo-600'">
            <span class="text-base">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
            <!-- Attention badge -->
            <span v-if="item.to === '/t1-attention' && t1AttentionCount > 0"
              class="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">
              {{ t1AttentionCount > 999 ? '999+' : t1AttentionCount }}
            </span>
            <!-- Active badge -->
            <span v-if="item.to === '/t1-active' && t1ActiveCount > 0"
              class="ml-auto bg-indigo-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">
              {{ t1ActiveCount > 999 ? '999+' : t1ActiveCount }}
            </span>
          </router-link>
        </template>
        <!-- Accountant Section -->
        <template v-if="showAccountant">
          <p class="text-app-text-muted text-[10px] px-3 pb-1 pt-3 uppercase font-bold tracking-widest">Kế toán</p>
          <router-link v-for="item in accountantNav" :key="item.to" :to="item.to" @click="sidebarOpen = false"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
            :class="$route.path === item.to ? 'bg-indigo-600 text-white' : 'text-app-text-secondary hover:bg-indigo-500/10 hover:text-indigo-600'">
            <span class="text-base">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
            <!-- Payment badge (shows payments/receivable format) -->
            <span v-if="item.to === '/payments' && (paymentsCount > 0 || receivableCount > 0)"
              class="ml-auto bg-amber-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">
              {{ paymentsCount > 0 && receivableCount > 0 ? `${paymentsCount}/${receivableCount}` : paymentsCount > 0 ? paymentsCount : receivableCount }}
            </span>
            <!-- Overdue debt badge -->
            <span v-if="item.to === '/debts' && overdueDebtCount > 0"
              class="ml-auto bg-red-500 text-white text-[9px] font-black rounded-full px-1.5 py-0.5 flex items-center justify-center animate-pulse">
              {{ overdueDebtCount }} quá hạn
            </span>
          </router-link>
        </template>
        <!-- Chuyển tiền (all users) -->
        <router-link to="/transfers" @click="sidebarOpen = false"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
          :class="$route.path === '/transfers' ? 'bg-indigo-600 text-white' : 'text-app-text-secondary hover:bg-indigo-500/10 hover:text-indigo-600'">
          <span class="text-base">💸</span>
          <span>Chuyển tiền</span>
        </router-link>
        <div class="pt-3">
          <a href="http://192.168.2.100:8888/user/getting-started/" target="_blank" rel="noopener noreferrer"
            @click="sidebarOpen = false"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition text-app-text-secondary hover:bg-indigo-500/10 hover:text-indigo-600">
            <span class="text-base">📄</span>
            <span>Tài liệu</span>
          </a>
        </div>
        <!-- Reports Section -->
        <template v-if="showReports">
          <p class="text-app-text-muted text-[10px] px-3 pb-1 pt-3 uppercase font-bold tracking-widest">Báo cáo</p>
          <router-link v-for="item in reportNav" :key="item.to" :to="item.to" @click="sidebarOpen = false"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
            :class="$route.path === item.to ? 'bg-indigo-600 text-white' : 'text-app-text-secondary hover:bg-indigo-500/10 hover:text-indigo-600'">
            <span class="text-base">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </router-link>
        </template>
        <!-- Admin / Systems Section -->
        <template v-if="showSystems">
          <p class="text-app-text-muted text-[10px] px-3 pb-1 pt-3 uppercase font-bold tracking-widest">Hệ thống</p>
          <router-link v-for="item in systemNav" :key="item.to" :to="item.to" @click="sidebarOpen = false"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
            :class="$route.path === item.to ? 'bg-indigo-600 text-white' : 'text-app-text-secondary hover:bg-indigo-500/10 hover:text-indigo-600'">
            <span class="text-base">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </router-link>
        </template>
      
      </nav>

      <div class="px-3 py-4 border-t border-app-border space-y-2">
        <!-- Theme Toggle -->
        <button @click="toggleTheme" 
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-indigo-500/10 text-app-text-secondary hover:text-indigo-600 transition text-left group">
          <span class="text-lg group-hover:scale-110 transition-transform">{{ theme === 'dark' ? '🌙' : '☀️' }}</span>
          <span class="text-xs font-medium">{{ theme === 'dark' ? 'Dark Mode' : 'Light Mode' }}</span>
        </button>

        <button @click="menuOpen = !menuOpen"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-indigo-500/10 transition text-left group">
          <div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-lg shadow-indigo-600/20">
            {{ initials }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-app-text-primary text-xs font-bold truncate">{{ displayName }}</p>
            <p class="text-app-text-muted text-xs truncate">{{ role }}</p>
          </div>
          <span class="text-app-text-muted text-xs transition-transform" :class="{ 'rotate-180': menuOpen }">▼</span>
        </button>
        <div v-if="menuOpen" class="mt-1 bg-app-surface rounded-lg overflow-hidden border border-app-border shadow-2xl">
          <router-link to="/account/wallet" @click="menuOpen = false"
            class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-app-text-secondary hover:bg-indigo-500/10 hover:text-indigo-600 transition font-medium">
            <span>💰</span> Ví của tôi
          </router-link>
          <router-link to="/account" @click="menuOpen = false"
            class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-app-text-secondary hover:bg-indigo-500/10 hover:text-indigo-600 transition font-medium">
            <span>⚙️</span> Đổi mật khẩu
          </router-link>
          <button @click="handleLogout"
            class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition font-medium">
            <span>🚪</span> Đăng xuất
          </button>
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 flex flex-col min-h-0 transition-colors duration-200 main-zoom"
          :class="(sidebarHover || sidebarPinned) ? 'md:ml-60' : 'md:ml-0'"
          style="transition: margin-left 150ms;">
      <div class="md:hidden flex items-center gap-3 px-4 py-3 bg-app-surface border-b border-app-border z-30 transition-colors duration-200">
        <button @click="sidebarOpen = true" class="text-app-text-secondary hover:text-app-text-primary p-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <h1 class="text-app-text-primary font-bold text-base flex-1">⚡ Trader UI</h1>
        <div class="flex items-center gap-1.5">
          <span v-if="warningCount > 0" class="bg-red-600 text-white text-[10px] font-bold rounded-full px-2 py-0.5 shadow-sm animate-pulse">
            W:{{ warningCount > 999 ? '999+' : warningCount }}
          </span>
          <span v-if="showTrader2 && queueCount > 0" class="bg-red-500 text-white text-[10px] font-bold rounded-full px-2 py-0.5 shadow-sm">
            Q:{{ queueCount > 999 ? '999+' : queueCount }}
          </span>
          <span v-if="showTrader2 && myOrdersCount > 0" class="bg-indigo-500 text-white text-[10px] font-bold rounded-full px-2 py-0.5 shadow-sm">
            O:{{ myOrdersCount > 999 ? '999+' : myOrdersCount }}
          </span>
          <span v-if="showAccountant && (paymentsCount > 0 || receivableCount > 0)" class="bg-amber-500 text-white text-[10px] font-bold rounded-full px-2 py-0.5 shadow-sm">
            P:{{ paymentsCount > 999 ? '999+' : paymentsCount }}<template v-if="receivableCount > 0"> T:{{ receivableCount > 999 ? '999+' : receivableCount }}</template>
          </span>
          <!-- Mobile Theme Toggle -->
          <button @click="toggleTheme" class="text-lg ml-2">{{ theme === 'dark' ? '🌙' : '☀️' }}</button>
        </div>
      </div>
      <div class="flex-1 min-h-0 pt-4 px-4 md:pt-8 md:px-8 overflow-hidden">
        <router-view v-slot="{ Component }">
          <transition name="fade-slide" mode="out-in">
            <keep-alive :include="['OrdersView', 'InventoryView', 'InventoryLogsView', 'PaymentView', 'T1OrdersView', 'ProfitView', 'SystemLogsView', 'CustomersView', 'SuppliersView', 'WarningView', 'DebtView', 'StatementsView', 'PartyStatementView', 'AdminUsersView', 'AdminGameDataView', 'CashierBankAccountView', 'CashierSessionView', 'PlatformTransactionView', 'AccountLedgerView', 'WalletView', 'PlatformWalletView']">
              <component :is="Component" />
            </keep-alive>
          </transition>
        </router-view>
      </div>
    </main>
  </div>
</template>

<style>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { debounce } from 'lodash-es'
import { logout } from '../api/index.js'
import { useRealtime } from '../composables/useRealtime.js'
import { useAuth } from '../composables/useAuth.js'
import { useTheme } from '../composables/useTheme.js'
import { useBadgeCounts } from '../composables/useBadgeCounts.js'

const router = useRouter()
const { subscribe, unsubscribe } = useRealtime()
const { fetchUser, isTrader1, isTrader2, isChiefAccountant, isManagementAccountant, isPaymentAccountant, isAccountant, isMarketLeader, isAdmin, isOpsManager, isGameCurrencyAdmin, roles } = useAuth()
const { theme, toggleTheme } = useTheme()
const { queueCount, paymentsCount, receivableCount, overdueDebtCount, t1AttentionCount, t1ActiveCount, myOrdersCount, warningCount, hasWarnings, refreshBadges } = useBadgeCounts()

const user = ref('')
const menuOpen = ref(false)
const sidebarOpen = ref(false)
const sidebarHover = ref(false)
const sidebarPinned = ref(localStorage.getItem('sidebarPinned') === 'true')
const hoverTimer = ref(null)

function togglePin() {
  sidebarPinned.value = !sidebarPinned.value
  localStorage.setItem('sidebarPinned', sidebarPinned.value)
  sidebarHover.value = true
}

function cancelClose() {
  if (hoverTimer.value) clearTimeout(hoverTimer.value)
  sidebarHover.value = true
}

function scheduleCloseSidebar() {
  if (sidebarPinned.value) return
  hoverTimer.value = setTimeout(() => { sidebarHover.value = false }, 300)
}

const trader2Nav = [
  { to: '/queue',     icon: '📋', label: 'Hàng đợi'     },
  { to: '/my-orders', icon: '⚡', label: 'Đơn của tôi' },
  { to: '/history',   icon: '🕓', label: 'Lịch sử'   },
]

const trader1Nav = [
  { to: '/create',       icon: '➕', label: 'Tạo Order' },
  { to: '/t1-attention', icon: '⚠️', label: 'Cần xử lý' },
  { to: '/t1-active',    icon: '⚡', label: 'Đang hoạt động' },
  { to: '/t1-history',   icon: '🕓', label: 'Lịch sử' },
]

const inventoryNav = [
  { to: '/inventory', icon: '📦', label: 'Kho' },
  { to: '/flip', icon: '🔄', label: 'Flip' },
  { to: '/lots', icon: '🏷️', label: 'Quản lý Lot' },
  { to: '/prices', icon: '💲', label: 'Bảng giá' },
  { to: '/inventory-logs', icon: '📑', label: 'Nhật ký kho' },
]

const accountantNav = computed(() => {
  const items = [
    { to: '/payments', icon: '💳', label: 'Thanh toán', roles: ['Payment Accountant', 'Management Accountant', 'Chief Accountant'] },
    { to: '/platform-wallet', icon: '🏦', label: 'Ví nền tảng', roles: ['Payment Accountant', 'Management Accountant', 'Chief Accountant'] },
    { to: '/debts', icon: '📊', label: 'Công nợ', roles: ['Management Accountant', 'Chief Accountant'] },
    { to: '/statements', icon: '📋', label: 'Sao kê công nợ', roles: ['Management Accountant', 'Chief Accountant'] },
    { to: '/customers', icon: '👥', label: 'Khách hàng', roles: ['Payment Accountant', 'Management Accountant', 'Chief Accountant'] },
    { to: '/suppliers', icon: '🤝', label: 'Nhà cung cấp', roles: ['Payment Accountant', 'Management Accountant', 'Chief Accountant'] },
  ]
  return items.filter(item => {
    if (isAdmin.value) return true
    return item.roles.some(r => roles.value.includes(r))
  })
})

const showReports = computed(() => isAdmin.value || isChiefAccountant.value)

const reportNav = [
  { to: '/profit', icon: '💰', label: 'Lợi nhuận' },
  { to: '/admin/ledger', icon: '📒', label: 'Sổ cái' },
]

const systemNav = computed(() => {
  const items = [
    { to: '/logs', icon: '📊', label: 'Nhật ký', adminOnly: true },
    { to: '/admin/users', icon: '👤', label: 'Nhân viên' },
    { to: '/admin/game-data', icon: '🎮', label: 'Dữ liệu Game' },
    { to: '/admin/bank-accounts', icon: '🏦', label: 'TK Ngân hàng' },
  ]
  return items.filter(item => !item.adminOnly || isAdmin.value)
})

const showTrader2 = computed(() => isAdmin.value || isTrader2.value)
const showTrader1 = computed(() => isAdmin.value || isTrader1.value)
const showInventory = computed(() => true)
const showAccountant = computed(() => isAccountant.value || isAdmin.value)
const showSystems = computed(() => isAdmin.value || isOpsManager.value || isGameCurrencyAdmin.value)
const showMarketLeader = computed(() => isAdmin.value || isMarketLeader.value || isGameCurrencyAdmin.value)

const displayName = computed(() => user.value ? user.value.split('@')[0] : '')
const initials = computed(() => user.value ? user.value.split('@')[0].slice(0, 2).toUpperCase() : '?')
const role = computed(() => {
  if (!user.value) return ''
  const domain = user.value.split('@')[1]
  return domain ? `@${domain}` : user.value
})

let pollTimer = null

function refreshAllBadges() {
  refreshBadges()
}

onMounted(async () => {
  user.value = await fetchUser()
  refreshBadges()
  subscribe('Sell Order', refreshAllBadges)
  subscribe('Buy Order', refreshAllBadges)
  subscribe('Inventory Position', refreshAllBadges)
  subscribe('Currency Item', refreshAllBadges)
  subscribe('Inventory Warning Threshold', refreshAllBadges)
  // Periodic fallback poll every 30s
  pollTimer = setInterval(refreshAllBadges, 30000)
})

onUnmounted(() => {
  unsubscribe('Sell Order')
  unsubscribe('Buy Order')
  unsubscribe('Inventory Position')
  unsubscribe('Currency Item')
  unsubscribe('Inventory Warning Threshold')
  if (pollTimer) clearInterval(pollTimer)
})

async function handleLogout() {
  await logout()
  router.push('/login')
}
</script>