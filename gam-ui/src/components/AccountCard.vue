<template>
  <div
    class="relative block bg-app-surface border rounded-2xl p-4 transition overflow-hidden"
    :class="cardClass"
  >
    <!-- Leading tier colour stripe (only when an active lease exists). -->
    <span
      v-if="lease"
      class="absolute left-0 top-0 bottom-0 w-1.5"
      :class="`bg-tier-${tier.tier}`"
      aria-hidden="true"
    ></span>

    <!-- ── Zone 1: Identity ─────────────────────────────────────────── -->
    <div class="flex items-center gap-2 flex-wrap pl-1">
      <PlatformBadge :platform="account.platform" />
      <RoleBadge v-for="r in rolesOf(account)" :key="r" :role="r" />
      <p class="font-black text-app-text-primary text-sm flex-1 min-w-0 truncate pl-1">{{ account.username }}</p>
      <StatusBadge :status="account.status" />
      <span v-if="overTime" class="gam-blink text-[9px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded">⚠️ QUÁ GIỜ</span>
    </div>

    <!-- ── Zone 2: Games (main game first) ──────────────────────────── -->
    <div v-if="games.length" class="mt-2 flex items-center gap-1.5 flex-wrap pl-1">
      <span
        v-for="g in games" :key="g.game"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
        :class="g.is_main ? 'bg-indigo-500/15 text-indigo-300' : 'bg-app-bg text-app-text-muted'"
      >
        <span v-if="g.is_main">★</span> 🎮 {{ g.game_name || g.game
        }}<span v-if="g.server_name" class="opacity-60">· {{ g.server_name }}</span>
      </span>
    </div>

    <!-- ── Zone 3: Live state + realtime timer ─────────────────────── -->
    <div class="mt-3 pl-1">
      <!-- Locked by ANOTHER user: countdown against the soft cap. -->
      <template v-if="lease && !mine">
        <div class="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5">
          <div class="flex items-center gap-1.5 text-[10px] mb-1.5">
            <span class="text-amber-600">🔒</span>
            <span class="font-black text-amber-600 truncate">{{ lease.used_by_full_name || userName(lease.used_by) }}</span>
            <span v-if="lease.purpose" class="text-app-text-muted truncate">· {{ lease.purpose }}</span>
          </div>
          <ProgressBar :tier="tier" />
          <div class="flex items-center justify-between mt-1.5 font-mono">
            <span class="text-[11px] font-bold" :class="tierTextClass(tier.tier)">⏱ {{ elapsedLabel }}</span>
            <span class="text-[11px] text-app-text-muted">
              <span v-if="tier.remainingMs > 0">⏳ còn {{ remainingLabel }}</span>
              <span v-else class="font-black text-tier-over">QUÁ GIỜ</span>
            </span>
          </div>
        </div>
      </template>

      <!-- Used by ME: live elapsed timer. -->
      <template v-else-if="lease && mine">
        <div class="rounded-xl bg-blue-500/10 border border-blue-500/20 p-2.5">
          <div class="flex items-center gap-1.5 text-[10px] mb-1.5">
            <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span class="font-black text-blue-600 uppercase tracking-wider">🟢 bạn đang dùng</span>
          </div>
          <ProgressBar :tier="tier" />
          <div class="flex items-center justify-between mt-1.5 font-mono">
            <span class="text-[11px] font-bold" :class="tierTextClass(tier.tier)">⏱ {{ elapsedLabel }}</span>
            <span class="text-[11px] text-app-text-muted">
              <span v-if="tier.remainingMs > 0">⏳ còn {{ remainingLabel }}</span>
              <span v-else class="font-black text-tier-over">QUÁ GIỜ</span>
            </span>
          </div>
        </div>
      </template>

      <!-- Free: resting countdown (cooling) OR ready pill. -->
      <template v-else>
        <!-- Cooling (chưa đủ min_rested): realtime countdown. -->
        <div
          v-if="resting && !restedTierInfo.ready"
          class="rounded-xl p-2.5"
          :class="restedBorderClass(restedTierInfo.tier)"
        >
          <div class="flex items-center gap-1.5 text-[10px] mb-1.5">
            <span class="w-2 h-2 rounded-full" :class="restedDotClass(restedTierInfo.tier)"></span>
            <span class="font-black uppercase tracking-wider" :class="restedTextClass(restedTierInfo.tier)">
              {{ restedTierInfo.label }}
            </span>
          </div>
          <ProgressBar :tier="restedTierInfo" />
          <div class="flex items-center justify-between mt-1.5 font-mono">
            <span class="text-[11px] font-bold" :class="restedTextClass(restedTierInfo.tier)">😴 {{ restedLabel }}</span>
            <span class="text-[11px] text-app-text-muted">⏳ còn {{ restedRemainingLabel }}</span>
          </div>
        </div>
        <!-- Ready / fresh: pill. -->
        <span
          v-else-if="restedTierInfo.ready"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[10px] font-bold"
        >🟢 Sẵn sàng & an toàn</span>
        <span
          v-else
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-app-bg text-app-text-muted text-[10px] font-bold"
        >○ Sẵn sàng</span>
      </template>
    </div>

    <!-- ── Zone 4: Meta + actions ──────────────────────────────────── -->
    <div class="mt-2 flex items-center gap-2 text-[10px] text-app-text-muted flex-wrap pl-1">
      <span v-if="account.source" class="truncate">📦 {{ account.source }}</span>
    </div>

    <!-- Admin back-office: CRUD actions (only when the viewer can manage). -->
    <div v-if="mode === 'admin' && canManage" class="mt-2 flex items-center gap-2 flex-wrap pl-1">
      <router-link :to="`/accounts/${account.name}`" :class="[actBase, actSecondary]" class="no-underline">📋 Chi tiết</router-link>
      <button
        @click.prevent.stop="$emit('edit')"
        :class="[actBase, actSecondary]"
      >✎ Sửa</button>
      <button
        @click.prevent.stop="$emit('delete')"
        :class="[actBase, 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20']"
      >🗑 Xoá</button>
    </div>

    <!-- Operate / task-oriented: ONE unified action row.
         The card body is a plain <div> (not a link), so clicking anywhere on
         the card does NOT navigate — only the "📋 Chi tiết" button opens the
         detail page. Every button shares the same base style as Checkin /
         Checkout (actBase). -->
    <div v-else-if="mode === 'operate'" class="mt-2 flex items-center gap-2 flex-wrap pl-1">
      <!-- Lease action: Free → Checkin / Held by me → Checkout / (admin) Force -->
      <button
        v-if="!lease" @click.prevent.stop="$emit('start')"
        :class="[actBase, 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20']"
      >✅ Checkin</button>
      <button
        v-else-if="mine" @click.prevent.stop="$emit('end')"
        :class="[actBase, 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20']"
      >✓ Checkout</button>
      <button
        v-if="lease && !mine && canForce" @click.prevent.stop="$emit('force')"
        :class="[actBase, 'bg-amber-500/10 text-amber-600 border border-amber-500/30 hover:bg-amber-500/20']"
      >🔓 Force</button>

      <!-- Quick copy: username -->
      <button
        v-if="account.username" type="button" title="Copy username"
        @click.prevent.stop="handleCopy('user', account.username)"
        :class="[actBase, isCopied('user') ? actCopied : actSecondary]"
      >{{ isCopied('user') ? '✓ User' : 'User' }}</button>

      <!-- Quick copy: password (audited reveal+copy) -->
      <button
        type="button" title="Copy mật khẩu" :disabled="passLoading"
        @click.prevent.stop="handleCopyPassword"
        :class="[actBase, (passCopied ? actCopied : actSecondary), 'disabled:opacity-50']"
      >{{ passLoading ? '… Pass' : (passCopied ? '✓ Pass' : '🔑 Pass') }}</button>

      <!-- Verification code: compact fetch → inline code pill. The button
           glows (actFresh) while `freshCode` is set — i.e. a webhook just
           delivered a new code for this account's email. -->
      <button
        v-if="!codeState.hasCode" type="button"
        :title="freshCode ? 'Có code mới! Bấm để lấy' : 'Lấy verification code'"
        :disabled="codeState.loading" @click.prevent.stop="handleRequestCode"
        :class="[actBase, freshCode ? actFresh : actSecondary, 'disabled:opacity-50']"
      >
        <span v-if="codeState.loading" class="inline-block w-3 h-3 border-2 border-app-text-muted/30 border-t-app-text-muted rounded-full animate-spin align-middle"></span>
        <span v-else>📧 Code<span v-if="freshCode"> • mới!</span></span>
      </button>
      <div v-else class="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10" :class="freshCode ? 'ring-2 ring-emerald-400/60 animate-pulse' : ''">
        <code class="text-[11px] font-black font-mono tracking-wider text-emerald-700 select-all">{{ codeState.result.code }}</code>
        <span class="text-[9px] font-bold text-emerald-600/70">⏳{{ codeState.remainingSeconds }}s</span>
        <button type="button" title="Copy code" @click.prevent.stop="handleCopyCode"
          class="px-1.5 py-0.5 text-[10px] text-emerald-600 hover:text-emerald-700 font-black"
        >{{ codeState.copied ? '✓' : '📋' }}</button>
      </div>

      <!-- Quick copy: IGN / Btag (game-account-only fields). -->
      <button
        v-if="account.ign" type="button" title="Copy IGN"
        @click.prevent.stop="handleCopy('ign', account.ign)"
        :class="[actBase, isCopied('ign') ? actCopied : actSecondary]"
      >{{ isCopied('ign') ? '✓ IGN' : 'IGN' }}</button>
      <button
        v-if="account.btag" type="button" title="Copy Btag"
        @click.prevent.stop="handleCopy('btag', account.btag)"
        :class="[actBase, isCopied('btag') ? actCopied : actSecondary]"
      >{{ isCopied('btag') ? '✓ Btag' : 'Btag' }}</button>

      <!-- Detail: the ONLY entry into the account detail page from this card. -->
      <router-link :to="`/accounts/${account.name}`" :class="[actBase, actSecondary]" class="no-underline">📋 Chi tiết</router-link>
    </div>
  </div>
