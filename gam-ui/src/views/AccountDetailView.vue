<template>
  <DetailPageLayout :loading="loading" loading-text="Đang tải tài khoản..." max-width="max-w-5xl">
    <template #toolbar>
      <div class="flex items-center gap-3">
        <BackButton @click="router.push('/accounts')" />
        <h2 class="text-base sm:text-lg font-black text-app-text-primary uppercase tracking-tight">Chi tiết Tài khoản</h2>
      </div>
    </template>

    <div v-if="account" class="pb-8">
      <!-- Header card -->
      <div class="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm mb-6">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="flex items-center gap-4 min-w-0">
            <PlatformBadge :platform="account.platform" size="lg" />
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h1 class="text-2xl font-black text-app-text-primary tracking-tight truncate">{{ account.username }}</h1>
                <CopyButton :text="account.username" />
              </div>
              <p class="text-app-text-muted text-xs mt-1 flex items-center gap-1.5 flex-wrap">
                <template v-if="mainGameName">
                  <span class="font-black text-indigo-600">🎯 {{ mainGameName }}</span>
                  <span class="opacity-30">·</span>
                </template>
                <span>🎮 {{ account.platform }}</span>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <RoleBadge v-for="r in accountRoles" :key="r" :role="r" size="lg" />
            <StatusBadge :status="account.status" size="lg" />
            <template v-if="canEdit">
              <button
                @click="showEdit = true"
                class="px-3 py-2 rounded-xl bg-indigo-500/10 text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500/20 transition"
              >
                ✎ Sửa
              </button>
              <button
                @click="askDelete"
                class="px-3 py-2 rounded-xl bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition"
              >
                🗑 Xoá
              </button>
            </template>
          </div>
        </div>

        <!-- Checkin/Checkout bar (Req #4 flip + Req #5 lock) -->
        <div class="mt-5 pt-5 border-t border-app-border">
          <!-- Online — held by ME → end (checkout) -->
          <div v-if="activeUsage && isHolderMe" class="flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-2 text-sm">
              <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span class="font-black text-blue-500 uppercase text-xs tracking-wider">● Online</span>
              <span class="text-app-text-muted text-xs">⏱ {{ elapsedLabel(statusTimer.ms) }}<span v-if="activeUsage.purpose"> · {{ activeUsage.purpose }}</span></span>
            </div>
            <button
              @click="handleCheckin" :disabled="checkoutLoading"
              class="px-4 py-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition active:scale-95 disabled:opacity-50"
            >
              {{ checkoutLoading ? '...' : '✓ Checkout' }}
            </button>
          </div>
          <!-- Locked by ANOTHER user → no checkin; admin may force-release -->
          <div v-else-if="activeUsage" class="flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-2 text-sm">
              <span class="text-amber-500">🔒</span>
              <span class="font-black text-amber-500 uppercase text-xs tracking-wider">Đang bị khoá</span>
              <span class="text-app-text-muted text-xs">{{ userName(activeUsage.used_by) }}<span v-if="activeUsage.purpose"> · {{ activeUsage.purpose }}</span> · ⏱ {{ elapsedLabel(statusTimer.ms) }}</span>
            </div>
            <button
              v-if="canEdit" @click="showForce = true"
              class="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/30 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition active:scale-95"
            >
              🔓 Force Checkout
            </button>
          </div>
          <!-- Free → start (checkin) -->
          <div v-else-if="canCheckout" class="flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-2 text-sm">
              <span class="w-2 h-2 rounded-full bg-app-text-muted"></span>
              <span class="font-black text-app-text-muted uppercase text-xs tracking-wider">○ Offline</span>
              <span class="text-app-text-muted text-xs">⏱ nghỉ {{ elapsedLabel(statusTimer.ms) }}</span>
              <span v-if="restedEnough" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[10px] font-bold">😴 nghỉ đủ</span>
            </div>
            <button
              @click="showCheckout = true"
              class="px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 text-[10px] font-black uppercase tracking-widest transition active:scale-95 shadow-lg shadow-blue-600/20"
            >
              ✅ Checkin
            </button>
          </div>
          <p v-else class="text-xs text-app-text-muted italic">Tài khoản khả dụng.</p>
        </div>
      </div>

      <!-- Single column layout (Req #6) -->
      <div class="space-y-6">
        <!-- Credentials -->
        <div class="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm space-y-5">
          <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">🔑 Thông tin đăng nhập</h3>

          <!-- Email -->
          <div class="flex flex-col gap-1">
            <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest opacity-30">Email</p>
            <div class="flex items-center gap-2 flex-wrap">
              <span v-if="emailDoc?.address" class="text-sm font-black text-app-text-primary">{{ emailDoc.address }}</span>
              <span v-else class="text-sm text-app-text-muted italic">{{ account.email || '—' }}</span>
              <CopyButton v-if="emailDoc?.address" :text="emailDoc.address" />
              <router-link v-if="emailDoc" :to="`/emails/${emailDoc.name}`" class="text-[10px] text-indigo-600 hover:underline ml-auto">→ xem mã</router-link>
            </div>
          </div>

          <!-- Account password -->
          <PasswordField doctype="GAM Account" :name="account.name" fieldname="account_password" label="Mật khẩu" />

          <!-- TOTP — live 6-digit code generator (Design §5.6) -->
          <TotpCodeWidget doctype="GAM Account" :name="account.name" fieldname="totp_secret" label="2FA / Mã TOTP" :has-value="!!account.totp_secret" />

          <!-- Code request -->
          <div>
            <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest opacity-30 mb-2">Verification code</p>
            <CodeRequestButton
              :email-name="account.email || (emailDoc && emailDoc.name) || ''"
              :account-name="account.name"
              :platform="codePlatform"
            />
          </div>
        </div>

        <!-- Meta -->
        <div class="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm">
          <!-- Account ID (random Frappe name) — hidden on the list cards, shown
               only here so admins can copy/share it when needed. -->
          <div class="flex flex-col gap-1 mb-5">
            <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest opacity-30">ID (mã tài khoản)</p>
            <div class="flex items-center gap-2">
              <span class="text-sm font-mono text-app-text-secondary">{{ account.name }}</span>
              <CopyButton :text="account.name" />
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InfoRow label="Nguồn" :value="account.source || '—'" />
            <InfoRow label="Trạng thái" :value="account.status || '—'" />
            <InfoRow label="Tạo account" :value="formatDate(account.account_created_at) || '—'" />
            <InfoRow label="Ngày mua" :value="formatDate(account.purchased_at) || '—'" />
          </div>
          <div v-if="account.notes" class="mt-4 pt-4 border-t border-app-border">
            <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest opacity-30 mb-1.5">Ghi chú</p>
            <p class="text-sm text-app-text-secondary whitespace-pre-wrap">{{ account.notes }}</p>
          </div>
        </div>

        <!-- Games -->
        <div class="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">🎯 Games</h3>
            <button
              v-if="canEdit" @click="showGameDialog = true"
              class="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 text-[10px] font-black uppercase tracking-wider hover:bg-indigo-500/20 transition"
            >
              + Thêm
            </button>
          </div>
          <p v-if="!gamesList.length" class="text-xs text-app-text-muted italic">Chưa có game.</p>
          <div v-else class="space-y-3">
            <div v-for="(g, i) in gamesList" :key="i" class="bg-app-bg border border-app-border rounded-xl p-4">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-black text-app-text-primary text-sm">🎮 {{ gameName(g.game) }}</span>
                <span v-if="g.is_main" class="text-[10px] text-amber-500 font-black">★ MAIN</span>
                <span v-if="g.server" class="text-[10px] text-app-text-muted bg-app-surface px-2 py-0.5 rounded-md">🌐 {{ serverLabel(g.server) }}</span>
                <button
                  v-if="canEdit" @click="askRemoveGame(g)"
                  class="ml-auto text-[10px] text-red-400/80 hover:text-red-500 font-bold px-2 py-1 rounded-lg hover:bg-red-500/10 transition"
                >
                  ✕ Gỡ
                </button>
              </div>
              <div v-if="g.dlcs?.length || g.notes || g.purchased_at" class="mt-2 flex items-center gap-3 text-[10px] text-app-text-muted flex-wrap">
                <span v-if="g.dlcs?.length">DLC: {{ g.dlcs.map(d => dlcLabel(d.dlc)).join(', ') }}</span>
                <span v-if="g.purchased_at">Mua: {{ formatDate(g.purchased_at) }}</span>
                <span v-if="g.notes">{{ g.notes }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Links -->
        <AccountLinkSection ref="linkSection" :account-name="account.name" :can-edit="canEdit" @add-link="showLinkDialog = true" />

        <!-- Activity timeline (Req #3 — scrollbar-capped) -->
        <AccountActivitySection ref="activitySection" :account-name="account.name" />

        <!-- Collaborative notes (Req #4.3) -->
        <AccountNotesSection ref="notesSection" :account-name="account.name" :current-user="user" :is-admin="isGamAdmin || isAdmin" />
      </div>
    </div>

    <EmptyState v-else-if="!loading" icon="🎮" text="Không tìm thấy tài khoản" subtext="Tài khoản không tồn tại hoặc bạn không có quyền." />

    <template #modals>
      <CheckoutModal v-if="showCheckout" :account-name="account?.name" @close="showCheckout = false" @done="onCheckout" />
      <ForceCheckoutModal v-if="showForce" :account-name="account?.name" :used-by="activeUsage ? userName(activeUsage.used_by) : ''" :purpose="activeUsage?.purpose || ''" @close="showForce = false" @done="onForceRelease" />
      <AccountGameDialog v-if="showGameDialog" :account-name="account?.name" @close="showGameDialog = false" @saved="onGameAdded" />
      <AccountLinkDialog v-if="showLinkDialog" :account-name="account?.name" @close="showLinkDialog = false" @saved="onLinkAdded" />
      <AccountFormModal v-if="showEdit" :account="account" @close="showEdit = false" @saved="onEdited" />
      <ConfirmDialog
        v-if="showRemoveGame" title="Gỡ game"
        :message="`Gỡ game «${removeGameLabel}» khỏi tài khoản này? Tài khoản sẽ rời section role/game tương ứng.`"
        confirm-label="Gỡ" danger :loading="removingGame" :error="removeGameError"
        @close="closeRemoveGame" @confirm="confirmRemoveGame"
      />
      <ConfirmDialog
        v-if="deleteOpen" title="Xoá tài khoản"
        :message="`Xoá tài khoản «${account?.username}»? Mọi liên kết và lịch sử sử dụng sẽ bị xoá theo. Hành động này không thể hoàn tác.`"
        confirm-label="Xoá" danger :loading="deleting" :error="deleteError"
        @close="closeDelete" @confirm="confirmDelete"
      />
    </template>
  </DetailPageLayout>
</template>

<script setup>
import { ref, computed, watch, onMounted, onActivated, onDeactivated, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DetailPageLayout from '../components/DetailPageLayout.vue'
import BackButton from '../components/BackButton.vue'
import PlatformBadge from '../components/PlatformBadge.vue'
import StatusBadge from '../components/StatusBadge.vue'
import RoleBadge from '../components/RoleBadge.vue'
import AccountFormModal from '../components/AccountFormModal.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import CopyButton from '../components/CopyButton.vue'
import InfoRow from '../components/InfoRow.vue'
import EmptyState from '../components/EmptyState.vue'
import PasswordField from '../components/PasswordField.vue'
import TotpCodeWidget from '../components/TotpCodeWidget.vue'
import CodeRequestButton from '../components/CodeRequestButton.vue'
import AccountLinkSection from '../components/AccountLinkSection.vue'
import AccountGameDialog from '../components/AccountGameDialog.vue'
import AccountLinkDialog from '../components/AccountLinkDialog.vue'
import CheckoutModal from '../components/CheckoutModal.vue'
import AccountActivitySection from '../components/AccountActivitySection.vue'
import AccountNotesSection from '../components/AccountNotesSection.vue'
import ForceCheckoutModal from '../components/ForceCheckoutModal.vue'
import { useAuth } from '../composables/useAuth.js'
import { useGamMetadata } from '../composables/useGamMetadata.js'
import { useCheckout } from '../composables/useCheckout.js'
import { useActiveUsage } from '../composables/useActiveUsage.js'
import { useRealtime } from '../composables/useRealtime.js'
import { useNotify } from '../composables/useNotify.js'
import { getDoc, getList, frappeCall } from '../api/index.js'
import { formatDate, userName } from '../utils/format.js'

defineOptions({ name: 'AccountDetailView' })

const route = useRoute()
const router = useRouter()
const { isGamAdmin, isAdmin, user } = useAuth()
const { games, dlcs, platformMeta, loadGamesByRole } = useGamMetadata()
const { success, error: notifyError } = useNotify()
const { on: onRt, off: offRt } = useRealtime()

const canEdit = computed(() => isGamAdmin.value || isAdmin.value)
const canCheckout = computed(() => true) // any GAM user may checkin (start)

const loading = ref(true)
const account = ref(null)
// (role, game) bindings for this account, loaded from the first-class binding
// endpoint (getDoc no longer returns a games child table — role lives on the
// binding). Drives the Games section, the header role badges + main game.
const roleGames = ref([])
const emailDoc = ref(null)
const activeUsage = ref(null)
const linkSection = ref(null)
const activitySection = ref(null)
const notesSection = ref(null)

const showCheckout = ref(false)
const showForce = ref(false)
const showGameDialog = ref(false)
const showLinkDialog = ref(false)
const checkoutLoading = ref(false)

const { checkin } = useCheckout()
const { settings, refresh: refreshActive } = useActiveUsage()

const gamesList = computed(() => roleGames.value || [])
// Distinct role values this account is bound to (a single account may carry
// different roles across games). Surfaced as badges in the header.
const accountRoles = computed(() => {
  const out = []
  for (const r of (roleGames.value || [])) {
    if (r.role && !out.includes(r.role)) out.push(r.role)
  }
  return out
})
// Display name of the account's primary game (is_main row, else first game).
// Surfaced in the header so the assigned game is visible alongside platform/role.
const mainGameName = computed(() => {
  const rows = roleGames.value || []
  const main = rows.find(r => Number(r.is_main) || r.is_main === true) || rows[0] || null
  return main ? gameName(main.game) : ''
})
const codePlatform = computed(() => platformMeta(account.value?.platform)?.code_platform || '')

function gameName(link) {
  const g = games.value.find(x => x.name === link)
  return g?.game_name || link || '—'
}
function serverLabel(link) {
  return link || ''
}
function dlcLabel(link) {
  const d = dlcs.value.find(x => x.name === link)
  return d?.dlc_name || link || ''
}

// The current account is held by the session user → they may end it directly.
const isHolderMe = computed(() => !!activeUsage.value && activeUsage.value.used_by === user.value)

// "Rested enough" badge (governance): account is free AND its last session
// ended ≥ min_rested_hours ago (threshold from the shared settings singleton).
const restedEnough = computed(() => {
  if (activeUsage.value) return false
  const ended = lastEndedAt.value
  if (!ended) return false
  const ms = toMs(ended)
  if (!ms || isNaN(ms)) return false
  const hours = Number(settings.value.min_rested_hours) || 8
  return (now.value - ms) >= hours * 3600000
})

// --- Online/offline timer (Req #4.2) ---
const now = ref(Date.now())
let tick = null

function toMs(d) {
  if (!d) return NaN
  let str = String(d)
  if (str.includes(' ') && !str.includes('Z') && !str.includes('+')) str = str.replace(' ', 'T')
  return new Date(str).getTime()
}

const lastEndedAt = ref(null)

const statusTimer = computed(() => {
  if (activeUsage.value?.started_at) {
    return { online: true, ms: now.value - toMs(activeUsage.value.started_at) }
  }
  const since = lastEndedAt.value ? toMs(lastEndedAt.value) : toMs(account.value?.account_created_at)
  return { online: false, ms: since ? now.value - since : 0 }
})

function elapsedLabel(ms) {
  if (!ms || isNaN(ms) || ms < 0) return '—'
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${Math.floor(ms / 1000)}s`
}

async function loadRoleGames() {
  if (!route.params.name) { roleGames.value = []; return }
  try {
    roleGames.value = await frappeCall('gam.api.get_account_role_games', { account: route.params.name })
  } catch {
    roleGames.value = []
  }
}

async function loadAccount() {
  if (!route.params.name) return
  loading.value = true
  try {
    account.value = await getDoc('GAM Account', route.params.name)
    // resolve email doc + active usage + (role, game) bindings in parallel
    const tasks = [loadActiveUsage(), loadRoleGames()]
    if (account.value?.email) tasks.push(loadEmail(account.value.email))
    await Promise.all(tasks)
  } catch {
    account.value = null
    roleGames.value = []
  } finally {
    loading.value = false
  }
}

async function loadEmail(name) {
  try {
    emailDoc.value = await getDoc('GAM Email', name)
  } catch {
    emailDoc.value = null
  }
}

async function loadActiveUsage() {
  try {
    const [activeList, recentList] = await Promise.all([
      getList('GAM Account Usage', {
        fields: ['name', 'account', 'status', 'used_by', 'purpose', 'started_at', 'lease_until'],
        filters: [['account', '=', route.params.name], ['status', '=', 'IN_USE']],
        limit: 1,
        order_by: 'started_at desc',
      }),
      getList('GAM Account Usage', {
        fields: ['name', 'ended_at'],
        filters: [['account', '=', route.params.name]],
        limit: 5,
        order_by: 'ended_at desc',
      }),
    ])
    activeUsage.value = activeList[0] || null
    const lastEnded = recentList.find((u) => u.ended_at)
    lastEndedAt.value = lastEnded?.ended_at || null
  } catch {
    activeUsage.value = null
    lastEndedAt.value = null
  }
}

function onCheckout() {
  showCheckout.value = false
  loadActiveUsage()
  // Keep the shared active-usage singleton in sync so cards/lock state in
  // other open views update without waiting for the websocket push.
  refreshActive()
  activitySection.value?.refresh?.()
  success('Đã checkin — bắt đầu sử dụng tài khoản')
}

function onForceRelease() {
  showForce.value = false
  loadActiveUsage()
  refreshActive()
  activitySection.value?.refresh?.()
  success('Đã force checkout — tài khoản được giải phóng')
}

async function handleCheckin() {
  checkoutLoading.value = true
  try {
    await checkin({ account: account.value.name })
    success('Đã checkout — kết thúc phiên sử dụng')
    await loadActiveUsage()
    refreshActive()
    activitySection.value?.refresh?.()
  } catch (e) {
    // P2.4: surface the failure so the user knows the lease did not release
    // (the composable swallows nothing — re-thrown here is the single source
    // of truth for the toast). Button resets via finally.
    notifyError(e?.message || 'Checkout thất bại — vui lòng thử lại')
  } finally {
    checkoutLoading.value = false
  }
}

function onGameAdded() {
  showGameDialog.value = false
  loadAccount()
  // Reflow the dynamic role/game sidebar sections live (no manual reload).
  loadGamesByRole(true)
}
function onLinkAdded() {
  showLinkDialog.value = false
  linkSection.value?.refresh?.()
}

// ---- Edit / delete ----
const showEdit = ref(false)
function onEdited() {
  showEdit.value = false
  loadAccount()
  // Reflow the dynamic role/game sidebar sections live (no manual reload).
  loadGamesByRole(true)
}

// ---- Remove a single game (granular, keeps the sidebar live) ----
const showRemoveGame = ref(false)
const removingGame = ref(false)
const removeGameError = ref('')
const removeGameTarget = ref(null)
const removeGameLabel = computed(() => (removeGameTarget.value ? gameName(removeGameTarget.value.game) : ''))
function askRemoveGame(g) {
  removeGameTarget.value = g
  removeGameError.value = ''
  showRemoveGame.value = true
}
function closeRemoveGame() {
  if (removingGame.value) return
  showRemoveGame.value = false
  removeGameTarget.value = null
  removeGameError.value = ''
}
async function confirmRemoveGame() {
  if (!removeGameTarget.value) return
  removingGame.value = true
  removeGameError.value = ''
  try {
    await frappeCall('gam.api.remove_account_role_game', {
      account: account.value.name,
      row_name: removeGameTarget.value.name,
    })
    success('Đã gỡ game')
    showRemoveGame.value = false
    removeGameTarget.value = null
    await loadAccount()
    // Sidebar section for this role/game must reflow without a reload.
    loadGamesByRole(true)
  } catch (e) {
    removeGameError.value = e.message || 'Gỡ game thất bại'
  } finally {
    removingGame.value = false
  }
}

const deleteOpen = ref(false)
const deleting = ref(false)
const deleteError = ref('')
function askDelete() {
  deleteError.value = ''
  deleteOpen.value = true
}
function closeDelete() {
  if (deleting.value) return
  deleteOpen.value = false
  deleteError.value = ''
}
async function confirmDelete() {
  deleting.value = true
  deleteError.value = ''
  try {
    const res = await frappeCall('gam.api.delete_account', { name: account.value.name })
    if (res.blocked) {
      deleteError.value = `Không thể xoá: tài khoản đang được sử dụng bởi ${res.in_use_by || 'người khác'}.`
    } else {
      success('Đã xoá')
      deleteOpen.value = false
      loadGamesByRole(true)
      router.push('/accounts')
    }
  } catch (e) {
    deleteError.value = e.message || 'Xoá thất bại'
  } finally {
    deleting.value = false
  }
}

// ---- Realtime + keep-alive lifecycle (Req #1 — detail is now live, no F5) ----
// This view is wrapped in <keep-alive> with no route :key, so navigating between
// accounts reuses the instance. We therefore:
//  - reload on `onActivated` (re-entry) and on route param change (A→B)
//  - reload when `gam_account_changed` fires for THIS account (live updates)
//  - gate heavy work behind `isActive` so a cached/hidden view stays quiet.
const isActive = ref(false)

function onAccountChanged(data) {
  if (!isActive.value) return
  if (!data || data.account !== route.params.name) return
  // usage / lock state changed for the visible account → refresh usage + activity
  loadActiveUsage()
  activitySection.value?.refresh?.()
}

onMounted(() => {
  onRt('gam_account_changed', onAccountChanged)
  // This detail view is NOT in AppLayout's KEEP_ALIVE_VIEWS allow-list (secrets
  // must not linger in cache), so onActivated never fires on first visit — the
  // initial load MUST happen here. Without it the page mounts into a permanent
  // "Đang tải tài khoản..." spinner (regression: loadAccount was only in
  // onActivated, which requires keep-alive to trigger).
  isActive.value = true
  tick = setInterval(() => { now.value = Date.now() }, 1000)
  loadAccount()
})

onActivated(() => {
  // Re-entry path when the view is ever cached (currently it isn't, but keep
  // this correct so flipping the keep-alive allow-list can't reintroduce the
  // bug). Idempotent alongside onMounted on the very first activation.
  isActive.value = true
  if (!tick) tick = setInterval(() => { now.value = Date.now() }, 1000)
  loadAccount()
})

onDeactivated(() => {
  isActive.value = false
  if (tick) { clearInterval(tick); tick = null }
})

// Handle same-component param change (account A → B while the view stays active).
watch(() => route.params.name, (n, old) => {
  if (n && n !== old && isActive.value) loadAccount()
})

onUnmounted(() => {
  offRt('gam_account_changed', onAccountChanged)
  if (tick) { clearInterval(tick); tick = null }
})
</script>
