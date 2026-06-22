<template>
  <ModalWrapper :model-value="true" size="md" persistent @update:model-value="$emit('close')">
    <template #header>
      <div class="px-8 pt-8 pb-4 flex items-center justify-between">
        <h3 class="text-lg font-black text-app-text-primary uppercase tracking-tight">🔓 Force Checkout</h3>
        <button @click="$emit('close')" class="text-app-text-muted hover:text-app-text-primary p-1">✕</button>
      </div>
    </template>

    <div class="px-8 pb-2 space-y-4">
      <p class="text-xs text-app-text-muted">
        Thu hồi tài khoản <span class="font-black text-app-text-primary">{{ accountName }}</span> đang được sử dụng.
      </p>

      <!-- Current holder info -->
      <div v-if="usedBy" class="bg-app-bg border border-app-border rounded-xl p-3 space-y-1">
        <div class="flex items-center gap-2 text-xs">
          <span class="text-app-text-muted uppercase font-black tracking-widest text-[10px]">Đang dùng</span>
          <span class="font-black text-app-text-primary">{{ userName(usedBy) }}</span>
        </div>
        <p v-if="purpose" class="text-xs text-app-text-secondary">Mục đích: {{ purpose }}</p>
      </div>

      <!-- Reason — optional -->
      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Lý do (tuỳ chọn)</label>
        <textarea
          v-model="form.reason"
          rows="2"
          maxlength="280"
          placeholder="Lý do thu hồi (ghi vào audit log)…"
          class="w-full input-field px-3 py-2.5 text-sm resize-none"
        ></textarea>
      </div>

      <p class="text-xs text-amber-600 font-medium">⚠️ Hành động này sẽ chấm dứt phiên của user khác ngay lập tức.</p>
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
        @click="submit" :disabled="saving"
        class="px-6 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2"
      >
        <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
        Force Checkout
      </button>
    </template>
  </ModalWrapper>
</template>

<script setup>
/**
 * ForceCheckoutModal — admin "Force Checkout" (Req #5.1).
 *
 * Calls gam.api.admin_force_release (GAM Admin / System Manager only) to
 * reclaim a lease held by another user. Records who held it + the reason in
 * the usage doc's notes (audit trail).
 */
import { ref } from 'vue'
import ModalWrapper from './ModalWrapper.vue'
import { useCheckout } from '../composables/useCheckout.js'
import { useNotify } from '../composables/useNotify.js'
import { userName } from '../utils/format.js'

const props = defineProps({
  accountName: { type: String, required: true },
  usedBy: { type: String, default: '' },
  purpose: { type: String, default: '' },
})
const emit = defineEmits(['close', 'done'])

const { forceRelease } = useCheckout()
const { error: notifyError } = useNotify()

const form = ref({ reason: '' })
const saving = ref(false)
const error = ref('')

async function submit() {
  saving.value = true
  error.value = ''
  try {
    await forceRelease({
      account: props.accountName,
      reason: form.value.reason.trim(),
    })
    emit('done')
  } catch (e) {
    error.value = e.message || 'Force checkout thất bại'
    notifyError(error.value)
  } finally {
    saving.value = false
  }
}
</script>