</template>

<script setup>
/**
 * AccountCard — shared row card for the account list views (redesigned).
 *
 * Extracted from AccountListView so the admin back-office (`/accounts`) and the
 * operational role|game view (`/role/:role(/game/:game)`) render the SAME card,
 * differing only by `mode`:
 *   - 'admin'   → CRUD actions (Sửa / Xoá), shown only when `canManage` is true.
 *   - 'operate' → task-oriented lease actions (Checkin / Checkout / Force).
 *
 * Layout: four vertical zones — identity → games → live state+timer → meta/actions.
 *
 * Realtime countdown: the parent list view owns ONE useElapsedTimer and passes the
 * server-aligned `now` (epoch ms, ticks every 1s) + `settings` down. The card
 * derives the elapsed/remaining time and a colour tier (safe→critical) identical
 * to the "Đang hoạt động" view, so lock/over-time state is legible at a glance.
 *
 * Lock/rested state comes from the shared `useActiveUsage` singleton.
 *
 * Events:
 *   - edit, delete            (admin mode)
 *   - start, end, force       (operate mode)
 */
import { computed, ref, reactive, onMounted, onUnmounted } from 'vue'
import PlatformBadge from './PlatformBadge.vue'
import RoleBadge from './RoleBadge.vue'
import StatusBadge from './StatusBadge.vue'
import ProgressBar from './AccountCardProgress.vue'
import { useActiveUsage } from '../composables/useActiveUsage.js'
import { useAuth } from '../composables/useAuth.js'
import { useRevealPassword } from '../composables/useRevealPassword.js'
import { useRequestCode } from '../composables/useRequestCode.js'
import { useNotify } from '../composables/useNotify.js'
import { useRealtime } from '../composables/useRealtime.js'
import {
  elapsedTier,
  tierTextClass,
  tierBorderClass,
  formatDuration,
  startedMsOf,
  restedTier,
  restedTextClass,
  restedBorderClass,
  restedDotClass,
  endedMsOf,
} from '../composables/useElapsedTimer.js'
import { userName } from '../utils/format.js'

