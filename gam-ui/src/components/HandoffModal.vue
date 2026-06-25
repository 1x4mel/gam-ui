<template>
  <ModalWrapper :model-value="true" size="md" persistent @update:model-value="$emit('close')">
    <template #header>
      <div class="px-8 pt-8 pb-4 flex items-center justify-between">
        <h3 class="text-lg font-black text-app-text-primary uppercase tracking-tight">🔀 Bàn giao ca</h3>
        <button @click="$emit('close')" class="text-app-text-muted hover:text-app-text-primary p-1">✕</button>
      </div>
    </template>

    <div class="px-8 pb-2 space-y-4">
      <p class="text-xs text-app-text-muted">
        Chuyển tài khoản <span class="font-black text-app-text-primary">{{ accountName }}</span> cho người khác
        tiếp tục dùng — account <span class="font-bold">không logout</span> giữa chừng (cùng chuỗi online).
      </p>

      <!-- Chain-online telemetry -->
      <div v-if="chain" class="bg-app-bg border border-app-border rounded-xl p-3 space-y-1.5">
        <div class="flex items-center justify-between text-xs">
          <span class="text-app-text-muted uppercase font-black tracking-widest text-[10px]">Online liên tục</span>
          <span class="font-mono font-black" :class="chain.over_cap ? 'text-red-500' : 'text-app-text-primary'">
            {{ formatHours(chain.chain_online_seconds) }} / {{ chain.cap_hours }}h
          </span>
        </div>
        <div class="h-1.5 rounded-full bg-app-surface overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            :class="chain.over_cap ? 'bg-red-500' : 'bg-blue-500'"
            :style="{ width: Math.min(100, chain.percent) + '%' }"
          ></div>
        </div>
        <p v-if="chain.over_cap" class="text-[11px] text-red-500 font-bold">
          ⚠️ Đã quá cap online liên tục — chỉ admin ép bàn giao được.
        </p>
        <p v-else-if="chain.percent >= 80" class="text-[11px] text-amber-600 font-medium">
          Sắp tới cap — tài khoản nên nghỉ sớm.
        </p>
      </div>

      <!-- Receiver picker -->
      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">
          Người nhận ca
        </label>
        <select
          v-model="form.toUser"
          class="w-full input-field px-3 py-2.5 text-sm"
          :disabled="loadingCandidates"
        >
          <option value="" disabled>{{ loadingCandidates ? 'Đang tải…' : '— Chọn user —' }}</option>
          <option v-for="c in candidates" :key="c.name" :value="c.name">{{ c.full_name }}</option>
        </select>
        <p v-if="!loadingCandidates && !candidates.length" class="text-[11px] text-app-text-muted mt-1">
          Không có user nào được cấp quyền tài khoản này.
        </p>
      </div>

      <!-- Order ref (inherits current) -->
      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">
          Order ref (mặc định kế thừa ca hiện tại)
        </label>
        <input
          v-model="form.orderRef"
          type="text"
          maxlength="140"
          :placeholder="orderRef || '—'"
          class="w-full input-field px-3 py-2.5 text-sm"
        />
      </div>

      <!-- Notes -->
      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">
          Ghi chú bàn giao (tuỳ chọn)
        </label>
        <textarea
          v-model="form.notes"
          rows="2"
          maxlength="280"
          placeholder="Ghi chú cho người nhận ca…"
          class="w-full input-field px-3 py-2.5 text-sm resize-none"
        ></textarea>
      </div>

      <!-- Admin force past cap -->
      <label v-if="isAdmin && chain && chain.over_cap" class="flex items-center gap-2 text-xs text-app-text-secondary">
        <input type="checkbox" v-model="form.force" class="accent-amber-500" />
        <span>Ép bàn giao dù quá cap online (audit)</span>
      </label>

      <p v-if="error" class="text-xs text-red-500 font-medium">{{ error }}</p>
    </div>

    <template #footer>
      <button
        @click="$emit('close')"
        class="px-5 py-2.5 rounded-xl bg-app-bg border border-app-border text-app-text-secondary hover:text-app-text-primary text-[10px] font-black uppercase tracking-widest transition"
      >
        Huỷ
      </button>
      <button
        @click="submit" :disabled="saving || !form.toUser"
        class="px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2"
      >
        <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
        Bàn giao
      </button>
    </template>
  </ModalWrapper>
</template>

<script setup>
/**
 * HandoffModal — "Bàn giao ca" (shift handoff).
 *
 * Loads the L2-qualified receiver candidates + chain-online telemetry, then
 * calls gam.api.handoff_account. The continuous-online cap warning is shown
 * so the holder knows when an account is near the ban-risk threshold; an admin
 * may force past the cap (audited server-side).
 */
import { ref, onMounted } from 'vue'
import ModalWrapper from './ModalWrapper.vue'
import { useHandoff } from '../composables/useHandoff.js'
import { useNotify } from '../composables/useNotify.js'

const props = defineProps({
  accountName: { type: String, required: true },
  orderRef: { type: String, default: '' },
  isAdmin: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'done'])

const { handoff, getCandidates, getChainOnline } = useHandoff()
const { error: notifyError } = useNotify()

const candidates = ref([])
const chain = ref(null)
const loadingCandidates = ref(true)
const saving = ref(false)
const error = ref('')
const form = ref({ toUser: '', orderRef: '', notes: '', force: false })

onMounted(async () => {
  loadingCandidates.value = true
  try {
    const [c, ch] = await Promise.all([
      getCandidates(props.accountName).catch(() => []),
      getChainOnline(props.accountName).catch(() => null),
    ])
    candidates.value = c || []
    chain.value = ch
  } finally {
    loadingCandidates.value = false
  }
})

function formatHours(seconds) {
  const h = (Number(seconds) || 0) / 3600
  return h.toFixed(1) + 'h'
}

async function submit() {
  saving.value = true
  error.value = ''
  try {
    await handoff({
      account: props.accountName,
      toUser: form.value.toUser,
      orderRef: form.value.orderRef.trim(),
      notes: form.value.notes.trim(),
      force: form.value.force,
    })
    emit('done')
  } catch (e) {
    error.value = e.message || 'Bàn giao ca thất bại'
    notifyError(error.value)
  } finally {
    saving.value = false
  }
}
</script>
