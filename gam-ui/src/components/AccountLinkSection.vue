<template>
  <div class="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-app-text-primary font-black text-sm uppercase tracking-tight">🔗 Liên kết</h3>
      <button
        v-if="canEdit" @click="$emit('add-link')"
        class="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 text-[10px] font-black uppercase tracking-wider hover:bg-indigo-500/20 transition"
      >
        + Thêm
      </button>
    </div>

    <LoadingSpinner v-if="loading" size="sm" />
    <p v-else-if="!links.length" class="text-xs text-app-text-muted italic">Chưa có liên kết với tài khoản khác.</p>
    <div v-else class="space-y-2">
      <router-link
        v-for="link in links" :key="link.name"
        :to="`/accounts/${link.otherName}`"
        class="flex items-center gap-3 bg-app-bg border border-app-border rounded-xl px-3 py-2.5 hover:border-indigo-600/40 transition group"
      >
        <span class="text-lg">→</span>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-app-text-primary text-sm truncate">{{ link.otherName }}</p>
          <p class="text-[10px] text-app-text-muted truncate">{{ link.link_type || 'Linked' }}</p>
        </div>
        <div class="text-right shrink-0">
          <StatusBadge :status="link.status" />
          <p v-if="link.expiry_date" class="text-[10px] mt-1 font-bold" :class="expiryClass(link.expiry_date)">
            {{ expiryLabel(link.expiry_date) }}
          </p>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import LoadingSpinner from './LoadingSpinner.vue'
import StatusBadge from './StatusBadge.vue'
import { getList } from '../api/index.js'

const props = defineProps({
  accountName: { type: String, required: true },
  canEdit: { type: Boolean, default: false },
})
defineEmits(['add-link'])

const loading = ref(false)
const rawLinks = ref([])

const links = computed(() =>
  rawLinks.value.map(l => {
    const otherName = l.source_account === props.accountName ? l.target_account : l.source_account
    return { name: l.name, otherName, link_type: l.link_type, status: l.status, expiry_date: l.expiry_date }
  })
)

async function load() {
  if (!props.accountName) return
  loading.value = true
  try {
    rawLinks.value = await getList('GAM Account Link', {
      fields: ['name', 'source_account', 'target_account', 'link_type', 'status', 'expiry_date'],
      filters: [['status', '=', 'ACTIVE']],
      or_filters: [
        ['source_account', '=', props.accountName],
        ['target_account', '=', props.accountName],
      ],
      limit: 100,
      order_by: 'expiry_date asc',
    })
  } catch {
    rawLinks.value = []
  } finally {
    loading.value = false
  }
}

function expiryLabel(d) {
  let dt = d
  if (typeof dt === 'string' && !dt.includes('Z') && !dt.includes('+')) dt = dt + '+07:00'
  const diff = new Date(dt).getTime() - Date.now()
  const days = Math.floor(diff / 86400000)
  if (diff <= 0) return 'đã hết hạn'
  if (days <= 0) return `hết hạn hôm nay`
  return `còn ${days} ngày`
}
function expiryClass(d) {
  let dt = d
  if (typeof dt === 'string' && !dt.includes('Z') && !dt.includes('+')) dt = dt + '+07:00'
  const days = (new Date(dt).getTime() - Date.now()) / 86400000
  if (days <= 1) return 'text-red-500'
  if (days <= 7) return 'text-amber-500'
  return 'text-app-text-muted'
}

defineExpose({ refresh: load })
onMounted(load)
watch(() => props.accountName, load)
</script>