const props = defineProps({
  account: { type: Object, required: true },
  mode: { type: String, default: 'admin' }, // 'admin' | 'operate'
  canManage: { type: Boolean, default: false }, // show Sửa/Xoá in admin mode
  canForce: { type: Boolean, default: false },  // show 🔓 Force in operate mode
  /** Server-aligned epoch ms (ticks every 1s from the parent's useElapsedTimer). */
  now: { type: Number, default: 0 },
  /** Online-cap settings {max_online_hours, hard_cap_online_hours, ...}. */
  settings: { type: Object, default: () => ({}) },
  /** Session user id (defaults to the shared auth user). */
  currentUserId: { type: String, default: '' },
})

defineEmits(['edit', 'delete', 'start', 'end', 'force'])

const { leaseFor, restingFor } = useActiveUsage()
const { user: authUser } = useAuth()
const { copy: copyPassword, loading: passLoading } = useRevealPassword()
const { success: notifySuccess, info: notifyInfo, error: notifyError } = useNotify()

// ---- Unified action-button styling (shared by Checkin/Checkout/Force,
//      all quick-copy buttons, and the Chi tiết link). -------------------
const actBase = 'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition active:scale-95'
const actSecondary = 'bg-app-bg/50 text-app-text-secondary border border-app-border hover:bg-indigo-500/10 hover:text-indigo-600 hover:border-indigo-500/30'
const actCopied = 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
// "Fresh code arrived" glow for the Code button (pulsing emerald ring).
const actFresh = 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/40 ring-2 ring-emerald-400/60 animate-pulse'

