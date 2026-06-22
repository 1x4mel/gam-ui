<template>
  <ModalWrapper v-model="show" size="md" persistent :aria-label="title">
    <template #header>
      <div class="px-6 pt-6 pb-3">
        <div class="flex items-center gap-3">
          <span class="text-2xl">{{ icon }}</span>
          <div>
            <h3 class="text-app-text-primary font-bold text-base">{{ title }}</h3>
            <p v-if="subtitle" class="text-app-text-muted text-xs mt-0.5">{{ subtitle }}</p>
          </div>
        </div>
      </div>
    </template>

    <div class="px-6 py-4 space-y-4">
      <!-- Order info -->
      <div v-if="order" class="bg-app-bg border border-app-border rounded-xl p-3 space-y-2">
        <div class="flex justify-between text-xs">
          <span class="text-app-text-muted font-bold uppercase tracking-widest opacity-50">Đơn hàng</span>
          <span class="text-app-text-primary font-bold">{{ order.name }}</span>
        </div>
        <div v-if="amount" class="flex justify-between text-xs">
          <span class="text-app-text-muted font-bold uppercase tracking-widest opacity-50">{{ amountLabel }}</span>
          <span class="text-indigo-600 font-black">{{ amount }}</span>
        </div>
        <div v-if="orderStatus" class="flex justify-between text-xs">
          <span class="text-app-text-muted font-bold uppercase tracking-widest opacity-50">Trạng thái</span>
          <span class="text-app-text-secondary font-bold">{{ orderStatus }}</span>
        </div>
        <slot name="details" />
      </div>

      <!-- Bank account selector -->
      <div v-if="bankOptions.length > 0">
        <p class="text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-2 opacity-60">{{ bankLabel }}</p>
        <SearchableSelect
          v-model="selectedBank"
          :options="bankOptions"
          placeholder="-- Chọn tài khoản --"
        />
      </div>

      <!-- Extra content -->
      <slot />

      <!-- Warning -->
      <p v-if="warning" class="text-amber-600 text-[10px] font-bold flex items-center gap-1.5">
        <span>⚠️</span> {{ warning }}
      </p>
    </div>

    <template #footer>
      <div class="px-6 pb-6 pt-2 flex gap-3 justify-end">
        <AppButton variant="ghost" @click="cancel">Hủy</AppButton>
        <AppButton
          :variant="confirmVariant"
          :loading="loading"
          :disabled="bankOptions.length > 0 && !selectedBank && !bankAccount"
          @click="confirm"
        >
          {{ confirmText }}
        </AppButton>
      </div>
    </template>
  </ModalWrapper>
</template>

<script setup>
import { ref, watch } from 'vue'
import ModalWrapper from './ModalWrapper.vue'
import AppButton from './AppButton.vue'
import SearchableSelect from './SearchableSelect.vue'

const props = defineProps({
  icon: { type: String, default: '💳' },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  order: { type: Object, default: null },
  amount: { type: String, default: '' },
  amountLabel: { type: String, default: 'Số tiền' },
  orderStatus: { type: String, default: '' },
  bankLabel: { type: String, default: 'Tài khoản' },
  bankOptions: { type: Array, default: () => [] },
  bankAccount: { type: String, default: '' },
  warning: { type: String, default: '' },
  confirmText: { type: String, default: 'Xác nhận' },
  confirmVariant: { type: String, default: 'primary' },
  loading: { type: Boolean, default: false },
  autoSelectUser: { type: String, default: '' },
})

const emit = defineEmits(['confirm', 'cancel'])

const show = defineModel({ type: Boolean, default: false })
const selectedBank = ref('')

watch(() => [props.bankOptions, props.bankAccount], () => {
  if (props.bankAccount) {
    selectedBank.value = props.bankAccount
  } else if (props.bankOptions.length === 1) {
    selectedBank.value = props.bankOptions[0].value
  } else if (props.autoSelectUser) {
    const match = props.bankOptions.find(o => o.user === props.autoSelectUser)
    selectedBank.value = match ? match.value : ''
  } else {
    selectedBank.value = ''
  }
}, { immediate: true })

function confirm() {
  emit('confirm', { bankAccount: selectedBank.value || undefined })
}

function cancel() {
  show.value = false
  emit('cancel')
}
</script>
