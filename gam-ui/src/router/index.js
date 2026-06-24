import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'
import { useAccessGrants } from '../composables/useAccessGrants.js'
import { useGamMetadata } from '../composables/useGamMetadata.js'
import AppLayout from '../components/AppLayout.vue'

const routes = [
  { path: '/login', component: () => import('../views/LoginView.vue'), name: 'LoginView' },
  {
    path: '/',
    component: AppLayout,
    meta: { auth: true },
    children: [
      // Main
      { path: '', component: () => import('../views/HomeView.vue'), name: 'DashboardView' },
      { path: 'search', component: () => import('../views/SearchView.vue'), name: 'SearchView' },

      // Email module (F3)
      { path: 'emails', component: () => import('../views/EmailListView.vue'), name: 'EmailListView', meta: { roles: ['GAM Admin'] } },
      { path: 'emails/:name', component: () => import('../views/EmailDetailView.vue'), name: 'EmailDetailView' },

      // Accounts module (F4)
      // The admin back-office now lives at `/admin/game-accounts`. `/accounts`
      // is kept only as a back-compat redirect (old bookmarks, role|game deep
      // links) — the operational member-facing view lives under `/role/...`.
      {
        path: 'accounts',
        redirect: (to) => {
          const role = to.query.role
          if (role) {
            if (to.query.game) {
              return { name: 'RoleGameAccountsView', params: { role: String(role), game: String(to.query.game) } }
            }
            return { name: 'RoleAccountsView', params: { role: String(role) } }
          }
          return { path: '/admin/game-accounts', query: to.query.game ? { game: String(to.query.game) } : {} }
        },
      },
      { path: 'accounts/:name', component: () => import('../views/AccountDetailView.vue'), name: 'AccountDetailView' },
      // Platform-tier account detail (Thân). A dedicated route + view, distinct
      // from GAME nodes (/accounts/:name) so the two account tiers get their own
      // layouts (platform shows its child game nodes + billing; game shows its
      // inherited platform credentials). AccountDetailView redirects a PLATFORM
      // doc here; PlatformAccountDetailView redirects a GAME node back.
      { path: 'platform-accounts/:name', component: () => import('../views/PlatformAccountDetailView.vue'), name: 'PlatformAccountDetailView' },

      // Operational role|game view (one component, optional :game).
      //   /role/:role            → every account of that role (all games)
      //   /role/:role/game/:game → scoped to one (role, game) permission key
      { path: 'role/:role', component: () => import('../views/RoleGameAccountsView.vue'), name: 'RoleAccountsView' },
      { path: 'role/:role/game/:game', component: () => import('../views/RoleGameAccountsView.vue'), name: 'RoleGameAccountsView' },

      // Active sessions (Req #5 — "Đang hoạt động")
      { path: 'active', component: () => import('../views/ActiveAccountsView.vue'), name: 'ActiveAccountsView', meta: { grant: 'active' } },

      // Account settings (self-service)
      { path: 'account', component: () => import('../views/AccountSettingsView.vue'), name: 'AccountSettingsView' },

      // Admin (F5 / F6) — GAM Admin only
      { path: 'admin/platforms', component: () => import('../views/PlatformAccountsView.vue'), name: 'PlatformAccountsView', meta: { roles: ['GAM Admin'] } },
      { path: 'admin/game-accounts', component: () => import('../views/GameAccountsView.vue'), name: 'GameAccountsView', meta: { roles: ['GAM Admin'] } },
      { path: 'admin/reveal-log', component: () => import('../views/RevealLogView.vue'), name: 'RevealLogView', meta: { roles: ['GAM Admin'] } },
      { path: 'admin/code-request-log', component: () => import('../views/CodeRequestLogView.vue'), name: 'CodeRequestLogView', meta: { roles: ['GAM Admin'] } },
      { path: 'admin/email-inbound-log', component: () => import('../views/EmailInboundLogView.vue'), name: 'EmailInboundLogView', meta: { roles: ['GAM Admin'] } },
      { path: 'admin/account-usage', component: () => import('../views/AccountUsageView.vue'), name: 'AccountUsageView', meta: { roles: ['GAM Admin'] } },
      { path: 'admin/role-audit', component: () => import('../views/RoleAuditView.vue'), name: 'RoleAuditView', meta: { roles: ['GAM Admin'] } },
      { path: 'admin/webhook', component: () => import('../views/WebhookConfigView.vue'), name: 'WebhookConfigView', meta: { roles: ['GAM Admin'] } },
      { path: 'admin/code-patterns', component: () => import('../views/CodePatternsView.vue'), name: 'CodePatternsView', meta: { roles: ['GAM Admin'] } },
      { path: 'admin/emails', component: () => import('../views/EmailAccountsView.vue'), name: 'EmailAccountsView', meta: { roles: ['GAM Admin'] } },
      // Email ACCOUNT detail (distinct from /emails/:name which is a CODE detail).
      // Exposes credentials via the audited reveal endpoint — admin-only.
      { path: 'admin/emails/:name', component: () => import('../views/EmailAccountDetailView.vue'), name: 'EmailAccountDetailView', meta: { roles: ['GAM Admin'] } },
      { path: 'admin/settings', component: () => import('../views/AdminSettingsView.vue'), name: 'AdminSettingsView', meta: { roles: ['GAM Admin'] } },
      { path: 'admin/access', component: () => import('../views/AccessGrantView.vue'), name: 'AccessGrantView', meta: { roles: ['GAM Admin'] } },

      { path: ':pathMatch(.*)*', component: () => import('../views/NotFoundView.vue'), name: 'NotFoundView' },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_URL || '/'),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (to.path === from.path) return false
    return new Promise((resolve) => {
      setTimeout(() => {
        if (savedPosition) resolve(savedPosition)
        else resolve({ top: 0 })
      }, 250)
    })
  },
})