// ---- Quick actions (operate mode) ---------------------------------------
// Generic clipboard copy for plain fields (username / IGN / Btag). Tracks a
// single "just copied" key so the matching button flips to the success style.
const copiedKey = ref('')
let copiedTimer = null
function isCopied(k) { return copiedKey.value === k }
async function handleCopy(key, text) {
  if (!text) return
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text)
    else {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    copiedKey.value = key
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copiedKey.value = '' }, 1500)
    notifySuccess('Đã copy')
  } catch {
    notifyError('Copy thất bại')
  }
}

// Password copy: audited COPY via gam.api.reveal_password, then clipboard.
const passCopied = ref(false)
let passCopiedTimer = null
async function handleCopyPassword() {
  try {
    const value = await copyPassword('GAM Account', props.account.name, 'account_password')
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value || '')
    passCopied.value = true
    clearTimeout(passCopiedTimer)
    passCopiedTimer = setTimeout(() => { passCopied.value = false }, 1500)
    notifySuccess('Đã copy mật khẩu')
  } catch (e) {
    notifyError(e.message || 'Không copy được mật khẩu')
  }
}

// Verification code: same audited endpoint as the detail page, compact inline.
const codeReq = useRequestCode()
const codeCopied = ref(false)
let codeCopiedTimer = null
// reactive() unwraps the nested refs so the template reads plain values.
const codeState = reactive({
  loading: codeReq.loading,
  result: codeReq.result,
  hasCode: codeReq.hasCode,
  remainingSeconds: codeReq.remainingSeconds,
  copied: codeCopied,
})
async function handleRequestCode() {
  try {
    const res = await codeReq.request({
      emailName: props.account.email || '',
      accountName: props.account.name,
      platform: props.account.platform || '',
    })
    if (res?.status === 'ok') {
      // The user has now consumed the fresh code → stop the blink.
      clearFreshCode()
      notifySuccess('Đã lấy mã xác minh')
    } else {
      notifyInfo('Chưa có code mới, thử lại sau 1–2 phút')
    }
  } catch (e) {
    notifyError(e.message || 'Không lấy được mã')
  }
}
async function handleCopyCode() {
  if (!codeReq.result.value?.code) return
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(codeReq.result.value.code)
    codeCopied.value = true
    clearTimeout(codeCopiedTimer)
    codeCopiedTimer = setTimeout(() => { codeCopied.value = false }, 1500)
  } catch { /* ignore */ }
}

