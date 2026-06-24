<template>
  <DetailPageLayout :loading="loading" loading-text="Đang tải email...">
    <template #toolbar>
      <div class="flex items-center gap-3">
        <BackButton @click="router.push('/admin/emails')" />
        <h2 class="text-base sm:text-lg font-black text-app-text-primary uppercase tracking-tight">Chi tiết Email</h2>
      </div>
    </template>

    <div v-if="emailDoc" class="max-w-3xl space-y-6 pb-8">
      <!-- Hero -->
      <div class="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="flex items-center gap-3 min-w-0">
            <span class="text-2xl">{{ providerIcon(emailDoc.provider) }}</span>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h1 class="text-xl font-black text-app-text-primary tracking-tight break-all">{{ emailDoc.address }}</h1>
                <CopyButton :text="emailDoc.address" />
              </div>
              <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                <span class="text-[9px] uppercase font-black text-app-text-muted bg-app-bg px-1.5 py-0.5 rounded">{{ emailDoc.provider || 'Other' }}</span>
                <span v-if="!emailDoc.is_active" class="text-[9px] uppercase font-black text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">tắt</span>
                <span v-if="emailDoc.forward_verified" class="text-[9px] uppercase font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">✓ forward</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <button @click="openEdit" class="px-3 py-2 rounded-xl bg-indigo-500/10 text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500/20 transition">✎ Sửa</button>
            <button @click="askDelete" class="px-3 py-2 rounded-xl bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition">🗑 Xoá</button>
          </div>
        </div>
      </div>

      <!-- ① Credentials (reveal-based, audit-logged) -->
      <div class="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm space-y-5">
        <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">🔑 Thông tin đăng nhập Email</h3>
        <p class="-mt-3 text-[10px] text-app-text-muted italic">Mật khẩu và mã OTP chỉ hiển thị khi bạn nhấn — mỗi lần xem đều được ghi nhật ký (audit log).</p>
        <PasswordField doctype="GAM Email" :name="emailDoc.name" fieldname="email_password" label="Mật khẩu email" :has-value="hasEmailPassword" />
        <TotpCodeWidget doctype="GAM Email" :name="emailDoc.name" fieldname="totp_secret" label="Mã OTP / 2FA (TOTP)" :has-value="hasTotpSecret" />
      </div>

      <!-- ② Recovery emails -->
      <div class="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">🛟 Email khôi phục</h3>
          <button @click="openEdit" class="text-[10px] text-indigo-600 hover:underline font-bold">Sửa</button>
        </div>
        <p v-if="!recoveryEmails.length" class="text-xs text-app-text-muted italic">Chưa có email khôi phục.</p>
        <div v-else class="space-y-2">
          <div v-for="(r, i) in recoveryEmails" :key="i" class="flex items-center gap-2 bg-app-bg border border-app-border rounded-xl px-3 py-2">
            <span class="text-sm font-black text-app-text-primary break-all flex-1">{{ r.address }}</span>
            <CopyButton :text="r.address" />
            <span v-if="r.label" class="text-[10px] text-app-text-muted bg-app-surface px-2 py-0.5 rounded-md">{{ r.label }}</span>
          </div>
        </div>
      </div>

      <!-- ③ Dependent accounts (platform + game nodes) -->
      <div class="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm space-y-4">
        <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">
          🧩 Tài khoản dùng email này
          <span class="text-[10px] font-bold text-app-text-muted normal-case">({{ platformAccounts.length + gameAccounts.length }})</span>
        </h3>
        <p v-if="!platformAccounts.length && !gameAccounts.length" class="text-xs text-app-text-muted italic">Chưa có tài khoản nào dùng email này.</p>

        <!-- Platform accounts -->
        <div v-if="platformAccounts.length">
          <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-2">🖥️ Tài khoản Platform ({{ platformAccounts.length }})</p>
          <div class="space-y-2">
            <router-link
              v-for="a in platformAccounts" :key="a.name" :to="`/platform-accounts/${a.name}`"
              class="flex items-center gap-2 bg-app-bg border border-app-border rounded-xl px-3 py-2.5 hover:border-indigo-600/40 transition"
            >
              <PlatformBadge :platform="a.platform" size="xs" />
              <span class="font-black text-app-text-primary text-sm truncate flex-1">{{ a.username || a.name }}</span>
              <StatusBadge :status="a.status" />
            </router-link>
          </div>
        </div>

        <!-- Game nodes -->
        <div v-if="gameAccounts.length">
          <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-2">🎮 Node Game ({{ gameAccounts.length }})</p>
          <div class="space-y-2">
            <router-link
              v-for="a in gameAccounts" :key="a.name" :to="`/accounts/${a.name}`"
              class="flex items-center gap-2 bg-app-bg border border-app-border rounded-xl px-3 py-2.5 hover:border-indigo-600/40 transition"
            >
              <PlatformBadge :platform="a.platform" size="xs" />
              <span class="font-black text-app-text-primary text-sm truncate flex-1">{{ a.username || a.name }}</span>
              <span v-if="a.parent_account" class="text-[9px] text-amber-500 font-black bg-amber-500/10 px-1.5 py-0.5 rounded">↳ node</span>
              <StatusBadge :status="a.status" />
            </router-link>
          </div>
        </div>
      </div>

      <!-- ④ Meta -->
      <div class="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm">
        <div class="flex flex-col gap-1 mb-5">
          <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest opacity-30">ID (mã email)</p>
          <div class="flex items-center gap-2">
            <span class="text-sm font-mono text-app-text-secondary">{{ emailDoc.name }}</span>
            <CopyButton :text="emailDoc.name" />
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InfoRow label="Provider" :value="emailDoc.provider || '—'" />
          <InfoRow label="Trạng thái" :value="emailDoc.is_active ? 'Hoạt động' : 'Tắt'" />
          <InfoRow label="Ngày tạo" :value="formatDate(emailDoc.creation) || '—'" />
          <InfoRow label="Cập nhật" :value="formatDate(emailDoc.modified) || '—'" />
          <InfoRow label="Xác minh forward" :value="emailDoc.forward_verified ? 'Đã xác minh' : 'Chưa'" />
        </div>
        <div v-if="emailDoc.notes" class="mt-4 pt-4 border-t border-app-border">
          <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest opacity-30 mb-1.5">Ghi chú</p>
          <p class="text-sm text-app-text-secondary whitespace-pre-wrap">{{ emailDoc.notes }}</p>
        </div>
      </div>

      <!-- ⑤ Recent codes (read-only window) -->
      <div v-if="recentCodes.length" class="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">📨 Mã gần đây</h3>
          <router-link :to="`/emails?email=${emailDoc.name}`" class="text-[10px] text-indigo-600 hover:underline font-bold">xem tất cả →</router-link>
        </div>
        <div class="space-y-2">
          <router-link
            v-for="c in recentCodes" :key="c.name" :to="`/emails/${c.name}`"
            class="flex items-center gap-3 bg-app-bg border border-app-border rounded-xl px-3 py-2.5 hover:border-indigo-600/40 transition"
          >
            <PlatformBadge :platform="c.platform" size="xs" />
            <code class="text-sm font-black font-mono text-app-text-primary">{{ c.code }}</code>
            <StatusBadge :status="c.status" />
            <span class="ml-auto text-[10px] text-app-text-muted">{{ formatDate(c.received_at) }}</span>
          </router-link>
        </div>
      </div>
    </div>

    <EmptyState v-else-if="!loading" icon="📬" text="Không tìm thấy email" subtext="Email không tồn tại hoặc bạn không có quyền xem." />

    <template #modals>
      <EmailAccountFormModal
        v-if="formOpen" :model-value="formOpen" :editing="editingName" :email="emailDoc"
        @update:model-value="formOpen = false" @saved="onSaved"
      />
      <ConfirmDialog
        v-if="deleteOpen" title="Xoá email"
        :message="deleteBlocked
          ? ''
          : `Xoá email «${emailDoc?.address}»? Hành động này không thể hoàn tác.`"
        confirm-label="Xoá" danger :loading="deleting" :error="deleteError"
        @close="closeDelete" @confirm="confirmDelete"
      >
        <!-- Blocked-linked-accounts list (same grouping as the card/detail) -->
        <div v-if="deleteBlocked" class="space-y-3">
          <p class="text-sm text-red-500 font-black">⚠️ Không thể xoá</p>
          <p class="text-xs text-app-text-secondary">
            Email đang liên kết với {{ deleteBlockedList.length }} tài khoản. Mở từng tài khoản để đổi sang email khác (hoặc xoá tài khoản) trước khi xoá email.
          </p>
          <div class="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
            <router-link
              v-for="a in deleteBlockedList" :key="a.name"
              :to="a.account_level === 'PLATFORM' ? `/platform-accounts/${a.name}` : `/accounts/${a.name}`"
              class="block bg-app-bg border border-app-border rounded-xl p-3 hover:border-indigo-600/40 transition"
            >
              <div class="flex items-center gap-2">
                <PlatformBadge :platform="a.platform" size="xs" />
                <span class="font-black text-app-text-primary text-sm flex-1 truncate">{{ a.username }}</span>
                <span v-if="a.account_level === 'PLATFORM'" class="text-[9px] text-indigo-400 font-black bg-indigo-500/10 px-1.5 py-0.5 rounded">PLATFORM</span>
                <span v-else class="text-[9px] text-amber-400 font-black bg-amber-500/10 px-1.5 py-0.5 rounded">GAME</span>
                <StatusBadge :status="a.status" />
              </div>
            </router-link>
          </div>
        </div>
      </ConfirmDialog>
    </template>
  </DetailPageLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DetailPageLayout from '../components/DetailPageLayout.vue'
