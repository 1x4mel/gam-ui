<template>
  <ModalWrapper :model-value="true" size="md" persistent @update:model-value="$emit('close')">
    <template #header>
      <div class="px-8 pt-8 pb-4 flex items-center justify-between">
        <h3 class="text-lg font-black text-app-text-primary uppercase tracking-tight">✅ Checkin</h3>
        <button @click="$emit('close')" class="text-app-text-muted hover:text-app-text-primary p-1">✕</button>
      </div>
    </template>

    <div class="px-8 pb-2 space-y-4">
      <p class="text-xs text-app-text-muted">Bắt đầu sử dụng tài khoản <span class="font-black text-app-text-primary">{{ accountName }}</span>. Nhấn <b>Checkout</b> khi hoàn thành (thời gian tự tính).</p>

      <!-- Purpose — HTML5 datalist: free text + preset suggestions -->
      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Mục đích</label>
        <input
          v-model="form.purpose"
          list="checkin-purpose-list"
          type="text"
          maxlength="140"
          placeholder="Chọn hoặc nhập mục đích…"
          class="w-full input-field px-3 py-2.5 text-sm"
        />
        <datalist id="checkin-purpose-list">
          <option v-for="p in PURPOSE_PRESETS" :key="p" :value="p"></option>
        </datalist>
      </div>

      <!-- Notes — optional -->
      <div>
        <label class="block text-[10px] text-app-text-muted uppercase font-black tracking-widest mb-1.5">Ghi chú (tuỳ chọn)</label>
        <textarea
          v-model="form.notes"
          rows="2"
          maxlength="500"
          placeholder="Order ref, lưu ý cho team…"
          class="w-full input-field px-3 py-2.5 text-sm resize-none"
        ></textarea>
      </div>

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
        class="px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50 flex items-center gap-2"
      >
        <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
        Bắt đầu
      </button>
    </template>
  </ModalWrapper>
</template>

<script setup>
/**
 * CheckoutModal — the START ("Checkin") modal (Req #4 terminology flip).
 *
 * Despite the filename, this opens the active lease (backend checkout_account).
 * Fields kept minimal per spec: Purpose (free-text + datalist presets) + Notes.
 * No lease time / order ref — the server applies the GAM Settings hard cap so
 * forgotten sessions still auto-release.
 *
 * Filename kept as-is to avoid breaking the existing import in AccountDetailView;
 * the UI title clearly reads "Checkin".
 */
import { ref } from 'vue'
import ModalWrapper from './ModalWrapper.vue'
import { useCheckout } from '../composables/useCheckout.js'
import { useNotify } from '../composables/useNotify.js'

const props = defineProps({ accountName: { type: String, required: true } })
const emit = defineEmits(['close', 'done'])

// Preset suggestions for the datalist (free text still allowed).
const PURPOSE_PRESETS = ['LOGIN', 'LEVELING', 'BUILD', 'FARMING', 'TESTING', 'DELIVERY', 'SUPPORT', 'OTHER']

const { checkout } = useCheckout()
const { error: notifyError } = useNotify()

const form = ref({ purpose: '', notes: '' })
const saving = ref(false)
const error = ref('')

async function submit() {
  const purpose = (form.value.purpose || '').trim()
  if (!purpose) {
    error.value = 'Vui lòng nhập mục đích sử dụng.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    await checkout({
      account: props.accountName,
      purpose,
      notes: form.value.notes.trim(),
    })
    emit('done')
  } catch (e) {
    error.value = e.message || 'Checkin thất bại'
    notifyError(error.value)
  } finally {
    saving.value = false
  }
}
</script>
