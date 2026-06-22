<template>
  <div class="h-full overflow-y-auto custom-scrollbar">
    <PageHeader title="Dashboard" subtitle="Tổng quan hệ thống" icon="🏠" :connected="connected" @refresh="loadStats" />

    <div class="max-w-5xl mx-auto space-y-6">
      <!-- Welcome -->
      <div class="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-indigo-600/20">
            🎮
          </div>
          <div>
            <h2 class="text-xl font-black text-app-text-primary tracking-tight">Xin chào{{ displayName ? ', ' + displayName : '' }}!</h2>
            <p class="text-app-text-muted text-sm mt-0.5">
              Game Account Manager · <span class="font-semibold text-app-text-secondary">{{ roleLabel }}</span>
            </p>
          </div>
        </div>
      </div>

      <!-- Stat cards -->
      <LoadingSpinner v-if="loading && !stats" size="lg" text="Đang tải thống kê..." />
      <div v-else-if="stats" class="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <button
          v-for="card in cards" :key="card.key"
          @click="card.to ? router.push(card.to) : null"
          class="text-left bg-app-surface border rounded-2xl p-4 shadow-sm transition hover:shadow-md"
          :class="card.border"
        >
          <p class="text-[9px] text-app-text-muted font-black uppercase tracking-widest mb-1">{{ card.label }}</p>
          <p class="text-2xl font-black font-mono tracking-tighter" :class="card.color">{{ card.value }}</p>
          <p class="text-[10px] mt-1" :class="card.hintColor">{{ card.hint }}</p>
        </button>
      </div>
      <div v-else class="bg-app-surface border border-app-border rounded-2xl p-6 text-center">
        <EmptyState icon="🔌" text="Chưa kết nối backend" subtext="Module gam chưa cài đặt trên erp.local (B0–B3)." />
      </div>

      <!-- Accounts by role (role drives dashboards) -->
      <div v-if="roleCards.length" class="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">🏷️ Tài khoản theo Role</h3>
          <span class="text-[10px] text-app-text-muted font-bold">tổng {{ accountStats?.total ?? stats?.total_accounts ?? 0 }}</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <button
            v-for="rc in roleCards" :key="rc.value || '__none__'" type="button"
            @click="router.push(rc.to)"
            class="text-left bg-app-bg border border-app-border rounded-xl p-3 hover:border-indigo-600/40 transition"
          >
            <div class="flex items-center gap-2 mb-1">
              <span class="text-base">{{ rc.icon }}</span>
              <span class="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded" :class="optionColorClass(rc.color)">{{ rc.label }}</span>
            </div>
            <p class="text-xl font-black font-mono tracking-tighter text-app-text-primary">{{ rc.count }}</p>
          </button>
        </div>
      </div>

      <!-- Expiring links -->
      <div v-if="stats && expiringLinks.length" class="bg-app-surface border border-app-border rounded-2xl overflow-hidden">
        <div class="px-5 py-4 border-b border-app-border flex items-center justify-between">
          <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">⚠️ Liên kết sắp hết hạn</h3>
          <span class="text-[10px] text-app-text-muted font-bold">{{ expiringLinks.length }} trong 7 ngày</span>
        </div>
        <div class="divide-y divide-app-border">
          <div
            v-for="link in expiringLinks" :key="link.name"
            class="px-5 py-3 flex items-center justify-between gap-3 hover:bg-app-bg/50 transition"
          >
            <div class="min-w-0">
              <p class="text-sm font-bold text-app-text-primary truncate">{{ link.source_account }} → {{ link.target_account }}</p>
              <p class="text-[10px] text-app-text-muted">{{ link.link_type || 'Link' }}</p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-xs font-black" :class="daysLeftClass(link.days_left)">{{ formatDate(link.expiry_date) }}</p>
              <p class="text-[10px] text-app-text-muted">còn {{ link.days_left }} ngày</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick modules -->
      <div>
        <p class="text-app-text-muted text-[10px] font-black uppercase tracking-widest mb-3">Truy cập nhanh</p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            v-for="m in modules" :key="m.to" @click="router.push(m.to)"
            class="text-left bg-app-surface border border-app-border rounded-2xl p-5 hover:border-indigo-600/50 hover:shadow-lg transition group"
          >
            <div class="text-2xl mb-3 group-hover:scale-110 transition-transform">{{ m.icon }}</div>
            <p class="text-app-text-primary font-bold text-sm">{{ m.label }}</p>
            <p class="text-app-text-muted text-xs mt-1">{{ m.desc }}</p>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import { useAuth } from '../composables/useAuth.js'
import { useRealtime } from '../composables/useRealtime.js'
import { useNotify } from '../composables/useNotify.js'
import { useGamMetadata, optionColorClass } from '../composables/useGamMetadata.js'
import { frappeCall } from '../api/index.js'
import { formatDate } from '../utils/format.js'