import BackButton from '../components/BackButton.vue'
import CopyButton from '../components/CopyButton.vue'
import InfoRow from '../components/InfoRow.vue'
import EmptyState from '../components/EmptyState.vue'
import PasswordField from '../components/PasswordField.vue'
import TotpCodeWidget from '../components/TotpCodeWidget.vue'
import PlatformBadge from '../components/PlatformBadge.vue'
import StatusBadge from '../components/StatusBadge.vue'
import EmailAccountFormModal from '../components/EmailAccountFormModal.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useNotify } from '../composables/useNotify.js'
import { frappeCall } from '../api/index.js'
import { formatDate } from '../utils/format.js'

defineOptions({ name: 'EmailAccountDetailView' })

const route = useRoute()
const router = useRouter()
const { success, error: notifyError } = useNotify()

const loading = ref(true)
const payload = ref(null)

const emailDoc = computed(() => payload.value?.email || null)
const hasEmailPassword = computed(() => !!payload.value?.has_email_password)
const hasTotpSecret = computed(() => !!payload.value?.has_totp_secret)
const recoveryEmails = computed(() => payload.value?.recovery_emails || [])
const platformAccounts = computed(() => payload.value?.platform_accounts || [])
const gameAccounts = computed(() => payload.value?.game_accounts || [])
const recentCodes = computed(() => payload.value?.recent_codes || [])

