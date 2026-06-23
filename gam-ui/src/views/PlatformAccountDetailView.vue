<template>
  <DetailPageLayout :loading="loading" loading-text="Đang tải tài khoản Platform..." max-width="max-w-5xl">
    <template #toolbar>
      <div class="flex items-center gap-3">
        <BackButton @click="router.push('/admin/platforms')" />
        <h2 class="text-base sm:text-lg font-black text-app-text-primary uppercase tracking-tight">Chi tiết Platform</h2>
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
                <span>🖥️ {{ account.platform }}</span>
                <span class="opacity-30">·</span>
                <span>{{ childCount }} tài khoản Game</span>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <StatusBadge :status="account.status" size="lg" />
            <span
              v-if="renewalBadge.label"
              class="text-[9px] uppercase font-black px-1.5 py-0.5 rounded"
              :class="renewalBadge.cls"
            >{{ renewalBadge.label }}</span>
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

        <!-- Checkin/Checkout bar (mirrors AccountDetailView) -->
        <div class="mt-5 pt-5 border-t border-app-border">
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
          <div v-else class="flex items-center justify-between gap-3 flex-wrap">
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
        </div>
      </div>

      <div class="space-y-6">
        <!-- ① Platform credentials (this node's own login) -->
        <div class="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm space-y-4">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">🔑 Đăng nhập Platform</h3>
            <span class="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-500">Node Platform</span>
          </div>
          <p class="text-[10px] text-app-text-muted italic">Thông tin đăng nhập của tài khoản Platform. Các node Game con kế thừa các thông tin này khi node không có riêng.</p>
          <div class="flex flex-col gap-1">
            <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest opacity-30">Username</p>
            <div class="flex items-center gap-2">
              <span class="text-sm font-black text-app-text-primary">{{ account.username || '—' }}</span>
              <CopyButton v-if="account.username" :text="account.username" />
            </div>
          </div>
          <PasswordField doctype="GAM Account" :name="account.name" fieldname="account_password" label="Mật khẩu" :has-value="ownHasPassword" />
          <TotpCodeWidget doctype="GAM Account" :name="account.name" fieldname="totp_secret" label="2FA / Mã TOTP" :has-value="ownHasTotp" />
        </div>

        <!-- ② Email (address only — never the raw doc-name id) -->
        <div class="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm space-y-4">
          <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">📧 Email</h3>
          <div class="flex flex-col gap-1">
            <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest opacity-30">Địa chỉ email</p>
            <div class="flex items-center gap-2 flex-wrap">
              <span v-if="emailDoc?.address" class="text-sm font-black text-app-text-primary">{{ emailDoc.address }}</span>
              <span v-else class="text-sm text-app-text-muted italic">—</span>
              <CopyButton v-if="emailDoc?.address" :text="emailDoc.address" />
              <router-link v-if="emailDoc" :to="`/emails/${emailDoc.name}`" class="text-[10px] text-indigo-600 hover:underline ml-auto">→ xem mã</router-link>
            </div>
          </div>
          <div>
            <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest opacity-30 mb-2">Verification code</p>
            <CodeRequestButton
              :email-name="account.email || (emailDoc && emailDoc.name) || ''"
              :account-name="account.name"
              :platform="codePlatform"
            />
          </div>
        </div>

        <!-- ③ Billing / renewal -->
        <div class="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm">
          <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">💳 Thanh toán / Gia hạn</h3>
            <button
              v-if="canEdit && account.billing_type && account.billing_type !== 'ONE_TIME'" @click="openRenew"
              class="text-[10px] text-amber-500 hover:text-amber-400 font-black uppercase tracking-wider px-2 py-1 rounded-lg hover:bg-amber-500/10 transition"
            >🔁 Gia hạn</button>
          </div>
          <div v-if="account.billing_type && account.billing_type !== 'ONE_TIME'" class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InfoRow label="Loại phí" :value="billingLabel(account.billing_type)" />
            <InfoRow label="Trạng thái gia hạn" :value="renewalBadge.label || '—'" />
            <InfoRow label="Hiệu lực đến" :value="formatDate(account.active_until) || '—'" />
            <InfoRow label="Cảnh báo trước" :value="(account.renewal_lead_days != null ? account.renewal_lead_days + ' ngày' : '—')" />
            <InfoRow label="Chi phí gia hạn" :value="(account.renewal_cost != null ? Number(account.renewal_cost).toLocaleString('vi-VN') : '—')" />
            <InfoRow label="Tự động gia hạn" :value="account.auto_renew ? 'Bật' : 'Tắt'" />
            <InfoRow v-if="account.last_renewed_at" label="Lần gia hạn cuối" :value="formatDate(account.last_renewed_at)" />
          </div>
          <p v-else class="text-xs text-app-text-muted italic">Phí một lần (ONE_TIME) — không cần gia hạn.</p>
        </div>

        <!-- ④ Links (explicit GAM Account Link entries + the parent/child tree with each child node's games/roles) -->
        <AccountLinkSection ref="linkSection" :account-name="account.name" :child-nodes="children" :show-hierarchy="true" :can-edit="canEdit" @add-link="showLinkDialog = true" />

        <!-- Meta -->
        <div class="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm">
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

        <!-- Activity timeline -->
        <AccountActivitySection ref="activitySection" :account-name="account.name" />

        <!-- Collaborative notes -->
        <AccountNotesSection ref="notesSection" :account-name="account.name" :current-user="user" :is-admin="isGamAdmin || isAdmin" />
      </div>
    </div>

    <EmptyState v-else-if="!loading" icon="🖥️" text="Không tìm thấy Platform" subtext="Tài khoản không tồn tại hoặc bạn không có quyền." />

    <template #modals>
      <CheckoutModal v-if="showCheckout" :account-name="account?.name" @close="showCheckout = false" @done="onCheckout" />
      <ForceCheckoutModal v-if="showForce" :account-name="account?.name" :used-by="activeUsage ? userName(activeUsage.used_by) : ''" :purpose="activeUsage?.purpose || ''" @close="showForce = false" @done="onForceRelease" />
      <AccountLinkDialog v-if="showLinkDialog" :account-name="account?.name" @close="showLinkDialog = false" @saved="onLinkAdded" />
      <AccountFormModal v-if="showEdit" :account="account" @close="showEdit = false" @saved="onEdited" />
      <ConfirmDialog
        v-if="deleteOpen" title="Xoá Platform"
        :message="`Xoá Platform «${account?.username}»? Mọi node Game con và lịch sử sẽ bị xoá theo. Hành động này không thể hoàn tác.`"
        confirm-label="Xoá" danger :loading="deleting" :error="deleteError"
        @close="closeDelete" @confirm="confirmDelete"
      />

      <!-- Renewal modal -->
      <ModalWrapper :model-value="renewOpen" @update:model-value="closeRenew">
        <template #header>
          <div class="px-8 pt-6 pb-2">
            <h2 class="text-base font-black text-app-text-primary">Gia hạn {{ account?.username }}</h2>
            <p v-if="account?.active_until" class="text-[11px] text-app-text-muted italic mt-1">Hiệu lực hiện tại đến {{ formatDate(account.active_until) }}</p>
          </div>
        </template>
        <div class="px-8 pb-2 space-y-4">
          <div>
            <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Gia hạn theo</label>
            <div class="flex gap-1.5 mt-1.5 flex-wrap">
              <button
                v-for="opt in RENEW_PERIODS" :key="opt.days" @click="applyRenewPeriod(opt.days)"
                class="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition"
                :class="renewPeriodSel === opt.days ? 'border-indigo-600 bg-indigo-600/10 text-indigo-400' : 'border-app-border text-app-text-muted hover:text-app-text-primary'"
              >
                +{{ opt.days }} ngày
              </button>
            </div>
          </div>
          <div>
            <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Hiệu lực đến (mới)</label>
            <input v-model="renewForm.new_active_until" type="date" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[10px] font-black uppercase tracking-widest text-app-text-muted">Chi phí</label>
              <input v-model.number="renewForm.renewal_cost" type="number" min="0" step="1000" class="w-full mt-1 px-3 py-2 rounded-xl bg-app-bg border border-app-border text-sm text-app-text-primary focus:outline-none focus:border-indigo-600/50" />
            </div>
            <div class="flex items-end">
              <label class="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-app-text-muted pb-2 cursor-pointer">
                <input v-model="renewForm.auto_renew" type="checkbox" class="accent-indigo-600 w-4 h-4" /> Tự động
              </label>
            </div>
          </div>
          <p v-if="renewError" class="text-[11px] font-bold text-red-400">{{ renewError }}</p>
        </div>
        <template #footer>
          <div class="px-8 py-4 flex justify-end gap-2">
            <button @click="closeRenew" class="px-4 py-2 rounded-xl bg-app-bg text-app-text-secondary hover:text-app-text-primary text-[10px] font-black uppercase tracking-widest transition">Huỷ</button>
            <button @click="submitRenew" :disabled="renewSaving" class="px-4 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 inline-flex items-center gap-2">
              <span v-if="renewSaving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Gia hạn
            </button>
          </div>
        </template>
      </ModalWrapper>
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
import AccountFormModal from '../components/AccountFormModal.vue'
import AccountLinkDialog from '../components/AccountLinkDialog.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import CopyButton from '../components/CopyButton.vue'
import InfoRow from '../components/InfoRow.vue'
import EmptyState from '../components/EmptyState.vue'
import PasswordField from '../components/PasswordField.vue'
import TotpCodeWidget from '../components/TotpCodeWidget.vue'
import CodeRequestButton from '../components/CodeRequestButton.vue'
import AccountLinkSection from '../components/AccountLinkSection.vue'
import CheckoutModal from '../components/CheckoutModal.vue'
import AccountActivitySection from '../components/AccountActivitySection.vue'
import AccountNotesSection from '../components/AccountNotesSection.vue'
import ForceCheckoutModal from '../components/ForceCheckoutModal.vue'
import ModalWrapper from '../components/ModalWrapper.vue'
import { useAuth } from '../composables/useAuth.js'
import { useGamMetadata } from '../composables/useGamMetadata.js'
import { useCheckout } from '../composables/useCheckout.js'
import { useActiveUsage } from '../composables/useActiveUsage.js'
import { useRealtime } from '../composables/useRealtime.js'
import { useNotify } from '../composables/useNotify.js'
import { getDoc, getList, frappeCall } from '../api/index.js'
import { formatDate, userName } from '../utils/format.js'

defineOptions({ name: 'PlatformAccountDetailView' })

const route = useRoute()
const router = useRouter()
const { isGamAdmin, isAdmin, user } = useAuth()
const { platformMeta } = useGamMetadata()
const { success, error: notifyError } = useNotify()
const { on: onRt, off: offRt } = useRealtime()

const canEdit = computed(() => isGamAdmin.value || isAdmin.value)

const loading = ref(true)
const account = ref(null)
const emailDoc = ref(null)
// Child GAME nodes + their bound (role, game) bindings — the platform's tree.
const children = ref([])
// Whether the PLATFORM node carries its own password/TOTP (admins only; the
// resolve endpoint requires (role,game) access a platform never has, so members
// fall back to "has value" and the audited reveal endpoint enforces real perms).
const ownHasPassword = ref(false)
const ownHasTotp = ref(false)
const activeUsage = ref(null)
const linkSection = ref(null)
const activitySection = ref(null)
const notesSection = ref(null)

const showCheckout = ref(false)
const showForce = ref(false)
const showEdit = ref(false)
const showLinkDialog = ref(false)
const checkoutLoading = ref(false)

const { checkin } = useCheckout()
const { settings, refresh: refreshActive } = useActiveUsage()

const childCount = computed(() => children.value.length)
const codePlatform = computed(() => platformMeta(account.value?.platform)?.code_platform || '')

function billingLabel(bt) {
  if (bt === 'RENTAL') return 'Thuê (RENTAL)'
  if (bt === 'SUBSCRIPTION') return 'Định kỳ (SUBSCRIPTION)'
  return bt || '—'
}

// --- Renewal state (client-side classification, mirrors backend _renewal_state) ---
function toMs(d) {
  if (!d) return NaN
  let str = String(d)
  if (str.includes(' ') && !str.includes('Z') && !str.includes('+')) str = str.replace(' ', 'T')
  return new Date(str).getTime()
}
const renewalState = computed(() => {
  const a = account.value
  if (!a) return 'ONE_TIME'
  if (!a.billing_type || a.billing_type === 'ONE_TIME' || !a.active_until) return 'ONE_TIME'
  const exp = toMs(a.active_until)
  if (!exp || isNaN(exp)) return 'ONE_TIME'
  const lead = (Number(a.renewal_lead_days) || 3) * 86400000
  if (exp <= now.value) return 'OVERDUE'
  if (exp <= now.value + lead) return 'DUE'
  return 'OK'
})
const renewalBadge = computed(() => {
  switch (renewalState.value) {
    case 'OVERDUE': return { label: '🔴 Quá hạn', cls: 'bg-red-500/15 text-red-400' }
    case 'DUE': return { label: '🟠 Sắp hết hạn', cls: 'bg-amber-500/15 text-amber-400' }
    case 'OK': return { label: '🟢 Còn hạn', cls: 'bg-emerald-500/15 text-emerald-400' }
    default: return { label: '', cls: '' }
  }
})

// --- Online/offline timer ---
const now = ref(Date.now())
let tick = null
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
const isHolderMe = computed(() => !!activeUsage.value && activeUsage.value.used_by === user.value)
const restedEnough = computed(() => {
  if (activeUsage.value) return false
  const ended = lastEndedAt.value
  if (!ended) return false
  const ms = toMs(ended)
  if (!ms || isNaN(ms)) return false
  const hours = Number(settings.value.min_rested_hours) || 8
  return (now.value - ms) >= hours * 3600000
})

async function loadCredFlags() {
  if (!route.params.name) { ownHasPassword.value = false; ownHasTotp.value = false; return }
  // resolve_account_credentials is gated by (role,game) access a PLATFORM node
  // never holds; only admins (who bypass) get real flags. Members fall back to
  // "has value" so reveal buttons remain usable (the reveal endpoint enforces).
  if (!canEdit.value) { ownHasPassword.value = true; ownHasTotp.value = true; return }
  try {
    const res = await frappeCall('gam.api.resolve_account_credentials', { game_account_name: route.params.name })
    ownHasPassword.value = !!(res && res.own_has_password)
    ownHasTotp.value = !!(res && res.own_has_totp)
  } catch {
    ownHasPassword.value = true
    ownHasTotp.value = true
  }
}

async function loadEmail(name) {
  try {
    emailDoc.value = await getDoc('GAM Email', name)
  } catch {
    emailDoc.value = null
  }
}

async function loadChildren() {
  if (!route.params.name) { children.value = []; return }
  try {
    children.value = await frappeCall('gam.api.get_platform_children', { parent: route.params.name })
  } catch {
    children.value = []
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

async function loadAccount() {
  if (!route.params.name) return
  loading.value = true
  try {
    account.value = await getDoc('GAM Account', route.params.name)
    // Hierarchy-aware routing: GAME nodes belong at /accounts/:name. Bounce a
    // GAME node that lands here back to the game detail view so the two tiers
    // never share one layout.
    if (account.value && account.value.account_level !== 'PLATFORM') {
      router.replace(`/accounts/${route.params.name}`)
      return
    }
    const tasks = [loadActiveUsage(), loadCredFlags(), loadChildren()]
    if (account.value?.email) tasks.push(loadEmail(account.value.email))
    await Promise.all(tasks)
  } catch {
    account.value = null
    children.value = []
  } finally {
    loading.value = false
  }
}

function onCheckout() {
  showCheckout.value = false
  loadActiveUsage()
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
    notifyError(e?.message || 'Checkout thất bại — vui lòng thử lại')
  } finally {
    checkoutLoading.value = false
  }
}

function onEdited() {
  showEdit.value = false
  loadAccount()
}
async function onLinkAdded() {
  showLinkDialog.value = false
  linkSection.value?.refresh?.()
  // A link to/from a GAME node may attach it under this platform (via the
  // hierarchy), so refresh the child tree locally rather than waiting for the
  // realtime nudge to round-trip.
  await loadChildren()
}

// ---- Renewal ----
const RENEW_PERIODS = [{ days: 7 }, { days: 30 }, { days: 90 }, { days: 180 }, { days: 365 }]
const renewOpen = ref(false)
const renewPeriodSel = ref(null)
const renewForm = ref({})
const renewSaving = ref(false)
const renewError = ref('')
function openRenew() {
  renewPeriodSel.value = null
  renewError.value = ''
  renewForm.value = {
    new_active_until: account.value?.active_until ? account.value.active_until.slice(0, 10) : new Date().toISOString().slice(0, 10),
    renewal_cost: account.value?.renewal_cost ?? null,
    auto_renew: !!account.value?.auto_renew,
  }
  renewOpen.value = true
}
function closeRenew() {
  if (renewSaving.value) return
  renewOpen.value = false
}
function applyRenewPeriod(days) {
  renewPeriodSel.value = days
  const base = account.value?.active_until
    ? new Date(base.endsWith('Z') ? base : base + 'T00:00:00')
    : new Date()
  const next = new Date(base.getTime() + days * 86400000)
  renewForm.value.new_active_until = next.toISOString().slice(0, 10)
}
function toBackendBool(v) {
  if (v === true) return 1
  if (v === false) return 0
  return v
}
async function submitRenew() {
  if (!renewForm.value.new_active_until) {
    renewError.value = 'Chọn ngày hiệu lực mới'
    return
  }
  renewSaving.value = true
  renewError.value = ''
  try {
    await frappeCall('gam.api.renew_account', {
      account: account.value.name,
      new_active_until: renewForm.value.new_active_until,
      renewal_cost: renewForm.value.renewal_cost ?? undefined,
      auto_renew: toBackendBool(renewForm.value.auto_renew),
    })
    success('Đã gia hạn')
    renewOpen.value = false
    await loadAccount()
  } catch (e) {
    renewError.value = e.message || 'Gia hạn thất bại'
    notifyError(renewError.value)
  } finally {
    renewSaving.value = false
  }
}

// ---- Delete ----
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
      router.push('/admin/platforms')
    }
  } catch (e) {
    deleteError.value = e.message || 'Xoá thất bại'
  } finally {
    deleting.value = false
  }
}

// ---- Realtime + lifecycle ----
const isActive = ref(false)
function onAccountChanged(data) {
  if (!isActive.value) return
  // This handler now fires for THIS platform AND for any child GAME node:
  // save_account/delete_account emit `gam_account_changed` for the parent
  // (this platform) whenever a child is attached/detached/re-parented, so an
  // open platform-detail rebuilds its child tree live (bidirectional sync).
  if (!data || data.account !== route.params.name) return
  loadActiveUsage()
  loadChildren()
  activitySection.value?.refresh?.()
}

onMounted(() => {
  onRt('gam_account_changed', onAccountChanged)
  isActive.value = true
  tick = setInterval(() => { now.value = Date.now() }, 1000)
  loadAccount()
})
onActivated(() => {
  isActive.value = true
  if (!tick) tick = setInterval(() => { now.value = Date.now() }, 1000)
  loadAccount()
})
onDeactivated(() => {
  isActive.value = false
  if (tick) { clearInterval(tick); tick = null }
})
watch(() => route.params.name, (n, old) => {
  if (n && n !== old && isActive.value) loadAccount()
})
onUnmounted(() => {
  offRt('gam_account_changed', onAccountChanged)
  if (tick) { clearInterval(tick); tick = null }
})
</script>
