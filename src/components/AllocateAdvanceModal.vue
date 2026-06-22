<template>
  <ModalWrapper v-model="visible" size="md" :z-index="70">
    <template #header>
      <div class="px-8 pt-8 pb-4">
        <h3 class="text-app-text-primary font-black text-xl flex items-center gap-2">
          <span class="text-indigo-600">📋</span>
          Phân bổ tạm ứng
        </h3>
        <p v-if="partyName" class="text-xs text-app-text-muted mt-1">{{ partyName }}</p>
      </div>
    </template>

    <div v-if="group" class="px-8 py-4 space-y-5">
      <!-- Unallocated Balance -->
      <div class="bg-app-bg rounded-xl p-4 flex items-center justify-between">
        <div>
          <p class="text-[9px] text-app-text-muted font-black uppercase tracking-widest">Tạm ứng chưa phân bổ</p>
          <p class="text-lg font-black font-mono text-indigo-600">{{ formatMoney(group.advance_balance, group.currency) }}</p>
        </div>
      </div>

      <!-- Order Selection -->
      <div>
        <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-2">Chọn đơn hàng cần phân bổ</label>
        <div class="max-h-52 overflow-y-auto custom-scrollbar space-y-1 bg-app-bg rounded-xl p-2">
          <label v-for="order in outstandingOrders" :key="order.name"
            class="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-app-surface/50 transition"
            :class="selectedOrders.includes(order.name) ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30' : ''">
            <input type="checkbox" :value="order.name" v-model="selectedOrders"
              class="w-4 h-4 rounded border-app-border text-indigo-600 focus:ring-indigo-500" />
            <div class="flex-1 min-w-0">
              <span class="text-xs font-black text-app-text-primary">{{ order.name }}</span>
              <p class="text-[10px] text-app-text-muted">
                Còn nợ <span class="text-red-600 font-bold">{{ formatMoney(order.invoice_outstanding, group.currency) }}</span>
                &middot; Quá hạn {{ order.aging_days || 0 }} ngày
              </p>
            </div>
          </label>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="flex gap-2">
        <AppButton variant="ghost" size="xs" pill @click="selectedOrders = outstandingOrders.map(o => o.name)">Chọn tất cả</AppButton>
        <AppButton variant="ghost" size="xs" pill @click="selectedOrders = []">Bỏ chọn tất cả</AppButton>
      </div>

      <!-- Allocation Preview -->
      <div v-if="selectedOrders.length > 0" class="bg-app-bg rounded-xl p-4 space-y-2">
        <p class="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Xem trước phân bổ (cũ nhất trước)</p>
        <div v-for="a in allocPreview" :key="a.order" class="flex justify-between text-[11px]">
          <span class="text-app-text-primary font-bold">{{ a.order }}</span>
          <div class="text-right">
            <span class="font-mono text-indigo-600 font-bold">{{ formatMoney(a.alloc, group.currency) }}</span>
            <span v-if="a.remaining > 0" class="text-app-text-muted ml-2">còn {{ formatMoney(a.remaining, group.currency) }}</span>
            <span v-else class="text-emerald-600 ml-2 text-[9px]">✓ trả đủ</span>
          </div>
        </div>
        <div v-if="unallocatedRemainder > 0" class="flex justify-between text-[11px] pt-1 border-t border-app-border/50">
          <span class="text-app-text-muted font-bold">Còn lại (không phân bổ)</span>
          <span class="font-mono font-bold text-app-text-muted">{{ formatMoney(unallocatedRemainder, group.currency) }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <AppButton variant="neutral" size="md" @click="visible = false">Huỷ</AppButton>
      <AppButton variant="primary" size="md" :loading="saving" :disabled="!selectedOrders.length || saving" @click="submitAllocate">
        Phân bổ ({{ selectedOrders.length }} đơn)
      </AppButton>
    </template>
  </ModalWrapper>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import ModalWrapper from './ModalWrapper.vue'
import AppButton from './AppButton.vue'
import { frappeCall } from '../api/index.js'
import { formatMoney, getOrderCurrency } from '../utils/format.js'
import { useNotify } from '../composables/useNotify.js'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  group: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'saved'])

const { success, error } = useNotify()
const selectedOrders = ref([])
const saving = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const partyName = computed(() => {
  if (!props.group) return ''
  return props.group.supplier_name || props.group.customer_name || ''
})

const outstandingOrders = computed(() => {
  if (!props.group?.orders) return []
  return props.group.orders.filter(o => (Number(o.invoice_outstanding) || 0) > 0)
})

const allocPreview = computed(() => {
  if (!selectedOrders.value.length || !props.group) return []
  // Sort aging descending: oldest debt first (FIFO)
  const selected = outstandingOrders.value
    .filter(o => selectedOrders.value.includes(o.name))
    .sort((a, b) => (b.aging_days || 0) - (a.aging_days || 0))
  let rem = props.group.advance_balance
  return selected.map(o => {
    const oRem = Number(o.invoice_outstanding) || 0
    const alloc = Math.min(rem, oRem)
    rem -= alloc
    return { order: o.name, alloc, remaining: oRem - alloc }
  }).filter(a => a.alloc > 0)
})

const unallocatedRemainder = computed(() => {
  if (!props.group || !selectedOrders.value.length) return 0
  const totalAlloc = allocPreview.value.reduce((s, a) => s + a.alloc, 0)
  return Math.max(0, props.group.advance_balance - totalAlloc)
})

watch(() => props.group, (g) => {
  if (g) {
    // Auto-select orders (oldest first) until advance is consumed
    const orders = (g.orders || [])
      .filter(o => (Number(o.invoice_outstanding) || 0) > 0)
      .sort((a, b) => (b.aging_days || 0) - (a.aging_days || 0)) // oldest first
    let rem = g.advance_balance || 0
    const autoSelected = []
    for (const o of orders) {
      if (rem <= 0) break
      const outstanding = Number(o.invoice_outstanding) || 0
      autoSelected.push(o.name)
      rem -= outstanding
    }
    selectedOrders.value = autoSelected
  }
}, { immediate: true })

async function submitAllocate() {
  if (!props.group || !selectedOrders.value.length) return
  saving.value = true
  try {
    const partyId = props.group.supplier || props.group.customer
    const side = props.group.supplier ? 'payable' : 'receivable'
    const result = await frappeCall('gege_custom.gege_custom.api.debt.allocate_advance_to_invoices', {
      side,
      party: partyId,
      selected_orders: selectedOrders.value,
    })
    if (result.allocated > 0) {
      success(`Đã phân bổ ${formatMoney(result.allocated, props.group.currency)} vào ${result.count} hóa đơn`)
      visible.value = false
      emit('saved')
    } else {
      success('Không có hóa đơn chưa thanh toán để phân bổ')
    }
  } catch (e) {
    error('Lỗi phân bổ: ' + (e.message || e))
  } finally {
    saving.value = false
  }
}
</script>
