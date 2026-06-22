<template>
  <ModalWrapper v-model="visible" size="lg" :z-index="70">
    <template #header>
      <div class="px-8 pt-8 pb-4">
        <h3 class="text-app-text-primary font-black text-xl flex items-center gap-2">
          <span :class="side === 'payable' ? 'text-red-600' : 'text-emerald-600'">💰</span>
          {{ side === 'payable' ? 'Thanh toán cho đối tác' : 'Thu tiền khách hàng' }}
        </h3>
        <p v-if="partyName" class="text-xs text-app-text-muted mt-1">{{ partyName }} &middot; {{ party?.order_count || 0 }} đơn hàng</p>
      </div>
    </template>

    <div v-if="party" class="px-8 py-4 space-y-5">
      <!-- Party Summary -->
      <div class="bg-app-bg rounded-xl p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-[9px] text-app-text-muted font-black uppercase tracking-widest">Tổng công nợ</p>
            <div v-for="(val, cur) in party.by_currency" :key="'sum-'+cur" class="flex items-baseline gap-2">
              <span class="text-lg font-black font-mono" :class="side === 'payable' ? 'text-red-600' : 'text-emerald-600'">
                {{ formatMoney(val, cur) }}
              </span>
            </div>
          </div>
          <div v-if="party.advance_balance > 0" class="text-right">
            <p class="text-[9px] text-app-text-muted font-black uppercase tracking-widest">Tạm ứng chưa phân bổ</p>
            <p class="text-sm font-black font-mono text-indigo-600">{{ formatMoney(party.advance_balance, currency) }}</p>
          </div>
        </div>
      </div>

      <!-- Payment Mode Toggle -->
      <div class="flex gap-2">
        <AppButton
          :variant="payMode === 'order' ? 'primary' : 'ghost'"
          size="sm"
          pill
          class="flex-1"
          @click="payMode = 'order'"
        >Thanh toán theo đơn</AppButton>
        <AppButton
          :variant="payMode === 'advance' ? 'primary' : 'ghost'"
          size="sm"
          pill
          class="flex-1"
          @click="payMode = 'advance'"
        >Thu không gắn đơn (Tạm ứng)</AppButton>
      </div>

      <!-- Mode: Order Selection -->
      <template v-if="payMode === 'order'">
        <!-- Advance Suggestion -->
        <div v-if="party.advance_balance > 0" class="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3 flex items-center gap-3">
          <span class="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 shrink-0">Tạm ứng</span>
          <div class="flex-1 min-w-0">
            <p class="text-[10px] text-indigo-700 font-bold">
              Đang có {{ formatMoney(party.advance_balance, currency) }} tạm ứng chưa phân bổ
            </p>
            <p class="text-[9px] text-indigo-600/70 mt-0.5">
              {{ useAdvanceFirst ? '✓ Sẽ tự động trừ tạm ứng trước' : 'Bật để tự động trừ tạm ứng vào đơn cũ nhất' }}
            </p>
          </div>
          <AppButton :variant="useAdvanceFirst ? 'primary' : 'ghost'" size="xs" pill @click="useAdvanceFirst = !useAdvanceFirst">
            {{ useAdvanceFirst ? 'Bật' : 'Dùng TU' }}
          </AppButton>
        </div>
        <div>
          <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-2">Chọn đơn hàng cần thanh toán</label>
          <div class="max-h-44 overflow-y-auto custom-scrollbar space-y-1 bg-app-bg rounded-xl p-2">
            <label v-for="order in sortedOrders" :key="order.name"
              class="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-app-surface/50 transition"
              :class="selectedOrders.includes(order.name) ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30' : ''">
              <input type="checkbox" :value="order.name" v-model="selectedOrders"
                class="w-4 h-4 rounded border-app-border text-indigo-600 focus:ring-indigo-500" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-black text-app-text-primary">{{ order.name }}</span>
                  <span v-if="order.is_orphan" class="text-[8px] font-black px-1 py-0.5 rounded-full bg-gray-200 text-gray-600">Hóa đơn</span>
                </div>
                <p class="text-[10px] text-app-text-muted">
                  Tổng {{ formatMoney(order.invoice_total, order.invoice_currency || currency) }} &middot;
                  Đã trả {{ formatMoney(paidAmount(order), order.invoice_currency || currency) }} &middot;
                  <span :class="remaining(order) > 0 ? 'text-red-600' : 'text-emerald-600'">
                    Còn {{ formatMoney(remaining(order), order.invoice_currency || currency) }}
                  </span>
                </p>
              </div>
              <div class="w-16">
                <div class="h-1.5 bg-app-border rounded-full overflow-hidden">
                  <div class="h-full bg-emerald-500 rounded-full transition-all"
                    :style="{ width: progressPct(order) + '%' }"></div>
                </div>
                <p class="text-[8px] text-app-text-muted text-center mt-0.5">{{ progressPct(order) }}%</p>
              </div>
            </label>
          </div>
        </div>

        <!-- Amount Input -->
        <div>
          <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5">Số tiền thanh toán</label>
          <div v-if="overpayAmount > 0" class="mb-2 text-[10px] px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-700 font-bold">
            Chênh {{ formatMoney(overpayAmount, currency) }} sẽ ghi nhận là tạm ứng
          </div>
          <input
            v-model.number="amount"
            type="number"
            min="0"
            step="any"
            class="input-field font-bold font-mono"
            placeholder="Nhập số tiền..."
          />
          <div class="flex gap-2 mt-2">
            <AppButton variant="ghost" size="xs" pill @click="amount = selectedTotal">
              Trả hết ({{ formatMoney(selectedTotal, currency) }})
            </AppButton>
            <AppButton variant="ghost" size="xs" pill @click="amount = Math.round(selectedTotal / 2)">
              50%
            </AppButton>
          </div>
        </div>

        <!-- Allocation Preview -->
        <div v-if="amount > 0 && selectedOrders.length > 0" class="bg-app-bg rounded-xl p-4 space-y-2">
          <p class="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Phân bổ tự động (cũ nhất trước)</p>
          <!-- Advance breakdown -->
          <div v-if="useAdvanceFirst && advanceUsedInPreview > 0" class="flex justify-between text-[11px] pb-1 border-b border-app-border/50">
            <span class="text-indigo-600 font-bold">Trong đó từ tạm ứng</span>
            <span class="font-mono font-bold text-indigo-600">{{ formatMoney(advanceUsedInPreview, currency) }}</span>
          </div>
          <div v-for="a in fifoPreview" :key="a.invoice" class="flex justify-between text-[11px]">
            <div>
              <span class="text-app-text-primary font-bold">{{ a.order }}</span>
              <span v-if="a.fromAdvance > 0" class="text-[8px] text-indigo-500 ml-1">← TU: {{ formatMoney(a.fromAdvance, currency) }}</span>
            </div>
            <div class="text-right">
              <span class="font-mono text-emerald-600 font-bold">{{ formatMoney(a.alloc, currency) }}</span>
              <span v-if="a.remaining > 0" class="text-app-text-muted ml-2">còn {{ formatMoney(a.remaining, currency) }}</span>
              <span v-else class="text-emerald-600 ml-2 text-[9px]">✓ trả đủ</span>
            </div>
          </div>
          <div v-if="overpayAmount > 0" class="flex justify-between text-[11px] pt-1 border-t border-app-border/50">
            <span class="text-indigo-600 font-bold">Ghi nhận tạm ứng</span>
            <span class="font-mono font-bold text-indigo-600">{{ formatMoney(overpayAmount, currency) }}</span>
          </div>
        </div>
      </template>

      <!-- Mode: Advance (no order) -->
      <template v-else>
        <div>
          <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5">Số tiền thu</label>
          <input
            v-model.number="amount"
            type="number"
            min="0"
            step="any"
            class="input-field font-bold font-mono"
            placeholder="Nhập số tiền..."
          />
          <p class="text-[10px] text-indigo-600 mt-2">Tiền sẽ được ghi nhận là tạm ứng, chưa phân bổ vào đơn hàng nào.</p>
        </div>
      </template>

      <!-- Bank Account -->
      <div>
        <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5">Tài khoản ngân hàng <span class="text-red-500">*</span></label>
        <SearchableSelect
          v-model="selectedBankAccount"
          :options="filteredBankAccountOpts"
          :placeholder="bankAccountLoading ? 'Đang tải...' : 'Chọn tài khoản ngân hàng'"
        />
        <p v-if="bankAccountValidationError" class="text-[10px] text-red-500 mt-1 font-bold">{{ bankAccountValidationError }}</p>
      </div>

      <!-- Reference -->
      <div>
        <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1.5">Mã tham chiếu (tuỳ chọn)</label>
        <input
          v-model="referenceNo"
          type="text"
          class="input-field"
          placeholder="VD: STK chuyển khoản..."
        />
      </div>
    </div>

    <template #footer>
      <AppButton variant="neutral" size="md" @click="visible = false">Huỷ</AppButton>
      <AppButton variant="success" size="md" :loading="saving" :disabled="!canSubmit" @click="submitPayment">
        {{ payMode === 'advance' ? 'Ghi nhận tạm ứng' : 'Xác nhận thanh toán' }}
      </AppButton>
    </template>
  </ModalWrapper>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import ModalWrapper from './ModalWrapper.vue'