function providerIcon(p) {
  const map = { Gmail: '🔵', Outlook: '🟠', Hotmail: '🟠', Proton: '🟣', Yahoo: '🟣', Other: '📧' }
  return map[p] || '📧'
}

async function load() {
  if (!route.params.name) return
  loading.value = true
  try {
    payload.value = await frappeCall('gam.api.get_email_detail', { name: route.params.name })
  } catch {
    payload.value = null
  } finally {
    loading.value = false
  }
}

// ---- Edit ----
const formOpen = ref(false)
const editingName = computed(() => emailDoc.value?.name || null)
function openEdit() {
  formOpen.value = true
}
function onSaved() {
  formOpen.value = false
  load()
}

// ---- Delete (blocked-aware, mirrors EmailAccountsView) ----
const deleteOpen = ref(false)
const deleting = ref(false)
const deleteError = ref('')
const deleteBlocked = ref(false)
const deleteBlockedList = ref([])
function askDelete() {
  deleteError.value = ''
  deleteBlocked.value = false
  deleteBlockedList.value = []
  deleteOpen.value = true
}
function closeDelete() {
  if (deleting.value) return
  deleteOpen.value = false
  deleteBlocked.value = false
  deleteBlockedList.value = []
}
async function confirmDelete() {
  if (deleteBlocked.value) {
    // Already blocked — the user must reassign first; just close.
    closeDelete()
    return
  }
  deleting.value = true
  deleteError.value = ''
  try {
    const res = await frappeCall('gam.api.delete_email_account', { email_name: route.params.name })
    if (res.blocked) {
      deleteBlocked.value = true
      deleteBlockedList.value = res.linked_accounts || []
    } else {
      const u = res.unlinked || {}
      const detached = (u.code_request_log || 0) + (u.email_code || 0) + (u.inbound_log || 0)
      success(detached > 0
        ? `Đã xoá email. Đã gỡ liên kết ${detached} bản ghi lịch sử.`
        : 'Đã xoá')
      deleteOpen.value = false
      router.push('/admin/emails')
    }
  } catch (err) {
    deleteError.value = err.message || 'Xoá thất bại'
    notifyError(deleteError.value)
  } finally {
    deleting.value = false
  }
}

onMounted(load)
</script>
