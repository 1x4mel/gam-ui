<template>
  <div class="max-w-5xl mx-auto pb-10">
    <PageHeader
      :title="title"
      :subtitle="subtitle"
      icon="🟢"
      :connected="connected"
      @refresh="manualRefresh"
    />

    <LoadingSpinner
      v-if="loading && !rows.length && !sortedResting.length"
      text="Đang tải phiên hoạt động..."
    />
    <EmptyState
      v-else-if="!rows.length && !sortedResting.length"
      icon="🟢"
      text="Không có tài khoản đang hoạt động"
      subtext="Khi bạn (hoặc người khác) checkin một tài khoản, nó sẽ xuất hiện tại đây."
    />

    <template v-else>
      <!-- Summary bar: quick counts by urgency tier -->
      <div v-if="rows.length" class="flex items-center gap-2 flex-wrap mt-4 mb-2">
        <button
          class="text-[11px] font-black px-3 py-1.5 rounded-full transition active:scale-95"
          :class="filter === 'all' ? 'bg-blue-500/15 text-blue-600' : 'bg-app-surface text-app-text-muted hover:text-app-text-primary'"
          @click="filter = 'all'"
        >
          🟢 {{ mineRows.length }} đang chạy
        </button>
        <button
          v-if="soonCount"
          class="text-[11px] font-black px-3 py-1.5 rounded-full bg-tier-soon/15 text-tier-soon transition active:scale-95"
          @click="filter = 'soon'"
        >
          🟡 {{ soonCount }} sắp hết
        </button>
        <button
          v-if="overCount"
          class="text-[11px] font-black px-3 py-1.5 rounded-full bg-tier-over/15 text-tier-over transition active:scale-95"
          @click="filter = 'over'"
        >
          🔴 {{ overCount }} quá giờ
        </button>
      </div>

      <!-- Section Của tôi -->
      <ActiveSection
        title="Của tôi"
        icon="🟦"
        tone="mine"
        :rows="filteredMineRows"
        :now="serverNow"
        :settings="settings"
        :current-user-id="user"
        :show-checkout="true"
        :busy-account="busy"
        @detail="goDetail"
        @checkout="endLease"
        @force="openForce"
      />
      <p v-if="!filteredMineRows.length" class="text-xs text-app-text-muted italic mt-6">
        Bạn chưa checkin tài khoản nào.
      </p>

      <!-- Section Khác -->
      <ActiveSection
        v-if="filteredOtherRows.length"
        title="Khác"
        icon="👥"
        tone="other"
        :rows="filteredOtherRows"
        :now="serverNow"
        :settings="settings"
        :current-user-id="user"
        :can-force="adminView"
        @detail="goDetail"
        @checkout="endLease"
        @force="openForce"
      />

      <!-- Section Đang nghỉ (cooling) — bộ đếm OFFLINE realtime -->
      <RestedSection
        :rows="sortedResting"
        :now="serverNow"
        :settings="settings"
        @detail="goDetail"
        @checkin="startLease"
      />
    </template>

    <ForceCheckoutModal
      v-if="forceTarget"
      :account-name="forceTarget.account"
      :used-by="forceTarget.used_by"
      :purpose="forceTarget.purpose"
      @close="forceTarget = null"
      @done="onForceDone"
    />
  </div>
</template>

<script setup>
/**
 * ActiveAccountsView — "Đang hoạt động" (Req #5), realtime.
 *
 * The view is split into two sections:
 *  - "Của tôi"  → leases held by the session user (everyone sees their own).
 *  - "Khác"     → leases held by OTHER users (admins see everyone; members also
 *                 see the aggregate so they can tell an account is taken).
 *
 * The elapsed clock is driven by useElapsedTimer. On every refresh we re-anchor
 * it to the DB-server clock (`serverTimeMs`) so the displayed timer is immune to
 * browser-vs-server clock skew — the root cause of the old "0s/8h" freeze. The
 * 1s tick bumps the client clock; the offset keeps it aligned with the server's
 * auto-release sweep. Cards / the summary bar / dot colours follow a tier ladder
 * (safe → soon → near → over → critical) and leases are sorted so the most
 * urgent ones float to the top.
 */
import { ref, computed, onActivated, onDeactivated } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import ActiveSection from '../components/ActiveSection.vue'
import RestedSection from '../components/RestedSection.vue'
import ForceCheckoutModal from '../components/ForceCheckoutModal.vue'
import { useAuth } from '../composables/useAuth.js'
import { useActiveUsage } from '../composables/useActiveUsage.js'
import { useElapsedTimer, elapsedTier, endedMsOf } from '../composables/useElapsedTimer.js'
import { useRealtime } from '../composables/useRealtime.js'
import { useCheckout } from '../composables/useCheckout.js'
import { useNotify } from '../composables/useNotify.js'

