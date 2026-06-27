<template>
  <DetailPageLayout :loading="loading" loading-text="Đang tải...">
    <template #toolbar>
      <div class="flex items-center gap-3">
        <BackButton @click="router.push('/codes')" />
        <h2 class="text-base sm:text-lg font-black text-app-text-primary uppercase tracking-tight">Chi tiết Mã</h2>
      </div>
    </template>

    <div v-if="code" class="max-w-2xl space-y-6 pb-8">
      <!-- Code hero -->
      <div class="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm">
        <div class="flex items-center gap-2 mb-4 flex-wrap">
          <PlatformBadge v-if="code.platform" :platform="code.platform" size="lg" />
          <StatusBadge :status="code.status" size="lg" />
        </div>
        <div class="flex items-center gap-3">
          <code class="flex-1 text-3xl font-black font-mono tracking-[0.25em] text-app-text-primary bg-app-bg border border-app-border rounded-2xl px-4 py-4 select-all text-center">
            {{ code.code }}
          </code>
          <CopyButton :text="code.code" />
        </div>
        <p v-if="code.expires_at" class="text-center text-xs mt-3 font-bold" :class="expiryClass(code.expires_at)">
          {{ expiryLabel(code.expires_at) }}
        </p>
      </div>

      <!-- Details -->
      <div class="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm space-y-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InfoRow label="Email" :value="code.email_address || code.email || '—'" />
          <InfoRow label="Người gửi" :value="code.email_from || '—'" />
          <InfoRow label="Tiêu đề" :value="code.email_subject || '—'" value-class="text-app-text-primary text-sm font-medium italic" />
          <InfoRow label="Nhận lúc" :value="formatDate(code.received_at) || '—'" />
          <InfoRow label="Fetch lúc" :value="formatDate(code.fetched_at) || '—'" />
          <InfoRow label="Hết hạn" :value="formatDate(code.expires_at) || '—'" />
          <InfoRow label="Người lấy" :value="code.claimed_by || '—'" />
          <InfoRow label="Lấy lúc" :value="formatDate(code.claimed_at) || '—'" />
        </div>
      </div>

      <!-- Raw snippet -->
      <div v-if="code.raw_snippet" class="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm">
        <p class="text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-2 opacity-30">Trích email</p>
        <pre class="text-xs text-app-text-secondary whitespace-pre-wrap break-words font-mono bg-app-bg rounded-xl p-4 max-h-64 overflow-auto custom-scrollbar">{{ code.raw_snippet }}</pre>
      </div>
    </div>

    <EmptyState v-else-if="!loading" icon="📭" text="Không tìm thấy mã" subtext="Mã này không tồn tại hoặc bạn không có quyền xem." />
  </DetailPageLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DetailPageLayout from '../components/DetailPageLayout.vue'
import BackButton from '../components/BackButton.vue'
import PlatformBadge from '../components/PlatformBadge.vue'
import StatusBadge from '../components/StatusBadge.vue'
import CopyButton from '../components/CopyButton.vue'
import InfoRow from '../components/InfoRow.vue'
import EmptyState from '../components/EmptyState.vue'
import { getDoc } from '../api/index.js'
import { formatDate, humanizeCountdown } from '../utils/format.js'

defineOptions({ name: 'EmailDetailView' })

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const code = ref(null)

async function load() {
  loading.value = true
  try {
    code.value = await getDoc('GAM Email Code', route.params.name)
  } catch {
    code.value = null
  } finally {
    loading.value = false
  }
}

function expiryLabel(expiresAt) {
  const c = humanizeCountdown(expiresAt)
  return c.severity === 'expired' ? '⏰ Mã đã hết hạn' : `⏳ ${c.label[0].toUpperCase()}${c.label.slice(1)}`
}

function expiryClass(expiresAt) {
  const s = humanizeCountdown(expiresAt).severity
  return s === 'expired' ? 'text-red-500' : s === 'soon' ? 'text-amber-500' : 'text-emerald-500'
}

onMounted(load)
</script>
