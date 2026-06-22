<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="$emit('close')">
    <div class="bg-app-surface border border-app-border rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col mx-4 max-h-[90vh]">
      <!-- Header -->
      <div class="p-4 border-b border-app-border flex justify-between items-center bg-app-bg/50 shrink-0">
        <h3 class="text-app-text-primary font-medium text-sm">Cài đặt Quick Fill</h3>
        <button @click="$emit('close')" class="text-app-text-muted hover:text-app-text-primary transition">✕</button>
      </div>

      <!-- List -->
      <div class="flex-1 overflow-y-auto p-3 space-y-2">
        <div v-for="p in presets" :key="p.id"
          class="bg-app-bg border rounded-xl p-3 transition-all"
          :class="p.is_default ? 'border-indigo-500/50 bg-indigo-600/[0.03]' : 'border-app-border'">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <button @click="$emit('setDefault', p.id)" class="shrink-0 text-lg leading-none" :class="p.is_default ? 'text-indigo-500' : 'text-app-text-muted opacity-30 hover:opacity-70'">
                {{ p.is_default ? '★' : '☆' }}
              </button>
              <div class="min-w-0">
                <p class="text-sm font-bold text-app-text-primary truncate">{{ p.name }}</p>
                <p class="text-[10px] text-app-text-muted mt-0.5 space-x-2">
                  <span v-if="getTraderLabel(p.assigned_trader)">{{ getTraderLabel(p.assigned_trader) }}</span>
                  <span v-if="getContextLabel(p.game_context)">{{ getContextLabel(p.game_context) }}</span>
                  <span v-if="p.transaction_currency">{{ p.transaction_currency }}</span>
                </p>
                <div v-if="p.currency_items?.length" class="flex flex-wrap gap-1 mt-1">
                  <span v-for="entry in p.currency_items" :key="entry.currency_item" class="text-[9px] bg-emerald-600/10 text-emerald-600 px-1.5 py-0.5 rounded font-bold">
                    {{ getItemLabel(entry.currency_item) }}<template v-if="entry.unit_price"> ({{ entry.unit_price }})</template>
                  </span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button @click="startEdit(p)" class="text-[10px] text-app-text-muted hover:text-indigo-500 px-1.5 py-0.5 rounded hover:bg-app-surface transition">Sửa</button>
              <button @click="$emit('deletePreset', p.id)" class="text-[10px] text-app-text-muted hover:text-red-500 px-1.5 py-0.5 rounded hover:bg-app-surface transition">Xóa</button>
            </div>
          </div>
        </div>

        <p v-if="presets.length === 0" class="text-xs text-app-text-muted text-center py-6 opacity-60">Chưa có profile nào. Thêm profile mới bên dưới.</p>
      </div>

      <!-- Form -->
      <div class="border-t border-app-border p-4 bg-app-bg/30 shrink-0 space-y-3">
        <h4 class="text-[10px] font-black text-app-text-muted uppercase tracking-widest">
          {{ editingId ? '✏️ Sửa profile' : '+ Thêm profile mới' }}
        </h4>
        <input v-model="form.name" type="text" placeholder="Tên profile *" class="input-field !py-1.5 text-xs" />

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-1 block">Người thanh toán</label>
            <SearchableSelect v-model="form.assigned_trader" :options="recipientOpts" placeholder="-- Chọn --" compact />
          </div>
          <div>
            <label class="text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-1 block">Ngữ cảnh Game</label>
            <SearchableSelect v-model="form.game_context" :options="gameContextOpts" placeholder="-- Chọn --" compact @change="onFormContextChange" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-1 block">Tiền tệ</label>
            <select v-model="form.transaction_currency" class="input-field !py-1.5 text-xs">
              <option value="VND">VND</option>
              <option value="USD">USD</option>
              <option value="CNY">CNY</option>
                      <option value="USDT">USDT</option>
            </select>
          </div>
          <div>
            <label class="text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-1 block">Kho nhận</label>
            <SearchableSelect v-model="form.game_account" :options="formKhoOpts" placeholder="-- Chọn --" compact />
          </div>
        </div>

        <!-- Items -->
        <div v-if="form.game_context">
          <label class="text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-1 block">Mặt hàng</label>
          <div v-if="form.currency_items.length" class="space-y-1.5 mb-2">
            <div v-for="(item, idx) in form.currency_items" :key="idx"
              class="flex items-center gap-2 bg-emerald-600/[0.05] rounded-lg px-2 py-1.5">
              <span class="text-[10px] text-emerald-600 font-bold min-w-0 truncate flex-1">{{ getItemLabel(item.currency_item) }}</span>
              <input v-model.number="item.unit_price" type="number" step="any" min="0" placeholder="Đơn giá"
                class="w-24 text-right bg-app-bg border border-app-border rounded px-2 py-1 text-[10px] font-mono outline-none focus:border-indigo-600" />
              <button @click="form.currency_items.splice(idx, 1)" class="text-app-text-muted hover:text-red-500 text-xs shrink-0">×</button>
            </div>
          </div>
          <SearchableSelect v-model="formItemSelect" :options="formItemOptsFiltered" placeholder="+ Thêm mặt hàng" compact @update:model-value="addFormItem" />
        </div>

        <div class="flex gap-2 pt-1">
          <AppButton variant="neutral" size="sm" class="flex-1" @click="resetForm">{{ editingId ? 'Huỷ sửa' : 'Xoá form' }}</AppButton>
          <AppButton variant="primary" size="sm" class="flex-1" @click="saveForm" :disabled="!form.name.trim()">{{ editingId ? 'Cập nhật' : 'Lưu profile' }}</AppButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import SearchableSelect from './SearchableSelect.vue'
