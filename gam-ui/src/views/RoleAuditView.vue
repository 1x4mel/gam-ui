<template>
  <div class="h-full flex flex-col overflow-hidden">
    <PageHeader title="Cách ly vai trò" subtitle="B4 · co-tenancy isolation audit" icon="🛡️" :connected="connected" @refresh="auditSelf" />

    <div class="flex-1 overflow-y-auto custom-scrollbar">
      <div class="max-w-3xl mx-auto w-full space-y-6 pb-8">
        <!-- Intro / explanation -->
        <div class="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm">
          <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">Kiểm tra cách ly</h3>
          <p class="text-app-text-muted text-[12px] mt-1.5 leading-relaxed">
            Site <code class="px-1 py-0.5 rounded bg-app-bg text-app-text-secondary text-[11px]">erp.local</code> chạy chung erpnext + trader-ui + GAM.
            GAM Member <strong class="text-app-text-primary">không được</strong> giữ role <code class="text-[11px]">System Manager</code> /
            <code class="text-[11px]">Administrator</code> — nếu không sẽ truy cập được data các app khác qua Desk/REST.
            Công cụ này audit role set của từng user để phát hiện rò rỉ.
          </p>
        </div>

        <LoadingSpinner v-if="loading" size="md" />

        <template v-else>
          <!-- Audit a specific user -->
          <div class="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm space-y-4">
            <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">Audit user</h3>
            <form @submit.prevent="auditInput" class="flex gap-2">
              <input
                v-model="query"
                type="text"
                class="flex-1 input-field px-3 py-2.5 text-sm"
                placeholder="email user cần audit (bỏ trống = chính bạn)"
              />
              <button
                type="submit" :disabled="querying"
                class="px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2 shrink-0"
              >
                <span v-if="querying" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Kiểm tra
              </button>
            </form>
            <p v-if="queryError" class="text-xs text-red-500 font-medium">{{ queryError }}</p>
          </div>

          <!-- Audit result -->
          <template v-if="result">
            <div class="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm space-y-5">
              <!-- Status banner -->
              <div class="flex items-center gap-3">
                <div
                  class="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
                  :class="result.is_isolated ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'"
                >
                  {{ result.is_isolated ? '✓' : '✗' }}
                </div>
                <div class="min-w-0">
                  <p class="text-app-text-primary font-bold text-sm truncate">{{ result.user }}</p>
                  <p class="text-[12px] font-medium" :class="result.is_isolated ? 'text-emerald-500' : 'text-red-500'">
                    {{ result.is_isolated ? 'Đã cách ly an toàn' : 'CÓ rò rỉ vai trò — cần sửa' }}
                  </p>
                </div>
                <div class="ml-auto flex gap-1.5 items-center">
                  <span v-if="result.is_gam_admin" class="px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-600 text-[10px] font-black uppercase tracking-wider">Admin</span>
                  <span v-if="result.is_gam_member" class="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-wider">Member</span>
                  <!-- Cross-link to the access-grant matrix for this user, so the
                       admin can jump straight from an audit finding to fixing it. -->
                  <router-link
                    :to="{ name: 'AccessGrantView', query: { user: result.user } }"
                    class="px-2 py-1 rounded-md bg-app-bg border border-app-border text-app-text-secondary hover:text-indigo-600 hover:border-indigo-600/40 text-[10px] font-black uppercase tracking-wider transition"
                    title="Mở phân quyền chi tiết của user này"
                  >
                    🔐 Phân quyền
                  </router-link>
                </div>
              </div>

              <!-- Warnings -->
              <div v-if="result.warnings && result.warnings.length" class="space-y-2">
                <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest">Vi phạm</p>
                <div
                  v-for="w in result.warnings" :key="w.role"
                  class="flex items-start gap-2.5 bg-red-500/5 border border-red-500/20 rounded-xl p-3"
                >
                  <span class="text-red-500 text-sm shrink-0">⚠</span>
                  <div>
                    <p class="text-red-500 text-[13px] font-bold">{{ w.role }}</p>
                    <p class="text-app-text-muted text-[11px] mt-0.5">{{ w.reason }}</p>
                  </div>
                </div>
              </div>

              <!-- Roles -->
              <div>
                <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-2">Toàn bộ role ({{ result.roles.length }})</p>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="r in result.roles" :key="r"
                    class="px-2.5 py-1 rounded-md text-[11px] font-bold"
                    :class="roleChipClass(r)"
                  >{{ r }}</span>
                </div>
              </div>

              <!-- Other roles to review -->
              <div v-if="result.other_roles && result.other_roles.length">
                <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-2">Role khác cần review (erpnext / trader-ui?)</p>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="r in result.other_roles" :key="r"
                    class="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 text-[11px] font-bold"
                  >{{ r }}</span>
                </div>
                <p class="text-[10px] text-app-text-muted mt-2">Những role này không thuộc GAM — Member chỉ nên giữ role GAM Member, không nên giữ role của app khác.</p>
              </div>
            </div>
          </template>

          <EmptyState v-else icon="🛡️" title="Chưa có kết quả audit" subtitle="Nhấn “Kiểm tra” để audit chính bạn, hoặc nhập email user khác." />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import { getRoleAudit } from '../api/index.js'
import { useRealtime } from '../composables/useRealtime.js'

const { connected } = useRealtime()

const GAM_ROLES = new Set(['GAM Admin', 'GAM Member'])
const BREAKING = new Set(['System Manager', 'Administrator'])

const loading = ref(false)
const querying = ref(false)
const query = ref('')
const queryError = ref('')
const result = ref(null)

function roleChipClass(role) {
  if (BREAKING.has(role)) return 'bg-red-500/15 text-red-500'
  if (GAM_ROLES.has(role)) return 'bg-indigo-500/10 text-indigo-600'
  return 'bg-app-bg text-app-text-muted'
}

async function runAudit(user = null) {
  querying.value = true
  queryError.value = ''
  try {
    result.value = await getRoleAudit(user)
  } catch (e) {
    queryError.value = e.message || 'Không thể audit user này'
    result.value = null
  } finally {
    querying.value = false
  }
}

async function auditSelf() {
  loading.value = true
  await runAudit(null)
  loading.value = false
}

function auditInput() {
  const q = query.value.trim()
  runAudit(q || null)
}

onMounted(auditSelf)
</script>
