<template>
  <div class="h-full flex flex-col">
    <PageHeader title="Tạo Flip Session" subtitle="Chọn tài khoản và input items" />
    <div class="flex-1 overflow-y-auto">
      <div class="max-w-3xl mx-auto p-6 space-y-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2 ml-1 opacity-80">Ngữ cảnh Game</label>
            <select v-model="form.game_context" class="w-full bg-app-surface border border-app-border rounded-2xl px-5 py-3.5 text-app-text-primary text-sm outline-none focus:border-indigo-600 transition-all font-bold appearance-none cursor-pointer">
              <option value="">Chọn Context</option>
              <option v-for="ctx in contextOptions" :key="ctx" :value="ctx">{{ contextLabel(ctx) }}</option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] mb-2 ml-1 opacity-80">Tài khoản game</label>
            <select v-model="form.game_account" :disabled="!form.game_context" class="w-full bg-app-surface border border-app-border rounded-2xl px-5 py-3.5 text-app-text-primary text-sm outline-none focus:border-indigo-600 transition-all font-bold appearance-none cursor-pointer disabled:opacity-40">
              <option value="">Chọn Account</option>
              <option v-for="acc in accountOptions" :key="acc" :value="acc">{{ acc }}</option>
            </select>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-red-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Items tiêu hao (từ kho)</h4>
            <button @click="items.push({ currency_item: '', qty: '' })" class="text-[10px] font-black text-indigo-600 hover:text-indigo-400 uppercase tracking-widest transition-colors">+ Thêm</button>
          </div>
          <div v-for="(item, idx) in items" :key="idx" class="flex items-center gap-3">
            <SearchableSelect v-model="item.currency_item" :options="rowItemOptions(idx)" placeholder="Chọn Context + Account..." compact :disabled="!form.game_context || !form.game_account" class="flex-1" />
            <span v-if="item.currency_item" class="text-[9px] font-black text-app-text-muted whitespace-nowrap opacity-60">/{{ availableQty(item.currency_item) }}</span>
            <input v-model.number="item.qty" type="number" placeholder="SL" min="0" class="w-24 bg-app-surface border border-app-border rounded-xl px-3 py-2.5 text-app-text-primary text-sm outline-none focus:border-indigo-600 font-black">
            <button v-if="items.length > 1" @click="items.splice(idx, 1)" class="text-app-text-muted hover:text-red-400 text-lg transition-colors px-1">&#10005;</button>
          </div>
        </div>

        <div class="flex flex-wrap justify-end gap-3 pt-2">
          <AppButton variant="neutral" size="md" @click="$router.push('/flip')">Huỷ</AppButton>
          <AppButton variant="primary" size="lg" :loading="submitting" :disabled="submitting" @click="submit">Tạo Session</AppButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { frappeCall, getList } from '../api/index.js'
import { useNotify } from '../composables/useNotify.js'
import AppButton from '../components/AppButton.vue'
import { useMetadata } from '../composables/useMetadata.js'
import SearchableSelect from '../components/SearchableSelect.vue'
import PageHeader from '../components/PageHeader.vue'

const router = useRouter()
const { success, error, warn } = useNotify()
const { currencyItems, gameContexts, gameAccounts, fetchMetadata, currencyItemMap, contextMap } = useMetadata()
const submitting = ref(false)
const inventory = ref([])
const form = ref({ game_context: '', game_account: '' })
const items = ref([{ currency_item: '', qty: '' }])

const contextOptions = computed(() => [...new Set(gameContexts.value.map(g => g.name))].sort())

function contextLabel(name) {
  const ctx = contextMap.value[name]
  return ctx ? `${ctx.game_title || ''} - ${ctx.season_or_league || ctx.mode || name}` : name
}

const accountOptions = computed(() => {
  if (!form.value.game_context) return []
  const title = contextMap.value[form.value.game_context]?.game_title
  return gameAccounts.value.filter(a => !title || a.game_title === title).map(a => a.name).sort()
})

const availableItems = computed(() => {
  if (!form.value.game_context || !form.value.game_account) return []
  return [...new Set(
    inventory.value
      .filter(i => i.game_context === form.value.game_context && i.game_account === form.value.game_account && Number(i.qty_available || 0) > 0)
      .map(i => i.currency_item)
  )].sort()
})

function rowItemOptions(idx) {
  const taken = items.value.filter((_, i) => i !== idx).map(i => i.currency_item)
  return availableItems.value.filter(v => !taken.includes(v)).map(v => ({ value: v, label: currencyItemMap.value[v]?.item_name || v }))
}

function availableQty(currencyItem) {
  if (!form.value.game_context || !form.value.game_account) return 0
  return inventory.value
    .filter(i => i.game_context === form.value.game_context && i.game_account === form.value.game_account && i.currency_item === currencyItem)
    .reduce((sum, i) => sum + Number(i.qty_available || 0), 0)
}

watch(() => form.value.game_context, () => {
  form.value.game_account = ''
  items.value = [{ currency_item: '', qty: '' }]
})

async function loadInventory() {
  try {
    const [inv] = await Promise.all([
      getList('Inventory Position', { fields: ['name', 'game_account', 'currency_item', 'game_context', 'qty_available', 'qty_locked'], filters: [['is_active', '=', 1]], limit: 0 }),
      fetchMetadata(),
    ])
    inventory.value = inv
  } catch (e) {
    error('Lỗi tải dữ liệu: ' + (e.message || e))
  }
}

async function submit() {
  if (!form.value.game_context || !form.value.game_account) return warn('Chọn Context và Account.')
  const validItems = items.value.filter(i => i.currency_item && Number(i.qty) > 0)
  if (validItems.length === 0) return warn('Cần ít nhất 1 item.')
  for (const item of validItems) {
    const avail = availableQty(item.currency_item)
    if (Number(item.qty) > avail) return warn(`${currencyItemMap.value[item.currency_item]?.item_name || item.currency_item}: cần ${item.qty}, kho chỉ có ${avail}`)
  }
  submitting.value = true
  try {
    const result = await frappeCall('gege_custom.gege_custom.api.flip_session.create_flip_session', {
      game_account: form.value.game_account,
      game_context: form.value.game_context,
      input_items: validItems.map(i => ({ currency_item: i.currency_item, qty: Number(i.qty) })),
    })
    success('Tạo Flip Session thành công!')
    router.push(`/flip/${result}`)
  } catch (e) {
    error('Lỗi tạo session: ' + (e.message || e))
  } finally {
    submitting.value = false
  }
}

onMounted(() => { loadInventory() })
</script>