defineOptions({ name: 'DashboardView' })

const router = useRouter()
const { user, isGamAdmin, isAdmin } = useAuth()
const { connected, on, off } = useRealtime()
const { success } = useNotify()
const { roleMeta, loadListOptions } = useGamMetadata()

const loading = ref(false)
const stats = ref(null)
const accountStats = ref(null)

const displayName = computed(() => user.value && user.value !== 'Guest' ? user.value.split('@')[0] : '')
const roleLabel = computed(() => (isGamAdmin.value || isAdmin.value) ? 'GAM Admin' : 'GAM Member')

const expiringLinks = computed(() => stats.value?.expiring_links || stats.value?.expiring_link_details || [])

const cards = computed(() => {
  if (!stats.value) return []
  const s = stats.value
  return [
    { key: 'accounts', label: 'Tài khoản', value: s.total_accounts ?? 0, to: '/accounts', color: 'text-app-text-primary', border: 'border-app-border', hint: 'Tổng số', hintColor: 'text-app-text-muted' },
    { key: 'banned', label: 'Đang bị Ban', value: s.banned_accounts ?? 0, to: '/accounts', color: (s.banned_accounts ?? 0) > 0 ? 'text-red-500' : 'text-app-text-primary', border: (s.banned_accounts ?? 0) > 0 ? 'border-red-500/40' : 'border-app-border', hint: (s.banned_accounts ?? 0) > 0 ? 'Cần kiểm tra' : 'Bình thường', hintColor: (s.banned_accounts ?? 0) > 0 ? 'text-red-500' : 'text-app-text-muted' },
    { key: 'expiring', label: 'Link sắp hết hạn', value: s.expiring_links_count ?? s.expiring_links ?? expiringLinks.value.length ?? 0, color: (s.expiring_links_count ?? s.expiring_links ?? 0) > 0 ? 'text-amber-500' : 'text-app-text-primary', border: (s.expiring_links_count ?? s.expiring_links ?? 0) > 0 ? 'border-amber-500/40' : 'border-app-border', hint: 'trong 7 ngày', hintColor: 'text-app-text-muted' },
    { key: 'emails', label: 'Email', value: s.total_emails ?? 0, color: 'text-app-text-primary', border: 'border-app-border', hint: 'Đang hoạt động', hintColor: 'text-app-text-muted' },
    { key: 'codes', label: 'Code chờ', value: s.available_codes ?? 0, color: (s.available_codes ?? 0) > 0 ? 'text-emerald-500' : 'text-app-text-primary', border: (s.available_codes ?? 0) > 0 ? 'border-emerald-500/40' : 'border-app-border', hint: 'AVAILABLE', hintColor: (s.available_codes ?? 0) > 0 ? 'text-emerald-500' : 'text-app-text-muted' },
  ]
})

const roleCards = computed(() => {
  const by = accountStats.value?.by_role
  if (!by) return []
  return Object.entries(by)
    .map(([value, count]) => {
      const m = roleMeta(value) || {}
      return {
        value,
        count,
        label: value ? (m.label || value) : 'Chưa phân role',
        icon: m.icon || '🏷️',
        color: m.color || 'gray',
        to: value ? `/accounts?role=${encodeURIComponent(value)}` : '/accounts',
      }
    })
    .sort((a, b) => b.count - a.count)
})

function daysLeftClass(days) {
  if (days <= 1) return 'text-red-500'
  if (days <= 3) return 'text-amber-500'
  return 'text-app-text-secondary'
}

async function loadStats() {
  loading.value = true
  try {
    stats.value = await frappeCall('gam.api.get_dashboard_stats')
  } catch {
    // backend not ready — keep null to show the "not connected" state
    stats.value = null
  } finally {
    loading.value = false
  }
  loadAccountStats() // independent of dashboard readiness
}

async function loadAccountStats() {
  try {
    accountStats.value = await frappeCall('gam.api.get_account_stats')
  } catch {
    accountStats.value = null
  }
}

// Realtime: toast when a new verification code lands.
function onNewCode(data) {
  success(`📩 Code mới: ${data?.platform || data?.code_platform || 'EMAIL'}`)
  loadStats()
}
const codeHandler = onNewCode

const modules = [
  { to: '/search', icon: '🔍', label: 'Tìm kiếm', desc: 'Tìm tài khoản / email / game' },
  { to: '/emails', icon: '📧', label: 'Mã Email', desc: 'Verification code mới nhận' },
  { to: '/accounts', icon: '🎮', label: 'Tài khoản', desc: 'Quản lý tài khoản game' },
]

onMounted(() => {
  loadStats()
  loadListOptions()
  on('gam_new_code', codeHandler)
})

onUnmounted(() => {
  off('gam_new_code', codeHandler)
})
</script>