import AppButton from './AppButton.vue'
import SearchableSelect from './SearchableSelect.vue'
import { frappeCall } from '../api/index.js'
import { formatMoney } from '../utils/format.js'
import { useNotify } from '../composables/useNotify.js'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  party: { type: Object, default: null },
  side: { type: String, default: 'payable' },
  currency: { type: String, default: 'VND' },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const { success, error } = useNotify()

const amount = ref(0)
const referenceNo = ref('')
const saving = ref(false)
const payMode = ref('order')
const selectedOrders = ref([])
const useAdvanceFirst = ref(true)

const bankAccountOpts = ref([])
const selectedBankAccount = ref('')
const bankAccountLoading = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const partyName = computed(() => {
  if (!props.party) return ''
  return props.party.supplier_name || props.party.customer_name || ''
})

const sortedOrders = computed(() => {
  if (!props.party?.orders) return []
  return [...props.party.orders].sort((a, b) => {
    const aAging = a.aging_days || 0
    const bAging = b.aging_days || 0
    return bAging - aAging || (a.creation || '').localeCompare(b.creation || '')
  })
})

function paidAmount(order) {
  return flt(order.invoice_total) - flt(order.invoice_outstanding)
}

function remaining(order) {
  return flt(order.invoice_outstanding)
}