import AppButton from './AppButton.vue'
import { useMetadata } from '../composables/useMetadata.js'

const props = defineProps({
  isOpen: Boolean,
  presets: Array,
  recipientOpts: Array,
})

const emit = defineEmits(['close', 'savePreset', 'deletePreset', 'setDefault'])

const { gameContexts, gameAccounts, contextMap, getItemOpts, currencyItems } = useMetadata()

const gameContextOpts = computed(() =>
  gameContexts.value.map(g => ({ label: g.context_name || g.name, value: g.name }))
)

// Form state
const editingId = ref(null)
const form = ref({
  name: '',
  assigned_trader: '',
  game_context: '',
  transaction_currency: 'VND',
  game_account: '',
  currency_items: [],
})
const formItemSelect = ref('')

// Computed opts for form
const formGameTitle = computed(() => {
  if (!form.value.game_context) return ''
  return contextMap.value[form.value.game_context]?.game_title || ''
})
const formItemOpts = getItemOpts(formGameTitle)
const formItemOptsFiltered = computed(() =>
  formItemOpts.value.filter(o => !form.value.currency_items.some(i => i.currency_item === o.value))
)
const formKhoOpts = computed(() => {
  if (!form.value.game_context) return []
  const gc = gameContexts.value.find(g => g.name === form.value.game_context)
  if (!gc) return []
  return gameAccounts.value
    .filter(a => a.game_title === gc.game_title)
    .map(a => ({ label: a.account_name, value: a.name }))
})

// Reset form when modal opens
watch(() => props.isOpen, (val) => {
  if (val) resetForm()
})

function resetForm() {
  editingId.value = null
  form.value = {
    name: '',
    assigned_trader: '',
    game_context: '',
    transaction_currency: 'VND',
    game_account: '',
    currency_items: [],
  }
  formItemSelect.value = ''
}

function startEdit(p) {
  editingId.value = p.id
  form.value = {
    name: p.name || '',
    assigned_trader: p.assigned_trader || '',
    game_context: p.game_context || '',
    transaction_currency: p.transaction_currency || 'VND',
    game_account: p.game_account || '',
    currency_items: (p.currency_items || []).map(i => ({ currency_item: i.currency_item, unit_price: i.unit_price || null })),
  }
  formItemSelect.value = ''
}

function onFormContextChange() {
  form.value.currency_items = []
  form.value.game_account = ''
}

function addFormItem(val) {
  if (val && !form.value.currency_items.some(i => i.currency_item === val)) {
    form.value.currency_items.push({ currency_item: val, unit_price: null })
  }
  formItemSelect.value = ''
}

function saveForm() {
  if (!form.value.name.trim()) return
  emit('savePreset', {
    id: editingId.value || undefined,
    name: form.value.name.trim(),
    assigned_trader: form.value.assigned_trader || '',
    game_context: form.value.game_context || '',
    transaction_currency: form.value.transaction_currency || 'VND',
    game_account: form.value.game_account || '',
    currency_items: [...form.value.currency_items],
    is_default: false,
  })
  resetForm()
}

// Label helpers
function getTraderLabel(val) {
  if (!val) return ''
  const opt = props.recipientOpts?.find(o => o.value === val)
  return opt?.label || val
}

function getContextLabel(val) {
  if (!val) return ''
  const gc = gameContexts.value.find(g => g.name === val)
  return gc?.context_name || gc?.name || val
}

function getItemLabel(val) {
  if (!val) return ''
  const opt = formItemOpts.value.find(o => o.value === val)
  if (opt) return opt.label
  const item = currencyItems.value.find(i => i.name === val)
  return item?.item_name || val
}
</script>