// ---- Fresh-code signal --------------------------------------------------
// When a webhook delivers a new code for THIS account's email, the backend
// broadcasts `gam_new_code` (see gam/realtime.py). We match by email and light
// up the Code button so the operator notices without leaving the list.
// `rtFresh` = instant realtime pulse (auto-clears after ~5 min).
// `account.has_available_code` = server truth from get_accounts_list (an
// AVAILABLE, unexpired code exists for this account's email right now).
// The button glows if EITHER is true — so it lights up even when the page is
// opened AFTER the webhook landed (the realtime event would otherwise be missed).
const rtFresh = ref(false)
let freshCodeTimer = null
function clearFreshCode() {
  rtFresh.value = false
  if (freshCodeTimer) { clearTimeout(freshCodeTimer); freshCodeTimer = null }
}
function markFreshCode() {
  rtFresh.value = true
  notifyInfo(`📧 Có code mới: ${props.account.username}`)
  if (freshCodeTimer) clearTimeout(freshCodeTimer)
  freshCodeTimer = setTimeout(clearFreshCode, 5 * 60 * 1000)
}
const freshCode = computed(() => rtFresh.value || !!props.account.has_available_code)
const { on: onRt, off: offRt } = useRealtime()
function onNewCode(payload) {
  if (!props.account.email) return
  const p = payload || {}
  // Match by owning GAM Email; platform is a secondary guard when present.
  if (p.email && p.email !== props.account.email) return
  if (p.platform && props.account.platform && p.platform !== props.account.platform) return
  markFreshCode()
}
onMounted(() => { onRt('gam_new_code', onNewCode) })
onUnmounted(() => { offRt('gam_new_code', onNewCode); clearFreshCode() })

/** Active lease for this account (shared singleton), or null if free. */
const lease = computed(() => leaseFor(props.account.name))

/** Resting (cooling) row for this account (shared singleton), or null. */
const resting = computed(() => restingFor(props.account.name))

/** Elapsed rested time since the last checkout's `ended_at`, in ms. */
const restedMs = computed(() => {
  const ended = endedMsOf(resting.value)
  if (ended == null) return 0
  return Math.max(0, nowMs.value - ended)
})

/** Resting tier (cooling → warming → almost → ready). */
const restedTierInfo = computed(() => restedTier(restedMs.value, props.settings))
const restedRemainingLabel = computed(() => formatDuration(restedTierInfo.value.remainingMs))
const restedLabel = computed(() => formatDuration(restedMs.value))

const meId = computed(() => props.currentUserId || authUser.value || '')
const mine = computed(() => !!(lease.value && meId.value && lease.value.used_by === meId.value))

/** Fallback to the browser clock if the parent never wired the timer prop. */
const nowMs = computed(() => props.now || Date.now())

const elapsedMs = computed(() => {
  const started = startedMsOf(lease.value)
  if (started == null) return 0
  return Math.max(0, nowMs.value - started)
})

const tier = computed(() => elapsedTier(elapsedMs.value, props.settings))
const overTime = computed(() => tier.value.tier === 'over' || tier.value.tier === 'critical')

const elapsedLabel = computed(() => formatDuration(elapsedMs.value))
const remainingLabel = computed(() => formatDuration(tier.value.remainingMs))

const cardClass = computed(() => {
  if (!lease.value) return 'border-app-border hover:border-indigo-600/50'
  return mine.value
    ? `${tierBorderClass(tier.value.tier)} ring-1 ring-blue-500/20 hover:border-blue-500`
    : tierBorderClass(tier.value.tier)
})

/** Distinct role values for a card — an account may carry several roles across
 *  its (role, game) bindings. */
function rolesOf(acc) {
  const rows = acc.role_games || acc.games || []
  const out = []
  for (const g of rows) {
    if (g.role && !out.includes(g.role)) out.push(g.role)
  }
  return out
}

/** Games for the card, main game first. */
const games = computed(() => {
  const rows = props.account.games || props.account.role_games || []
  return [...rows].sort((a, b) => Number(!!b.is_main) - Number(!!a.is_main))
})
</script>
