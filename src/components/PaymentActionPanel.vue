<template>
  <div v-if="show" class="bg-app-surface border border-app-border rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-10 mb-4 sm:mb-6 shadow-sm border-l-4 sm:border-l-8 border-l-indigo-600">
    <h3 class="text-indigo-600 text-[10px] uppercase font-black tracking-[0.3em] mb-4 sm:mb-6 flex items-center gap-2">
      <span class="p-1.5 bg-indigo-600/10 rounded-lg">💳</span> Thanh toán nhà cung cấp
    </h3>

    <!-- Debt Info -->
    <div class="bg-app-bg border border-app-border rounded-xl p-4 mb-4 space-y-2">
      <div class="flex justify-between items-center text-[10px]">
        <span class="font-black text-app-text-muted uppercase tracking-widest opacity-60">Hóa đơn mua</span>
        <span class="font-bold text-app-text-primary">{{ order.linked_purchase_invoice || '—' }}</span>
      </div>
      <div class="flex justify-between items-center text-[10px]">
        <span class="font-black text-app-text-muted uppercase tracking-widest opacity-60">Còn nợ</span>
        <span class="font-bold text-indigo-600">{{ formatMoney(order.outstanding_amount_native, getOrderCurrency(order)) }}</span>
      </div>
      <div class="flex justify-between items-center text-[10px]">
        <span class="font-black text-app-text-muted uppercase tracking-widest opacity-60">Trạng thái</span>
        <span :class="debtStatusColor" class="font-black uppercase tracking-widest px-2 py-0.5 rounded bg-current/10">{{ order.debt_status || 'None' }}</span>
      </div>
    </div>

    <!-- Bank Account Selector -->
    <div v-if="order.debt_status !== 'Paid' && bankAccountOpts.length > 0" class="mb-4">
      <p class="text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-2 opacity-60">Tài khoản ngân hàng</p>
      <SearchableSelect
        v-model="selectedBankAccount"
        :options="bankAccountOpts"
        :placeholder="bankAccountLoading ? 'Đang tải...' : '-- Chọn tài khoản --'"
        compact
      />
    </div>

    <!-- Action Buttons -->
    <div v-if="order.debt_status !== 'Paid'" class="flex flex-wrap gap-3">
      <AppButton v-if="order.workflow_state === 'Payment Pending' || order.workflow_state === 'Completed'" variant="primary" size="md"
        :loading="payingNow" :disabled="payingNow || payingDebt" @click="handlePayNow">
        💳 Thanh toán ngay
      </AppButton>
      <AppButton v-if="order.workflow_state === 'Payment Pending' && !order.linked_purchase_invoice" variant="warning" size="md"
        :loading="payingDebt" :disabled="payingNow || payingDebt" @click="handleConvertToDebt">
        📋 Tạo công nợ
      </AppButton>
    </div>

    <!-- Partial Payment -->
    <div v-if="order.linked_purchase_invoice && order.debt_status === 'Outstanding'" class="mt-4 pt-4 border-t border-app-border/30">
      <p class="text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-2 opacity-60">Thanh toán một phần</p>
      <div class="flex gap-2">
        <input v-model.number="partialAmount" type="number" min="1" :max="order.outstanding_amount_native"
          placeholder="Số tiền..." class="flex-1 bg-app-surface border border-app-border rounded-xl px-3 py-2 text-sm text-app-text-primary font-bold outline-none focus:border-indigo-600" />
        <input v-model="paymentRef" type="text" placeholder="Mã tham chiếu..."
          class="flex-1 bg-app-surface border border-app-border rounded-xl px-3 py-2 text-xs text-app-text-primary outline-none focus:border-indigo-600" />
        <AppButton variant="primary" size="md" :loading="payingPartial" :disabled="payingPartial || !partialAmount" @click="handlePartialPayment">
          💰 Trả
        </AppButton>
      </div>
    </div>

    <!-- Payment History -->
    <div v-if="paymentHistory.length > 0" class="mt-4 pt-4 border-t border-app-border/30">
      <p class="text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-2 opacity-60">Lịch sử thanh toán</p>
      <div class="space-y-1">
        <div v-for="pe in paymentHistory" :key="pe.name" class="flex items-center justify-between text-[10px] py-1">
          <span class="text-app-text-muted">{{ pe.name }}</span>
          <span class="text-app-text-muted">{{ pe.posting_date }}</span>
          <span class="font-bold text-indigo-600">{{ formatMoney(pe.paid_amount, getOrderCurrency(props.order)) }}</span>
          <AppButton variant="ghost" size="xs" pill class="!text-[8px] !px-1.5 !py-0.5 text-red-500 hover:text-red-600" @click="voidPayment(pe)">Hủy</AppButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import AppButton from './AppButton.vue'
