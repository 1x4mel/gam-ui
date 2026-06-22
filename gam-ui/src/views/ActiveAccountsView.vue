<template>
  <div class="max-w-5xl mx-auto pb-10">
    <PageHeader
      :title="title"
      :subtitle="subtitle"
      icon="🟢"
      :connected="connected"
      @refresh="refresh"
    />

    <LoadingSpinner v-if="loading && !rows.length" text="Đang tải phiên hoạt động..." />
    <EmptyState
      v-else-if="!rows.length" icon="🟢" text="Không có tài khoản đang hoạt động"
      subtext="Khi bạn (hoặc người khác) checkin một tài khoản, nó sẽ xuất hiện tại đây."
    />

    <template v-else>
      <!-- Section Của tôi -->
      <ActiveSection
        title="Của tôi"
        icon="🟦"
        tone="mine"
        :rows="mineRows"
        :now="now"
        :settings="settings"
        :current-user-id="user"
        :show-checkout="true"
        :busy-account="busy"
        @detail="goDetail"
        @checkout="endLease"
        @force="openForce"
      />
      <p v-if="!mineRows.length" class="text-xs text-app-text-muted italic mt-6">
        Bạn chưa checkin tài khoản nào.
      </p>

      <!-- Section Khác -->
      <ActiveSection
        v-if="otherRows.length"
        title="Khác"
        icon="👥"
        tone="other"
        :rows="otherRows"
        :now="now"
        :settings="settings"
        :current-user-id="user"
        :can-force="adminView"
        @detail="goDetail"
        @checkout="endLease"
        @force="openForce"
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
 * Elapsed timers tick every 1s for a realtime feel. They prefer the absolute
 * `started_at_epoch` (server DB-clock seconds) so they are timezone-independent
 * and stay consistent with the server auto-release sweep. Cards / the sidebar
 * tab blink red when a lease crosses the governance soft/hard cap.
 */
import { ref, computed, onActivated, onDeactivated } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import ActiveSection from '../components/ActiveSection.vue'
import ForceCheckoutModal from '../components/ForceCheckoutModal.vue'
import { useAuth } from '../composables/useAuth.js'
import { useActiveUsage } from '../composables/useActiveUsage.js'
import { useRealtime } from '../composables/useRealtime.js'
import { useCheckout } from '../composables/useCheckout.js'
import { useNotify } from '../composables/useNotify.js'

defineOptions({ name: 'ActiveAccountsView' })

const router = useRouter()
const { user, isGamAdmin, isAdmin } = useAuth()
const { myActive, allActive, settings, myCount, adminCount, loading, refresh } = useActiveUsage()
const { connected } = useRealtime()
const { checkin } = useCheckout()
const { success, error: notifyError } = useNotify()

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

// --- realtime elapsed tick (1s) ---
const now = ref(Date.now())
let timer = null

const mineRows = computed(() => rows.value.filter((l) => !!l.used_by && l.used_by === user.value))
const otherRows = computed(() => rows.value.filter((l) => !(!!l.used_by && l.used_by === user.value)))

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
    await refresh()
  } catch (e) {
    notifyError(e.message || 'Checkout thất bại')
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
  await refresh()
}

// keep-alive lifecycle
onActivated(() => {
  refresh()
  if (timer) clearInterval(timer)
  // 1s tick → the timer counts up smoothly in real time.
  timer = setInterval(() => { now.value = Date.now() }, 1000)
})
onDeactivated(() => {
  if (timer) { clearInterval(timer); timer = null }
})
</script>