// Handle dynamic import failures — reload the page (stale chunks after deploy)
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
  if (isChunkLoadError(msg)) handleChunkError()
})

router.beforeEach(async (to) => {
  // Back-compat (one release): old /accounts?role=X(&game=Y) → /role/X(/game/Y).
  // Keeps bookmarks working while the role|game view migrates off /accounts.
  if (to.path === '/accounts' && to.query.role) {
    const role = String(to.query.role)
    if (to.query.game) {
      return { name: 'RoleGameAccountsView', params: { role, game: String(to.query.game) } }
    }
    return { name: 'RoleAccountsView', params: { role } }
  }

  if (to.matched.some(record => record.meta.auth)) {
    const { fetchUser, isAdmin, isGamUser, roles, clearAuth } = useAuth()
    let user
    try {
      user = await fetchUser()
    } catch (e) {
      console.error('[router] fetchUser failed:', e)
      clearAuth()
      return { name: 'LoginView' }
    }
    if (!user || user === 'Guest') {
      clearAuth()
      return { name: 'LoginView' }
    }
    // Co-tenancy: only GAM roles (or Administrator/System Manager) may use gam-ui.
    if (!isAdmin.value && !isGamUser.value) {
      clearAuth()
      return { name: 'LoginView' }
    }
    // Per-route role gate (e.g. admin-only modules)
    if (to.meta.roles && to.meta.roles.length > 0) {
      const allowed = roles.value.some(r => to.meta.roles.includes(r)) || isAdmin.value
      if (!allowed) return { name: 'NotFoundView' }
    }
    // Per-route section grant gate (L2 fine-scoping) — see useAccessGrants.
    // The cache is seeded during fetchUser() above, so canSection() is sync here.
    if (to.meta.grant) {
      const { canSection } = useAccessGrants()
      if (!canSection(to.meta.grant)) return { name: 'NotFoundView' }
    }
    // Role|game operational view: gate the (role, game) scope by hasRoleGame.
    // Admins bypass; members must hold ROLE_GAME|role|game (or the match_role
    // fallback). Server-side get_accounts_list re-enforces this, so this is UX.
    if (to.path.startsWith('/role/')) {
      const { hasRoleGame } = useAccessGrants()
      // Resolve the GAM List Option label so the match_role fallback can match
      // legacy users whose Frappe role == option LABEL (not the VALUE in the URL).
      const { roleOptions } = useGamMetadata()
      const opt = roleOptions.value.find(o => o.value === to.params.role)
      if (!hasRoleGame(to.params.role, to.params.game || '', opt?.label || '')) {
        return { name: 'NotFoundView' }
      }
    }
  }
})

// Global session-expiry handler → clear auth + bounce to login.
import { onSessionExpired } from '../api/index.js'
let hasSessionListener = false
function setupSessionGuard() {
  if (hasSessionListener) return
  hasSessionListener = true
  const { clearAuth } = useAuth()
  onSessionExpired(() => {
    clearAuth()
    router.push({ name: 'LoginView' })
  })
}
setupSessionGuard()

export default router
