<template>
  <div class="h-screen bg-app-bg text-app-text-primary flex overflow-hidden transition-colors duration-200">
    <!-- Mobile backdrop -->
    <div v-if="sidebarOpen" class="fixed inset-0 bg-black/60 z-40 md:hidden" @click="sidebarOpen = false"></div>

    <!-- Desktop hover trigger strip (hidden when pinned) -->
    <div
      v-if="!sidebarPinned" class="hidden md:block fixed left-0 top-0 w-4 h-full z-40 cursor-pointer"
      @mouseenter="cancelClose(); sidebarHover = true"
    ></div>

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
          <h1 class="text-app-text-primary font-bold text-lg tracking-tight">🎮 GAM</h1>
          <p class="text-app-text-muted text-xs mt-0.5">Game Account Manager</p>
        </div>
        <div class="flex items-center gap-1">
          <button
            @click="togglePin"
            class="hidden md:flex w-7 h-7 items-center justify-center rounded-md transition text-sm"
            :class="sidebarPinned ? 'bg-indigo-600 text-white' : 'text-app-text-muted hover:bg-indigo-500/10 hover:text-indigo-600'"
            :title="sidebarPinned ? 'Bỏ ghim' : 'Ghim sidebar'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path v-if="sidebarPinned" d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
              <path v-else d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" opacity=".3" />
              <path v-if="!sidebarPinned" d="M2 17h4l3 3v-3h3v-2H2v2z" opacity=".7" />
            </svg>
          </button>
          <button @click="sidebarOpen = false" class="md:hidden text-app-text-secondary hover:text-app-text-primary p-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto overscroll-y-contain">
        <!-- Sử dụng (all GAM users) -->
        <p class="text-app-text-muted text-[10px] px-3 pb-1 pt-1 uppercase font-bold tracking-widest">📂 Sử dụng</p>
        <router-link
          v-for="item in userNav" :key="item.to" :to="item.to" @click="sidebarOpen = false"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
          :class="isActive(item.to) ? 'bg-indigo-600 text-white' : 'text-app-text-secondary hover:bg-indigo-500/10 hover:text-indigo-600'"
        >
          <span class="text-base">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </router-link>

        <!-- Đang hoạt động (Req #5) — live active sessions + badge + over-time warning.
             Hidden when the session user lacks the 'active' section grant. -->
        <router-link
          v-if="canSection('active')" to="/active" @click="sidebarOpen = false"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition relative"
          :class="[
            isActive('/active') ? 'bg-indigo-600 text-white' : 'text-app-text-secondary hover:bg-indigo-500/10 hover:text-indigo-600',
            overSoftCapAny ? 'gam-tab-warning' : '',
          ]"
        >
          <span class="text-base" :class="overSoftCapAny ? 'gam-blink' : ''">{{ overSoftCapAny ? '⚠️' : '🟢' }}</span>
          <span>Đang hoạt động</span>
          <span
            v-if="overAnyCount > 0"
            class="gam-blink ml-auto min-w-[1.25rem] text-center text-[10px] font-black px-1.5 py-0.5 rounded-full bg-red-500 text-white"
          >
            ⚠️ {{ overAnyCount }}
          </span>
          <span
            v-else-if="activeBadge > 0"
            class="ml-auto min-w-[1.25rem] text-center text-[10px] font-black px-1.5 py-0.5 rounded-full"
            :class="isActive('/active') ? 'bg-white/20 text-white' : 'bg-blue-500 text-white'"
          >{{ activeBadge }}</span>
          <span
            v-if="activeMyBadge > 0 && !overSoftCapAny" class="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            :class="isActive('/active') ? 'bg-white/10 text-white/80' : 'bg-indigo-500/15 text-indigo-600'"
          >{{ activeMyBadge }}</span>
        </router-link>

        <!-- Tài khoản theo vai trò (account-role scoped) — per-game only, grant-aware.
             Each role/game link is gated by hasRoleGame (admin bypass / explicit
             grant / match_role fallback). Empty roles are hidden (Req #7). -->
        <template v-for="o in roleSections" :key="o.value">
          <template v-if="visibleGamesForRole(o).length">
            <p class="text-app-text-muted text-[10px] px-3 pb-1 pt-3 uppercase font-bold tracking-widest">📂 {{ o.label }}</p>
            <!-- "Tất cả" — every account of this role, regardless of game. -->
            <router-link
              :to="`/role/${encodeURIComponent(o.value)}`" @click="sidebarOpen = false"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
              :class="isRoleActive(o.value) ? 'bg-indigo-600 text-white' : 'text-app-text-secondary hover:bg-indigo-500/10 hover:text-indigo-600'"
            >
              <span class="text-base">🗂️</span>
              <span class="flex-1">Tất cả</span>
            </router-link>
            <router-link
              v-for="g in visibleGamesForRole(o)" :key="g.game" :to="`/role/${encodeURIComponent(o.value)}/game/${encodeURIComponent(g.game)}`" @click="sidebarOpen = false"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
              :class="isRoleActive(o.value, g.game) ? 'bg-indigo-600 text-white' : 'text-app-text-secondary hover:bg-indigo-500/10 hover:text-indigo-600'"
            >
              <span class="text-base">🎮</span>
              <span class="flex-1 truncate">{{ g.game_name }}</span>
              <span
                class="text-[10px] px-1.5 py-0.5 rounded-full bg-app-bg font-bold"
                :class="isRoleActive(o.value, g.game) ? 'text-white/80' : 'text-app-text-muted'"
              >{{ g.count }}</span>
            </router-link>
          </template>
        </template>

        <!-- Quản trị (GAM Admin only) -->
        <template v-if="showAdmin">
          <div class="mt-4 pt-3 border-t border-app-border/70 space-y-1">
            <p class="text-indigo-500 text-[10px] px-3 pb-1 uppercase font-black tracking-widest flex items-center gap-1.5"><span>🛠️</span> Quản trị</p>
            <router-link
              v-for="item in adminNavItems" :key="item.to" :to="item.to" @click="sidebarOpen = false"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
              :class="navItemActive(item) ? 'bg-indigo-600 text-white' : 'text-app-text-secondary hover:bg-indigo-500/10 hover:text-indigo-600'"
            >
              <span class="text-base">{{ item.icon }}</span>
              <span>{{ item.label }}</span>
            </router-link>

            <!-- 🛡️ Phân quyền / Bảo mật — IAM pair: capability mgmt (access) +
                 compliance audit (role-audit), grouped for discoverability. -->
            <template v-if="securityNavItems.length">
              <p class="text-app-text-muted text-[10px] px-3 pb-1 pt-3 uppercase font-bold tracking-widest flex items-center gap-1.5"><span>🛡️</span> Phân quyền / Bảo mật</p>
              <router-link
                v-for="item in securityNavItems" :key="item.to" :to="item.to" @click="sidebarOpen = false"
                class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
                :class="navItemActive(item) ? 'bg-indigo-600 text-white' : 'text-app-text-secondary hover:bg-indigo-500/10 hover:text-indigo-600'"
              >
                <span class="text-base">{{ item.icon }}</span>
                <span>{{ item.label }}</span>
              </router-link>
            </template>
          </div>
        </template>
      </nav>

      <div class="px-3 py-4 border-t border-app-border space-y-2">
        <!-- Theme Toggle -->
        <button
          @click="toggleTheme"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-indigo-500/10 text-app-text-secondary hover:text-indigo-600 transition text-left group"
        >
          <span class="text-lg group-hover:scale-110 transition-transform">{{ theme === 'dark' ? '🌙' : '☀️' }}</span>
          <span class="text-xs font-medium">{{ theme === 'dark' ? 'Dark Mode' : 'Light Mode' }}</span>
        </button>

        <button
          @click="menuOpen = !menuOpen"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-indigo-500/10 transition text-left group"
        >
          <div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-lg shadow-indigo-600/20">
            {{ initials }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-app-text-primary text-xs font-bold truncate">{{ displayName }}</p>
            <p class="text-app-text-muted text-xs truncate">{{ roleLabel }}</p>
          </div>
          <span class="text-app-text-muted text-xs transition-transform" :class="{ 'rotate-180': menuOpen }">▼</span>
        </button>
        <div v-if="menuOpen" class="mt-1 bg-app-surface rounded-lg overflow-hidden border border-app-border shadow-2xl">
          <router-link
            to="/account" @click="menuOpen = false"
            class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-app-text-secondary hover:bg-indigo-500/10 hover:text-indigo-600 transition font-medium"
          >
            <span>⚙️</span> Cài đặt tài khoản
          </router-link>
          <button
            @click="handleLogout"
            class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition font-medium"
          >
            <span>🚪</span> Đăng xuất
          </button>
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <main
      class="flex-1 flex flex-col min-h-0 transition-colors duration-200 main-zoom"
      :class="(sidebarHover || sidebarPinned) ? 'md:ml-60' : 'md:ml-0'"
      style="transition: margin-left 150ms;"
    >
      <div class="md:hidden flex items-center gap-3 px-4 py-3 bg-app-surface border-b border-app-border z-30 transition-colors duration-200">
        <button @click="sidebarOpen = true" class="text-app-text-secondary hover:text-app-text-primary p-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <h1 class="text-app-text-primary font-bold text-base flex-1">🎮 GAM</h1>
        <button @click="toggleTheme" class="text-lg ml-2">{{ theme === 'dark' ? '🌙' : '☀️' }}</button>
      </div>
      <div class="flex-1 min-h-0 pt-4 px-4 md:pt-8 md:px-8 overflow-hidden">
        <router-view v-slot="{ Component }">
          <transition name="fade-slide" mode="out-in">
            <!-- P2.8: keep-alive scoped to list-style views that benefit from
                 scroll-position + filter memory. Detail/admin views (which may
                 hold secrets — TOTP, revealed passwords — or stale snapshots)
                 are intentionally NOT cached. `:include` matches the component
                 `name` option (see defineOptions in each view). -->
            <keep-alive :include="KEEP_ALIVE_VIEWS">
              <component :is="Component" />
            </keep-alive>
          </transition>
        </router-view>
      </div>
    </main>

    <!-- Governance warnings (Req #5 logout + §D online-too-long) -->
    <ConfirmDialog
      v-if="showLogoutWarning" title="Còn phiên đang hoạt động"
      :message="`Bạn đang có ${myCount} phiên checkin chưa checkout. Đăng xuất sẽ KHÔNG tự giải phóng các phiên này (tài khoản vẫn bị khoá). Tiếp tục đăng xuất?`"
      confirm-label="Vẫn đăng xuất" danger @close="showLogoutWarning = false" @confirm="confirmLogout"
    />
    <ConfirmDialog
      v-if="showOnlineWarning && longestLease" title="⏰ Đã online quá lâu"
      @close="dismissOnlineWarning" @confirm="gotoActiveFromWarning"
      confirm-label="Đi checkout" cancel-label="Để sau"
    >
      <p class="text-sm text-app-text-secondary">Tài khoản <span class="font-black text-app-text-primary">{{ longestLease.username || longestLease.account }}</span> đã online <span class="font-black text-amber-500">{{ longestLease.elapsedHours }}h</span> (giới hạn mềm {{ maxHours }}h). Hãy checkout để tài khoản được nghỉ.</p>
    </ConfirmDialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { logout } from '../api/index.js'
import { useAuth } from '../composables/useAuth.js'
import { useTheme } from '../composables/useTheme.js'
import { useGamMetadata } from '../composables/useGamMetadata.js'
import { useActiveUsage } from '../composables/useActiveUsage.js'
import { useRealtime, disconnect as disconnectRealtime } from '../composables/useRealtime.js'
import { useOnlineWatcher } from '../composables/useOnlineWatcher.js'
import { useAccessGrants } from '../composables/useAccessGrants.js'
import ConfirmDialog from './ConfirmDialog.vue'

const router = useRouter()
const route = useRoute()
const { fetchUser, isGamAdmin, isAdmin, user, fullName, clearAuth } = useAuth()
const { theme, toggleTheme } = useTheme()
const { roleOptions, load: loadMetadata, loadGamesByRole, gamesForRole } = useGamMetadata()
// L2 access-grant cache (seeded at boot by useAuth). Drives sidebar role/game
// + section visibility with a match_role fallback for legacy users.
const { hasRoleGame, canSection } = useAccessGrants()
// Shared active-usage singleton (sidebar badge + lock state). Bound once here.
const { myCount, adminCount, bindRealtime, refresh: refreshActive } = useActiveUsage()
const realtime = useRealtime()
// Live elapsed-time tracker for the session user's leases → drives the
// "online too long" governance popup.
const { longestLease, overSoftCap, overSoftCapAny, overAnyCount, maxHours, start: startWatcher, stop: stopWatcher } = useOnlineWatcher()
const showOnlineWarning = ref(false)
// Track what the user dismissed so the popup only re-surfaces for a NEW lease
// or once a higher hour-bucket is crossed (avoid nagging every 30s tick).
const onlineDismissed = ref({ account: '', bucket: 0 })
watch(overSoftCap, (v) => {
  if (!v) { showOnlineWarning.value = false; return }
  const ll = longestLease.value
  if (!ll) return
  const bucket = Math.floor(ll.elapsedHours)
  if (ll.account !== onlineDismissed.value.account || bucket > onlineDismissed.value.bucket) {
    showOnlineWarning.value = true
  }
})
function dismissOnlineWarning() {
  const ll = longestLease.value
  onlineDismissed.value = { account: ll?.account || '', bucket: ll ? Math.floor(ll.elapsedHours) : 0 }
  showOnlineWarning.value = false
}
function gotoActiveFromWarning() {
  dismissOnlineWarning()
  menuOpen.value = false
  router.push('/active')
}

const menuOpen = ref(false)
const sidebarOpen = ref(false)
const sidebarHover = ref(false)
const sidebarPinned = ref(localStorage.getItem('gam_sidebarPinned') === 'true')
const hoverTimer = ref(null)

function togglePin() {
  sidebarPinned.value = !sidebarPinned.value
  localStorage.setItem('gam_sidebarPinned', sidebarPinned.value)
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

const userNav = [
  { to: '/', icon: '🏠', label: 'Dashboard' },
  { to: '/search', icon: '🔍', label: 'Tìm kiếm' },
]

// P2.8 — keep-alive allow-list (component `name` options, NOT route names).
// Only list-style views that benefit from preserved scroll position + filters.
// Detail/admin views are excluded so secrets (TOTP, passwords) and stale
// snapshots do not linger in the KeepAlive cache.
const KEEP_ALIVE_VIEWS = [
  'DashboardView',
  'GameAccountsView',
  'EmailListView',
  'ActiveAccountsView',
  'SearchView',
  'RoleGameAccountsView',
]

const adminNav = [
  { to: '/codes', icon: '🔑', label: 'Mã Code', section: 'emails' },
  { to: '/admin/platforms', icon: '🖥️', label: 'Tài khoản Platform' },
  { to: '/admin/game-accounts', icon: '🎮', label: 'Tài khoản Game' },
  { to: '/admin/emails', icon: '📬', label: 'Quản lý Email' },
  // Code Patterns merged into /admin/settings as a tab (see redirect in
  // router). Kept here only as a hidden back-compat entry — not rendered.
  { to: '/admin/code-patterns', icon: '🧩', label: 'Code Patterns', hidden: true },
  { to: '/admin/email-inbound-log', icon: '📨', label: 'Email đến (Webhook)' },
  { to: '/admin/account-usage', icon: '🔑', label: 'Nhật ký sử dụng' },
  { to: '/admin/activity', icon: '🛡️', label: 'Hoạt động', section: 'audit' },
  // Security/IAM pair grouped under a dedicated sub-header so capability
  // management (access) and compliance audit (role-audit) sit together.
  { to: '/admin/role-audit', icon: '🧩', label: 'Cách ly vai trò', group: 'security' },
  { to: '/admin/access', icon: '🔐', label: 'Phân quyền truy cập', group: 'security' },
  { to: '/admin/webhook', icon: '⚙️', label: 'Cấu hình Webhook' },
  { to: '/admin/settings', icon: '🛠️', label: 'Cài đặt' },
]

const showAdmin = computed(() => isGamAdmin.value || isAdmin.value)
const adminView = computed(() => isGamAdmin.value || isAdmin.value)
// Admin nav filtered by section grants (forward-compatible: admins bypass, so
// today this is a no-op, but it keeps the sidebar consistent if the admin
// section ever opens up to fine-scoped non-admin members).
// `hidden` entries (e.g. the merged Code Patterns back-compat route) are kept
// out of the sidebar but still resolvable as nav targets.
function adminNavVisible(items) {
  return items.filter(item => !item.section || canSection(item.section))
}
const adminNavItems = computed(() =>
  adminNavVisible(adminNav.filter(item => !item.hidden && !item.group))
)
// The "🛡️ Phân quyền / Bảo mật" sub-group (access + role-audit).
const securityNavItems = computed(() =>
  adminNavVisible(adminNav.filter(item => !item.hidden && item.group === 'security'))
)
// Sidebar badge: members see their own count; admins see all-active (primary)
// plus a secondary badge for their own active sessions.
const activeBadge = computed(() => (adminView.value ? adminCount.value : myCount.value))
const activeMyBadge = computed(() => (adminView.value ? myCount.value : 0))

// Role-scoped account sections are driven entirely by the L2 access grants:
// a role header appears only when the user can see at least one of its games.
// `visibleGamesForRole` resolves admin-bypass / explicit grants / the
// match_role fallback (legacy "Frappe role == option label" visibility).
const roleSections = computed(() =>
  roleOptions.value.filter(o => visibleGamesForRole(o).length > 0)
)
function visibleGamesForRole(o) {
  if (!o) return []
  return gamesForRole(o.value).filter(g => hasRoleGame(o.value, g.game, o.label))
}
function isRoleActive(value, game = '') {
  // Role|game view now lives under /role/:role(/game/:game); match path params.
  if (route.params.role !== value) return false
  return (game || '') === (route.params.game || '')
}

/** The back-office "Tài khoản Game" view is active only on /admin/game-accounts.
 * Role/game now live under /role/... so there is nothing to disambiguate here. */
function isGameAccountsActive() {
  return route.path === '/admin/game-accounts'
}

function navItemActive(item) {
  if (!item) return false
  if (item.to === '/admin/game-accounts') return isGameAccountsActive()
  if (item.to === '/') return route.path === '/'
  return route.path === item.to || route.path.startsWith(item.to + '/')
}

function isActive(to) {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(to + '/')
}

const displayName = computed(() => {
  if (fullName.value && fullName.value.trim()) return fullName.value.trim()
  return user.value ? user.value.split('@')[0] : ''
})
const initials = computed(() => {
  const src = (fullName.value && fullName.value.trim()) ? fullName.value.trim() : (user.value ? user.value.split('@')[0] : '')
  return src ? src.slice(0, 2).toUpperCase() : '?'
})
const roleLabel = computed(() => {
  if (isGamAdmin.value) return 'GAM Admin'
  if (isAdmin.value) return 'Administrator'
  return 'GAM Member'
})

/** Live reflow of the dynamic role/game sidebar sections whenever the set of
 * (role, game) bindings changes (create / edit role-game / add-remove game /
 * delete) — locally or from another user/tab. Subscribes to the dedicated
 * `gam_role_sections_changed` event so it does NOT re-aggregate on unrelated
 * account edits (e.g. a password change) that only fire `gam_account_changed`. */
function onRoleSectionsRefresh() {
  loadGamesByRole(true)
}

onMounted(async () => {
  await fetchUser()
  loadMetadata()
  loadGamesByRole()
  // Subscribe to gam_account_changed so the active-sessions badge stays live
  // app-wide (singleton); then prime the cache.
  bindRealtime(realtime)
  refreshActive()
  startWatcher()
  // Sidebar role/game sections re-render live on binding changes only.
  realtime.on('gam_role_sections_changed', onRoleSectionsRefresh)
})

onUnmounted(() => {
  stopWatcher()
  realtime.off('gam_role_sections_changed', onRoleSectionsRefresh)
})

// --- Logout with active-lease warning (bypassable, never a hard block) ---
const showLogoutWarning = ref(false)
async function handleLogout() {
  menuOpen.value = false
  if (myCount.value > 0) {
    showLogoutWarning.value = true
    return
  }
  await doLogout()
}
async function confirmLogout() {
  showLogoutWarning.value = false
  await doLogout()
}
async function doLogout() {
  await logout()
  // Drop the cached session + L2 grants and tear down the socket so a stale
  // (previously-authenticated) connection can't keep firing events for the
  // old user. (B3 — full logout cleanup.)
  clearAuth()
  disconnectRealtime()
  router.push('/login')
}
</script>

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

/* Over-time warning: blinking red accent on the sidebar "Đang hoạt động" tab. */
.gam-tab-warning {
  position: relative;
  box-shadow: 0 0 0 1px rgb(239 68 68 / 0.45), 0 0 16px -3px rgb(239 68 68 / 0.55);
  animation: gam-tab-pulse 1s steps(2, start) infinite;
}

.gam-blink {
  animation: gam-blink-text 1s steps(2, start) infinite;
}

@keyframes gam-blink-text {
  0% { opacity: 1; }
  50% { opacity: 0.25; }
  100% { opacity: 1; }
}

@keyframes gam-tab-pulse {
  0%, 100% {
    box-shadow: 0 0 0 1px rgb(239 68 68 / 0.6), 0 0 18px -3px rgb(239 68 68 / 0.65);
  }
  50% {
    box-shadow: 0 0 0 1px rgb(239 68 68 / 0.2);
  }
}
</style>
