<template>
  <div v-if="show" class="bg-app-surface border border-app-border rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-10 mb-4 sm:mb-6 shadow-sm border-l-4 sm:border-l-8 border-l-orange-600">
    <h3 class="text-orange-600 text-[10px] uppercase font-black tracking-[0.3em] mb-4 sm:mb-6 flex items-center gap-2">
      <span class="p-1.5 bg-orange-600/10 rounded-lg">💰</span> Thu tiền khách hàng
    </h3>

    <!-- Payment Proof Preview -->
    <div v-if="order.payment_proof" class="mb-4">
      <p class="text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-2 opacity-60">Bằng chứng thanh toán</p>
      <div class="bg-app-bg border border-app-border rounded-xl overflow-hidden cursor-pointer hover:border-orange-400 transition-colors" @click="showProof = !showProof">
        <img :src="order.payment_proof" class="w-full max-h-48 object-contain" />
      </div>
    </div>

    <!-- Debt Info -->
    <div class="bg-app-bg border border-app-border rounded-xl p-4 mb-4 space-y-2">
      <div class="flex justify-between items-center text-[10px]">
        <span class="font-black text-app-text-muted uppercase tracking-widest opacity-60">Hóa đơn bán</span>
        <span class="font-bold text-app-text-primary">{{ order.linked_sales_invoice || '—' }}</span>
      </div>
      <div class="flex justify-between items-center text-[10px]">
        <span class="font-black text-app-text-muted uppercase tracking-widest opacity-60">Còn nợ</span>
        <span class="font-bold text-orange-600">{{ formatMoney(order.outstanding_amount_native, getOrderCurrency(order)) }}</span>
      </div>
      <div class="flex justify-between items-center text-[10px]">
        <span class="font-black text-app-text-muted uppercase tracking-widest opacity-60">Trạng thái công nợ</span>
        <span :class="debtStatusColor" class="font-black uppercase tracking-widest px-2 py-0.5 rounded bg-current/10">{{ order.debt_status || 'None' }}</span>
      </div>
    </div>

    <!-- Record Payment -->
    <div v-if="order.debt_status === 'Outstanding' || (order.workflow_state === 'Completed' && !['Settled','Paid'].includes(order.debt_status))" class="space-y-3">
      <p class="text-[9px] font-black text-app-text-muted uppercase tracking-widest opacity-60">Ghi nhận thanh toán</p>
      <!-- Bank Account Selector -->
      <div>
        <label class="block text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-1 opacity-60">Tài khoản nhận tiền</label>
        <div v-if="bankAccountLoading" class="text-[10px] text-app-text-muted py-2">Đang tải...</div>
        <SearchableSelect
          v-else
          v-model="selectedBankAccount"
          :options="bankAccountOpts"
          placeholder="-- Chọn tài khoản --"
          compact
        />
      </div>
      <div class="flex gap-2">
        <input v-model.number="paymentAmount" type="number" min="1" :max="order.outstanding_amount_native"
          placeholder="Số tiền..." class="flex-1 bg-app-surface border border-app-border rounded-xl px-3 py-2 text-sm text-app-text-primary font-bold outline-none focus:border-orange-600" />
        <input v-model="paymentRef" type="text" placeholder="Mã tham chiếu..."
          class="flex-1 bg-app-surface border border-app-border rounded-xl px-3 py-2 text-xs text-app-text-primary outline-none focus:border-orange-600" />
        <AppButton variant="orange" size="md" :loading="submitting" :disabled="submitting || !paymentAmount || !selectedBankAccount" @click="handleRecordPayment">
          💰 Thu
        </AppButton>
      </div>
      <button v-if="order.outstanding_amount_native" class="text-[10px] text-orange-600 font-bold hover:underline" @click="paymentAmount = order.outstanding_amount_native">
        Trả tất cả: {{ formatMoney(order.outstanding_amount_native, getOrderCurrency(order)) }}
      </button>
    </div>

    <!-- Payment History -->
    <div v-if="paymentHistory.length > 0" class="mt-4 pt-4 border-t border-app-border/30">
      <p class="text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-2 opacity-60">Lịch sử thanh toán</p>
      <div class="space-y-1">
        <div v-for="pe in paymentHistory" :key="pe.name" class="flex items-center justify-between text-[10px] py-1">
          <span class="text-app-text-muted">{{ pe.name }}</span>
          <span class="text-app-text-muted">{{ pe.posting_date }}</span>
          <span class="font-bold text-orange-600">{{ formatMoney(pe.paid_amount, getOrderCurrency(props.order)) }}</span>
          <AppButton variant="ghost" size="xs" pill class="!text-[8px] !px-1.5 !py-0.5 text-red-500 hover:text-red-600" @click="voidPayment(pe)">Hủy</AppButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
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
const submitting = ref(false)
const paymentAmount = ref(null)
const paymentRef = ref('')
const showProof = ref(false)
const bankAccountOpts = ref([])
const selectedBankAccount = ref('')
const bankAccountLoading = ref(false)

const show = computed(() => {
  const s = props.order.workflow_state
  const ds = props.order.debt_status
  return ds === 'Outstanding'
    || props.order.payment_proof
    || (s === 'Completed' && !['Settled', 'Paid'].includes(ds))
})

const debtStatusColor = computed(() => {
  const s = props.order.debt_status
  if (s === 'Paid') return 'text-green-600'
  if (s === 'Outstanding') return 'text-amber-600'
  return 'text-app-text-muted'
})

const { paymentHistory, loadPaymentHistory } = usePaymentHistory(
  () => props.order.linked_sales_invoice
)

async function loadBankAccountOptions() {
  bankAccountLoading.value = true
  selectedBankAccount.value = ''
  bankAccountOpts.value = []
  try {
    const res = await frappeCall('gege_custom.gege_custom.utils.get_order_bank_account_options', {
      doctype: 'Sell Order',
      name: props.order.name,
    })
    bankAccountOpts.value = res || []
    // Auto-select if only one option
    if (bankAccountOpts.value.length === 1) {
      selectedBankAccount.value = bankAccountOpts.value[0].value
    }
    // Auto-select if order already has trader_1_receiving_account and it matches
    if (props.order.trader_1_receiving_account) {
      const match = bankAccountOpts.value.find(o => o.value === props.order.trader_1_receiving_account)
      if (match) {
        selectedBankAccount.value = match.value
      }
    }
  } catch (e) {
    console.error('Failed to load bank account options', e)
  } finally {
    bankAccountLoading.value = false
  }
}

watch(() => props.order.name, () => {
  loadBankAccountOptions()
}, { immediate: true })

async function handleRecordPayment() {
  if (!paymentAmount.value || paymentAmount.value <= 0) return
  if (!selectedBankAccount.value) {
    error('Vui lòng chọn tài khoản ngân hàng')
    return
  }
  submitting.value = true
  try {
    await frappeCall('gege_custom.gege_custom.api.debt.record_customer_payment', {
      sell_order_name: props.order.name,
      amount: paymentAmount.value,
      reference_no: paymentRef.value || undefined,
      bank_account: selectedBankAccount.value,
    })
    success('Ghi nhận thanh toán thành công')
    paymentAmount.value = null
    paymentRef.value = ''
    loadPaymentHistory()
    emit('refresh')
  } catch (e) {
    error('Lỗi: ' + (e.message || e))
  } finally {
    submitting.value = false
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