function progressPct(order) {
  const total = flt(order.invoice_total)
  if (!total) return 0
  return Math.round((paidAmount(order) / total) * 100)
}

function flt(n) {
  return Number(n) || 0
}

const selectedTotal = computed(() =>
  sortedOrders.value
    .filter(o => selectedOrders.value.includes(o.name))
    .reduce((sum, o) => sum + remaining(o), 0)
)

const overpayAmount = computed(() => {
  const total = amount.value || 0
  const sel = selectedTotal.value
  return total > sel ? total - sel : 0
})

// How much of existing advance will be consumed in FIFO
const advanceUsedInPreview = computed(() => {
  if (!useAdvanceFirst.value || !props.party?.advance_balance) return 0
  return fifoPreview.value.reduce((sum, a) => sum + a.fromAdvance, 0)
})

const fifoPreview = computed(() => {
  if (!amount.value || !selectedOrders.value.length) return []
  const selected = sortedOrders.value.filter(o => selectedOrders.value.includes(o.name))
  const sorted = [...selected].sort((a, b) => {
    const aD = a.aging_days || 0
    const bD = b.aging_days || 0
    return bD - aD // oldest first
  })
  let rem = amount.value
  let advanceRem = (useAdvanceFirst.value && props.party?.advance_balance) ? props.party.advance_balance : 0
  return sorted.map(o => {
    const oRem = remaining(o)
    const alloc = Math.min(rem, oRem)
    rem -= alloc
    // Track how much of this allocation comes from advance
    const fromAdvance = Math.min(advanceRem, alloc)
    advanceRem -= fromAdvance
    return {
      order: o.name,
      invoice: o.is_orphan ? o.name : (o.linked_sales_invoice || o.linked_purchase_invoice || o.name),
      alloc,
      fromAdvance,
      remaining: oRem - alloc,
    }
  }).filter(a => a.alloc > 0)
})

const canSubmit = computed(() => {
  if (amount.value <= 0 || saving.value) return false
  if (!selectedBankAccount.value) return false
  if (payMode.value === 'order' && selectedOrders.value.length === 0) return false
  return true
})

const bankAccountValidationError = computed(() => {
  if (amount.value > 0 && !selectedBankAccount.value && bankAccountOpts.value.length > 0) {
    return 'Vui lòng chọn tài khoản ngân hàng'
  }
  return ''
})

const filteredBankAccountOpts = computed(() => {
  return bankAccountOpts.value
})

watch(() => props.party, (p) => {
  if (p) {
    amount.value = p.total_outstanding || 0
    referenceNo.value = ''
    payMode.value = 'order'
    selectedOrders.value = (p.orders || []).map(o => o.name)
    selectedBankAccount.value = ''
    loadBankAccounts()
  }
}, { immediate: true })

async function loadBankAccounts() {
  bankAccountLoading.value = true
  try {
    const res = await frappeCall('gege_custom.gege_custom.utils.get_adjustable_bank_accounts', { currency: props.currency })
    bankAccountOpts.value = res || []
  } catch (e) {
    bankAccountOpts.value = []
  } finally {
    bankAccountLoading.value = false
  }
}

async function submitPayment() {
  if (!props.party || amount.value <= 0) return
  if (!selectedBankAccount.value) {
    error('Vui lòng chọn tài khoản ngân hàng')
    return
  }
  saving.value = true
  try {
    const partyId = props.side === 'payable' ? props.party.supplier : props.party.customer

    const payload = {
      side: props.side,
      party: partyId,
      amount: amount.value,
      mode: payMode.value,
      bank_account: selectedBankAccount.value,
      ...(referenceNo.value ? { reference_no: referenceNo.value } : {}),
      ...(payMode.value === 'order' ? {
        selected_orders: selectedOrders.value,
        use_advance_first: useAdvanceFirst.value,
      } : {}),
    }
    await frappeCall('gege_custom.gege_custom.api.debt.record_party_payment', payload)

    visible.value = false
    emit('saved')
    success(payMode.value === 'advance' ? 'Đã ghi nhận tạm ứng!' : 'Đã ghi nhận thanh toán!')
  } catch (e) {
    error('Lỗi: ' + (e.message || e))
  } finally {
    saving.value = false
  }
}
</script>