defineOptions({ name: 'ActiveAccountsView' })

const router = useRouter()
const { user, isGamAdmin, isAdmin } = useAuth()
const {
  myActive, allActive, resting, settings, serverTimeMs, myCount, adminCount, loading, refresh,
} = useActiveUsage()
const { connected } = useRealtime()
const { checkout, checkin } = useCheckout()
const { success, error: notifyError } = useNotify()
const { serverNow, syncClock, start, stop, elapsedFor } = useElapsedTimer()

const adminView = computed(() => isGamAdmin.value || isAdmin.value)
const rows = computed(() => (adminView.value ? allActive.value : myActive.value))

const title = computed(() =>
  adminView.value ? `Đang hoạt động (${adminCount.value})` : `Đang hoạt động (${myCount.value})`,
)
const subtitle = computed(() =>
  adminView.value
    ? 'Tất cả phiên đang chạy — bạn có thể force checkout'
    : 'Các tài khoản đang sử dụng (của bạn và của người khác)',
)

// Split into own vs other leases.
const mineRows = computed(() => rows.value.filter((l) => !!l.used_by && l.used_by === user.value))
const otherRows = computed(() => rows.value.filter((l) => !(!!l.used_by && l.used_by === user.value)))

// Urgency counts drive the summary bar badges.
const overCount = computed(() => mineRows.value.filter((l) => isOver(l)).length)
const soonCount = computed(
  () => mineRows.value.filter((l) => { const r = tier(l); return r.tier === 'soon' || r.tier === 'near' }).length,
)

function tier(l) {
  return elapsedTier(elapsedFor(l), settings.value)
}

function isOver(l) {
  const r = tier(l)
  return r.tier === 'over' || r.tier === 'critical'
}

// Sort most urgent first (longest elapsed → highest % of cap on top).
function sortByUrgency(list) {
  return [...list].sort((a, b) => elapsedFor(b) - elapsedFor(a))
}

// Summary-bar filter.
const filter = ref('all')
const filteredMineRows = computed(() => {
  const list = sortByUrgency(mineRows.value)
  if (filter.value === 'over') return list.filter(isOver)
  if (filter.value === 'soon') {
    return list.filter((l) => { const r = tier(l); return r.tier === 'soon' || r.tier === 'near' })
  }
  return list
})
const filteredOtherRows = computed(() => sortByUrgency(otherRows.value))

// Resting (cooling) rows: nearest to ready float to the top (least remaining).
const sortedResting = computed(() => {
  return [...resting.value].sort((a, b) => (endedMsOf(a) || 0) - (endedMsOf(b) || 0))
})

function goDetail(account) {
  router.push(`/accounts/${account}`)
}

// --- end my own lease ---
const busy = ref(null)
async function endLease(l) {
  busy.value = l.account
  try {
    await checkin({ account: l.account })
    success('Đã checkout — kết thúc phiên')
    await manualRefresh()
  } catch (e) {
    notifyError(e.message || 'Checkout thất bại')
  } finally {
    busy.value = null
  }
}

// --- start a lease (checkin) from a resting card ---
async function startLease(r) {
  busy.value = r.account
  try {
    await checkout({ account: r.account })
    success('Đã checkin — bắt đầu phiên')
    await manualRefresh()
  } catch (e) {
    notifyError(e.message || 'Checkin thất bại')
  } finally {
    busy.value = null
  }
}

// --- admin force checkout ---
const forceTarget = ref(null)
function openForce(l) {
  forceTarget.value = { account: l.account, used_by: l.used_by, purpose: l.purpose }
}
async function onForceDone() {
  forceTarget.value = null
  success('Đã force checkout')
  await manualRefresh()
}

// Refresh + re-anchor the clock to the DB server every time.
async function manualRefresh() {
  await refresh()
  syncClock(serverTimeMs.value)
}

// Refresh when the tab becomes visible again so the clock doesn't drift while
// the page was backgrounded (intervals are throttled / frozen by the browser).
function onVisibility() {
  if (document.visibilityState === 'visible') manualRefresh()
}

// keep-alive lifecycle
onActivated(() => {
  manualRefresh()
  start()
  document.addEventListener('visibilitychange', onVisibility)
})
onDeactivated(() => {
  stop()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