import SearchableSelect from './SearchableSelect.vue'
import { frappeCall } from '../api/index.js'
import { formatMoney, getOrderCurrency } from '../utils/format.js'
import { useNotify } from '../composables/useNotify.js'
import { usePaymentHistory } from '../composables/usePaymentHistory.js'

const props = defineProps({
  order: { type: Object, required: true },
})
const emit = defineEmits(['refresh'])

const { success, error, confirm } = useNotify()
const payingNow = ref(false)
const payingDebt = ref(false)
const payingPartial = ref(false)
const partialAmount = ref(null)
const paymentRef = ref('')

const bankAccountOpts = ref([])
const selectedBankAccount = ref('')
const bankAccountLoading = ref(false)

async function fetchBankAccountOptions() {
  bankAccountLoading.value = true
  try {
    const opts = await frappeCall('gege_custom.gege_custom.utils.get_order_bank_account_options', {
      doctype: 'Buy Order',
      name: props.order.name,
    })
    bankAccountOpts.value = (opts || []).map(o => ({ label: o.label, value: o.value }))
    // Auto-select: if order already has paid_from_trader_account, use it
    if (props.order.paid_from_trader_account) {
      const match = bankAccountOpts.value.find(o => o.value === props.order.paid_from_trader_account)
      if (match) {
        selectedBankAccount.value = match.value
        return
      }
    }
    // Auto-select first option if only one available
    if (bankAccountOpts.value.length === 1) {
      selectedBankAccount.value = bankAccountOpts.value[0].value
    }
  } catch (e) {
    console.error('Failed to fetch bank account options:', e)
  } finally {
    bankAccountLoading.value = false
  }
}

onMounted(fetchBankAccountOptions)
watch(() => props.order.name, fetchBankAccountOptions)

const show = computed(() => {
  const s = props.order.workflow_state
  const ds = props.order.debt_status
  return s === 'Payment Pending'
    || ds === 'Outstanding'
    || (s === 'Completed' && !['Settled', 'Paid'].includes(ds))
})

const debtStatusColor = computed(() => {
  const s = props.order.debt_status
  if (s === 'Paid') return 'text-green-600'
  if (s === 'Outstanding') return 'text-amber-600'
  return 'text-app-text-muted'
})

const { paymentHistory, loadPaymentHistory } = usePaymentHistory(
  () => props.order.linked_purchase_invoice
)

async function handlePayNow() {
  if (!selectedBankAccount.value) {
    error('Vui lòng chọn tài khoản ngân hàng')
    return
  }
  payingNow.value = true
  try {
    const apiFn = props.order.workflow_state === 'Completed'
      ? 'gege_custom.gege_custom.api.debt.settle_buy_order'
      : 'gege_custom.gege_custom.api.debt.pay_buy_order_now'
    await frappeCall(apiFn, {
      buy_order_name: props.order.name,
      bank_account: selectedBankAccount.value,
    })
    success('Thanh toán thành công')
    loadPaymentHistory()
    emit('refresh')
  } catch (e) {
    error('Lỗi: ' + (e.message || e))
  } finally {
    payingNow.value = false
  }
}

async function handleConvertToDebt() {
  payingDebt.value = true
  try {
    await frappeCall('gege_custom.gege_custom.api.debt.convert_buy_order_to_debt', {
      buy_order_name: props.order.name,
    })
    success('Đã tạo công nợ')
    loadPaymentHistory()
    emit('refresh')
  } catch (e) {
    error('Lỗi: ' + (e.message || e))
  } finally {
    payingDebt.value = false
  }
}

async function handlePartialPayment() {
  if (!partialAmount.value || partialAmount.value <= 0) return
  if (!selectedBankAccount.value) {
    error('Vui lòng chọn tài khoản ngân hàng')
    return
  }
  payingPartial.value = true
  try {
    await frappeCall('gege_custom.gege_custom.api.debt.record_supplier_payment', {
      buy_order_name: props.order.name,
      amount: partialAmount.value,
      reference_no: paymentRef.value || undefined,
      bank_account: selectedBankAccount.value,
    })
    loadPaymentHistory()
    emit('refresh')
  } catch (e) {
    error('Lỗi: ' + (e.message || e))
  } finally {
    payingPartial.value = false
  }
}

async function voidPayment(pe) {
  if (!(await confirm(`Hủy thanh toán ${pe.name} (${formatMoney(pe.paid_amount, getOrderCurrency(props.order))})?`))) return
  try {
    await frappeCall('gege_custom.gege_custom.api.debt.cancel_payment_entry', {
      payment_entry: pe.name,
    })
    success(`Đã hủy thanh toán ${pe.name}`)
    loadPaymentHistory()
    emit('refresh')
  } catch (e) {
    error('Lỗi hủy thanh toán: ' + (e.message || e))
  }
}
</script>
